import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { securityLogger } from '../utils/logger.utils';
import { NotificationService } from '../services/notification.service';
import { fetchBufferFromUrl } from '../utils/file.utils';

interface AuthRequest extends Request {
  user?: {
    doctorId?: string;
    userId?: string;
    firstName?: string;
    lastName?: string;
  };
}

const prisma = new PrismaClient();
const notificationService = NotificationService.getInstance();

export const inviteExternalDoctor = async (req: AuthRequest, res: Response) => {
  try {
    console.log('=== INVITE EXTERNAL DOCTOR STARTED ===');
    console.log('req.user:', req.user);
    console.log('req.body:', req.body);
    
    if (!req.user?.doctorId || !req.user?.userId) {
      console.log('ERROR: Authentication required');
      return res.status(401).json({ message: 'Autenticación requerida' });
    }

    const { email, clinicalCaseId } = req.body as { email?: string; clinicalCaseId?: string };
    console.log('email:', email);
    console.log('clinicalCaseId:', clinicalCaseId);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log('ERROR: Invalid email');
      return res.status(400).json({ message: 'Email inválido' });
    }
    if (!clinicalCaseId) {
      console.log('ERROR: clinicalCaseId required');
      return res.status(400).json({ message: 'clinicalCaseId es requerido' });
    }

    console.log('=== FETCHING DOCTOR AND CLINICAL CASE ===');
    // Obtener info del invitador y del caso clínico para personalizar el mensaje
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.user.doctorId },
      include: { user: true }
    });
    console.log('doctor found:', !!doctor);
    
    const clinicalCase = await prisma.clinicalCase.findUnique({
      where: { id: clinicalCaseId },
      include: { patient: { include: { user: true } } }
    });
    console.log('clinicalCase found:', !!clinicalCase);

    if (!doctor || !doctor.user) {
      console.log('ERROR: Doctor not found');
      return res.status(404).json({ message: 'Doctor no encontrado' });
    }
    if (!clinicalCase) {
      console.log('ERROR: Clinical case not found');
      return res.status(404).json({ message: 'Caso clínico no encontrado' });
    }

    const inviterName = `${doctor.user.firstName} ${doctor.user.lastName}`.trim();
    const patientName = `${clinicalCase.patient.firstName} ${clinicalCase.patient.lastName}`.trim();
    const padecimiento = clinicalCase.padecimiento;
    const websiteUrl = 'https://www.qlinexa360.com';

    // Obtener el Aviso de Privacidad firmado por el paciente para adjuntarlo al doctor colaborador
    let avisoPdfBuffer: Buffer | undefined;
    const patientUserId = clinicalCase.patient.userId;
    try {
      const consentAviso = await prisma.consentHistory.findFirst({
        where: { userId: patientUserId, type: 'PRIVACY_POLICY', pdfUrl: { not: null } },
        orderBy: { acceptedAt: 'desc' }
      });
      if (consentAviso?.pdfUrl) {
        const { buffer } = await fetchBufferFromUrl(consentAviso.pdfUrl);
        avisoPdfBuffer = buffer;
        console.log('Aviso de Privacidad del paciente obtenido para adjuntar al colaborador');
      } else {
        console.log('Paciente sin Aviso de Privacidad en PDF (puede ser registro antiguo), se enviará invitación sin adjunto');
      }
    } catch (consentErr) {
      console.warn('Error obteniendo Aviso de Privacidad del paciente:', consentErr);
      // Continuar sin el PDF, la invitación se envía igual
    }

    console.log('=== PREPARING EMAIL DATA ===');
    console.log('inviterName:', inviterName);
    console.log('patientName:', patientName);
    console.log('padecimiento:', padecimiento);
    console.log('websiteUrl:', websiteUrl);
    console.log('avisoPdfBuffer:', avisoPdfBuffer ? 'SÍ' : 'NO');

    console.log('=== CALLING NOTIFICATION SERVICE ===');
    const emailResult = await notificationService.sendExternalCollaborationInvite({
      email,
      inviterName,
      patientName,
      padecimiento,
      websiteUrl,
      inviterEmail: doctor.user.email,
      avisoPdfBuffer
    });
    console.log('=== EMAIL RESULT ===');
    console.log('emailResult:', emailResult);

    securityLogger.info(`External collaboration invite attempted to ${email} by ${inviterName}. emailSent=${emailResult.emailSent}`);

    console.log('=== SENDING RESPONSE ===');
    return res.json({
      message: emailResult.emailSent
        ? 'Invitación enviada por correo electrónico'
        : 'No se pudo enviar correo (credenciales no configuradas). Desarrollo listo.'
    });
  } catch (error) {
    console.log('=== ERROR IN INVITE EXTERNAL DOCTOR ===');
    console.error('Error:', error);
    securityLogger.error('Error sending external doctor collaboration invite', error);
    return res.status(500).json({ message: 'Error al enviar la invitación' });
  }
};


