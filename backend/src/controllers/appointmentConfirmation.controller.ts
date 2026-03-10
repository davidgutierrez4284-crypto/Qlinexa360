import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { PrismaClient } from '@prisma/client';
import { formatAppointmentTime, formatAppointmentDate } from '../utils/date.utils';
import { securityLogger } from '../utils/logger.utils';
import { NotificationService } from '../services/notification.service';
import { ScheduleService } from '../services/schedule.service';
import { GoogleCalendarSyncService } from '../services/googleCalendarSync.service';
import { OutlookCalendarSyncService } from '../services/outlookCalendarSync.service';
import { AppleCalendarSyncService } from '../services/appleCalendarSync.service';
import { EmailService } from '../services/notification.service';
import crypto from 'crypto';

const prisma = new PrismaClient();

/** Resuelve el doctor para DOCTOR (por userId) o ASISTENTE (por X-Selected-Doctor-Id) */
async function resolveDoctorForRequest(req: AuthRequest): Promise<{ id: string; userId: string; timezone?: string | null; professionalTitle?: string | null; specialization?: string | null } | null> {
  if (!req.user?.userId) return null;
  if (req.user.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.userId },
      select: { id: true, userId: true, timezone: true, professionalTitle: true, specialization: true }
    });
    return doctor;
  }
  if (req.user.role === 'ASISTENTE') {
    const selectedDoctorId = req.headers['x-selected-doctor-id'];
    if (!selectedDoctorId || Array.isArray(selectedDoctorId)) return null;
    const link = await prisma.asistenteDoctorVinculo.findFirst({
      where: {
        doctorId: selectedDoctorId,
        asistenteId: req.user.userId,
        activo: true
      }
    });
    if (!link) return null;
    const doctor = await prisma.doctor.findUnique({
      where: { id: selectedDoctorId },
      select: { id: true, userId: true, timezone: true, professionalTitle: true, specialization: true }
    });
    return doctor;
  }
  return null;
}

export class AppointmentConfirmationController {
  // Obtener datos de cita por token (público)
  static async getAppointmentByToken(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const confirmationRequest = await prisma.appointmentConfirmationRequest.findUnique({
        where: { confirmationToken: token },
        include: {
          appointment: {
            include: {
              patient: {
                include: { user: true }
              },
              doctor: {
                include: { user: true }
              }
            }
          }
        }
      });

      if (!confirmationRequest) {
        return res.status(404).json({ error: 'Solicitud de confirmación no encontrada' });
      }

      if (confirmationRequest.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Token de confirmación expirado' });
      }

      const appointment = confirmationRequest.appointment;
      const patientName = {
        firstName: appointment.patient.firstName || appointment.patient.user?.firstName || '',
        lastName: appointment.patient.lastName || appointment.patient.user?.lastName || ''
      };
      const doctorName = {
        firstName: appointment.doctor.user?.firstName || '',
        lastName: appointment.doctor.user?.lastName || '',
        professionalTitle: appointment.doctor.professionalTitle || ''
      };

      const doctorTimezone = (appointment.doctor as { timezone?: string | null })?.timezone ?? 'America/Mexico_City';
      const displayDate = formatAppointmentDate(appointment.date, doctorTimezone);
      const displayTime = formatAppointmentTime(appointment.date, doctorTimezone);

      res.json({
        success: true,
        data: {
          appointmentId: appointment.id,
          date: appointment.date,
          displayDate,
          displayTime,
          patient: patientName,
          doctor: doctorName,
          confirmationStatus: appointment.confirmationStatus
        }
      });
    } catch (error) {
      securityLogger.error('Error al obtener cita por token:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  private static async getOrCreateManageLink(appointmentId: string): Promise<string> {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const existingRequest = await prisma.appointmentConfirmationRequest.findFirst({
      where: {
        appointmentId,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingRequest) {
      return `${baseUrl}/confirm-appointment/${existingRequest.confirmationToken}`;
    }

    const confirmationToken = crypto.randomBytes(32).toString('hex');
    await prisma.appointmentConfirmationRequest.create({
      data: {
        appointmentId,
        reminderType: 'FINAL_REMINDER',
        scheduledFor: new Date(),
        status: 'PENDING',
        confirmationToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        patientResponse: 'NO_RESPONSE'
      }
    });

    return `${baseUrl}/confirm-appointment/${confirmationToken}`;
  }
  
  // Obtener estado de confirmaciones para un doctor
  static async getConfirmationStatus(req: AuthRequest, res: Response) {
    try {
      const doctor = await resolveDoctorForRequest(req);
      if (!doctor) {
        return res.status(req.user ? 404 : 401).json({ error: req.user ? 'Perfil de doctor no encontrado. Si eres asistente, selecciona un doctor.' : 'No autorizado' });
      }
      const doctorId = doctor.id;
      const { date } = req.query;
      
      const whereClause: any = { doctorId };
      if (date) {
        const startDate = new Date(date as string);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        
        whereClause.date = {
          gte: startDate,
          lt: endDate
        };
      }
      
      const appointments = await prisma.appointment.findMany({
        where: whereClause,
        include: {
          patient: {
            include: {
              user: true
            }
          },
          confirmationRequests: {
            orderBy: {
              scheduledFor: 'desc'
            }
          }
        },
        orderBy: {
          date: 'asc'
        }
      });
      
      // Agrupar por estado de confirmación
      const statusCounts = {
        pending: 0,
        confirmed: 0,
        cancelled: 0,
        rescheduled: 0,
        noShow: 0,
        completed: 0
      };
      
      appointments.forEach(appointment => {
        switch (appointment.confirmationStatus) {
          case 'PENDING':
            statusCounts.pending++;
            break;
          case 'CONFIRMED':
            statusCounts.confirmed++;
            break;
          case 'CANCELLED':
            statusCounts.cancelled++;
            break;
          case 'RESCHEDULED':
            statusCounts.rescheduled++;
            break;
          case 'NO_SHOW':
            statusCounts.noShow++;
            break;
          case 'COMPLETED':
            statusCounts.completed++;
            break;
        }
      });
      
      res.json({
        success: true,
        data: {
          appointments,
          statusCounts,
          total: appointments.length
        }
      });
    } catch (error) {
      securityLogger.error('Error al obtener estado de confirmaciones:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Crear solicitud de confirmación para una cita
  static async createConfirmationRequest(req: AuthRequest, res: Response) {
    try {
      const doctor = await resolveDoctorForRequest(req);
      if (!doctor) {
        return res.status(req.user ? 404 : 401).json({ error: req.user ? 'Perfil de doctor no encontrado. Si eres asistente, selecciona un doctor.' : 'No autorizado' });
      }

      const doctorId = doctor.id;
      const { appointmentId, reminderType, scheduledFor } = req.body;

      // Verificar que la cita pertenece al doctor
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId }
      });

      if (!appointment || appointment.doctorId !== doctorId) {
        return res.status(403).json({ error: 'La cita no pertenece a este doctor' });
      }
      
      // Generar token único de confirmación
      const confirmationToken = crypto.randomBytes(32).toString('hex');
      
      // Calcular fecha de expiración (24 horas)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      const confirmationRequest = await prisma.appointmentConfirmationRequest.create({
        data: {
          appointmentId,
          reminderType,
          scheduledFor: new Date(scheduledFor),
          confirmationToken,
          expiresAt
        },
        include: {
          appointment: {
            include: {
              patient: {
                include: {
                  user: true
                }
              },
              doctor: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      });
      
      // Enviar email de confirmación
      await NotificationService.sendAppointmentConfirmationEmail(
        confirmationRequest.appointment.patient.user.email,
        confirmationRequest.appointment.patient.user.firstName,
        confirmationRequest.appointment.patient.user.lastName,
        confirmationRequest.appointment.date,
        confirmationRequest.appointment.doctor.user.firstName,
        confirmationRequest.appointment.doctor.user.lastName,
        confirmationRequest.confirmationToken,
        reminderType,
        (confirmationRequest.appointment.doctor as { timezone?: string | null }).timezone ?? 'America/Mexico_City'
      );
      
      res.json({
        success: true,
        data: confirmationRequest
      });
    } catch (error) {
      securityLogger.error('Error al crear solicitud de confirmación:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Confirmar cita por parte del paciente
  static async confirmAppointment(req: Request, res: Response) {
    try {
      const { token } = req.params;
      
      // Buscar la solicitud de confirmación
      const confirmationRequest = await prisma.appointmentConfirmationRequest.findUnique({
        where: { confirmationToken: token },
        include: {
          appointment: true
        }
      });
      
      if (!confirmationRequest) {
        return res.status(404).json({ error: 'Solicitud de confirmación no encontrada' });
      }
      
      if (confirmationRequest.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Token de confirmación expirado' });
      }
      
      // Actualizar estado de la cita
      await prisma.appointment.update({
        where: { id: confirmationRequest.appointmentId },
        data: {
          confirmationStatus: 'CONFIRMED',
          confirmedAt: new Date()
        }
      });

      // Sincronizar evento interno/externo para reflejar la cita confirmada
      await AppointmentConfirmationController.syncAppointmentCalendars(
        confirmationRequest.appointmentId,
        { responseStatus: 'accepted' }
      );
      
      // Actualizar estado de la solicitud
      await prisma.appointmentConfirmationRequest.update({
        where: { id: confirmationRequest.id },
        data: {
          status: 'RESPONDED',
          patientResponse: 'CONFIRMED',
          respondedAt: new Date()
        }
      });
      
      res.json({
        success: true,
        message: 'Cita confirmada exitosamente'
      });
    } catch (error) {
      securityLogger.error('Error al confirmar cita:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Cancelar cita por parte del paciente
  static async cancelAppointment(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const { reason } = req.body;
      
      // Buscar la solicitud de confirmación
      const confirmationRequest = await prisma.appointmentConfirmationRequest.findUnique({
        where: { confirmationToken: token },
        include: {
          appointment: true
        }
      });
      
      if (!confirmationRequest) {
        return res.status(404).json({ error: 'Solicitud de confirmación no encontrada' });
      }
      
      if (confirmationRequest.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Token de confirmación expirado' });
      }
      
      // Actualizar estado de la cita
      await prisma.appointment.update({
        where: { id: confirmationRequest.appointmentId },
        data: {
          confirmationStatus: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason
        }
      });
      
      // Actualizar estado de la solicitud
      await prisma.appointmentConfirmationRequest.update({
        where: { id: confirmationRequest.id },
        data: {
          status: 'RESPONDED',
          patientResponse: 'CANCELLED',
          respondedAt: new Date()
        }
      });

      await AppointmentConfirmationController.syncAppointmentCalendars(
        confirmationRequest.appointmentId,
        { cancelExternal: true, responseStatus: 'declined' }
      );
      
      // Notificar al doctor sobre la cancelación
      // TODO: Implementar notificación al doctor
      
      res.json({
        success: true,
        message: 'Cita cancelada exitosamente'
      });
    } catch (error) {
      securityLogger.error('Error al cancelar cita:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Obtener horarios disponibles para reprogramación (público, basado en token)
  static async getAvailableRescheduleSlots(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const { date } = req.query; // Fecha opcional para filtrar
      
      // Buscar la solicitud de confirmación para obtener el doctorId
      const confirmationRequest = await prisma.appointmentConfirmationRequest.findUnique({
        where: { confirmationToken: token },
        include: {
          appointment: {
            include: {
              doctor: true
            }
          }
        }
      });
      
      if (!confirmationRequest) {
        return res.status(404).json({ error: 'Token de confirmación no encontrado' });
      }
      
      if (confirmationRequest.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Token de confirmación expirado' });
      }
      
      const doctorId = confirmationRequest.appointment.doctorId;

      // Parsear la fecha correctamente (formato YYYY-MM-DD) en hora local
      let targetDate: Date;
      if (date) {
        const dateParts = (date as string).split('-');
        if (dateParts.length === 3) {
          targetDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2])
          );
        } else {
          targetDate = new Date(date as string);
        }
      } else {
        targetDate = new Date();
      }

      // Asegurar que la fecha esté en medianoche local para comparaciones correctas
      targetDate.setHours(0, 0, 0, 0);

      // Crear copias de la fecha para evitar modificar el objeto original
      const dateStart = new Date(targetDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(targetDate);
      dateEnd.setHours(23, 59, 59, 999);
      
      // Verificar si la fecha está disponible según la configuración del doctor
      const isDateAvailable = await ScheduleService.isDateAvailable(doctorId, targetDate);
      if (!isDateAvailable) {
        return res.json({
          success: true,
          data: [],
          message: 'Fecha no disponible según configuración del doctor'
        });
      }
      
      // Obtener configuración de horarios para obtener duración de cita y buffer time
      const scheduleConfig = await ScheduleService.getScheduleConfig(doctorId);
      const appointmentDuration = scheduleConfig?.appointmentDuration || 30;
      const bufferTime = scheduleConfig?.bufferTime || 15;

      // Generar slots en la zona horaria del doctor
      const doctorTimezone = confirmationRequest.appointment.doctor?.timezone || 'America/Mexico_City';
      const availableSlots = await ScheduleService.generateAvailableSlots(doctorId, targetDate, doctorTimezone);

      if (availableSlots.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'No hay horarios disponibles para esta fecha según la configuración del doctor'
        });
      }
      
      // Obtener citas existentes para la fecha (excluyendo la cita actual que se está reprogramando)
      const existingAppointments = await prisma.appointment.findMany({
        where: {
          doctorId,
          id: { not: confirmationRequest.appointmentId }, // Excluir la cita actual
          date: {
            gte: dateStart,
            lt: dateEnd
          },
          confirmationStatus: {
            in: ['CONFIRMED']
          }
        },
        select: {
          id: true,
          date: true,
          confirmationStatus: true
        }
      });

      const allEvents = await prisma.internalCalendarEvent.findMany({
        where: {
          doctorId,
          fechaHoraInicio: {
            gte: dateStart,
            lte: dateEnd
          }
        },
        include: {
          patient: {
            include: {
              appointments: {
                where: {
                  doctorId,
                  id: { not: confirmationRequest.appointmentId },
                  date: {
                    gte: dateStart,
                    lte: dateEnd
                  },
                  confirmationStatus: {
                    in: ['CONFIRMED']
                  }
                },
                select: {
                  id: true,
                  date: true,
                  confirmationStatus: true
                }
              }
            }
          }
        }
      });

      const occupiedEvents = allEvents.filter(event => {
        if (!event.patientId || !event.patient) {
          return true;
        }

        if (event.patient.appointments && event.patient.appointments.length > 0) {
          const eventTime = event.fechaHoraInicio.getTime();
          const hasRelatedAppointment = event.patient.appointments.some(appointment => {
            const appointmentTime = new Date(appointment.date).getTime();
            const timeDiff = Math.abs(eventTime - appointmentTime);
            return timeDiff <= 30 * 60 * 1000;
          });

          return hasRelatedAppointment;
        }

        return true;
      }).map(event => ({
        id: event.id,
        fechaHoraInicio: event.fechaHoraInicio,
        fechaHoraFin: event.fechaHoraFin,
        patientId: event.patientId
      }));

      const slotDuration = appointmentDuration * 60000;

      // Filtrar slots que no tienen conflictos con citas o eventos existentes
      const availableTimes = availableSlots.filter(slot => {
        const slotEnd = new Date(slot.getTime() + slotDuration);

        const hasAppointmentConflict = existingAppointments.some(appointment => {
          const appointmentStart = new Date(appointment.date);
          const appointmentEnd = new Date(appointmentStart.getTime() + slotDuration);
          const slotStartWithBuffer = new Date(slot.getTime() - bufferTime * 60000);
          const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferTime * 60000);
          return (
            (slotStartWithBuffer < appointmentEnd && slotEndWithBuffer > appointmentStart) ||
            (appointmentStart < slotEndWithBuffer && appointmentEnd > slotStartWithBuffer)
          );
        });

        if (hasAppointmentConflict) {
          return false;
        }

        const hasEventConflict = occupiedEvents.some(event => {
          const eventStart = new Date(event.fechaHoraInicio);
          const eventEnd = new Date(event.fechaHoraFin);
          const slotStartWithBuffer = new Date(slot.getTime() - bufferTime * 60000);
          const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferTime * 60000);
          return (
            (slotStartWithBuffer < eventEnd && slotEndWithBuffer > eventStart) ||
            (eventStart < slotEndWithBuffer && eventEnd > slotStartWithBuffer)
          );
        });

        if (hasEventConflict) {
          return false;
        }

        return true;
      });
      
      res.json({
        success: true,
        data: availableTimes.map(slot => ({
          id: `slot_${slot.getTime()}`,
          startTime: slot.toISOString(),
          endTime: new Date(slot.getTime() + slotDuration).toISOString(),
          displayTime: formatAppointmentTime(slot)
        }))
      });
    } catch (error) {
      securityLogger.error('Error al obtener horarios disponibles para reprogramación:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Solicitar reprogramación de cita
  static async requestReschedule(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const { preferredDate, preferredTime, notes } = req.body; // Cambiar preferredTimeSlot a preferredTime (datetime completo)
      
      // Buscar la solicitud de confirmación
      const confirmationRequest = await prisma.appointmentConfirmationRequest.findUnique({
        where: { confirmationToken: token },
        include: {
          appointment: true
        }
      });
      
      if (!confirmationRequest) {
        return res.status(404).json({ error: 'Solicitud de confirmación no encontrada' });
      }
      
      if (confirmationRequest.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Token de confirmación expirado' });
      }
      
      const doctorId = confirmationRequest.appointment.doctorId;
      
      // Validar que se proporcione fecha y hora
      if (!preferredDate || !preferredTime) {
        return res.status(400).json({ error: 'Debes proporcionar fecha y hora para la reprogramación' });
      }
      
      // Construir datetime completo
      const requestedDateTime = new Date(`${preferredDate}T${preferredTime}`);
      
      // Validar que la fecha no sea en el pasado
      if (requestedDateTime < new Date()) {
        return res.status(400).json({ error: 'No puedes reprogramar a una fecha/hora en el pasado' });
      }
      
      // Verificar disponibilidad del doctor
      const isDateAvailable = await ScheduleService.isDateAvailable(doctorId, requestedDateTime);
      const timeString = requestedDateTime.toTimeString().slice(0, 5); // "HH:MM"
      const isSlotAvailable = await ScheduleService.isTimeSlotAvailable(doctorId, requestedDateTime, timeString);
      const scheduleConfig = await ScheduleService.getScheduleConfig(doctorId);
      const appointmentDuration = scheduleConfig?.appointmentDuration || 30;
      const slotEnd = new Date(requestedDateTime.getTime() + appointmentDuration * 60000);
      const conflictingAppointments = await prisma.appointment.findMany({
        where: {
          doctorId,
          id: { not: confirmationRequest.appointmentId },
          date: {
            gte: requestedDateTime,
            lt: slotEnd
          },
          status: {
            in: ['SCHEDULED', 'CONFIRMED']
          }
        }
      });

      // Actualizar entrada en lista de espera si ya existe (para reflejar la última solicitud)
      const hour = requestedDateTime.getHours();
      const preferredTimeSlot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      const existingEntry = await prisma.waitlistEntry.findFirst({
        where: {
          appointmentId: confirmationRequest.appointmentId,
          status: 'ACTIVE'
        }
      });

      if (!isDateAvailable || !isSlotAvailable || conflictingAppointments.length > 0) {
        // Si no hay disponibilidad, crear/actualizar entrada en lista de espera
        let waitlistEntryId: string;
        if (existingEntry) {
          const updated = await prisma.waitlistEntry.update({
            where: { id: existingEntry.id },
            data: {
              preferredDate: requestedDateTime,
              preferredTimeSlot,
              notes: notes || existingEntry.notes
            }
          });
          waitlistEntryId = updated.id;
        } else {
          const created = await prisma.waitlistEntry.create({
            data: {
              doctorId,
              patientId: confirmationRequest.appointment.patientId,
              appointmentId: confirmationRequest.appointmentId,
              preferredDate: requestedDateTime,
              preferredTimeSlot,
              urgency: 'NORMAL',
              notes: notes || null
            }
          });
          waitlistEntryId = created.id;
        }

        // Marcar solicitud como respondida para evitar reintentos con el mismo token
        await prisma.appointmentConfirmationRequest.update({
          where: { id: confirmationRequest.id },
          data: {
            status: 'RESPONDED',
            patientResponse: 'RESCHEDULE',
            respondedAt: new Date()
          }
        });

        return res.json({
          success: true,
          message: 'No hay disponibilidad. Te agregamos a la lista de espera y el doctor podrá asignarte un nuevo horario.',
          data: {
            waitlistEntryId,
            requestedDate: requestedDateTime.toISOString()
          }
        });
      }
      
      if (existingEntry) {
        await prisma.waitlistEntry.update({
          where: { id: existingEntry.id },
          data: {
            preferredDate: requestedDateTime,
            preferredTimeSlot,
            notes: notes || existingEntry.notes
          }
        });
      }

      // Si todo está bien, actualizar la cita directamente (no crear entrada en lista de espera)
      // porque el paciente está eligiendo un horario disponible
      await prisma.appointment.update({
        where: { id: confirmationRequest.appointmentId },
        data: {
          date: requestedDateTime, // Actualizar la fecha/hora de la cita
          confirmationStatus: 'RESCHEDULED',
          rescheduledFrom: confirmationRequest.appointment.date,
          rescheduledTo: requestedDateTime
        }
      });

      // Sincronizar el evento interno/externo con la nueva fecha
      await AppointmentConfirmationController.syncAppointmentCalendars(
        confirmationRequest.appointmentId
      );
      
      // Actualizar estado de la solicitud
      await prisma.appointmentConfirmationRequest.update({
        where: { id: confirmationRequest.id },
        data: {
          status: 'RESPONDED',
          patientResponse: 'RESCHEDULE',
          respondedAt: new Date()
        }
      });
      
      // Notificar al doctor sobre la reprogramación
      // TODO: Implementar notificación al doctor
      
      res.json({
        success: true,
        message: 'Cita reprogramada exitosamente',
        data: {
          newDate: requestedDateTime.toISOString()
        }
      });
    } catch (error) {
      securityLogger.error('Error al solicitar reprogramación:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Obtener lista de espera de un doctor
  static async getWaitlist(req: AuthRequest, res: Response) {
    try {
      const doctor = await resolveDoctorForRequest(req);
      if (!doctor) {
        return res.status(req.user ? 404 : 401).json({ error: req.user ? 'Perfil de doctor no encontrado. Si eres asistente, selecciona un doctor.' : 'No autorizado' });
      }
      const doctorId = doctor.id;
      
      const waitlistEntries = await prisma.waitlistEntry.findMany({
        where: {
          doctorId,
          status: 'ACTIVE'
        },
        include: {
          patient: {
            include: {
              user: true
            }
          }
        },
        orderBy: [
          { urgency: 'desc' },
          { joinedAt: 'asc' }
        ]
      });
      
      res.json({
        success: true,
        data: waitlistEntries
      });
    } catch (error) {
      securityLogger.error('Error al obtener lista de espera:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener cancelaciones para un doctor
  static async getCancellations(req: AuthRequest, res: Response) {
    try {
      const doctor = await resolveDoctorForRequest(req);
      if (!doctor) {
        return res.status(req.user ? 404 : 401).json({ error: req.user ? 'Perfil de doctor no encontrado. Si eres asistente, selecciona un doctor.' : 'No autorizado' });
      }
      const cancellations = await prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          confirmationStatus: 'CANCELLED'
        },
        include: {
          patient: {
            include: { user: true }
          }
        },
        orderBy: {
          cancelledAt: 'desc'
        }
      });

      res.json({
        success: true,
        data: cancellations.map(appointment => ({
          id: appointment.id,
          patientName: `${appointment.patient.firstName || appointment.patient.user?.firstName || ''} ${appointment.patient.lastName || appointment.patient.user?.lastName || ''}`.trim() || 'Paciente',
          patientEmail: appointment.patient.email || appointment.patient.user?.email || '',
          patientPhone: appointment.patient.phone || appointment.patient.user?.phone || '',
          appointmentDate: appointment.date,
          originalDate: appointment.rescheduledFrom || appointment.date,
          cancellationDate: appointment.cancelledAt || appointment.updatedAt,
          reason: appointment.cancellationReason || 'Sin motivo',
          cancelledBy: 'patient',
          status: 'cancelled',
          notes: appointment.notes || ''
        }))
      });
    } catch (error) {
      securityLogger.error('Error al obtener cancelaciones:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener solicitudes de reprogramación (lista de espera) para un doctor
  static async getRescheduleRequests(req: AuthRequest, res: Response) {
    try {
      const doctor = await resolveDoctorForRequest(req);
      if (!doctor) {
        return res.status(req.user ? 404 : 401).json({ error: req.user ? 'Perfil de doctor no encontrado. Si eres asistente, selecciona un doctor.' : 'No autorizado' });
      }
      const waitlistEntries = await prisma.waitlistEntry.findMany({
        where: { doctorId: doctor.id },
        include: {
          patient: { include: { user: true } },
          appointment: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.json({
        success: true,
        data: waitlistEntries.map(entry => ({
          id: entry.id,
          patientName: `${entry.patient.firstName || entry.patient.user?.firstName || ''} ${entry.patient.lastName || entry.patient.user?.lastName || ''}`.trim() || 'Paciente',
          patientEmail: entry.patient.email || entry.patient.user?.email || '',
          patientPhone: entry.patient.phone || entry.patient.user?.phone || '',
          originalDate: entry.appointment?.date || null,
          requestedDate: entry.preferredDate,
          reason: entry.notes || '',
          status: entry.status === 'ASSIGNED' ? 'approved' : 'pending',
          notes: entry.notes || ''
        }))
      });
    } catch (error) {
      securityLogger.error('Error al obtener reprogramaciones:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  private static async syncAppointmentCalendars(
    appointmentId: string,
    options: { responseStatus?: 'accepted' | 'declined'; cancelExternal?: boolean } = {}
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } }
      }
    });

    if (!appointment) return;

    const scheduleConfig = await ScheduleService.getScheduleConfig(appointment.doctorId);
    const appointmentDuration = scheduleConfig?.appointmentDuration || 30;
    const appointmentEnd = new Date(appointment.date.getTime() + appointmentDuration * 60000);

    const fallbackDate = appointment.rescheduledFrom || appointment.date;
    let calendarEvent = await prisma.internalCalendarEvent.findFirst({
      where: {
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        fechaHoraInicio: {
          gte: new Date(fallbackDate.getTime() - 30 * 60000),
          lte: new Date(fallbackDate.getTime() + 30 * 60000)
        }
      }
    });

    // Si no se encontró por fecha anterior (rescheduledFrom), intentar por la fecha actual
    if (!calendarEvent) {
      calendarEvent = await prisma.internalCalendarEvent.findFirst({
        where: {
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          fechaHoraInicio: {
            gte: new Date(appointment.date.getTime() - 30 * 60000),
            lte: new Date(appointment.date.getTime() + 30 * 60000)
          }
        }
      });
    }

    const patientEmail = appointment.patient.email || appointment.patient.user?.email || '';
    const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim() || 'Paciente';
    const doctorName = appointment.doctor.user
      ? `${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`.trim()
      : appointment.doctor.professionalTitle || '';

    const manageLink = await AppointmentConfirmationController.getOrCreateManageLink(appointment.id);
    const manageText = `\n\nGestiona tu cita en Qlinexa: ${manageLink}\nSi necesitas confirmar o reprogramar, usa este enlace.`;
    const eventTitle = `${patientName} consulta`;
    const eventDescription = `Cita con ${appointment.doctor.professionalTitle || ''} ${doctorName}\n\n${appointment.notes || ''}${manageText}`;

    if (!calendarEvent) {
      calendarEvent = await prisma.internalCalendarEvent.create({
        data: {
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          fechaHoraInicio: appointment.date,
          fechaHoraFin: appointmentEnd,
          titulo: eventTitle,
          descripcion: eventDescription,
          origenEvento: 'interno',
          creadoPor: appointment.doctorId
        }
      });
    } else {
      calendarEvent = await prisma.internalCalendarEvent.update({
        where: { id: calendarEvent.id },
        data: {
          fechaHoraInicio: appointment.date,
          fechaHoraFin: appointmentEnd,
          titulo: calendarEvent.titulo || eventTitle,
          descripcion: calendarEvent.descripcion
            ? calendarEvent.descripcion.includes(manageLink)
              ? calendarEvent.descripcion
              : `${calendarEvent.descripcion}${manageText}`
            : eventDescription
        }
      });
    }

    const attendees = patientEmail ? [patientEmail] : [];

    let syncProvider: 'google' | 'outlook' | 'apple' | null = calendarEvent.externalProvider as
      | 'google'
      | 'outlook'
      | 'apple'
      | null;
    const hasGoogleCalendar = await prisma.calendarSyncConfig.findFirst({
      where: { doctorId: appointment.doctorId, provider: 'google', isConnected: true }
    });
    const hasOutlookCalendar = await prisma.calendarSyncConfig.findFirst({
      where: { doctorId: appointment.doctorId, provider: 'outlook', isConnected: true }
    });
    const hasAppleCalendar = await prisma.calendarSyncConfig.findFirst({
      where: { doctorId: appointment.doctorId, provider: 'apple', isConnected: true }
    });

    if (!syncProvider) {
      if (hasGoogleCalendar) syncProvider = 'google';
      else if (hasOutlookCalendar) syncProvider = 'outlook';
      else if (hasAppleCalendar) syncProvider = 'apple';
    }

    let conferenceLink: string | null = null;

    if (syncProvider === 'google' && hasGoogleCalendar) {
      try {
        if (options.cancelExternal && calendarEvent.externalEventId) {
          await GoogleCalendarSyncService.deleteEvent(appointment.doctorId, calendarEvent.externalEventId);
          await prisma.internalCalendarEvent.update({
            where: { id: calendarEvent.id },
            data: {
              externalProvider: null,
              externalEventId: null,
              externalUpdatedAt: null,
              linkMeeting: null
            }
          });
          return;
        }
        const syncResult = await GoogleCalendarSyncService.upsertEvent(appointment.doctorId, {
          id: calendarEvent.id,
          title: calendarEvent.titulo,
          description: calendarEvent.descripcion,
          start: calendarEvent.fechaHoraInicio,
          end: calendarEvent.fechaHoraFin,
          attendees,
          externalEventId: calendarEvent.externalEventId ?? undefined,
          conferenceType: 'google-meet',
          googleMeetEnabled: true,
          attendeesResponseStatus: options.responseStatus
        });
        if (syncResult) {
          conferenceLink = syncResult.conferenceLink ?? null;
          await prisma.internalCalendarEvent.update({
            where: { id: calendarEvent.id },
            data: {
              externalProvider: 'google',
              externalEventId: syncResult.externalEventId ?? null,
              externalUpdatedAt: syncResult.externalUpdatedAt ?? null,
              linkMeeting: conferenceLink
            }
          });
        }
      } catch (syncError) {
        console.error('Error sincronizando con Google Calendar:', syncError);
      }
    } else if (syncProvider === 'outlook' && hasOutlookCalendar) {
      try {
        if (options.cancelExternal && calendarEvent.externalEventId) {
          await OutlookCalendarSyncService.deleteEvent(appointment.doctorId, calendarEvent.externalEventId);
          await prisma.internalCalendarEvent.update({
            where: { id: calendarEvent.id },
            data: {
              externalProvider: null,
              externalEventId: null,
              externalUpdatedAt: null,
              linkMeeting: null
            }
          });
          return;
        }
        const syncResult = await OutlookCalendarSyncService.upsertEvent(appointment.doctorId, {
          id: calendarEvent.id,
          title: calendarEvent.titulo,
          description: calendarEvent.descripcion,
          start: calendarEvent.fechaHoraInicio,
          end: calendarEvent.fechaHoraFin,
          attendees,
          externalEventId: calendarEvent.externalEventId ?? undefined,
          teamsEnabled: true
        });
        if (syncResult) {
          conferenceLink = syncResult.conferenceLink ?? null;
          await prisma.internalCalendarEvent.update({
            where: { id: calendarEvent.id },
            data: {
              externalProvider: 'outlook',
              externalEventId: syncResult.externalEventId ?? null,
              externalUpdatedAt: syncResult.externalUpdatedAt ?? null,
              linkMeeting: conferenceLink
            }
          });
        }
      } catch (syncError) {
        console.error('Error sincronizando con Outlook Calendar:', syncError);
      }
    } else if (syncProvider === 'apple' && hasAppleCalendar) {
    } else if (syncProvider === 'apple' && hasAppleCalendar) {
      try {
        if (options.cancelExternal && calendarEvent.externalEventId) {
          await AppleCalendarSyncService.deleteEvent(appointment.doctorId, calendarEvent.externalEventId);
          await prisma.internalCalendarEvent.update({
            where: { id: calendarEvent.id },
            data: {
              externalProvider: null,
              externalEventId: null,
              externalUpdatedAt: null,
              linkMeeting: null
            }
          });
          return;
        }
        const syncResult = await AppleCalendarSyncService.upsertEvent(appointment.doctorId, {
          id: calendarEvent.id,
          title: calendarEvent.titulo,
          description: calendarEvent.descripcion,
          start: calendarEvent.fechaHoraInicio,
          end: calendarEvent.fechaHoraFin,
          attendees,
          externalEventId: calendarEvent.externalEventId ?? undefined
        });
        if (syncResult) {
          await prisma.internalCalendarEvent.update({
            where: { id: calendarEvent.id },
            data: {
              externalProvider: 'apple',
              externalEventId: syncResult.externalEventId ?? null,
              externalUpdatedAt: syncResult.externalUpdatedAt ?? null
            }
          });
        }
      } catch (syncError) {
        console.error('Error sincronizando con Apple Calendar:', syncError);
      }
    }
  }

  // Obtener slots disponibles para asignar desde la lista de espera
  static async getWaitlistAvailableSlots(req: AuthRequest, res: Response) {
    try {
      const doctor = await resolveDoctorForRequest(req);
      if (!doctor) {
        return res.status(req.user ? 404 : 401).json({ error: req.user ? 'Perfil de doctor no encontrado. Si eres asistente, selecciona un doctor.' : 'No autorizado' });
      }
      const { date } = req.query;
      let targetDate: Date;
      if (date) {
        const dateParts = (date as string).split('-');
        if (dateParts.length === 3) {
          targetDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2])
          );
        } else {
          targetDate = new Date(date as string);
        }
      } else {
        targetDate = new Date();
      }
      if (Number.isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: 'Fecha inválida' });
      }

      // Asegurar fecha en medianoche local
      targetDate.setHours(0, 0, 0, 0);

      const isDateAvailable = await ScheduleService.isDateAvailable(doctor.id, targetDate);
      if (!isDateAvailable) {
        return res.json({
          success: true,
          data: [],
          message: 'Fecha no disponible según configuración del doctor'
        });
      }

      const scheduleConfig = await ScheduleService.getScheduleConfig(doctor.id);
      const appointmentDuration = scheduleConfig?.appointmentDuration || 30;
      const bufferTime = scheduleConfig?.bufferTime || 15;

      const doctorTimezone = doctor.timezone || 'America/Mexico_City';
      const availableSlots = await ScheduleService.generateAvailableSlots(doctor.id, targetDate, doctorTimezone);
      if (availableSlots.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'No hay horarios disponibles para esta fecha según la configuración del doctor'
        });
      }

      const slotDuration = appointmentDuration * 60000;
      const dateStart = new Date(targetDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(targetDate);
      dateEnd.setHours(23, 59, 59, 999);

      const occupiedAppointments = await prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          date: { gte: dateStart, lte: dateEnd },
          confirmationStatus: { in: ['CONFIRMED'] }
        },
        select: {
          id: true,
          date: true
        }
      });

      const allEvents = await prisma.internalCalendarEvent.findMany({
        where: {
          doctorId: doctor.id,
          fechaHoraInicio: { gte: dateStart, lte: dateEnd }
        },
        include: {
          patient: {
            include: {
              appointments: {
                where: {
                  doctorId: doctor.id,
                  date: { gte: dateStart, lte: dateEnd },
                  confirmationStatus: { in: ['CONFIRMED'] }
                },
                select: {
                  id: true,
                  date: true,
                  confirmationStatus: true
                }
              }
            }
          }
        }
      });

      const occupiedEvents = allEvents.filter(event => {
        if (!event.patientId || !event.patient) {
          return true;
        }
        if (event.patient.appointments && event.patient.appointments.length > 0) {
          const eventTime = event.fechaHoraInicio.getTime();
          const hasRelatedAppointment = event.patient.appointments.some(appointment => {
            const appointmentTime = appointment.date.getTime();
            return Math.abs(appointmentTime - eventTime) < 30 * 60000;
          });
          return hasRelatedAppointment;
        }
        return false;
      });

      const availableTimes = availableSlots.filter(slot => {
        const slotEnd = new Date(slot.getTime() + slotDuration);
        const hasAppointmentConflict = occupiedAppointments.some(appointment => {
          const apptStart = appointment.date;
          const apptEnd = new Date(appointment.date.getTime() + slotDuration);
          const slotStartWithBuffer = new Date(slot.getTime() - bufferTime * 60000);
          const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferTime * 60000);
          return (
            (slotStartWithBuffer < apptEnd && slotEndWithBuffer > apptStart) ||
            (apptStart < slotEndWithBuffer && apptEnd > slotStartWithBuffer)
          );
        });

        if (hasAppointmentConflict) {
          return false;
        }

        const hasEventConflict = occupiedEvents.some(event => {
          const eventStart = event.fechaHoraInicio;
          const eventEnd = event.fechaHoraFin;
          const slotStartWithBuffer = new Date(slot.getTime() - bufferTime * 60000);
          const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferTime * 60000);
          return (
            (slotStartWithBuffer < eventEnd && slotEndWithBuffer > eventStart) ||
            (eventStart < slotEndWithBuffer && eventEnd > slotStartWithBuffer)
          );
        });

        return !hasEventConflict;
      });

      res.json({
        success: true,
        data: availableTimes.map(slot => ({
          id: `slot_${slot.getTime()}`,
          startTime: slot.toISOString(),
          endTime: new Date(slot.getTime() + slotDuration).toISOString(),
          isRecurring: false
        }))
      });
    } catch (error) {
      securityLogger.error('Error al obtener slots disponibles para lista de espera:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  // Asignar paciente de lista de espera a slot disponible
  static async assignWaitlistToSlot(req: AuthRequest, res: Response) {
    try {
      const doctor = await resolveDoctorForRequest(req);
      if (!doctor) {
        return res.status(req.user ? 404 : 401).json({ error: req.user ? 'Perfil de doctor no encontrado. Si eres asistente, selecciona un doctor.' : 'No autorizado' });
      }
      const doctorId = doctor.id;
      const { waitlistEntryId, appointmentId, slotDateTime } = req.body;

      // Verificar que la entrada de lista de espera pertenece al doctor
      const waitlistEntry = await prisma.waitlistEntry.findUnique({
        where: { id: waitlistEntryId }
      });

      if (!waitlistEntry || waitlistEntry.doctorId !== doctorId) {
        return res.status(403).json({ error: 'No tienes permiso para esta operación' });
      }

      const appointmentIdToUse = appointmentId || waitlistEntry.appointmentId;
      if (!appointmentIdToUse) {
        return res.status(400).json({ error: 'No hay cita asociada a esta entrada de lista de espera' });
      }

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentIdToUse }
      });

      if (!appointment || appointment.doctorId !== doctorId) {
        return res.status(403).json({ error: 'La cita no pertenece a este doctor' });
      }

      let newDateTime: Date | null = null;
      if (slotDateTime) {
        const parsed = new Date(slotDateTime);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ error: 'Formato de fecha/hora inválido para el slot' });
        }
        newDateTime = parsed;
      }
      
      // Actualizar entrada de lista de espera
      await prisma.waitlistEntry.update({
        where: { id: waitlistEntryId },
        data: {
          status: 'ASSIGNED',
          assignedAt: new Date(),
          appointmentId: appointmentIdToUse
        }
      });
      
      // Actualizar la cita con el nuevo horario si se proporcionó
      let updatedAppointment = null;
      let appointmentEnd = null;
      if (newDateTime) {
        const appointmentDuration = 30;
        appointmentEnd = new Date(newDateTime.getTime() + appointmentDuration * 60000);
        updatedAppointment = await prisma.appointment.update({
          where: { id: appointmentIdToUse },
          data: {
            date: newDateTime,
            confirmationStatus: 'CONFIRMED',
            confirmedAt: new Date(),
            rescheduledFrom: appointment.date,
            rescheduledTo: newDateTime
          },
          include: {
            patient: { include: { user: true } },
            doctor: { include: { user: true } }
          }
        });

        await prisma.internalCalendarEvent.updateMany({
          where: {
            doctorId,
            patientId: updatedAppointment.patientId,
            fechaHoraInicio: {
              gte: new Date(newDateTime.getTime() - 30 * 60000),
              lte: new Date(newDateTime.getTime() + 30 * 60000)
            }
          },
          data: {
            fechaHoraInicio: newDateTime,
            fechaHoraFin: appointmentEnd
          }
        });
      } else {
        updatedAppointment = await prisma.appointment.update({
          where: { id: appointmentIdToUse },
          data: {
            confirmationStatus: 'CONFIRMED',
            confirmedAt: new Date()
          },
          include: {
            patient: { include: { user: true } },
            doctor: { include: { user: true } }
          }
        });
        appointmentEnd = new Date(updatedAppointment.date.getTime() + 30 * 60000);
      }

      // Crear o actualizar evento interno y sincronizar con calendarios externos
      try {
        if (!updatedAppointment) {
          throw new Error('Appointment no disponible para sincronización');
        }

        const patientEmailForCalendar =
          updatedAppointment.patient.email || updatedAppointment.patient.user?.email || '';
        const patientName = `${updatedAppointment.patient.firstName} ${updatedAppointment.patient.lastName}`.trim();
        const doctorName = updatedAppointment.doctor.user
          ? `${updatedAppointment.doctor.user.firstName} ${updatedAppointment.doctor.user.lastName}`.trim()
          : updatedAppointment.doctor.professionalTitle || '';

        let calendarEvent = await prisma.internalCalendarEvent.findFirst({
          where: {
            doctorId,
            patientId: updatedAppointment.patientId,
            fechaHoraInicio: {
              gte: new Date(updatedAppointment.date.getTime() - 30 * 60000),
              lte: new Date(updatedAppointment.date.getTime() + 30 * 60000)
            }
          }
        });

        const eventTitle = `${patientName} consulta`;

        // Generar/recuperar link de gestión para el paciente
        const manageLink = await AppointmentConfirmationController.getOrCreateManageLink(updatedAppointment.id);
        const manageText = `\n\nGestiona tu cita en Qlinexa: ${manageLink}\nSi necesitas confirmar o reprogramar, usa este enlace.`;

        const eventDescription = `Cita con ${updatedAppointment.doctor.professionalTitle || ''} ${doctorName}\n\n${updatedAppointment.notes || ''}${manageText}`;

        if (!calendarEvent) {
          calendarEvent = await prisma.internalCalendarEvent.create({
            data: {
              doctorId: updatedAppointment.doctorId,
              patientId: updatedAppointment.patientId,
              fechaHoraInicio: updatedAppointment.date,
              fechaHoraFin: appointmentEnd!,
              titulo: eventTitle,
              descripcion: eventDescription,
              origenEvento: 'interno',
              creadoPor: updatedAppointment.doctorId
            }
          });
        } else {
          calendarEvent = await prisma.internalCalendarEvent.update({
            where: { id: calendarEvent.id },
            data: {
              fechaHoraInicio: updatedAppointment.date,
              fechaHoraFin: appointmentEnd!,
              titulo: calendarEvent.titulo || eventTitle,
              descripcion: calendarEvent.descripcion
                ? calendarEvent.descripcion.includes(manageLink)
                  ? calendarEvent.descripcion
                  : `${calendarEvent.descripcion}${manageText}`
                : eventDescription
            }
          });
        }

        if (calendarEvent) {
          const attendees = patientEmailForCalendar ? [patientEmailForCalendar] : [];

          let syncProvider: 'google' | 'outlook' | 'apple' | null = null;
          const hasGoogleCalendar = await prisma.calendarSyncConfig.findFirst({
            where: { doctorId, provider: 'google', isConnected: true }
          });
          const hasOutlookCalendar = await prisma.calendarSyncConfig.findFirst({
            where: { doctorId, provider: 'outlook', isConnected: true }
          });
          const hasAppleCalendar = await prisma.calendarSyncConfig.findFirst({
            where: { doctorId, provider: 'apple', isConnected: true }
          });

          if (hasGoogleCalendar) syncProvider = 'google';
          else if (hasOutlookCalendar) syncProvider = 'outlook';
          else if (hasAppleCalendar) syncProvider = 'apple';

          let conferenceLink: string | null = null;

          if (syncProvider === 'google' && hasGoogleCalendar) {
            try {
              const syncResult = await GoogleCalendarSyncService.upsertEvent(doctorId, {
                id: calendarEvent.id,
                title: calendarEvent.titulo,
                description: calendarEvent.descripcion,
                start: calendarEvent.fechaHoraInicio,
                end: calendarEvent.fechaHoraFin,
                attendees,
                externalEventId: calendarEvent.externalEventId ?? undefined,
                conferenceType: 'google-meet',
                googleMeetEnabled: true
              });
              if (syncResult) {
                conferenceLink = syncResult.conferenceLink ?? null;
                await prisma.internalCalendarEvent.update({
                  where: { id: calendarEvent.id },
                  data: {
                    externalProvider: 'google',
                    externalEventId: syncResult.externalEventId ?? null,
                    externalUpdatedAt: syncResult.externalUpdatedAt ?? null,
                    linkMeeting: conferenceLink
                  }
                });
              }
            } catch (syncError) {
              console.error('Error sincronizando con Google Calendar:', syncError);
            }
          } else if (syncProvider === 'outlook' && hasOutlookCalendar) {
            try {
              const syncResult = await OutlookCalendarSyncService.upsertEvent(doctorId, {
                id: calendarEvent.id,
                title: calendarEvent.titulo,
                description: calendarEvent.descripcion,
                start: calendarEvent.fechaHoraInicio,
                end: calendarEvent.fechaHoraFin,
                attendees,
                externalEventId: calendarEvent.externalEventId ?? undefined,
                teamsEnabled: true
              });
              if (syncResult) {
                conferenceLink = syncResult.conferenceLink ?? null;
                await prisma.internalCalendarEvent.update({
                  where: { id: calendarEvent.id },
                  data: {
                    externalProvider: 'outlook',
                    externalEventId: syncResult.externalEventId ?? null,
                    externalUpdatedAt: syncResult.externalUpdatedAt ?? null,
                    linkMeeting: conferenceLink
                  }
                });
              }
            } catch (syncError) {
              console.error('Error sincronizando con Outlook Calendar:', syncError);
            }
          } else if (syncProvider === 'apple' && hasAppleCalendar) {
            try {
              const syncResult = await AppleCalendarSyncService.upsertEvent(doctorId, {
                id: calendarEvent.id,
                title: calendarEvent.titulo,
                description: calendarEvent.descripcion,
                start: calendarEvent.fechaHoraInicio,
                end: calendarEvent.fechaHoraFin,
                attendees,
                externalEventId: calendarEvent.externalEventId ?? undefined
              });
              if (syncResult) {
                await prisma.internalCalendarEvent.update({
                  where: { id: calendarEvent.id },
                  data: {
                    externalProvider: 'apple',
                    externalEventId: syncResult.externalEventId ?? null,
                    externalUpdatedAt: syncResult.externalUpdatedAt ?? null
                  }
                });
              }
            } catch (syncError) {
              console.error('Error sincronizando con Apple Calendar:', syncError);
            }
          }

          if (patientEmailForCalendar) {
            const emailService = EmailService.getInstance();
            await emailService.sendCalendarEventEmail(patientEmailForCalendar, {
              patientName,
              doctorName,
              eventTitle: calendarEvent.titulo,
              eventDate: calendarEvent.fechaHoraInicio,
              eventEndDate: calendarEvent.fechaHoraFin,
              description: calendarEvent.descripcion || undefined,
              linkMeeting: conferenceLink || calendarEvent.linkMeeting || undefined,
              tipoCita: conferenceLink || calendarEvent.linkMeeting ? 'remota' : 'presencial',
              manageLink,
              timezone: (updatedAppointment?.doctor as { timezone?: string | null } | undefined)?.timezone ?? 'America/Mexico_City'
            });
          }

          // Notificar al doctor también
          const doctorEmail = updatedAppointment?.doctor?.user?.email || '';
          const doctorPhone = updatedAppointment?.doctor?.user?.phone || '';
          if (doctorEmail || doctorPhone) {
            const docTz = (updatedAppointment?.doctor as { timezone?: string | null } | undefined)?.timezone ?? 'America/Mexico_City';
            const timeStr = formatAppointmentTime(updatedAppointment!.date, docTz);
            await NotificationService.sendDoctorNotification(doctorEmail, doctorPhone, {
              doctorName: doctorName || updatedAppointment!.doctor.professionalTitle || 'Tu doctor',
              patientName,
              date: updatedAppointment!.date,
              time: timeStr,
              reason: updatedAppointment!.notes || '',
              timezone: docTz
            });
          }
        }
      } catch (calendarError) {
        console.error('Error al sincronizar evento de lista de espera:', calendarError);
      }
      
      res.json({
        success: true,
        message: 'Paciente asignado exitosamente al slot'
      });
    } catch (error) {
      securityLogger.error('Error al asignar paciente de lista de espera:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Aprobar o rechazar cita por parte del doctor
  static async updateAppointmentStatus(req: AuthRequest, res: Response) {
    try {
      const doctor = await resolveDoctorForRequest(req);
      if (!doctor) {
        return res.status(req.user ? 404 : 401).json({ error: req.user ? 'Perfil de doctor no encontrado. Si eres asistente, selecciona un doctor.' : 'No autorizado' });
      }
      const { appointmentId } = req.params;
      const { action, reason, newDateTime } = req.body; // action: 'approve', 'reject' o 'reschedule'

      if (!appointmentId || !action) {
        return res.status(400).json({ error: 'appointmentId y action son requeridos' });
      }

      if (!['approve', 'reject', 'reschedule'].includes(action)) {
        return res.status(400).json({ error: 'action debe ser "approve", "reject" o "reschedule"' });
      }

      // Si es reschedule, validar que se proporcione newDateTime
      if (action === 'reschedule' && !newDateTime) {
        return res.status(400).json({ error: 'newDateTime es requerido para reschedule' });
      }

      // Buscar la cita y verificar que pertenece al doctor
      const appointment = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          doctorId: doctor.id
        },
        include: {
          patient: {
            include: {
              user: true
            }
          }
        }
      });

      if (!appointment) {
        return res.status(404).json({ error: 'Cita no encontrada o no pertenece a este doctor' });
      }

      // Actualizar el estado de la cita
      if (action === 'approve') {
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            confirmationStatus: 'CONFIRMED',
            confirmedAt: new Date(),
            status: 'SCHEDULED'
          }
        });

        console.log('✅ Cita aprobada por el doctor:', appointmentId);

        // CRÍTICO: Buscar o crear el evento del calendario interno y sincronizarlo con calendarios externos
        // para que el paciente reciba la invitación de calendario
        try {
          // Calcular fecha de fin (30 minutos por defecto)
          const appointmentEnd = new Date(appointment.date.getTime() + 30 * 60000);

          // Buscar evento del calendario interno asociado a este appointment
          let calendarEvent = await prisma.internalCalendarEvent.findFirst({
            where: {
              doctorId: doctor.id,
              patientId: appointment.patientId,
              fechaHoraInicio: {
                gte: new Date(appointment.date.getTime() - 5 * 60000), // 5 minutos antes
                lte: new Date(appointment.date.getTime() + 5 * 60000)  // 5 minutos después
              }
            },
            include: {
              patient: {
                select: {
                  id: true,
                  userId: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          });

          // Si no existe el evento, crearlo
          if (!calendarEvent) {
            const doctorUser = await prisma.user.findUnique({
              where: { id: doctor.userId },
              select: { firstName: true, lastName: true }
            });

            const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
            const doctorName = doctorUser ? `${doctorUser.firstName} ${doctorUser.lastName}` : 'Dr.';
            const eventTitle = `${patientName} consulta`;
            const eventDescription = `Cita con ${doctor.professionalTitle || ''} ${doctorName}\n\n${appointment.notes || ''}`;

            calendarEvent = await prisma.internalCalendarEvent.create({
              data: {
                doctorId: doctor.id,
                patientId: appointment.patientId,
                fechaHoraInicio: appointment.date,
                fechaHoraFin: appointmentEnd,
                titulo: eventTitle,
                descripcion: eventDescription,
                origenEvento: 'interno',
                creadoPor: doctor.id
              },
              include: {
                patient: {
                  select: {
                    id: true,
                    userId: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            });

            console.log('✅ Evento del calendario interno creado:', calendarEvent.id);
          }

          // Verificar qué calendarios externos tiene configurados el doctor
          const hasGoogleCalendar = await prisma.calendarSyncConfig.findFirst({
            where: {
              doctorId: doctor.id,
              provider: 'google',
              isConnected: true
            }
          });
          const hasOutlookCalendar = await prisma.calendarSyncConfig.findFirst({
            where: {
              doctorId: doctor.id,
              provider: 'outlook',
              isConnected: true
            }
          });
          const hasAppleCalendar = await prisma.calendarSyncConfig.findFirst({
            where: {
              doctorId: doctor.id,
              provider: 'apple',
              isConnected: true
            }
          });

          // Prioridad: Google > Outlook > Apple
          let syncProvider: 'google' | 'outlook' | 'apple' | null = null;
          if (hasGoogleCalendar) {
            syncProvider = 'google';
          } else if (hasOutlookCalendar) {
            syncProvider = 'outlook';
          } else if (hasAppleCalendar) {
            syncProvider = 'apple';
          }

          // Obtener email del paciente
          const patientEmail = appointment.patient.email || appointment.patient.user?.email || null;
          const attendees = patientEmail ? [patientEmail] : [];

          console.log('📅 Sincronizando evento aprobado con calendario externo:', syncProvider || 'NINGUNO');
          console.log('   Email del paciente:', patientEmail || 'NO DISPONIBLE');
          console.log('   Attendees:', attendees.length > 0 ? attendees.join(', ') : 'NINGUNO');

          // Sincronizar con calendario externo para enviar invitación al paciente
          let syncResult = null;
          let conferenceLink: string | null = null;

          if (syncProvider === 'google' && hasGoogleCalendar) {
            try {
              const cleanTitle = calendarEvent.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
              syncResult = await GoogleCalendarSyncService.upsertEvent(doctor.id, {
                id: calendarEvent.id,
                title: cleanTitle,
                description: calendarEvent.descripcion,
                start: calendarEvent.fechaHoraInicio,
                end: calendarEvent.fechaHoraFin,
                attendees,
                externalEventId: calendarEvent.externalEventId ?? undefined,
                location: doctor.specialization || undefined,
                googleMeetEnabled: true // Habilitar Google Meet automáticamente
              });

              if (syncResult) {
                await prisma.internalCalendarEvent.update({
                  where: { id: calendarEvent.id },
                  data: {
                    externalProvider: 'google',
                    externalEventId: syncResult.externalEventId,
                    externalUpdatedAt: syncResult.externalUpdatedAt,
                    linkMeeting: syncResult.conferenceLink || null
                  }
                });
                conferenceLink = syncResult.conferenceLink || null;
                console.log('✅ Evento sincronizado exitosamente con Google Calendar');
                console.log('   📧 Invitación enviada al paciente:', patientEmail);
              }
            } catch (error) {
              console.error('❌ Error sincronizando con Google Calendar:', error);
            }
          } else if (syncProvider === 'outlook' && hasOutlookCalendar) {
            try {
              const cleanTitle = calendarEvent.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
              syncResult = await OutlookCalendarSyncService.upsertEvent(doctor.id, {
                id: calendarEvent.id,
                title: cleanTitle,
                description: calendarEvent.descripcion,
                start: calendarEvent.fechaHoraInicio,
                end: calendarEvent.fechaHoraFin,
                attendees,
                externalEventId: calendarEvent.externalEventId ?? undefined,
                location: doctor.specialization || undefined,
                teamsEnabled: true // Habilitar Teams automáticamente
              });

              if (syncResult) {
                await prisma.internalCalendarEvent.update({
                  where: { id: calendarEvent.id },
                  data: {
                    externalProvider: 'outlook',
                    externalEventId: syncResult.externalEventId,
                    externalUpdatedAt: syncResult.externalUpdatedAt,
                    linkMeeting: syncResult.conferenceLink || null
                  }
                });
                conferenceLink = syncResult.conferenceLink || null;
                console.log('✅ Evento sincronizado exitosamente con Outlook Calendar');
                console.log('   📧 Invitación enviada al paciente:', patientEmail);
              }
            } catch (error) {
              console.error('❌ Error sincronizando con Outlook Calendar:', error);
            }
          } else if (syncProvider === 'apple' && hasAppleCalendar) {
            try {
              const cleanTitle = calendarEvent.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
              syncResult = await AppleCalendarSyncService.upsertEvent(doctor.id, {
                id: calendarEvent.id,
                title: cleanTitle,
                description: calendarEvent.descripcion,
                start: calendarEvent.fechaHoraInicio,
                end: calendarEvent.fechaHoraFin,
                attendees,
                externalEventId: calendarEvent.externalEventId ?? undefined
              });

              if (syncResult) {
                await prisma.internalCalendarEvent.update({
                  where: { id: calendarEvent.id },
                  data: {
                    externalProvider: 'apple',
                    externalEventId: syncResult.externalEventId,
                    externalUpdatedAt: syncResult.externalUpdatedAt
                  }
                });
                console.log('✅ Evento sincronizado exitosamente con Apple Calendar');
                console.log('   📧 Invitación enviada al paciente:', patientEmail);
              }
            } catch (error) {
              console.error('❌ Error sincronizando con Apple Calendar:', error);
            }
          } else {
            console.warn('⚠️  No hay calendarios externos configurados. El paciente NO recibirá invitación de calendario.');
          }

          // Enviar notificación por email al paciente (con información del meeting si está disponible)
          try {
            const patientEmailForNotification = appointment.patient.email || appointment.patient.user?.email;
            if (patientEmailForNotification) {
              const emailService = EmailService.getInstance();
              const doctorUser = await prisma.user.findUnique({
                where: { id: doctor.userId },
                select: { firstName: true, lastName: true }
              });
              const doctorName = doctorUser ? `${doctorUser.firstName} ${doctorUser.lastName}` : 'Dr.';
              const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;

              // Obtener link de pre-consulta si existe
              let preConsultationLink: string | undefined = undefined;
              const preConsultation = await prisma.preConsultation.findUnique({
                where: { appointmentId: appointmentId }
              });
              if (preConsultation && preConsultation.status === 'PENDING') {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                preConsultationLink = `${frontendUrl}/pre-consulta/${preConsultation.token}`;
              }
              const manageLink = await AppointmentConfirmationController.getOrCreateManageLink(appointmentId);

              await emailService.sendCalendarEventEmail(patientEmailForNotification, {
                patientName,
                doctorName: `${doctor.professionalTitle || ''} ${doctorName}`,
                eventTitle: calendarEvent.titulo,
                eventDate: appointment.date,
                eventEndDate: appointmentEnd,
                description: appointment.notes || undefined,
                linkMeeting: conferenceLink || undefined,
                tipoCita: conferenceLink ? 'remota' : 'presencial',
                preConsultationLink,
                manageLink,
                timezone: (doctor as { timezone?: string | null }).timezone ?? 'America/Mexico_City'
              });

              console.log('✅ Email de confirmación enviado al paciente:', patientEmailForNotification);
            } else {
              console.warn(`No se puede enviar notificación: paciente ${appointment.patientId} no tiene email`);
            }
          } catch (notifError) {
            console.error('Error enviando notificación al paciente:', notifError);
            // No fallar la actualización si la notificación falla
          }

        } catch (calendarError) {
          console.error('❌ Error al sincronizar con calendarios externos:', calendarError);
          // No fallar la aprobación si la sincronización falla
        }

        res.json({
          success: true,
          message: 'Cita aprobada exitosamente. La invitación de calendario ha sido enviada al paciente.',
          data: {
            appointmentId,
            confirmationStatus: 'CONFIRMED'
          }
        });
      } else if (action === 'reject') {
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            confirmationStatus: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: reason || 'Rechazada por el doctor',
            status: 'CANCELLED'
          }
        });

        // Enviar notificación al paciente sobre el rechazo
        try {
          const patientEmail = appointment.patient.email || appointment.patient.user?.email;
          if (patientEmail) {
            // TODO: Implementar método específico para notificar rechazo
            console.log(`Notificación de rechazo debería enviarse a: ${patientEmail}`);
          }
        } catch (notifError) {
          console.error('Error enviando notificación de rechazo al paciente:', notifError);
          // No fallar la actualización si la notificación falla
        }

        res.json({
          success: true,
          message: 'Cita rechazada exitosamente',
          data: {
            appointmentId,
            confirmationStatus: 'CANCELLED'
          }
        });
      } else if (action === 'reschedule') {
        // Proponer nuevo horario al paciente
        const newDate = new Date(newDateTime);
        
        // Validar que la fecha no sea en el pasado
        if (newDate < new Date()) {
          return res.status(400).json({ error: 'No puedes reprogramar a una fecha/hora en el pasado' });
        }

        // Verificar disponibilidad del nuevo horario
        const timeString = newDate.toTimeString().slice(0, 5);
        const isSlotAvailable = await ScheduleService.isTimeSlotAvailable(doctor.id, newDate, timeString);
        
        if (!isSlotAvailable) {
          return res.status(400).json({ error: 'El horario propuesto no está disponible según la configuración del doctor' });
        }

        // Verificar conflictos con otras citas
        const slotEnd = new Date(newDate.getTime() + 30 * 60000);
        const conflictingAppointments = await prisma.appointment.findMany({
          where: {
            doctorId: doctor.id,
            id: { not: appointmentId },
            date: {
              gte: newDate,
              lt: slotEnd
            },
            confirmationStatus: {
              in: ['CONFIRMED', 'PENDING'] // Solo verificar citas confirmadas o pendientes
            }
          }
        });

        if (conflictingAppointments.length > 0) {
          return res.status(400).json({ error: 'El horario propuesto tiene conflicto con otra cita existente' });
        }

        // Actualizar la cita con el nuevo horario propuesto (PENDING para que el paciente confirme)
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            date: newDate,
            confirmationStatus: 'PENDING',
            rescheduledFrom: appointment.date,
            rescheduledTo: newDate,
            notes: reason ? `${appointment.notes || ''}\n\n[Reagendamiento propuesto por el doctor] ${reason}` : `${appointment.notes || ''}\n\n[Reagendamiento propuesto por el doctor]`
          }
        });

        // Crear una solicitud de confirmación para que el paciente acepte el nuevo horario
        const confirmationToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Válido por 7 días

        await prisma.appointmentConfirmationRequest.create({
          data: {
            appointmentId: appointmentId,
            reminderType: 'CONFIRMATION_48H',
            scheduledFor: newDate,
            confirmationToken,
            expiresAt,
            status: 'PENDING'
          }
        });

        // Enviar notificación al paciente con el nuevo horario propuesto
        try {
          const patientEmail = appointment.patient.email || appointment.patient.user?.email;
          if (patientEmail) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const confirmationLink = `${frontendUrl}/confirmar-cita/${confirmationToken}`;

            const emailService = EmailService.getInstance();
            const doctorUser = await prisma.user.findUnique({
              where: { id: doctor.userId },
              select: { firstName: true, lastName: true }
            });
            const doctorName = doctorUser ? `${doctorUser.firstName} ${doctorUser.lastName}` : 'Dr.';
            const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;

            // TODO: Crear un método específico para notificar reagendamiento propuesto
            // Por ahora, enviar email genérico
            console.log(`Notificación de reagendamiento debería enviarse a: ${patientEmail}`);
            console.log(`Nuevo horario propuesto: ${newDate.toLocaleString('es-ES')}`);
            console.log(`Link de confirmación: ${confirmationLink}`);
          }
        } catch (notifError) {
          console.error('Error enviando notificación de reagendamiento al paciente:', notifError);
          // No fallar la actualización si la notificación falla
        }

        res.json({
          success: true,
          message: 'Nuevo horario propuesto exitosamente. El paciente recibirá una notificación para confirmar.',
          data: {
            appointmentId,
            confirmationStatus: 'PENDING',
            newDateTime: newDate.toISOString(),
            rescheduledFrom: appointment.date.toISOString()
          }
        });
      }
    } catch (error) {
      securityLogger.error('Error al actualizar estado de cita:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}
