import axios from 'axios';
import prisma from '../config/database';
import { recordAffiliateAudit } from './affiliateAudit.service';
import { AFFILIATE_AUDIT_ACTIONS } from '../constants/affiliate.constants';
import { getPayPalAccessToken, getPayPalApiBaseUrl } from '../utils/paypalAuth.utils';

/**
 * Pagos a afiliados vía PayPal Payouts API.
 *
 * - Solo aplica a afiliados con método de pago PAYPAL (los de SPEI se pagan manual).
 * - Detrás del flag PAYPAL_PAYOUTS_ENABLED.
 * - México (MX): las cuentas Business solo pueden RECIBIR payouts, no ENVIAR (limitación PayPal).
 *   En prod: pagar manualmente y «Marcar pagada». En sandbox: usar cuenta Business US para probar la API.
 * - Reconciliación por webhooks PAYMENT.PAYOUTS-ITEM.* (ver handlePayoutItemEvent).
 */

export function arePaypalPayoutsEnabled(): boolean {
  return String(process.env.PAYPAL_PAYOUTS_ENABLED || '').trim().toLowerCase() === 'true';
}

/** Mensaje legible cuando PayPal rechaza un payout (p. ej. restricción por país del emisor). */
function payoutErrorMessage(raw: string, code?: string): string {
  const lower = String(raw || '').toLowerCase();
  if (
    code === 'PAYOUT_NOT_AVAILABLE' ||
    lower.includes('not allowed to send') ||
    lower.includes('user_country_not_allowed')
  ) {
    return (
      'PayPal no permite enviar pagos automáticos (Payouts) desde cuentas Business en México. ' +
      'México solo puede recibir este tipo de transferencias, no emitirlas. ' +
      'Para afiliados internacionales puedes pagar manualmente desde tu cuenta PayPal y usar «Marcar pagada» en Comisiones. ' +
      'Para probar la integración en sandbox, necesitas una cuenta Business de prueba en un país que sí permita enviar (p. ej. EE.UU.).'
    );
  }
  return `PayPal rechazó el pago: ${raw}`;
}

interface PayoutResult {
  ok: boolean;
  status: number;
  message: string;
  data?: { payoutBatchId: string; count: number; total: number; currency: string };
}

/**
 * Envía un único payout de PayPal con el total de comisiones pendientes (PENDING/APPROVED)
 * de un afiliado. Marca esas comisiones como PROCESSING; el webhook las pasa a PAID o las regresa.
 */
export async function payAffiliateViaPaypal(affiliateId: string, adminUserId?: string): Promise<PayoutResult> {
  if (!arePaypalPayoutsEnabled()) {
    return { ok: false, status: 409, message: 'Los pagos automáticos por PayPal están deshabilitados (PAYPAL_PAYOUTS_ENABLED).' };
  }

  const profile = await prisma.affiliateProfile.findUnique({ where: { id: affiliateId } });
  if (!profile) return { ok: false, status: 404, message: 'Afiliado no encontrado.' };

  const bank = await prisma.affiliateBankAccount.findFirst({
    where: { affiliateId, isActive: true },
    orderBy: { createdAt: 'desc' }
  });
  if (!bank || bank.payoutMethod !== 'PAYPAL' || !bank.paypalEmail) {
    return { ok: false, status: 400, message: 'El afiliado no tiene un correo de PayPal registrado como método de pago.' };
  }

  const commissions = await prisma.affiliateCommission.findMany({
    where: { affiliateId, status: { in: ['PENDING', 'APPROVED'] } }
  });
  if (commissions.length === 0) {
    return { ok: false, status: 400, message: 'El afiliado no tiene comisiones pendientes por pagar.' };
  }

  const total = commissions.reduce((sum, c) => sum + Number(c.commissionAmount), 0);
  const currency = commissions[0].currency || 'MXN';
  const totalStr = total.toFixed(2);

  const token = await getPayPalAccessToken();
  if (!token) {
    return { ok: false, status: 502, message: 'No se pudo obtener token de PayPal.' };
  }

  const senderBatchId = `aff-${affiliateId.slice(0, 8)}-${Date.now()}`;
  const baseUrl = getPayPalApiBaseUrl();

  let payoutBatchId = '';
  let payoutItemId: string | null = null;
  try {
    const response = await axios.post(
      `${baseUrl}/v1/payments/payouts`,
      {
        sender_batch_header: {
          sender_batch_id: senderBatchId,
          email_subject: 'Pago de comisiones — Qlinexa360',
          email_message: `Has recibido el pago de tus comisiones de afiliado (${commissions.length} comisión(es)).`
        },
        items: [
          {
            recipient_type: 'EMAIL',
            amount: { value: totalStr, currency },
            receiver: bank.paypalEmail,
            note: `Comisiones Qlinexa360 (${commissions.length})`,
            sender_item_id: senderBatchId
          }
        ]
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    payoutBatchId = response.data?.batch_header?.payout_batch_id || '';
    payoutItemId = response.data?.items?.[0]?.payout_item_id || null;
  } catch (error: any) {
    const detail = error.response?.data;
    const rawMsg = detail?.message || detail?.name || error.message;
    console.error('[Payout] error al crear payout de PayPal:', { status: error.response?.status, detail });
    const friendly = payoutErrorMessage(rawMsg, detail?.name);
    return { ok: false, status: 502, message: friendly };
  }

  if (!payoutBatchId) {
    return { ok: false, status: 502, message: 'PayPal no devolvió un identificador de lote (payout_batch_id).' };
  }

  await prisma.affiliateCommission.updateMany({
    where: { id: { in: commissions.map((c) => c.id) } },
    data: { status: 'PROCESSING', payoutBatchId, payoutItemId, paidByAdminUserId: adminUserId || null }
  });

  void recordAffiliateAudit({
    actorUserId: adminUserId,
    action: AFFILIATE_AUDIT_ACTIONS.PAYOUT_INITIATED,
    targetType: 'AffiliateProfile',
    targetId: affiliateId,
    metadata: { payoutBatchId, count: commissions.length, total, currency, receiver: bank.paypalEmail }
  });

  return {
    ok: true,
    status: 200,
    message: `Pago enviado a PayPal (${commissions.length} comisión(es), ${totalStr} ${currency}). Se confirmará por webhook.`,
    data: { payoutBatchId, count: commissions.length, total, currency }
  };
}

const FAILED_STATES = new Set([
  'PAYMENT.PAYOUTS-ITEM.FAILED',
  'PAYMENT.PAYOUTS-ITEM.BLOCKED',
  'PAYMENT.PAYOUTS-ITEM.DENIED',
  'PAYMENT.PAYOUTS-ITEM.RETURNED',
  'PAYMENT.PAYOUTS-ITEM.REFUNDED',
  'PAYMENT.PAYOUTS-ITEM.CANCELED'
]);

/** Procesa eventos PAYMENT.PAYOUTS-ITEM.* y concilia las comisiones del lote. */
export async function handlePayoutItemEvent(event: any): Promise<void> {
  const eventType = String(event?.event_type || '');
  const resource = event?.resource || {};
  const payoutBatchId = resource.payout_batch_id || resource?.payout_batch_header?.payout_batch_id;
  const payoutItemId = resource.payout_item_id || null;
  if (!payoutBatchId) {
    console.warn('[Payout] webhook sin payout_batch_id, ignorado:', eventType);
    return;
  }

  const commissions = await prisma.affiliateCommission.findMany({
    where: { payoutBatchId, status: 'PROCESSING' }
  });
  if (commissions.length === 0) {
    console.log(`[Payout] ${eventType}: sin comisiones PROCESSING para batch ${payoutBatchId}`);
    return;
  }
  const ids = commissions.map((c) => c.id);

  if (eventType === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED') {
    await prisma.affiliateCommission.updateMany({
      where: { id: { in: ids } },
      data: { status: 'PAID', paidAt: new Date(), payoutItemId }
    });
    void recordAffiliateAudit({
      action: AFFILIATE_AUDIT_ACTIONS.PAYOUT_SUCCEEDED,
      targetType: 'AffiliateProfile',
      targetId: commissions[0].affiliateId,
      metadata: { payoutBatchId, payoutItemId, count: ids.length }
    });
    console.log(`[Payout] batch ${payoutBatchId} -> PAID (${ids.length} comisiones)`);
    return;
  }

  if (FAILED_STATES.has(eventType)) {
    await prisma.affiliateCommission.updateMany({
      where: { id: { in: ids } },
      data: { status: 'APPROVED', payoutItemId }
    });
    void recordAffiliateAudit({
      action: AFFILIATE_AUDIT_ACTIONS.PAYOUT_FAILED,
      targetType: 'AffiliateProfile',
      targetId: commissions[0].affiliateId,
      metadata: { payoutBatchId, payoutItemId, eventType, count: ids.length, reason: resource?.errors || resource?.transaction_status }
    });
    console.log(`[Payout] batch ${payoutBatchId} -> ${eventType}, comisiones regresadas a APPROVED`);
    return;
  }

  // UNCLAIMED / HELD / PENDING u otros: se mantienen en PROCESSING.
  console.log(`[Payout] ${eventType} para batch ${payoutBatchId}: sin cambio (se mantiene PROCESSING)`);
}
