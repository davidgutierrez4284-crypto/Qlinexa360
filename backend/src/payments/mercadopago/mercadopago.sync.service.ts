import prisma from '../../config/database';
import { securityLogger } from '../../utils/logger.utils';
import { MercadoPagoOAuthService } from './mercadopago.oauth.service';
import { MercadoPagoPreferenceService } from './mercadopago.preference.service';
import { decimalToNumber } from './mercadopago.commission.utils';
import { finalizeInPersonAfterPayment } from './mercadopago.inperson.service';
import { finalizeTeleconsultationAfterPayment } from './mercadopago.teleconsultation.service';
import { resolveMpPaymentWithFallback } from './mercadopago.payment-resolve.service';
import { buildPaymentFinancialUpdate } from './mercadopago.payment-fees.utils';

/**
 * Consulta Mercado Pago cuando el webhook aún no llegó o getPayment con token del doctor devuelve 404.
 */
export async function syncPendingMercadoPagoPayment(localPaymentId: string) {
  const payment = await prisma.mercadoPagoPayment.findUnique({ where: { id: localPaymentId } });
  if (!payment || payment.status !== 'pending') return payment;

  try {
    const doctorAccessToken = await MercadoPagoOAuthService.getValidAccessToken(payment.doctorId);
    const { payment: mpPayment, source } = await resolveMpPaymentWithFallback({
      paymentId: payment.providerPaymentId || undefined,
      doctorAccessToken,
      preferenceId: payment.providerPreferenceId,
      externalReference: payment.externalReference,
    });

    securityLogger.info('MP sync: resolved payment', {
      localPaymentId,
      source,
      mpPaymentId: mpPayment.id,
    });

    const mappedStatus = MercadoPagoPreferenceService.mapMpStatus(mpPayment.status);
    const financials =
      mappedStatus === 'approved' ? buildPaymentFinancialUpdate(mpPayment, payment) : undefined;

    const feesUnchanged =
      !financials ||
      (decimalToNumber(payment.providerProcessingFeeAmount) === financials.providerProcessingFeeAmount &&
        decimalToNumber(payment.netReceivedAmount) === financials.netReceivedAmount);

    if (
      mappedStatus === payment.status &&
      payment.providerPaymentId === String(mpPayment.id) &&
      feesUnchanged
    ) {
      return payment;
    }

    const updated = await prisma.mercadoPagoPayment.update({
      where: { id: payment.id },
      data: {
        status: mappedStatus,
        providerPaymentId: String(mpPayment.id),
        paidAt: mpPayment.date_approved ? new Date(mpPayment.date_approved) : payment.paidAt,
        ...(financials ?? {}),
      },
    });

    await prisma.paymentAuditLog.create({
      data: {
        paymentId: payment.id,
        eventType: 'PAYMENT_SYNC_FROM_MP',
        rawPayloadJson: { ...mpPayment, resolveSource: source } as object,
      },
    });

    if (mappedStatus === 'approved' && payment.appointmentId) {
      if (payment.paymentType === 'teleconsultation') {
        await finalizeTeleconsultationAfterPayment(payment.appointmentId);
      } else if (payment.paymentType === 'in_person') {
        await finalizeInPersonAfterPayment(payment.appointmentId);
      }
    }

    return updated;
  } catch (err) {
    securityLogger.warn('MP sync pending payment failed', { localPaymentId, err });
    return payment;
  }
}
