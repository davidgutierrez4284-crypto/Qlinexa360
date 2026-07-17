import crypto from 'crypto';
import { uploadToLocalStorage, uploadToS3 } from '../../utils/file.utils';
import prisma from '../../config/database';
import { AppError } from '../../utils/error.utils';
import { LAB_ERRORS } from '../../constants/lab.constants';
import { validateLabPdfBuffer } from './labPdfValidation.service';
import { recordLabAuditFireAndForget } from './labAudit.service';
import { isSmartLabPatientUploadEnabled } from '../../config/smartLab.config';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { assertPatientAccess, resolveDoctorId } from './labAccess.service';

function isDevelopmentEnv(): boolean {
  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'development';
}

export async function uploadLabReportPdf(
  req: AuthRequest,
  patientId: string,
  file: Express.Multer.File
) {
  const access = await assertPatientAccess(req, patientId);
  if (access.role === 'PATIENT' && !isSmartLabPatientUploadEnabled()) {
    throw new AppError(LAB_ERRORS.PATIENT_UPLOAD_DISABLED, 403);
  }

  await validateLabPdfBuffer(file.buffer, file.mimetype);

  const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const duplicate = await prisma.labReport.findFirst({
    where: { patientId, fileHash },
    select: { id: true },
  });
  if (duplicate) throw new AppError(LAB_ERRORS.DUPLICATE_FILE, 409);

  const doctorId =
    access.role === 'DOCTOR' || access.role === 'ASISTENTE'
      ? access.doctorId ?? (await resolveDoctorId(req))
      : null;

  const category = `smart-lab/${patientId}`;
  let uploaded: { url: string; key: string };

  // En desarrollo: disco local directo (evita InvalidAccessKeyId / timeouts S3).
  // Prod: solo S3 (ECS no tiene disco persistente).
  if (isDevelopmentEnv()) {
    uploaded = await uploadToLocalStorage(file, category, patientId);
    console.log('Smart Lab: PDF guardado en uploads/ local (development):', uploaded.key);
  } else {
    try {
      uploaded = await uploadToS3(file, category, patientId);
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'error desconocido';
      console.error('Smart Lab S3 upload failed:', detail);
      throw new AppError(
        'No se pudo almacenar el PDF en el servidor de archivos. Verifica la configuración de almacenamiento (S3).',
        503
      );
    }
  }

  const report = await prisma.labReport.create({
    data: {
      patientId,
      doctorId: doctorId ?? undefined,
      sourcePdfUrl: uploaded.url,
      fileHash,
      extractionStatus: 'uploaded',
    },
  });

  recordLabAuditFireAndForget({
    actorUserId: access.userId,
    patientId,
    labReportId: report.id,
    action: 'upload',
    metadata: { fileHash, key: uploaded.key },
  });

  return report;
}
