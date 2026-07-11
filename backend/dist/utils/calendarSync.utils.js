"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppointmentCanonicalDate = getAppointmentCanonicalDate;
exports.resolveGoogleCalendarSendUpdates = resolveGoogleCalendarSendUpdates;
exports.normalizeGoogleCalendarSummary = normalizeGoogleCalendarSummary;
exports.normalizeExternalCalendarLocation = normalizeExternalCalendarLocation;
exports.externalCalendarEventNeedsUpdate = externalCalendarEventNeedsUpdate;
exports.isDoctorGoogleCalendarOperational = isDoctorGoogleCalendarOperational;
exports.recordCalendarProviderSyncError = recordCalendarProviderSyncError;
exports.findLinkedAppointment = findLinkedAppointment;
exports.shouldPushInternalOverExternal = shouldPushInternalOverExternal;
exports.reconcileCalendarEventWithAppointment = reconcileCalendarEventWithAppointment;
exports.shouldAllowVideoConferenceForAppointment = shouldAllowVideoConferenceForAppointment;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const LINK_WINDOW_MS = 30 * 60 * 1000;
const DATE_TOLERANCE_MS = 2 * 60 * 1000;
function getAppointmentCanonicalDate(appointment) {
    var _a;
    return (_a = appointment.rescheduledTo) !== null && _a !== void 0 ? _a : appointment.date;
}
/**
 * When to email calendar attendees via Google Calendar API sendUpdates.
 *
 * Inserts: notify only when notifyAttendees === true (first invite).
 * Updates: notify only on explicit notifyAttendees === true or attendee response sync.
 * Default for periodic/reconciliation sync is silent (none) to avoid email loops.
 */
function resolveGoogleCalendarSendUpdates(options) {
    if (options.attendeeCount === 0)
        return 'none';
    if (options.notifyAttendees === false)
        return 'none';
    if (options.notifyAttendees === true)
        return 'all';
    if (options.responseStatus)
        return 'all';
    return 'none';
}
/** Normalize Qlinexa/Google titles for idempotent comparison (emoji + trailing "consulta"). */
function normalizeGoogleCalendarSummary(summary) {
    return (summary !== null && summary !== void 0 ? summary : '')
        .replace(/🏥\s*/g, '')
        .replace(/\s+consulta$/i, '')
        .trim()
        .toLowerCase();
}
const MEETING_LOCATION_RE = /meet\.google\.com|teams\.microsoft\.com|zoom\.us/i;
function normalizeExternalCalendarLocation(location) {
    const raw = (location !== null && location !== void 0 ? location : '').trim();
    if (!raw || MEETING_LOCATION_RE.test(raw))
        return '';
    return raw.toLowerCase();
}
/** True when an external calendar upsert would change meaningful guest-visible fields. */
function externalCalendarEventNeedsUpdate(existing, desired, toleranceMs = DATE_TOLERANCE_MS) {
    var _a, _b;
    if (normalizeGoogleCalendarSummary(existing.summary) !==
        normalizeGoogleCalendarSummary(desired.summary)) {
        return true;
    }
    const existingDesc = ((_a = existing.description) !== null && _a !== void 0 ? _a : '').trim();
    const desiredDesc = ((_b = desired.description) !== null && _b !== void 0 ? _b : '').trim();
    if (existingDesc !== desiredDesc)
        return true;
    if (existing.startMs != null &&
        desired.startMs != null &&
        Math.abs(existing.startMs - desired.startMs) > toleranceMs) {
        return true;
    }
    if (existing.endMs != null &&
        desired.endMs != null &&
        Math.abs(existing.endMs - desired.endMs) > toleranceMs) {
        return true;
    }
    const existingAttendees = [...existing.attendeeEmails].map(e => e.toLowerCase()).sort();
    const desiredAttendees = [...desired.attendeeEmails].map(e => e.toLowerCase()).sort();
    if (existingAttendees.join(',') !== desiredAttendees.join(','))
        return true;
    if (existing.hasVideoConference !== desired.hasVideoConference)
        return true;
    if (normalizeExternalCalendarLocation(existing.location) !==
        normalizeExternalCalendarLocation(desired.location)) {
        return true;
    }
    if (desired.attendeeResponseStatus) {
        if (existing.attendeeResponseStatus !== desired.attendeeResponseStatus) {
            return true;
        }
    }
    return false;
}
/** Doctor has Google linked with a usable access token (matches upsertEvent prerequisites). */
async function isDoctorGoogleCalendarOperational(doctorId) {
    const row = await prisma.calendarSyncConfig.findFirst({
        where: {
            doctorId,
            provider: 'google',
            isConnected: true,
            accessToken: { not: null },
        },
        select: { id: true },
    });
    return !!row;
}
/** Persist sync failure so Configuración → Calendario can show it to the doctor. */
async function recordCalendarProviderSyncError(doctorId, provider, message) {
    await prisma.calendarSyncConfig.updateMany({
        where: { doctorId, provider, isConnected: true },
        data: { error: message },
    });
}
/**
 * Busca la cita vinculada a un evento interno (ventana ±30 min o cita activa más reciente del paciente).
 */
async function findLinkedAppointment(doctorId, patientId, eventStart, appointmentId) {
    if (!patientId && !appointmentId)
        return null;
    if (appointmentId) {
        const byId = await prisma.appointment.findFirst({
            where: { id: appointmentId, doctorId },
            select: {
                id: true,
                date: true,
                rescheduledTo: true,
                appointmentType: true,
                status: true,
                confirmationStatus: true,
            },
        });
        if (byId)
            return byId;
    }
    if (!patientId)
        return null;
    const searchStart = new Date(eventStart.getTime() - LINK_WINDOW_MS);
    const searchEnd = new Date(eventStart.getTime() + LINK_WINDOW_MS);
    return prisma.appointment.findFirst({
        where: {
            doctorId,
            patientId,
            date: { gte: searchStart, lte: searchEnd },
        },
        select: {
            id: true,
            date: true,
            rescheduledTo: true,
            appointmentType: true,
            status: true,
            confirmationStatus: true,
        },
        orderBy: { date: 'desc' },
    });
}
/**
 * Si hay cita vinculada y la hora externa no coincide con la fuente de verdad (Appointment), empujar hacia afuera.
 */
async function shouldPushInternalOverExternal(doctorId, event, externalStart) {
    if (!event.patientId)
        return false;
    const appointment = await findLinkedAppointment(doctorId, event.patientId, event.fechaHoraInicio, event.appointmentId);
    if (!appointment)
        return false;
    const canonical = getAppointmentCanonicalDate(appointment);
    return Math.abs(canonical.getTime() - externalStart.getTime()) > DATE_TOLERANCE_MS;
}
/**
 * Alinea InternalCalendarEvent con Appointment (fecha/hora y linkMeeting si es presencial).
 */
async function reconcileCalendarEventWithAppointment(doctorId, event) {
    if (!event.patientId && !event.appointmentId) {
        return { updated: false, appointmentType: null };
    }
    const appointment = await findLinkedAppointment(doctorId, event.patientId, event.fechaHoraInicio, event.appointmentId);
    if (!appointment) {
        return { updated: false, appointmentType: null };
    }
    if (appointment.status === 'CANCELLED' || appointment.confirmationStatus === 'CANCELLED') {
        return {
            updated: false,
            appointmentType: appointment.appointmentType,
            canonicalStart: event.fechaHoraInicio,
            canonicalEnd: event.fechaHoraFin,
        };
    }
    const canonicalStart = getAppointmentCanonicalDate(appointment);
    const durationMs = Math.max(event.fechaHoraFin.getTime() - event.fechaHoraInicio.getTime(), 30 * 60 * 1000);
    const canonicalEnd = new Date(canonicalStart.getTime() + durationMs);
    const needsDateUpdate = Math.abs(event.fechaHoraInicio.getTime() - canonicalStart.getTime()) > 60 * 1000;
    const isPresencial = appointment.appointmentType !== 'teleconsulta';
    const needsLinkClear = isPresencial && !!event.linkMeeting;
    if (!needsDateUpdate && !needsLinkClear) {
        return {
            updated: false,
            appointmentType: appointment.appointmentType,
            canonicalStart: event.fechaHoraInicio,
            canonicalEnd: event.fechaHoraFin
        };
    }
    await prisma.internalCalendarEvent.update({
        where: { id: event.id },
        data: Object.assign(Object.assign({}, (needsDateUpdate
            ? { fechaHoraInicio: canonicalStart, fechaHoraFin: canonicalEnd }
            : {})), (needsLinkClear ? { linkMeeting: null } : {}))
    });
    return {
        updated: true,
        appointmentType: appointment.appointmentType,
        canonicalStart,
        canonicalEnd
    };
}
/** Solo teleconsultas con consentimiento firmado y pago aprobado (si aplica) generan enlace de videollamada. */
function shouldAllowVideoConferenceForAppointment(appointmentType, teleconsultationConsentSigned, paymentRequired, paymentApproved) {
    if (appointmentType !== 'teleconsulta' || teleconsultationConsentSigned !== true) {
        return false;
    }
    if (paymentRequired && paymentApproved !== true) {
        return false;
    }
    return true;
}
