import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error.utils';
import { securityLogger } from '../utils/logger.utils';
import { NotificationService } from '../services/notification.service';

const prisma = new PrismaClient();

// Generar token único para invitación
const generateInvitationToken = () => {
  return randomBytes(32).toString('hex');
};

// Crear invitación para paciente
export const createPatientInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, email, phone, doctorId } = req.body;
    const doctorUserId = req.user?.userId;

    if (!doctorUserId) {
      throw new AppError('Autenticación requerida.', 401);
    }

    // Verificar que el doctor existe y está activo
    const doctor = await prisma.doctor.findFirst({
      where: { 
        userId: doctorUserId,
        id: doctorId 
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!doctor) {
      throw new AppError('Doctor no encontrado o no autorizado.', 404);
    }

    // Verificar si el paciente ya existe
    const existingPatient = await prisma.user.findUnique({
      where: { email },
      include: { patientProfile: true }
    });

    if (existingPatient) {
      throw new AppError('Ya existe un paciente con este email.', 400);
    }

    // Crear invitación
    const invitationToken = generateInvitationToken();
    const invitation = await prisma.patientInvitation.create({
      data: {
        token: invitationToken,
        email,
        phone,
        firstName,
        lastName,
        doctorId: doctor.id,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        createdAt: new Date()
      }
    });

    // Enviar notificaciones por WhatsApp y Email
    const notificationService = NotificationService.getInstance();
    const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/activate/${invitationToken}`;
    const doctorName = `${doctor.user.firstName} ${doctor.user.lastName}`;
    
    const { whatsappSent, emailSent } = await notificationService.sendInvitation(
      phone || '',
      email,
      doctorName,
      invitationUrl
    );

    securityLogger.info(`Invitación creada para ${email} por doctor ${doctorName}. WhatsApp: ${whatsappSent}, Email: ${emailSent}`);

    res.status(201).json({
      message: 'Invitación creada exitosamente',
      invitationId: invitation.id,
      notificationsSent: {
        whatsapp: whatsappSent,
        email: emailSent
      }
    });

  } catch (error: any) {
    console.error('Error al crear invitación:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al crear invitación', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Validar token de invitación
export const validateInvitationToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.patientInvitation.findFirst({
      where: {
        token,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      },
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
      throw new AppError('Invitación no válida o expirada.', 400);
    }

    res.status(200).json({
      valid: true,
      invitation: {
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        doctorName: `${invitation.doctor.user.firstName} ${invitation.doctor.user.lastName}`,
        doctorSpecialization: invitation.doctor.specialization
      }
    });

  } catch (error: any) {
    console.error('Error al validar token:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al validar invitación', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Completar registro con token de invitación
export const completePatientRegistration = async (req: Request, res: Response) => {
  try {
    const { token, password, additionalData } = req.body;

    // Validar token
    const invitation = await prisma.patientInvitation.findFirst({
      where: {
        token,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      },
      include: {
        doctor: true
      }
    });

    if (!invitation) {
      throw new AppError('Invitación no válida o expirada.', 400);
    }

    // Verificar que el email no esté en uso
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email }
    });

    if (existingUser) {
      throw new AppError('Ya existe un usuario con este email.', 400);
    }

    // Crear usuario y perfil de paciente
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: invitation.email,
        password: hashedPassword,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        phone: invitation.phone,
        role: 'PATIENT'
      }
    });

    const patient = await prisma.patient.create({
      data: {
        userId: user.id,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        email: invitation.email,
        phone: invitation.phone,
        dateOfBirth: additionalData?.birthDate ? new Date(additionalData.birthDate) : new Date(),
        gender: additionalData?.gender || 'OTHER',
        dataConsent: true,
        dataConsentAt: new Date(),
        // Datos adicionales si se proporcionan
        ...(additionalData?.bloodType && { bloodType: additionalData.bloodType }),
        ...(additionalData?.allergies && { allergies: additionalData.allergies }),
        ...(additionalData?.chronicDiseases && { chronicDiseases: additionalData.chronicDiseases })
      }
    });

    // Crear relación doctor-paciente
    await prisma.doctorPatient.create({
      data: {
        doctorId: invitation.doctorId,
        patientId: patient.id,
        status: 'ACTIVE',
        context: `Registrado por invitación`,
        specialization: invitation.doctor.specialization
      }
    });

    // Marcar invitación como completada
    await prisma.patientInvitation.update({
      where: { id: invitation.id },
      data: { 
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    res.status(201).json({
      message: 'Registro completado exitosamente',
      patientId: patient.id,
      email: user.email
    });

  } catch (error: any) {
    console.error('Error al completar registro:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al completar registro', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Obtener invitaciones del doctor
export const getDoctorInvitations = async (req: AuthRequest, res: Response) => {
  try {
    const doctorUserId = req.user?.userId;

    if (!doctorUserId) {
      throw new AppError('Autenticación requerida.', 401);
    }

    const doctor = await prisma.doctor.findUnique({
      where: { userId: doctorUserId }
    });

    if (!doctor) {
      throw new AppError('Doctor no encontrado.', 404);
    }

    const invitations = await prisma.patientInvitation.findMany({
      where: { doctorId: doctor.id },
      orderBy: { createdAt: 'desc' },
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

    res.status(200).json(invitations);

  } catch (error: any) {
    console.error('Error al obtener invitaciones:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al obtener invitaciones', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Reenviar invitación a un paciente
export const resendPatientInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const { email, firstName, lastName, phone } = req.body;
    const doctorUserId = req.user?.userId;

    if (!doctorUserId) {
      throw new AppError('Autenticación requerida.', 401);
    }

    // Verificar que el doctor existe
    const doctor = await prisma.doctor.findFirst({
      where: { userId: doctorUserId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!doctor) {
      throw new AppError('Doctor no encontrado.', 404);
    }

    // Verificar si ya existe una invitación válida para este email y doctor
    const existingInvitation = await prisma.patientInvitation.findFirst({
      where: {
        email: email.toLowerCase(),
        doctorId: doctor.id,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });

    if (existingInvitation) {
      throw new AppError('Ya existe una invitación válida para este email.', 400);
    }

    // Verificar si el paciente ya existe
    const existingPatient = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { patientProfile: true }
    });

    if (existingPatient && existingPatient.patientProfile) {
      throw new AppError('Ya existe un paciente registrado con este email.', 400);
    }

    // Crear nueva invitación
    const invitationToken = generateInvitationToken();
    const invitation = await prisma.patientInvitation.create({
      data: {
        token: invitationToken,
        email: email.toLowerCase(),
        phone: phone || null,
        firstName: firstName || '',
        lastName: lastName || '',
        doctorId: doctor.id,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        createdAt: new Date()
      }
    });

    // Enviar notificación por email
    const notificationService = NotificationService.getInstance();
    const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?type=patient&invitation=${invitationToken}`;
    const doctorName = `${doctor.user.firstName} ${doctor.user.lastName}`;
    
    const { emailSent } = await notificationService.sendInvitation(
      phone || '',
      email,
      doctorName,
      invitationUrl
    );

    securityLogger.info(`Invitación reenviada para ${email} por doctor ${doctorName}. Email: ${emailSent}`);

    res.status(201).json({
      message: 'Invitación reenviada exitosamente',
      invitationId: invitation.id,
      emailSent
    });

  } catch (error: any) {
    console.error('Error al reenviar invitación:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al reenviar invitación', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};
