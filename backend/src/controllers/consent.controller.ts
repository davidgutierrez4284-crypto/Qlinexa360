import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ConsentPdfService } from '../services/consentPdf.service';
import { verifyConsentToken } from '../utils/jwt.utils';
import { getS3SignedUrlIfExists } from '../utils/file.utils';
import { NotificationService } from '../services/notification.service';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { userId?: string; role?: string; doctorId?: string };
}

const CONSENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutos tras password reset

/**
 * POST /api/consent/submit-after-setup
 * Para PACIENTE: tras configurar contraseña (token de password reset usado recientemente)
 */
export const submitConsentAfterPatientSetup = async (req: Request, res: Response) => {
  try {
    const { token, acceptPrivacy, acceptTerms, acceptContract, signature } = req.body;

    if (!token || !acceptPrivacy || !acceptTerms || !acceptContract || !signature?.trim()) {
      return res.status(400).json({
        error: 'Faltan datos requeridos: token, aceptación de los 3 documentos y firma digital'
      });
    }

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { token },
      include: { user: true }
    });

    if (!resetToken) {
      return res.status(400).json({ error: 'Token no encontrado' });
    }

    if (resetToken.purpose !== 'patient_setup') {
      return res.status(400).json({ error: 'Este enlace no es válido para consentimientos' });
    }

    if (!resetToken.used || !resetToken.usedAt) {
      return res.status(400).json({ error: 'Debe configurar la contraseña primero' });
    }

    const elapsed = Date.now() - resetToken.usedAt.getTime();
    if (elapsed > CONSENT_WINDOW_MS) {
      return res.status(400).json({ error: 'El tiempo para firmar los consentimientos ha expirado. Inicie sesión y contacte a soporte.' });
    }

    await createConsentRecords(resetToken.user, signature.trim());
    res.json({ message: 'Consentimientos registrados exitosamente' });
  } catch (error: any) {
    console.error('Error en submitConsentAfterPatientSetup:', error);
    res.status(500).json({ error: error.message || 'Error al registrar consentimientos' });
  }
};

/**
 * POST /api/consent/submit-assistant
 * Para ASISTENTE: tras completar registro (consentToken devuelto en la respuesta)
 */
export const submitConsentAssistant = async (req: Request, res: Response) => {
  try {
    const { consentToken, acceptPrivacy, acceptTerms, acceptContract, signature } = req.body;

    if (!consentToken || !acceptPrivacy || !acceptTerms || !acceptContract || !signature?.trim()) {
      return res.status(400).json({
        error: 'Faltan datos requeridos: consentToken, aceptación de los 3 documentos y firma digital'
      });
    }

    const { userId } = verifyConsentToken(consentToken);

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user.role !== 'ASISTENTE') {
      return res.status(400).json({ error: 'Token inválido' });
    }

    await createConsentRecords(user, signature.trim());
    res.json({ message: 'Consentimientos registrados exitosamente' });
  } catch (error: any) {
    console.error('Error en submitConsentAssistant:', error);
    res.status(500).json({ error: error.message || 'Error al registrar consentimientos' });
  }
};

async function createConsentRecords(user: { id: string; email: string; firstName: string; lastName: string; role: string }, signature: string) {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const consentDate = new Date();

  const pdfResults = await ConsentPdfService.generateConsentPdfs({
    userId: user.id,
    email: user.email,
    fullName,
    signature
  });

  await prisma.consentHistory.createMany({
    data: [
      {
        userId: user.id,
        type: 'PRIVACY_POLICY',
        version: '1.0',
        content: 'Aviso de Privacidad de Qlinexa360',
        acceptedAt: consentDate,
        pdfUrl: pdfResults.PRIVACY_POLICY.url
      },
      {
        userId: user.id,
        type: 'TERMS_OF_SERVICE',
        version: '1.0',
        content: 'Términos de Uso de Qlinexa360',
        acceptedAt: consentDate,
        pdfUrl: pdfResults.TERMS_OF_SERVICE.url
      },
      {
        userId: user.id,
        type: 'PLATFORM_CONTRACT',
        version: '1.0',
        content: 'Contrato de Uso de Plataforma de Qlinexa360',
        acceptedAt: consentDate,
        pdfUrl: pdfResults.PLATFORM_CONTRACT.url
      },
      {
        userId: user.id,
        type: 'DIGITAL_SIGNATURE',
        version: '1.0',
        content: `Firma digital: ${signature}`,
        acceptedAt: consentDate
      }
    ]
  });

  // Enviar notificación a legal@qlinexa360.com con datos del usuario y PDFs
  try {
    await NotificationService.sendNewUserConsentToLegal({
      fullName,
      email: user.email,
      role: user.role,
      pdfBuffers: {
        aviso: pdfResults.PRIVACY_POLICY.buffer,
        terminos: pdfResults.TERMS_OF_SERVICE.buffer,
        contrato: pdfResults.PLATFORM_CONTRACT.buffer
      }
    });
  } catch (emailError) {
    console.error('Error enviando notificación a legal@qlinexa360.com:', emailError);
    // No fallar el registro si el email falla
  }
}

/**
 * GET /api/consent/admin/:userId
 * Admin: listar consentimientos de un usuario (para auditoría)
 */
export const getConsentsByUserId = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    const { userId } = req.params;
    const consents = await prisma.consentHistory.findMany({
      where: { userId },
      orderBy: { acceptedAt: 'asc' }
    });
    const withUrls = await Promise.all(
      consents.map(async (c) => {
        let signedUrl = null;
        if (c.pdfUrl && c.pdfUrl.startsWith('http')) {
          signedUrl = await getS3SignedUrlIfExists(c.pdfUrl, 60 * 15);
        }
        return { ...c, signedPdfUrl: signedUrl };
      })
    );
    res.json(withUrls);
  } catch (error: any) {
    console.error('Error getConsentsByUserId:', error);
    res.status(500).json({ error: error.message || 'Error al obtener consentimientos' });
  }
};

/**
 * GET /api/consent/doctor/patient/:patientId/aviso-privacidad
 * Doctor: obtener Aviso de Privacidad firmado de su paciente
 */
export const getPatientAvisoPrivacidad = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.doctorId) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }
    const { patientId } = req.params;
    const link = await prisma.doctorPatient.findFirst({
      where: {
        doctorId: req.user.doctorId,
        patientId
      }
    });
    if (!link) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { userId: true }
    });
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    const consent = await prisma.consentHistory.findFirst({
      where: {
        userId: patient.userId,
        type: 'PRIVACY_POLICY'
      }
    });
    if (!consent?.pdfUrl) {
      return res.status(404).json({ error: 'Aviso de Privacidad no disponible para este paciente' });
    }
    const signedUrl = await getS3SignedUrlIfExists(consent.pdfUrl, 60 * 15);
    if (!signedUrl) {
      return res.status(404).json({ error: 'Archivo no disponible' });
    }
    res.json({ url: signedUrl });
  } catch (error: any) {
    console.error('Error getPatientAvisoPrivacidad:', error);
    res.status(500).json({ error: error.message || 'Error al obtener documento' });
  }
};
