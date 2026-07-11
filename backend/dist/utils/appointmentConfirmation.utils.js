"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldSendPatientCalendarEmail = shouldSendPatientCalendarEmail;
exports.markPatientCalendarEmailSent = markPatientCalendarEmailSent;
exports.stripManageLinkBlocksFromDescription = stripManageLinkBlocksFromDescription;
exports.buildCleanEventDescriptionForSync = buildCleanEventDescriptionForSync;
exports.getAppointmentEffectiveDate = getAppointmentEffectiveDate;
exports.computeConfirmationTokenExpiry = computeConfirmationTokenExpiry;
exports.refreshConfirmationTokenExpiryForAppointment = refreshConfirmationTokenExpiryForAppointment;
exports.ensureActiveConfirmationRequest = ensureActiveConfirmationRequest;
exports.getOrCreateAppointmentManageLink = getOrCreateAppointmentManageLink;
exports.resolvePatientUserIdForAppointment = resolvePatientUserIdForAppointment;
exports.buildAppointmentCalendarEmailPayload = buildAppointmentCalendarEmailPayload;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../config/database"));
const error_utils_1 = require("./error.utils");
const mercadopago_config_1 = require("../payments/mercadopago/mercadopago.config");
const mercadopago_teleconsultation_service_1 = require("../payments/mercadopago/mercadopago.teleconsultation.service");
const mercadopago_inperson_service_1 = require("../payments/mercadopago/mercadopago.inperson.service");
const calendarSync_utils_1 = require("./calendarSync.utils");
const CALENDAR_EMAIL_DEDUP_MS = 15 * 60 * 1000;
/** Evita ráfagas de correos duplicados para la misma cita (presencial y teleconsulta). */
function shouldSendPatientCalendarEmail(appointmentId, lastSentAtMs) {
    if (!lastSentAtMs)
        return true;
    return Date.now() - lastSentAtMs > CALENDAR_EMAIL_DEDUP_MS;
}
function markPatientCalendarEmailSent(store, appointmentId) {
    store.set(appointmentId, Date.now());
}
const TOKEN_MIN_MS = 7 * 24 * 60 * 60 * 1000;
const POST_APPOINTMENT_GRACE_MS = 48 * 60 * 60 * 1000;
const MANAGE_LINK_BLOCK_RE = /(\n\n)?Gestiona tu cita en Qlinexa:[\s\S]*?(?=(\n\nGestiona tu cita|\n\n|$))/gi;
const CONFIRM_APPOINTMENT_URL_RE = /https?:\/\/[^\s]+\/confirm-appointment\/[a-f0-9]+/gi;
/** Quita bloques repetidos de gestión de cita del texto de descripción. */
function stripManageLinkBlocksFromDescription(text) {
    if (!text)
        return '';
    return text
        .replace(MANAGE_LINK_BLOCK_RE, '')
        .replace(CONFIRM_APPOINTMENT_URL_RE, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
/** Descripción limpia para calendario externo (un solo enlace de gestión). */
function buildCleanEventDescriptionForSync(notes, manageLink) {
    const clean = stripManageLinkBlocksFromDescription(notes);
    if (!manageLink)
        return clean;
    if (clean.includes(manageLink))
        return clean;
    const line = `Gestionar cita: ${manageLink}`;
    return clean ? `${clean}\n\n${line}` : line;
}
function getAppointmentEffectiveDate(appointment) {
    var _a;
    return (_a = appointment.rescheduledTo) !== null && _a !== void 0 ? _a : appointment.date;
}
/** El token permanece válido al menos 7 días y hasta 48 h después de la cita. */
function computeConfirmationTokenExpiry(appointmentDate) {
    const now = Date.now();
    return new Date(Math.max(now + TOKEN_MIN_MS, appointmentDate.getTime() + POST_APPOINTMENT_GRACE_MS));
}
async function refreshConfirmationTokenExpiryForAppointment(appointmentId) {
    const appointment = await database_1.default.appointment.findUnique({
        where: { id: appointmentId },
        select: { date: true, rescheduledTo: true },
    });
    if (!appointment)
        return;
    const targetExpiry = computeConfirmationTokenExpiry(getAppointmentEffectiveDate(appointment));
    if (targetExpiry <= new Date())
        return;
    await database_1.default.appointmentConfirmationRequest.updateMany({
        where: { appointmentId, status: 'PENDING' },
        data: { expiresAt: targetExpiry },
    });
}
/** Extiende tokens expirados si la cita aún está vigente; lanza si ya no aplica. */
async function ensureActiveConfirmationRequest(confirmationRequest) {
    const appointmentDate = getAppointmentEffectiveDate(confirmationRequest.appointment);
    const targetExpiry = computeConfirmationTokenExpiry(appointmentDate);
    const now = new Date();
    if (targetExpiry <= now) {
        throw new error_utils_1.AppError('Token de confirmación expirado', 400);
    }
    if (confirmationRequest.expiresAt < now || confirmationRequest.expiresAt < targetExpiry) {
        await database_1.default.appointmentConfirmationRequest.update({
            where: { id: confirmationRequest.id },
            data: { expiresAt: targetExpiry },
        });
    }
}
async function getOrCreateAppointmentManageLink(appointmentId) {
    const appointment = await database_1.default.appointment.findUnique({
        where: { id: appointmentId },
        select: { date: true, rescheduledTo: true },
    });
    if (!appointment) {
        throw new error_utils_1.AppError('Cita no encontrada', 404);
    }
    const targetExpiry = computeConfirmationTokenExpiry(getAppointmentEffectiveDate(appointment));
    const existingRequest = await database_1.default.appointmentConfirmationRequest.findFirst({
        where: { appointmentId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
    });
    if (existingRequest) {
        if (existingRequest.expiresAt < targetExpiry) {
            await database_1.default.appointmentConfirmationRequest.update({
                where: { id: existingRequest.id },
                data: { expiresAt: targetExpiry },
            });
        }
        return (0, mercadopago_config_1.buildConfirmAppointmentUrl)(existingRequest.confirmationToken);
    }
    const confirmationToken = crypto_1.default.randomBytes(32).toString('hex');
    await database_1.default.appointmentConfirmationRequest.create({
        data: {
            appointmentId,
            reminderType: 'FINAL_REMINDER',
            scheduledFor: new Date(),
            status: 'PENDING',
            confirmationToken,
            expiresAt: targetExpiry,
            patientResponse: 'NO_RESPONSE',
        },
    });
    return (0, mercadopago_config_1.buildConfirmAppointmentUrl)(confirmationToken);
}
/** Resuelve userId del paciente; intenta vincular por email si falta en el perfil. */
async function resolvePatientUserIdForAppointment(patientId) {
    var _a;
    const patient = await database_1.default.patient.findUnique({
        where: { id: patientId },
        select: { id: true, userId: true, email: true },
    });
    if (!patient) {
        throw new error_utils_1.AppError('Paciente no encontrado', 404);
    }
    if (patient.userId) {
        const linkedUser = await database_1.default.user.findUnique({
            where: { id: patient.userId },
            select: { id: true },
        });
        if (linkedUser)
            return patient.userId;
    }
    const normalizedEmail = (_a = patient.email) === null || _a === void 0 ? void 0 : _a.trim();
    if (normalizedEmail) {
        const userByEmail = await database_1.default.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
            select: { id: true },
        });
        if (userByEmail) {
            if (userByEmail.id !== patient.userId) {
                try {
                    await database_1.default.patient.update({
                        where: { id: patientId },
                        data: { userId: userByEmail.id },
                    });
                }
                catch (_b) {
                    /* Otro perfil Patient ya usa esa cuenta */
                }
            }
            return userByEmail.id;
        }
    }
    throw new error_utils_1.AppError('El paciente no tiene una cuenta de usuario asociada. Invítalo a registrarse en el portal del paciente.', 400);
}
async function buildAppointmentCalendarEmailPayload(params) {
    var _a, _b, _c, _d;
    const manageLink = await getOrCreateAppointmentManageLink(params.appointmentId);
    const confirmationToken = manageLink.split('/').pop() || '';
    const appointment = await database_1.default.appointment.findUnique({
        where: { id: params.appointmentId },
        select: {
            appointmentType: true,
            teleconsultation: { select: { consentSigned: true, meetingUrl: true } },
        },
    });
    const isTeleconsulta = (appointment === null || appointment === void 0 ? void 0 : appointment.appointmentType) === 'teleconsulta';
    const consentSigned = (_b = (_a = appointment === null || appointment === void 0 ? void 0 : appointment.teleconsultation) === null || _a === void 0 ? void 0 : _a.consentSigned) !== null && _b !== void 0 ? _b : false;
    const teleconsultaLink = isTeleconsulta && !consentSigned && confirmationToken
        ? (0, mercadopago_config_1.buildTeleconsultationConsentUrl)(confirmationToken)
        : undefined;
    let teleconsultationPaymentAmount;
    let teleconsultationPaymentCurrency;
    let teleconsultationPaymentStatus;
    let teleconsultationPaymentApproved;
    let teleconsultationCheckoutUrl;
    let inPersonPaymentAmount;
    let inPersonPaymentCurrency;
    let inPersonCheckoutUrl;
    let linkMeeting;
    if (isTeleconsulta) {
        const payReq = await (0, mercadopago_teleconsultation_service_1.requiresTeleconsultationPayment)(params.doctorId, params.appointmentId);
        if (payReq.required) {
            teleconsultationPaymentAmount = payReq.amount;
            teleconsultationPaymentCurrency = payReq.currency;
            const approved = await (0, mercadopago_teleconsultation_service_1.isTeleconsultationPaymentApproved)(params.appointmentId);
            teleconsultationPaymentApproved = approved;
            teleconsultationPaymentStatus = approved ? 'approved' : 'pending';
            if (!approved && consentSigned && confirmationToken) {
                try {
                    teleconsultationCheckoutUrl =
                        (await (0, mercadopago_teleconsultation_service_1.ensureTeleconsultationCheckoutUrl)(params.appointmentId, confirmationToken)) ||
                            undefined;
                }
                catch (_e) {
                    /* checkout opcional en reenvío */
                }
            }
        }
        else {
            teleconsultationPaymentStatus = 'not_required';
            teleconsultationPaymentApproved = true;
        }
        const paymentApproved = !payReq.required || (teleconsultationPaymentApproved !== null && teleconsultationPaymentApproved !== void 0 ? teleconsultationPaymentApproved : false);
        const allowVideo = (0, calendarSync_utils_1.shouldAllowVideoConferenceForAppointment)('teleconsulta', consentSigned, payReq.required, paymentApproved);
        if (allowVideo) {
            linkMeeting =
                params.linkMeeting ||
                    ((_c = appointment === null || appointment === void 0 ? void 0 : appointment.teleconsultation) === null || _c === void 0 ? void 0 : _c.meetingUrl) ||
                    undefined;
            if (!linkMeeting) {
                const calEvent = await database_1.default.internalCalendarEvent.findFirst({
                    where: { appointmentId: params.appointmentId },
                    select: { linkMeeting: true },
                });
                linkMeeting = (calEvent === null || calEvent === void 0 ? void 0 : calEvent.linkMeeting) || undefined;
            }
        }
    }
    else if (confirmationToken) {
        const inPersonCtx = await (0, mercadopago_inperson_service_1.getInPersonPaymentContext)(params.doctorId, params.appointmentId);
        if (inPersonCtx.paymentOffered) {
            inPersonPaymentAmount = inPersonCtx.amount;
            inPersonPaymentCurrency = inPersonCtx.currency;
            if (inPersonCtx.paymentStatus === 'pending') {
                try {
                    inPersonCheckoutUrl =
                        (await (0, mercadopago_inperson_service_1.ensureInPersonCheckoutUrl)(params.appointmentId, confirmationToken)) || undefined;
                }
                catch (_f) {
                    inPersonCheckoutUrl = inPersonCtx.checkoutUrl || undefined;
                }
            }
        }
    }
    const timezone = (_d = params.doctorTimezone) !== null && _d !== void 0 ? _d : 'America/Mexico_City';
    return {
        eventTitle: params.eventTitle,
        eventDate: params.eventDate,
        eventEndDate: params.eventEndDate,
        description: stripManageLinkBlocksFromDescription(params.description) || undefined,
        linkMeeting: isTeleconsulta ? linkMeeting : params.linkMeeting || undefined,
        tipoCita: isTeleconsulta || params.linkMeeting ? 'remota' : 'presencial',
        preConsultationLink: params.preConsultationLink,
        manageLink,
        teleconsultaLink,
        teleconsultationPaymentAmount,
        teleconsultationPaymentCurrency,
        teleconsultationPaymentStatus,
        teleconsultationPaymentApproved,
        teleconsultationCheckoutUrl,
        teleconsultationConsentSigned: consentSigned,
        inPersonPaymentAmount,
        inPersonPaymentCurrency,
        inPersonCheckoutUrl,
        timezone,
    };
}
