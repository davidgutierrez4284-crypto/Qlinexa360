import { Request, Response } from 'express';
import { PrismaClient, ClinicalIntakeStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error.utils';
import { INTAKE_LINK_EXPIRY_DAYS, INTAKE_REASONS } from '../constants/clinicalIntake.constants';
import {
  ClinicalIntakeConsentPdfService,
  mergeConsentFileIntoFormData
} from '../services/clinicalIntakeConsentPdf.service';
import { uploadToS3 } from '../utils/file.utils';
import { validateFile } from '../middlewares/upload.middleware';
import { FileCategory, NotificationType } from '@prisma/client';
import { getPatientDisplayFromIntake } from '../utils/clinicalIntakeDisplay.utils';
import {
  ensureIntakePortalSlug,
  intakePortalPublicUrl,
  resolveFrontendBaseUrl
} from '../utils/clinicalIntakePortal.utils';

const prisma = new PrismaClient();

const STAFF_VISIBLE_STATUSES: ClinicalIntakeStatus[] = [
  'SUBMITTED_PENDING_VALIDATION',
  'APPROVED',
  'REJECTED',
  'CONVERTED'
];

const generateToken = () => randomBytes(32).toString('hex');

async function resolveDoctorForRequest(req: AuthRequest) {
  if (!req.user?.userId) return null;
  if (req.user.role === 'DOCTOR') {
    return prisma.doctor.findUnique({ where: { userId: req.user.userId } });
  }
  if (req.user.role === 'ASISTENTE') {
    const selectedDoctorId = req.headers['x-selected-doctor-id'];
    if (!selectedDoctorId || Array.isArray(selectedDoctorId)) return null;
    const link = await prisma.asistenteDoctorVinculo.findFirst({
      where: { doctorId: selectedDoctorId, asistenteId: req.user.userId, activo: true }
    });
    if (!link) return null;
    return prisma.doctor.findUnique({ where: { id: selectedDoctorId } });
  }
  return null;
}

function intakeExpired(intake: { expiresAt: Date | null; linkNeverExpires: boolean; status: ClinicalIntakeStatus }) {
  if (intake.linkNeverExpires) return false;
  if (!intake.expiresAt) return false;
  return intake.expiresAt < new Date() && intake.status === 'DRAFT';
}

async function ensureIntakePortalToken(doctorId: string, existingToken?: string | null) {
  if (existingToken) return existingToken;
  const portalToken = generateToken();
  await prisma.doctor.update({
    where: { id: doctorId },
    data: { intakePortalToken: portalToken }
  });
  return portalToken;
}

async function buildPortalInfoData(doctor: {
  id: string;
  professionalTitle: string;
  user: { firstName: string; lastName: string } | null;
}) {
  const agenda = await prisma.agendaPacientesLink.findFirst({
    where: { doctor_id: doctor.id }
  });
  const agendaEnabled = !!(agenda?.esta_activo && agenda?.link);
  return {
    doctorId: doctor.id,
    doctorName: doctor.user
      ? `${doctor.user.firstName} ${doctor.user.lastName}`.trim()
      : doctor.professionalTitle,
    reasons: INTAKE_REASONS,
    agenda: {
      enabled: agendaEnabled,
      link: agendaEnabled ? agenda!.link : null,
      message: agendaEnabled ? agenda!.mensaje_custom || null : null
    }
  };
}

async function createPortalDraftIntake(doctorId: string) {
  return prisma.clinicalIntake.create({
    data: {
      token: generateToken(),
      doctorId,
      linkNeverExpires: true,
      status: 'DRAFT'
    }
  });
}

export class ClinicalIntakeController {
  /** Staff: obtener link fijo de portal (slug amigable + token legacy para compatibilidad). */
  static async getPortalLink(req: AuthRequest, res: Response) {
    const doctor = await resolveDoctorForRequest(req);
    if (!doctor) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }

    const doctorFull = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      include: { user: { select: { firstName: true, lastName: true } } }
    });
    if (!doctorFull) {
      return res.status(404).json({ success: false, message: 'Doctor no encontrado' });
    }

    const portalToken = await ensureIntakePortalToken(doctor.id, doctorFull.intakePortalToken);
    const portalSlug = await ensureIntakePortalSlug(prisma, doctorFull);
    const frontendUrl = resolveFrontendBaseUrl();
    const portalUrl = intakePortalPublicUrl(frontendUrl, portalSlug);

    return res.json({
      success: true,
      data: { portalToken, portalSlug, portalUrl }
    });
  }

  /** Staff: regenerar token legacy (/pre-registro/p/...). El slug amigable no cambia. */
  static async regeneratePortalLink(req: AuthRequest, res: Response) {
    const doctor = await resolveDoctorForRequest(req);
    if (!doctor) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }

    const doctorFull = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      include: { user: { select: { firstName: true, lastName: true } } }
    });
    if (!doctorFull) {
      return res.status(404).json({ success: false, message: 'Doctor no encontrado' });
    }

    const portalToken = generateToken();
    await prisma.doctor.update({
      where: { id: doctor.id },
      data: { intakePortalToken: portalToken }
    });

    const portalSlug = await ensureIntakePortalSlug(prisma, doctorFull);
    const frontendUrl = resolveFrontendBaseUrl();
    const portalUrl = intakePortalPublicUrl(frontendUrl, portalSlug);

    return res.json({
      success: true,
      data: { portalToken, portalSlug, portalUrl }
    });
  }

  /** GET público por token */
  static async getPublic(req: Request, res: Response) {
    const { token } = req.params;
    const intake = await prisma.clinicalIntake.findUnique({
      where: { token },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true } }
          }
        }
      }
    });
    if (!intake) {
      return res.status(404).json({ success: false, message: 'Enlace no válido' });
    }
    if (intakeExpired(intake)) {
      return res.status(410).json({ success: false, message: 'El enlace expiró' });
    }

    const agenda = await prisma.agendaPacientesLink.findFirst({
      where: { doctor_id: intake.doctorId }
    });
    const agendaEnabled = !!(agenda?.esta_activo && agenda?.link);

    // Plantillas (mismas que se usan en consulta). Público: solo lectura + captura, sin autenticación.
    const formTemplates = await prisma.formTemplate.findMany({
      include: {
        fields: { orderBy: { order: 'asc' } }
      },
      orderBy: { name: 'asc' }
    });

    return res.json({
      success: true,
      data: {
        status: intake.status,
        formData: intake.formData,
        consultationReason: intake.consultationReason,
        reasons: INTAKE_REASONS,
        doctorName: intake.doctor.user
          ? `${intake.doctor.user.firstName} ${intake.doctor.user.lastName}`.trim()
          : intake.doctor.professionalTitle,
        expiresAt: intake.expiresAt,
        agenda: {
          enabled: agendaEnabled,
          link: agendaEnabled ? agenda!.link : null,
          message: agendaEnabled ? agenda!.mensaje_custom || null : null
        },
        formTemplates
      }
    });
  }

  /** PUT borrador público */
  static async savePublicDraft(req: Request, res: Response) {
    const { token } = req.params;
    const { formData, consultationReason } = req.body;
    const intake = await prisma.clinicalIntake.findUnique({ where: { token } });
    if (!intake || intakeExpired(intake)) {
      return res.status(404).json({ success: false, message: 'Enlace no válido o expirado' });
    }
    if (intake.status !== 'DRAFT' && intake.status !== 'SUBMITTED_PENDING_VALIDATION') {
      return res.status(400).json({ success: false, message: 'Este formulario ya fue enviado' });
    }
    const updated = await prisma.clinicalIntake.update({
      where: { id: intake.id },
      data: {
        formData: formData ?? intake.formData,
        consultationReason: consultationReason ?? intake.consultationReason
      }
    });
    return res.json({ success: true, data: updated });
  }

  /** POST envío + PDF consentimiento */
  static async submitPublic(req: Request, res: Response) {
    const { token } = req.params;
    const {
      formData,
      consultationReason,
      consentPrivacy,
      consentTreatment,
      consentPlatform,
      consentSignerName
    } = req.body;

    const intake = await prisma.clinicalIntake.findUnique({
      where: { token },
      include: { doctor: { include: { user: true } } }
    });
    if (!intake || intakeExpired(intake)) {
      return res.status(404).json({ success: false, message: 'Enlace no válido o expirado' });
    }
    if (!consentPrivacy || !consentTreatment || !consentPlatform) {
      return res.status(400).json({ success: false, message: 'Debes aceptar todos los consentimientos' });
    }
    if (!consentSignerName || String(consentSignerName).trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Firma (nombre) requerida' });
    }

    const patientBlock = (formData as {
      patient?: { email?: string; firstName?: string; lastName?: string; phone?: string };
    })?.patient;
    const fullName =
      `${patientBlock?.firstName || ''} ${patientBlock?.lastName || ''}`.trim() || consentSignerName;
    const email = String(patientBlock?.email || '').trim() || 'paciente@preregistro.local';
    const phone = String(patientBlock?.phone || '').trim();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    const signedAt = new Date();

    const doctorUserId = intake.doctor?.userId;
    if (!doctorUserId) {
      return res.status(500).json({
        success: false,
        message: 'No se pudo registrar el consentimiento (doctor no encontrado)'
      });
    }

    let consentPdfUrl: string | null = null;
    let consentDocumentHash: string | null = null;
    let consentFileId: string | null = null;
    let mergedFormData = formData;

    try {
      const consentFile = await ClinicalIntakeConsentPdfService.generateAndPersist({
        intakeId: intake.id,
        doctorId: intake.doctorId,
        uploadedByUserId: doctorUserId,
        patientId: intake.patientId,
        fullName,
        email,
        phone,
        signature: String(consentSignerName).trim(),
        ipAddress: ip,
        signedAt
      });
      consentPdfUrl = consentFile.url;
      consentDocumentHash = consentFile.hash;
      consentFileId = consentFile.fileId;
      mergedFormData = mergeConsentFileIntoFormData(formData, {
        url: consentFile.url,
        fileName: consentFile.fileName,
        type: 'application/pdf',
        size: consentFile.size,
        fileId: consentFile.fileId
      });
    } catch (pdfErr) {
      console.error('Error generando PDF de consentimiento (pre-consulta):', pdfErr);
      return res.status(500).json({
        success: false,
        message:
          'No se pudo generar el documento de consentimiento. Verifica la configuración del servidor e intenta de nuevo.'
      });
    }

    const updated = await prisma.clinicalIntake.update({
      where: { id: intake.id },
      data: {
        formData: mergedFormData,
        consultationReason,
        consentPrivacy: true,
        consentTreatment: true,
        consentPlatform: true,
        consentSignerName: String(consentSignerName).trim(),
        consentSignedAt: signedAt,
        consentIp: ip,
        consentPdfUrl,
        consentFileId,
        consentDocumentHash,
        status: 'SUBMITTED_PENDING_VALIDATION'
      }
    });

    try {
      await prisma.notification.create({
        data: {
          userId: doctorUserId,
          type: NotificationType.NEW_CONSULTATION,
          title: 'Pre-consulta recibida',
          message: `${fullName} envió una pre-consulta. Revísala en el módulo Pre-consultas.`,
          data: { clinicalIntakeId: updated.id, path: `/dashboard/pre-consultas/${updated.id}` }
        }
      });
    } catch (notifErr) {
      console.error('Error creando notificación de pre-consulta:', notifErr);
    }

    return res.json({ success: true, data: { id: updated.id, status: updated.status } });
  }

  /** Subida de archivos (público con token, sin JWT). */
  static async uploadPublic(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const { category } = req.body as { category?: FileCategory };
      const file = (req as any).file as Express.Multer.File | undefined;

      if (!file) {
        return res.status(400).json({ success: false, message: 'No se ha subido ningún archivo' });
      }
      if (!category || !Object.values(FileCategory).includes(category)) {
        return res.status(400).json({ success: false, message: 'Categoría de archivo inválida' });
      }

      const intake = await prisma.clinicalIntake.findUnique({ where: { token } });
      if (!intake || intakeExpired(intake)) {
        return res.status(404).json({ success: false, message: 'Enlace no válido o expirado' });
      }

      const validation = validateFile(file);
      if (!validation.isValid) {
        return res.status(400).json({ success: false, message: validation.error });
      }

      // Subir a S3 y registrar en DB. `uploadedById` debe ser un `User.id` válido.
      // - Si ya existe paciente vinculado: usar userId del paciente.
      // - Si aún no existe (portal público): usar userId del doctor propietario del intake.
      const patientUserId = intake.patientId
        ? (await prisma.patient.findUnique({ where: { id: intake.patientId }, select: { userId: true } }))?.userId
        : null;
      const doctorUserId =
        (await prisma.doctor.findUnique({ where: { id: intake.doctorId }, select: { userId: true } }))?.userId || null;
      const uploadedById = patientUserId || doctorUserId;
      if (!uploadedById) {
        return res.status(500).json({ success: false, message: 'No se pudo asociar el archivo a un usuario' });
      }

      const { url } = await uploadToS3(file, category, uploadedById);

      // Registrar en DB (sin medicalRecordId hasta convertir)
      await prisma.file.create({
        data: {
          fileName: file.originalname,
          fileType: file.mimetype,
          size: file.size,
          url,
          category,
          uploadedById,
          patientId: intake.patientId || null,
          doctorId: intake.doctorId
        }
      });

      return res.status(201).json({
        success: true,
        file: {
          fileName: file.originalname,
          url,
          type: file.mimetype,
          size: file.size,
          category
        }
      });
    } catch (e: any) {
      console.error('Error subiendo archivo en clinical intake:', e);
      return res.status(500).json({ success: false, message: e.message || 'Error al subir el archivo' });
    }
  }

  /** Staff: listar */
  static async listStaff(req: AuthRequest, res: Response) {
    const doctor = await resolveDoctorForRequest(req);
    if (!doctor) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }
    const intakes = await prisma.clinicalIntake.findMany({
      where: {
        doctorId: doctor.id,
        status: { in: STAFF_VISIBLE_STATUSES }
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
    const data = intakes.map((row) => {
      const display = getPatientDisplayFromIntake(row);
      return {
        ...row,
        patientDisplayName: display.displayName,
        patient: row.patient ?? {
          firstName: display.firstName,
          lastName: display.lastName,
          email: display.email
        }
      };
    });
    return res.json({ success: true, data });
  }

  /** Staff: detalle */
  static async getStaff(req: AuthRequest, res: Response) {
    const doctor = await resolveDoctorForRequest(req);
    if (!doctor) return res.status(401).json({ success: false, message: 'No autorizado' });
    const { id } = req.params;
    const intake = await prisma.clinicalIntake.findFirst({
      where: { id, doctorId: doctor.id },
      include: {
        patient: { include: { user: true } },
        appointment: {
          select: { id: true, date: true, status: true, confirmationStatus: true }
        }
      }
    });
    if (!intake) return res.status(404).json({ success: false, message: 'Pre-consulta no encontrada' });
    if (intake.status === 'DRAFT') {
      return res.status(404).json({ success: false, message: 'Esta pre-consulta aún no fue enviada por el paciente' });
    }

    const formTemplates = await prisma.formTemplate.findMany({
      include: { fields: { orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' }
    });
    const display = getPatientDisplayFromIntake(intake);

    return res.json({
      success: true,
      data: {
        ...intake,
        patientDisplayName: display.displayName,
        formTemplates
      }
    });
  }

  /** Staff: Guardar → convertir a Historial Clínico (MedicalRecord + adjuntos). */
  static async convertStaff(req: AuthRequest, res: Response) {
    const doctor = await resolveDoctorForRequest(req);
    if (!doctor) return res.status(401).json({ success: false, message: 'No autorizado' });
    const { id } = req.params;
    const { staffNotes: staffNotesBody } = req.body as { staffNotes?: string };

    const intake = await prisma.clinicalIntake.findFirst({
      where: { id, doctorId: doctor.id },
      include: { patient: { include: { user: true } } }
    });
    if (!intake) return res.status(404).json({ success: false, message: 'Pre-consulta no encontrada' });
    if (intake.status === 'CONVERTED') {
      return res.status(400).json({ success: false, message: 'Ya fue guardada en el historial clínico' });
    }

    const staffNotesTrim = String(staffNotesBody ?? intake.staffNotes ?? '').trim();

    const formData: any = intake.formData || {};
    const patientForm = formData.patient || {};

    let patientId: string | null = intake.patientId || null;
    let patientUserId: string | null = intake.patient?.userId || null;

    // 1) Asegurar paciente (si no existe, crear estilo createPatient simplificado)
    if (!patientId || !patientUserId) {
      const email = String(patientForm.email || '').trim().toLowerCase();
      const firstName = String(patientForm.firstName || '').trim() || 'Paciente';
      const lastName = String(patientForm.lastName || '').trim() || '';
      const phone = String(patientForm.phone || '').trim() || undefined;

      const existingUser = email ? await prisma.user.findUnique({ where: { email }, include: { patientProfile: true } }) : null;
      if (existingUser?.patientProfile) {
        patientId = existingUser.patientProfile.id;
        patientUserId = existingUser.id;
      } else {
        const created = await prisma.user.create({
          data: {
            email: email || `patient-no-email@${randomBytes(12).toString('hex')}.qlinexa360.local`,
            password: randomBytes(12).toString('hex'), // placeholder; onboarding real se maneja por invitación en otros flujos
            firstName,
            lastName,
            role: 'PATIENT' as any,
            phone,
            patientProfile: {
              create: {
                firstName,
                lastName,
                email: email || null,
                phone,
                gender: patientForm.gender || 'No especificado',
                dateOfBirth: patientForm.dateOfBirth ? new Date(patientForm.dateOfBirth) : new Date(),
                dataConsent: true,
                dataConsentAt: new Date()
              }
            }
          },
          include: { patientProfile: true }
        });
        patientId = created.patientProfile!.id;
        patientUserId = created.id;
      }

      // Vincular doctor-paciente
      const existingLink = await prisma.doctorPatient.findUnique({
        where: { doctorId_patientId: { doctorId: doctor.id, patientId: patientId! } }
      });
      if (!existingLink) {
        await prisma.doctorPatient.create({
          data: {
            doctorId: doctor.id,
            patientId: patientId!,
            status: 'activo',
            specialization: doctor.specialization ?? 'General',
            context: 'Pre-consulta (capturada por paciente)'
          }
        });
      }

      await prisma.clinicalIntake.update({
        where: { id: intake.id },
        data: { patientId: patientId! }
      });
    }

    // 2) Crear doctorPatient (para medicalRecord)
    let doctorPatient = await prisma.doctorPatient.findUnique({
      where: { doctorId_patientId: { doctorId: doctor.id, patientId: patientId! } }
    });
    if (!doctorPatient) {
      doctorPatient = await prisma.doctorPatient.create({
        data: {
          doctorId: doctor.id,
          patientId: patientId!,
          status: 'activo',
          specialization: doctor.specialization ?? 'General',
          context: 'Pre-consulta (capturada por paciente)'
        }
      });
    }

    // 3) Caso clínico
    const padecimiento = `Pre-consulta ${intake.consultationReason || 'Medicina general'}`;
    let clinicalCase = await prisma.clinicalCase.findFirst({
      where: { patientId: patientId!, padecimiento }
    });
    if (!clinicalCase) {
      clinicalCase = await prisma.clinicalCase.create({
        data: { patientId: patientId!, padecimiento, status: 'ACTIVO' }
      });
    }

    // 4) MedicalRecord — formData con mismos fieldId que consultas (plantillas de especialidad)
    const intakeReserved = new Set([
      'patient',
      'additional',
      'health',
      'attachments',
      'scheduling',
      'files',
      'notes',
      'clinical'
    ]);
    const specialtyFromNested =
      formData?.health?.datosMedicosGenerales && typeof formData.health.datosMedicosGenerales === 'object'
        ? { ...formData.health.datosMedicosGenerales }
        : {};
    const specialtyFromTop: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(formData)) {
      if (intakeReserved.has(key)) continue;
      if (val !== undefined && val !== null && val !== '') specialtyFromTop[key] = val;
    }
    const mergedSpecialty = { ...specialtyFromTop, ...specialtyFromNested };
    const motivo =
      String(formData?.health?.motivoConsulta || formData?.motivoConsulta || '').trim() ||
      intake.consultationReason ||
      'Pre-consulta';
    const notasPaciente = String(
      formData?.health?.notasPaciente || formData?.notas || formData?.notes || ''
    ).trim();
    const consultationFormData = {
      motivoConsulta: motivo,
      notas: notasPaciente || 'Pre-consulta registrada por el paciente.',
      evolucionClinica: 'INITIAL_EVALUATION',
      etiquetas: ['pre-consulta', 'evaluación-inicial'],
      registradoPor: 'PACIENTE_PRE_CONSULTA',
      origenConsulta: 'pre-consulta',
      ...mergedSpecialty
    };
    const patientNotes = String(
      notasPaciente || formData?.notes || formData?.clinical?.notes || ''
    ).trim();
    const recordNotesParts = [
      patientNotes || 'Pre-consulta registrada por el paciente.',
      staffNotesTrim ? `Notas del equipo: ${staffNotesTrim}` : ''
    ].filter(Boolean);
    const medicalRecord = await prisma.medicalRecord.create({
      data: {
        patientId: patientId!,
        clinicalCaseId: clinicalCase.id,
        doctorPatientId: doctorPatient.id,
        userId: patientUserId!,
        autorConsultaId: doctor.userId,
        realizadoPor: doctor.userId,
        vinculadoADoctor: doctor.id,
        diagnosis: `Pre-consulta — ${motivo}`,
        treatment: 'Pendiente de evaluación médica',
        notes: recordNotesParts.join('\n\n'),
        reason: motivo,
        tags: ['pre-consulta', 'evaluación-inicial'],
        clinicalEvolution: 'INITIAL_EVALUATION' as any,
        formData: consultationFormData,
        date: new Date(),
        isPublic: true,
        isComplete: false,
        hasAttachments: false,
        isEditable: true
      }
    });

    // 5) Adjuntos (si en formData vienen urls ya registradas, las conectamos)
    const urls: string[] = [];
    const filesBlock =
      formData?.attachments?.files && typeof formData.attachments.files === 'object'
        ? formData.attachments.files
        : formData?.files;
    if (filesBlock && typeof filesBlock === 'object') {
      for (const key of Object.keys(filesBlock)) {
        const arr = filesBlock[key];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item?.url) urls.push(String(item.url));
          }
        }
      }
    }
    let linkedFileCount = 0;
    const urlSet = new Set(urls);
    if (intake.consentPdfUrl) urlSet.add(intake.consentPdfUrl);
    const allUrls = [...urlSet];

    if (allUrls.length > 0) {
      const files = await prisma.file.findMany({ where: { url: { in: allUrls } } });
      linkedFileCount = files.length;
      for (const f of files) {
        await prisma.file.update({
          where: { id: f.id },
          data: { medicalRecordId: medicalRecord.id, patientId: patientId!, doctorPatientId: doctorPatient.id }
        });
      }
    }

    if (intake.consentFileId) {
      const consentFile = await prisma.file.findUnique({ where: { id: intake.consentFileId } });
      if (consentFile && !consentFile.medicalRecordId) {
        await prisma.file.update({
          where: { id: consentFile.id },
          data: {
            medicalRecordId: medicalRecord.id,
            patientId: patientId!,
            doctorPatientId: doctorPatient.id
          }
        });
        if (!allUrls.includes(consentFile.url)) {
          linkedFileCount += 1;
        }
      }
    }

    const intakeLinks = Array.isArray(formData?.attachments?.links) ? formData.attachments.links : [];
    const linksToCreate = intakeLinks
      .map((link: { url?: string; description?: string; label?: string }) => {
        const url = String(link?.url || '').trim();
        if (!url) return null;
        const description =
          String(link?.description || link?.label || '').trim() || 'Enlace compartido por el paciente';
        return { url, description };
      })
      .filter(Boolean) as { url: string; description: string }[];

    if (linksToCreate.length > 0) {
      await prisma.link.createMany({
        data: linksToCreate.map((l) => ({
          url: l.url,
          description: l.description,
          medicalRecordId: medicalRecord.id
        }))
      });
    }

    if (linkedFileCount > 0 || linksToCreate.length > 0) {
      await prisma.medicalRecord.update({
        where: { id: medicalRecord.id },
        data: { hasAttachments: true }
      });
    }

    const updated = await prisma.clinicalIntake.update({
      where: { id: intake.id },
      data: {
        status: 'CONVERTED',
        staffNotes: staffNotesTrim || intake.staffNotes,
        convertedClinicalCaseId: clinicalCase.id,
        convertedMedicalRecordId: medicalRecord.id
      }
    });

    return res.json({ success: true, data: updated });
  }

  /** Staff: enviar enlace por correo (crea intake) */
  static async sendLink(req: AuthRequest, res: Response) {
    const doctor = await resolveDoctorForRequest(req);
    if (!doctor) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }
    const { patientId, appointmentId, email } = req.body as { patientId?: string | null; appointmentId?: string | null; email?: string | null };
    const safeEmail = (email || '').toString().trim().toLowerCase();
    if (!patientId && !safeEmail) {
      return res.status(400).json({
        success: false,
        message: 'Ingresa un correo o selecciona un paciente.'
      });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INTAKE_LINK_EXPIRY_DAYS);

    const intake = await prisma.clinicalIntake.create({
      data: {
        token: generateToken(),
        doctorId: doctor.id,
        patientId: patientId || null,
        appointmentId: appointmentId || null,
        expiresAt,
        status: 'DRAFT',
        formData: safeEmail ? { patient: { email: safeEmail } } : undefined
      }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/pre-registro/${intake.token}`;

  // TODO: enviar correo con NotificationService
    if (safeEmail) {
      console.log(`Pre-registro: enviar enlace a ${safeEmail}: ${link}`);
    }

    return res.json({ success: true, data: { id: intake.id, link, token: intake.token } });
  }

  /** Staff: notas internas y/o aprobar / rechazar */
  static async patchStaff(req: AuthRequest, res: Response) {
    const doctor = await resolveDoctorForRequest(req);
    if (!doctor) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }
    const { id } = req.params;
    const { status, staffNotes } = req.body as { status?: ClinicalIntakeStatus; staffNotes?: string };
    const intake = await prisma.clinicalIntake.findFirst({
      where: { id, doctorId: doctor.id }
    });
    if (!intake) {
      return res.status(404).json({ success: false, message: 'Pre-registro no encontrado' });
    }
    if (intake.status === 'CONVERTED') {
      return res.status(400).json({ success: false, message: 'Ya fue guardada en el historial clínico' });
    }

    const data: { status?: ClinicalIntakeStatus; staffNotes?: string | null } = {};

    if (staffNotes !== undefined) {
      data.staffNotes = String(staffNotes).trim() || null;
    }

    if (status) {
      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status debe ser APPROVED o REJECTED' });
      }
      data.status = status;
    }

    if (!data.status && data.staffNotes === undefined) {
      return res.status(400).json({ success: false, message: 'Nada que actualizar' });
    }

    const updated = await prisma.clinicalIntake.update({
      where: { id },
      data
    });
    return res.json({ success: true, data: updated });
  }

  /** Portal fijo (token legacy): info */
  static async getPortalInfo(req: Request, res: Response) {
    const { portalToken } = req.params;
    const doctor = await prisma.doctor.findFirst({
      where: { intakePortalToken: portalToken },
      include: { user: { select: { firstName: true, lastName: true } } }
    });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Portal no encontrado' });
    }

    return res.json({ success: true, data: await buildPortalInfoData(doctor) });
  }

  /** Portal fijo (slug amigable): info */
  static async getPortalInfoBySlug(req: Request, res: Response) {
    const { doctorSlug } = req.params;
    const doctor = await prisma.doctor.findFirst({
      where: { intakePortalSlug: doctorSlug },
      include: { user: { select: { firstName: true, lastName: true } } }
    });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Portal no encontrado' });
    }

    return res.json({ success: true, data: await buildPortalInfoData(doctor) });
  }

  /** Portal fijo: iniciar borrador (token legacy) */
  static async startPortal(req: Request, res: Response) {
    const { portalToken } = req.params;
    const doctor = await prisma.doctor.findFirst({
      where: { intakePortalToken: portalToken },
      select: { id: true }
    });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Portal no encontrado' });
    }
    const intake = await createPortalDraftIntake(doctor.id);
    return res.json({ success: true, data: { token: intake.token } });
  }

  /** Portal fijo: iniciar borrador (slug amigable) */
  static async startPortalBySlug(req: Request, res: Response) {
    const { doctorSlug } = req.params;
    const doctor = await prisma.doctor.findFirst({
      where: { intakePortalSlug: doctorSlug },
      select: { id: true }
    });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Portal no encontrado' });
    }
    const intake = await createPortalDraftIntake(doctor.id);
    return res.json({ success: true, data: { token: intake.token } });
  }
}
