import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/error.utils';
import { securityLogger } from '../utils/logger.utils';
import { NotificationService } from '../services/notification.service';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class PasswordResetController {
  // Solicitar recuperación de contraseña
  static async requestPasswordReset(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        throw new AppError('Email es requerido', 400);
      }

      // Verificar que el usuario existe
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!user) {
        // Por seguridad, no revelamos si el email existe o no
        securityLogger.info(`Password reset requested for non-existent email: ${email}`);
        return res.json({ 
          message: 'Si el email existe en nuestra base de datos, recibirás un enlace de recuperación' 
        });
      }

      // Generar token único y seguro
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

      // Eliminar tokens anteriores del usuario
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id }
      });

      // Crear nuevo token
      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          email: user.email,
          expiresAt
        }
      });

      // Enviar email de recuperación
      try {
        await NotificationService.sendPasswordResetEmail(user.email, user.firstName, user.lastName, token);
        securityLogger.info(`Password reset email sent to ${user.email}`);
      } catch (emailError) {
        securityLogger.error(`Error sending password reset email to ${user.email}:`, emailError);
        throw new AppError('Error enviando email de recuperación', 500);
      }

      res.json({ 
        message: 'Si el email existe en nuestra base de datos, recibirás un enlace de recuperación' 
      });

    } catch (error) {
      securityLogger.error('Error in password reset request:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  }

  // Verificar token de recuperación
  static async verifyResetToken(req: Request, res: Response) {
    try {
      const { token } = req.params;

      if (!token) {
        throw new AppError('Token es requerido', 400);
      }

      // Buscar token válido
      const resetToken = await prisma.passwordResetToken.findFirst({
        where: {
          token,
          used: false,
          expiresAt: { gt: new Date() }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (!resetToken) {
        throw new AppError('Token inválido o expirado', 400);
      }

      res.json({
        message: 'Token válido',
        user: {
          email: resetToken.user.email,
          firstName: resetToken.user.firstName,
          lastName: resetToken.user.lastName
        },
        purpose: resetToken.purpose || 'password_reset'
      });

    } catch (error) {
      securityLogger.error('Error verifying reset token:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  }

  // Resetear contraseña
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        throw new AppError('Token y nueva contraseña son requeridos', 400);
      }

      if (newPassword.length < 8) {
        throw new AppError('La contraseña debe tener al menos 8 caracteres', 400);
      }

      // Buscar token válido
      const resetToken = await prisma.passwordResetToken.findFirst({
        where: {
          token,
          used: false,
          expiresAt: { gt: new Date() }
        },
        include: {
          user: true
        }
      }) as any;

      if (!resetToken) {
        throw new AppError('Token inválido o expirado', 400);
      }

      // Encriptar nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Actualizar contraseña del usuario
      await prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword }
      });

      // Marcar token como usado
      await prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { 
          used: true, 
          usedAt: new Date() 
        }
      });

      // Enviar email de confirmación
      try {
        await NotificationService.sendPasswordChangedEmail(
          resetToken.user.email, 
          resetToken.user.firstName, 
          resetToken.user.lastName
        );
        securityLogger.info(`Password changed confirmation email sent to ${resetToken.user.email}`);
      } catch (emailError) {
        securityLogger.error(`Error sending password changed email to ${resetToken.user.email}:`, emailError);
        // No fallar el proceso si el email falla
      }

      securityLogger.info(`Password successfully reset for user: ${resetToken.user.email}`);

      const requiresConsent = resetToken.purpose === 'patient_setup';
      res.json({ 
        message: 'Contraseña actualizada exitosamente',
        ...(requiresConsent && { requiresConsent: true })
      });

    } catch (error) {
      securityLogger.error('Error resetting password:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  }

  // Limpiar tokens expirados (para mantenimiento)
  static async cleanupExpiredTokens() {
    try {
      const deletedCount = await prisma.passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { used: true }
          ]
        }
      });

      if (deletedCount.count > 0) {
        securityLogger.info(`Cleaned up ${deletedCount.count} expired/used password reset tokens`);
      }
    } catch (error) {
      securityLogger.error('Error cleaning up expired tokens:', error);
    }
  }
}
