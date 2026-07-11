import prisma from '../config/database';
import { securityLogger } from '../utils/logger.utils';
import { ClinicalCaseShareInviteStatus } from '@prisma/client';
import {
  sendCaseShareDoctorsPendingNotice,
  sendCaseSharePatientConsentRequest
} from '../utils/caseShareEmail.utils';
import { generateCaseShareToken, defaultCaseShareInviteExpiry } from '../utils/caseShareInvite.utils';

/**
 * Crea invitación pendiente de consentimiento del paciente (no añade colaborador hasta la firma).
 */
export async function createCaseShareInvite(params: {
  ownerDoctorId: string;
  patientId: string;
  clinicalCaseId: string;
  invitedDoctorId: string;
}): Promise<{ id: string; token: string; expiresAt: Date }> {
  const { ownerDoctorId, patientId, clinicalCaseId, invitedDoctorId } = params;
  if (ownerDoctorId === invitedDoctorId) {
    throw new Error('No puedes invitarte a ti mismo');
  }
  const ownerLink = await prisma.doctorPatient.findUnique({
    where: { doctorId_patientId: { doctorId: ownerDoctorId, patientId } }
  });
  if (!ownerLink) {
    throw new Error('Solo el médico titular del paciente en la clínica puede invitar a colaborar en el caso');
  }
  const existingCollab = await prisma.padecimientoDoctorColaborador.findUnique({
    where: {
      patientId_padecimientoId_doctorId: {
        patientId,
        padecimientoId: clinicalCaseId,
        doctorId: invitedDoctorId
      }
    }
  });
  if (existingCollab) {
    throw new Error('Este doctor ya colabora en este caso clínico');
  }
  const pending = await prisma.clinicalCaseShareInvite.findFirst({
    where: {
      clinicalCaseId,
      invitedDoctorId,
      status: ClinicalCaseShareInviteStatus.PENDING_CONSENT
    }
  });
  if (pending) {
    throw new Error('Ya hay una invitación pendiente de firma del paciente para este profesional en este caso');
  }
  const caseRow = await prisma.clinicalCase.findFirst({
    where: { id: clinicalCaseId, patientId }
  });
  if (!caseRow) {
    throw new Error('Caso clínico no encontrado');
  }
  const token = generateCaseShareToken();
  const expiresAt = defaultCaseShareInviteExpiry();
  const invite = await prisma.clinicalCaseShareInvite.create({
    data: {
      token,
      clinicalCaseId,
      patientId,
      invitedDoctorId,
      ownerDoctorId,
      status: ClinicalCaseShareInviteStatus.PENDING_CONSENT,
      expiresAt
    }
  });
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { user: { select: { firstName: true, lastName: true, email: true } } }
  });
  const owner = await prisma.doctor.findUnique({
    where: { id: ownerDoctorId },
    include: { user: { select: { firstName: true, lastName: true, email: true } } }
  });
  const invited = await prisma.doctor.findUnique({
    where: { id: invitedDoctorId },
    include: { user: { select: { firstName: true, lastName: true, email: true } } }
  });
  if (!patient?.user || !owner?.user || !invited?.user) {
    throw new Error('Datos de usuario incompletos');
  }
  const ownerName = `${owner.user.firstName} ${owner.user.lastName}`.trim();
  const invitedName = `${invited.user.firstName} ${invited.user.lastName}`.trim();
  const patientEmail = patient.user.email || patient.email;
  if (patientEmail) {
    await sendCaseSharePatientConsentRequest({
      to: patientEmail,
      patientFirstName: patient.user.firstName,
      caseLabel: caseRow.padecimiento,
      ownerDoctorName: ownerName,
      invitedDoctorName: invitedName,
      token,
      expiresAt
    });
  } else {
    securityLogger.warn(`case share: paciente ${patientId} sin email, no se envió correo de consentimiento`);
  }
  if (owner.user.email && invited.user.email) {
    await sendCaseShareDoctorsPendingNotice({
      ownerEmail: owner.user.email,
      invitedEmail: invited.user.email,
      ownerDoctorName: ownerName,
      invitedDoctorName: invitedName,
      patientName: `${patient.user.firstName} ${patient.user.lastName}`.trim(),
      caseLabel: caseRow.padecimiento,
      token
    });
  }
  if (patient.userId) {
    const consentUrl = `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/compartir-caso-clinico/${token}`;
    await prisma.notification.create({
      data: {
        userId: patient.userId,
        type: 'SYSTEM_MESSAGE',
        title: 'Autorizar colaboración en tu caso clínico',
        message: `${ownerName} solicita que ${invitedName} colabore en "${caseRow.padecimiento}". Firma el consentimiento en el enlace enviado a tu correo o aquí: ${consentUrl}`,
        data: { clinicalCaseId, consentUrl, type: 'CASE_SHARE_CONSENT' }
      }
    });
  }
  if (invited.userId) {
    await prisma.notification.create({
      data: {
        userId: invited.userId,
        type: 'COLLABORATION_REQUEST',
        title: 'Solicitud de colaboración (pendiente del paciente)',
        message: `${ownerName} te invitó al caso "${caseRow.padecimiento}". Acceso activo cuando el paciente firme el consentimiento.`,
        data: { patientId, clinicalCaseId, ownerDoctorId }
      }
    });
  }
  return { id: invite.id, token, expiresAt };
}
