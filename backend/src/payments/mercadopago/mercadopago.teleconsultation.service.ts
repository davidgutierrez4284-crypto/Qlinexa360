import prisma from '../../config/database';
import { AppointmentConfirmationController } from '../../controllers/appointmentConfirmation.controller';
import { securityLogger } from '../../utils/logger.utils';
import { decimalToNumber } from './mercadopago.commission.utils';
import {
  MercadoPagoPreferenceService,
  getLatestTeleconsultationPayment,
} from './mercadopago.preference.service';
import { MercadoPagoOAuthService } from './mercadopago.oauth.service';
import { syncPendingMercadoPagoPayment } from './mercadopago.sync.service';
import { getRefundContextForAppointment } from './mercadopago.refund.service';

export type TeleconsultationPaymentContext = {
  paymentRequired: boolean;
  paymentStatus: 'not_required' | 'pending' | 'approved' | 'rejected' | 'refunded';
  checkoutUrl: string | null;
  amount: number;
  currency: string;
  refundPolicyText: string | null;
  paymentId?: string | null;
  canRequestRefund?: boolean;
  refundableAmount?: number;
  refundRequest?: unknown;
};

export async function getDoctorMercadoPagoSettings(doctorId: string) {
  return prisma.doctorMercadoPagoSettings.findUnique({ where: { doctorId } });
}

export async function isMercadoPagoConnected(doctorId: string): Promise<boolean> {
  const status = await MercadoPagoOAuthService.getConnectionStatus(doctorId);
  return status.connected;
}

export function parseTeleconsultationAmountInput(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export async function getTeleconsultationMpFormPolicy(doctorId: string) {
  const connected = await isMercadoPagoConnected(doctorId);
  const settings = await getDoctorMercadoPagoSettings(doctorId);
  const enabled = connected && !!settings?.enabled;
  const mandatory = enabled && !!settings?.mandatoryBeforeVirtualLink;
  return {
    mercadoPagoConnected: connected,
    showAmountField: mandatory,
    amountRequired: mandatory,
    defaultAmount: settings ? decimalToNumber(settings.amount) : 0,
    currency: settings?.currency || "MXN",
  };
}

export async function validateTeleconsultationAmountForVirtualAppointment(
  doctorId: string,
  modalidadConsulta: string,
  teleconsultationAmount: unknown,
  patientId?: string | null
): Promise<{ ok: true; amount: number | null } | { ok: false; message: string }> {
  if (modalidadConsulta !== "virtual") return { ok: true, amount: null };
  const policy = await getTeleconsultationMpFormPolicy(doctorId);
  if (!policy.amountRequired) return { ok: true, amount: null };
  if (!patientId) {
    return {
      ok: false,
      message:
        "Las teleconsultas con cobro obligatorio requieren seleccionar un paciente e indicar el monto.",
    };
  }
  const amount = parseTeleconsultationAmountInput(teleconsultationAmount);
  if (amount === null) return { ok: false, message: "Indica el monto de teleconsulta (MXN)." };
  return { ok: true, amount };
}

async function resolveTeleconsultationChargeAmount(
  doctorId: string,
  settings: NonNullable<Awaited<ReturnType<typeof getDoctorMercadoPagoSettings>>>,
  appointmentId?: string
): Promise<number> {
  let amount = decimalToNumber(settings.amount);
  if (appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, doctorId },
      select: { teleconsultationAmount: true, appointmentType: true },
    });
    if (appointment?.appointmentType === "teleconsulta" && appointment.teleconsultationAmount != null) {
      amount = decimalToNumber(appointment.teleconsultationAmount);
    }
  }
  return amount;
}

async function withRefundContext(
  doctorId: string,
  appointmentId: string,
  base: TeleconsultationPaymentContext
): Promise<TeleconsultationPaymentContext> {
  if (!base.paymentRequired || base.paymentStatus === "not_required") return base;
  const refundCtx = await getRefundContextForAppointment(appointmentId);
  return {
    ...base,
    paymentId: refundCtx.paymentId,
    canRequestRefund: refundCtx.canRequestRefund,
    refundableAmount: refundCtx.refundableAmount,
    refundRequest: refundCtx.refundRequest,
  };
}

async function getApprovedTeleconsultationPayment(appointmentId: string) {
  return prisma.mercadoPagoPayment.findFirst({
    where: { appointmentId, paymentType: "teleconsultation", status: "approved" },
    orderBy: { paidAt: "desc" },
  });
}

async function syncAllPendingTeleconsultationPayments(appointmentId: string) {
  const pending = await prisma.mercadoPagoPayment.findMany({
    where: { appointmentId, paymentType: "teleconsultation", status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  for (const row of pending) {
    await syncPendingMercadoPagoPayment(row.id);
  }
}

export async function requiresTeleconsultationPayment(
  doctorId: string,
  appointmentId?: string
): Promise<{
  required: boolean;
  amount: number;
  currency: string;
  refundPolicyText: string | null;
}> {
  const connected = await isMercadoPagoConnected(doctorId);
  if (!connected) {
    return { required: false, amount: 0, currency: 'MXN', refundPolicyText: null };
  }

  const settings = await getDoctorMercadoPagoSettings(doctorId);
  if (!settings?.enabled || !settings.mandatoryBeforeVirtualLink) {
    return {
      required: false,
      amount: 0,
      currency: 'MXN',
      refundPolicyText: settings?.refundPolicyText || null,
    };
  }

  const amount = await resolveTeleconsultationChargeAmount(doctorId, settings, appointmentId);
  if (amount <= 0) {
    return {
      required: false,
      amount: 0,
      currency: settings.currency,
      refundPolicyText: settings.refundPolicyText,
    };
  }

  return {
    required: true,
    amount,
    currency: settings.currency,
    refundPolicyText: settings.refundPolicyText,
  };
}
function mapLocalPaymentStatus(
  status: string | undefined
): TeleconsultationPaymentContext['paymentStatus'] {
  if (!status || status === 'pending') return 'pending';
  if (status === 'approved') return 'approved';
  if (status === 'rejected' || status === 'cancelled') return 'rejected';
  if (status === 'refunded' || status === 'charged_back') return 'refunded';
  return 'pending';
}

export async function getTeleconsultationPaymentContext(
  doctorId: string,
  appointmentId: string
): Promise<TeleconsultationPaymentContext> {
  const req = await requiresTeleconsultationPayment(doctorId, appointmentId);
  if (!req.required) {
    return {
      paymentRequired: false,
      paymentStatus: 'not_required',
      checkoutUrl: null,
      amount: 0,
      currency: req.currency,
      refundPolicyText: req.refundPolicyText,
    };
  }

  const approvedBase: TeleconsultationPaymentContext = {
    paymentRequired: true,
    paymentStatus: 'approved',
    checkoutUrl: null,
    amount: req.amount,
    currency: req.currency,
    refundPolicyText: req.refundPolicyText,
  };

  if (await getApprovedTeleconsultationPayment(appointmentId)) {
    return withRefundContext(doctorId, appointmentId, approvedBase);
  }

  await syncAllPendingTeleconsultationPayments(appointmentId);
  if (await getApprovedTeleconsultationPayment(appointmentId)) {
    return withRefundContext(doctorId, appointmentId, approvedBase);
  }

  const teleconsultation = await prisma.teleconsultation.findUnique({
    where: { appointmentId },
    select: { consentSigned: true },
  });
  const consentSigned = teleconsultation?.consentSigned ?? false;

  let payment = await getLatestTeleconsultationPayment(appointmentId);
  if (payment?.status === 'pending') {
    try {
      const synced = await syncPendingMercadoPagoPayment(payment.id);
      if (synced) payment = synced;
    } catch (err) {
      securityLogger.warn('MP teleconsultation: sync on page load failed', {
        appointmentId,
        localPaymentId: payment.id,
        err,
      });
    }
  }

  const mapped = mapLocalPaymentStatus(payment?.status);

  if (mapped === 'pending' && (await getApprovedTeleconsultationPayment(appointmentId))) {
    return withRefundContext(doctorId, appointmentId, approvedBase);
  }

  return withRefundContext(doctorId, appointmentId, {
    paymentRequired: true,
    paymentStatus: mapped,
    checkoutUrl: mapped === 'pending' && consentSigned ? payment?.checkoutUrl || null : null,
    amount: req.amount,
    currency: req.currency,
    refundPolicyText: req.refundPolicyText,
  });
}

export async function createTeleconsultationPreferenceForAppointment(
  appointmentId: string,
  confirmationToken: string
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { include: { user: true } },
      doctor: { include: { user: true } },
    },
  });
  if (!appointment) throw new Error('Cita no encontrada');

  const teleconsultation = await prisma.teleconsultation.findUnique({
    where: { appointmentId },
    select: { consentSigned: true },
  });
  if (!teleconsultation?.consentSigned) {
    throw new Error('Debes firmar el consentimiento informado antes de pagar');
  }

  const paymentReq = await requiresTeleconsultationPayment(appointment.doctorId, appointmentId);
  if (!paymentReq.required) {
    throw new Error('Cobro de teleconsulta no requerido');
  }

  const existing = await getLatestTeleconsultationPayment(appointmentId);
  if (existing?.status === 'pending' && existing.checkoutUrl) {
    return { payment: existing, checkoutUrl: existing.checkoutUrl };
  }
  if (existing?.status === 'approved') {
    return { payment: existing, checkoutUrl: null };
  }

  const patientEmail = appointment.patient.email || appointment.patient.user?.email || undefined;
  const doctorName = `${appointment.doctor.user?.firstName || ''} ${appointment.doctor.user?.lastName || ''}`.trim();

  return MercadoPagoPreferenceService.createPreference({
    doctorId: appointment.doctorId,
    patientId: appointment.patientId,
    appointmentId,
    amount: paymentReq.amount,
    currency: paymentReq.currency,
    paymentType: 'teleconsultation',
    concept: `Teleconsulta - ${doctorName || 'Consulta médica'}`,
    payerEmail: patientEmail,
    confirmationToken,
  });
}

async function markTeleconsultationAppointmentConfirmed(appointmentId: string) {
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'SCHEDULED',
      confirmationStatus: 'CONFIRMED',
      confirmedAt: new Date(),
      cancelledAt: null,
      cancellationReason: null,
    },
  });
  await prisma.appointmentConfirmationRequest.updateMany({
    where: { appointmentId, status: 'PENDING' },
    data: { status: 'RESPONDED' },
  });
}

/**
 * Tras pago aprobado: sincroniza calendarios (paciente + doctor).
 * Confirma la cita solo si el consentimiento ya está firmado.
 * La videollamada se habilita vía shouldAllowVideoConferenceForAppointment en sync.
 */
export async function finalizeTeleconsultationAfterPayment(appointmentId: string) {
  const teleconsultation = await prisma.teleconsultation.findUnique({ where: { appointmentId } });
  const consentSigned = teleconsultation?.consentSigned ?? false;

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { doctorId: true },
  });
  if (!appointment) {
    return { finalized: false, reason: 'appointment_not_found' };
  }

  const req = await requiresTeleconsultationPayment(appointment.doctorId, appointmentId);
  const approvedPayment = req.required ? await getApprovedTeleconsultationPayment(appointmentId) : null;

  if (req.required && !approvedPayment) {
    return { finalized: false, reason: 'payment_not_approved' };
  }

  if (approvedPayment) {
    const alreadyFinalized = await prisma.paymentAuditLog.findFirst({
      where: { paymentId: approvedPayment.id, eventType: 'TELECONSULTATION_FINALIZED' },
    });
    if (alreadyFinalized) {
      await AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
        responseStatus: 'accepted',
        notifyAttendees: false,
      });
      return { finalized: true, consentSigned, alreadyDone: true };
    }
  } else if (teleconsultation?.meetingUrl) {
    await AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
      responseStatus: 'accepted',
      notifyAttendees: false,
    });
    return { finalized: true, consentSigned, alreadyDone: true };
  }

  if (consentSigned) {
    await markTeleconsultationAppointmentConfirmed(appointmentId);
  }

  await AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
    responseStatus: 'accepted',
    notifyAttendees: true,
  });

  await AppointmentConfirmationController.sendPatientTeleconsultationCalendarEmail(appointmentId);

  if (approvedPayment) {
    await prisma.paymentAuditLog.create({
      data: {
        paymentId: approvedPayment.id,
        eventType: 'TELECONSULTATION_FINALIZED',
        rawPayloadJson: { appointmentId, consentSigned },
      },
    });
  }

  return { finalized: true, consentSigned };
}

export async function isTeleconsultationPaymentApproved(appointmentId: string): Promise<boolean> {
  const payment = await prisma.mercadoPagoPayment.findFirst({
    where: { appointmentId, paymentType: 'teleconsultation', status: 'approved' },
  });
  return !!payment;
}

/** Crea o reutiliza checkout MP solo tras consentimiento firmado. */
export async function ensureTeleconsultationCheckoutUrl(
  appointmentId: string,
  confirmationToken: string,
  options?: { forceNew?: boolean }
): Promise<string | null> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { doctorId: true, appointmentType: true },
  });
  if (!appointment || appointment.appointmentType !== 'teleconsulta') {
    return null;
  }

  const teleconsultation = await prisma.teleconsultation.findUnique({
    where: { appointmentId },
    select: { consentSigned: true },
  });
  if (!teleconsultation?.consentSigned) {
    return null;
  }

  const paymentReq = await requiresTeleconsultationPayment(appointment.doctorId, appointmentId);
  if (!paymentReq.required) {
    return null;
  }

  const existing = await getLatestTeleconsultationPayment(appointmentId);
  if (existing?.status === 'approved') {
    return null;
  }
  if (existing?.status === 'pending' && existing.checkoutUrl) {
    if (!options?.forceNew) {
      return existing.checkoutUrl;
    }
    await prisma.mercadoPagoPayment.updateMany({
      where: { appointmentId, paymentType: 'teleconsultation', status: 'pending' },
      data: { status: 'cancelled' },
    });
  }

  const pref = await createTeleconsultationPreferenceForAppointment(appointmentId, confirmationToken);
  return pref.checkoutUrl ?? null;
}

/** Tras firmar consentimiento: finaliza si el pago ya está aprobado o no es obligatorio. */
export async function tryFinalizeTeleconsultationAfterConsent(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { doctorId: true },
  });
  if (!appointment) {
    return { finalized: false, reason: 'appointment_not_found' };
  }

  const req = await requiresTeleconsultationPayment(appointment.doctorId, appointmentId);
  const approvedPayment = await getApprovedTeleconsultationPayment(appointmentId);

  if (approvedPayment) {
    return finalizeTeleconsultationAfterPayment(appointmentId);
  }

  if (!req.required) {
    await markTeleconsultationAppointmentConfirmed(appointmentId);
    await AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
      responseStatus: 'accepted',
      notifyAttendees: true,
    });
    await AppointmentConfirmationController.sendPatientTeleconsultationCalendarEmail(appointmentId);
    return { finalized: true, paymentNotRequired: true };
  }

  await markTeleconsultationAppointmentConfirmed(appointmentId);
  await AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
    responseStatus: 'accepted',
    notifyAttendees: true,
  });
  // Hold en calendario (sin videollamada); enlace Meet/Teams y correo .ics definitivo tras el pago.
  return { finalized: false, reason: 'payment_pending', calendarSynced: true };
}
