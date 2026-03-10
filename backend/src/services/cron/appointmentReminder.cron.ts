import * as cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { EmailService, WhatsAppService } from '../notification.service';
import { securityLogger } from '../../utils/logger.utils';
import { formatAppointmentTime, formatAppointmentDateShort } from '../../utils/date.utils';

const prisma = new PrismaClient();

type ReminderKey = '1w' | '48h' | '24h' | '4h';

const REMINDER_DEFINITIONS: Array<{
  key: ReminderKey;
  label: string;
  hoursBefore: number;
  daysBefore: number;
}> = [
  { key: '1w', label: '1 semana', hoursBefore: 24 * 7, daysBefore: 7 },
  { key: '48h', label: '48 horas', hoursBefore: 48, daysBefore: 2 },
  { key: '24h', label: '24 horas', hoursBefore: 24, daysBefore: 1 },
  { key: '4h', label: '4 horas', hoursBefore: 4, daysBefore: 0 }
];

export class AppointmentReminderCron {
  private static job: cron.ScheduledTask | null = null;

  static start() {
    if (!this.job) {
      // Corre cada 15 minutos para cubrir todos los recordatorios
      this.job = cron.schedule('*/15 * * * *', () => this.runAll());
      securityLogger.info('Cron de recordatorios programado (cada 15 minutos)');
    }
  }

  static stop() {
    this.job?.stop();
  }

  // Método público para pruebas manuales
  static async runManual(reminderKey: ReminderKey) {
    const def = REMINDER_DEFINITIONS.find(item => item.key === reminderKey);
    if (!def) return;
    await this.runForDefinition(def);
  }

  // Forzar recordatorio para una cita específica (fuera de ventana)
  static async runManualForAppointment(appointmentId: string) {
    try {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: {
            select: {
              id: true,
              userId: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
              user: {
                select: {
                  email: true,
                  phone: true
                }
              }
            }
          },
          doctor: {
            select: {
              id: true,
              professionalTitle: true,
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

      if (!appointment) {
        return { sent: false, reason: 'appointment_not_found' };
      }

      const apt = appointment as typeof appointment & {
        patient: { email?: string; phone?: string; userId: string; firstName?: string; lastName?: string; user?: { email?: string; phone?: string } };
        doctor: { professionalTitle?: string; timezone?: string | null; user?: { firstName?: string; lastName?: string } };
      };

      const reminderConfig = await prisma.reminderConfig.findFirst({
        where: { doctorId: appointment.doctorId }
      });

      if (!reminderConfig || (!reminderConfig.useEmail && !reminderConfig.useWhatsApp)) {
        return { sent: false, reason: 'reminders_disabled' };
      }

      const patientEmail = apt.patient.email || apt.patient.user?.email || '';
      const patientPhone = apt.patient.phone || apt.patient.user?.phone || '';
      const patientUserId = apt.patient.userId;

      if (!patientUserId) {
        return { sent: false, reason: 'patient_no_user' };
      }

      if (!patientEmail && !patientPhone) {
        return { sent: false, reason: 'no_recipient' };
      }

      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: patientUserId,
          type: 'APPOINTMENT_REMINDER',
          data: {
            equals: {
              appointmentId: appointment.id,
              reminderKey: 'manual'
            }
          }
        }
      });

      if (existingNotification) {
        return { sent: false, reason: 'already_sent' };
      }

      const doctorName = apt.doctor.user
        ? `${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`
        : apt.doctor.professionalTitle || 'Tu doctor';
      const patientName =
        `${apt.patient.firstName || ''} ${apt.patient.lastName || ''}`.trim() ||
        'Paciente';
      const doctorTimezone = (apt.doctor as { timezone?: string | null }).timezone ?? 'America/Mexico_City';
      const timeStr = formatAppointmentTime(appointment.date, doctorTimezone);

      let emailSent = false;
      let whatsappSent = false;

      if (reminderConfig.useEmail && patientEmail) {
        const emailService = EmailService.getInstance();
        emailSent = await emailService.sendAppointmentReminderEmail(patientEmail, {
          doctorName,
          patientName,
          date: appointment.date,
          time: timeStr,
          reason: appointment.notes || '',
          timezone: doctorTimezone
        });
      }

      if (reminderConfig.useWhatsApp && patientPhone) {
        const whatsappService = WhatsAppService.getInstance();
        whatsappSent = await whatsappService.sendAppointmentConfirmationMessage(patientPhone, {
          doctorName,
          patientName,
          date: appointment.date,
          time: timeStr,
          reason: appointment.notes || '',
          timezone: doctorTimezone
        });
      }

      if (emailSent || whatsappSent) {
        await prisma.notification.create({
          data: {
            userId: patientUserId,
            type: 'APPOINTMENT_REMINDER',
            title: 'Recordatorio de cita (manual)',
            message: `Tienes una cita programada con ${doctorName} el ${formatAppointmentDateShort(appointment.date, doctorTimezone)} a las ${timeStr}.`,
            data: {
              appointmentId: appointment.id,
              reminderKey: 'manual',
              scheduledFor: appointment.date
            }
          }
        });
      }

      return { sent: emailSent || whatsappSent, emailSent, whatsappSent };
    } catch (error) {
      securityLogger.error('Cron manual recordatorio error:', error);
      return { sent: false, reason: 'error' };
    }
  }

  private static async runAll() {
    try {
      for (const def of REMINDER_DEFINITIONS) {
        await this.runForDefinition(def);
      }
    } catch (error) {
      securityLogger.error('Cron recordatorios error:', error);
    }
  }

  private static async runForDefinition(definition: (typeof REMINDER_DEFINITIONS)[number]) {
    try {
      const now = new Date();
      const target = new Date(now.getTime() + definition.hoursBefore * 60 * 60 * 1000);
      // Ventana más amplia para evitar perder recordatorios por desajustes de minutos
      const windowStart = new Date(target.getTime() - 60 * 60 * 1000);
      const windowEnd = new Date(target.getTime() + 60 * 60 * 1000);

      // Obtener configuraciones activas de recordatorios
      const reminderConfigs = await prisma.reminderConfig.findMany({
        include: {
          reminders: true
        }
      });

      const reminderMap = new Map<string, { useEmail: boolean; useWhatsApp: boolean; daysBeforeActive: Set<number> }>();
      for (const config of reminderConfigs) {
        const activeDays = new Set<number>(
          config.reminders.filter(r => r.isActive).map(r => r.daysBefore)
        );
        reminderMap.set(config.doctorId, {
          useEmail: config.useEmail,
          useWhatsApp: config.useWhatsApp,
          daysBeforeActive: activeDays
        });
      }

      const appointments = await prisma.appointment.findMany({
        where: {
          date: {
            gte: windowStart,
            lt: windowEnd
          },
          // Usar confirmationStatus como filtro principal; status es un string libre
          // y puede variar (SCHEDULED/ACTIVE/PENDING/etc).
          confirmationStatus: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] }
        },
        include: {
          patient: {
            select: {
              id: true,
              userId: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
              user: {
                select: {
                  email: true,
                  phone: true
                }
              }
            }
          },
          doctor: {
            select: {
              id: true,
              professionalTitle: true,
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

      let sentCount = 0;
      let skippedNoConfig = 0;
      let skippedInactive = 0;
      let skippedNoChannel = 0;
      let skippedNoRecipient = 0;

      type ApptWithRelations = (typeof appointments)[number] & {
        patient: { email?: string; phone?: string; userId: string; firstName?: string; lastName?: string; user?: { email?: string; phone?: string } };
        doctor: { professionalTitle?: string; timezone?: string | null; user?: { firstName?: string; lastName?: string } };
      };

      for (const appt of appointments) {
        const apt = appt as ApptWithRelations;
        const config = reminderMap.get(appt.doctorId);
        if (!config) {
          skippedNoConfig += 1;
          continue;
        }
        if (!config.daysBeforeActive.has(definition.daysBefore)) {
          skippedInactive += 1;
          continue;
        }
        if (!config.useEmail && !config.useWhatsApp) {
          skippedNoChannel += 1;
          continue;
        }

        const patientEmail = apt.patient.email || apt.patient.user?.email || '';
        const patientPhone = apt.patient.phone || apt.patient.user?.phone || '';
        const patientUserId = apt.patient.userId;

        if (!patientUserId) {
          securityLogger.warn(`Recordatorio omitido: paciente sin userId (appointmentId: ${appt.id})`);
          continue;
        }

        // Evitar duplicados usando notificaciones previas.
        // Usar path para no depender de la serialización exacta del JSON (scheduledFor, etc.).
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: patientUserId,
            type: 'APPOINTMENT_REMINDER',
            AND: [
              { data: { path: ['appointmentId'], equals: appt.id } },
              { data: { path: ['reminderKey'], equals: definition.key } }
            ]
          }
        });

        if (existingNotification) {
          continue;
        }

        const doctorName = apt.doctor.user
          ? `${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`
          : apt.doctor.professionalTitle || 'Tu doctor';
        const patientName = `${apt.patient.firstName || ''} ${apt.patient.lastName || ''}`.trim() || 'Paciente';
        const doctorTimezone = (apt.doctor as { timezone?: string | null }).timezone ?? 'America/Mexico_City';
        const timeStr = formatAppointmentTime(appt.date, doctorTimezone);

        let emailSent = false;
        let whatsappSent = false;

        if (!patientEmail && !patientPhone) {
          skippedNoRecipient += 1;
          continue;
        }

        if (config.useEmail && patientEmail) {
          const emailService = EmailService.getInstance();
          emailSent = await emailService.sendAppointmentReminderEmail(patientEmail, {
            doctorName,
            patientName,
            date: appt.date,
            time: timeStr,
            reason: appt.notes || '',
            reminderLabel: definition.label,
            timezone: doctorTimezone
          });
        }

        if (config.useWhatsApp && patientPhone) {
          const whatsappService = WhatsAppService.getInstance();
          whatsappSent = await whatsappService.sendAppointmentConfirmationMessage(patientPhone, {
            doctorName,
            patientName,
            date: appt.date,
            time: timeStr,
            reason: appt.notes || '',
            timezone: doctorTimezone
          });
        }

        if (emailSent || whatsappSent) {
          await prisma.notification.create({
            data: {
              userId: patientUserId,
              type: 'APPOINTMENT_REMINDER',
              title: `Recordatorio de cita (${definition.label})`,
              message: `Tienes una cita programada con ${doctorName} el ${formatAppointmentDateShort(appt.date, doctorTimezone)} a las ${timeStr}.`,
              data: {
                appointmentId: appt.id,
                reminderKey: definition.key,
                scheduledFor: appt.date
              }
            }
          });
          sentCount += 1;
        }
      }

      securityLogger.info(
        `Cron ${definition.label}: enviados ${sentCount}, sin config ${skippedNoConfig}, ` +
        `inactivos ${skippedInactive}, sin canal ${skippedNoChannel}, sin receptor ${skippedNoRecipient}`
      );
    } catch (error) {
      securityLogger.error(`Cron ${definition.label} error:`, error);
    }
  }
}

export default AppointmentReminderCron;

