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
exports.shareCalendarEvent = exports.resendCalendarInvite = exports.getCalendarEvent = exports.cancelAppointment = exports.deleteCalendarEvent = exports.updateCalendarEvent = exports.getRescheduleAvailableSlots = exports.createCalendarEvent = exports.getCalendarEvents = void 0;
const client_1 = require("@prisma/client");
const error_utils_1 = require("../utils/error.utils");
const notification_service_1 = require("../services/notification.service");
const googleCalendarSync_service_1 = require("../services/googleCalendarSync.service");
const outlookCalendarSync_service_1 = require("../services/outlookCalendarSync.service");
const appleCalendarSync_service_1 = require("../services/appleCalendarSync.service");
const notionCalendarSync_service_1 = require("../services/notionCalendarSync.service");
const calendarSync_utils_1 = require("../utils/calendarSync.utils");
const appointmentConfirmation_controller_1 = require("./appointmentConfirmation.controller");
const schedule_service_1 = require("../services/schedule.service");
const mercadopago_teleconsultation_service_1 = require("../payments/mercadopago/mercadopago.teleconsultation.service");
const mercadopago_inperson_service_1 = require("../payments/mercadopago/mercadopago.inperson.service");
const mercadopago_appointment_display_service_1 = require("../payments/mercadopago/mercadopago.appointment-display.service");
const appointmentConfirmation_utils_1 = require("../utils/appointmentConfirmation.utils");
const prisma = new client_1.PrismaClient();
const resolveDoctorId = async (req) => {
    if (!req.user) {
        throw new error_utils_1.AppError('Autenticación requerida.', 401);
    }
    if (req.user.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.userId },
            select: { id: true }
        });
        if (!doctor) {
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        }
        return doctor.id;
    }
    if (req.user.role === 'ASISTENTE') {
        const selectedDoctorId = req.headers['x-selected-doctor-id'];
        if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
            throw new error_utils_1.AppError('Doctor seleccionado requerido.', 400);
        }
        const link = await prisma.asistenteDoctorVinculo.findFirst({
            where: {
                doctorId: selectedDoctorId,
                asistenteId: req.user.userId,
                activo: true
            },
            select: { id: true }
        });
        if (!link) {
            throw new error_utils_1.AppError('Asistente no vinculado a este doctor.', 403);
        }
        return selectedDoctorId;
    }
    throw new error_utils_1.AppError('Acceso denegado.', 403);
};
const getOrCreateManageLink = appointmentConfirmation_utils_1.getOrCreateAppointmentManageLink;
const buildDescriptionWithManageLink = async (event) => {
    var _a, _b;
    const resolvedDoctorId = event.doctorId || ((_a = event.doctor) === null || _a === void 0 ? void 0 : _a.id);
    const resolvedPatientId = event.patientId || ((_b = event.patient) === null || _b === void 0 ? void 0 : _b.id) || null;
    if (!resolvedDoctorId) {
        return (0, appointmentConfirmation_utils_1.stripManageLinkBlocksFromDescription)(event.descripcion) || undefined;
    }
    let appointmentId = event.appointmentId || null;
    if (!appointmentId && resolvedPatientId) {
        const appointmentCandidate = await prisma.appointment.findFirst({
            where: {
                doctorId: resolvedDoctorId,
                patientId: resolvedPatientId,
                date: {
                    gte: new Date(event.fechaHoraInicio.getTime() - 30 * 60000),
                    lte: new Date(event.fechaHoraInicio.getTime() + 30 * 60000),
                },
            },
            select: { id: true },
            orderBy: { date: 'desc' },
        });
        appointmentId = (appointmentCandidate === null || appointmentCandidate === void 0 ? void 0 : appointmentCandidate.id) || null;
    }
    if (!appointmentId) {
        return (0, appointmentConfirmation_utils_1.stripManageLinkBlocksFromDescription)(event.descripcion) || undefined;
    }
    const manageLink = await getOrCreateManageLink(appointmentId);
    return (0, appointmentConfirmation_utils_1.buildCleanEventDescriptionForSync)(event.descripcion, manageLink) || undefined;
};
// Obtener todos los eventos del calendario del doctor
const getCalendarEvents = async (req, res) => {
    try {
        const doctorId = await resolveDoctorId(req);
        const { startDate, endDate, start, end, patientId, origenEvento, viewType = 'month' } = req.query;
        let where = {
            doctorId
        };
        // Filtrar por rango de fechas (FullCalendar puede enviar 'start' y 'end' o 'startDate' y 'endDate')
        const startDateParam = startDate || start;
        const endDateParam = endDate || end;
        // SIEMPRE requerir un rango de fechas para evitar consultas sin límite (problema de performance)
        if (startDateParam && endDateParam) {
            where.fechaHoraInicio = {
                gte: new Date(startDateParam),
                lte: new Date(endDateParam)
            };
        }
        else {
            // Si no se proporciona rango, usar un rango por defecto razonable (evitar cargar todos los eventos)
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1); // 1 mes antes
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59); // 3 meses después
            where.fechaHoraInicio = {
                gte: firstDay,
                lte: lastDay
            };
        }
        // Filtrar por paciente
        if (patientId) {
            where.patientId = patientId;
        }
        // Filtrar por origen del evento
        if (origenEvento) {
            where.origenEvento = origenEvento;
        }
        // Optimización: Limitar el número de resultados y usar take para mejorar performance
        // También optimizar los selects para obtener solo los campos necesarios
        const events = await prisma.internalCalendarEvent.findMany({
            where,
            take: 1000, // Límite máximo de eventos (ajustable según necesidades)
            select: {
                id: true,
                titulo: true,
                fechaHoraInicio: true,
                fechaHoraFin: true,
                descripcion: true,
                origenEvento: true,
                linkMeeting: true,
                patientId: true,
                appointmentId: true,
                externalProvider: true,
                externalEventId: true,
                externalUpdatedAt: true,
                patient: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        user: {
                            select: {
                                phone: true
                            }
                        }
                    }
                },
                doctor: {
                    select: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                fechaHoraInicio: 'asc'
            }
        });
        // Para cada evento con paciente, buscar el appointment relacionado para obtener el confirmationStatus
        // Todos los eventos provienen de calendarios externos, pero si tienen paciente = son citas médicas
        const eventsWithConfirmationStatus = await Promise.all(events.map(async (event) => {
            var _a, _b, _c, _d;
            let confirmationStatus = null;
            let appointmentId = null;
            let appointmentType = null;
            let teleconsultationAmount = null;
            // Buscar appointment para cualquier evento con paciente (cita médica)
            if (event.patientId) {
                let appointment = null;
                if (event.appointmentId) {
                    appointment = await prisma.appointment.findUnique({
                        where: { id: event.appointmentId },
                        select: {
                            id: true,
                            confirmationStatus: true,
                            status: true,
                            date: true,
                            appointmentType: true,
                            teleconsultationAmount: true,
                            teleconsultation: {
                                select: { meetingUrl: true, consentSigned: true },
                            },
                        },
                    });
                }
                // Buscar appointment que coincida con patientId, doctorId y fecha/hora similar
                const eventStart = new Date(event.fechaHoraInicio);
                if (!appointment && event.patientId) {
                    const searchStart = new Date(eventStart);
                    searchStart.setMinutes(searchStart.getMinutes() - 30);
                    const searchEnd = new Date(eventStart);
                    searchEnd.setMinutes(searchEnd.getMinutes() + 30);
                    appointment = await prisma.appointment.findFirst({
                        where: {
                            patientId: event.patientId,
                            doctorId,
                            date: {
                                gte: searchStart,
                                lte: searchEnd
                            }
                        },
                        select: {
                            id: true,
                            confirmationStatus: true,
                            status: true,
                            date: true,
                            appointmentType: true,
                            teleconsultationAmount: true,
                            teleconsultation: {
                                select: { meetingUrl: true, consentSigned: true },
                            },
                        },
                        orderBy: {
                            date: 'desc'
                        }
                    });
                }
                if (appointment) {
                    // Usar el confirmationStatus del appointment, o PENDING si es null/undefined
                    confirmationStatus = appointment.confirmationStatus || 'PENDING';
                    appointmentId = appointment.id;
                    appointmentType = (_a = appointment.appointmentType) !== null && _a !== void 0 ? _a : null;
                    teleconsultationAmount =
                        appointment.teleconsultationAmount != null
                            ? Number(appointment.teleconsultationAmount)
                            : null;
                    const appointmentIsCancelled = appointment.status === 'CANCELLED' || appointment.confirmationStatus === 'CANCELLED';
                    // CRÍTICO: Si el evento tiene externalEventId, verificar el estado actual de los attendees
                    // en el calendario externo (Google, Outlook, Apple) para detectar si el paciente aceptó/rechazó
                    if (!appointmentIsCancelled &&
                        event.externalProvider &&
                        event.externalEventId) {
                        try {
                            // Obtener el email del paciente una sola vez
                            const patient = await prisma.patient.findUnique({
                                where: { id: event.patientId },
                                select: {
                                    email: true,
                                    user: {
                                        select: {
                                            email: true
                                        }
                                    }
                                }
                            });
                            const patientEmail = (patient === null || patient === void 0 ? void 0 : patient.email) || ((_b = patient === null || patient === void 0 ? void 0 : patient.user) === null || _b === void 0 ? void 0 : _b.email);
                            if (patientEmail) {
                                let externalEvent = null;
                                let patientAttendee = null;
                                // Verificar según la plataforma
                                if (event.externalProvider === 'google') {
                                    const googleConfig = await prisma.calendarSyncConfig.findFirst({
                                        where: {
                                            doctorId,
                                            provider: 'google',
                                            isConnected: true
                                        }
                                    });
                                    if (googleConfig && googleConfig.accessToken) {
                                        externalEvent = await googleCalendarSync_service_1.GoogleCalendarSyncService.getEvent(doctorId, event.externalEventId);
                                        if (externalEvent === null || externalEvent === void 0 ? void 0 : externalEvent.attendees) {
                                            // Comparar emails de forma case-insensitive y normalizada
                                            const normalizedPatientEmail = patientEmail.toLowerCase().trim();
                                            patientAttendee = externalEvent.attendees.find((a) => {
                                                const attendeeEmail = (a.email || '').toLowerCase().trim();
                                                return attendeeEmail === normalizedPatientEmail;
                                            });
                                            // Log para debugging
                                            if (!patientAttendee) {
                                                console.log(`⚠️ No se encontró attendee con email ${patientEmail} en el evento ${event.externalEventId}`);
                                                console.log(`   Attendees disponibles:`, externalEvent.attendees.map((a) => a.email).join(', '));
                                            }
                                        }
                                        else {
                                            console.log(`⚠️ El evento ${event.externalEventId} no tiene attendees`);
                                        }
                                    }
                                }
                                else if (event.externalProvider === 'outlook') {
                                    const outlookConfig = await prisma.calendarSyncConfig.findFirst({
                                        where: {
                                            doctorId,
                                            provider: 'outlook',
                                            isConnected: true
                                        }
                                    });
                                    if (outlookConfig && outlookConfig.accessToken) {
                                        externalEvent = await outlookCalendarSync_service_1.OutlookCalendarSyncService.getEvent(doctorId, event.externalEventId);
                                        if (externalEvent === null || externalEvent === void 0 ? void 0 : externalEvent.attendees) {
                                            // En Microsoft Graph API, el campo es 'status' no 'responseStatus'
                                            patientAttendee = externalEvent.attendees.find((a) => { var _a; return ((_a = a.emailAddress) === null || _a === void 0 ? void 0 : _a.address) === patientEmail; });
                                        }
                                    }
                                }
                                else if (event.externalProvider === 'apple') {
                                    const appleConfig = await prisma.calendarSyncConfig.findFirst({
                                        where: {
                                            doctorId,
                                            provider: 'apple',
                                            isConnected: true
                                        }
                                    });
                                    if (appleConfig && appleConfig.accessToken) {
                                        externalEvent = await appleCalendarSync_service_1.AppleCalendarSyncService.getEvent(doctorId, event.externalEventId);
                                        if (externalEvent === null || externalEvent === void 0 ? void 0 : externalEvent.attendees) {
                                            patientAttendee = externalEvent.attendees.find((a) => a.email === patientEmail);
                                        }
                                    }
                                }
                                // Procesar el estado de respuesta del paciente
                                if (patientAttendee) {
                                    let responseStatus = null;
                                    // Normalizar el estado según la plataforma
                                    if (event.externalProvider === 'google') {
                                        responseStatus = patientAttendee.responseStatus; // 'accepted', 'declined', 'tentative', 'needsAction'
                                    }
                                    else if (event.externalProvider === 'outlook') {
                                        // Microsoft Graph API usa 'status': 'accepted', 'declined', 'tentativelyAccepted', 'none'
                                        const status = (_c = patientAttendee.status) === null || _c === void 0 ? void 0 : _c.toLowerCase();
                                        if (status === 'accepted') {
                                            responseStatus = 'accepted';
                                        }
                                        else if (status === 'declined') {
                                            responseStatus = 'declined';
                                        }
                                        else if (status === 'tentativelyaccepted') {
                                            responseStatus = 'tentative';
                                        }
                                    }
                                    else if (event.externalProvider === 'apple') {
                                        // Apple Calendar usa responseStatus: 'accepted', 'declined', 'tentative', 'needsAction'
                                        responseStatus = patientAttendee.responseStatus;
                                    }
                                    // Actualizar el appointment según el estado
                                    if (responseStatus === 'accepted') {
                                        await prisma.appointment.update({
                                            where: { id: appointment.id },
                                            data: {
                                                confirmationStatus: 'CONFIRMED',
                                                confirmedAt: new Date()
                                            }
                                        });
                                        confirmationStatus = 'CONFIRMED';
                                        console.log(`✅ Appointment ${appointment.id} actualizado a CONFIRMED - paciente aceptó en ${event.externalProvider} Calendar`);
                                    }
                                    else if (responseStatus === 'declined') {
                                        // El paciente rechazó la invitación
                                        await prisma.appointment.update({
                                            where: { id: appointment.id },
                                            data: {
                                                confirmationStatus: 'CANCELLED',
                                                cancelledAt: new Date()
                                            }
                                        });
                                        confirmationStatus = 'CANCELLED';
                                        console.log(`❌ Appointment ${appointment.id} actualizado a CANCELLED - paciente rechazó en ${event.externalProvider} Calendar`);
                                    }
                                    else {
                                        console.log(`ℹ️ Appointment ${appointment.id} - paciente tiene estado: ${responseStatus} (no se actualiza)`);
                                    }
                                }
                            }
                        }
                        catch (error) {
                            // No fallar la carga de eventos si hay error verificando el estado
                            console.error(`Error verificando estado de attendee en ${event.externalProvider} Calendar:`, error);
                        }
                    }
                }
            }
            else {
                // Si no se encuentra appointment pero hay paciente, asumir PENDING (cita recién creada)
                if (event.patientId) {
                    confirmationStatus = 'PENDING';
                }
            }
            let displayStart = event.fechaHoraInicio;
            let displayEnd = event.fechaHoraFin;
            let displayLinkMeeting = event.linkMeeting;
            let meetingUrl = null;
            if (event.patientId) {
                const reconciled = await (0, calendarSync_utils_1.reconcileCalendarEventWithAppointment)(doctorId, event);
                if (reconciled.canonicalStart) {
                    displayStart = reconciled.canonicalStart;
                    displayEnd = (_d = reconciled.canonicalEnd) !== null && _d !== void 0 ? _d : displayEnd;
                }
                if (reconciled.appointmentType) {
                    appointmentType = reconciled.appointmentType;
                }
                if (reconciled.appointmentType === 'presencial') {
                    displayLinkMeeting = null;
                }
            }
            if (appointmentType === 'teleconsulta' && appointmentId) {
                const tcRow = await prisma.teleconsultation.findUnique({
                    where: { appointmentId },
                    select: { meetingUrl: true, consentSigned: true },
                });
                const payReq = await (0, mercadopago_teleconsultation_service_1.requiresTeleconsultationPayment)(doctorId, appointmentId);
                const paymentApproved = payReq.required
                    ? await (0, mercadopago_teleconsultation_service_1.isTeleconsultationPaymentApproved)(appointmentId)
                    : true;
                const allowVideo = (0, calendarSync_utils_1.shouldAllowVideoConferenceForAppointment)('teleconsulta', tcRow === null || tcRow === void 0 ? void 0 : tcRow.consentSigned, payReq.required, paymentApproved);
                if (allowVideo) {
                    meetingUrl = displayLinkMeeting || (tcRow === null || tcRow === void 0 ? void 0 : tcRow.meetingUrl) || null;
                    displayLinkMeeting = meetingUrl;
                }
                else {
                    displayLinkMeeting = null;
                    meetingUrl = null;
                }
            }
            let mpDisplay = {
                mpPaymentStatus: 'none',
                refundRequestStatus: null,
                paymentLabel: null,
                calendarHighlight: 'normal',
            };
            if (appointmentId && appointmentType) {
                mpDisplay = await (0, mercadopago_appointment_display_service_1.getAppointmentMercadoPagoDisplayStatus)(doctorId, appointmentId, appointmentType, confirmationStatus);
            }
            return Object.assign(Object.assign({}, event), { fechaHoraInicio: displayStart, fechaHoraFin: displayEnd, linkMeeting: displayLinkMeeting, meetingUrl, confirmationStatus: confirmationStatus || 'PENDING', appointmentId,
                appointmentType,
                teleconsultationAmount, mpPaymentStatus: mpDisplay.mpPaymentStatus, refundRequestStatus: mpDisplay.refundRequestStatus, paymentLabel: mpDisplay.paymentLabel, calendarHighlight: mpDisplay.calendarHighlight });
        }));
        res.json(eventsWithConfirmationStatus);
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener eventos del calendario.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.getCalendarEvents = getCalendarEvents;
// Crear un nuevo evento del calendario
const createCalendarEvent = async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    try {
        console.log('=== INICIO createCalendarEvent ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        const doctorId = await resolveDoctorId(req);
        const doctor = await prisma.doctor.findUnique({
            where: { id: doctorId },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { patientId, fechaHoraInicio, fechaHoraFin, titulo, descripcion, origenEvento = 'interno', linkMeeting, meetingPlatform = '', modalidadConsulta = 'presencial', teleconsultationAmount, offerInPersonMercadoPago, inPersonPaymentAmount, } = req.body;
        const amountValidation = await (0, mercadopago_teleconsultation_service_1.validateTeleconsultationAmountForVirtualAppointment)(doctor.id, modalidadConsulta, teleconsultationAmount, patientId);
        if (!amountValidation.ok) {
            throw new error_utils_1.AppError(amountValidation.message, 400);
        }
        const resolvedTeleconsultationAmount = amountValidation.amount;
        const inPersonValidation = await (0, mercadopago_inperson_service_1.validateInPersonMercadoPagoForPresencialAppointment)(doctor.id, modalidadConsulta, offerInPersonMercadoPago, inPersonPaymentAmount, patientId);
        if (!inPersonValidation.ok) {
            throw new error_utils_1.AppError(inPersonValidation.message, 400);
        }
        // Validaciones
        if (!fechaHoraInicio || !fechaHoraFin || !titulo) {
            throw new error_utils_1.AppError('Faltan campos obligatorios: fechaHoraInicio, fechaHoraFin, titulo', 400);
        }
        // CRÍTICO: Limpiar el título para guardar solo el título original (sin prefijos de estatus)
        // Esto asegura que el título en la base de datos nunca tenga el prefijo "❌ Cita rechazada:"
        const cleanTitleForDB = titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
        if (new Date(fechaHoraInicio) >= new Date(fechaHoraFin)) {
            throw new error_utils_1.AppError('La fecha de inicio debe ser anterior a la fecha de fin', 400);
        }
        // Validación: CUALQUIER cita (presencial o virtual) debe sincronizarse al calendario externo del
        // doctor para que el paciente la reciba en el calendario de su dispositivo. La invitación al paciente
        // se envía a través de ese calendario; sin enlazarlo, el paciente solo recibiría un correo. Para citas
        // virtuales, además, la videollamada (Google Meet / Teams) se genera desde ese mismo calendario.
        const requestedProvider = String(origenEvento || '').toLowerCase();
        if (requestedProvider === 'google' || requestedProvider === 'outlook') {
            const providerConn = await prisma.calendarSyncConfig.findFirst({
                where: { doctorId: doctor.id, provider: requestedProvider, isConnected: true }
            });
            if (!providerConn) {
                const label = requestedProvider === 'google' ? 'Google' : 'Microsoft Outlook';
                throw new error_utils_1.AppError(`Para crear una cita debes enlazar tu calendario de ${label} en Configuración → Calendario. La invitación al calendario del paciente se envía a través de tu calendario; sin enlazarlo, el paciente solo recibiría un correo y no vería la cita en su dispositivo.`, 400);
            }
        }
        // Verificar que el paciente existe y está asociado al doctor
        if (patientId) {
            const patient = await prisma.patient.findFirst({
                where: {
                    id: patientId,
                    doctors: { some: { doctorId: doctor.id } }
                }
            });
            if (!patient) {
                throw new error_utils_1.AppError('Paciente no encontrado o no asociado a este doctor', 404);
            }
        }
        let appointment = null;
        let patient = null;
        let doctorPatient = null;
        console.log('🔍 Verificando paciente para crear appointment...');
        console.log('   patientId recibido:', patientId);
        if (patientId) {
            console.log('   ✅ Hay patientId, buscando DoctorPatient...');
            // Buscar DoctorPatient
            doctorPatient = await prisma.doctorPatient.findFirst({
                where: {
                    doctorId: doctor.id,
                    patientId: patientId
                }
            });
            if (!doctorPatient) {
                console.error('   ❌ ERROR: No se encontró DoctorPatient para doctorId:', doctor.id, 'y patientId:', patientId);
                throw new error_utils_1.AppError('El paciente no está asociado a este doctor', 404);
            }
            console.log('   ✅ DoctorPatient encontrado:', doctorPatient.id);
            // Buscar el User del paciente
            const patientData = await prisma.patient.findUnique({
                where: { id: patientId },
                select: { id: true, userId: true }
            });
            if (!patientData) {
                console.error('   ❌ ERROR: No se encontró Patient con id:', patientId);
                throw new error_utils_1.AppError('Paciente no encontrado', 404);
            }
            patient = patientData;
            const resolvedUserId = await (0, appointmentConfirmation_utils_1.resolvePatientUserIdForAppointment)(patientId);
            patient = Object.assign(Object.assign({}, patient), { userId: resolvedUserId });
            console.log('   Patient encontrado:', patient ? `SÍ (userId: ${patient.userId})` : 'NO');
            console.log('   ✅ Patient tiene userId, buscando/creando appointment...');
            // Buscar si ya existe un appointment para esta fecha/hora (rango acotado para evitar emparejamientos erróneos)
            appointment = await prisma.appointment.findFirst({
                where: {
                    doctorId: doctor.id,
                    patientId: patientId,
                    date: {
                        gte: new Date(new Date(fechaHoraInicio).getTime() - 2 * 60 * 60 * 1000), // 2 horas antes
                        lte: new Date(new Date(fechaHoraInicio).getTime() + 2 * 60 * 60 * 1000) // 2 horas después
                    }
                },
                include: {
                    preConsultation: true
                },
                orderBy: {
                    date: 'desc'
                }
            });
            if (appointment) {
                console.log('   ✅ Appointment existente encontrado:', appointment.id, 'con pre-consulta:', appointment.preConsultation ? 'SÍ' : 'NO');
                const appointmentType = modalidadConsulta === 'virtual' ? 'teleconsulta' : 'presencial';
                appointment = await prisma.appointment.update({
                    where: { id: appointment.id },
                    data: {
                        status: 'SCHEDULED',
                        confirmationStatus: 'PENDING',
                        date: new Date(fechaHoraInicio),
                        appointmentType,
                        teleconsultationAmount: modalidadConsulta === 'virtual' ? resolvedTeleconsultationAmount : null,
                        offerInPersonMercadoPago: modalidadConsulta === 'presencial' ? inPersonValidation.offer : false,
                        inPersonPaymentAmount: modalidadConsulta === 'presencial' ? inPersonValidation.amount : null,
                        userId: patient.userId,
                        cancelledAt: null,
                        cancellationReason: null,
                        notes: `Cita creada desde calendario - ${titulo}`
                    },
                    include: { preConsultation: true }
                });
                console.log('   ♻️ Appointment reactivado/actualizado para nueva cita del calendario');
            }
            else {
                // Si no existe, crear uno nuevo - ESTO ES CRÍTICO
                console.log('   📝 Creando nuevo appointment...');
                console.log('   Datos del appointment:');
                console.log('     doctorId:', doctor.id);
                console.log('     patientId:', patientId);
                console.log('     doctorPatientId:', doctorPatient.id);
                console.log('     userId:', patient.userId);
                console.log('     date:', new Date(fechaHoraInicio));
                try {
                    const appointmentType = modalidadConsulta === 'virtual' ? 'teleconsulta' : 'presencial';
                    appointment = await prisma.appointment.create({
                        data: {
                            doctorId,
                            patientId: patientId,
                            doctorPatientId: doctorPatient.id,
                            userId: patient.userId,
                            date: new Date(fechaHoraInicio),
                            status: 'SCHEDULED',
                            confirmationStatus: 'PENDING', // Explícitamente establecer como PENDING para nuevas citas
                            notes: `Cita creada desde calendario - ${titulo}`,
                            appointmentType,
                            teleconsultationAmount: modalidadConsulta === 'virtual' ? resolvedTeleconsultationAmount : null,
                            offerInPersonMercadoPago: modalidadConsulta === 'presencial' ? inPersonValidation.offer : false,
                            inPersonPaymentAmount: modalidadConsulta === 'presencial' ? inPersonValidation.amount : null,
                        },
                        include: {
                            preConsultation: true
                        }
                    });
                    console.log('   ✅ Appointment creado exitosamente:', appointment.id);
                }
                catch (createError) {
                    console.error('   ❌ ERROR CRÍTICO al crear appointment:');
                    console.error('     Código:', createError === null || createError === void 0 ? void 0 : createError.code);
                    console.error('     Mensaje:', createError === null || createError === void 0 ? void 0 : createError.message);
                    console.error('     Meta:', JSON.stringify(createError === null || createError === void 0 ? void 0 : createError.meta, null, 2));
                    if (createError === null || createError === void 0 ? void 0 : createError.stack) {
                        console.error('     Stack (primeras 15 líneas):');
                        const stackLines = createError.stack.split('\n').slice(0, 15);
                        stackLines.forEach((line) => console.error('       ', line));
                    }
                    // NO continuar sin appointment - esto es crítico
                    throw new error_utils_1.AppError(`Error al crear la cita: ${(createError === null || createError === void 0 ? void 0 : createError.message) || 'Error desconocido'}`, 500);
                }
                // Generar automáticamente pre-consulta si es la primera cita del paciente con este doctor
                try {
                    console.log('🔄 Intentando crear pre-consulta para appointment:', appointment.id);
                    console.log('   Patient ID:', appointment.patientId);
                    console.log('   Doctor ID:', appointment.doctorId);
                    console.log('   Appointment Date:', appointment.date);
                    const preConsultationModule = await Promise.resolve().then(() => __importStar(require('./preConsultation.controller')));
                    const token = await preConsultationModule.createPreConsultationForAppointment(appointment.id);
                    if (token) {
                        console.log('✅ Pre-consulta creada automáticamente al crear evento de calendario, token:', token);
                        // Guardar el ID del appointment antes del loop
                        const appointmentId = appointment.id;
                        // Esperar y recargar múltiples veces hasta que la pre-consulta esté disponible
                        let preConsultationFound = false;
                        const maxRetries = 5;
                        const retryDelay = 1000; // 1 segundo
                        for (let attempt = 1; attempt <= maxRetries; attempt++) {
                            console.log(`   🔄 Intento ${attempt}/${maxRetries} de recargar appointment con pre-consulta...`);
                            await new Promise(resolve => setTimeout(resolve, retryDelay));
                            // Recargar appointment para incluir la pre-consulta
                            appointment = await prisma.appointment.findUnique({
                                where: { id: appointmentId },
                                include: {
                                    preConsultation: true
                                }
                            });
                            if ((appointment === null || appointment === void 0 ? void 0 : appointment.preConsultation) && appointment.preConsultation.status === 'PENDING') {
                                console.log('✅ Appointment recargado con pre-consulta PENDING:');
                                console.log('   Pre-consulta ID:', appointment.preConsultation.id);
                                console.log('   Pre-consulta status:', appointment.preConsultation.status);
                                console.log('   Pre-consulta token:', appointment.preConsultation.token);
                                console.log('   Pre-consulta createdAt:', appointment.preConsultation.createdAt);
                                preConsultationFound = true;
                                break;
                            }
                            else {
                                console.log(`   ⚠️  Intento ${attempt}: Pre-consulta aún no disponible en appointment`);
                                if (appointment === null || appointment === void 0 ? void 0 : appointment.preConsultation) {
                                    console.log('   Status actual:', appointment.preConsultation.status);
                                }
                            }
                        }
                        if (!preConsultationFound) {
                            console.warn('   ⚠️  ADVERTENCIA: La pre-consulta no se encontró después de todos los intentos');
                            console.warn('   Esto puede indicar un problema de timing en la base de datos');
                            console.warn('   El email se enviará sin el link de pre-consulta, pero se intentará buscar después');
                        }
                    }
                    else {
                        console.log('⚠️  No se creó pre-consulta (no es primera cita o ya existe consulta médica)');
                        console.log('   Verificando razones:');
                        console.log('   - Puede que el paciente ya tenga citas anteriores con este doctor');
                        console.log('   - Puede que ya exista una consulta médica previa');
                    }
                }
                catch (preConsultationError) {
                    console.error('❌ Error generando pre-consulta automática desde calendario:', preConsultationError);
                    if (preConsultationError instanceof Error) {
                        console.error('   Mensaje:', preConsultationError.message);
                        console.error('   Stack trace:', preConsultationError.stack);
                    }
                    // No fallar la creación del evento si la pre-consulta falla, pero registrar el error
                }
            }
        }
        const isTeleconsulta = modalidadConsulta === 'virtual' || (appointment === null || appointment === void 0 ? void 0 : appointment.appointmentType) === 'teleconsulta';
        if ((appointment === null || appointment === void 0 ? void 0 : appointment.appointmentType) === 'teleconsulta') {
            try {
                await prisma.teleconsultation.upsert({
                    where: { appointmentId: appointment.id },
                    create: { appointmentId: appointment.id, videoProvider: 'google_meet', consentSigned: false },
                    update: {}
                });
            }
            catch (e) {
                console.error('Error upsert Teleconsultation al crear evento:', e);
            }
        }
        const eventInclude = {
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
        // Si la cita fue reutilizada y ya tiene un evento de calendario enlazado, actualizamos ese
        // evento en lugar de crear uno nuevo (el vínculo appointmentId es @unique).
        const existingLinkedEvent = (appointment === null || appointment === void 0 ? void 0 : appointment.id)
            ? await prisma.internalCalendarEvent.findUnique({ where: { appointmentId: appointment.id } })
            : null;
        let event = existingLinkedEvent
            ? await prisma.internalCalendarEvent.update({
                where: { id: existingLinkedEvent.id },
                data: {
                    doctorId: doctor.id,
                    patientId,
                    fechaHoraInicio: new Date(fechaHoraInicio),
                    fechaHoraFin: new Date(fechaHoraFin),
                    titulo: cleanTitleForDB,
                    descripcion,
                    origenEvento,
                    linkMeeting: isTeleconsulta ? null : linkMeeting
                },
                include: eventInclude
            })
            : await prisma.internalCalendarEvent.create({
                data: {
                    doctorId: doctor.id,
                    patientId,
                    appointmentId: (_a = appointment === null || appointment === void 0 ? void 0 : appointment.id) !== null && _a !== void 0 ? _a : null, // Vínculo duro cita↔evento para evitar colisiones por heurística
                    fechaHoraInicio: new Date(fechaHoraInicio),
                    fechaHoraFin: new Date(fechaHoraFin),
                    titulo: cleanTitleForDB, // Guardar solo el título limpio (sin prefijo de estatus)
                    descripcion,
                    origenEvento,
                    linkMeeting: isTeleconsulta ? null : linkMeeting,
                    creadoPor: doctor.id
                },
                include: eventInclude
            });
        console.log('✅ Evento de calendario creado:', event.id);
        console.log('   Paciente asociado:', event.patient ? `${event.patient.firstName} ${event.patient.lastName}` : 'NINGUNO');
        console.log('   Email del paciente (Patient.email):', ((_b = event.patient) === null || _b === void 0 ? void 0 : _b.email) || 'NO DISPONIBLE');
        console.log('   Patient userId:', ((_c = event.patient) === null || _c === void 0 ? void 0 : _c.userId) || 'NO DISPONIBLE');
        console.log('   LinkMeeting:', event.linkMeeting || 'NO DISPONIBLE');
        console.log('   Meeting Platform:', meetingPlatform || 'NO ESPECIFICADO');
        // Verificar si el doctor tiene calendarios externos configurados
        const hasGoogleCalendar = await (0, calendarSync_utils_1.isDoctorGoogleCalendarOperational)(doctor.id);
        const hasOutlookCalendar = await prisma.calendarSyncConfig.findFirst({
            where: {
                doctorId: doctor.id,
                provider: 'outlook',
                isConnected: true,
                accessToken: { not: null }
            }
        });
        const hasAppleCalendar = await prisma.calendarSyncConfig.findFirst({
            where: {
                doctorId: doctor.id,
                provider: 'apple',
                isConnected: true
            }
        });
        // CRÍTICO: Si el evento tiene un paciente, SIEMPRE sincronizar con un calendario externo
        // para que el paciente reciba la invitación de calendario
        // Prioridad: 1) Calendario del origen del evento (si está conectado)
        //            2) Primer calendario disponible del doctor (Google > Outlook > Apple)
        //            3) Si no hay calendarios externos conectados, no se puede sincronizar
        // Si hay un paciente, SIEMPRE intentar sincronizar con un calendario externo
        // Prioridad: usar el calendario seleccionado si está conectado, si no, usar el primero disponible
        let shouldSyncWithGoogle = false;
        let shouldSyncWithOutlook = false;
        let shouldSyncWithApple = false;
        let shouldSyncWithNotion = false;
        if (patientId) {
            // Si hay paciente, SIEMPRE sincronizar con un calendario externo
            // Prioridad 1: Calendario seleccionado en origenEvento (si está conectado)
            if (origenEvento === 'google' && hasGoogleCalendar) {
                shouldSyncWithGoogle = true;
            }
            else if (origenEvento === 'outlook' && hasOutlookCalendar) {
                shouldSyncWithOutlook = true;
            }
            else if (origenEvento === 'apple' && hasAppleCalendar) {
                shouldSyncWithApple = true;
            }
            else {
                // Prioridad 2: Usar el primer calendario disponible (Google > Outlook > Apple)
                if (hasGoogleCalendar) {
                    shouldSyncWithGoogle = true;
                }
                else if (hasOutlookCalendar) {
                    shouldSyncWithOutlook = true;
                }
                else if (hasAppleCalendar) {
                    shouldSyncWithApple = true;
                }
            }
            // Si hay meeting platform específico, forzar ese calendario
            if (meetingPlatform === 'google-meet' && hasGoogleCalendar) {
                shouldSyncWithGoogle = true;
                shouldSyncWithOutlook = false;
                shouldSyncWithApple = false;
            }
            else if (meetingPlatform === 'teams' && hasOutlookCalendar) {
                shouldSyncWithOutlook = true;
                shouldSyncWithGoogle = false;
                shouldSyncWithApple = false;
            }
        }
        else {
            // Sin paciente: sincronizar según el origen del evento
            if (origenEvento === 'google' && hasGoogleCalendar) {
                shouldSyncWithGoogle = true;
            }
            else if (origenEvento === 'outlook' && hasOutlookCalendar) {
                shouldSyncWithOutlook = true;
            }
            else if (origenEvento === 'apple' && hasAppleCalendar) {
                shouldSyncWithApple = true;
            }
            else if (origenEvento === 'notion') {
                shouldSyncWithNotion = true;
            }
        }
        const wantsGoogleConference = meetingPlatform === 'google-meet' ||
            (!!event.linkMeeting && event.linkMeeting.includes('meet.google.com'));
        const wantsOutlookConference = meetingPlatform === 'teams';
        let calendarSyncWarning;
        // Función auxiliar para obtener el email del paciente
        const getPatientEmail = async (patient) => {
            if (!patient)
                return null;
            // Primero intentar desde Patient.email
            if (patient.email)
                return patient.email;
            // Si no está, obtener desde User.email
            if (patient.userId) {
                const patientUser = await prisma.user.findUnique({
                    where: { id: patient.userId },
                    select: { email: true }
                });
                return (patientUser === null || patientUser === void 0 ? void 0 : patientUser.email) || null;
            }
            return null;
        };
        if (shouldSyncWithGoogle) {
            try {
                // CRÍTICO: Obtener el email del paciente correctamente
                const patientEmail = await getPatientEmail(event.patient);
                // CRÍTICO: Incluir el email del paciente como attendee para que reciba la invitación
                const attendees = patientEmail ? [patientEmail] : [];
                console.log('📅 Sincronizando con Google Calendar...');
                console.log('   Email del paciente obtenido:', patientEmail || 'NO DISPONIBLE');
                console.log('   Attendees (pacientes):', attendees.length > 0 ? attendees.join(', ') : 'NINGUNO');
                console.log('   ⚠️  Si no hay attendees, el paciente NO recibirá la invitación al calendario');
                // Limpiar el título: remover cualquier prefijo de estatus que pueda tener
                const cleanTitle = event.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
                const syncDescription = await buildDescriptionWithManageLink({
                    doctorId: doctor.id,
                    patientId: (_e = (_d = event.patient) === null || _d === void 0 ? void 0 : _d.id) !== null && _e !== void 0 ? _e : null,
                    fechaHoraInicio: event.fechaHoraInicio,
                    descripcion: event.descripcion
                });
                const syncResult = await googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent(doctor.id, {
                    id: event.id,
                    title: cleanTitle,
                    description: syncDescription,
                    start: event.fechaHoraInicio,
                    end: event.fechaHoraFin,
                    attendees,
                    externalEventId: (_f = event.externalEventId) !== null && _f !== void 0 ? _f : undefined,
                    location: wantsGoogleConference ? ((_g = event.linkMeeting) !== null && _g !== void 0 ? _g : undefined) : undefined,
                    conferenceType: wantsGoogleConference ? 'google-meet' : null,
                    conferenceLink: wantsGoogleConference ? ((_h = event.linkMeeting) !== null && _h !== void 0 ? _h : undefined) : undefined,
                    googleMeetEnabled: wantsGoogleConference,
                    disableConference: !wantsGoogleConference,
                    sendUpdates: (0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
                        externalEventId: event.externalEventId,
                        attendeeCount: attendees.length,
                        notifyAttendees: true,
                    }),
                });
                if (syncResult) {
                    console.log('✅ Evento sincronizado exitosamente con Google Calendar');
                    console.log('   External Event ID:', syncResult.externalEventId);
                    console.log('   Conference Link:', syncResult.conferenceLink || 'NO DISPONIBLE');
                    console.log('   📧 Las invitaciones se enviaron automáticamente a los attendees');
                    const updateData = {
                        externalProvider: 'google',
                        externalEventId: syncResult.externalEventId,
                        externalUpdatedAt: syncResult.externalUpdatedAt
                    };
                    if (wantsGoogleConference && syncResult.conferenceLink) {
                        updateData.linkMeeting = syncResult.conferenceLink;
                    }
                    if (!wantsGoogleConference) {
                        updateData.linkMeeting = null;
                    }
                    event = await prisma.internalCalendarEvent.update({
                        where: { id: event.id },
                        data: updateData,
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
                }
                else {
                    const errMsg = 'No se pudo sincronizar con Google Calendar. El paciente podría no recibir la invitación al calendario.';
                    calendarSyncWarning = errMsg;
                    await (0, calendarSync_utils_1.recordCalendarProviderSyncError)(doctor.id, 'google', errMsg);
                    console.warn('⚠️  No se obtuvo resultado de sincronización con Google Calendar');
                }
            }
            catch (error) {
                const errMsg = (error === null || error === void 0 ? void 0 : error.message) ||
                    'Error al sincronizar con Google Calendar. El paciente podría no recibir la invitación.';
                calendarSyncWarning = errMsg;
                console.error('❌ ERROR CRÍTICO sincronizando evento con Google Calendar:', error);
            }
        }
        if (shouldSyncWithOutlook) {
            try {
                // CRÍTICO: Obtener el email del paciente correctamente
                const patientEmail = await getPatientEmail(event.patient);
                const attendees = patientEmail ? [patientEmail] : [];
                console.log('📅 Sincronizando con Outlook Calendar...');
                console.log('   Email del paciente obtenido:', patientEmail || 'NO DISPONIBLE');
                console.log('   Attendees (pacientes):', attendees.length > 0 ? attendees.join(', ') : 'NINGUNO');
                // Limpiar el título: remover cualquier prefijo de estatus que pueda tener
                const cleanTitle = event.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
                const syncDescription = await buildDescriptionWithManageLink(event);
                const syncResult = await outlookCalendarSync_service_1.OutlookCalendarSyncService.upsertEvent(doctor.id, {
                    id: event.id,
                    title: cleanTitle,
                    description: syncDescription,
                    start: event.fechaHoraInicio,
                    end: event.fechaHoraFin,
                    attendees,
                    location: (_j = event.linkMeeting) !== null && _j !== void 0 ? _j : undefined,
                    externalEventId: (_k = event.externalEventId) !== null && _k !== void 0 ? _k : undefined,
                    teamsEnabled: wantsOutlookConference,
                    disableConference: !wantsOutlookConference,
                    conferenceLink: (_l = event.linkMeeting) !== null && _l !== void 0 ? _l : undefined
                });
                if (syncResult) {
                    const updateData = {
                        externalProvider: 'outlook',
                        externalEventId: syncResult.externalEventId,
                        externalUpdatedAt: syncResult.externalUpdatedAt
                    };
                    if (wantsOutlookConference && syncResult.conferenceLink) {
                        updateData.linkMeeting = syncResult.conferenceLink;
                    }
                    if (!wantsOutlookConference) {
                        updateData.linkMeeting = null;
                    }
                    event = await prisma.internalCalendarEvent.update({
                        where: { id: event.id },
                        data: updateData,
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
                }
            }
            catch (error) {
                console.error('Error syncing created event to Outlook:', error);
            }
        }
        if (shouldSyncWithApple) {
            try {
                // CRÍTICO: Obtener el email del paciente correctamente
                const patientEmail = await getPatientEmail(event.patient);
                const attendees = patientEmail ? [patientEmail] : [];
                console.log('📅 Sincronizando con Apple Calendar...');
                console.log('   Email del paciente obtenido:', patientEmail || 'NO DISPONIBLE');
                // Limpiar el título: remover cualquier prefijo de estatus que pueda tener
                const cleanTitle = event.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
                const syncDescription = await buildDescriptionWithManageLink(event);
                const syncResult = await appleCalendarSync_service_1.AppleCalendarSyncService.upsertEvent(doctor.id, {
                    id: event.id,
                    title: cleanTitle,
                    description: syncDescription,
                    start: event.fechaHoraInicio,
                    end: event.fechaHoraFin,
                    attendees,
                    externalEventId: (_m = event.externalEventId) !== null && _m !== void 0 ? _m : undefined
                });
                if (syncResult) {
                    event = await prisma.internalCalendarEvent.update({
                        where: { id: event.id },
                        data: {
                            externalProvider: 'apple',
                            externalEventId: syncResult.externalEventId,
                            externalUpdatedAt: syncResult.externalUpdatedAt
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
                }
            }
            catch (error) {
                console.error('Error syncing created event to Apple Calendar:', error);
            }
        }
        if (shouldSyncWithNotion) {
            try {
                const attendees = ((_o = event.patient) === null || _o === void 0 ? void 0 : _o.email) ? [event.patient.email] : [];
                const syncDescription = await buildDescriptionWithManageLink(event);
                const syncResult = await notionCalendarSync_service_1.NotionCalendarSyncService.upsertEvent(doctor.id, {
                    id: event.id,
                    title: event.titulo,
                    description: syncDescription,
                    start: event.fechaHoraInicio,
                    end: event.fechaHoraFin,
                    attendees,
                    location: (_p = event.linkMeeting) !== null && _p !== void 0 ? _p : undefined,
                    externalEventId: (_q = event.externalEventId) !== null && _q !== void 0 ? _q : undefined,
                    linkMeeting: (_r = event.linkMeeting) !== null && _r !== void 0 ? _r : undefined
                });
                if (syncResult) {
                    event = await prisma.internalCalendarEvent.update({
                        where: { id: event.id },
                        data: {
                            externalProvider: 'notion',
                            externalEventId: syncResult.externalEventId,
                            externalUpdatedAt: syncResult.externalUpdatedAt
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
                }
            }
            catch (error) {
                console.error('Error syncing created event to Notion:', error);
            }
        }
        // Teleconsultation: meetingUrl solo después de firmar consentimiento (syncAppointmentCalendars tras firma)
        if (appointment && appointment.appointmentType === 'teleconsulta') {
            const videoProvider = event.externalProvider === 'google' ? 'google_meet' : event.externalProvider === 'outlook' ? 'teams' : 'google_meet';
            try {
                await prisma.teleconsultation.upsert({
                    where: { appointmentId: appointment.id },
                    create: {
                        appointmentId: appointment.id,
                        videoProvider,
                        externalEventId: event.externalEventId,
                        meetingUrl: null
                    },
                    update: {
                        videoProvider,
                        externalEventId: event.externalEventId,
                        meetingUrl: null
                    }
                });
            }
            catch (tcError) {
                console.error('Error creando/actualizando Teleconsultation:', tcError);
            }
        }
        // CRÍTICO: Verificar si hay un paciente pero no se sincronizó con ningún calendario externo
        if (patientId && !shouldSyncWithGoogle && !shouldSyncWithOutlook && !shouldSyncWithApple && !shouldSyncWithNotion) {
            console.error('❌ ERROR CRÍTICO: Hay un paciente asociado pero NO se sincronizó con ningún calendario externo');
            console.error('   El paciente NO recibirá la invitación de calendario');
            console.error('   Razón: No hay calendarios externos conectados o el calendario seleccionado no está disponible');
            console.error('   Solución: El doctor debe conectar al menos un calendario (Google, Outlook o Apple) en la configuración');
            console.error('   Origen del evento seleccionado:', origenEvento);
            console.error('   Calendarios disponibles:');
            console.error('     - Google Calendar:', hasGoogleCalendar ? '✅ Conectado' : '❌ No conectado');
            console.error('     - Outlook:', hasOutlookCalendar ? '✅ Conectado' : '❌ No conectado');
            console.error('     - Apple Calendar:', hasAppleCalendar ? '✅ Conectado' : '❌ No conectado');
        }
        // Enviar email automáticamente al paciente si hay un paciente asociado
        // IMPORTANTE: Esperar 12 segundos antes de enviar el email para dar tiempo a que la pre-consulta se cree completamente
        if (event.patient) {
            // CRÍTICO: Verificar que el appointment existe si hay un patientId
            if (patientId && !appointment) {
                console.error('❌ ERROR CRÍTICO: Hay patientId pero no se creó el appointment');
                console.error('   Esto NO debería pasar - el appointment debería haberse creado antes');
                // Intentar crear el appointment ahora como último recurso
                if (patient && patient.userId && doctorPatient) {
                    try {
                        console.log('🔄 ÚLTIMO RECURSO: Intentando crear appointment ahora...');
                        appointment = await prisma.appointment.create({
                            data: {
                                doctorId: doctor.id,
                                patientId: patientId,
                                doctorPatientId: doctorPatient.id,
                                userId: patient.userId,
                                date: new Date(fechaHoraInicio),
                                status: 'SCHEDULED',
                                confirmationStatus: 'PENDING', // Explícitamente establecer como PENDING para nuevas citas
                                notes: `Cita creada desde calendario - ${titulo} (último recurso)`
                            },
                            include: {
                                preConsultation: true
                            }
                        });
                        console.log('✅ Appointment creado en último recurso:', appointment.id);
                    }
                    catch (lastResortError) {
                        console.error('❌ ERROR: No se pudo crear appointment ni siquiera en último recurso:', lastResortError === null || lastResortError === void 0 ? void 0 : lastResortError.message);
                    }
                }
            }
            // Guardar el appointmentId y el link de pre-consulta (si existe) para usarlo en el setTimeout
            const appointmentIdToUse = (appointment === null || appointment === void 0 ? void 0 : appointment.id) || null;
            const eventIdToUse = event.id;
            const doctorIdToUse = doctor.id;
            // Generar el link de pre-consulta inmediatamente si existe
            // IMPORTANTE: Si la pre-consulta se creó pero no está en el appointment, buscarla directamente
            let preConsultationLinkToUse = undefined;
            if ((appointment === null || appointment === void 0 ? void 0 : appointment.preConsultation) && appointment.preConsultation.status === 'PENDING') {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                preConsultationLinkToUse = `${frontendUrl}/pre-consulta/${appointment.preConsultation.token}`;
                console.log('✅ Link de pre-consulta generado inmediatamente:', preConsultationLinkToUse);
                console.log('   Pre-consulta ID:', appointment.preConsultation.id);
                console.log('   Pre-consulta token:', appointment.preConsultation.token);
                console.log('   Pre-consulta status:', appointment.preConsultation.status);
            }
            else if (appointmentIdToUse) {
                // Si no está en el appointment pero tenemos el ID, buscar directamente
                console.log('🔍 Pre-consulta no está en appointment, buscando directamente en DB...');
                try {
                    const directPreConsultation = await prisma.preConsultation.findUnique({
                        where: { appointmentId: appointmentIdToUse }
                    });
                    if (directPreConsultation && directPreConsultation.status === 'PENDING') {
                        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                        preConsultationLinkToUse = `${frontendUrl}/pre-consulta/${directPreConsultation.token}`;
                        console.log('✅ Pre-consulta encontrada directamente en DB:', preConsultationLinkToUse);
                        console.log('   Pre-consulta ID:', directPreConsultation.id);
                        console.log('   Pre-consulta token:', directPreConsultation.token);
                        console.log('   Pre-consulta status:', directPreConsultation.status);
                    }
                    else {
                        console.log('⚠️  No se generó link inmediatamente porque:');
                        console.log('   - Appointment existe?:', appointment ? 'SÍ' : 'NO');
                        console.log('   - Pre-consulta existe en DB?:', directPreConsultation ? 'SÍ' : 'NO');
                        if (directPreConsultation) {
                            console.log('   - Pre-consulta status:', directPreConsultation.status);
                        }
                    }
                }
                catch (searchError) {
                    console.error('   ❌ Error buscando pre-consulta directamente:', (searchError === null || searchError === void 0 ? void 0 : searchError.message) || searchError);
                }
            }
            else {
                console.log('⚠️  No se generó link inmediatamente porque:');
                console.log('   - Appointment existe?:', appointment ? 'SÍ' : 'NO');
                console.log('   - Appointment ID disponible?:', appointmentIdToUse ? 'SÍ' : 'NO');
                console.log('   - Pre-consulta existe?:', (appointment === null || appointment === void 0 ? void 0 : appointment.preConsultation) ? 'SÍ' : 'NO');
                if (appointment === null || appointment === void 0 ? void 0 : appointment.preConsultation) {
                    console.log('   - Pre-consulta status:', appointment.preConsultation.status);
                }
            }
            console.log('📧 Preparando envío de email automático...');
            console.log('   Event ID:', eventIdToUse);
            console.log('   Appointment ID:', appointmentIdToUse || 'NO DISPONIBLE');
            console.log('   Doctor ID:', doctorIdToUse);
            console.log('   Patient ID:', event.patient.id);
            console.log('   Patient userId:', event.patient.userId || 'NO DISPONIBLE');
            console.log('   Pre-consulta link disponible:', preConsultationLinkToUse ? `SÍ (${preConsultationLinkToUse})` : 'NO');
            // Verificar que tenemos appointment si hay patientId
            if (patientId && !appointmentIdToUse) {
                console.error('⚠️  ADVERTENCIA: Hay patientId pero no hay appointmentId - el email puede no incluir el link de pre-consulta');
            }
            // Enviar el email de forma asíncrona después de un delay para no bloquear la respuesta
            // Reducido a 3 segundos para dar tiempo a que se complete la sincronización con calendarios externos
            setTimeout(async () => {
                var _a, _b, _c, _d;
                try {
                    console.log('⏳ Esperando 3 segundos antes de buscar pre-consulta y enviar email...');
                    console.log('   Event ID:', eventIdToUse);
                    console.log('   Appointment ID:', appointmentIdToUse || 'NO DISPONIBLE');
                    // Recargar el evento para obtener el linkMeeting actualizado (por si se generó después de la creación)
                    const updatedEvent = await prisma.internalCalendarEvent.findUnique({
                        where: { id: eventIdToUse },
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
                    if (!updatedEvent || !updatedEvent.patient) {
                        console.warn('⚠️  No se puede enviar email: el evento o paciente no existe');
                        return;
                    }
                    // Obtener el email del paciente correctamente usando la función auxiliar
                    const patientEmail = await getPatientEmail(updatedEvent.patient);
                    if (!patientEmail) {
                        console.warn('⚠️  No se puede enviar email: el paciente no tiene email registrado');
                        console.log('   Patient ID:', updatedEvent.patient.id);
                        console.log('   Patient email field:', updatedEvent.patient.email);
                        console.log('   Patient userId:', updatedEvent.patient.userId);
                        return;
                    }
                    console.log('📧 Preparando envío de email automático a:', patientEmail);
                    console.log('   LinkMeeting del evento:', updatedEvent.linkMeeting || 'NO DISPONIBLE');
                    // Recargar el doctor para obtener el nombre
                    const updatedDoctor = await prisma.doctor.findUnique({
                        where: { id: doctorIdToUse },
                        include: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    });
                    if (!updatedDoctor) {
                        console.error('❌ No se puede enviar email: doctor no encontrado');
                        return;
                    }
                    const emailService = notification_service_1.EmailService.getInstance();
                    const doctorName = `${updatedDoctor.user.firstName} ${updatedDoctor.user.lastName}`;
                    const patientName = `${updatedEvent.patient.firstName} ${updatedEvent.patient.lastName}`;
                    // Usar el link de pre-consulta que ya generamos, o buscar uno nuevo si no lo tenemos
                    let preConsultationLink = preConsultationLinkToUse;
                    // Si no tenemos el link pero tampoco tenemos appointmentId, intentar buscar el appointment por paciente y fecha
                    if (!preConsultationLink && !appointmentIdToUse && ((_a = updatedEvent.patient) === null || _a === void 0 ? void 0 : _a.id)) {
                        console.log('   🔍 No tenemos appointmentId, buscando appointment por paciente y fecha...');
                        try {
                            // Buscar en un rango más amplio (24 horas antes y después)
                            const foundAppointment = await prisma.appointment.findFirst({
                                where: {
                                    patientId: updatedEvent.patient.id,
                                    doctorId: doctorIdToUse,
                                    date: {
                                        gte: new Date(updatedEvent.fechaHoraInicio.getTime() - 24 * 60 * 60 * 1000), // 24 horas antes
                                        lte: new Date(updatedEvent.fechaHoraInicio.getTime() + 24 * 60 * 60 * 1000) // 24 horas después
                                    }
                                },
                                include: {
                                    preConsultation: true
                                },
                                orderBy: {
                                    date: 'desc'
                                }
                            });
                            if (foundAppointment) {
                                console.log('   ✅ Appointment encontrado por búsqueda:', foundAppointment.id);
                                if (foundAppointment.preConsultation && foundAppointment.preConsultation.status === 'PENDING') {
                                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                                    preConsultationLink = `${frontendUrl}/pre-consulta/${foundAppointment.preConsultation.token}`;
                                    console.log('   ✅ Link de pre-consulta generado desde appointment encontrado:', preConsultationLink);
                                }
                                else {
                                    console.log('   ⚠️  Appointment encontrado pero sin pre-consulta PENDING');
                                    // Intentar crear la pre-consulta si no existe
                                    if (foundAppointment && !foundAppointment.preConsultation) {
                                        console.log('   🔄 Intentando crear pre-consulta para appointment encontrado...');
                                        try {
                                            const preConsultationModule = await Promise.resolve().then(() => __importStar(require('./preConsultation.controller')));
                                            const token = await preConsultationModule.createPreConsultationForAppointment(foundAppointment.id);
                                            if (token) {
                                                // Recargar appointment para obtener la pre-consulta
                                                const reloadedAppointment = await prisma.appointment.findUnique({
                                                    where: { id: foundAppointment.id },
                                                    include: { preConsultation: true }
                                                });
                                                if (((_b = reloadedAppointment === null || reloadedAppointment === void 0 ? void 0 : reloadedAppointment.preConsultation) === null || _b === void 0 ? void 0 : _b.status) === 'PENDING') {
                                                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                                                    preConsultationLink = `${frontendUrl}/pre-consulta/${reloadedAppointment.preConsultation.token}`;
                                                    console.log('   ✅ Pre-consulta creada y link generado:', preConsultationLink);
                                                }
                                            }
                                        }
                                        catch (createError) {
                                            console.error('   ❌ Error creando pre-consulta para appointment encontrado:', (createError === null || createError === void 0 ? void 0 : createError.message) || createError);
                                        }
                                    }
                                }
                            }
                            else {
                                console.log('   ⚠️  No se encontró appointment por búsqueda');
                                // ÚLTIMO RECURSO: Buscar cualquier pre-consulta PENDING para este paciente y doctor
                                console.log('   🔍 ÚLTIMO RECURSO: Buscando pre-consulta directamente en DB...');
                                try {
                                    const directPreConsultation = await prisma.preConsultation.findFirst({
                                        where: {
                                            patientId: updatedEvent.patient.id,
                                            doctorId: doctorIdToUse,
                                            status: 'PENDING',
                                            expiresAt: { gt: new Date() }
                                        },
                                        orderBy: {
                                            createdAt: 'desc'
                                        }
                                    });
                                    if (directPreConsultation) {
                                        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                                        preConsultationLink = `${frontendUrl}/pre-consulta/${directPreConsultation.token}`;
                                        console.log('   ✅ Pre-consulta encontrada directamente en DB (último recurso):', preConsultationLink);
                                    }
                                    else {
                                        console.log('   ❌ No se encontró pre-consulta PENDING en DB');
                                    }
                                }
                                catch (directSearchError) {
                                    console.error('   ❌ Error buscando pre-consulta directamente:', (directSearchError === null || directSearchError === void 0 ? void 0 : directSearchError.message) || directSearchError);
                                }
                            }
                        }
                        catch (searchError) {
                            console.error('   ❌ Error buscando appointment por paciente y fecha:', (searchError === null || searchError === void 0 ? void 0 : searchError.message) || searchError);
                        }
                    }
                    // Si no tenemos el link, buscar el appointment y la pre-consulta usando el appointmentId
                    if (!preConsultationLink && appointmentIdToUse) {
                        console.log('=== DIAGNÓSTICO PRE-CONSULTA (después de delay) ===');
                        console.log('   No teníamos link guardado, buscando pre-consulta...');
                        console.log('   Appointment ID:', appointmentIdToUse);
                        // Primero intentar recargar el appointment completo con la pre-consulta
                        try {
                            const reloadedAppointment = await prisma.appointment.findUnique({
                                where: { id: appointmentIdToUse },
                                include: {
                                    preConsultation: true,
                                    doctor: {
                                        include: {
                                            user: {
                                                select: {
                                                    id: true,
                                                    email: true,
                                                    phone: true,
                                                    firstName: true,
                                                    lastName: true
                                                }
                                            }
                                        }
                                    },
                                    patient: {
                                        include: {
                                            user: {
                                                select: {
                                                    id: true,
                                                    email: true,
                                                    phone: true,
                                                    firstName: true,
                                                    lastName: true
                                                }
                                            }
                                        }
                                    }
                                }
                            });
                            if ((reloadedAppointment === null || reloadedAppointment === void 0 ? void 0 : reloadedAppointment.preConsultation) && reloadedAppointment.preConsultation.status === 'PENDING') {
                                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                                preConsultationLink = `${frontendUrl}/pre-consulta/${reloadedAppointment.preConsultation.token}`;
                                console.log('✅ Pre-consulta encontrada al recargar appointment, link generado:', preConsultationLink);
                            }
                            else if (reloadedAppointment && !reloadedAppointment.preConsultation) {
                                console.log('⚠️  Appointment existe pero no tiene pre-consulta asociada');
                                // Intentar crear la pre-consulta si no existe
                                try {
                                    const preConsultationModule = await Promise.resolve().then(() => __importStar(require('./preConsultation.controller')));
                                    const token = await preConsultationModule.createPreConsultationForAppointment(appointmentIdToUse);
                                    if (token) {
                                        // Esperar un momento y recargar
                                        await new Promise(resolve => setTimeout(resolve, 2000));
                                        const finalAppointment = await prisma.appointment.findUnique({
                                            where: { id: appointmentIdToUse },
                                            include: {
                                                preConsultation: true,
                                                doctor: {
                                                    include: {
                                                        user: {
                                                            select: {
                                                                id: true,
                                                                email: true,
                                                                phone: true,
                                                                firstName: true,
                                                                lastName: true
                                                            }
                                                        }
                                                    }
                                                },
                                                patient: {
                                                    include: {
                                                        user: {
                                                            select: {
                                                                id: true,
                                                                email: true,
                                                                phone: true,
                                                                firstName: true,
                                                                lastName: true
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        });
                                        if (((_c = finalAppointment === null || finalAppointment === void 0 ? void 0 : finalAppointment.preConsultation) === null || _c === void 0 ? void 0 : _c.status) === 'PENDING') {
                                            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                                            preConsultationLink = `${frontendUrl}/pre-consulta/${finalAppointment.preConsultation.token}`;
                                            console.log('✅ Pre-consulta creada y link generado:', preConsultationLink);
                                        }
                                    }
                                }
                                catch (createError) {
                                    console.error('❌ Error creando pre-consulta:', (createError === null || createError === void 0 ? void 0 : createError.message) || createError);
                                }
                            }
                        }
                        catch (reloadError) {
                            console.error('❌ Error recargando appointment:', (reloadError === null || reloadError === void 0 ? void 0 : reloadError.message) || reloadError);
                        }
                        // Si aún no tenemos el link, buscar directamente en la tabla de pre-consultas
                        if (!preConsultationLink) {
                            console.log('🔍 Buscando pre-consulta directamente en la tabla...');
                            const maxAttempts = 5;
                            const delayMs = 2000; // 2 segundos entre intentos
                            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                                console.log(`🔍 Intento ${attempt}/${maxAttempts}...`);
                                const preConsultation = await prisma.preConsultation.findUnique({
                                    where: { appointmentId: appointmentIdToUse }
                                });
                                if (preConsultation && preConsultation.status === 'PENDING') {
                                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                                    preConsultationLink = `${frontendUrl}/pre-consulta/${preConsultation.token}`;
                                    console.log('✅ Pre-consulta PENDING encontrada, link generado:', preConsultationLink);
                                    break;
                                }
                                if (attempt < maxAttempts) {
                                    console.log(`   No encontrada, esperando ${delayMs}ms antes del siguiente intento...`);
                                    await new Promise(resolve => setTimeout(resolve, delayMs));
                                }
                            }
                        }
                        if (!preConsultationLink) {
                            console.log('❌ No se encontró pre-consulta después de todos los intentos');
                            console.log('   Posibles razones:');
                            console.log('   - No es la primera cita del paciente con este doctor');
                            console.log('   - Ya existe una consulta médica previa');
                            console.log('   - Hubo un error al crear la pre-consulta');
                            console.log('   🔄 ÚLTIMO INTENTO: Intentando crear pre-consulta ahora...');
                            // ÚLTIMO RECURSO: Intentar crear la pre-consulta ahora mismo
                            try {
                                const preConsultationModule = await Promise.resolve().then(() => __importStar(require('./preConsultation.controller')));
                                const token = await preConsultationModule.createPreConsultationForAppointment(appointmentIdToUse);
                                if (token) {
                                    console.log('   ✅ Pre-consulta creada en último recurso, token:', token);
                                    // Esperar un momento y buscar de nuevo
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    const finalPreConsultation = await prisma.preConsultation.findUnique({
                                        where: { appointmentId: appointmentIdToUse }
                                    });
                                    if (finalPreConsultation && finalPreConsultation.status === 'PENDING') {
                                        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                                        preConsultationLink = `${frontendUrl}/pre-consulta/${finalPreConsultation.token}`;
                                        console.log('   ✅ Pre-consulta encontrada después de crear en último recurso:', preConsultationLink);
                                    }
                                }
                                else {
                                    console.log('   ⚠️  No se pudo crear pre-consulta en último recurso (no es primera cita o ya existe consulta médica)');
                                }
                            }
                            catch (lastResortError) {
                                console.error('   ❌ Error en último recurso creando pre-consulta:', (lastResortError === null || lastResortError === void 0 ? void 0 : lastResortError.message) || lastResortError);
                            }
                        }
                        console.log('=== FIN DIAGNÓSTICO ===');
                    }
                    else if (!preConsultationLink) {
                        console.log('⚠️  No hay appointment ID disponible, no se puede buscar pre-consulta');
                        console.log('   Esto puede pasar si:');
                        console.log('   - No existe DoctorPatient para este doctor y paciente');
                        console.log('   - El paciente no tiene userId');
                        console.log('   - El appointment no se creó correctamente');
                    }
                    else {
                        console.log('✅ Usando link de pre-consulta que se generó al crear el evento');
                    }
                    console.log('📧 ========================================');
                    console.log('📧 VALOR FINAL DE preConsultationLink ANTES DE ENVIAR EMAIL:');
                    console.log('📧   Valor:', preConsultationLink || 'UNDEFINED');
                    console.log('📧   Tipo:', typeof preConsultationLink);
                    console.log('📧   Valor exacto (JSON):', JSON.stringify(preConsultationLink));
                    console.log('📧   ¿Es string válido?:', typeof preConsultationLink === 'string' && preConsultationLink.length > 0 ? 'SÍ' : 'NO');
                    console.log('📧   LinkMeeting incluido:', updatedEvent.linkMeeting ? `SÍ (${updatedEvent.linkMeeting})` : 'NO');
                    console.log('📧 ========================================');
                    let manageLink = undefined;
                    if (appointmentIdToUse) {
                        manageLink = await getOrCreateManageLink(appointmentIdToUse);
                    }
                    const emailPayload = appointmentIdToUse
                        ? await (0, appointmentConfirmation_utils_1.buildAppointmentCalendarEmailPayload)({
                            doctorId: doctor.id,
                            appointmentId: appointmentIdToUse,
                            doctorTimezone: updatedDoctor.timezone,
                            eventTitle: updatedEvent.titulo,
                            eventDate: updatedEvent.fechaHoraInicio,
                            eventEndDate: updatedEvent.fechaHoraFin,
                            description: updatedEvent.descripcion,
                            linkMeeting: updatedEvent.linkMeeting,
                            eventId: updatedEvent.id,
                            preConsultationLink: preConsultationLink || undefined,
                        })
                        : {
                            eventTitle: updatedEvent.titulo,
                            eventDate: updatedEvent.fechaHoraInicio,
                            eventEndDate: updatedEvent.fechaHoraFin,
                            description: (0, appointmentConfirmation_utils_1.stripManageLinkBlocksFromDescription)(updatedEvent.descripcion) || undefined,
                            linkMeeting: updatedEvent.linkMeeting || undefined,
                            tipoCita: updatedEvent.linkMeeting ? 'remota' : 'presencial',
                            preConsultationLink: preConsultationLink || undefined,
                            manageLink,
                            timezone: (_d = updatedDoctor.timezone) !== null && _d !== void 0 ? _d : 'America/Mexico_City',
                        };
                    const emailData = Object.assign(Object.assign({ patientName,
                        doctorName }, emailPayload), { appointmentId: appointmentIdToUse !== null && appointmentIdToUse !== void 0 ? appointmentIdToUse : undefined, calendarInviteExpected: true });
                    console.log('📧 ========================================');
                    console.log('📧 DATOS DEL EMAIL QUE SE ENVIARÁN:');
                    console.log('📧   preConsultationLink:', emailData.preConsultationLink || 'UNDEFINED');
                    console.log('📧   Tipo de preConsultationLink en emailData:', typeof emailData.preConsultationLink);
                    console.log('📧   Valor exacto en emailData (JSON):', JSON.stringify(emailData.preConsultationLink));
                    console.log('📧   ¿Está definido?:', emailData.preConsultationLink !== undefined && emailData.preConsultationLink !== null ? 'SÍ' : 'NO');
                    console.log('📧   ¿Es string válido?:', typeof emailData.preConsultationLink === 'string' && emailData.preConsultationLink.length > 0 ? 'SÍ' : 'NO');
                    console.log('📧   linkMeeting:', emailData.linkMeeting || 'UNDEFINED');
                    console.log('📧 ========================================');
                    const emailSent = await emailService.sendCalendarEventEmail(patientEmail, emailData);
                    if (emailSent) {
                        console.log('✅ Email de cita enviado automáticamente al paciente:', patientEmail);
                        console.log('   - LinkMeeting:', updatedEvent.linkMeeting ? '✅ Incluido' : '❌ No incluido');
                        console.log('   - Pre-consulta:', preConsultationLink ? '✅ Incluida' : '❌ No incluida');
                    }
                    else {
                        console.warn('❌ No se pudo enviar el email automático al paciente:', patientEmail);
                    }
                }
                catch (emailError) {
                    console.error('❌ Error enviando email automático al crear evento:', emailError);
                    if (emailError instanceof Error) {
                        console.error('   Stack trace:', emailError.stack);
                    }
                    // No fallar la creación del evento si el email falla
                }
            }, 3000); // 3 segundos de delay para dar tiempo a que se complete la sincronización con calendarios externos
        }
        else {
            console.log('⚠️  No se envía email: el evento no tiene paciente asociado');
        }
        if ((appointment === null || appointment === void 0 ? void 0 : appointment.appointmentType) === 'teleconsulta' && appointment.id) {
            try {
                await appointmentConfirmation_controller_1.AppointmentConfirmationController.syncAppointmentCalendars(appointment.id, {
                    notifyAttendees: false,
                });
            }
            catch (syncErr) {
                console.error('Error sincronizando calendarios tras crear teleconsulta:', syncErr);
            }
        }
        else if ((appointment === null || appointment === void 0 ? void 0 : appointment.appointmentType) === 'presencial' && appointment.id) {
            try {
                // Segunda pasada: alinear vínculo interno sin duplicar invitación (ya enviada arriba).
                await appointmentConfirmation_controller_1.AppointmentConfirmationController.syncAppointmentCalendars(appointment.id, {
                    notifyAttendees: false,
                });
            }
            catch (syncErr) {
                console.error('Error sincronizando calendario interno tras crear cita presencial:', syncErr);
            }
        }
        console.log('=== FIN createCalendarEvent (éxito) ===');
        res.status(201).json(Object.assign(Object.assign(Object.assign({}, event), { calendarSync: {
                googleSynced: event.externalProvider === 'google' && !!event.externalEventId,
                externalEventId: (_s = event.externalEventId) !== null && _s !== void 0 ? _s : null,
                externalProvider: (_t = event.externalProvider) !== null && _t !== void 0 ? _t : null,
            } }), (calendarSyncWarning ? { calendarSyncWarning } : {})));
    }
    catch (error) {
        console.error('=== ERROR en createCalendarEvent ===');
        console.error('Error:', error);
        if (error === null || error === void 0 ? void 0 : error.stack) {
            console.error('Stack trace:', error.stack);
        }
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al crear evento del calendario.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.createCalendarEvent = createCalendarEvent;
/** Notifica al paciente tras reprogramar (doctor o sistema). */
const notifyPatientReschedule = async (appointmentId, doctorTimezone) => {
    var _a, _b, _c, _d;
    const refreshedAppointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
            patient: { include: { user: true } },
            doctor: { include: { user: true } }
        }
    });
    if (!refreshedAppointment)
        return;
    const patientEmail = refreshedAppointment.patient.email || ((_a = refreshedAppointment.patient.user) === null || _a === void 0 ? void 0 : _a.email) || '';
    if (!patientEmail)
        return;
    try {
        const emailService = notification_service_1.EmailService.getInstance();
        const calEvent = (_b = await prisma.internalCalendarEvent.findFirst({
            where: { appointmentId: refreshedAppointment.id },
        })) !== null && _b !== void 0 ? _b : await prisma.internalCalendarEvent.findFirst({
            where: {
                doctorId: refreshedAppointment.doctorId,
                patientId: refreshedAppointment.patientId,
                fechaHoraInicio: {
                    gte: new Date(refreshedAppointment.date.getTime() - 30 * 60000),
                    lte: new Date(refreshedAppointment.date.getTime() + 30 * 60000),
                },
            },
        });
        const scheduleConfig = await schedule_service_1.ScheduleService.getScheduleConfig(refreshedAppointment.doctorId);
        const durationMs = Math.max(15, Math.min(480, (_c = scheduleConfig === null || scheduleConfig === void 0 ? void 0 : scheduleConfig.appointmentDuration) !== null && _c !== void 0 ? _c : 30)) * 60000;
        const eventEnd = (_d = calEvent === null || calEvent === void 0 ? void 0 : calEvent.fechaHoraFin) !== null && _d !== void 0 ? _d : new Date(refreshedAppointment.date.getTime() + durationMs);
        const patientName = `${refreshedAppointment.patient.firstName || ''} ${refreshedAppointment.patient.lastName || ''}`.trim() ||
            'Paciente';
        const doctorName = refreshedAppointment.doctor.user
            ? `${refreshedAppointment.doctor.professionalTitle || ''} ${refreshedAppointment.doctor.user.firstName} ${refreshedAppointment.doctor.user.lastName}`.trim()
            : refreshedAppointment.doctor.professionalTitle || 'Profesional';
        const emailPayload = await (0, appointmentConfirmation_utils_1.buildAppointmentCalendarEmailPayload)({
            doctorId: refreshedAppointment.doctorId,
            appointmentId: refreshedAppointment.id,
            doctorTimezone: doctorTimezone,
            eventTitle: (calEvent === null || calEvent === void 0 ? void 0 : calEvent.titulo) || `${patientName} consulta`,
            eventDate: refreshedAppointment.date,
            eventEndDate: eventEnd,
            description: 'Tu cita fue reprogramada. La verás actualizada en Mis citas al iniciar sesión en Qlinexa360.',
            linkMeeting: calEvent === null || calEvent === void 0 ? void 0 : calEvent.linkMeeting,
            eventId: calEvent === null || calEvent === void 0 ? void 0 : calEvent.id,
        });
        await emailService.sendCalendarEventEmail(patientEmail, Object.assign(Object.assign({ patientName,
            doctorName }, emailPayload), { appointmentId: refreshedAppointment.id, skipEmailDedup: true, calendarInviteExpected: true }));
    }
    catch (err) {
        console.error('Error enviando correo de reprogramación al paciente:', err);
    }
};
/** Slots de agenda compartida para reagendar (doctor/asistente). */
const getRescheduleAvailableSlots = async (req, res) => {
    try {
        const doctorId = await resolveDoctorId(req);
        const doctor = await prisma.doctor.findUnique({
            where: { id: doctorId },
            select: { timezone: true }
        });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { date, excludeAppointmentId, excludeEventId } = req.query;
        if (!date || typeof date !== 'string') {
            throw new error_utils_1.AppError('Debes indicar una fecha (YYYY-MM-DD)', 400);
        }
        const doctorTimezone = doctor.timezone || 'America/Mexico_City';
        const slots = await schedule_service_1.ScheduleService.getBookableSlotsForDate(doctorId, date, {
            excludeAppointmentId: typeof excludeAppointmentId === 'string' ? excludeAppointmentId : undefined,
            excludeEventId: typeof excludeEventId === 'string' ? excludeEventId : undefined,
            timezone: doctorTimezone
        });
        res.json({
            success: true,
            data: slots,
            message: slots.length === 0
                ? 'No hay horarios disponibles para esta fecha en la agenda compartida'
                : undefined
        });
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener horarios disponibles.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.getRescheduleAvailableSlots = getRescheduleAvailableSlots;
// Actualizar un evento del calendario (solo si es interno)
const updateCalendarEvent = async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    try {
        const doctorId = await resolveDoctorId(req);
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { eventId } = req.params;
        const { patientId, fechaHoraInicio, fechaHoraFin, titulo, descripcion, linkMeeting, meetingPlatform = '', modalidadConsulta, teleconsultationAmount, } = req.body;
        // Buscar el evento
        const existingEvent = await prisma.internalCalendarEvent.findUnique({
            where: { id: eventId }
        });
        if (!existingEvent) {
            throw new error_utils_1.AppError('Evento no encontrado', 404);
        }
        if (modalidadConsulta !== undefined) {
            const amountValidation = await (0, mercadopago_teleconsultation_service_1.validateTeleconsultationAmountForVirtualAppointment)(doctor.id, modalidadConsulta, teleconsultationAmount, patientId || existingEvent.patientId);
            if (!amountValidation.ok) {
                throw new error_utils_1.AppError(amountValidation.message, 400);
            }
        }
        // Verificar que el doctor es el dueño del evento
        if (existingEvent.doctorId !== doctor.id) {
            throw new error_utils_1.AppError('No tienes permiso para editar este evento', 403);
        }
        // Solo permitir editar eventos internos o sincronizados desde calendarios externos
        if (existingEvent.origenEvento !== 'interno' &&
            existingEvent.origenEvento !== 'google' &&
            existingEvent.origenEvento !== 'outlook' &&
            existingEvent.origenEvento !== 'apple' &&
            existingEvent.origenEvento !== 'notion') {
            throw new error_utils_1.AppError('Solo se pueden editar eventos internos o sincronizados desde calendarios externos', 403);
        }
        // Validaciones
        if (fechaHoraInicio && fechaHoraFin && new Date(fechaHoraInicio) >= new Date(fechaHoraFin)) {
            throw new error_utils_1.AppError('La fecha de inicio debe ser anterior a la fecha de fin', 400);
        }
        // Cualquier movimiento de calendario (editar / reprogramar) requiere que el calendario del doctor
        // siga enlazado: el cambio se refleja en el calendario del paciente a través del calendario del doctor.
        // Solo aplica a eventos vinculados a un proveedor externo (Google/Outlook); los internos no se bloquean.
        const editProvider = String(existingEvent.externalProvider || existingEvent.origenEvento || '').toLowerCase();
        if (editProvider === 'google' || editProvider === 'outlook') {
            const editProviderConn = await prisma.calendarSyncConfig.findFirst({
                where: { doctorId: doctor.id, provider: editProvider, isConnected: true }
            });
            if (!editProviderConn) {
                const label = editProvider === 'google' ? 'Google' : 'Microsoft Outlook';
                throw new error_utils_1.AppError(`Para modificar o reprogramar esta cita necesitas tener enlazado tu calendario de ${label} en Configuración → Calendario. El cambio se refleja en el calendario del paciente a través de tu calendario; sin enlazarlo, el paciente no vería la actualización en su dispositivo.`, 400);
            }
        }
        // Verificar que el paciente existe y está asociado al doctor
        if (patientId) {
            const patient = await prisma.patient.findFirst({
                where: {
                    id: patientId,
                    doctors: { some: { doctorId: doctor.id } }
                }
            });
            if (!patient) {
                throw new error_utils_1.AppError('Paciente no encontrado o no asociado a este doctor', 404);
            }
        }
        // CRÍTICO: Limpiar el título para guardar solo el título original (sin prefijos de estatus)
        const cleanTitleForUpdate = titulo ? titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim() : undefined;
        // Verificar si la fecha cambió (reagendamiento)
        const fechaCambio = fechaHoraInicio && existingEvent.fechaHoraInicio
            ? new Date(fechaHoraInicio).getTime() !== existingEvent.fechaHoraInicio.getTime()
            : false;
        let linkedAppointmentForReschedule = null;
        if (fechaCambio && existingEvent.patientId) {
            linkedAppointmentForReschedule = await prisma.appointment.findFirst({
                where: {
                    doctorId: doctor.id,
                    patientId: existingEvent.patientId,
                    date: {
                        gte: new Date(existingEvent.fechaHoraInicio.getTime() - 30 * 60 * 1000),
                        lte: new Date(existingEvent.fechaHoraInicio.getTime() + 30 * 60 * 1000)
                    }
                },
                orderBy: { date: 'desc' },
                select: { id: true, date: true }
            });
            const doctorTimezone = doctor.timezone || 'America/Mexico_City';
            const slotBookable = await schedule_service_1.ScheduleService.isSlotBookable(doctor.id, new Date(fechaHoraInicio), {
                excludeAppointmentId: linkedAppointmentForReschedule === null || linkedAppointmentForReschedule === void 0 ? void 0 : linkedAppointmentForReschedule.id,
                excludeEventId: eventId,
                timezone: doctorTimezone
            });
            if (!slotBookable) {
                throw new error_utils_1.AppError('El horario seleccionado no está disponible en la agenda compartida. Elige otro slot.', 409);
            }
        }
        let updatedEvent = await prisma.internalCalendarEvent.update({
            where: { id: eventId },
            data: {
                patientId,
                fechaHoraInicio: fechaHoraInicio ? new Date(fechaHoraInicio) : undefined,
                fechaHoraFin: fechaHoraFin ? new Date(fechaHoraFin) : undefined,
                titulo: cleanTitleForUpdate, // Guardar solo el título limpio (sin prefijo de estatus)
                descripcion,
                linkMeeting
            },
            include: {
                patient: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });
        if (updatedEvent.patientId && modalidadConsulta !== undefined) {
            const amountValidation = await (0, mercadopago_teleconsultation_service_1.validateTeleconsultationAmountForVirtualAppointment)(doctor.id, modalidadConsulta, teleconsultationAmount, updatedEvent.patientId);
            if (amountValidation.ok) {
                const linkedAppointment = await prisma.appointment.findFirst({
                    where: {
                        doctorId: doctor.id,
                        patientId: updatedEvent.patientId,
                        date: {
                            gte: new Date(updatedEvent.fechaHoraInicio.getTime() - 30 * 60 * 1000),
                            lte: new Date(updatedEvent.fechaHoraInicio.getTime() + 30 * 60 * 1000),
                        },
                    },
                    orderBy: { date: 'desc' },
                });
                if (linkedAppointment) {
                    const appointmentType = modalidadConsulta === 'virtual' ? 'teleconsulta' : 'presencial';
                    await prisma.appointment.update({
                        where: { id: linkedAppointment.id },
                        data: {
                            appointmentType,
                            teleconsultationAmount: modalidadConsulta === 'virtual' ? amountValidation.amount : null,
                        },
                    });
                }
            }
        }
        // CRÍTICO: Si se reagendó la cita (fecha cambió) y hay un paciente, actualizar el appointment relacionado
        // y resetear el confirmationStatus para que se pueda sincronizar correctamente desde el calendario externo
        if (fechaCambio && updatedEvent.patient) {
            try {
                const appointment = linkedAppointmentForReschedule ||
                    (await prisma.appointment.findFirst({
                        where: {
                            doctorId: doctor.id,
                            patientId: updatedEvent.patient.id,
                            date: {
                                gte: new Date(existingEvent.fechaHoraInicio.getTime() - 30 * 60 * 1000),
                                lte: new Date(existingEvent.fechaHoraInicio.getTime() + 30 * 60 * 1000)
                            }
                        },
                        orderBy: { date: 'desc' },
                        select: { id: true, date: true }
                    }));
                let syncedAppointmentId = null;
                if (appointment) {
                    const appointmentTypeUpdate = modalidadConsulta === 'virtual'
                        ? 'teleconsulta'
                        : modalidadConsulta === 'presencial'
                            ? 'presencial'
                            : undefined;
                    const previousDate = appointment.date;
                    await prisma.appointment.update({
                        where: { id: appointment.id },
                        data: Object.assign({ date: new Date(fechaHoraInicio), confirmationStatus: 'RESCHEDULED', rescheduledFrom: previousDate, rescheduledTo: new Date(fechaHoraInicio), confirmedAt: null, cancelledAt: null, status: 'SCHEDULED' }, (appointmentTypeUpdate ? { appointmentType: appointmentTypeUpdate } : {}))
                    });
                    syncedAppointmentId = appointment.id;
                    await appointmentConfirmation_controller_1.AppointmentConfirmationController.syncAppointmentCalendars(appointment.id, {
                        notifyAttendees: true,
                    });
                    console.log(`✅ Appointment ${appointment.id} actualizado con nueva fecha después de reagendar`);
                }
                else {
                    // Si no se encuentra el appointment, buscar por la nueva fecha para ver si ya existe uno
                    const existingAppointment = await prisma.appointment.findFirst({
                        where: {
                            doctorId: doctor.id,
                            patientId: updatedEvent.patient.id,
                            date: {
                                gte: new Date(new Date(fechaHoraInicio).getTime() - 30 * 60 * 1000),
                                lte: new Date(new Date(fechaHoraInicio).getTime() + 30 * 60 * 1000)
                            }
                        }
                    });
                    if (!existingAppointment) {
                        // Si no existe appointment para la nueva fecha, crear uno nuevo
                        const patient = await prisma.patient.findUnique({
                            where: { id: updatedEvent.patient.id },
                            include: {
                                doctors: {
                                    where: { doctorId: doctor.id },
                                    take: 1
                                }
                            }
                        });
                        if (patient && patient.doctors.length > 0) {
                            const newAppointmentType = modalidadConsulta === 'virtual' ? 'teleconsulta' : 'presencial';
                            const createdAppt = await prisma.appointment.create({
                                data: {
                                    doctorId: doctor.id,
                                    patientId: updatedEvent.patient.id,
                                    doctorPatientId: patient.doctors[0].id,
                                    userId: patient.userId || '',
                                    date: new Date(fechaHoraInicio),
                                    status: 'SCHEDULED',
                                    appointmentType: newAppointmentType,
                                    confirmationStatus: 'RESCHEDULED',
                                    notes: `Cita reagendada desde calendario - ${cleanTitleForUpdate || titulo}`
                                }
                            });
                            await appointmentConfirmation_controller_1.AppointmentConfirmationController.syncAppointmentCalendars(createdAppt.id, {
                                notifyAttendees: true,
                            });
                            syncedAppointmentId = createdAppt.id;
                            console.log(`✅ Nuevo appointment creado para la cita reagendada`);
                        }
                    }
                    else {
                        const previousDate = existingAppointment.date;
                        await prisma.appointment.update({
                            where: { id: existingAppointment.id },
                            data: {
                                date: new Date(fechaHoraInicio),
                                confirmationStatus: 'RESCHEDULED',
                                rescheduledFrom: previousDate,
                                rescheduledTo: new Date(fechaHoraInicio),
                                confirmedAt: null,
                                cancelledAt: null,
                                status: 'SCHEDULED'
                            }
                        });
                        syncedAppointmentId = existingAppointment.id;
                        await appointmentConfirmation_controller_1.AppointmentConfirmationController.syncAppointmentCalendars(existingAppointment.id, {
                            notifyAttendees: true,
                        });
                        console.log(`✅ Appointment ${existingAppointment.id} actualizado tras reagendar`);
                    }
                }
                if (syncedAppointmentId) {
                    await notifyPatientReschedule(syncedAppointmentId, doctor.timezone || 'America/Mexico_City');
                }
            }
            catch (appointmentError) {
                console.error('Error actualizando appointment después de reagendar:', appointmentError);
                // No fallar la actualización del evento si hay error con el appointment
            }
        }
        let allowVideoForExternalSync = meetingPlatform === 'google-meet' || meetingPlatform === 'teams';
        let teleconsultaWithConsent = false;
        if (updatedEvent.patientId) {
            const apptUpdate = await prisma.appointment.findFirst({
                where: {
                    doctorId: doctor.id,
                    patientId: updatedEvent.patientId,
                    date: {
                        gte: new Date(updatedEvent.fechaHoraInicio.getTime() - 30 * 60000),
                        lte: new Date(updatedEvent.fechaHoraInicio.getTime() + 30 * 60000)
                    }
                },
                orderBy: { date: 'desc' }
            });
            if ((apptUpdate === null || apptUpdate === void 0 ? void 0 : apptUpdate.appointmentType) === 'teleconsulta') {
                const tcUpdate = await prisma.teleconsultation.findUnique({
                    where: { appointmentId: apptUpdate.id },
                    select: { consentSigned: true }
                });
                teleconsultaWithConsent = (0, calendarSync_utils_1.shouldAllowVideoConferenceForAppointment)(apptUpdate.appointmentType, tcUpdate === null || tcUpdate === void 0 ? void 0 : tcUpdate.consentSigned);
                allowVideoForExternalSync = teleconsultaWithConsent;
            }
            else if (apptUpdate) {
                allowVideoForExternalSync = meetingPlatform === 'google-meet' || meetingPlatform === 'teams';
            }
        }
        if (!allowVideoForExternalSync) {
            updatedEvent = await prisma.internalCalendarEvent.update({
                where: { id: updatedEvent.id },
                data: { linkMeeting: null },
                include: {
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });
        }
        const shouldSyncWithGoogle = meetingPlatform === 'google-meet' ||
            updatedEvent.origenEvento === 'google' ||
            updatedEvent.externalProvider === 'google' ||
            existingEvent.externalProvider === 'google';
        const shouldSyncWithOutlook = meetingPlatform === 'teams' ||
            updatedEvent.origenEvento === 'outlook' ||
            updatedEvent.externalProvider === 'outlook' ||
            existingEvent.externalProvider === 'outlook';
        const shouldSyncWithApple = meetingPlatform !== 'google-meet' &&
            meetingPlatform !== 'teams' &&
            (updatedEvent.origenEvento === 'interno' ||
                updatedEvent.origenEvento === 'apple' ||
                updatedEvent.externalProvider === 'apple' ||
                existingEvent.externalProvider === 'apple');
        const shouldSyncWithNotion = !shouldSyncWithGoogle &&
            !shouldSyncWithOutlook &&
            !shouldSyncWithApple &&
            (updatedEvent.origenEvento === 'interno' ||
                updatedEvent.origenEvento === 'notion' ||
                updatedEvent.externalProvider === 'notion' ||
                existingEvent.externalProvider === 'notion');
        const wantsGoogleConference = teleconsultaWithConsent ||
            meetingPlatform === 'google-meet' ||
            (!!updatedEvent.linkMeeting && updatedEvent.linkMeeting.includes('meet.google.com'));
        const wantsOutlookConference = teleconsultaWithConsent ||
            meetingPlatform === 'teams' ||
            (!!updatedEvent.linkMeeting && updatedEvent.linkMeeting.includes('teams.microsoft.com'));
        let calendarSyncWarning;
        if (shouldSyncWithGoogle) {
            try {
                let patientEmailForSync = ((_a = updatedEvent.patient) === null || _a === void 0 ? void 0 : _a.email) || null;
                if (!patientEmailForSync && updatedEvent.patientId) {
                    const patientRow = await prisma.patient.findUnique({
                        where: { id: updatedEvent.patientId },
                        select: { email: true, user: { select: { email: true } } },
                    });
                    patientEmailForSync = (patientRow === null || patientRow === void 0 ? void 0 : patientRow.email) || ((_b = patientRow === null || patientRow === void 0 ? void 0 : patientRow.user) === null || _b === void 0 ? void 0 : _b.email) || null;
                }
                const attendees = patientEmailForSync ? [patientEmailForSync] : [];
                console.log('📅 Reagendamiento → sync Google Calendar:');
                console.log('   fechaCambio:', fechaCambio);
                console.log('   patientEmail:', patientEmailForSync || 'NO DISPONIBLE');
                console.log('   externalEventId:', updatedEvent.externalEventId || 'NINGUNO');
                console.log('   sendUpdates:', (0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
                    externalEventId: updatedEvent.externalEventId,
                    attendeeCount: attendees.length,
                    notifyAttendees: !!fechaCambio,
                }));
                // Limpiar el título: remover cualquier prefijo de estatus que pueda tener
                const cleanTitle = updatedEvent.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
                const syncDescription = await buildDescriptionWithManageLink(updatedEvent);
                const syncResult = await googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent(doctor.id, {
                    id: updatedEvent.id,
                    title: cleanTitle,
                    description: syncDescription,
                    start: updatedEvent.fechaHoraInicio,
                    end: updatedEvent.fechaHoraFin,
                    attendees,
                    externalEventId: (_c = updatedEvent.externalEventId) !== null && _c !== void 0 ? _c : undefined,
                    location: wantsGoogleConference ? ((_d = updatedEvent.linkMeeting) !== null && _d !== void 0 ? _d : undefined) : undefined,
                    conferenceType: wantsGoogleConference ? 'google-meet' : null,
                    conferenceLink: wantsGoogleConference ? ((_e = updatedEvent.linkMeeting) !== null && _e !== void 0 ? _e : undefined) : undefined,
                    googleMeetEnabled: wantsGoogleConference,
                    disableConference: !wantsGoogleConference,
                    sendUpdates: (0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
                        externalEventId: updatedEvent.externalEventId,
                        attendeeCount: attendees.length,
                        notifyAttendees: !!fechaCambio,
                    }),
                });
                if (syncResult) {
                    const updateData = {
                        externalProvider: 'google',
                        externalEventId: syncResult.externalEventId,
                        externalUpdatedAt: syncResult.externalUpdatedAt
                    };
                    if (wantsGoogleConference && syncResult.conferenceLink) {
                        updateData.linkMeeting = syncResult.conferenceLink;
                    }
                    if (!wantsGoogleConference) {
                        updateData.linkMeeting = null;
                    }
                    updatedEvent = await prisma.internalCalendarEvent.update({
                        where: { id: updatedEvent.id },
                        data: updateData,
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
                }
                else {
                    const errMsg = 'No se pudo actualizar Google Calendar. El paciente podría no recibir la invitación reprogramada.';
                    calendarSyncWarning = errMsg;
                    await (0, calendarSync_utils_1.recordCalendarProviderSyncError)(doctor.id, 'google', errMsg);
                }
            }
            catch (error) {
                const errMsg = (error === null || error === void 0 ? void 0 : error.message) ||
                    'Error al sincronizar la reprogramación con Google Calendar.';
                calendarSyncWarning = errMsg;
                console.error('Error syncing updated event to Google:', error);
            }
        }
        if (shouldSyncWithOutlook) {
            try {
                let patientEmailForOutlook = ((_f = updatedEvent.patient) === null || _f === void 0 ? void 0 : _f.email) || null;
                if (!patientEmailForOutlook && updatedEvent.patientId) {
                    const patientRow = await prisma.patient.findUnique({
                        where: { id: updatedEvent.patientId },
                        select: { email: true, user: { select: { email: true } } },
                    });
                    patientEmailForOutlook = (patientRow === null || patientRow === void 0 ? void 0 : patientRow.email) || ((_g = patientRow === null || patientRow === void 0 ? void 0 : patientRow.user) === null || _g === void 0 ? void 0 : _g.email) || null;
                }
                const attendees = patientEmailForOutlook ? [patientEmailForOutlook] : [];
                // Limpiar el título: remover cualquier prefijo de estatus que pueda tener
                const cleanTitle = updatedEvent.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
                const syncDescription = await buildDescriptionWithManageLink(updatedEvent);
                const syncResult = await outlookCalendarSync_service_1.OutlookCalendarSyncService.upsertEvent(doctor.id, {
                    id: updatedEvent.id,
                    title: cleanTitle,
                    description: syncDescription,
                    start: updatedEvent.fechaHoraInicio,
                    end: updatedEvent.fechaHoraFin,
                    attendees,
                    location: wantsOutlookConference ? ((_h = updatedEvent.linkMeeting) !== null && _h !== void 0 ? _h : undefined) : undefined,
                    externalEventId: (_j = updatedEvent.externalEventId) !== null && _j !== void 0 ? _j : undefined,
                    teamsEnabled: wantsOutlookConference,
                    disableConference: !wantsOutlookConference,
                    conferenceLink: (_k = updatedEvent.linkMeeting) !== null && _k !== void 0 ? _k : undefined
                });
                if (syncResult) {
                    const updateData = {
                        externalProvider: 'outlook',
                        externalEventId: syncResult.externalEventId,
                        externalUpdatedAt: syncResult.externalUpdatedAt
                    };
                    if (wantsOutlookConference && syncResult.conferenceLink) {
                        updateData.linkMeeting = syncResult.conferenceLink;
                    }
                    if (!wantsOutlookConference) {
                        updateData.linkMeeting = null;
                    }
                    updatedEvent = await prisma.internalCalendarEvent.update({
                        where: { id: updatedEvent.id },
                        data: updateData,
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
                }
            }
            catch (error) {
                console.error('Error syncing updated event to Outlook:', error);
            }
        }
        if (shouldSyncWithApple) {
            try {
                // Limpiar el título: remover cualquier prefijo de estatus que pueda tener
                const cleanTitle = updatedEvent.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
                const syncDescription = await buildDescriptionWithManageLink(updatedEvent);
                const syncResult = await appleCalendarSync_service_1.AppleCalendarSyncService.upsertEvent(doctor.id, {
                    id: updatedEvent.id,
                    title: cleanTitle,
                    description: syncDescription,
                    start: updatedEvent.fechaHoraInicio,
                    end: updatedEvent.fechaHoraFin,
                    attendees: ((_l = updatedEvent.patient) === null || _l === void 0 ? void 0 : _l.email) ? [updatedEvent.patient.email] : [],
                    externalEventId: (_m = updatedEvent.externalEventId) !== null && _m !== void 0 ? _m : undefined
                });
                if (syncResult) {
                    updatedEvent = await prisma.internalCalendarEvent.update({
                        where: { id: updatedEvent.id },
                        data: {
                            externalProvider: 'apple',
                            externalEventId: syncResult.externalEventId,
                            externalUpdatedAt: syncResult.externalUpdatedAt
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
                }
            }
            catch (error) {
                console.error('Error syncing updated event to Apple Calendar:', error);
            }
        }
        if (shouldSyncWithNotion) {
            try {
                const attendees = ((_o = updatedEvent.patient) === null || _o === void 0 ? void 0 : _o.email)
                    ? [updatedEvent.patient.email]
                    : [];
                const syncDescription = await buildDescriptionWithManageLink(updatedEvent);
                const syncResult = await notionCalendarSync_service_1.NotionCalendarSyncService.upsertEvent(doctor.id, {
                    id: updatedEvent.id,
                    title: updatedEvent.titulo,
                    description: syncDescription,
                    start: updatedEvent.fechaHoraInicio,
                    end: updatedEvent.fechaHoraFin,
                    attendees,
                    location: (_p = updatedEvent.linkMeeting) !== null && _p !== void 0 ? _p : undefined,
                    externalEventId: (_q = updatedEvent.externalEventId) !== null && _q !== void 0 ? _q : undefined,
                    linkMeeting: (_r = updatedEvent.linkMeeting) !== null && _r !== void 0 ? _r : undefined
                });
                if (syncResult) {
                    updatedEvent = await prisma.internalCalendarEvent.update({
                        where: { id: updatedEvent.id },
                        data: {
                            externalProvider: 'notion',
                            externalEventId: syncResult.externalEventId,
                            externalUpdatedAt: syncResult.externalUpdatedAt
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
                }
            }
            catch (error) {
                console.error('Error syncing updated event to Notion:', error);
            }
        }
        res.json(Object.assign(Object.assign({}, updatedEvent), (calendarSyncWarning ? { calendarSyncWarning } : {})));
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al actualizar evento del calendario.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.updateCalendarEvent = updateCalendarEvent;
// Eliminar un evento del calendario
const deleteCalendarEvent = async (req, res) => {
    try {
        const doctorId = await resolveDoctorId(req);
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { eventId } = req.params;
        // Buscar el evento
        const existingEvent = await prisma.internalCalendarEvent.findUnique({
            where: { id: eventId }
        });
        if (!existingEvent) {
            throw new error_utils_1.AppError('Evento no encontrado', 404);
        }
        // Verificar que el doctor es el dueño del evento
        if (existingEvent.doctorId !== doctor.id) {
            throw new error_utils_1.AppError('No tienes permiso para eliminar este evento', 403);
        }
        const shouldSyncWithGoogle = existingEvent.externalProvider === 'google' && !!existingEvent.externalEventId;
        const shouldSyncWithOutlook = existingEvent.externalProvider === 'outlook' && !!existingEvent.externalEventId;
        const shouldSyncWithApple = existingEvent.externalProvider === 'apple' && !!existingEvent.externalEventId;
        const shouldSyncWithNotion = existingEvent.externalProvider === 'notion' && !!existingEvent.externalEventId;
        if (shouldSyncWithGoogle && existingEvent.externalEventId) {
            try {
                await googleCalendarSync_service_1.GoogleCalendarSyncService.deleteEvent(doctor.id, existingEvent.externalEventId);
            }
            catch (error) {
                console.error('Error deleting event in Google Calendar:', error);
            }
        }
        if (shouldSyncWithOutlook && existingEvent.externalEventId) {
            try {
                await outlookCalendarSync_service_1.OutlookCalendarSyncService.deleteEvent(doctor.id, existingEvent.externalEventId);
            }
            catch (error) {
                console.error('Error deleting event in Outlook Calendar:', error);
            }
        }
        if (shouldSyncWithApple && existingEvent.externalEventId) {
            try {
                await appleCalendarSync_service_1.AppleCalendarSyncService.deleteEvent(doctor.id, existingEvent.externalEventId);
            }
            catch (error) {
                console.error('Error deleting event in Apple Calendar:', error);
            }
        }
        if (shouldSyncWithNotion && existingEvent.externalEventId) {
            try {
                await notionCalendarSync_service_1.NotionCalendarSyncService.deleteEvent(doctor.id, existingEvent.externalEventId);
            }
            catch (error) {
                console.error('Error deleting event in Notion Calendar:', error);
            }
        }
        await prisma.internalCalendarEvent.delete({
            where: { id: eventId }
        });
        res.json({ message: 'Evento eliminado correctamente' });
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al eliminar evento del calendario.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.deleteCalendarEvent = deleteCalendarEvent;
// Cancelar una cita (actualizar appointment a CANCELLED)
const cancelAppointment = async (req, res) => {
    var _a, _b, _c;
    try {
        const doctorId = await resolveDoctorId(req);
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { eventId } = req.params;
        // Buscar el evento con información completa del paciente
        const event = await prisma.internalCalendarEvent.findFirst({
            where: {
                id: eventId,
                doctorId: doctor.id
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
        if (!event) {
            throw new error_utils_1.AppError('Evento no encontrado', 404);
        }
        if (!event.patient) {
            throw new error_utils_1.AppError('Este evento no está asociado a un paciente', 400);
        }
        // Resolver la cita: priorizar vínculo duro evento↔cita
        console.log('🔍 Buscando appointment para cancelar:');
        console.log('   Event ID:', eventId);
        console.log('   Event appointmentId:', event.appointmentId);
        console.log('   Event fechaHoraInicio:', event.fechaHoraInicio);
        console.log('   Patient ID:', event.patient.id);
        console.log('   Doctor ID:', doctor.id);
        let appointment = event.appointmentId
            ? await prisma.appointment.findUnique({ where: { id: event.appointmentId } })
            : null;
        if (!appointment) {
            const searchStart = new Date(event.fechaHoraInicio.getTime() - 30 * 60 * 1000);
            const searchEnd = new Date(event.fechaHoraInicio.getTime() + 30 * 60 * 1000);
            appointment = await prisma.appointment.findFirst({
                where: {
                    doctorId: doctor.id,
                    patientId: event.patient.id,
                    date: {
                        gte: searchStart,
                        lte: searchEnd,
                    },
                },
                orderBy: {
                    date: 'desc',
                },
            });
        }
        if (!appointment) {
            throw new error_utils_1.AppError('No se encontró la cita asociada a este evento', 404);
        }
        console.log(`   ✅ Appointment encontrado: ${appointment.id} (${appointment.date})`);
        const canonicalStart = (_a = appointment.rescheduledTo) !== null && _a !== void 0 ? _a : appointment.date;
        const durationMs = Math.max(event.fechaHoraFin.getTime() - event.fechaHoraInicio.getTime(), 30 * 60 * 1000);
        const canonicalEnd = new Date(canonicalStart.getTime() + durationMs);
        // Actualizar el appointment a CANCELLED
        await prisma.appointment.update({
            where: { id: appointment.id },
            data: {
                confirmationStatus: 'CANCELLED',
                cancelledAt: new Date(),
                status: 'CANCELLED',
            },
        });
        console.log(`✅ Cita ${appointment.id} cancelada por el profesional de la salud`);
        const cleanTitle = event.titulo
            .replace(/^❌\s*Cita cancelada:\s*/i, '')
            .replace(/^❌ Cita rechazada:\s*/i, '')
            .replace(/^❌ CANCELADA:\s*/i, '')
            .replace(/^❌ CANCELADA\s*-\s*/i, '')
            .replace(/^🏥\s*/g, '')
            .replace(/\s+consulta$/i, '')
            .trim();
        const cancelledTitle = `❌ Cita cancelada: ${cleanTitle || event.titulo}`;
        const cancelledDescription = (0, appointmentConfirmation_utils_1.stripManageLinkBlocksFromDescription)(event.descripcion);
        await prisma.internalCalendarEvent.update({
            where: { id: event.id },
            data: {
                appointmentId: appointment.id,
                fechaHoraInicio: canonicalStart,
                fechaHoraFin: canonicalEnd,
                titulo: cancelledTitle,
                descripcion: cancelledDescription || null,
                linkMeeting: null,
            },
        });
        // Una sola notificación al calendario externo (sin bucles posteriores)
        if (event.externalEventId && event.externalProvider) {
            try {
                let patientEmail = event.patient.email;
                if (!patientEmail && event.patient.userId) {
                    const patientUser = await prisma.user.findUnique({
                        where: { id: event.patient.userId },
                        select: { email: true },
                    });
                    patientEmail = (patientUser === null || patientUser === void 0 ? void 0 : patientUser.email) || null;
                }
                if (patientEmail) {
                    const cancellationNotice = '\n\nEsta cita médica ha sido cancelada por el profesional de la salud.';
                    const externalDescription = cancelledDescription
                        ? `${cancelledDescription}${cancellationNotice}`
                        : `Cita médica cancelada.${cancellationNotice}`;
                    console.log(`📅 Actualizando evento cancelado en ${event.externalProvider} (una sola notificación)`);
                    if (event.externalProvider === 'google') {
                        await googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent(doctor.id, {
                            id: event.id,
                            title: cancelledTitle,
                            description: externalDescription,
                            start: canonicalStart,
                            end: canonicalEnd,
                            attendees: [patientEmail],
                            externalEventId: event.externalEventId,
                            disableConference: true,
                            sendUpdates: 'all',
                        });
                    }
                    else if (event.externalProvider === 'outlook') {
                        await outlookCalendarSync_service_1.OutlookCalendarSyncService.upsertEvent(doctor.id, {
                            id: event.id,
                            title: cancelledTitle,
                            description: externalDescription,
                            start: canonicalStart,
                            end: canonicalEnd,
                            attendees: [patientEmail],
                            externalEventId: event.externalEventId,
                            disableConference: true,
                        });
                    }
                    else if (event.externalProvider === 'apple') {
                        await appleCalendarSync_service_1.AppleCalendarSyncService.upsertEvent(doctor.id, {
                            id: event.id,
                            title: cancelledTitle,
                            description: externalDescription,
                            start: canonicalStart,
                            end: canonicalEnd,
                            attendees: [patientEmail],
                            externalEventId: event.externalEventId,
                        });
                    }
                }
                else {
                    console.warn('⚠️ No se puede actualizar el calendario externo: el paciente no tiene email');
                }
            }
            catch (syncError) {
                console.error('❌ Error al actualizar evento en calendario externo:', syncError);
            }
        }
        // Enviar notificación al paciente
        try {
            const { NotificationService } = await Promise.resolve().then(() => __importStar(require('../services/notification.service')));
            const notificationService = NotificationService.getInstance();
            // Obtener información completa del paciente y doctor
            const patientData = await prisma.patient.findUnique({
                where: { id: event.patient.id },
                include: {
                    user: {
                        select: {
                            email: true,
                            phone: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });
            const doctorData = await prisma.doctor.findUnique({
                where: { id: doctor.id },
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });
            if (patientData && doctorData) {
                const patientEmail = patientData.email || ((_b = patientData.user) === null || _b === void 0 ? void 0 : _b.email);
                const patientPhone = (_c = patientData.user) === null || _c === void 0 ? void 0 : _c.phone;
                const patientName = `${patientData.firstName} ${patientData.lastName}`.trim();
                const doctorName = `${doctorData.user.firstName} ${doctorData.user.lastName}`.trim();
                const appointmentDate = canonicalStart;
                const appointmentTime = `${appointmentDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
                // Enviar email de cancelación
                if (patientEmail) {
                    const emailService = (await Promise.resolve().then(() => __importStar(require('../services/notification.service')))).EmailService.getInstance();
                    await emailService.sendAppointmentCancellationEmail(patientEmail, {
                        patientName,
                        doctorName,
                        date: appointmentDate,
                        time: appointmentTime
                    });
                    console.log(`✅ Email de cancelación enviado a ${patientEmail}`);
                }
                // Enviar WhatsApp de cancelación (si está disponible)
                if (patientPhone) {
                    const whatsappService = (await Promise.resolve().then(() => __importStar(require('../services/notification.service')))).WhatsAppService.getInstance();
                    await whatsappService.sendAppointmentCancellationMessage(patientPhone, {
                        patientName,
                        doctorName,
                        date: appointmentDate,
                        time: appointmentTime
                    });
                    console.log(`✅ WhatsApp de cancelación enviado a ${patientPhone}`);
                }
            }
        }
        catch (notificationError) {
            console.error('❌ Error al enviar notificación de cancelación:', notificationError);
            // No fallar la cancelación si falla la notificación
        }
        res.json({
            success: true,
            message: 'Cita cancelada correctamente',
            appointmentId: appointment.id
        });
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al cancelar la cita.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.cancelAppointment = cancelAppointment;
// Obtener un evento específico
const getCalendarEvent = async (req, res) => {
    try {
        const doctorId = await resolveDoctorId(req);
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { eventId } = req.params;
        const event = await prisma.internalCalendarEvent.findFirst({
            where: {
                id: eventId,
                doctorId: doctor.id
            },
            include: {
                patient: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        user: {
                            select: {
                                phone: true
                            }
                        }
                    }
                },
                doctor: {
                    select: {
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
        if (!event) {
            throw new error_utils_1.AppError('Evento no encontrado', 404);
        }
        res.json(event);
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener evento del calendario.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.getCalendarEvent = getCalendarEvent;
// Reenviar invitación de calendario externo al paciente (sin email adicional de Qlinexa)
const resendCalendarInvite = async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    try {
        const doctorId = await resolveDoctorId(req);
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { eventId } = req.params;
        const event = await prisma.internalCalendarEvent.findFirst({
            where: { id: eventId, doctorId: doctor.id },
            select: {
                id: true,
                titulo: true,
                descripcion: true,
                fechaHoraInicio: true,
                fechaHoraFin: true,
                linkMeeting: true,
                externalProvider: true,
                externalEventId: true,
                origenEvento: true,
                appointmentId: true,
                patientId: true,
                patient: {
                    select: {
                        id: true,
                        userId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });
        if (!event)
            throw new error_utils_1.AppError('Evento no encontrado', 404);
        if (!event.patient)
            throw new error_utils_1.AppError('Este evento no está asociado a un paciente', 400);
        let patientEmail = event.patient.email;
        if (!patientEmail && event.patient.userId) {
            const patientUser = await prisma.user.findUnique({
                where: { id: event.patient.userId },
                select: { email: true },
            });
            patientEmail = (patientUser === null || patientUser === void 0 ? void 0 : patientUser.email) || null;
        }
        if (!patientEmail)
            throw new error_utils_1.AppError('El paciente no tiene email registrado', 400);
        console.log('📧 resendCalendarInvite:', {
            eventId: event.id,
            appointmentId: event.appointmentId,
            patientEmail,
            externalProvider: event.externalProvider,
            externalEventId: event.externalEventId,
        });
        if (event.appointmentId) {
            await appointmentConfirmation_controller_1.AppointmentConfirmationController.syncAppointmentCalendars(event.appointmentId, {
                notifyAttendees: true,
            });
            return res.json({
                success: true,
                message: 'Invitación de calendario reenviada al paciente',
                calendarSync: true,
            });
        }
        const hasGoogleCalendar = await prisma.calendarSyncConfig.findFirst({
            where: { doctorId: doctor.id, provider: 'google', isConnected: true, accessToken: { not: null } },
        });
        const hasOutlookCalendar = await prisma.calendarSyncConfig.findFirst({
            where: { doctorId: doctor.id, provider: 'outlook', isConnected: true, accessToken: { not: null } },
        });
        const shouldSyncWithGoogle = event.externalProvider === 'google' ||
            event.origenEvento === 'google' ||
            (!event.externalProvider && !!hasGoogleCalendar);
        const shouldSyncWithOutlook = event.externalProvider === 'outlook' ||
            event.origenEvento === 'outlook' ||
            (!event.externalProvider && !hasGoogleCalendar && !!hasOutlookCalendar);
        const attendees = [patientEmail];
        const cleanTitle = event.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
        const syncDescription = await buildDescriptionWithManageLink({
            doctorId: doctor.id,
            patientId: event.patient.id,
            fechaHoraInicio: event.fechaHoraInicio,
            descripcion: event.descripcion,
        });
        const hasMeetLink = !!event.linkMeeting && event.linkMeeting.includes('meet.google.com');
        const hasTeamsLink = !!event.linkMeeting && event.linkMeeting.includes('teams.microsoft.com');
        let synced = false;
        if (shouldSyncWithGoogle && hasGoogleCalendar) {
            const syncResult = await googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent(doctor.id, {
                id: event.id,
                title: cleanTitle,
                description: syncDescription,
                start: event.fechaHoraInicio,
                end: event.fechaHoraFin,
                attendees,
                externalEventId: (_a = event.externalEventId) !== null && _a !== void 0 ? _a : undefined,
                location: (_b = event.linkMeeting) !== null && _b !== void 0 ? _b : undefined,
                conferenceType: hasMeetLink ? 'google-meet' : null,
                conferenceLink: (_c = event.linkMeeting) !== null && _c !== void 0 ? _c : undefined,
                googleMeetEnabled: hasMeetLink,
                disableConference: !hasMeetLink,
                sendUpdates: (0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
                    externalEventId: event.externalEventId,
                    attendeeCount: attendees.length,
                    notifyAttendees: true,
                }),
            });
            if (syncResult) {
                synced = true;
                await prisma.internalCalendarEvent.update({
                    where: { id: event.id },
                    data: {
                        externalProvider: 'google',
                        externalEventId: syncResult.externalEventId,
                        externalUpdatedAt: syncResult.externalUpdatedAt,
                    },
                });
            }
        }
        else if (shouldSyncWithOutlook && hasOutlookCalendar) {
            const syncResult = await outlookCalendarSync_service_1.OutlookCalendarSyncService.upsertEvent(doctor.id, {
                id: event.id,
                title: cleanTitle,
                description: syncDescription,
                start: event.fechaHoraInicio,
                end: event.fechaHoraFin,
                attendees,
                externalEventId: (_d = event.externalEventId) !== null && _d !== void 0 ? _d : undefined,
                location: (_e = event.linkMeeting) !== null && _e !== void 0 ? _e : undefined,
                teamsEnabled: hasTeamsLink,
                disableConference: !hasTeamsLink,
                conferenceLink: (_f = event.linkMeeting) !== null && _f !== void 0 ? _f : undefined,
            });
            if (syncResult) {
                synced = true;
                await prisma.internalCalendarEvent.update({
                    where: { id: event.id },
                    data: {
                        externalProvider: 'outlook',
                        externalEventId: syncResult.externalEventId,
                        externalUpdatedAt: syncResult.externalUpdatedAt,
                    },
                });
            }
        }
        if (!synced) {
            throw new error_utils_1.AppError('No se pudo sincronizar con un calendario externo. Verifica que Google Calendar esté enlazado en Configuración → Calendario.', 400);
        }
        res.json({
            success: true,
            message: 'Invitación de calendario reenviada al paciente',
            calendarSync: true,
        });
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al reenviar invitación de calendario.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.resendCalendarInvite = resendCalendarInvite;
// Compartir evento del calendario por email
// TODO: Preparado para agregar WhatsApp en el futuro - se puede agregar sendCalendarEventWhatsApp
const shareCalendarEvent = async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    try {
        const doctorId = await resolveDoctorId(req);
        const doctor = await prisma.doctor.findUnique({
            where: { id: doctorId },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { eventId } = req.params;
        // Buscar el evento
        const event = await prisma.internalCalendarEvent.findFirst({
            where: {
                id: eventId,
                doctorId: doctor.id
            },
            select: {
                id: true,
                titulo: true,
                descripcion: true,
                fechaHoraInicio: true,
                fechaHoraFin: true,
                origenEvento: true,
                linkMeeting: true,
                externalProvider: true,
                externalEventId: true,
                patient: {
                    select: {
                        id: true,
                        userId: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                doctor: {
                    select: {
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
        if (!event) {
            throw new error_utils_1.AppError('Evento no encontrado', 404);
        }
        if (!event.patient) {
            throw new error_utils_1.AppError('Este evento no está asociado a un paciente', 400);
        }
        // Obtener el email del paciente (del Patient o del User)
        let patientEmail = event.patient.email;
        // Si no hay email en Patient, obtenerlo del User
        if (!patientEmail && event.patient.userId) {
            const patientUser = await prisma.user.findUnique({
                where: { id: event.patient.userId },
                select: { email: true }
            });
            patientEmail = (patientUser === null || patientUser === void 0 ? void 0 : patientUser.email) || null;
        }
        if (!patientEmail) {
            throw new error_utils_1.AppError('El paciente no tiene email registrado', 400);
        }
        // Preparar datos para el email
        const emailService = notification_service_1.EmailService.getInstance();
        const doctorName = `${doctor.user.firstName} ${doctor.user.lastName}`;
        const patientName = `${event.patient.firstName} ${event.patient.lastName}`;
        // Buscar si hay una cita (appointment) relacionada para obtener el link de pre-consulta
        let preConsultationLink = undefined;
        if (event.patient.id) {
            try {
                // Buscar appointment relacionado con este paciente y fecha similar
                const appointment = await prisma.appointment.findFirst({
                    where: {
                        patientId: event.patient.id,
                        doctorId: doctor.id,
                        date: {
                            gte: new Date(event.fechaHoraInicio.getTime() - 24 * 60 * 60 * 1000), // 1 día antes
                            lte: new Date(event.fechaHoraInicio.getTime() + 24 * 60 * 60 * 1000) // 1 día después
                        }
                    },
                    include: {
                        preConsultation: true
                    },
                    orderBy: {
                        date: 'desc'
                    }
                });
                if ((appointment === null || appointment === void 0 ? void 0 : appointment.preConsultation) && appointment.preConsultation.status === 'PENDING') {
                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                    preConsultationLink = `${frontendUrl}/pre-consulta/${appointment.preConsultation.token}`;
                }
            }
            catch (preConsultationError) {
                console.error('Error buscando pre-consulta para el email:', preConsultationError);
                // Continuar sin el link de pre-consulta si hay error
            }
        }
        // CRÍTICO: Sincronizar el evento con calendarios externos para enviar invitación al paciente
        // Esto asegura que el paciente reciba la invitación en su calendario electrónico
        let calendarSyncSuccess = false;
        // Función auxiliar para obtener el email del paciente
        const getPatientEmailForSync = async (patient) => {
            if (!patient)
                return null;
            if (patient.email)
                return patient.email;
            if (patient.userId) {
                const patientUser = await prisma.user.findUnique({
                    where: { id: patient.userId },
                    select: { email: true }
                });
                return (patientUser === null || patientUser === void 0 ? void 0 : patientUser.email) || null;
            }
            return null;
        };
        const patientEmailForSync = await getPatientEmailForSync(event.patient);
        if (patientEmailForSync) {
            // Verificar si el doctor tiene calendarios externos configurados
            const hasGoogleCalendar = await prisma.calendarSyncConfig.findFirst({
                where: {
                    doctorId: doctor.id,
                    provider: 'google',
                    isConnected: true,
                    accessToken: { not: null }
                }
            });
            const hasOutlookCalendar = await prisma.calendarSyncConfig.findFirst({
                where: {
                    doctorId: doctor.id,
                    provider: 'outlook',
                    isConnected: true,
                    accessToken: { not: null }
                }
            });
            const hasAppleCalendar = await prisma.calendarSyncConfig.findFirst({
                where: {
                    doctorId: doctor.id,
                    provider: 'apple',
                    isConnected: true,
                    accessToken: { not: null }
                }
            });
            // CRÍTICO: Siempre sincronizar con un calendario externo para que el paciente reciba la invitación
            // Prioridad: 1) Calendario del origen del evento (si ya está sincronizado)
            //            2) Primer calendario disponible del doctor (Google > Outlook > Apple)
            // Si el evento ya está sincronizado con un proveedor, actualizarlo para incluir al paciente
            const shouldSyncWithGoogle = event.origenEvento === 'google' ||
                event.externalProvider === 'google';
            const shouldSyncWithOutlook = event.origenEvento === 'outlook' ||
                event.externalProvider === 'outlook';
            const shouldSyncWithApple = event.origenEvento === 'apple' ||
                event.externalProvider === 'apple';
            // Si no está sincronizado, usar el primer calendario disponible del doctor
            // Esto asegura que el paciente SIEMPRE reciba una invitación de calendario
            const needsSyncWithAnyCalendar = !shouldSyncWithGoogle && !shouldSyncWithOutlook && !shouldSyncWithApple;
            const shouldSyncWithGoogleAsFallback = needsSyncWithAnyCalendar && hasGoogleCalendar;
            const shouldSyncWithOutlookAsFallback = needsSyncWithAnyCalendar && !hasGoogleCalendar && hasOutlookCalendar;
            const shouldSyncWithAppleAsFallback = needsSyncWithAnyCalendar && !hasGoogleCalendar && !hasOutlookCalendar && hasAppleCalendar;
            const finalShouldSyncWithGoogle = shouldSyncWithGoogle || shouldSyncWithGoogleAsFallback;
            const finalShouldSyncWithOutlook = shouldSyncWithOutlook || shouldSyncWithOutlookAsFallback;
            const finalShouldSyncWithApple = shouldSyncWithApple || shouldSyncWithAppleAsFallback;
            console.log('🔍 Diagnóstico de sincronización:');
            console.log('   Origen evento:', event.origenEvento);
            console.log('   External Provider:', event.externalProvider || 'NINGUNO');
            console.log('   External Event ID:', event.externalEventId || 'NINGUNO');
            console.log('   Doctor tiene Google Calendar:', hasGoogleCalendar ? 'SÍ' : 'NO');
            console.log('   Doctor tiene Outlook Calendar:', hasOutlookCalendar ? 'SÍ' : 'NO');
            console.log('   Doctor tiene Apple Calendar:', hasAppleCalendar ? 'SÍ' : 'NO');
            console.log('   Evento ya sincronizado con Google:', shouldSyncWithGoogle ? 'SÍ' : 'NO');
            console.log('   Evento ya sincronizado con Outlook:', shouldSyncWithOutlook ? 'SÍ' : 'NO');
            console.log('   Evento ya sincronizado con Apple:', shouldSyncWithApple ? 'SÍ' : 'NO');
            console.log('   Necesita sincronización con cualquier calendario:', needsSyncWithAnyCalendar ? 'SÍ' : 'NO');
            console.log('   ✅ Sincronizar con Google:', finalShouldSyncWithGoogle ? 'SÍ' : 'NO');
            console.log('   ✅ Sincronizar con Outlook:', finalShouldSyncWithOutlook ? 'SÍ' : 'NO');
            console.log('   ✅ Sincronizar con Apple:', finalShouldSyncWithApple ? 'SÍ' : 'NO');
            // Sincronizar con Google Calendar (prioridad 1)
            if (finalShouldSyncWithGoogle) {
                try {
                    const attendees = [patientEmailForSync];
                    console.log('📅 Sincronizando evento con Google Calendar para incluir al paciente...');
                    console.log('   Email del paciente:', patientEmailForSync);
                    console.log('   External Event ID:', event.externalEventId || 'NUEVO');
                    console.log('   Attendees a incluir:', attendees.join(', '));
                    // Limpiar el título: remover cualquier prefijo de estatus que pueda tener
                    const cleanTitle = event.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
                    const syncDescription = await buildDescriptionWithManageLink({
                        doctorId: doctor.id,
                        patientId: (_b = (_a = event.patient) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null,
                        fechaHoraInicio: event.fechaHoraInicio,
                        descripcion: event.descripcion
                    });
                    const syncResult = await googleCalendarSync_service_1.GoogleCalendarSyncService.upsertEvent(doctor.id, {
                        id: event.id,
                        title: cleanTitle,
                        description: syncDescription,
                        start: event.fechaHoraInicio,
                        end: event.fechaHoraFin,
                        attendees,
                        externalEventId: (_c = event.externalEventId) !== null && _c !== void 0 ? _c : undefined,
                        location: (_d = event.linkMeeting) !== null && _d !== void 0 ? _d : undefined,
                        conferenceType: ((_e = event.linkMeeting) === null || _e === void 0 ? void 0 : _e.includes('meet.google.com')) ? 'google-meet' : null,
                        conferenceLink: (_f = event.linkMeeting) !== null && _f !== void 0 ? _f : undefined,
                        googleMeetEnabled: !!((_g = event.linkMeeting) === null || _g === void 0 ? void 0 : _g.includes('meet.google.com')),
                        sendUpdates: (0, calendarSync_utils_1.resolveGoogleCalendarSendUpdates)({
                            externalEventId: event.externalEventId,
                            attendeeCount: attendees.length,
                            notifyAttendees: true,
                        }),
                    });
                    if (syncResult) {
                        // Actualizar el evento con el externalEventId si es nuevo
                        if (!event.externalEventId && syncResult.externalEventId) {
                            await prisma.internalCalendarEvent.update({
                                where: { id: event.id },
                                data: {
                                    externalProvider: 'google',
                                    externalEventId: syncResult.externalEventId,
                                    externalUpdatedAt: syncResult.externalUpdatedAt,
                                    linkMeeting: syncResult.conferenceLink || event.linkMeeting
                                }
                            });
                        }
                        calendarSyncSuccess = true;
                        console.log('✅ Evento sincronizado con Google Calendar - el paciente recibirá la invitación');
                    }
                    else {
                        console.error('   ❌ No se obtuvo resultado de la sincronización con Google Calendar');
                    }
                }
                catch (syncError) {
                    console.error('⚠️  Error sincronizando con Google Calendar:', syncError);
                    // Continuar con el email aunque falle la sincronización
                }
            }
            // Sincronizar con Outlook Calendar (solo si no se sincronizó con Google)
            if (finalShouldSyncWithOutlook && !calendarSyncSuccess) {
                try {
                    const attendees = [patientEmailForSync];
                    console.log('📅 Sincronizando evento con Outlook para incluir al paciente...');
                    console.log('   Email del paciente:', patientEmailForSync);
                    console.log('   External Event ID:', event.externalEventId || 'NUEVO');
                    console.log('   Attendees a incluir:', attendees.join(', '));
                    // Limpiar el título: remover cualquier prefijo de estatus que pueda tener
                    const cleanTitle = event.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
                    const syncDescription = await buildDescriptionWithManageLink({
                        doctorId: doctor.id,
                        patientId: (_j = (_h = event.patient) === null || _h === void 0 ? void 0 : _h.id) !== null && _j !== void 0 ? _j : null,
                        fechaHoraInicio: event.fechaHoraInicio,
                        descripcion: event.descripcion
                    });
                    const hasTeamsLink = !!event.linkMeeting && event.linkMeeting.includes('teams.microsoft.com');
                    const syncResult = await outlookCalendarSync_service_1.OutlookCalendarSyncService.upsertEvent(doctor.id, {
                        id: event.id,
                        title: cleanTitle,
                        description: syncDescription,
                        start: event.fechaHoraInicio,
                        end: event.fechaHoraFin,
                        attendees,
                        externalEventId: (_k = event.externalEventId) !== null && _k !== void 0 ? _k : undefined,
                        location: (_l = event.linkMeeting) !== null && _l !== void 0 ? _l : undefined,
                        teamsEnabled: hasTeamsLink,
                        conferenceLink: (_m = event.linkMeeting) !== null && _m !== void 0 ? _m : undefined,
                        disableConference: !hasTeamsLink
                    });
                    if (syncResult) {
                        if (!event.externalEventId && syncResult.externalEventId) {
                            await prisma.internalCalendarEvent.update({
                                where: { id: event.id },
                                data: {
                                    externalProvider: 'outlook',
                                    externalEventId: syncResult.externalEventId,
                                    externalUpdatedAt: syncResult.externalUpdatedAt
                                }
                            });
                            console.log('   ✅ Evento creado en Outlook con ID:', syncResult.externalEventId);
                        }
                        else if (event.externalEventId) {
                            console.log('   ✅ Evento actualizado en Outlook con ID:', event.externalEventId);
                            console.log('   ✅ Se envió invitación al paciente:', patientEmailForSync);
                        }
                        calendarSyncSuccess = true;
                        console.log('✅ Evento sincronizado con Outlook - el paciente recibirá la invitación');
                    }
                    else {
                        console.error('   ❌ No se obtuvo resultado de la sincronización con Outlook');
                    }
                }
                catch (syncError) {
                    console.error('⚠️  Error sincronizando con Outlook:', syncError);
                }
            }
            // Sincronizar con Apple Calendar (solo si no se sincronizó con Google u Outlook)
            if (finalShouldSyncWithApple && !calendarSyncSuccess) {
                try {
                    const attendees = [patientEmailForSync];
                    console.log('📅 Sincronizando evento con Apple Calendar para incluir al paciente...');
                    console.log('   Email del paciente:', patientEmailForSync);
                    console.log('   External Event ID:', event.externalEventId || 'NUEVO');
                    console.log('   Attendees a incluir:', attendees.join(', '));
                    // Limpiar el título: remover cualquier prefijo de estatus que pueda tener
                    const cleanTitle = event.titulo.replace(/^❌ Cita rechazada:\s*/i, '').trim();
                    const syncDescription = await buildDescriptionWithManageLink({
                        doctorId: doctor.id,
                        patientId: (_p = (_o = event.patient) === null || _o === void 0 ? void 0 : _o.id) !== null && _p !== void 0 ? _p : null,
                        fechaHoraInicio: event.fechaHoraInicio,
                        descripcion: event.descripcion
                    });
                    const syncResult = await appleCalendarSync_service_1.AppleCalendarSyncService.upsertEvent(doctor.id, {
                        id: event.id,
                        title: cleanTitle,
                        description: syncDescription,
                        start: event.fechaHoraInicio,
                        end: event.fechaHoraFin,
                        attendees,
                        externalEventId: (_q = event.externalEventId) !== null && _q !== void 0 ? _q : undefined
                    });
                    if (syncResult) {
                        if (!event.externalEventId && syncResult.externalEventId) {
                            await prisma.internalCalendarEvent.update({
                                where: { id: event.id },
                                data: {
                                    externalProvider: 'apple',
                                    externalEventId: syncResult.externalEventId,
                                    externalUpdatedAt: syncResult.externalUpdatedAt
                                }
                            });
                            console.log('   ✅ Evento creado en Apple Calendar con ID:', syncResult.externalEventId);
                        }
                        else if (event.externalEventId) {
                            console.log('   ✅ Evento actualizado en Apple Calendar con ID:', event.externalEventId);
                            console.log('   ✅ Se envió invitación al paciente:', patientEmailForSync);
                        }
                        calendarSyncSuccess = true;
                        console.log('✅ Evento sincronizado con Apple Calendar - el paciente recibirá la invitación');
                    }
                    else {
                        console.error('   ❌ No se obtuvo resultado de la sincronización con Apple Calendar');
                    }
                }
                catch (syncError) {
                    console.error('⚠️  Error sincronizando con Apple Calendar:', syncError);
                }
            }
            if (!calendarSyncSuccess) {
                console.warn('⚠️  ADVERTENCIA: No se pudo sincronizar el evento con ningún calendario externo.');
                console.warn('   El paciente NO recibirá una invitación de calendario, solo el email.');
                console.warn('   Asegúrate de que el doctor tenga al menos un calendario (Google/Outlook/Apple) configurado.');
            }
        }
        else {
            console.warn('⚠️  No se puede sincronizar: el paciente no tiene email registrado');
        }
        // TODO: En el futuro, aquí se puede agregar envío por WhatsApp
        // const whatsappService = WhatsAppService.getInstance();
        // if (event.patient.phone) {
        //   await whatsappService.sendCalendarEventWhatsApp(...);
        // }
        const resolvedDoctorId = event.doctorId || ((_r = event.doctor) === null || _r === void 0 ? void 0 : _r.id);
        const resolvedPatientId = event.patientId || ((_s = event.patient) === null || _s === void 0 ? void 0 : _s.id) || undefined;
        const appointmentCandidate = await prisma.appointment.findFirst({
            where: {
                doctorId: resolvedDoctorId,
                patientId: resolvedPatientId,
                date: {
                    gte: new Date(event.fechaHoraInicio.getTime() - 30 * 60000),
                    lte: new Date(event.fechaHoraInicio.getTime() + 30 * 60000)
                }
            },
            select: { id: true }
        });
        const emailPayload = (appointmentCandidate === null || appointmentCandidate === void 0 ? void 0 : appointmentCandidate.id)
            ? await (0, appointmentConfirmation_utils_1.buildAppointmentCalendarEmailPayload)({
                doctorId: doctor.id,
                appointmentId: appointmentCandidate.id,
                doctorTimezone: doctor.timezone,
                eventTitle: event.titulo,
                eventDate: event.fechaHoraInicio,
                eventEndDate: event.fechaHoraFin,
                description: event.descripcion,
                linkMeeting: event.linkMeeting,
                eventId: event.id,
                preConsultationLink,
            })
            : {
                eventTitle: event.titulo,
                eventDate: event.fechaHoraInicio,
                eventEndDate: event.fechaHoraFin,
                description: event.descripcion || undefined,
                linkMeeting: event.linkMeeting || undefined,
                tipoCita: (event.linkMeeting ? 'remota' : 'presencial'),
                preConsultationLink,
            };
        const emailSent = await emailService.sendCalendarEventEmail(patientEmail, Object.assign(Object.assign({ patientName,
            doctorName }, emailPayload), { appointmentId: appointmentCandidate === null || appointmentCandidate === void 0 ? void 0 : appointmentCandidate.id, calendarInviteExpected: true }));
        if (!emailSent) {
            throw new error_utils_1.AppError('Error al enviar el email', 500);
        }
        const message = calendarSyncSuccess
            ? 'Evento compartido por email y sincronizado con calendario. El paciente recibirá la invitación en su calendario electrónico.'
            : 'Evento compartido por email correctamente.';
        res.json({
            success: true,
            message,
            channel: 'email',
            calendarSynced: calendarSyncSuccess
            // TODO: Agregar channel: 'whatsapp' cuando se implemente
        });
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al compartir evento del calendario.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.shareCalendarEvent = shareCalendarEvent;
