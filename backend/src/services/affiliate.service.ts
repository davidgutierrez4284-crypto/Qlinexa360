import prisma from '../config/database';
import { computeCommission } from '../utils/affiliateCommission.utils';
import { recordAffiliateAudit } from './affiliateAudit.service';
import {
  AFFILIATE_AUDIT_ACTIONS,
  DEFAULT_COMMISSION_CURRENCY,
  DEFAULT_COMMISSION_MONTHS,
  DEFAULT_COMMISSION_PERCENTAGE,
  DEFAULT_VAT_RATE
} from '../constants/affiliate.constants';

/**
 * Servicio de comisiones de afiliados.
 *
 * Hooks de PayPal:
 *  - PAYMENT.SALE.COMPLETED  -> processPaymentForCommission (genera comisión sobre base sin IVA)
 *  - PAYMENT.SALE.REFUNDED   -> reverseCommissionForRefund (REVERSED si ya pagada, si no CANCELLED)
 *  - BILLING.SUBSCRIPTION.CANCELLED -> markReferralCancelledIfNoPayment
 */

/** Idempotencia de webhooks: registra el evento. Devuelve si ya fue procesado antes. */
export async function registerWebhookEvent(event: any): Promise<{ alreadyProcessed: boolean }> {
  const paypalEventId = String(event?.id || '').trim();
  const eventType = String(event?.event_type || '').trim();
  if (!paypalEventId) {
    // Sin id no podemos deduplicar; permitimos continuar pero avisamos.
    console.warn('[Affiliate] webhook sin id; no se puede registrar idempotencia');
    return { alreadyProcessed: false };
  }
  const existing = await prisma.paypalWebhookEvent.findUnique({ where: { paypalEventId } });
  if (existing) {
    return { alreadyProcessed: existing.processed };
  }
  try {
    await prisma.paypalWebhookEvent.create({
      data: { paypalEventId, eventType, payloadJson: event as any, processed: false }
    });
  } catch (e) {
    // Carrera: otro proceso lo creó primero.
    console.warn('[Affiliate] no se pudo registrar webhook event (posible carrera):', e);
  }
  return { alreadyProcessed: false };
}

/** Marca un evento de webhook como procesado. */
export async function markWebhookEventProcessed(event: any): Promise<void> {
  const paypalEventId = String(event?.id || '').trim();
  if (!paypalEventId) return;
  try {
    await prisma.paypalWebhookEvent.updateMany({
      where: { paypalEventId },
      data: { processed: true, processedAt: new Date() }
    });
  } catch (e) {
    console.warn('[Affiliate] no se pudo marcar webhook como procesado:', e);
  }
}

/** Resuelve el User.id del doctor a partir del id de suscripción PayPal. */
async function resolveDoctorUserIdBySubscription(paypalSubscriptionId: string): Promise<string | null> {
  const id = (paypalSubscriptionId || '').trim();
  if (!id) return null;
  const doctor = await prisma.doctor.findFirst({
    where: { subscription: { paypalSubscriptionId: id } },
    select: { userId: true }
  });
  return doctor?.userId ?? null;
}

/**
 * Genera la comisión correspondiente a un pago exitoso de PayPal, si aplica.
 * Idempotente por paypalPaymentId. No lanza: cualquier error se registra y se ignora.
 */
export async function processPaymentForCommission(event: any): Promise<void> {
  try {
    const payment = event?.resource;
    const paypalPaymentId = String(payment?.id || '').trim();
    const paypalSubscriptionId = String(payment?.billing_agreement_id || '').trim();
    if (!paypalPaymentId || !paypalSubscriptionId) return;

    // Idempotencia: este pago ya generó comisión.
    const existing = await prisma.affiliateCommission.findUnique({ where: { paypalPaymentId } });
    if (existing) return;

    const doctorUserId = await resolveDoctorUserIdBySubscription(paypalSubscriptionId);
    if (!doctorUserId) return;

    const referral = await prisma.affiliateReferral.findUnique({
      where: { doctorUserId },
      include: { affiliate: true }
    });
    if (!referral || !referral.affiliate) return;
    if (referral.affiliate.status !== 'ACTIVE') {
      console.log(`[Affiliate] afiliado ${referral.affiliateId} no ACTIVE; sin comisión.`);
      return;
    }

    // Reglas: afiliado (override) > regla activa > constantes.
    const activeRule = await prisma.affiliateCommissionRule.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    const commissionPercentage =
      Number(referral.affiliate.defaultCommissionPercentage) ||
      (activeRule ? Number(activeRule.commissionPercentage) : DEFAULT_COMMISSION_PERCENTAGE);
    const commissionMonths =
      referral.affiliate.defaultCommissionMonths ||
      activeRule?.commissionMonths ||
      DEFAULT_COMMISSION_MONTHS;
    const vatRate = activeRule ? Number(activeRule.vatRate) : DEFAULT_VAT_RATE;

    // ¿Cuántas comisiones válidas ya se generaron para este doctor/afiliado?
    const priorCount = await prisma.affiliateCommission.count({
      where: {
        doctorUserId,
        affiliateId: referral.affiliateId,
        status: { notIn: ['CANCELLED', 'REVERSED'] }
      }
    });
    if (priorCount >= commissionMonths) {
      console.log(`[Affiliate] duración agotada (${priorCount}/${commissionMonths}); sin comisión.`);
      return;
    }
    const commissionMonthNumber = priorCount + 1;

    const grossRaw = Number(payment?.amount?.total);
    const grossAmount = Number.isFinite(grossRaw) && grossRaw > 0 ? grossRaw : 499;
    if (!(Number.isFinite(grossRaw) && grossRaw > 0)) {
      console.warn('[Affiliate] pago sin amount.total; usando 499 como fallback.');
    }
    const currency = String(payment?.amount?.currency || DEFAULT_COMMISSION_CURRENCY);
    const paymentDate = payment?.create_time ? new Date(payment.create_time) : new Date();

    const { netBase, commissionAmount, trace } = computeCommission({
      grossAmount,
      vatRate,
      commissionPercentage,
      commissionMonthNumber,
      commissionDurationMonths: commissionMonths,
      paypalPaymentId,
      doctorUserId,
      affiliateCode: referral.affiliateCodeUsed,
      currency
    });

    await prisma.$transaction(async (tx) => {
      await tx.affiliateCommission.create({
        data: {
          affiliateId: referral.affiliateId,
          doctorUserId,
          affiliateReferralId: referral.id,
          paypalPaymentId,
          paypalSubscriptionId,
          paymentDate,
          commissionMonthNumber,
          paymentAmountGross: grossAmount,
          vatRate,
          paymentAmountNet: netBase,
          commissionPercentage,
          commissionAmount,
          currency,
          status: 'PENDING',
          calculationTraceJson: trace as any
        }
      });

      await tx.affiliateReferral.update({
        where: { id: referral.id },
        data: {
          status: 'ACTIVE_PAID',
          firstPaymentDate: referral.firstPaymentDate ?? paymentDate
        }
      });
    });

    void recordAffiliateAudit({
      action: AFFILIATE_AUDIT_ACTIONS.COMMISSION_GENERATED,
      targetType: 'AffiliateCommission',
      targetId: paypalPaymentId,
      metadata: { affiliateId: referral.affiliateId, doctorUserId, commissionMonthNumber, commissionAmount }
    });

    console.log(
      `[Affiliate] comisión generada: afiliado=${referral.affiliateId} doctor=${doctorUserId} mes=${commissionMonthNumber} monto=${commissionAmount} ${currency}`
    );
  } catch (e: any) {
    // Carrera contra el índice único de paypalPaymentId u otro error: no romper el webhook.
    if (e?.code === 'P2002') {
      console.log('[Affiliate] comisión ya existente (carrera idempotencia).');
      return;
    }
    console.error('[Affiliate] error generando comisión:', e);
  }
}

/**
 * Reversa la comisión asociada a un pago reembolsado.
 * - Si ya estaba PAID: REVERSED (ajuste negativo para el siguiente corte).
 * - Si estaba PENDING/APPROVED: CANCELLED.
 */
export async function reverseCommissionForRefund(event: any): Promise<void> {
  try {
    const refund = event?.resource;
    // En PAYMENT.SALE.REFUNDED, el id del sale original suele venir en sale_id; fallback a parent_payment.
    const saleId = String(refund?.sale_id || refund?.parent_payment || refund?.id || '').trim();
    if (!saleId) return;

    const commission = await prisma.affiliateCommission.findUnique({ where: { paypalPaymentId: saleId } });
    if (!commission) return;
    if (commission.status === 'CANCELLED' || commission.status === 'REVERSED') return;

    const newStatus = commission.status === 'PAID' ? 'REVERSED' : 'CANCELLED';
    const prevTrace =
      commission.calculationTraceJson && typeof commission.calculationTraceJson === 'object'
        ? (commission.calculationTraceJson as Record<string, unknown>)
        : {};

    await prisma.affiliateCommission.update({
      where: { id: commission.id },
      data: {
        status: newStatus,
        calculationTraceJson: {
          ...prevTrace,
          refund: {
            reversedAt: new Date().toISOString(),
            previousStatus: commission.status,
            negativeAdjustment: newStatus === 'REVERSED' ? Number(commission.commissionAmount) : 0,
            refundId: String(refund?.id || '')
          }
        } as any
      }
    });

    void recordAffiliateAudit({
      action: AFFILIATE_AUDIT_ACTIONS.COMMISSION_REVERSED,
      targetType: 'AffiliateCommission',
      targetId: commission.id,
      metadata: { saleId, from: commission.status, to: newStatus }
    });

    console.log(`[Affiliate] comisión ${commission.id} -> ${newStatus} por refund de sale ${saleId}`);
  } catch (e) {
    console.error('[Affiliate] error reversando comisión por refund:', e);
  }
}

/**
 * Si el doctor cancela su suscripción antes del primer pago, marca su referral como CANCELLED.
 * No afecta comisiones ya generadas.
 */
export async function markReferralCancelledIfNoPayment(paypalSubscriptionId: string): Promise<void> {
  try {
    const doctorUserId = await resolveDoctorUserIdBySubscription(paypalSubscriptionId);
    if (!doctorUserId) return;
    const referral = await prisma.affiliateReferral.findUnique({ where: { doctorUserId } });
    if (!referral) return;
    if (referral.firstPaymentDate) return; // ya pagó: no cancelar el referral
    await prisma.affiliateReferral.update({
      where: { id: referral.id },
      data: { status: 'CANCELLED' }
    });
  } catch (e) {
    console.error('[Affiliate] error marcando referral CANCELLED:', e);
  }
}
