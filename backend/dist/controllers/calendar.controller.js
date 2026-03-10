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
exports.shareCalendarEvent = exports.getCalendarEvent = exports.cancelAppointment = exports.deleteCalendarEvent = exports.updateCalendarEvent = exports.createCalendarEvent = exports.getCalendarEvents = void 0;
const client_1 = require("@prisma/client");
const error_utils_1 = require("../utils/error.utils");
const notification_service_1 = require("../services/notification.service");
const googleCalendarSync_service_1 = require("../services/googleCalendarSync.service");
const outlookCalendarSync_service_1 = require("../services/outlookCalendarSync.service");
const appleCalendarSync_service_1 = require("../services/appleCalendarSync.service");
const notionCalendarSync_service_1 = require("../services/notionCalendarSync.service");
const crypto_1 = __importDefault(require("crypto"));
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
const getOrCreateManageLink = async (appointmentId) => {
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
    const confirmationToken = crypto_1.default.randomBytes(32).toString('hex');
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
};
const buildDescriptionWithManageLink = async (event) => {
    var _a, _b;
    const resolvedDoctorId = event.doctorId || ((_a = event.doctor) === null || _a === void 0 ? void 0 : _a.id);
    const resolvedPatientId = event.patientId || ((_b = event.patient) === null || _b === void 0 ? void 0 : _b.id) || null;
    if (!resolvedDoctorId || !resolvedPatientId) {
        return event.descripcion || undefined;
    }
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
    if (!(appointmentCandidate === null || appointmentCandidate === void 0 ? void 0 : appointmentCandidate.id)) {
        return event.descripcion || undefined;
    }
    const manageLink = await getOrCreateManageLink(appointmentCandidate.id);
    const base = (event.descripcion || '').trim();
    if (base.includes(manageLink)) {
        return base || undefined;
    }
    const manageText = `Gestiona tu cita en Qlinexa: ${manageLink}\nSi necesitas confirmar o reprogramar, usa este enlace.`;
    return base ? `${base}\n\n${manageText}` : manageText;
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
            var _a, _b;
            let confirmationStatus = null;
            let appointmentId = null;
            // Buscar appointment para cualquier evento con paciente (cita médica)
            if (event.patientId) {
                // Buscar appointment que coincida con patientId, doctorId y fecha/hora similar
                // Usar un rango de ±30 minutos para encontrar el appointment relacionado
                const eventStart = new Date(event.fechaHoraInicio);
                const searchStart = new Date(eventStart);
                searchStart.setMinutes(searchStart.getMinutes() - 30);
                const searchEnd = new Date(eventStart);
                searchEnd.setMinutes(searchEnd.getMinutes() + 30);
                // Primero intentar buscar por fecha exacta o cercana
                let appointment = await prisma.appointment.findFirst({
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
                        date: true
                    },
                    orderBy: {
                        date: 'desc'
                    }
                });
                // Si no se encuentra por fecha cercana, buscar el appointment más reciente del paciente con este doctor
                // Esto es útil cuando la cita fue reagendada y la fecha cambió significativamente
                if (!appointment) {
                    appointment = await prisma.appointment.findFirst({
                        where: {
                            patientId: event.patientId,
                            doctorId
                        },
                        select: {
                            id: true,
                            confirmationStatus: true,
                            date: true
                        },
                        orderBy: {
                            date: 'desc'
                        }
                    });
                    if (appointment) {
                        console.log(`⚠️ Appointment encontrado por paciente/doctor (no por fecha exacta) - puede ser una cita reagendada`);
                        console.log(`   Appointment date: ${appointment.date}, Event date: ${eventStart}`);
                        // CRÍTICO: Si la fecha del appointment está muy lejos de la fecha del evento (más de 1 día),
                        // asumir PENDING porque es probable que sea una cita reagendada
                        const appointmentDate = new Date(appointment.date);
                        const dateDiff = Math.abs(appointmentDate.getTime() - eventStart.getTime());
                        const oneDayInMs = 24 * 60 * 60 * 1000;
                        if (dateDiff > oneDayInMs) {
                            console.log(`   ⚠️ La fecha del appointment (${appointmentDate}) está muy lejos de la fecha del evento (${eventStart})`);
                            console.log(`   ⚠️ Diferencia: ${Math.round(dateDiff / (60 * 60 * 1000))} horas - asumiendo PENDING`);
                            confirmationStatus = 'PENDING';
                            appointment = null; // No usar este appointment para evitar confusión
                        }
                    }
                }
                if (appointment) {
                    // Usar el confirmationStatus del appointment, o PENDING si es null/undefined
                    confirmationStatus = appointment.confirmationStatus || 'PENDING';
                    appointmentId = appointment.id;
                    // CRÍTICO: Si el evento tiene externalEventId, verificar el estado actual de los attendees
                    // en el calendario externo (Google, Outlook, Apple) para detectar si el paciente aceptó/rechazó
                    if (event.externalProvider && event.externalEventId) {
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
                            const patientEmail = (patient === null || patient === void 0 ? void 0 : patient.email) || ((_a = patient === null || patient === void 0 ? void 0 : patient.user) === null || _a === void 0 ? void 0 : _a.email);
                            if (!patientEmail) {
                                // No hay email del paciente, no podemos verificar el estado
                                return Object.assign(Object.assign({}, event), { confirmationStatus,
                                    appointmentId });
                            }
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
                                    const status = (_b = patientAttendee.status) === null || _b === void 0 ? void 0 : _b.toLowerCase();
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
                                    // El paciente aceptó la invitación - SIEMPRE actualizar a CONFIRMED
                                    // Incluso si antes estaba CANCELLED (el paciente puede cambiar de opinión)
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
            return Object.assign(Object.assign({}, event), { confirmationStatus: confirmationStatus || 'PENDING', appointmentId });
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
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
        const { patientId, fechaHoraInicio, fechaHoraFin, titulo, descripcion, origenEvento = 'interno', linkMeeting, meetingPlatform = '' } = req.body;
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
            console.log('   Patient encontrado:', patient ? `SÍ (userId: ${patient.userId})` : 'NO');
            if (!patient.userId) {
                console.error('   ❌ ERROR: El paciente no tiene userId asociado');
                throw new error_utils_1.AppError('El paciente no tiene una cuenta de usuario asociada', 400);
            }
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
                    appointment = await prisma.appointment.create({
                        data: {
                            doctorId,
                            patientId: patientId,
                            doctorPatientId: doctorPatient.id,
                            userId: patient.userId,
                            date: new Date(fechaHoraInicio),
                            status: 'SCHEDULED',
                            confirmationStatus: 'PENDING', // Explícitamente establecer como PENDING para nuevas citas
                            notes: `Cita creada desde calendario - ${titulo}`
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
        let event = await prisma.internalCalendarEvent.create({
            data: {
                doctorId: doctor.id,
                patientId,
                fechaHoraInicio: new Date(fechaHoraInicio),
                fechaHoraFin: new Date(fechaHoraFin),
                titulo: cleanTitleForDB, // Guardar solo el título limpio (sin prefijo de estatus)
                descripcion,
                origenEvento,
                linkMeeting,
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
        console.log('✅ Evento de calendario creado:', event.id);
        console.log('   Paciente asociado:', event.patient ? `${event.patient.firstName} ${event.patient.lastName}` : 'NINGUNO');
        console.log('   Email del paciente (Patient.email):', ((_a = event.patient) === null || _a === void 0 ? void 0 : _a.email) || 'NO DISPONIBLE');
        console.log('   Patient userId:', ((_b = event.patient) === null || _b === void 0 ? void 0 : _b.userId) || 'NO DISPONIBLE');
        console.log('   LinkMeeting:', event.linkMeeting || 'NO DISPONIBLE');
        console.log('   Meeting Platform:', meetingPlatform || 'NO ESPECIFICADO');
        // Verificar si el doctor tiene calendarios externos configurados
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
                    patientId: (_d = (_c = event.patient) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null,
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
                    externalEventId: (_e = event.externalEventId) !== null && _e !== void 0 ? _e : undefined,
                    location: (_f = event.linkMeeting) !== null && _f !== void 0 ? _f : undefined,
                    conferenceType: wantsGoogleConference ? 'google-meet' : null,
                    conferenceLink: (_g = event.linkMeeting) !== null && _g !== void 0 ? _g : undefined,
                    googleMeetEnabled: meetingPlatform === 'google-meet'
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
                    if (syncResult.conferenceLink) {
                        updateData.linkMeeting = syncResult.conferenceLink;
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
                    console.warn('⚠️  No se obtuvo resultado de sincronización con Google Calendar');
                    console.warn('   Esto puede deberse a:');
                    console.warn('   - El doctor no tiene Google Calendar conectado');
                    console.warn('   - Error en las credenciales de Google');
                    console.warn('   - El paciente NO recibirá invitación al calendario');
                }
            }
            catch (error) {
                console.error('❌ ERROR CRÍTICO sincronizando evento con Google Calendar:', error);
                console.error('   El evento se creó en la base de datos pero NO se sincronizó con Google');
                console.error('   El paciente NO recibirá la invitación al calendario');
                if (error instanceof Error) {
                    console.error('   Mensaje:', error.message);
                    console.error('   Stack (primeras 5 líneas):');
                    const stackLines = ((_h = error.stack) === null || _h === void 0 ? void 0 : _h.split('\n').slice(0, 5)) || [];
                    stackLines.forEach((line) => console.error('     ', line));
                }
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
                    conferenceLink: (_l = event.linkMeeting) !== null && _l !== void 0 ? _l : undefined
                });
                if (syncResult) {
                    const updateData = {
                        externalProvider: 'outlook',
                        externalEventId: syncResult.externalEventId,
                        externalUpdatedAt: syncResult.externalUpdatedAt
                    };
                    if (syncResult.conferenceLink) {
                        updateData.linkMeeting = syncResult.conferenceLink;
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
                var _a, _b, _c;
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
                    if (appointment === null || appointment === void 0 ? void 0 : appointment.id) {
                        manageLink = await getOrCreateManageLink(appointment.id);
                    }
                    const emailData = {
                        patientName,
                        doctorName,
                        eventTitle: updatedEvent.titulo,
                        eventDate: updatedEvent.fechaHoraInicio,
                        eventEndDate: updatedEvent.fechaHoraFin,
                        description: updatedEvent.descripcion || undefined,
                        linkMeeting: updatedEvent.linkMeeting || undefined,
                        tipoCita: updatedEvent.linkMeeting ? 'remota' : 'presencial',
                        preConsultationLink: preConsultationLink || undefined,
                        manageLink
                    };
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
        console.log('=== FIN createCalendarEvent (éxito) ===');
        res.status(201).json(event);
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
// Actualizar un evento del calendario (solo si es interno)
const updateCalendarEvent = async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    try {
        const doctorId = await resolveDoctorId(req);
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { eventId } = req.params;
        const { patientId, fechaHoraInicio, fechaHoraFin, titulo, descripcion, linkMeeting, meetingPlatform = '' } = req.body;
        // Buscar el evento
        const existingEvent = await prisma.internalCalendarEvent.findUnique({
            where: { id: eventId }
        });
        if (!existingEvent) {
            throw new error_utils_1.AppError('Evento no encontrado', 404);
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
        // CRÍTICO: Si se reagendó la cita (fecha cambió) y hay un paciente, actualizar el appointment relacionado
        // y resetear el confirmationStatus para que se pueda sincronizar correctamente desde el calendario externo
        if (fechaCambio && updatedEvent.patient) {
            try {
                // Buscar el appointment relacionado con la fecha ANTERIOR
                const appointment = await prisma.appointment.findFirst({
                    where: {
                        doctorId: doctor.id,
                        patientId: updatedEvent.patient.id,
                        date: {
                            gte: new Date(existingEvent.fechaHoraInicio.getTime() - 30 * 60 * 1000), // 30 minutos antes
                            lte: new Date(existingEvent.fechaHoraInicio.getTime() + 30 * 60 * 1000) // 30 minutos después
                        }
                    },
                    orderBy: {
                        date: 'desc'
                    }
                });
                if (appointment) {
                    // Actualizar el appointment con la nueva fecha y resetear el confirmationStatus
                    await prisma.appointment.update({
                        where: { id: appointment.id },
                        data: {
                            date: new Date(fechaHoraInicio),
                            confirmationStatus: 'PENDING', // Resetear a PENDING para que se sincronice correctamente desde el calendario externo
                            confirmedAt: null,
                            cancelledAt: null,
                            status: 'SCHEDULED'
                        }
                    });
                    console.log(`✅ Appointment ${appointment.id} actualizado con nueva fecha y confirmationStatus reseteado después de reagendar`);
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
                            await prisma.appointment.create({
                                data: {
                                    doctorId: doctor.id,
                                    patientId: updatedEvent.patient.id,
                                    doctorPatientId: patient.doctors[0].id,
                                    userId: patient.userId || '',
                                    date: new Date(fechaHoraInicio),
                                    status: 'SCHEDULED',
                                    confirmationStatus: 'PENDING', // Explícitamente establecer como PENDING para citas reagendadas
                                    notes: `Cita reagendada desde calendario - ${cleanTitleForUpdate || titulo}`
                                }
                            });
                            console.log(`✅ Nuevo appointment creado para la cita reagendada con confirmationStatus: PENDING`);
                        }
                    }
                    else {
                        // Si existe un appointment en la nueva fecha, también resetearlo a PENDING
                        // porque es una cita reagendada y el paciente debe confirmar nuevamente
                        await prisma.appointment.update({
                            where: { id: existingAppointment.id },
                            data: {
                                confirmationStatus: 'PENDING',
                                confirmedAt: null,
                                cancelledAt: null,
                                status: 'SCHEDULED'
                            }
                        });
                        console.log(`✅ Appointment ${existingAppointment.id} reseteado a PENDING después de reagendar`);
                    }
                }
            }
            catch (appointmentError) {
                console.error('Error actualizando appointment después de reagendar:', appointmentError);
                // No fallar la actualización del evento si hay error con el appointment
            }
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
        const wantsGoogleConference = meetingPlatform === 'google-meet' ||
            (!!updatedEvent.linkMeeting && updatedEvent.linkMeeting.includes('meet.google.com'));
        const wantsOutlookConference = meetingPlatform === 'teams';
        if (shouldSyncWithGoogle) {
            try {
                const attendees = ((_a = updatedEvent.patient) === null || _a === void 0 ? void 0 : _a.email)
                    ? [updatedEvent.patient.email]
                    : [];
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
                    externalEventId: (_b = updatedEvent.externalEventId) !== null && _b !== void 0 ? _b : undefined,
                    location: (_c = updatedEvent.linkMeeting) !== null && _c !== void 0 ? _c : undefined,
                    conferenceType: wantsGoogleConference ? 'google-meet' : null,
                    conferenceLink: (_d = updatedEvent.linkMeeting) !== null && _d !== void 0 ? _d : undefined,
                    googleMeetEnabled: meetingPlatform === 'google-meet'
                });
                if (syncResult) {
                    const updateData = {
                        externalProvider: 'google',
                        externalEventId: syncResult.externalEventId,
                        externalUpdatedAt: syncResult.externalUpdatedAt
                    };
                    if (syncResult.conferenceLink) {
                        updateData.linkMeeting = syncResult.conferenceLink;
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
                console.error('Error syncing updated event to Google:', error);
            }
        }
        if (shouldSyncWithOutlook) {
            try {
                const attendees = ((_e = updatedEvent.patient) === null || _e === void 0 ? void 0 : _e.email)
                    ? [updatedEvent.patient.email]
                    : [];
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
                    location: (_f = updatedEvent.linkMeeting) !== null && _f !== void 0 ? _f : undefined,
                    externalEventId: (_g = updatedEvent.externalEventId) !== null && _g !== void 0 ? _g : undefined,
                    teamsEnabled: wantsOutlookConference,
                    conferenceLink: (_h = updatedEvent.linkMeeting) !== null && _h !== void 0 ? _h : undefined
                });
                if (syncResult) {
                    const updateData = {
                        externalProvider: 'outlook',
                        externalEventId: syncResult.externalEventId,
                        externalUpdatedAt: syncResult.externalUpdatedAt
                    };
                    if (syncResult.conferenceLink) {
                        updateData.linkMeeting = syncResult.conferenceLink;
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
                    attendees: ((_j = updatedEvent.patient) === null || _j === void 0 ? void 0 : _j.email) ? [updatedEvent.patient.email] : [],
                    externalEventId: (_k = updatedEvent.externalEventId) !== null && _k !== void 0 ? _k : undefined
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
                const attendees = ((_l = updatedEvent.patient) === null || _l === void 0 ? void 0 : _l.email)
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
                    location: (_m = updatedEvent.linkMeeting) !== null && _m !== void 0 ? _m : undefined,
                    externalEventId: (_o = updatedEvent.externalEventId) !== null && _o !== void 0 ? _o : undefined,
                    linkMeeting: (_p = updatedEvent.linkMeeting) !== null && _p !== void 0 ? _p : undefined
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
        res.json(updatedEvent);
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
    var _a, _b, _c, _d;
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
        // Buscar el appointment relacionado - usar búsqueda más robusta
        console.log('🔍 Buscando appointment para cancelar:');
        console.log('   Event ID:', eventId);
        console.log('   Event fechaHoraInicio:', event.fechaHoraInicio);
        console.log('   Patient ID:', event.patient.id);
        console.log('   Doctor ID:', doctor.id);
        // Primero intentar buscar por fecha exacta o cercana (±30 minutos)
        const searchStart = new Date(event.fechaHoraInicio.getTime() - 30 * 60 * 1000);
        const searchEnd = new Date(event.fechaHoraInicio.getTime() + 30 * 60 * 1000);
        console.log('   Buscando appointment entre:', searchStart, 'y', searchEnd);
        let appointment = await prisma.appointment.findFirst({
            where: {
                doctorId: doctor.id,
                patientId: event.patient.id,
                date: {
                    gte: searchStart,
                    lte: searchEnd
                }
            },
            orderBy: {
                date: 'desc'
            }
        });
        if (appointment) {
            console.log('   ✅ Appointment encontrado por fecha exacta:', appointment.id);
            console.log('   Appointment date:', appointment.date);
        }
        // Si no se encuentra por fecha cercana, buscar el appointment más reciente del paciente con este doctor
        // Esto es útil cuando la cita fue creada recientemente y puede haber pequeñas diferencias de tiempo
        if (!appointment) {
            console.log(`⚠️ Appointment no encontrado por fecha exacta, buscando el más reciente del paciente...`);
            const allAppointments = await prisma.appointment.findMany({
                where: {
                    doctorId: doctor.id,
                    patientId: event.patient.id
                },
                orderBy: {
                    date: 'desc'
                },
                take: 5 // Obtener los 5 más recientes para debugging
            });
            console.log(`   Encontrados ${allAppointments.length} appointments para este paciente y doctor`);
            allAppointments.forEach((apt, idx) => {
                const dateDiff = Math.abs(apt.date.getTime() - event.fechaHoraInicio.getTime());
                console.log(`   Appointment ${idx + 1}: ID=${apt.id}, date=${apt.date}, diff=${Math.round(dateDiff / (60 * 1000))} minutos`);
            });
            appointment = allAppointments[0] || null;
            if (appointment) {
                // Verificar que la fecha del appointment esté razonablemente cerca de la fecha del evento (dentro de 24 horas)
                const dateDiff = Math.abs(appointment.date.getTime() - event.fechaHoraInicio.getTime());
                const oneDayInMs = 24 * 60 * 60 * 1000;
                if (dateDiff > oneDayInMs) {
                    console.log(`⚠️ Appointment encontrado pero la fecha está muy lejos (${Math.round(dateDiff / (60 * 60 * 1000))} horas), no se usará`);
                    appointment = null;
                }
                else {
                    console.log(`✅ Appointment encontrado por búsqueda más amplia, diferencia: ${Math.round(dateDiff / (60 * 1000))} minutos`);
                }
            }
        }
        // Si aún no se encuentra el appointment, crearlo ahora (puede que no se haya creado al crear el evento)
        if (!appointment) {
            console.log(`⚠️ Appointment no encontrado, creándolo ahora para poder cancelarlo...`);
            // Buscar DoctorPatient
            const doctorPatient = await prisma.doctorPatient.findFirst({
                where: {
                    doctorId: doctor.id,
                    patientId: event.patient.id
                }
            });
            if (!doctorPatient) {
                throw new error_utils_1.AppError('No se encontró la relación entre el doctor y el paciente', 404);
            }
            // Crear el appointment ahora
            try {
                appointment = await prisma.appointment.create({
                    data: {
                        doctorId: doctor.id,
                        patientId: event.patient.id,
                        doctorPatientId: doctorPatient.id,
                        userId: event.patient.userId || '',
                        date: event.fechaHoraInicio,
                        status: 'SCHEDULED',
                        confirmationStatus: 'PENDING',
                        notes: `Cita creada desde evento de calendario - ${event.titulo}`
                    }
                });
                console.log(`✅ Appointment creado para cancelar: ${appointment.id}`);
            }
            catch (createError) {
                console.error('❌ Error al crear appointment para cancelar:', createError);
                throw new error_utils_1.AppError('No se pudo crear la cita relacionada con este evento', 500);
            }
        }
        // Actualizar el appointment a CANCELLED
        await prisma.appointment.update({
            where: { id: appointment.id },
            data: {
                confirmationStatus: 'CANCELLED',
                cancelledAt: new Date(),
                status: 'CANCELLED'
            }
        });
        console.log(`✅ Cita ${appointment.id} cancelada por el profesional de la salud`);
        // CRÍTICO: Actualizar el evento en el calendario externo para notificar al paciente
        if (event.externalEventId && event.externalProvider) {
            try {
                console.log(`📅 Actualizando evento en calendario externo (${event.externalProvider})...`);
                // Obtener el email del paciente
                let patientEmail = event.patient.email;
                if (!patientEmail && event.patient.userId) {
                    const patientUser = await prisma.user.findUnique({
                        where: { id: event.patient.userId },
                        select: { email: true }
                    });
                    patientEmail = (patientUser === null || patientUser === void 0 ? void 0 : patientUser.email) || null;
                }
                if (patientEmail) {
                    // Limpiar el título de cualquier prefijo anterior y crear uno claro de cancelación
                    const cleanTitle = event.titulo
                        .replace(/^❌ Cita rechazada:\s*/i, '')
                        .replace(/^❌ CANCELADA:\s*/i, '')
                        .replace(/^🏥\s*/g, '')
                        .replace(/\s+consulta$/i, '')
                        .trim();
                    // Título muy visible para el calendario del paciente
                    const cancelledTitle = `❌ CANCELADA - ${cleanTitle}`;
                    // Descripción clara y completa
                    const cancellationNotice = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠️ ESTA CITA HA SIDO CANCELADA\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nEsta cita médica ha sido cancelada por el profesional de la salud.\n\nPor favor, contacta al consultorio si deseas reagendar tu cita.\n\nSaludos,\nEquipo Qlinexa360';
                    const cancelledDescription = event.descripcion
                        ? `${event.descripcion}${cancellationNotice}`
                        : `Cita médica cancelada.${cancellationNotice}`;
                    console.log(`📧 Actualizando evento en calendario externo (${event.externalProvider}) para paciente: ${patientEmail}`);
                    console.log(`   Título: ${cancelledTitle}`);
                    if (event.externalProvider === 'google') {
                        const { GoogleCalendarSyncService } = await Promise.resolve().then(() => __importStar(require('../services/googleCalendarSync.service')));
                        await GoogleCalendarSyncService.upsertEvent(doctor.id, {
                            id: event.id,
                            title: cancelledTitle,
                            description: cancelledDescription,
                            start: event.fechaHoraInicio,
                            end: event.fechaHoraFin,
                            attendees: [patientEmail], // CRÍTICO: Incluir el paciente para que reciba la actualización
                            externalEventId: event.externalEventId,
                            location: (_a = event.linkMeeting) !== null && _a !== void 0 ? _a : undefined
                        });
                        console.log(`✅ Evento actualizado en Google Calendar como cancelado - el paciente recibirá la actualización automáticamente`);
                    }
                    else if (event.externalProvider === 'outlook') {
                        const { OutlookCalendarSyncService } = await Promise.resolve().then(() => __importStar(require('../services/outlookCalendarSync.service')));
                        await OutlookCalendarSyncService.upsertEvent(doctor.id, {
                            id: event.id,
                            title: cancelledTitle,
                            description: cancelledDescription,
                            start: event.fechaHoraInicio,
                            end: event.fechaHoraFin,
                            attendees: [patientEmail], // CRÍTICO: Incluir el paciente para que reciba la actualización
                            externalEventId: event.externalEventId,
                            location: (_b = event.linkMeeting) !== null && _b !== void 0 ? _b : undefined
                        });
                        console.log(`✅ Evento actualizado en Outlook Calendar como cancelado - el paciente recibirá la actualización automáticamente`);
                    }
                    else if (event.externalProvider === 'apple') {
                        const { AppleCalendarSyncService } = await Promise.resolve().then(() => __importStar(require('../services/appleCalendarSync.service')));
                        await AppleCalendarSyncService.upsertEvent(doctor.id, {
                            id: event.id,
                            title: cancelledTitle,
                            description: cancelledDescription,
                            start: event.fechaHoraInicio,
                            end: event.fechaHoraFin,
                            attendees: [patientEmail], // CRÍTICO: Incluir el paciente para que reciba la actualización
                            externalEventId: event.externalEventId
                        });
                        console.log(`✅ Evento actualizado en Apple Calendar como cancelado - el paciente recibirá la actualización automáticamente`);
                    }
                }
                else {
                    console.warn('⚠️ No se puede actualizar el calendario externo: el paciente no tiene email');
                }
            }
            catch (syncError) {
                console.error('❌ Error al actualizar evento en calendario externo:', syncError);
                // No fallar la cancelación si falla la sincronización
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
                const patientEmail = patientData.email || ((_c = patientData.user) === null || _c === void 0 ? void 0 : _c.email);
                const patientPhone = (_d = patientData.user) === null || _d === void 0 ? void 0 : _d.phone;
                const patientName = `${patientData.firstName} ${patientData.lastName}`.trim();
                const doctorName = `${doctorData.user.firstName} ${doctorData.user.lastName}`.trim();
                const appointmentDate = event.fechaHoraInicio;
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
// Compartir evento del calendario por email
// TODO: Preparado para agregar WhatsApp en el futuro - se puede agregar sendCalendarEventWhatsApp
const shareCalendarEvent = async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
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
                        googleMeetEnabled: !!((_g = event.linkMeeting) === null || _g === void 0 ? void 0 : _g.includes('meet.google.com'))
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
                    const syncResult = await outlookCalendarSync_service_1.OutlookCalendarSyncService.upsertEvent(doctor.id, {
                        id: event.id,
                        title: cleanTitle,
                        description: syncDescription,
                        start: event.fechaHoraInicio,
                        end: event.fechaHoraFin,
                        attendees,
                        externalEventId: (_k = event.externalEventId) !== null && _k !== void 0 ? _k : undefined,
                        location: (_l = event.linkMeeting) !== null && _l !== void 0 ? _l : undefined
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
                        patientId: (_o = (_m = event.patient) === null || _m === void 0 ? void 0 : _m.id) !== null && _o !== void 0 ? _o : null,
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
                        externalEventId: (_p = event.externalEventId) !== null && _p !== void 0 ? _p : undefined
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
        let manageLink = undefined;
        const resolvedDoctorId = event.doctorId || ((_q = event.doctor) === null || _q === void 0 ? void 0 : _q.id);
        const resolvedPatientId = event.patientId || ((_r = event.patient) === null || _r === void 0 ? void 0 : _r.id) || undefined;
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
        if (appointmentCandidate === null || appointmentCandidate === void 0 ? void 0 : appointmentCandidate.id) {
            manageLink = await getOrCreateManageLink(appointmentCandidate.id);
        }
        const emailSent = await emailService.sendCalendarEventEmail(patientEmail, {
            patientName,
            doctorName,
            eventTitle: event.titulo,
            eventDate: event.fechaHoraInicio,
            eventEndDate: event.fechaHoraFin,
            description: event.descripcion || undefined,
            linkMeeting: event.linkMeeting || undefined,
            tipoCita: event.linkMeeting ? 'remota' : 'presencial',
            preConsultationLink,
            manageLink
        });
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
