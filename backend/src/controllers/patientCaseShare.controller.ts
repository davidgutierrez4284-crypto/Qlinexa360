import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ClinicalCaseShareInviteStatus } from '@prisma/client';
import { securityLogger } from '../utils/logger.utils';
import { createCaseShareInvite } from '../services/caseShareInvite.service';
import { NotificationService } from '../services/notification.service';
import { fetchBufferFromUrl } from '../utils/file.utils';

const notificationService = NotificationService.getInstance();

/** Primer vínculo doctor–paciente (titular) para reglas de colaboración / consentimientos. */
async function getPrimaryOwnerDoctorId(patientId: string): Promise<string | null> {
  const link = await prisma.doctorPatient.findFirst({
    where: { patientId },
    orderBy: { startDate: 'asc' }
  });
  return link?.doctorId ?? null;
}

/** Paciente: quién tiene acceso al caso y revocación de colaboradores (no al titular) */
export async function getMyCaseShareAccess(req: AuthRequest, res: Response) {
  try {
    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.userId } });
    if (!patient) return res.status(403).json({ success: false, message: 'Solo para pacientes' });
    const clinicalCaseId = req.query.clinicalCaseId as string;
    if (!clinicalCaseId) {
      return res.status(400).json({ success: false, message: 'clinicalCaseId requerido' });
    }
    const c = await prisma.clinicalCase.findFirst({
      where: { id: clinicalCaseId, patientId: patient.id }
    });
    if (!c) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
    const doctorPatient = await prisma.doctorPatient.findFirst({
      where: { patientId: patient.id },
      include: { doctor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } }
    });
    const colabs = await prisma.padecimientoDoctorColaborador.findMany({
      where: { patientId: patient.id, padecimientoId: clinicalCaseId },
      include: { doctor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } }
    });
    const primaryDoctorId = doctorPatient?.doctorId;
    const collaborators = colabs.map((row) => {
      const isPrimaryDoctor = primaryDoctorId && row.doctorId === primaryDoctorId;
      const isRolTitular = ['titular', 'TITULAR', 'Titular'].includes(String(row.rol || '').trim());
      return {
        doctorId: row.doctorId,
        name: `${row.doctor.user.firstName} ${row.doctor.user.lastName}`.trim(),
        rol: row.rol,
        puedesRevocar: !isPrimaryDoctor && !isRolTitular
      };
    });
    const pending = await prisma.clinicalCaseShareInvite.findMany({
      where: {
        clinicalCaseId,
        patientId: patient.id,
        status: ClinicalCaseShareInviteStatus.PENDING_CONSENT
      },
      include: { invitedDoctor: { include: { user: { select: { firstName: true, lastName: true } } } } }
    });
    return res.json({
      success: true,
      caseLabel: c.padecimiento,
      primaryDoctor: doctorPatient
        ? {
            doctorId: doctorPatient.doctorId,
            name: `${doctorPatient.doctor.user.firstName} ${doctorPatient.doctor.user.lastName}`.trim()
          }
        : null,
      collaborators,
      pendingInvites: pending.map((p) => ({
        id: p.id,
        invitedDoctorId: p.invitedDoctorId,
        invitedDoctorName: `${p.invitedDoctor.user.firstName} ${p.invitedDoctor.user.lastName}`.trim(),
        expiresAt: p.expiresAt.toISOString()
      }))
    });
  } catch (e) {
    securityLogger.error('getMyCaseShareAccess', e);
    return res.status(500).json({ success: false, message: 'Error del servidor' });
  }
}

export async function revokeMyCaseCollaborator(req: AuthRequest, res: Response) {
  try {
    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.userId } });
    if (!patient) return res.status(403).json({ success: false, message: 'Solo para pacientes' });
    const { clinicalCaseId, doctorId } = req.params;
    const c = await prisma.clinicalCase.findFirst({
      where: { id: clinicalCaseId, patientId: patient.id }
    });
    if (!c) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
    const primary = await prisma.doctorPatient.findFirst({ where: { patientId: patient.id } });
    if (doctorId === primary?.doctorId) {
      return res.status(400).json({ success: false, message: 'No se puede revocar al médico titular de tu expediente' });
    }
    const row = await prisma.padecimientoDoctorColaborador.findUnique({
      where: {
        patientId_padecimientoId_doctorId: {
          patientId: patient.id,
          padecimientoId: clinicalCaseId,
          doctorId
        }
      },
      include: { doctor: { include: { user: true } } }
    });
    if (row) {
      await prisma.padecimientoDoctorColaborador.delete({
        where: {
          patientId_padecimientoId_doctorId: {
            patientId: patient.id,
            padecimientoId: clinicalCaseId,
            doctorId
          }
        }
      });
      if (row.doctor.userId) {
        await prisma.notification.create({
          data: {
            userId: row.doctor.userId,
            type: 'SYSTEM_MESSAGE',
            title: 'Acceso al caso clínico revocado',
            message: `El paciente revocó tu acceso al caso clínico "${c.padecimiento}".`,
            data: { clinicalCaseId, patientId: patient.id }
          }
        });
      }
    }
    await prisma.clinicalCaseShareInvite.updateMany({
      where: {
        clinicalCaseId,
        patientId: patient.id,
        invitedDoctorId: doctorId,
        status: ClinicalCaseShareInviteStatus.PENDING_CONSENT
      },
      data: { status: ClinicalCaseShareInviteStatus.CANCELLED }
    });
    return res.json({ success: true, message: 'Acceso actualizado' });
  } catch (e) {
    securityLogger.error('revokeMyCaseCollaborator', e);
    return res.status(500).json({ success: false, message: 'Error del servidor' });
  }
}

/**
 * Paciente: invitar a un profesional ya registrado (misma lógica de consentimiento por correo que cuando lo inicia el médico titular).
 */
export async function patientInviteRegisteredCollaborator(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== 'PATIENT') {
      return res.status(403).json({ success: false, message: 'Solo para pacientes' });
    }
    const { clinicalCaseId, doctorId: invitedDoctorId } = req.body as {
      clinicalCaseId?: string;
      doctorId?: string;
    };
    if (!clinicalCaseId || !invitedDoctorId) {
      return res.status(400).json({ success: false, message: 'clinicalCaseId y doctorId son requeridos' });
    }

    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.userId } });
    if (!patient) return res.status(404).json({ success: false, message: 'Paciente no encontrado' });

    const caseRow = await prisma.clinicalCase.findFirst({
      where: { id: clinicalCaseId, patientId: patient.id }
    });
    if (!caseRow) return res.status(404).json({ success: false, message: 'Caso clínico no encontrado' });

    const ownerDoctorId = await getPrimaryOwnerDoctorId(patient.id);
    if (!ownerDoctorId) {
      return res.status(400).json({
        success: false,
        message: 'No hay un profesional vinculado a tu expediente. No se puede enviar la invitación.'
      });
    }
    if (ownerDoctorId === invitedDoctorId) {
      return res.status(400).json({
        success: false,
        message: 'Ese profesional ya es quien atiende tu expediente en la plataforma. Elige a otro para una segunda opinión.'
      });
    }

    const { expiresAt } = await createCaseShareInvite({
      ownerDoctorId,
      patientId: patient.id,
      clinicalCaseId,
      invitedDoctorId
    });

    return res.status(201).json({
      success: true,
      expiresAt: expiresAt.toISOString(),
      message:
        'Solicitud registrada. Revisa tu correo para firmar el consentimiento. El invitado no tendrá acceso a este caso hasta entonces.'
    });
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    securityLogger.error('patientInviteRegisteredCollaborator', e);
    if (err?.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Esa colaboración ya estaba registrada' });
    }
    if (err?.message) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: 'Error al enviar la solicitud' });
  }
}

/**
 * Paciente: invitar por correo a un profesional aún no registrado (mismo envío de correo que el médico titular, con texto de invitación del paciente).
 */
export async function patientInviteExternalCollaborator(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== 'PATIENT') {
      return res.status(403).json({ message: 'Solo para pacientes' });
    }
    const { email, clinicalCaseId } = req.body as { email?: string; clinicalCaseId?: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Email inválido' });
    }
    if (!clinicalCaseId) return res.status(400).json({ message: 'clinicalCaseId es requerido' });

    const patient = await prisma.patient.findUnique({
      where: { userId: req.user!.userId },
      include: { user: true }
    });
    if (!patient?.user) return res.status(404).json({ message: 'Paciente no encontrado' });

    const clinicalCase = await prisma.clinicalCase.findFirst({
      where: { id: clinicalCaseId, patientId: patient.id },
      include: { patient: { include: { user: true } } }
    });
    if (!clinicalCase) return res.status(404).json({ message: 'Caso clínico no encontrado' });

    const inviterName = `${patient.user.firstName} ${patient.user.lastName}`.trim();
    const inviterDisplay = `${inviterName} (solicitud de segunda opinión — paciente)`;
    const patientName = inviterName;
    const padecimiento = clinicalCase.padecimiento;
    const websiteUrl = (process.env.FRONTEND_URL || 'https://www.qlinexa360.com').replace(/\/$/, '');

    let avisoPdfBuffer: Buffer | undefined;
    try {
      const consentAviso = await prisma.consentHistory.findFirst({
        where: { userId: patient.userId, type: 'PRIVACY_POLICY', pdfUrl: { not: null } },
        orderBy: { acceptedAt: 'desc' }
      });
      if (consentAviso?.pdfUrl) {
        const { buffer } = await fetchBufferFromUrl(consentAviso.pdfUrl);
        avisoPdfBuffer = buffer;
      }
    } catch (consentErr) {
      securityLogger.warn('patientInviteExternal: aviso PDF', consentErr);
    }

    const emailResult = await notificationService.sendExternalCollaborationInvite({
      email: email.trim(),
      inviterName: inviterDisplay,
      patientName,
      padecimiento,
      websiteUrl,
      inviterEmail: patient.user.email || undefined,
      avisoPdfBuffer
    });

    return res.json({
      success: true,
      message: emailResult.emailSent
        ? 'Invitación enviada por correo electrónico'
        : 'No se pudo enviar el correo. Comprueba la configuración de correo del servidor o intenta más tarde.'
    });
  } catch (e) {
    securityLogger.error('patientInviteExternalCollaborator', e);
    return res.status(500).json({ message: 'Error al enviar la invitación' });
  }
}
