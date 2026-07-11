import prisma from '../../config/database';
import { decimalToNumber } from './mercadopago.commission.utils';
import { MercadoPagoPreferenceService } from './mercadopago.preference.service';
import {
  getDoctorMercadoPagoSettings,
  isMercadoPagoConnected,
  parseTeleconsultationAmountInput,
} from './mercadopago.teleconsultation.service';
import { syncPendingMercadoPagoPayment } from './mercadopago.sync.service';

export type InPersonPaymentContext = {
  paymentOffered: boolean;
  paymentStatus: 'not_required' | 'pending' | 'approved' | 'rejected' | 'refunded';
  checkoutUrl: string | null;
  amount: number;
  currency: string;
};

export type InPersonMpFormPolicy = {
  mercadoPagoConnected: boolean;
  showOfferCheckbox: boolean;
  defaultAmount: number;
  currency: string;
};

export async function getInPersonMpFormPolicy(doctorId: string): Promise<InPersonMpFormPolicy> {
  const connected = await isMercadoPagoConnected(doctorId);
  const settings = await getDoctorMercadoPagoSettings(doctorId);
  const enabled = connected && !!settings?.inPersonEnabled;

  return {
    mercadoPagoConnected: connected,
    showOfferCheckbox: enabled,
    defaultAmount: settings ? decimalToNumber(settings.inPersonDefaultAmount) : 0,
    currency: settings?.currency || 'MXN',
  };
}

export async function validateInPersonMercadoPagoForPresencialAppointment(
  doctorId: string,
  modalidadConsulta: string,
  offerInPersonMercadoPago: unknown,
  inPersonPaymentAmount: unknown,
  patientId?: string | null
): Promise<
  | { ok: true; offer: boolean; amount: number | null }
  | { ok: false; message: string }
> {
  if (modalidadConsulta !== 'presencial') {
    return { ok: true, offer: false, amount: null };
  }

  if (!offerInPersonMercadoPago) {
    return { ok: true, offer: false, amount: null };
  }

  const policy = await getInPersonMpFormPolicy(doctorId);
  if (!policy.showOfferCheckbox) {
    return {
      ok: false,
      message:
        'Activa el cobro opcional con Mercado Pago en consultas presenciales desde Mi Perfil antes de ofrecerlo en la cita.',
    };
  }

  if (!patientId) {
    return {
      ok: false,
      message: 'Selecciona un paciente para ofrecer pago con Mercado Pago en consulta presencial.',
    };
  }

  const amount = parseTeleconsultationAmountInput(inPersonPaymentAmount);
  if (amount === null) {
    return { ok: false, message: 'Indica el monto de la consulta presencial (MXN).' };
  }

  return { ok: true, offer: true, amount };
}

async function resolveInPersonChargeAmount(
  doctorId: string,
  appointmentId: string
): Promise<number> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, doctorId },
    select: {
      inPersonPaymentAmount: true,
      offerInPersonMercadoPago: true,
      appointmentType: true,
    },
  });
  if (
    !appointment ||
    appointment.appointmentType !== 'presencial' ||
    !appointment.offerInPersonMercadoPago
  ) {
    return 0;
  }
  if (appointment.inPersonPaymentAmount == null) return 0;
  return decimalToNumber(appointment.inPersonPaymentAmount);
}

async function getLatestInPersonPayment(appointmentId: string) {
  return prisma.mercadoPagoPayment.findFirst({
    where: {
      appointmentId,
      paymentType: 'in_person',
      status: { notIn: ['cancelled'] },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getInPersonPaymentContext(
  doctorId: string,
  appointmentId: string
): Promise<InPersonPaymentContext> {
  const empty: InPersonPaymentContext = {
    paymentOffered: false,
    paymentStatus: 'not_required',
    checkoutUrl: null,
    amount: 0,
    currency: 'MXN',
  };

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, doctorId },
    select: {
      appointmentType: true,
      offerInPersonMercadoPago: true,
    },
  });
  if (
    !appointment ||
    appointment.appointmentType !== 'presencial' ||
    !appointment.offerInPersonMercadoPago
  ) {
    return empty;
  }

  const settings = await getDoctorMercadoPagoSettings(doctorId);
  if (!settings?.inPersonEnabled || !(await isMercadoPagoConnected(doctorId))) {
    return empty;
  }

  const amount = await resolveInPersonChargeAmount(doctorId, appointmentId);
  if (amount <= 0) return empty;

  const approved = await prisma.mercadoPagoPayment.findFirst({
    where: { appointmentId, paymentType: 'in_person', status: 'approved' },
  });
  if (approved) {
    return {
      paymentOffered: true,
      paymentStatus: 'approved',
      checkoutUrl: null,
      amount,
      currency: settings.currency,
    };
  }

  const pending = await getLatestInPersonPayment(appointmentId);
  if (pending?.status === 'pending') {
    await syncPendingMercadoPagoPayment(pending.id);
    const refreshed = await getLatestInPersonPayment(appointmentId);
    if (refreshed?.status === 'approved') {
      return {
        paymentOffered: true,
        paymentStatus: 'approved',
        checkoutUrl: null,
        amount,
        currency: settings.currency,
      };
    }
    return {
      paymentOffered: true,
      paymentStatus: 'pending',
      checkoutUrl: refreshed?.checkoutUrl || pending.checkoutUrl,
      amount,
      currency: settings.currency,
    };
  }

  return {
    paymentOffered: true,
    paymentStatus: 'pending',
    checkoutUrl: null,
    amount,
    currency: settings.currency,
  };
}

export async function createInPersonPreferenceForAppointment(
  appointmentId: string,
  confirmationToken?: string
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { include: { user: true } },
      doctor: { include: { user: true } },
    },
  });
  if (!appointment) throw new Error('Cita no encontrada');
  if (appointment.appointmentType !== 'presencial' || !appointment.offerInPersonMercadoPago) {
    throw new Error('Esta cita no ofrece cobro presencial con Mercado Pago');
  }

  const settings = await getDoctorMercadoPagoSettings(appointment.doctorId);
  if (!settings?.inPersonEnabled || !(await isMercadoPagoConnected(appointment.doctorId))) {
    throw new Error('Cobro presencial con Mercado Pago no habilitado');
  }

  const amount = await resolveInPersonChargeAmount(appointment.doctorId, appointmentId);
  if (amount <= 0) throw new Error('Monto de consulta presencial inválido');

  const existing = await getLatestInPersonPayment(appointmentId);
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
    amount,
    currency: settings.currency,
    paymentType: 'in_person',
    concept: `Consulta presencial - ${doctorName || 'Consulta médica'}`,
    payerEmail: patientEmail,
    confirmationToken,
  });
}

export async function ensureInPersonCheckoutUrl(
  appointmentId: string,
  confirmationToken?: string,
  options?: { forceNew?: boolean }
): Promise<string | null> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { doctorId: true, appointmentType: true, offerInPersonMercadoPago: true },
  });
  if (
    !appointment ||
    appointment.appointmentType !== 'presencial' ||
    !appointment.offerInPersonMercadoPago
  ) {
    return null;
  }

  const ctx = await getInPersonPaymentContext(appointment.doctorId, appointmentId);
  if (!ctx.paymentOffered || ctx.paymentStatus === 'approved') {
    return null;
  }

  const existing = await getLatestInPersonPayment(appointmentId);
  if (existing?.status === 'pending' && existing.checkoutUrl && !options?.forceNew) {
    return existing.checkoutUrl;
  }

  if (options?.forceNew) {
    await prisma.mercadoPagoPayment.updateMany({
      where: { appointmentId, paymentType: 'in_person', status: 'pending' },
      data: { status: 'cancelled' },
    });
  }

  const pref = await createInPersonPreferenceForAppointment(appointmentId, confirmationToken);
  return pref.checkoutUrl ?? null;
}

/**
 * Tras pago presencial aprobado: sincroniza calendarios y envía invitación Google al paciente.
 */
export async function finalizeInPersonAfterPayment(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      doctorId: true,
      appointmentType: true,
      offerInPersonMercadoPago: true,
    },
  });
  if (
    !appointment ||
    appointment.appointmentType !== 'presencial' ||
    !appointment.offerInPersonMercadoPago
  ) {
    return { finalized: false, reason: 'not_in_person_mp' };
  }

  const approved = await prisma.mercadoPagoPayment.findFirst({
    where: { appointmentId, paymentType: 'in_person', status: 'approved' },
    orderBy: { createdAt: 'desc' },
  });
  if (!approved) {
    return { finalized: false, reason: 'payment_not_approved' };
  }

  const alreadyFinalized = await prisma.paymentAuditLog.findFirst({
    where: { paymentId: approved.id, eventType: 'IN_PERSON_FINALIZED' },
  });
  if (alreadyFinalized) {
    return { finalized: true, alreadyDone: true };
  }

  const { AppointmentConfirmationController } = await import(
    '../../controllers/appointmentConfirmation.controller'
  );
  await AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
    responseStatus: 'accepted',
    notifyAttendees: true,
  });

  await prisma.paymentAuditLog.create({
    data: {
      paymentId: approved.id,
      eventType: 'IN_PERSON_FINALIZED',
      rawPayloadJson: { appointmentId },
    },
  });

  return { finalized: true };
}
