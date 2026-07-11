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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentConfirmationController = void 0;
const client_1 = require("@prisma/client");
const date_utils_1 = require("../utils/date.utils");
const logger_utils_1 = require("../utils/logger.utils");
const notification_service_1 = require("../services/notification.service");
const schedule_service_1 = require("../services/schedule.service");
const googleCalendarSync_service_1 = require("../services/googleCalendarSync.service");
const outlookCalendarSync_service_1 = require("../services/outlookCalendarSync.service");
const appleCalendarSync_service_1 = require("../services/appleCalendarSync.service");
const notification_service_2 = require("../services/notification.service");
const calendarSync_utils_1 = require("../utils/calendarSync.utils");
const mercadopago_teleconsultation_service_1 = require("../payments/mercadopago/mercadopago.teleconsultation.service");
const mercadopago_inperson_service_1 = require("../payments/mercadopago/mercadopago.inperson.service");
const mercadopago_config_1 = require("../payments/mercadopago/mercadopago.config");
const mercadopago_preference_service_1 = require("../payments/mercadopago/mercadopago.preference.service");
const mercadopago_refund_service_1 = require("../payments/mercadopago/mercadopago.refund.service");
const mercadopago_teleconsultation_service_2 = require("../payments/mercadopago/mercadopago.teleconsultation.service");
const appointmentConfirmation_utils_1 = require("../utils/appointmentConfirmation.utils");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
/** Resuelve el doctor para DOCTOR (por userId) o ASISTENTE (por X-Selected-Doctor-Id) */
async function resolveDoctorForRequest(req) {
    var _a;
    if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId))
        return null;
    if (req.user.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.userId },
            select: { id: true, userId: true, timezone: true, professionalTitle: true, specialization: true }
        });
        return doctor;
    }
    if (req.user.role === 'ASISTENTE') {
        const selectedDoctorId = req.headers['x-selected-doctor-id'];
        if (!selectedDoctorId || Array.isArray(selectedDoctorId))
            return null;
        const link = await prisma.asistenteDoctorVinculo.findFirst({
            where: {
                doctorId: selectedDoctorId,
                asistenteId: req.user.userId,
                activo: true
            }
        });
        if (!link)
            return null;
        const doctor = await prisma.doctor.findUnique({
            where: { id: selectedDoctorId },
            select: { id: true, userId: true, timezone: true, professionalTitle: true, specialization: true }
        });
        return doctor;
    }
    return null;
}
class AppointmentConfirmationController {
    /**
     * Duración de la cita en ms: si ya existe evento interno, respeta fin − inicio (p. ej. 1 h convocada en calendario).
     * Si no hay evento o la duración no es razonable, usa appointmentDuration de la agenda del doctor (por defecto 30 min).
     */
    static resolveAppointmentDurationMs(calendarEvent, scheduleConfig) {
        var _a;
        const cfgMin = (_a = scheduleConfig === null || scheduleConfig === void 0 ? void 0 : scheduleConfig.appointmentDuration) !== null && _a !== void 0 ? _a : 30;
        const clampedMin = Math.max(15, Math.min(480, cfgMin));
        const fallback = clampedMin * 60000;
        if (!(calendarEvent === null || calendarEvent === void 0 ? void 0 : calendarEvent.fechaHoraFin) || !(calendarEvent === null || calendarEvent === void 0 ? void 0 : calendarEvent.fechaHoraInicio))
            return fallback;
        const d = calendarEvent.fechaHoraFin.getTime() - calendarEvent.fechaHoraInicio.getTime();
        if (d >= 15 * 60000 && d <= 8 * 60 * 60 * 1000)
            return d;
        return fallback;
    }
    // Obtener datos de cita por token (público)
    static async getAppointmentByToken(req, res) {
        var _a, _b, _c, _d, _e, _f, _g;
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
            try {
                await (0, appointmentConfirmation_utils_1.ensureActiveConfirmationRequest)(confirmationRequest);
            }
            catch (tokenErr) {
                return res.status(tokenErr.statusCode || 400).json({
                    error: tokenErr.message || 'Token de confirmación expirado',
                });
            }
            const appointment = confirmationRequest.appointment;
            const patientName = {
                firstName: appointment.patient.firstName || ((_a = appointment.patient.user) === null || _a === void 0 ? void 0 : _a.firstName) || '',
                lastName: appointment.patient.lastName || ((_b = appointment.patient.user) === null || _b === void 0 ? void 0 : _b.lastName) || ''
            };
            const doctorName = {
                firstName: ((_c = appointment.doctor.user) === null || _c === void 0 ? void 0 : _c.firstName) || '',
                lastName: ((_d = appointment.doctor.user) === null || _d === void 0 ? void 0 : _d.lastName) || '',
                professionalTitle: appointment.doctor.professionalTitle || ''
            };
            const doctorTimezone = (_f = (_e = appointment.doctor) === null || _e === void 0 ? void 0 : _e.timezone) !== null && _f !== void 0 ? _f : 'America/Mexico_City';
            const displayDate = (0, date_utils_1.formatAppointmentDate)(appointment.date, doctorTimezone);
            const displayTime = (0, date_utils_1.formatAppointmentTime)(appointment.date, doctorTimezone);
            let inPersonPaymentOffered = false;
            let inPersonPaymentStatus = 'not_required';
            let inPersonPaymentAmount = 0;
            let inPersonPaymentCurrency = 'MXN';
            let inPersonCheckoutUrl = null;
            if (appointment.appointmentType === 'presencial') {
                const inPersonCtx = await (0, mercadopago_inperson_service_1.getInPersonPaymentContext)(appointment.doctorId, appointment.id);
                inPersonPaymentOffered = inPersonCtx.paymentOffered;
                inPersonPaymentStatus = inPersonCtx.paymentStatus;
                inPersonPaymentAmount = inPersonCtx.amount;
                inPersonPaymentCurrency = inPersonCtx.currency;
                if (inPersonCtx.paymentOffered && inPersonCtx.paymentStatus === 'pending') {
                    try {
                        inPersonCheckoutUrl =
                            inPersonCtx.checkoutUrl ||
                                (await (0, mercadopago_inperson_service_1.ensureInPersonCheckoutUrl)(appointment.id, token));
                    }
                    catch (_h) {
                        inPersonCheckoutUrl = inPersonCtx.checkoutUrl;
                    }
                }
            }
            const mpSettings = await (0, mercadopago_teleconsultation_service_2.getDoctorMercadoPagoSettings)(appointment.doctorId);
            const refundCtx = await (0, mercadopago_refund_service_1.getRefundContextForAppointment)(appointment.id);
            const paymentApprovedForRefund = appointment.appointmentType === 'presencial'
                ? inPersonPaymentStatus === 'approved'
                : appointment.appointmentType === 'teleconsulta'
                    ? await (0, mercadopago_preference_service_1.isTeleconsultationPaymentApproved)(appointment.id)
                    : false;
            res.json({
                success: true,
                data: {
                    appointmentId: appointment.id,
                    date: appointment.date,
                    displayDate,
                    displayTime,
                    patient: patientName,
                    doctor: doctorName,
                    confirmationStatus: appointment.confirmationStatus,
                    appointmentType: appointment.appointmentType,
                    inPersonPaymentOffered,
                    inPersonPaymentStatus,
                    inPersonPaymentAmount,
                    inPersonPaymentCurrency,
                    inPersonCheckoutUrl,
                    refundPolicyText: (_g = mpSettings === null || mpSettings === void 0 ? void 0 : mpSettings.refundPolicyText) !== null && _g !== void 0 ? _g : null,
                    canRequestRefund: paymentApprovedForRefund && refundCtx.canRequestRefund,
                    refundableAmount: refundCtx.refundableAmount,
                    refundRequest: refundCtx.refundRequest,
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener cita por token:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    static async getOrCreateManageLink(appointmentId) {
        return (0, appointmentConfirmation_utils_1.getOrCreateAppointmentManageLink)(appointmentId);
    }
    // Obtener estado de confirmaciones para un doctor
    static async getConfirmationStatus(req, res) {
        try {
            const doctor = await resolveDoctorForRequest(req);
            if (!doctor) {
                return res.status(req.user ? 404 : 401).json({ error: req.user ? 'Perfil de doctor no encontrado. Si eres asistente, selecciona un doctor.' : 'No autorizado' });
            }
            const doctorId = doctor.id;
            const { date } = req.query;
            const whereClause = { doctorId };
            if (date) {
                const startDate = new Date(date);
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
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener estado de confirmaciones:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Crear solicitud de confirmación para una cita
    static async createConfirmationRequest(req, res) {
        var _a;
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
            const confirmationToken = crypto_1.default.randomBytes(32).toString('hex');
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
            await notification_service_1.NotificationService.sendAppointmentConfirmationEmail(confirmationRequest.appointment.patient.user.email, confirmationRequest.appointment.patient.user.firstName, confirmationRequest.appointment.patient.user.lastName, confirmationRequest.appointment.date, confirmationRequest.appointment.doctor.user.firstName, confirmationRequest.appointment.doctor.user.lastName, confirmationRequest.confirmationToken, reminderType, (_a = confirmationRequest.appointment.doctor.timezone) !== null && _a !== void 0 ? _a : 'America/Mexico_City');
            res.json({
                success: true,
                data: confirmationRequest
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al crear solicitud de confirmación:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Confirmar cita por parte del paciente
    static async confirmAppointment(req, res) {
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
            try {
                await (0, appointmentConfirmation_utils_1.ensureActiveConfirmationRequest)(confirmationRequest);
            }
            catch (tokenErr) {
                return res.status(tokenErr.statusCode || 400).json({
                    error: tokenErr.message || 'Token de confirmación expirado',
                });
            }
            if (confirmationRequest.appointment.status === 'CANCELLED' ||
                confirmationRequest.appointment.confirmationStatus === 'CANCELLED') {
                return res.status(400).json({ error: 'Esta cita ya fue cancelada' });
            }
            // Actualizar estado de la cita
            await prisma.appointment.update({
                where: { id: confirmationRequest.appointmentId },
                data: {
                    status: 'SCHEDULED',
                    confirmationStatus: 'CONFIRMED',
                    confirmedAt: new Date(),
                    cancelledAt: null,
                    cancellationReason: null
                }
            });
            // Sincronizar evento interno/externo para reflejar la cita confirmada
            await AppointmentConfirmationController.syncAppointmentCalendars(confirmationRequest.appointmentId, { responseStatus: 'accepted', notifyAttendees: true });
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
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al confirmar cita:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Cancelar cita por parte del paciente
    static async cancelAppointment(req, res) {
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
            try {
                await (0, appointmentConfirmation_utils_1.ensureActiveConfirmationRequest)(confirmationRequest);
            }
            catch (tokenErr) {
                return res.status(tokenErr.statusCode || 400).json({
                    error: tokenErr.message || 'Token de confirmación expirado',
                });
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
            await AppointmentConfirmationController.syncAppointmentCalendars(confirmationRequest.appointmentId, { cancelExternal: true, responseStatus: 'declined' });
            // Notificar al doctor sobre la cancelación
            // TODO: Implementar notificación al doctor
            res.json({
                success: true,
                message: 'Cita cancelada exitosamente'
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al cancelar cita:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Obtener horarios disponibles para reprogramación (público, basado en token)
    static async getAvailableRescheduleSlots(req, res) {
        var _a;
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
            try {
                await (0, appointmentConfirmation_utils_1.ensureActiveConfirmationRequest)(confirmationRequest);
            }
            catch (tokenErr) {
                return res.status(tokenErr.statusCode || 400).json({
                    error: tokenErr.message || 'Token de confirmación expirado',
                });
            }
            const doctorId = confirmationRequest.appointment.doctorId;
            const doctorTimezone = ((_a = confirmationRequest.appointment.doctor) === null || _a === void 0 ? void 0 : _a.timezone) || 'America/Mexico_City';
            if (!date) {
                return res.status(400).json({ error: 'Debes indicar una fecha (YYYY-MM-DD)' });
            }
            const slots = await schedule_service_1.ScheduleService.getBookableSlotsForDate(doctorId, date, {
                excludeAppointmentId: confirmationRequest.appointmentId,
                timezone: doctorTimezone
            });
            res.json({
                success: true,
                data: slots,
                message: slots.length === 0
                    ? 'No hay horarios disponibles para esta fecha según la agenda compartida del doctor'
                    : undefined
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener horarios disponibles para reprogramación:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Solicitar reprogramación de cita
    static async requestReschedule(req, res) {
        var _a;
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
            try {
                await (0, appointmentConfirmation_utils_1.ensureActiveConfirmationRequest)(confirmationRequest);
            }
            catch (tokenErr) {
                return res.status(tokenErr.statusCode || 400).json({
                    error: tokenErr.message || 'Token de confirmación expirado',
                });
            }
            const doctorId = confirmationRequest.appointment.doctorId;
            const doctor = await prisma.doctor.findUnique({
                where: { id: doctorId },
                select: { timezone: true }
            });
            const doctorTimezone = (doctor === null || doctor === void 0 ? void 0 : doctor.timezone) || 'America/Mexico_City';
            // Validar que se proporcione fecha y hora
            if (!preferredDate || !preferredTime) {
                return res.status(400).json({ error: 'Debes proporcionar fecha y hora para la reprogramación' });
            }
            // Construir datetime en zona horaria del doctor (ISO desde frontend o HH:mm)
            let requestedDateTime;
            const timeStr = String(preferredTime).trim();
            if (timeStr.includes('T')) {
                requestedDateTime = new Date(timeStr);
            }
            else {
                const [year, month, day] = String(preferredDate).split('-').map(Number);
                const [hour, minute] = timeStr.slice(0, 5).split(':').map(Number);
                requestedDateTime = (0, date_utils_1.createDateInTimezone)(year, month - 1, day, hour, minute, doctorTimezone);
            }
            // Validar que la fecha no sea en el pasado
            if (requestedDateTime < new Date()) {
                return res.status(400).json({ error: 'No puedes reprogramar a una fecha/hora en el pasado' });
            }
            const hour = requestedDateTime.getHours();
            const preferredTimeSlot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
            const existingEntry = await prisma.waitlistEntry.findFirst({
                where: {
                    appointmentId: confirmationRequest.appointmentId,
                    status: 'ACTIVE'
                }
            });
            // Verificar disponibilidad en agenda compartida del doctor
            const slotBookable = await schedule_service_1.ScheduleService.isSlotBookable(doctorId, requestedDateTime, {
                excludeAppointmentId: confirmationRequest.appointmentId,
                timezone: doctorTimezone
            });
            const scheduleConfig = await schedule_service_1.ScheduleService.getScheduleConfig(doctorId);
            const appointmentDuration = (scheduleConfig === null || scheduleConfig === void 0 ? void 0 : scheduleConfig.appointmentDuration) || 30;
            const slotEnd = new Date(requestedDateTime.getTime() + appointmentDuration * 60000);
            if (!slotBookable) {
                // Si no hay disponibilidad, crear/actualizar entrada en lista de espera
                let waitlistEntryId;
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
                }
                else {
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
                    waitlisted: true,
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
                    date: requestedDateTime,
                    status: 'SCHEDULED',
                    confirmationStatus: 'RESCHEDULED',
                    rescheduledFrom: confirmationRequest.appointment.date,
                    rescheduledTo: requestedDateTime,
                    cancelledAt: null,
                    cancellationReason: null
                }
            });
            await (0, appointmentConfirmation_utils_1.refreshConfirmationTokenExpiryForAppointment)(confirmationRequest.appointmentId);
            // Sincronizar el evento interno/externo con la nueva fecha
            await AppointmentConfirmationController.syncAppointmentCalendars(confirmationRequest.appointmentId, { notifyAttendees: true });
            const refreshedAppointment = await prisma.appointment.findUnique({
                where: { id: confirmationRequest.appointmentId },
                include: {
                    patient: { include: { user: true } },
                    doctor: { include: { user: true } }
                }
            });
            if (refreshedAppointment) {
                const patientEmail = refreshedAppointment.patient.email || ((_a = refreshedAppointment.patient.user) === null || _a === void 0 ? void 0 : _a.email) || '';
                if (patientEmail) {
                    try {
                        const emailService = notification_service_2.EmailService.getInstance();
                        const manageLink = await AppointmentConfirmationController.getOrCreateManageLink(refreshedAppointment.id);
                        const scheduleConfig = await schedule_service_1.ScheduleService.getScheduleConfig(refreshedAppointment.doctorId);
                        const calEvent = await prisma.internalCalendarEvent.findFirst({
                            where: {
                                doctorId: refreshedAppointment.doctorId,
                                patientId: refreshedAppointment.patientId,
                                fechaHoraInicio: {
                                    gte: new Date(refreshedAppointment.date.getTime() - 30 * 60000),
                                    lte: new Date(refreshedAppointment.date.getTime() + 30 * 60000)
                                }
                            }
                        });
                        const durationMs = AppointmentConfirmationController.resolveAppointmentDurationMs(calEvent, scheduleConfig);
                        const eventEnd = new Date(refreshedAppointment.date.getTime() + durationMs);
                        const patientName = `${refreshedAppointment.patient.firstName || ''} ${refreshedAppointment.patient.lastName || ''}`.trim() ||
                            'Paciente';
                        const doctorName = refreshedAppointment.doctor.user
                            ? `${refreshedAppointment.doctor.professionalTitle || ''} ${refreshedAppointment.doctor.user.firstName} ${refreshedAppointment.doctor.user.lastName}`.trim()
                            : refreshedAppointment.doctor.professionalTitle || 'Profesional';
                        await emailService.sendCalendarEventEmail(patientEmail, {
                            patientName,
                            doctorName,
                            eventTitle: `${patientName} consulta`,
                            eventDate: refreshedAppointment.date,
                            eventEndDate: eventEnd,
                            description: 'Tu cita fue reprogramada. Guarda este correo o revisa Mis citas en Qlinexa360.',
                            manageLink,
                            linkMeeting: (calEvent === null || calEvent === void 0 ? void 0 : calEvent.linkMeeting) || undefined,
                            tipoCita: refreshedAppointment.appointmentType === 'teleconsulta' ? 'remota' : 'presencial',
                            timezone: doctorTimezone
                        });
                    }
                    catch (notifyErr) {
                        console.error('Error enviando confirmación de reprogramación al paciente:', notifyErr);
                    }
                }
            }
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
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al solicitar reprogramación:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Obtener lista de espera de un doctor
    static async getWaitlist(req, res) {
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
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener lista de espera:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Obtener cancelaciones para un doctor
    static async getCancellations(req, res) {
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
                data: cancellations.map(appointment => {
                    var _a, _b, _c, _d;
                    return ({
                        id: appointment.id,
                        patientName: `${appointment.patient.firstName || ((_a = appointment.patient.user) === null || _a === void 0 ? void 0 : _a.firstName) || ''} ${appointment.patient.lastName || ((_b = appointment.patient.user) === null || _b === void 0 ? void 0 : _b.lastName) || ''}`.trim() || 'Paciente',
                        patientEmail: appointment.patient.email || ((_c = appointment.patient.user) === null || _c === void 0 ? void 0 : _c.email) || '',
                        patientPhone: appointment.patient.phone || ((_d = appointment.patient.user) === null || _d === void 0 ? void 0 : _d.phone) || '',
                        appointmentDate: appointment.date,
                        originalDate: appointment.rescheduledFrom || appointment.date,
                        cancellationDate: appointment.cancelledAt || appointment.updatedAt,
                        reason: appointment.cancellationReason || 'Sin motivo',
                        cancelledBy: 'patient',
                        status: 'cancelled',
                        notes: appointment.notes || ''
                    });
                })
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener cancelaciones:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Obtener solicitudes de reprogramación (lista de espera) para un doctor
    static async getRescheduleRequests(req, res) {
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
                data: waitlistEntries.map(entry => {
                    var _a, _b, _c, _d, _e;
                    return ({
                        id: entry.id,
                        patientName: `${entry.patient.firstName || ((_a = entry.patient.user) === null || _a === void 0 ? void 0 : _a.firstName) || ''} ${entry.patient.lastName || ((_b = entry.patient.user) === null || _b === void 0 ? void 0 : _b.lastName) || ''}`.trim() || 'Paciente',
                        patientEmail: entry.patient.email || ((_c = entry.patient.user) === null || _c === void 0 ? void 0 : _c.email) || '',
                        patientPhone: entry.patient.phone || ((_d = entry.patient.user) === null || _d === void 0 ? void 0 : _d.phone) || '',
                        originalDate: ((_e = entry.appointment) === null || _e === void 0 ? void 0 : _e.date) || null,
                        requestedDate: entry.preferredDate,
                        reason: entry.notes || '',
                        status: entry.status === 'ASSIGNED' ? 'approved' : 'pending',
                        notes: entry.notes || ''
                    });
                })
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener reprogramaciones:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    /** Sincroniza evento interno y calendario externo (Meet/Teams) y registro Teleconsultation. Público para reutilizar tras firmar consentimiento. */
    static async sendPatientTeleconsultationCalendarEmail(appointmentId) {
        var _a;
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { patient: { include: { user: true } }, doctor: { include: { user: true } } },
        });
        if (!appointment || appointment.appointmentType !== 'teleconsulta')
            return;
        if (appointment.status === 'CANCELLED' || appointment.confirmationStatus === 'CANCELLED')
            return;
        const patientEmail = appointment.patient.email || ((_a = appointment.patient.user) === null || _a === void 0 ? void 0 : _a.email) || '';
        if (!patientEmail)
            return;
        const teleconsultation = await prisma.teleconsultation.findUnique({
            where: { appointmentId },
            select: { id: true, consentSigned: true, meetingUrl: true },
        });
        if (teleconsultation === null || teleconsultation === void 0 ? void 0 : teleconsultation.id) {
            const recentEmail = await prisma.teleconsultationAuditLog.findFirst({
                where: {
                    teleconsultationId: teleconsultation.id,
                    action: 'CALENDAR_EMAIL_SENT',
                    createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
                },
            });
            if (recentEmail) {
                console.log(`⏭️ Correo de calendario omitido (duplicado reciente) para cita ${appointmentId}`);
                return;
            }
        }
        let calendarEvent = await prisma.internalCalendarEvent.findUnique({ where: { appointmentId } });
        if (!calendarEvent) {
            await AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
                responseStatus: 'accepted',
                notifyAttendees: false,
            });
            calendarEvent = await prisma.internalCalendarEvent.findUnique({ where: { appointmentId } });
        }
        if (!calendarEvent)
            return;
        const { buildAppointmentCalendarEmailPayload } = await Promise.resolve().then(() => __importStar(require('../utils/appointmentConfirmation.utils')));
        const emailPayload = await buildAppointmentCalendarEmailPayload({
            doctorId: appointment.doctorId,
            appointmentId: appointment.id,
            doctorTimezone: appointment.doctor.timezone,
            eventTitle: calendarEvent.titulo,
            eventDate: calendarEvent.fechaHoraInicio,
            eventEndDate: calendarEvent.fechaHoraFin,
            description: calendarEvent.descripcion,
            linkMeeting: calendarEvent.linkMeeting,
            eventId: calendarEvent.id,
        });
        await notification_service_2.EmailService.getInstance().sendCalendarEventEmail(patientEmail, Object.assign(Object.assign({ patientName: `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim() || 'Paciente', doctorName: appointment.doctor.user
                ? `${appointment.doctor.professionalTitle || ''} ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`.trim()
                : appointment.doctor.professionalTitle || 'Profesional' }, emailPayload), { appointmentId: appointment.id, calendarInviteExpected: true }));
        if (teleconsultation === null || teleconsultation === void 0 ? void 0 : teleconsultation.id) {
            await prisma.teleconsultationAuditLog.create({
                data: {
                    teleconsultationId: teleconsultation.id,
                    action: 'CALENDAR_EMAIL_SENT',
                    metadata: { appointmentId },
                },
            });
        }
    }
    static async syncAppointmentCalendars(appointmentId, options = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: {
                patient: { include: { user: true } },
                doctor: { include: { user: true } }
            }
        });
        if (!appointment)
            return;
        if (!options.cancelExternal &&
            (appointment.status === 'CANCELLED' || appointment.confirmationStatus === 'CANCELLED')) {
            return;
        }
        const scheduleConfig = await schedule_service_1.ScheduleService.getScheduleConfig(appointment.doctorId);
        const teleconsultationRow = await prisma.teleconsultation.findUnique({
            where: { appointmentId: appointment.id },
            select: { consentSigned: true }
        });
        const paymentReq = await (0, mercadopago_teleconsultation_service_1.requiresTeleconsultationPayment)(appointment.doctorId, appointment.id);
        const paymentApproved = paymentReq.required
            ? await (0, mercadopago_preference_service_1.isTeleconsultationPaymentApproved)(appointment.id)
            : true;
        const allowVideoConference = (0, calendarSync_utils_1.shouldAllowVideoConferenceForAppointment)(appointment.appointmentType, teleconsultationRow === null || teleconsultationRow === void 0 ? void 0 : teleconsultationRow.consentSigned, paymentReq.required, paymentApproved);
        const fallbackDate = appointment.rescheduledFrom || appointment.date;
        // 1) Emparejamiento exacto por el vínculo duro cita↔evento (evita colisiones por heurística)
        let calendarEvent = await prisma.internalCalendarEvent.findUnique({
            where: { appointmentId: appointment.id }
        });
        // 2) Fallback por ventana de tiempo SOLO sobre eventos no reclamados por otra cita
        //    (appointmentId: null), para no "robar" el evento de otra cita del mismo paciente.
        if (!calendarEvent) {
            calendarEvent = await prisma.internalCalendarEvent.findFirst({
                where: {
                    doctorId: appointment.doctorId,
                    patientId: appointment.patientId,
                    appointmentId: null,
                    fechaHoraInicio: {
                        gte: new Date(fallbackDate.getTime() - 30 * 60000),
                        lte: new Date(fallbackDate.getTime() + 30 * 60000)
                    }
                }
            });
        }
        // Si no se encontró por fecha anterior (rescheduledFrom), intentar por la fecha actual
        if (!calendarEvent) {
            calendarEvent = await prisma.internalCalendarEvent.findFirst({
                where: {
                    doctorId: appointment.doctorId,
                    patientId: appointment.patientId,
                    appointmentId: null,
                    fechaHoraInicio: {
                        gte: new Date(appointment.date.getTime() - 30 * 60000),
                        lte: new Date(appointment.date.getTime() + 30 * 60000)
                    }
                }
            });
        }
        const durationMs = AppointmentConfirmationController.resolveAppointmentDurationMs(calendarEvent, scheduleConfig);
        const appointmentEnd = new Date(appointment.date.getTime() + durationMs);
        const patientEmail = appointment.patient.email || ((_a = appointment.patient.user) === null || _a === void 0 ? void 0 : _a.email) || '';
        const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim() || 'Paciente';
        const doctorName = appointment.doctor.user
            ? `${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`.trim()
            : appointment.doctor.professionalTitle || '';
        const manageLink = await AppointmentConfirmationController.getOrCreateManageLink(appointment.id);
        const cleanNotes = (0, appointmentConfirmation_utils_1.stripManageLinkBlocksFromDescription)(appointment.notes);
        const eventTitle = `${patientName} consulta`;
        const eventDescription = (0, appointmentConfirmation_utils_1.buildCleanEventDescriptionForSync)(`Cita con ${appointment.doctor.professionalTitle || ''} ${doctorName}${cleanNotes ? `\n\n${cleanNotes}` : ''}`, manageLink);
        if (!calendarEvent) {
            calendarEvent = await prisma.internalCalendarEvent.create({
                data: {
                    doctorId: appointment.doctorId,
                    patientId: appointment.patientId,
                    appointmentId: appointment.id, // Vínculo duro cita↔evento
                    fechaHoraInicio: appointment.date,
                    fechaHoraFin: appointmentEnd,
                    titulo: eventTitle,
                    descripcion: eventDescription,
                    origenEvento: 'interno',
                    creadoPor: appointment.doctorId
                }
            });
        }
        else {
            calendarEvent = await prisma.internalCalendarEvent.update({
                where: { id: calendarEvent.id },
                data: {
                    appointmentId: appointment.id, // Reclamar el vínculo si vino del fallback por tiempo
                    fechaHoraInicio: appointment.date,
                    fechaHoraFin: appointmentEnd,
                    titulo: calendarEvent.titulo || eventTitle,
                    descripcion: eventDescription,
                },
            });
        }
        const attendees = patientEmail ? [patientEmail] : [];
        let syncProvider = calendarEvent.externalProvider;
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
            if (hasGoogleCalendar)
                syncProvider = 'google';
            else if (hasOutlookCalendar)
                syncProvider = 'outlook';
            else if (hasAppleCalendar)
                syncProvider = 'apple';
        }
        let conferenceLink = null;
        let syncOutcome;
        if (syncProvider === 'google' && hasGoogleCalendar) {
            try {
                if (options.cancelExternal && calendarEvent.externalEventId) {
                    await googleCalendarSync_service_1.GoogleCalendarSyncService.deleteEvent(appointment.doctorId, calendarEvent.externalEventId);
                    await prisma.internalCalendarEvent.update({
                        where: { id: calendarEvent.id },
                        data: {
                            externalProvider: null,
                            externalEventId: null,
                            externalUpdatedAt: null,
                            linkMeeting: null
                        }
                    });
                    return { provider: 'google', success: true, patientInviteSent: false };
                }
                const sendUpdates = (0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
                    externalEventId: calendarEvent.externalEventId,
                    attendeeCount: attendees.length,
                    notifyAttendees: options.notifyAttendees,
                    responseStatus: options.responseStatus,
                });
                const syncResult = await googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent(appointment.doctorId, {
                    id: calendarEvent.id,
                    title: calendarEvent.titulo,
                    description: calendarEvent.descripcion,
                    start: calendarEvent.fechaHoraInicio,
                    end: calendarEvent.fechaHoraFin,
                    attendees,
                    externalEventId: (_b = calendarEvent.externalEventId) !== null && _b !== void 0 ? _b : undefined,
                    conferenceType: allowVideoConference ? 'google-meet' : null,
                    conferenceLink: allowVideoConference ? ((_c = calendarEvent.linkMeeting) !== null && _c !== void 0 ? _c : undefined) : undefined,
                    googleMeetEnabled: allowVideoConference,
                    disableConference: !allowVideoConference,
                    attendeesResponseStatus: options.responseStatus,
                    sendUpdates,
                });
                if (syncResult) {
                    conferenceLink = allowVideoConference ? ((_d = syncResult.conferenceLink) !== null && _d !== void 0 ? _d : null) : null;
                    await prisma.internalCalendarEvent.update({
                        where: { id: calendarEvent.id },
                        data: {
                            externalProvider: 'google',
                            externalEventId: (_e = syncResult.externalEventId) !== null && _e !== void 0 ? _e : null,
                            externalUpdatedAt: (_f = syncResult.externalUpdatedAt) !== null && _f !== void 0 ? _f : null,
                            linkMeeting: allowVideoConference ? conferenceLink : null
                        }
                    });
                    syncOutcome = {
                        provider: 'google',
                        success: true,
                        patientInviteSent: sendUpdates === 'all' && attendees.length > 0,
                    };
                }
                else {
                    const errMsg = 'Google Calendar no respondió al sincronizar la cita. El paciente podría no recibir la invitación.';
                    await (0, calendarSync_utils_1.recordCalendarProviderSyncError)(appointment.doctorId, 'google', errMsg);
                    syncOutcome = { provider: 'google', success: false, patientInviteSent: false, error: errMsg };
                }
            }
            catch (syncError) {
                const errMsg = (syncError === null || syncError === void 0 ? void 0 : syncError.message) || 'Error desconocido al sincronizar con Google Calendar';
                console.error('Error sincronizando con Google Calendar:', syncError);
                syncOutcome = { provider: 'google', success: false, patientInviteSent: false, error: errMsg };
            }
        }
        else if (syncProvider === 'outlook' && hasOutlookCalendar) {
            try {
                if (options.cancelExternal && calendarEvent.externalEventId) {
                    await outlookCalendarSync_service_1.OutlookCalendarSyncService.deleteEvent(appointment.doctorId, calendarEvent.externalEventId);
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
                const syncResult = await outlookCalendarSync_service_1.OutlookCalendarSyncService.upsertEvent(appointment.doctorId, {
                    id: calendarEvent.id,
                    title: calendarEvent.titulo,
                    description: calendarEvent.descripcion,
                    start: calendarEvent.fechaHoraInicio,
                    end: calendarEvent.fechaHoraFin,
                    attendees,
                    externalEventId: (_g = calendarEvent.externalEventId) !== null && _g !== void 0 ? _g : undefined,
                    conferenceLink: allowVideoConference ? ((_h = calendarEvent.linkMeeting) !== null && _h !== void 0 ? _h : undefined) : undefined,
                    teamsEnabled: allowVideoConference,
                    disableConference: !allowVideoConference
                });
                if (syncResult) {
                    conferenceLink = allowVideoConference ? ((_j = syncResult.conferenceLink) !== null && _j !== void 0 ? _j : null) : null;
                    await prisma.internalCalendarEvent.update({
                        where: { id: calendarEvent.id },
                        data: {
                            externalProvider: 'outlook',
                            externalEventId: (_k = syncResult.externalEventId) !== null && _k !== void 0 ? _k : null,
                            externalUpdatedAt: (_l = syncResult.externalUpdatedAt) !== null && _l !== void 0 ? _l : null,
                            linkMeeting: conferenceLink
                        }
                    });
                }
            }
            catch (syncError) {
                console.error('Error sincronizando con Outlook Calendar:', syncError);
            }
        }
        else if (syncProvider === 'apple' && hasAppleCalendar) {
        }
        else if (syncProvider === 'apple' && hasAppleCalendar) {
            try {
                if (options.cancelExternal && calendarEvent.externalEventId) {
                    await appleCalendarSync_service_1.AppleCalendarSyncService.deleteEvent(appointment.doctorId, calendarEvent.externalEventId);
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
                const syncResult = await appleCalendarSync_service_1.AppleCalendarSyncService.upsertEvent(appointment.doctorId, {
                    id: calendarEvent.id,
                    title: calendarEvent.titulo,
                    description: calendarEvent.descripcion,
                    start: calendarEvent.fechaHoraInicio,
                    end: calendarEvent.fechaHoraFin,
                    attendees,
                    externalEventId: (_m = calendarEvent.externalEventId) !== null && _m !== void 0 ? _m : undefined
                });
                if (syncResult) {
                    await prisma.internalCalendarEvent.update({
                        where: { id: calendarEvent.id },
                        data: {
                            externalProvider: 'apple',
                            externalEventId: (_o = syncResult.externalEventId) !== null && _o !== void 0 ? _o : null,
                            externalUpdatedAt: (_p = syncResult.externalUpdatedAt) !== null && _p !== void 0 ? _p : null
                        }
                    });
                }
            }
            catch (syncError) {
                console.error('Error sincronizando con Apple Calendar:', syncError);
            }
        }
        // Si es teleconsulta, crear o actualizar Teleconsultation (meetingUrl solo tras consentimiento firmado)
        if (appointment.appointmentType === 'teleconsulta') {
            const videoProvider = syncProvider === 'google' ? 'google_meet' : syncProvider === 'outlook' ? 'teams' : 'google_meet';
            let resolvedMeetingUrl = allowVideoConference ? conferenceLink : null;
            if (allowVideoConference && !resolvedMeetingUrl) {
                const refreshedEvent = await prisma.internalCalendarEvent.findUnique({
                    where: { id: calendarEvent.id },
                    select: { linkMeeting: true },
                });
                resolvedMeetingUrl = (_q = refreshedEvent === null || refreshedEvent === void 0 ? void 0 : refreshedEvent.linkMeeting) !== null && _q !== void 0 ? _q : null;
            }
            await prisma.teleconsultation.upsert({
                where: { appointmentId: appointment.id },
                create: {
                    appointmentId: appointment.id,
                    videoProvider,
                    externalEventId: calendarEvent.externalEventId,
                    meetingUrl: resolvedMeetingUrl
                },
                update: {
                    videoProvider,
                    externalEventId: calendarEvent.externalEventId,
                    meetingUrl: allowVideoConference ? resolvedMeetingUrl !== null && resolvedMeetingUrl !== void 0 ? resolvedMeetingUrl : undefined : null
                }
            });
        }
        return syncOutcome;
    }
    static async getWaitlistAvailableSlots(req, res) {
        try {
            const doctor = await resolveDoctorForRequest(req);
            if (!doctor) {
                return res.status(req.user ? 404 : 401).json({ error: req.user ? 'Perfil de doctor no encontrado. Si eres asistente, selecciona un doctor.' : 'No autorizado' });
            }
            const { date } = req.query;
            if (!date || typeof date !== 'string') {
                return res.status(400).json({ error: 'Debes indicar una fecha (YYYY-MM-DD)' });
            }
            const doctorTimezone = doctor.timezone || 'America/Mexico_City';
            const slots = await schedule_service_1.ScheduleService.getBookableSlotsForDate(doctor.id, date, {
                timezone: doctorTimezone
            });
            res.json({
                success: true,
                data: slots.map(s => (Object.assign(Object.assign({}, s), { isRecurring: false }))),
                message: slots.length === 0
                    ? 'No hay horarios disponibles para esta fecha según la agenda compartida'
                    : undefined
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener slots disponibles para lista de espera:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Asignar paciente de lista de espera a slot disponible
    static async assignWaitlistToSlot(req, res) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
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
            const scheduleConfigWL = await schedule_service_1.ScheduleService.getScheduleConfig(doctorId);
            let newDateTime = null;
            if (slotDateTime) {
                const parsed = new Date(slotDateTime);
                if (Number.isNaN(parsed.getTime())) {
                    return res.status(400).json({ error: 'Formato de fecha/hora inválido para el slot' });
                }
                newDateTime = parsed;
                const doctorTimezone = doctor.timezone || 'America/Mexico_City';
                const slotOk = await schedule_service_1.ScheduleService.isSlotBookable(doctorId, parsed, {
                    excludeAppointmentId: appointmentIdToUse,
                    timezone: doctorTimezone
                });
                if (!slotOk) {
                    return res.status(409).json({ error: 'El horario ya no está disponible. Elige otro slot.' });
                }
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
                const wlDurMin = (_a = scheduleConfigWL === null || scheduleConfigWL === void 0 ? void 0 : scheduleConfigWL.appointmentDuration) !== null && _a !== void 0 ? _a : 30;
                appointmentEnd = new Date(newDateTime.getTime() + Math.max(15, Math.min(480, wlDurMin)) * 60000);
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
                await (0, appointmentConfirmation_utils_1.refreshConfirmationTokenExpiryForAppointment)(appointmentIdToUse);
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
            }
            else {
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
                const calEvWl = await prisma.internalCalendarEvent.findFirst({
                    where: {
                        doctorId,
                        patientId: updatedAppointment.patientId,
                        fechaHoraInicio: {
                            gte: new Date(updatedAppointment.date.getTime() - 30 * 60000),
                            lte: new Date(updatedAppointment.date.getTime() + 30 * 60000)
                        }
                    }
                });
                const wlMs = AppointmentConfirmationController.resolveAppointmentDurationMs(calEvWl, scheduleConfigWL);
                appointmentEnd = new Date(updatedAppointment.date.getTime() + wlMs);
            }
            // Crear o actualizar evento interno y sincronizar con calendarios externos
            try {
                if (!updatedAppointment) {
                    throw new Error('Appointment no disponible para sincronización');
                }
                const patientEmailForCalendar = updatedAppointment.patient.email || ((_b = updatedAppointment.patient.user) === null || _b === void 0 ? void 0 : _b.email) || '';
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
                            fechaHoraFin: appointmentEnd,
                            titulo: eventTitle,
                            descripcion: eventDescription,
                            origenEvento: 'interno',
                            creadoPor: updatedAppointment.doctorId
                        }
                    });
                }
                else {
                    calendarEvent = await prisma.internalCalendarEvent.update({
                        where: { id: calendarEvent.id },
                        data: {
                            fechaHoraInicio: updatedAppointment.date,
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
                if (calendarEvent) {
                    const attendees = patientEmailForCalendar ? [patientEmailForCalendar] : [];
                    const tcWl = await prisma.teleconsultation.findUnique({
                        where: { appointmentId: updatedAppointment.id },
                        select: { consentSigned: true }
                    });
                    const allowVideoConferenceWl = (0, calendarSync_utils_1.shouldAllowVideoConferenceForAppointment)(updatedAppointment.appointmentType, tcWl === null || tcWl === void 0 ? void 0 : tcWl.consentSigned);
                    let syncProvider = null;
                    const hasGoogleCalendar = await prisma.calendarSyncConfig.findFirst({
                        where: { doctorId, provider: 'google', isConnected: true }
                    });
                    const hasOutlookCalendar = await prisma.calendarSyncConfig.findFirst({
                        where: { doctorId, provider: 'outlook', isConnected: true }
                    });
                    const hasAppleCalendar = await prisma.calendarSyncConfig.findFirst({
                        where: { doctorId, provider: 'apple', isConnected: true }
                    });
                    if (hasGoogleCalendar)
                        syncProvider = 'google';
                    else if (hasOutlookCalendar)
                        syncProvider = 'outlook';
                    else if (hasAppleCalendar)
                        syncProvider = 'apple';
                    let conferenceLink = null;
                    if (syncProvider === 'google' && hasGoogleCalendar) {
                        try {
                            const syncResult = await googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent(doctorId, {
                                id: calendarEvent.id,
                                title: calendarEvent.titulo,
                                description: calendarEvent.descripcion,
                                start: calendarEvent.fechaHoraInicio,
                                end: calendarEvent.fechaHoraFin,
                                attendees,
                                externalEventId: (_c = calendarEvent.externalEventId) !== null && _c !== void 0 ? _c : undefined,
                                conferenceType: allowVideoConferenceWl ? 'google-meet' : null,
                                googleMeetEnabled: allowVideoConferenceWl,
                                disableConference: !allowVideoConferenceWl,
                                sendUpdates: (0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
                                    externalEventId: calendarEvent.externalEventId,
                                    attendeeCount: attendees.length,
                                    notifyAttendees: true,
                                }),
                            });
                            if (syncResult) {
                                conferenceLink = allowVideoConferenceWl ? ((_d = syncResult.conferenceLink) !== null && _d !== void 0 ? _d : null) : null;
                                await prisma.internalCalendarEvent.update({
                                    where: { id: calendarEvent.id },
                                    data: {
                                        externalProvider: 'google',
                                        externalEventId: (_e = syncResult.externalEventId) !== null && _e !== void 0 ? _e : null,
                                        externalUpdatedAt: (_f = syncResult.externalUpdatedAt) !== null && _f !== void 0 ? _f : null,
                                        linkMeeting: allowVideoConferenceWl ? conferenceLink : null
                                    }
                                });
                            }
                        }
                        catch (syncError) {
                            console.error('Error sincronizando con Google Calendar:', syncError);
                        }
                    }
                    else if (syncProvider === 'outlook' && hasOutlookCalendar) {
                        try {
                            const syncResult = await outlookCalendarSync_service_1.OutlookCalendarSyncService.upsertEvent(doctorId, {
                                id: calendarEvent.id,
                                title: calendarEvent.titulo,
                                description: calendarEvent.descripcion,
                                start: calendarEvent.fechaHoraInicio,
                                end: calendarEvent.fechaHoraFin,
                                attendees,
                                externalEventId: (_g = calendarEvent.externalEventId) !== null && _g !== void 0 ? _g : undefined,
                                teamsEnabled: allowVideoConferenceWl,
                                disableConference: !allowVideoConferenceWl
                            });
                            if (syncResult) {
                                conferenceLink = allowVideoConferenceWl ? ((_h = syncResult.conferenceLink) !== null && _h !== void 0 ? _h : null) : null;
                                await prisma.internalCalendarEvent.update({
                                    where: { id: calendarEvent.id },
                                    data: {
                                        externalProvider: 'outlook',
                                        externalEventId: (_j = syncResult.externalEventId) !== null && _j !== void 0 ? _j : null,
                                        externalUpdatedAt: (_k = syncResult.externalUpdatedAt) !== null && _k !== void 0 ? _k : null,
                                        linkMeeting: conferenceLink
                                    }
                                });
                            }
                        }
                        catch (syncError) {
                            console.error('Error sincronizando con Outlook Calendar:', syncError);
                        }
                    }
                    else if (syncProvider === 'apple' && hasAppleCalendar) {
                        try {
                            const syncResult = await appleCalendarSync_service_1.AppleCalendarSyncService.upsertEvent(doctorId, {
                                id: calendarEvent.id,
                                title: calendarEvent.titulo,
                                description: calendarEvent.descripcion,
                                start: calendarEvent.fechaHoraInicio,
                                end: calendarEvent.fechaHoraFin,
                                attendees,
                                externalEventId: (_l = calendarEvent.externalEventId) !== null && _l !== void 0 ? _l : undefined
                            });
                            if (syncResult) {
                                await prisma.internalCalendarEvent.update({
                                    where: { id: calendarEvent.id },
                                    data: {
                                        externalProvider: 'apple',
                                        externalEventId: (_m = syncResult.externalEventId) !== null && _m !== void 0 ? _m : null,
                                        externalUpdatedAt: (_o = syncResult.externalUpdatedAt) !== null && _o !== void 0 ? _o : null
                                    }
                                });
                            }
                        }
                        catch (syncError) {
                            console.error('Error sincronizando con Apple Calendar:', syncError);
                        }
                    }
                    if (patientEmailForCalendar) {
                        const emailService = notification_service_2.EmailService.getInstance();
                        const isTeleconsulta = (updatedAppointment === null || updatedAppointment === void 0 ? void 0 : updatedAppointment.appointmentType) === 'teleconsulta';
                        const confirmationToken = manageLink === null || manageLink === void 0 ? void 0 : manageLink.split('/').pop();
                        const teleconsultaLink = isTeleconsulta && confirmationToken
                            ? (0, mercadopago_config_1.buildTeleconsultationConsentUrl)(confirmationToken)
                            : undefined;
                        let teleconsultationPaymentAmount;
                        let teleconsultationPaymentCurrency;
                        if (isTeleconsulta && (updatedAppointment === null || updatedAppointment === void 0 ? void 0 : updatedAppointment.id)) {
                            const payReq = await (0, mercadopago_teleconsultation_service_1.requiresTeleconsultationPayment)(updatedAppointment.doctorId, updatedAppointment.id);
                            if (payReq.required) {
                                teleconsultationPaymentAmount = payReq.amount;
                                teleconsultationPaymentCurrency = payReq.currency;
                            }
                        }
                        await emailService.sendCalendarEventEmail(patientEmailForCalendar, {
                            patientName,
                            doctorName,
                            eventTitle: calendarEvent.titulo,
                            eventDate: calendarEvent.fechaHoraInicio,
                            eventEndDate: calendarEvent.fechaHoraFin,
                            description: calendarEvent.descripcion || undefined,
                            linkMeeting: isTeleconsulta ? undefined : (conferenceLink || calendarEvent.linkMeeting || undefined),
                            tipoCita: conferenceLink || calendarEvent.linkMeeting || isTeleconsulta ? 'remota' : 'presencial',
                            manageLink,
                            teleconsultaLink,
                            teleconsultationPaymentAmount,
                            teleconsultationPaymentCurrency,
                            timezone: (_q = (_p = updatedAppointment === null || updatedAppointment === void 0 ? void 0 : updatedAppointment.doctor) === null || _p === void 0 ? void 0 : _p.timezone) !== null && _q !== void 0 ? _q : 'America/Mexico_City'
                        });
                    }
                    // Notificar al doctor también
                    const doctorEmail = ((_s = (_r = updatedAppointment === null || updatedAppointment === void 0 ? void 0 : updatedAppointment.doctor) === null || _r === void 0 ? void 0 : _r.user) === null || _s === void 0 ? void 0 : _s.email) || '';
                    const doctorPhone = ((_u = (_t = updatedAppointment === null || updatedAppointment === void 0 ? void 0 : updatedAppointment.doctor) === null || _t === void 0 ? void 0 : _t.user) === null || _u === void 0 ? void 0 : _u.phone) || '';
                    if (doctorEmail || doctorPhone) {
                        const docTz = (_w = (_v = updatedAppointment === null || updatedAppointment === void 0 ? void 0 : updatedAppointment.doctor) === null || _v === void 0 ? void 0 : _v.timezone) !== null && _w !== void 0 ? _w : 'America/Mexico_City';
                        const timeStr = (0, date_utils_1.formatAppointmentTime)(updatedAppointment.date, docTz);
                        await notification_service_1.NotificationService.sendDoctorNotification(doctorEmail, doctorPhone, {
                            doctorName: doctorName || updatedAppointment.doctor.professionalTitle || 'Tu doctor',
                            patientName,
                            date: updatedAppointment.date,
                            time: timeStr,
                            reason: updatedAppointment.notes || '',
                            timezone: docTz
                        });
                    }
                }
            }
            catch (calendarError) {
                console.error('Error al sincronizar evento de lista de espera:', calendarError);
            }
            res.json({
                success: true,
                message: 'Paciente asignado exitosamente al slot'
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al asignar paciente de lista de espera:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Aprobar o rechazar cita por parte del doctor
    static async updateAppointmentStatus(req, res) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
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
                    const scheduleConfigApprove = await schedule_service_1.ScheduleService.getScheduleConfig(doctor.id);
                    const calendarEventInclude = {
                        patient: {
                            select: {
                                id: true,
                                userId: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    };
                    // Preferir el vínculo duro cita↔evento (determinístico). Si no existe, caer al match por
                    // ventana de tiempo (compatibilidad con eventos antiguos sin appointmentId).
                    let calendarEvent = await prisma.internalCalendarEvent.findUnique({
                        where: { appointmentId },
                        include: calendarEventInclude
                    });
                    if (!calendarEvent) {
                        calendarEvent = await prisma.internalCalendarEvent.findFirst({
                            where: {
                                doctorId: doctor.id,
                                patientId: appointment.patientId,
                                appointmentId: null,
                                fechaHoraInicio: {
                                    gte: new Date(appointment.date.getTime() - 5 * 60000), // 5 minutos antes
                                    lte: new Date(appointment.date.getTime() + 5 * 60000) // 5 minutos después
                                }
                            },
                            include: calendarEventInclude
                        });
                    }
                    const durationMsApprove = AppointmentConfirmationController.resolveAppointmentDurationMs(calendarEvent, scheduleConfigApprove);
                    const appointmentEnd = new Date(appointment.date.getTime() + durationMsApprove);
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
                                appointmentId, // Vínculo duro cita↔evento
                                fechaHoraInicio: appointment.date,
                                fechaHoraFin: appointmentEnd,
                                titulo: eventTitle,
                                descripcion: eventDescription,
                                origenEvento: 'interno',
                                creadoPor: doctor.id
                            },
                            include: calendarEventInclude
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
                    let syncProvider = null;
                    if (hasGoogleCalendar) {
                        syncProvider = 'google';
                    }
                    else if (hasOutlookCalendar) {
                        syncProvider = 'outlook';
                    }
                    else if (hasAppleCalendar) {
                        syncProvider = 'apple';
                    }
                    // Obtener email del paciente
                    const patientEmail = appointment.patient.email || ((_a = appointment.patient.user) === null || _a === void 0 ? void 0 : _a.email) || null;
                    const attendees = patientEmail ? [patientEmail] : [];
                    console.log('📅 Sincronizando evento aprobado con calendario externo:', syncProvider || 'NINGUNO');
                    console.log('   Email del paciente:', patientEmail || 'NO DISPONIBLE');
                    console.log('   Attendees:', attendees.length > 0 ? attendees.join(', ') : 'NINGUNO');
                    const tcApprove = await prisma.teleconsultation.findUnique({
                        where: { appointmentId: appointment.id },
                        select: { consentSigned: true }
                    });
                    const allowVideoConferenceApprove = (0, calendarSync_utils_1.shouldAllowVideoConferenceForAppointment)(appointment.appointmentType, tcApprove === null || tcApprove === void 0 ? void 0 : tcApprove.consentSigned);
                    // Sincronizar con calendario externo para enviar invitación al paciente
                    let syncResult = null;
                    let conferenceLink = null;
                    if (syncProvider === 'google' && hasGoogleCalendar) {
                        try {
                            const cleanTitle = calendarEvent.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
                            syncResult = await googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent(doctor.id, {
                                id: calendarEvent.id,
                                title: cleanTitle,
                                description: calendarEvent.descripcion,
                                start: calendarEvent.fechaHoraInicio,
                                end: calendarEvent.fechaHoraFin,
                                attendees,
                                externalEventId: (_b = calendarEvent.externalEventId) !== null && _b !== void 0 ? _b : undefined,
                                location: doctor.specialization || undefined,
                                conferenceType: allowVideoConferenceApprove ? 'google-meet' : null,
                                googleMeetEnabled: allowVideoConferenceApprove,
                                disableConference: !allowVideoConferenceApprove,
                                sendUpdates: (0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
                                    externalEventId: calendarEvent.externalEventId,
                                    attendeeCount: attendees.length,
                                    notifyAttendees: true,
                                }),
                            });
                            if (syncResult) {
                                const meetLink = allowVideoConferenceApprove ? (syncResult.conferenceLink || null) : null;
                                await prisma.internalCalendarEvent.update({
                                    where: { id: calendarEvent.id },
                                    data: {
                                        externalProvider: 'google',
                                        externalEventId: syncResult.externalEventId,
                                        externalUpdatedAt: syncResult.externalUpdatedAt,
                                        linkMeeting: meetLink
                                    }
                                });
                                conferenceLink = meetLink;
                                console.log('✅ Evento sincronizado exitosamente con Google Calendar');
                                console.log('   📧 Invitación enviada al paciente:', patientEmail);
                            }
                        }
                        catch (error) {
                            console.error('❌ Error sincronizando con Google Calendar:', error);
                        }
                    }
                    else if (syncProvider === 'outlook' && hasOutlookCalendar) {
                        try {
                            const cleanTitle = calendarEvent.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
                            syncResult = await outlookCalendarSync_service_1.OutlookCalendarSyncService.upsertEvent(doctor.id, {
                                id: calendarEvent.id,
                                title: cleanTitle,
                                description: calendarEvent.descripcion,
                                start: calendarEvent.fechaHoraInicio,
                                end: calendarEvent.fechaHoraFin,
                                attendees,
                                externalEventId: (_c = calendarEvent.externalEventId) !== null && _c !== void 0 ? _c : undefined,
                                location: doctor.specialization || undefined,
                                teamsEnabled: allowVideoConferenceApprove,
                                disableConference: !allowVideoConferenceApprove
                            });
                            if (syncResult) {
                                const meetLinkOl = allowVideoConferenceApprove ? (syncResult.conferenceLink || null) : null;
                                await prisma.internalCalendarEvent.update({
                                    where: { id: calendarEvent.id },
                                    data: {
                                        externalProvider: 'outlook',
                                        externalEventId: syncResult.externalEventId,
                                        externalUpdatedAt: syncResult.externalUpdatedAt,
                                        linkMeeting: meetLinkOl
                                    }
                                });
                                conferenceLink = meetLinkOl;
                                console.log('✅ Evento sincronizado exitosamente con Outlook Calendar');
                                console.log('   📧 Invitación enviada al paciente:', patientEmail);
                            }
                        }
                        catch (error) {
                            console.error('❌ Error sincronizando con Outlook Calendar:', error);
                        }
                    }
                    else if (syncProvider === 'apple' && hasAppleCalendar) {
                        try {
                            const cleanTitle = calendarEvent.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
                            syncResult = await appleCalendarSync_service_1.AppleCalendarSyncService.upsertEvent(doctor.id, {
                                id: calendarEvent.id,
                                title: cleanTitle,
                                description: calendarEvent.descripcion,
                                start: calendarEvent.fechaHoraInicio,
                                end: calendarEvent.fechaHoraFin,
                                attendees,
                                externalEventId: (_d = calendarEvent.externalEventId) !== null && _d !== void 0 ? _d : undefined
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
                        }
                        catch (error) {
                            console.error('❌ Error sincronizando con Apple Calendar:', error);
                        }
                    }
                    else {
                        console.warn('⚠️  No hay calendarios externos configurados. El paciente NO recibirá invitación de calendario.');
                    }
                    // Enviar notificación por email al paciente (con información del meeting si está disponible)
                    try {
                        const patientEmailForNotification = appointment.patient.email || ((_e = appointment.patient.user) === null || _e === void 0 ? void 0 : _e.email);
                        if (patientEmailForNotification) {
                            const emailService = notification_service_2.EmailService.getInstance();
                            const doctorUser = await prisma.user.findUnique({
                                where: { id: doctor.userId },
                                select: { firstName: true, lastName: true }
                            });
                            const doctorName = doctorUser ? `${doctorUser.firstName} ${doctorUser.lastName}` : 'Dr.';
                            const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
                            // Obtener link de pre-consulta si existe
                            let preConsultationLink = undefined;
                            const preConsultation = await prisma.preConsultation.findUnique({
                                where: { appointmentId: appointmentId }
                            });
                            if (preConsultation && preConsultation.status === 'PENDING') {
                                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                                preConsultationLink = `${frontendUrl}/pre-consulta/${preConsultation.token}`;
                            }
                            const manageLink = await AppointmentConfirmationController.getOrCreateManageLink(appointmentId);
                            const isTeleconsulta = appointment.appointmentType === 'teleconsulta';
                            const confirmationToken = manageLink === null || manageLink === void 0 ? void 0 : manageLink.split('/').pop();
                            const teleconsultaLink = isTeleconsulta && confirmationToken
                                ? (0, mercadopago_config_1.buildTeleconsultationConsentUrl)(confirmationToken)
                                : undefined;
                            let teleconsultationPaymentAmount;
                            let teleconsultationPaymentCurrency;
                            if (isTeleconsulta) {
                                const payReq = await (0, mercadopago_teleconsultation_service_1.requiresTeleconsultationPayment)(appointment.doctorId, appointment.id);
                                if (payReq.required) {
                                    teleconsultationPaymentAmount = payReq.amount;
                                    teleconsultationPaymentCurrency = payReq.currency;
                                }
                            }
                            await emailService.sendCalendarEventEmail(patientEmailForNotification, {
                                patientName,
                                doctorName: `${doctor.professionalTitle || ''} ${doctorName}`,
                                eventTitle: calendarEvent.titulo,
                                eventDate: appointment.date,
                                eventEndDate: appointmentEnd,
                                description: appointment.notes || undefined,
                                linkMeeting: isTeleconsulta ? undefined : (conferenceLink || undefined),
                                tipoCita: conferenceLink || isTeleconsulta ? 'remota' : 'presencial',
                                preConsultationLink,
                                manageLink,
                                teleconsultaLink,
                                teleconsultationPaymentAmount,
                                teleconsultationPaymentCurrency,
                                timezone: (_f = doctor.timezone) !== null && _f !== void 0 ? _f : 'America/Mexico_City'
                            });
                            console.log('✅ Email de confirmación enviado al paciente:', patientEmailForNotification);
                        }
                        else {
                            console.warn(`No se puede enviar notificación: paciente ${appointment.patientId} no tiene email`);
                        }
                    }
                    catch (notifError) {
                        console.error('Error enviando notificación al paciente:', notifError);
                        // No fallar la actualización si la notificación falla
                    }
                }
                catch (calendarError) {
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
            }
            else if (action === 'reject') {
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
                    const patientEmail = appointment.patient.email || ((_g = appointment.patient.user) === null || _g === void 0 ? void 0 : _g.email);
                    if (patientEmail) {
                        // TODO: Implementar método específico para notificar rechazo
                        console.log(`Notificación de rechazo debería enviarse a: ${patientEmail}`);
                    }
                }
                catch (notifError) {
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
            }
            else if (action === 'reschedule') {
                // Proponer nuevo horario al paciente
                const newDate = new Date(newDateTime);
                // Validar que la fecha no sea en el pasado
                if (newDate < new Date()) {
                    return res.status(400).json({ error: 'No puedes reprogramar a una fecha/hora en el pasado' });
                }
                // Verificar disponibilidad del nuevo horario
                const doctorTimezone = doctor.timezone || 'America/Mexico_City';
                const isSlotAvailable = await schedule_service_1.ScheduleService.isTimeSlotAvailable(doctor.id, newDate, doctorTimezone);
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
                const confirmationToken = crypto_1.default.randomBytes(32).toString('hex');
                const expiresAt = (0, appointmentConfirmation_utils_1.computeConfirmationTokenExpiry)(newDate);
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
                await AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
                    notifyAttendees: true,
                });
                // Enviar notificación al paciente con el nuevo horario propuesto
                try {
                    const patientEmail = appointment.patient.email || ((_h = appointment.patient.user) === null || _h === void 0 ? void 0 : _h.email);
                    if (patientEmail) {
                        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                        const confirmationLink = `${frontendUrl}/confirmar-cita/${confirmationToken}`;
                        const emailService = notification_service_2.EmailService.getInstance();
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
                }
                catch (notifError) {
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
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al actualizar estado de cita:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    static async getRefundContextByToken(req, res) {
        try {
            const { token } = req.params;
            const data = await (0, mercadopago_refund_service_1.getRefundRequestByToken)(token);
            return res.json(Object.assign({ success: true }, data));
        }
        catch (error) {
            if (error instanceof mercadopago_refund_service_1.RefundRequestError) {
                return res.status(error.statusCode).json({ error: error.message });
            }
            logger_utils_1.securityLogger.error('getRefundContextByToken failed', error);
            return res.status(500).json({ error: 'Error al obtener reembolso' });
        }
    }
    static async createRefundRequestByToken(req, res) {
        try {
            const { token } = req.params;
            const { reason, requestedAmount } = req.body || {};
            const data = await (0, mercadopago_refund_service_1.createRefundRequestByToken)(token, { reason, requestedAmount });
            return res.json({ success: true, data });
        }
        catch (error) {
            if (error instanceof mercadopago_refund_service_1.RefundRequestError) {
                return res.status(error.statusCode).json({ error: error.message });
            }
            logger_utils_1.securityLogger.error('createRefundRequestByToken failed', error);
            return res.status(500).json({ error: 'Error al solicitar reembolso' });
        }
    }
}
exports.AppointmentConfirmationController = AppointmentConfirmationController;
