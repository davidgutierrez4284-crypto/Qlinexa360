import crypto from 'crypto';
import prisma from '../config/database';
import { AppError } from './error.utils';
import {
  buildConfirmAppointmentUrl,
  buildTeleconsultationConsentUrl,
} from '../payments/mercadopago/mercadopago.config';
import {
  ensureTeleconsultationCheckoutUrl,
  isTeleconsultationPaymentApproved,
  requiresTeleconsultationPayment,
} from '../payments/mercadopago/mercadopago.teleconsultation.service';
import {
  ensureInPersonCheckoutUrl,
  getInPersonPaymentContext,
} from '../payments/mercadopago/mercadopago.inperson.service';
import { shouldAllowVideoConferenceForAppointment } from './calendarSync.utils';

const CALENDAR_EMAIL_DEDUP_MS = 15 * 60 * 1000;

/** Evita ráfagas de correos duplicados para la misma cita (presencial y teleconsulta). */
export function shouldSendPatientCalendarEmail(
  appointmentId: string,
  lastSentAtMs: number | undefined
): boolean {
  if (!lastSentAtMs) return true;
  return Date.now() - lastSentAtMs > CALENDAR_EMAIL_DEDUP_MS;
}

export function markPatientCalendarEmailSent(
  store: Map<string, number>,
  appointmentId: string
): void {
  store.set(appointmentId, Date.now());
}

const TOKEN_MIN_MS = 7 * 24 * 60 * 60 * 1000;
const POST_APPOINTMENT_GRACE_MS = 48 * 60 * 60 * 1000;
const MANAGE_LINK_BLOCK_RE =
  /(\n\n)?Gestiona tu cita en Qlinexa:[\s\S]*?(?=(\n\nGestiona tu cita|\n\n|$))/gi;
const CONFIRM_APPOINTMENT_URL_RE = /https?:\/\/[^\s]+\/confirm-appointment\/[a-f0-9]+/gi;

/** Quita bloques repetidos de gestión de cita del texto de descripción. */
export function stripManageLinkBlocksFromDescription(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(MANAGE_LINK_BLOCK_RE, '')
    .replace(CONFIRM_APPOINTMENT_URL_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Descripción limpia para calendario externo (un solo enlace de gestión). */
export function buildCleanEventDescriptionForSync(
  notes: string | null | undefined,
  manageLink?: string | null
): string {
  const clean = stripManageLinkBlocksFromDescription(notes);
  if (!manageLink) return clean;
  if (clean.includes(manageLink)) return clean;
  const line = `Gestionar cita: ${manageLink}`;
  return clean ? `${clean}\n\n${line}` : line;
}

export function getAppointmentEffectiveDate(appointment: {
  date: Date;
  rescheduledTo?: Date | null;
}): Date {
  return appointment.rescheduledTo ?? appointment.date;
}

/** El token permanece válido al menos 7 días y hasta 48 h después de la cita. */
export function computeConfirmationTokenExpiry(appointmentDate: Date): Date {
  const now = Date.now();
  return new Date(
    Math.max(now + TOKEN_MIN_MS, appointmentDate.getTime() + POST_APPOINTMENT_GRACE_MS)
  );
}

export async function refreshConfirmationTokenExpiryForAppointment(
  appointmentId: string
): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { date: true, rescheduledTo: true },
  });
  if (!appointment) return;

  const targetExpiry = computeConfirmationTokenExpiry(getAppointmentEffectiveDate(appointment));
  if (targetExpiry <= new Date()) return;

  await prisma.appointmentConfirmationRequest.updateMany({
    where: { appointmentId, status: 'PENDING' },
    data: { expiresAt: targetExpiry },
  });
}

/** Extiende tokens expirados si la cita aún está vigente; lanza si ya no aplica. */
export async function ensureActiveConfirmationRequest(confirmationRequest: {
  id: string;
  expiresAt: Date;
  appointment: { date: Date; rescheduledTo: Date | null };
}): Promise<void> {
  const appointmentDate = getAppointmentEffectiveDate(confirmationRequest.appointment);
  const targetExpiry = computeConfirmationTokenExpiry(appointmentDate);
  const now = new Date();

  if (targetExpiry <= now) {
    throw new AppError('Token de confirmación expirado', 400);
  }

  if (confirmationRequest.expiresAt < now || confirmationRequest.expiresAt < targetExpiry) {
    await prisma.appointmentConfirmationRequest.update({
      where: { id: confirmationRequest.id },
      data: { expiresAt: targetExpiry },
    });
  }
}

export async function getOrCreateAppointmentManageLink(appointmentId: string): Promise<string> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { date: true, rescheduledTo: true },
  });
  if (!appointment) {
    throw new AppError('Cita no encontrada', 404);
  }

  const targetExpiry = computeConfirmationTokenExpiry(getAppointmentEffectiveDate(appointment));
  const existingRequest = await prisma.appointmentConfirmationRequest.findFirst({
    where: { appointmentId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });

  if (existingRequest) {
    if (existingRequest.expiresAt < targetExpiry) {
      await prisma.appointmentConfirmationRequest.update({
        where: { id: existingRequest.id },
        data: { expiresAt: targetExpiry },
      });
    }
    return buildConfirmAppointmentUrl(existingRequest.confirmationToken);
  }

  const confirmationToken = crypto.randomBytes(32).toString('hex');
  await prisma.appointmentConfirmationRequest.create({
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

  return buildConfirmAppointmentUrl(confirmationToken);
}

/** Resuelve userId del paciente; intenta vincular por email si falta en el perfil. */
export async function resolvePatientUserIdForAppointment(patientId: string): Promise<string> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, userId: true, email: true },
  });
  if (!patient) {
    throw new AppError('Paciente no encontrado', 404);
  }

  if (patient.userId) {
    const linkedUser = await prisma.user.findUnique({
      where: { id: patient.userId },
      select: { id: true },
    });
    if (linkedUser) return patient.userId;
  }

  const normalizedEmail = patient.email?.trim();
  if (normalizedEmail) {
    const userByEmail = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (userByEmail) {
      if (userByEmail.id !== patient.userId) {
        try {
          await prisma.patient.update({
            where: { id: patientId },
            data: { userId: userByEmail.id },
          });
        } catch {
          /* Otro perfil Patient ya usa esa cuenta */
        }
      }
      return userByEmail.id;
    }
  }

  throw new AppError(
    'El paciente no tiene una cuenta de usuario asociada. Invítalo a registrarse en el portal del paciente.',
    400
  );
}

export type AppointmentCalendarEmailPayload = {
  eventTitle: string;
  eventDate: Date;
  eventEndDate: Date;
  description?: string;
  linkMeeting?: string;
  tipoCita: 'presencial' | 'remota';
  preConsultationLink?: string;
  manageLink?: string;
  teleconsultaLink?: string;
  teleconsultationPaymentAmount?: number;
  teleconsultationPaymentCurrency?: string;
  teleconsultationPaymentStatus?: 'not_required' | 'pending' | 'approved' | 'rejected' | 'refunded';
  teleconsultationPaymentApproved?: boolean;
  teleconsultationCheckoutUrl?: string;
  teleconsultationConsentSigned?: boolean;
  inPersonPaymentAmount?: number;
  inPersonPaymentCurrency?: string;
  inPersonCheckoutUrl?: string;
  timezone?: string;
};

export async function buildAppointmentCalendarEmailPayload(params: {
  doctorId: string;
  appointmentId: string;
  doctorTimezone?: string | null;
  eventTitle: string;
  eventDate: Date;
  eventEndDate: Date;
  description?: string | null;
  linkMeeting?: string | null;
  eventId?: string;
  preConsultationLink?: string;
}): Promise<AppointmentCalendarEmailPayload> {
  const manageLink = await getOrCreateAppointmentManageLink(params.appointmentId);
  const confirmationToken = manageLink.split('/').pop() || '';

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.appointmentId },
    select: {
      appointmentType: true,
      teleconsultation: { select: { consentSigned: true, meetingUrl: true } },
    },
  });

  const isTeleconsulta = appointment?.appointmentType === 'teleconsulta';
  const consentSigned = appointment?.teleconsultation?.consentSigned ?? false;
  const teleconsultaLink =
    isTeleconsulta && !consentSigned && confirmationToken
      ? buildTeleconsultationConsentUrl(confirmationToken)
      : undefined;

  let teleconsultationPaymentAmount: number | undefined;
  let teleconsultationPaymentCurrency: string | undefined;
  let teleconsultationPaymentStatus:
    | AppointmentCalendarEmailPayload['teleconsultationPaymentStatus']
    | undefined;
  let teleconsultationPaymentApproved: boolean | undefined;
  let teleconsultationCheckoutUrl: string | undefined;
  let inPersonPaymentAmount: number | undefined;
  let inPersonPaymentCurrency: string | undefined;
  let inPersonCheckoutUrl: string | undefined;
  let linkMeeting: string | undefined;

  if (isTeleconsulta) {
    const payReq = await requiresTeleconsultationPayment(params.doctorId, params.appointmentId);
    if (payReq.required) {
      teleconsultationPaymentAmount = payReq.amount;
      teleconsultationPaymentCurrency = payReq.currency;
      const approved = await isTeleconsultationPaymentApproved(params.appointmentId);
      teleconsultationPaymentApproved = approved;
      teleconsultationPaymentStatus = approved ? 'approved' : 'pending';
      if (!approved && consentSigned && confirmationToken) {
        try {
          teleconsultationCheckoutUrl =
            (await ensureTeleconsultationCheckoutUrl(params.appointmentId, confirmationToken)) ||
            undefined;
        } catch {
          /* checkout opcional en reenvío */
        }
      }
    } else {
      teleconsultationPaymentStatus = 'not_required';
      teleconsultationPaymentApproved = true;
    }

    const paymentApproved =
      !payReq.required || (teleconsultationPaymentApproved ?? false);
    const allowVideo = shouldAllowVideoConferenceForAppointment(
      'teleconsulta',
      consentSigned,
      payReq.required,
      paymentApproved
    );
    if (allowVideo) {
      linkMeeting =
        params.linkMeeting ||
        appointment?.teleconsultation?.meetingUrl ||
        undefined;
      if (!linkMeeting) {
        const calEvent = await prisma.internalCalendarEvent.findFirst({
          where: { appointmentId: params.appointmentId },
          select: { linkMeeting: true },
        });
        linkMeeting = calEvent?.linkMeeting || undefined;
      }
    }
  } else if (confirmationToken) {
    const inPersonCtx = await getInPersonPaymentContext(params.doctorId, params.appointmentId);
    if (inPersonCtx.paymentOffered) {
      inPersonPaymentAmount = inPersonCtx.amount;
      inPersonPaymentCurrency = inPersonCtx.currency;
      if (inPersonCtx.paymentStatus === 'pending') {
        try {
          inPersonCheckoutUrl =
            (await ensureInPersonCheckoutUrl(params.appointmentId, confirmationToken)) || undefined;
        } catch {
          inPersonCheckoutUrl = inPersonCtx.checkoutUrl || undefined;
        }
      }
    }
  }

  const timezone = params.doctorTimezone ?? 'America/Mexico_City';

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
