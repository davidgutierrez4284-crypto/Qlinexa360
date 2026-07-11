import prisma from '../../config/database';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../utils/error.utils';
import { LAB_ERRORS } from '../../constants/lab.constants';

const LAB_ROLES = ['DOCTOR', 'PATIENT', 'ASISTENTE', 'ADMIN'] as const;

export type LabAccessContext = {
  role: string;
  userId: string;
  doctorId?: string | null;
  patientId?: string | null;
};

export function assertLabRole(role: string): void {
  if (!LAB_ROLES.includes(role as (typeof LAB_ROLES)[number])) {
    throw new AppError(LAB_ERRORS.FORBIDDEN, 403);
  }
}

export async function resolveDoctorId(req: AuthRequest): Promise<string | null> {
  if (!req.user) throw new AppError(LAB_ERRORS.UNAUTHORIZED, 401);
  assertLabRole(req.user.role);

  if (req.user.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.userId },
      select: { id: true },
    });
    if (!doctor) throw new AppError('Usuario no encontrado en tabla Doctor', 404);
    return doctor.id;
  }

  if (req.user.role === 'ASISTENTE') {
    const selectedDoctorId = req.headers['x-selected-doctor-id'];
    if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
      throw new AppError('Doctor seleccionado requerido', 400);
    }
    const link = await prisma.asistenteDoctorVinculo.findFirst({
      where: {
        doctorId: selectedDoctorId,
        asistenteId: req.user.userId,
        activo: true,
      },
      select: { permisosEstudios: true },
    });
    if (!link) throw new AppError('Asistente no vinculado a este doctor', 403);
    if (!link.permisosEstudios) {
      throw new AppError('No tienes permisos para estudios de laboratorio', 403);
    }
    return selectedDoctorId;
  }

  if (req.user.role === 'ADMIN') {
    return null;
  }

  return null;
}

export async function resolvePatientIdForUser(userId: string, role: string): Promise<string | null> {
  if (role !== 'PATIENT') return null;
  const patient = await prisma.patient.findUnique({
    where: { userId },
    select: { id: true },
  });
  return patient?.id ?? null;
}

export async function assertPatientAccess(req: AuthRequest, patientId: string): Promise<LabAccessContext> {
  if (!req.user) throw new AppError(LAB_ERRORS.UNAUTHORIZED, 401);
  const { userId, role } = req.user;
  assertLabRole(role);

  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, userId: true } });
  if (!patient) throw new AppError(LAB_ERRORS.PATIENT_NOT_FOUND, 404);

  if (role === 'PATIENT') {
    if (patient.userId !== userId) throw new AppError(LAB_ERRORS.FORBIDDEN, 403);
    return { role, userId, patientId };
  }

  if (role === 'ADMIN') {
    const admin = await prisma.admin.findUnique({ where: { userId }, select: { id: true } });
    if (!admin) throw new AppError(LAB_ERRORS.FORBIDDEN, 403);
    return { role, userId, patientId };
  }

  const doctorId = await resolveDoctorId(req);
  if (!doctorId) throw new AppError(LAB_ERRORS.FORBIDDEN, 403);

  const link = await prisma.doctorPatient.findFirst({
    where: { doctorId, patientId },
    select: { id: true },
  });
  if (!link) throw new AppError(LAB_ERRORS.FORBIDDEN, 403);

  return { role, userId, doctorId, patientId };
}

export async function assertReportAccess(req: AuthRequest, reportId: string) {
  const report = await prisma.labReport.findUnique({
    where: { id: reportId },
    include: { results: true },
  });
  if (!report) throw new AppError(LAB_ERRORS.REPORT_NOT_FOUND, 404);
  await assertPatientAccess(req, report.patientId);
  return report;
}
