import { InternalCalendarEvent, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LINK_WINDOW_MS = 30 * 60 * 1000;
const DATE_TOLERANCE_MS = 2 * 60 * 1000;

type AppointmentLink = {
  id: string;
  date: Date;
  rescheduledTo: Date | null;
  appointmentType: string;
  status?: string;
  confirmationStatus?: string | null;
};

export function getAppointmentCanonicalDate(appointment: Pick<AppointmentLink, 'date' | 'rescheduledTo'>): Date {
  return appointment.rescheduledTo ?? appointment.date;
}

/**
 * When to email calendar attendees via Google Calendar API sendUpdates.
 *
 * Inserts: notify only when notifyAttendees === true (first invite).
 * Updates: notify only on explicit notifyAttendees === true or attendee response sync.
 * Default for periodic/reconciliation sync is silent (none) to avoid email loops.
 */
export function resolveGoogleCalendarSendUpdates(options: {
  externalEventId?: string | null;
  attendeeCount: number;
  notifyAttendees?: boolean;
  responseStatus?: 'accepted' | 'declined';
}): 'all' | 'none' {
  if (options.attendeeCount === 0) return 'none';
  if (options.notifyAttendees === false) return 'none';
  if (options.notifyAttendees === true) return 'all';
  if (options.responseStatus) return 'all';
  return 'none';
}

/** Normalize Qlinexa/Google titles for idempotent comparison (emoji + trailing "consulta"). */
export function normalizeGoogleCalendarSummary(summary: string | null | undefined): string {
  return (summary ?? '')
    .replace(/🏥\s*/g, '')
    .replace(/\s+consulta$/i, '')
    .trim()
    .toLowerCase();
}

export type ExternalCalendarEventComparable = {
  summary?: string | null;
  description?: string | null;
  startMs: number | null;
  endMs: number | null;
  attendeeEmails: string[];
  attendeeResponseStatus?: 'accepted' | 'declined';
  hasVideoConference: boolean;
  location?: string | null;
};

const MEETING_LOCATION_RE = /meet\.google\.com|teams\.microsoft\.com|zoom\.us/i;

export function normalizeExternalCalendarLocation(location: string | null | undefined): string {
  const raw = (location ?? '').trim();
  if (!raw || MEETING_LOCATION_RE.test(raw)) return '';
  return raw.toLowerCase();
}

/** True when an external calendar upsert would change meaningful guest-visible fields. */
export function externalCalendarEventNeedsUpdate(
  existing: ExternalCalendarEventComparable,
  desired: ExternalCalendarEventComparable,
  toleranceMs = DATE_TOLERANCE_MS
): boolean {
  if (
    normalizeGoogleCalendarSummary(existing.summary) !==
    normalizeGoogleCalendarSummary(desired.summary)
  ) {
    return true;
  }

  const existingDesc = (existing.description ?? '').trim();
  const desiredDesc = (desired.description ?? '').trim();
  if (existingDesc !== desiredDesc) return true;

  if (
    existing.startMs != null &&
    desired.startMs != null &&
    Math.abs(existing.startMs - desired.startMs) > toleranceMs
  ) {
    return true;
  }
  if (
    existing.endMs != null &&
    desired.endMs != null &&
    Math.abs(existing.endMs - desired.endMs) > toleranceMs
  ) {
    return true;
  }

  const existingAttendees = [...existing.attendeeEmails].map(e => e.toLowerCase()).sort();
  const desiredAttendees = [...desired.attendeeEmails].map(e => e.toLowerCase()).sort();
  if (existingAttendees.join(',') !== desiredAttendees.join(',')) return true;

  if (existing.hasVideoConference !== desired.hasVideoConference) return true;

  if (
    normalizeExternalCalendarLocation(existing.location) !==
    normalizeExternalCalendarLocation(desired.location)
  ) {
    return true;
  }

  if (desired.attendeeResponseStatus) {
    if (existing.attendeeResponseStatus !== desired.attendeeResponseStatus) {
      return true;
    }
  }

  return false;
}

export type AppointmentCalendarSyncOutcome = {
  provider: 'google' | 'outlook' | 'apple' | null;
  success: boolean;
  /** true when sendUpdates was "all" and there were attendees */
  patientInviteSent: boolean;
  error?: string;
};

/** Doctor has Google linked with a usable access token (matches upsertEvent prerequisites). */
export async function isDoctorGoogleCalendarOperational(doctorId: string): Promise<boolean> {
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
export async function recordCalendarProviderSyncError(
  doctorId: string,
  provider: 'google' | 'outlook' | 'apple',
  message: string
): Promise<void> {
  await prisma.calendarSyncConfig.updateMany({
    where: { doctorId, provider, isConnected: true },
    data: { error: message },
  });
}

/**
 * Busca la cita vinculada a un evento interno (ventana ±30 min o cita activa más reciente del paciente).
 */
export async function findLinkedAppointment(
  doctorId: string,
  patientId: string | null,
  eventStart: Date,
  appointmentId?: string | null
): Promise<AppointmentLink | null> {
  if (!patientId && !appointmentId) return null;

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
    if (byId) return byId;
  }

  if (!patientId) return null;

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
export async function shouldPushInternalOverExternal(
  doctorId: string,
  event: Pick<InternalCalendarEvent, 'patientId' | 'fechaHoraInicio' | 'appointmentId'>,
  externalStart: Date
): Promise<boolean> {
  if (!event.patientId) return false;

  const appointment = await findLinkedAppointment(
    doctorId,
    event.patientId,
    event.fechaHoraInicio,
    event.appointmentId
  );
  if (!appointment) return false;

  const canonical = getAppointmentCanonicalDate(appointment);
  return Math.abs(canonical.getTime() - externalStart.getTime()) > DATE_TOLERANCE_MS;
}

/**
 * Alinea InternalCalendarEvent con Appointment (fecha/hora y linkMeeting si es presencial).
 */
export async function reconcileCalendarEventWithAppointment(
  doctorId: string,
  event: Pick<
    InternalCalendarEvent,
    'id' | 'patientId' | 'fechaHoraInicio' | 'fechaHoraFin' | 'linkMeeting' | 'appointmentId'
  >
): Promise<{ updated: boolean; appointmentType: string | null; canonicalStart?: Date; canonicalEnd?: Date }> {
  if (!event.patientId && !event.appointmentId) {
    return { updated: false, appointmentType: null };
  }

  const appointment = await findLinkedAppointment(
    doctorId,
    event.patientId,
    event.fechaHoraInicio,
    event.appointmentId
  );
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
  const durationMs = Math.max(
    event.fechaHoraFin.getTime() - event.fechaHoraInicio.getTime(),
    30 * 60 * 1000
  );
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
    data: {
      ...(needsDateUpdate
        ? { fechaHoraInicio: canonicalStart, fechaHoraFin: canonicalEnd }
        : {}),
      ...(needsLinkClear ? { linkMeeting: null } : {})
    }
  });

  return {
    updated: true,
    appointmentType: appointment.appointmentType,
    canonicalStart,
    canonicalEnd
  };
}

/** Solo teleconsultas con consentimiento firmado y pago aprobado (si aplica) generan enlace de videollamada. */
export function shouldAllowVideoConferenceForAppointment(
  appointmentType: string,
  teleconsultationConsentSigned?: boolean | null,
  paymentRequired?: boolean,
  paymentApproved?: boolean
): boolean {
  if (appointmentType !== 'teleconsulta' || teleconsultationConsentSigned !== true) {
    return false;
  }
  if (paymentRequired && paymentApproved !== true) {
    return false;
  }
  return true;
}
