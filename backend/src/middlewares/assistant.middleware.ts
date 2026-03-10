import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/error.utils';
import { AuthRequest } from './auth.middleware';

const prisma = new PrismaClient();

export class AssistantMiddleware {
  // Verificar si el usuario es asistente y tiene permisos para un módulo específico
  static checkAssistantModulePermission(module: string) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Usuario no autenticado', 401);
        }

        const userId = req.user.userId;
        const userRole = req.user.role;

        // Si es doctor, permitir acceso
        if (userRole === 'DOCTOR') {
          return next();
        }

        // Si es paciente y accede a sus propios datos (patientId='self'), permitir
        if (userRole === 'PATIENT' && req.params.patientId === 'self') {
          return next();
        }

        // Si es asistente, verificar permisos
        if (userRole === 'ASISTENTE') {
          // Obtener doctorId del header o del token
          const doctorId = req.headers['x-selected-doctor-id'] as string || req.user.doctorId;
          
          if (!doctorId) {
            throw new AppError('Asistente no vinculado a ningún doctor. Por favor selecciona un doctor.', 403);
          }

          // Buscar el vínculo activo del asistente con el doctor
          const link = await prisma.asistenteDoctorVinculo.findFirst({
            where: {
              doctorId,
              asistenteId: userId,
              activo: true
            }
          });

          if (!link) {
            throw new AppError('Asistente no autorizado', 403);
          }

          // Verificar permisos según el módulo
          let hasPermission = false;
          switch (module) {
            case 'appointments':
              hasPermission = link.permisosCitas;
              break;
            case 'clinicalHistory':
              hasPermission = link.permisosHistorial;
              break;
            case 'prescriptions':
              hasPermission = link.permisosRecetas;
              break;
            case 'notes':
              hasPermission = link.permisosNotas;
              break;
            case 'studies':
              hasPermission = link.permisosEstudios;
              break;
            case 'visualEvolution':
              hasPermission = link.permisosEvolucion;
              break;
            case 'billing':
              hasPermission = link.permisosFacturacion;
              break;
            default:
              hasPermission = false;
          }

          if (!hasPermission) {
            throw new AppError(`No tienes permisos para acceder al módulo: ${module}`, 403);
          }

          return next();
        }

        // Si no es doctor ni asistente, denegar acceso
        throw new AppError('Acceso denegado', 403);
      } catch (error) {
        next(error);
      }
    };
  }

  // Middleware para verificar que el asistente solo acceda a información de su doctor vinculado
  static checkAssistantDataAccess() {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Usuario no autenticado', 401);
        }

        const userRole = req.user.role;
        
        // Si es doctor, permitir acceso
        if (userRole === 'DOCTOR') {
          return next();
        }

        // Si es asistente, verificar que solo acceda a datos de su doctor vinculado
        if (userRole === 'ASISTENTE') {
          // Obtener doctorId del header o del token
          const linkedDoctorId = req.headers['x-selected-doctor-id'] as string || req.user.doctorId;
          
          if (!linkedDoctorId) {
            throw new AppError('Asistente no vinculado a ningún doctor. Por favor selecciona un doctor.', 403);
          }

          // Verificar que el recurso pertenece al doctor vinculado
          const resourceDoctorId = req.params.doctorId || (req.body as any)?.doctorId;
          
          if (resourceDoctorId && resourceDoctorId !== linkedDoctorId) {
            throw new AppError('No tienes permisos para acceder a esta información', 403);
          }

          return next();
        }

        // Si no es doctor ni asistente, denegar acceso
        throw new AppError('Acceso denegado', 403);
      } catch (error) {
        next(error);
      }
    };
  }

  // Middleware para agregar información de rastreo en las acciones de asistentes
  static addAssistantTracking() {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return next();
        }

        const userRole = req.user.role;
        
        // Si es asistente, agregar información de rastreo
        if (userRole === 'ASISTENTE') {
          const userId = req.user.userId;
          // Obtener doctorId del header o del token
          const doctorId = req.headers['x-selected-doctor-id'] as string || req.user.doctorId;

          // Agregar campos de rastreo al body de la petición
          if (req.body && doctorId) {
            (req.body as any).realizadoPor = userId;
            (req.body as any).vinculadoADoctor = doctorId;
          }
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  // Middleware para verificar que solo doctores puedan gestionar asistentes
  static doctorOnly() {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Usuario no autenticado', 401);
        }

        const userRole = req.user.role;
        
        if (userRole !== 'DOCTOR') {
          throw new AppError('Solo los doctores pueden gestionar asistentes', 403);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }
} 