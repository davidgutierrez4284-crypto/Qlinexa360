import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateConsentToken } from '../utils/jwt.utils';
import { randomBytes } from 'crypto';
import { NotificationService } from '../services/notification.service';
import { securityLogger } from '../utils/logger.utils';

const prisma = new PrismaClient();

// Extender el tipo Request para incluir user
interface AuthRequest extends Request {
  user?: {
    doctorId?: string;
    userId?: string;
  };
}

// =================================================================
// CREAR INVITACIÓN PARA ASISTENTE
// =================================================================
export const createAssistantInvitation = async (req: AuthRequest, res: Response) => {
  try {
    console.log('=== CREATE ASSISTANT INVITATION STARTED ===');
    console.log('req.user:', req.user);
    console.log('req.body:', req.body);
    
    if (!req.user) {
      console.log('ERROR: Authentication required');
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.userId },
      include: { user: { select: { firstName: true, lastName: true } } }
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de doctor no encontrado' });
    }

    const { email, firstName, lastName } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, nombre y apellido son requeridos' });
    }

    // Verificar si ya existe un usuario con ese email
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }

    // Verificar si ya existe una invitación pendiente para ese email
    const existingInvitation = await prisma.assistantInvitation.findFirst({
      where: {
        email: email.toLowerCase(),
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });

    if (existingInvitation) {
      return res.status(400).json({ error: 'Ya existe una invitación pendiente para ese email' });
    }

    // Generar token único
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    // Crear la invitación
    const invitation = await prisma.assistantInvitation.create({
      data: {
        token,
        email: email.toLowerCase(),
        firstName,
        lastName,
        doctorId: doctor.id,
        expiresAt
      }
    });

    // Generar URL de invitación
    const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/activate-assistant/${token}`;

    // Enviar notificación
    const notificationService = NotificationService.getInstance();
    const result = await notificationService.sendAssistantInvitation(
      email,
      `${doctor.user.firstName} ${doctor.user.lastName}`,
      invitationUrl
    );

    securityLogger.info(`Invitación de asistente creada para ${email} por doctor ${doctor.id}`);

    res.status(201).json({
      message: 'Invitación enviada exitosamente',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        expiresAt: invitation.expiresAt
      },
      notifications: {
        emailSent: result.emailSent
      }
    });

  } catch (error) {
    securityLogger.error('Error creando invitación de asistente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// =================================================================
// VALIDAR TOKEN DE INVITACIÓN DE ASISTENTE
// =================================================================
export const validateAssistantInvitationToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }

    const invitation = await prisma.assistantInvitation.findUnique({
      where: { token },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitación no encontrada' });
    }

    if (invitation.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Esta invitación ya ha sido utilizada' });
    }

    if (invitation.status === 'EXPIRED' || invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Esta invitación ha expirado' });
    }

    res.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        doctorName: `${invitation.doctor.user.firstName} ${invitation.doctor.user.lastName}`,
        expiresAt: invitation.expiresAt
      }
    });

  } catch (error) {
    securityLogger.error('Error validando token de invitación de asistente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// =================================================================
// COMPLETAR REGISTRO DE ASISTENTE
// =================================================================
export const completeAssistantRegistration = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token y contraseña son requeridos' });
    }

    const invitation = await prisma.assistantInvitation.findUnique({
      where: { token },
      include: {
        doctor: true
      }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitación no encontrada' });
    }

    if (invitation.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Esta invitación ya ha sido utilizada' });
    }

    if (invitation.status === 'EXPIRED' || invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Esta invitación ha expirado' });
    }

    // Verificar que no exista un usuario con ese email
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el usuario asistente
    const user = await prisma.user.create({
      data: {
        email: invitation.email,
        password: hashedPassword,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        role: 'ASISTENTE'
      }
    });

    // Crear el vínculo con el doctor
    await prisma.asistenteDoctorVinculo.create({
      data: {
        doctorId: invitation.doctorId,
        asistenteId: user.id,
        activo: true
      }
    });

    // Marcar la invitación como completada
    await prisma.assistantInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    securityLogger.info(`Registro de asistente completado: ${user.id} para doctor ${invitation.doctorId}`);

    const consentToken = generateConsentToken(user.id, '10m');

    res.json({
      message: 'Registro completado exitosamente',
      requiresConsent: true,
      consentToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    securityLogger.error('Error completando registro de asistente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// =================================================================
// OBTENER INVITACIONES DE ASISTENTES DEL DOCTOR
// =================================================================
export const getDoctorAssistantInvitations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.userId }
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Perfil de doctor no encontrado' });
    }

    const invitations = await prisma.assistantInvitation.findMany({
      where: { doctorId: doctor.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      invitations: invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        firstName: inv.firstName,
        lastName: inv.lastName,
        status: inv.status,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        completedAt: inv.completedAt
      }))
    });

  } catch (error) {
    securityLogger.error('Error obteniendo invitaciones de asistentes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
