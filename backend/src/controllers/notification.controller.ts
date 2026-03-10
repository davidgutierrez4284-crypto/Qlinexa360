import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error.utils';
import { securityLogger } from '../utils/logger.utils';

const prisma = new PrismaClient();

export class NotificationController {
  // Obtener notificaciones del usuario
  static async getUserNotifications(req: AuthRequest, res: Response) {
    try {
      if (!req.user) throw new AppError('Autenticación requerida.', 401);

      const { page = 1, limit = 20, unreadOnly = false } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const whereClause: any = {
        userId: req.user.userId
      };

      if (unreadOnly === 'true') {
        whereClause.isRead = false;
      }

      const notifications = await prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      });

      const total = await prisma.notification.count({
        where: whereClause
      });

      const unreadCount = await prisma.notification.count({
        where: {
          userId: req.user.userId,
          isRead: false
        }
      });

      res.json({
        notifications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        },
        unreadCount
      });
    } catch (error: any) {
      securityLogger.error('Error al obtener notificaciones:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al obtener notificaciones.', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }

  // Marcar notificación como leída
  static async markAsRead(req: AuthRequest, res: Response) {
    try {
      if (!req.user) throw new AppError('Autenticación requerida.', 401);

      const { notificationId } = req.params;

      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId: req.user.userId
        }
      });

      if (!notification) {
        throw new AppError('Notificación no encontrada.', 404);
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      res.json({ message: 'Notificación marcada como leída' });
    } catch (error: any) {
      securityLogger.error('Error al marcar notificación como leída:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al marcar notificación como leída.', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }

  // Marcar todas las notificaciones como leídas
  static async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      if (!req.user) throw new AppError('Autenticación requerida.', 401);

      await prisma.notification.updateMany({
        where: {
          userId: req.user.userId,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      res.json({ message: 'Todas las notificaciones marcadas como leídas' });
    } catch (error: any) {
      securityLogger.error('Error al marcar todas las notificaciones como leídas:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al marcar notificaciones como leídas.', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }

  // Crear notificación de solicitud de colaboración
  static async createCollaborationRequest(req: AuthRequest, res: Response) {
    try {
      if (!req.user) throw new AppError('Autenticación requerida.', 401);

      // Verificar que el usuario es un doctor
      const doctor = await prisma.doctor.findUnique({
        where: { userId: req.user.userId }
      });

      if (!doctor) {
        return res.status(403).json({ message: 'Solo los doctores pueden crear solicitudes de colaboración' });
      }

      const { targetDoctorId, patientId, clinicalCaseId, patientName, clinicalCaseName, requestingDoctorName } = req.body;

      // Verificar que el doctor objetivo existe
      const targetDoctor = await prisma.doctor.findUnique({
        where: { id: targetDoctorId },
        include: { user: true }
      });

      if (!targetDoctor) {
        throw new AppError('Doctor no encontrado.', 404);
      }

      // Crear la notificación
      const notification = await prisma.notification.create({
        data: {
          userId: targetDoctor.userId,
          type: 'COLLABORATION_REQUEST',
          title: 'Solicitud de colaboración',
          message: `El Dr. ${requestingDoctorName} te ha invitado a colaborar en el caso clínico "${clinicalCaseName}" del paciente ${patientName}`,
          data: {
            patientId,
            clinicalCaseId,
            requestingDoctorId: req.user.userId,
            requestingDoctorName
          }
        }
      });

      securityLogger.info(`Notificación de colaboración creada para doctor ${targetDoctorId}`);
      res.status(201).json(notification);
    } catch (error: any) {
      securityLogger.error('Error al crear notificación de colaboración:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al crear notificación de colaboración.', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }

  // Eliminar notificación
  static async deleteNotification(req: AuthRequest, res: Response) {
    try {
      if (!req.user) throw new AppError('Autenticación requerida.', 401);

      const { notificationId } = req.params;

      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId: req.user.userId
        }
      });

      if (!notification) {
        throw new AppError('Notificación no encontrada.', 404);
      }

      await prisma.notification.delete({
        where: { id: notificationId }
      });

      res.json({ message: 'Notificación eliminada' });
    } catch (error: any) {
      securityLogger.error('Error al eliminar notificación:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al eliminar notificación.', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }
}
