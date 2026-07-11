import prisma from '../../config/database';
import { getRefundContextForAppointment } from './mercadopago.refund.service';
import { getInPersonPaymentContext } from './mercadopago.inperson.service';
import { getTeleconsultationPaymentContext } from './mercadopago.teleconsultation.service';

export type AppointmentMpDisplayStatus = {
  mpPaymentStatus: 'none' | 'pending' | 'approved' | 'refunded' | 'rejected';
  refundRequestStatus: 'pending' | 'completed' | 'rejected' | 'failed' | null;
  paymentLabel: string | null;
  calendarHighlight: 'normal' | 'cancelled' | 'refund_pending' | 'refunded';
};

export async function getAppointmentMercadoPagoDisplayStatus(
  doctorId: string,
  appointmentId: string,
  appointmentType: string,
  confirmationStatus: string | null
): Promise<AppointmentMpDisplayStatus> {
  const empty: AppointmentMpDisplayStatus = {
    mpPaymentStatus: 'none',
    refundRequestStatus: null,
    paymentLabel: null,
    calendarHighlight:
      confirmationStatus === 'CANCELLED' ? 'cancelled' : 'normal',
  };

  const refundCtx = await getRefundContextForAppointment(appointmentId);
  const rawRefundStatus = refundCtx.refundRequest?.status ?? null;
  const refundStatus: AppointmentMpDisplayStatus['refundRequestStatus'] =
    rawRefundStatus === 'pending' ||
    rawRefundStatus === 'completed' ||
    rawRefundStatus === 'rejected' ||
    rawRefundStatus === 'failed'
      ? rawRefundStatus
      : null;

  let paymentStatus: AppointmentMpDisplayStatus['mpPaymentStatus'] = 'none';

  if (appointmentType === 'teleconsulta') {
    const ctx = await getTeleconsultationPaymentContext(doctorId, appointmentId);
    if (ctx.paymentRequired) {
      paymentStatus =
        ctx.paymentStatus === 'approved'
          ? 'approved'
          : ctx.paymentStatus === 'refunded'
            ? 'refunded'
            : ctx.paymentStatus === 'rejected'
              ? 'rejected'
              : 'pending';
    }
  } else if (appointmentType === 'presencial') {
    const ctx = await getInPersonPaymentContext(doctorId, appointmentId);
    if (ctx.paymentOffered) {
      paymentStatus =
        ctx.paymentStatus === 'approved'
          ? 'approved'
          : ctx.paymentStatus === 'refunded'
            ? 'refunded'
            : ctx.paymentStatus === 'rejected'
              ? 'rejected'
              : 'pending';
    }
  }

  if (paymentStatus === 'none' && !refundStatus) {
    return empty;
  }

  let paymentLabel: string | null = null;
  if (paymentStatus === 'approved') paymentLabel = 'Pagado';
  else if (paymentStatus === 'pending') paymentLabel = 'Pago pendiente';
  else if (paymentStatus === 'refunded') paymentLabel = 'Reembolsado';
  else if (paymentStatus === 'rejected') paymentLabel = 'Pago rechazado';

  if (refundStatus === 'pending') {
    paymentLabel = paymentLabel ? `${paymentLabel} · Reembolso solicitado` : 'Reembolso solicitado';
  } else if (refundStatus === 'completed') {
    paymentLabel = 'Reembolsado';
  } else if (refundStatus === 'failed') {
    paymentLabel = paymentLabel ? `${paymentLabel} · Reembolso fallido` : 'Reembolso fallido';
  }

  let calendarHighlight: AppointmentMpDisplayStatus['calendarHighlight'] = 'normal';
  if (
    confirmationStatus === 'CANCELLED' ||
    refundStatus === 'pending' ||
    refundStatus === 'completed'
  ) {
    calendarHighlight =
      refundStatus === 'pending'
        ? 'refund_pending'
        : refundStatus === 'completed' || paymentStatus === 'refunded'
          ? 'refunded'
          : 'cancelled';
  }

  return {
    mpPaymentStatus: paymentStatus,
    refundRequestStatus: refundStatus,
    paymentLabel,
    calendarHighlight,
  };
}

export async function cancelAppointmentAfterRefundRequest(
  appointmentId: string,
  reason: string
): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { confirmationStatus: true },
  });
  if (!appointment || appointment.confirmationStatus === 'CANCELLED') {
    return;
  }

  const cancellationReason = `Reembolso solicitado: ${reason}`.slice(0, 500);

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      confirmationStatus: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason,
    },
  });

  const confirmationRequest = await prisma.appointmentConfirmationRequest.findFirst({
    where: { appointmentId },
    orderBy: { createdAt: 'desc' },
  });
  if (confirmationRequest) {
    await prisma.appointmentConfirmationRequest.update({
      where: { id: confirmationRequest.id },
      data: {
        status: 'RESPONDED',
        patientResponse: 'CANCELLED',
        respondedAt: new Date(),
      },
    });
  }

  const { AppointmentConfirmationController } = await import(
    '../../controllers/appointmentConfirmation.controller'
  );
  await AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
    cancelExternal: true,
    responseStatus: 'declined',
  });
}
