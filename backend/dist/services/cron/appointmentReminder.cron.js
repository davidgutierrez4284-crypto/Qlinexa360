"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentReminderCron = void 0;
const cron = __importStar(require("node-cron"));
const client_1 = require("@prisma/client");
const notification_service_1 = require("../notification.service");
const logger_utils_1 = require("../../utils/logger.utils");
const date_utils_1 = require("../../utils/date.utils");
const prisma = new client_1.PrismaClient();
const REMINDER_DEFINITIONS = [
    { key: '1w', label: '1 semana', hoursBefore: 24 * 7, daysBefore: 7 },
    { key: '48h', label: '48 horas', hoursBefore: 48, daysBefore: 2 },
    { key: '24h', label: '24 horas', hoursBefore: 24, daysBefore: 1 },
    { key: '4h', label: '4 horas', hoursBefore: 4, daysBefore: 0 }
];
class AppointmentReminderCron {
    static start() {
        if (!this.job) {
            // Corre cada 15 minutos para cubrir todos los recordatorios
            this.job = cron.schedule('*/15 * * * *', () => this.runAll());
            logger_utils_1.securityLogger.info('Cron de recordatorios programado (cada 15 minutos)');
        }
    }
    static stop() {
        var _a;
        (_a = this.job) === null || _a === void 0 ? void 0 : _a.stop();
    }
    // Método público para pruebas manuales
    static async runManual(reminderKey) {
        const def = REMINDER_DEFINITIONS.find(item => item.key === reminderKey);
        if (!def)
            return;
        await this.runForDefinition(def);
    }
    // Forzar recordatorio para una cita específica (fuera de ventana)
    static async runManualForAppointment(appointmentId) {
        var _a, _b, _c;
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
            const apt = appointment;
            const reminderConfig = await prisma.reminderConfig.findFirst({
                where: { doctorId: appointment.doctorId }
            });
            if (!reminderConfig || (!reminderConfig.useEmail && !reminderConfig.useWhatsApp)) {
                return { sent: false, reason: 'reminders_disabled' };
            }
            const patientEmail = apt.patient.email || ((_a = apt.patient.user) === null || _a === void 0 ? void 0 : _a.email) || '';
            const patientPhone = apt.patient.phone || ((_b = apt.patient.user) === null || _b === void 0 ? void 0 : _b.phone) || '';
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
            const patientName = `${apt.patient.firstName || ''} ${apt.patient.lastName || ''}`.trim() ||
                'Paciente';
            const doctorTimezone = (_c = apt.doctor.timezone) !== null && _c !== void 0 ? _c : 'America/Mexico_City';
            const timeStr = (0, date_utils_1.formatAppointmentTime)(appointment.date, doctorTimezone);
            let emailSent = false;
            let whatsappSent = false;
            if (reminderConfig.useEmail && patientEmail) {
                const emailService = notification_service_1.EmailService.getInstance();
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
                const whatsappService = notification_service_1.WhatsAppService.getInstance();
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
                        message: `Tienes una cita programada con ${doctorName} el ${(0, date_utils_1.formatAppointmentDateShort)(appointment.date, doctorTimezone)} a las ${timeStr}.`,
                        data: {
                            appointmentId: appointment.id,
                            reminderKey: 'manual',
                            scheduledFor: appointment.date
                        }
                    }
                });
            }
            return { sent: emailSent || whatsappSent, emailSent, whatsappSent };
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Cron manual recordatorio error:', error);
            return { sent: false, reason: 'error' };
        }
    }
    static async runAll() {
        try {
            for (const def of REMINDER_DEFINITIONS) {
                await this.runForDefinition(def);
            }
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Cron recordatorios error:', error);
        }
    }
    static async runForDefinition(definition) {
        var _a, _b, _c;
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
            const reminderMap = new Map();
            for (const config of reminderConfigs) {
                const activeDays = new Set(config.reminders.filter(r => r.isActive).map(r => r.daysBefore));
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
            for (const appt of appointments) {
                const apt = appt;
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
                const patientEmail = apt.patient.email || ((_a = apt.patient.user) === null || _a === void 0 ? void 0 : _a.email) || '';
                const patientPhone = apt.patient.phone || ((_b = apt.patient.user) === null || _b === void 0 ? void 0 : _b.phone) || '';
                const patientUserId = apt.patient.userId;
                if (!patientUserId) {
                    logger_utils_1.securityLogger.warn(`Recordatorio omitido: paciente sin userId (appointmentId: ${appt.id})`);
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
                const doctorTimezone = (_c = apt.doctor.timezone) !== null && _c !== void 0 ? _c : 'America/Mexico_City';
                const timeStr = (0, date_utils_1.formatAppointmentTime)(appt.date, doctorTimezone);
                let emailSent = false;
                let whatsappSent = false;
                if (!patientEmail && !patientPhone) {
                    skippedNoRecipient += 1;
                    continue;
                }
                if (config.useEmail && patientEmail) {
                    const emailService = notification_service_1.EmailService.getInstance();
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
                    const whatsappService = notification_service_1.WhatsAppService.getInstance();
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
                            message: `Tienes una cita programada con ${doctorName} el ${(0, date_utils_1.formatAppointmentDateShort)(appt.date, doctorTimezone)} a las ${timeStr}.`,
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
            logger_utils_1.securityLogger.info(`Cron ${definition.label}: enviados ${sentCount}, sin config ${skippedNoConfig}, ` +
                `inactivos ${skippedInactive}, sin canal ${skippedNoChannel}, sin receptor ${skippedNoRecipient}`);
        }
        catch (error) {
            logger_utils_1.securityLogger.error(`Cron ${definition.label} error:`, error);
        }
    }
}
exports.AppointmentReminderCron = AppointmentReminderCron;
AppointmentReminderCron.job = null;
exports.default = AppointmentReminderCron;
