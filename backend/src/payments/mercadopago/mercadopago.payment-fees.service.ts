import prisma from '../../config/database';
import { securityLogger } from '../../utils/logger.utils';
import { decimalToNumber } from './mercadopago.commission.utils';
import { MercadoPagoOAuthService } from './mercadopago.oauth.service';
import { buildPaymentFinancialUpdate } from './mercadopago.payment-fees.utils';
import { resolveMpPaymentWithFallback } from './mercadopago.payment-resolve.service';

/** Reconsulta MP y persiste comisión de procesamiento / neto si faltan. */
export async function refreshMercadoPagoFeesForPayment(localPaymentId: string) {
  const payment = await prisma.mercadoPagoPayment.findUnique({ where: { id: localPaymentId } });
  if (!payment || payment.status !== 'approved' || !payment.providerPaymentId) {
    return payment;
  }

  try {
    const doctorAccessToken = await MercadoPagoOAuthService.getValidAccessToken(payment.doctorId);
    const { payment: mpPayment } = await resolveMpPaymentWithFallback({
      paymentId: payment.providerPaymentId,
      doctorAccessToken,
      preferenceId: payment.providerPreferenceId,
      externalReference: payment.externalReference,
    });

    const financials = buildPaymentFinancialUpdate(mpPayment, payment);
    if (
      financials.providerProcessingFeeAmount === decimalToNumber(payment.providerProcessingFeeAmount) &&
      financials.netReceivedAmount === decimalToNumber(payment.netReceivedAmount)
    ) {
      return payment;
    }

    return prisma.mercadoPagoPayment.update({
      where: { id: payment.id },
      data: financials,
    });
  } catch (err) {
    securityLogger.warn('MP refresh fees failed', { localPaymentId, err });
    return payment;
  }
}

/** Actualiza hasta N cobros aprobados del doctor que aún no tienen comisión MP. */
export async function backfillMissingMercadoPagoFees(doctorId: string, limit = 10) {
  const missing = await prisma.mercadoPagoPayment.findMany({
    where: {
      doctorId,
      status: 'approved',
      providerPaymentId: { not: null },
      providerProcessingFeeAmount: 0,
    },
    orderBy: { paidAt: 'desc' },
    take: limit,
  });

  for (const p of missing) {
    await refreshMercadoPagoFeesForPayment(p.id);
  }
}
