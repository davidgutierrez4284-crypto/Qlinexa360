import crypto from 'crypto';
import prisma from '../../config/database';
import { securityLogger } from '../../utils/logger.utils';
import { MercadoPagoApiClient } from './mercadopago.api.client';
import { mercadoPagoConfig } from './mercadopago.config';
import { MercadoPagoPreferenceService } from './mercadopago.preference.service';
import { MercadoPagoOAuthService } from './mercadopago.oauth.service';
import { finalizeInPersonAfterPayment } from './mercadopago.inperson.service';
import { finalizeTeleconsultationAfterPayment } from './mercadopago.teleconsultation.service';
import {
  isMpNotFoundError,
  resolveMpPaymentWithFallback,
  type MpPaymentPayload,
} from './mercadopago.payment-resolve.service';
import { buildPaymentFinancialUpdate } from './mercadopago.payment-fees.utils';
import {
  buildWebhookProviderEventId,
  claimMercadoPagoWebhookEvent,
  markMercadoPagoWebhookProcessed,
  markMercadoPagoWebhookSkipped,
} from './mercadopago.webhook-events.utils';

function validateWebhookSignature(
  xSignature: string | undefined,
  xRequestId: string | undefined,
  dataId: string
): boolean {
  if (!mercadoPagoConfig.webhookSecret) {
    return mercadoPagoConfig.env === 'sandbox';
  }
  if (!xSignature || !xRequestId) return false;

  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k.trim(), v?.trim()];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto
    .createHmac('sha256', mercadoPagoConfig.webhookSecret)
    .update(manifest)
    .digest('hex');
  return expected === v1;
}

async function resolveDoctorIdFromMpUserId(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const conn = await prisma.paymentProviderConnection.findFirst({
    where: { provider: 'mercadopago', providerUserId: userId, status: 'active' },
    select: { doctorId: true },
  });
  return conn?.doctorId || null;
}

type MpMerchantOrder = {
  collector?: { id?: number };
  external_reference?: string;
  preference_id?: string;
  payments?: Array<{ id: number; status: string }>;
  order_status?: string;
};

/** Las notificaciones IPN merchant_order no traen user_id; probamos token OAuth de doctores con cobros pendientes. */
async function resolveDoctorAndMerchantOrder(
  orderId: string,
  hintedDoctorId?: string | null
): Promise<{ doctorId: string; order: MpMerchantOrder } | null> {
  const doctorIds: string[] = [];
  if (hintedDoctorId) doctorIds.push(hintedDoctorId);

  const pending = await prisma.mercadoPagoPayment.findMany({
    where: { status: 'pending', createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    select: { doctorId: true },
    distinct: ['doctorId'],
  });
  for (const p of pending) {
    if (!doctorIds.includes(p.doctorId)) doctorIds.push(p.doctorId);
  }

  for (const doctorId of doctorIds) {
    try {
      const accessToken = await MercadoPagoOAuthService.getValidAccessToken(doctorId);
      const order = (await MercadoPagoApiClient.getMerchantOrder(
        accessToken,
        orderId
      )) as MpMerchantOrder;
      return { doctorId, order };
    } catch {
      // Otro doctor / token distinto
    }
  }
  return null;
}

async function applyMpPaymentToLocal(
  mpPayment: MpPaymentPayload,
  doctorId: string,
  localPaymentHint?: Awaited<ReturnType<typeof prisma.mercadoPagoPayment.findFirst>>
) {
  const mappedStatus = MercadoPagoPreferenceService.mapMpStatus(mpPayment.status);

  let payment =
    localPaymentHint ||
    (await prisma.mercadoPagoPayment.findFirst({
      where: { providerPaymentId: String(mpPayment.id) },
    })) ||
    (mpPayment.external_reference
      ? await prisma.mercadoPagoPayment.findUnique({
          where: { externalReference: mpPayment.external_reference },
        })
      : null);

  if (!payment && mpPayment.external_reference) {
    payment = await prisma.mercadoPagoPayment.findFirst({
      where: {
        doctorId,
        externalReference: mpPayment.external_reference,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!payment) return null;

  const financials =
    mappedStatus === 'approved' ? buildPaymentFinancialUpdate(mpPayment, payment) : undefined;

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
      eventType: 'WEBHOOK_PAYMENT_APPLIED',
      rawPayloadJson: mpPayment as object,
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
}

export class MercadoPagoWebhookService {
  static async processWebhook(
    body: Record<string, unknown>,
    headers: { 'x-signature'?: string; 'x-request-id'?: string }
  ) {
    const topic = String(body.topic || '');
    if (topic === 'merchant_order') {
      return this.processMerchantOrderWebhook(body, headers);
    }
    return this.processPaymentWebhook(body, headers);
  }

  private static async processMerchantOrderWebhook(
    body: Record<string, unknown>,
    headers: { 'x-signature'?: string; 'x-request-id'?: string }
  ) {
    const resource = String((body as { resource?: string }).resource || '');
    const orderIdMatch = resource.match(/merchant_orders\/(\d+)/);
    const orderId = orderIdMatch?.[1] || '';

    if (
      orderId &&
      mercadoPagoConfig.webhookSecret &&
      !validateWebhookSignature(headers['x-signature'], headers['x-request-id'], orderId)
    ) {
      securityLogger.warn('Mercado Pago merchant_order webhook: firma inválida', { orderId });
      if (mercadoPagoConfig.env !== 'sandbox') {
        throw new Error('Invalid webhook signature');
      }
    }

    const providerEventId = buildWebhookProviderEventId(
      'merchant_order',
      orderId || 'unknown',
      headers['x-request-id']
    );
    if (!providerEventId) {
      return { rejected: true, reason: 'missing_request_id' };
    }

    const claim = await claimMercadoPagoWebhookEvent({
      providerEventId,
      eventType: 'merchant_order',
      payloadJson: body as object,
    });
    if (claim === 'duplicate') return { duplicate: true };
    if (claim === 'busy') return { skipped: true, retry: true };

    if (!resource || !orderId) {
      await markMercadoPagoWebhookSkipped(providerEventId);
      return { skipped: true };
    }

    const webhookUserId = body.user_id != null ? String(body.user_id) : undefined;
    const hintedDoctorId = await resolveDoctorIdFromMpUserId(webhookUserId);

    try {
      const resolved = await resolveDoctorAndMerchantOrder(orderId, hintedDoctorId);
      if (!resolved) {
        return { notFound: true, retry: true };
      }

      const { doctorId, order: initialOrder } = resolved;
      let order = initialOrder;
      const accessToken = await MercadoPagoOAuthService.getValidAccessToken(doctorId);

      if (!order.payments?.length) {
        order = (await MercadoPagoApiClient.getMerchantOrder(accessToken, orderId)) as MpMerchantOrder;
      }

      let applied = false;
      for (const p of order.payments || []) {
        if (p.status !== 'approved') continue;
        try {
          let mpPayment;
          try {
            mpPayment = await MercadoPagoApiClient.getPayment(accessToken, String(p.id));
          } catch (getErr) {
            if (!isMpNotFoundError(getErr)) throw getErr;
            const localHint = order.external_reference
              ? await prisma.mercadoPagoPayment.findUnique({
                  where: { externalReference: order.external_reference },
                })
              : null;
            const resolvedPayment = await resolveMpPaymentWithFallback({
              paymentId: String(p.id),
              doctorAccessToken: accessToken,
              preferenceId: order.preference_id || localHint?.providerPreferenceId,
              externalReference: order.external_reference || localHint?.externalReference,
            });
            mpPayment = resolvedPayment.payment;
          }
          const local = order.external_reference
            ? await prisma.mercadoPagoPayment.findUnique({
                where: { externalReference: order.external_reference },
              })
            : null;
          const result = await applyMpPaymentToLocal(mpPayment, doctorId, local);
          if (result) applied = true;
        } catch (err) {
          securityLogger.warn('MP merchant_order: error aplicando pago', { orderId, paymentId: p.id, err });
        }
      }

      if (applied) {
        await markMercadoPagoWebhookProcessed(providerEventId);
        return { processed: true, source: 'merchant_order' };
      }

      return { pending: true, retry: true };
    } catch (err) {
      securityLogger.warn('MP merchant_order webhook error', { orderId, err });
      return { error: true, retry: true };
    }
  }

  private static async processPaymentWebhook(
    body: Record<string, unknown>,
    headers: { 'x-signature'?: string; 'x-request-id'?: string }
  ) {
    const action = String(body.action || body.type || 'unknown');
    const data = (body.data as { id?: string | number }) || {};
    const dataId = data.id != null ? String(data.id) : '';

    const providerEventId = buildWebhookProviderEventId(
      action,
      dataId || 'unknown',
      headers['x-request-id']
    );
    if (!providerEventId) {
      return { rejected: true, reason: 'missing_request_id' };
    }

    if (dataId && !validateWebhookSignature(headers['x-signature'], headers['x-request-id'], dataId)) {
      securityLogger.warn('Mercado Pago webhook: firma inválida', { dataId, action });
      if (mercadoPagoConfig.env !== 'sandbox') {
        throw new Error('Invalid webhook signature');
      }
    }

    const claim = await claimMercadoPagoWebhookEvent({
      providerEventId,
      eventType: action,
      payloadJson: body as object,
    });
    if (claim === 'duplicate') return { duplicate: true };
    if (claim === 'busy') return { skipped: true, retry: true };

    if (
      !dataId ||
      (action !== 'payment.created' && action !== 'payment.updated' && body.type !== 'payment')
    ) {
      await markMercadoPagoWebhookSkipped(providerEventId);
      return { skipped: true };
    }

    const localPayment = await prisma.mercadoPagoPayment.findFirst({
      where: { providerPaymentId: dataId },
    });

    let doctorId = localPayment?.doctorId || null;
    if (!doctorId) {
      doctorId = await resolveDoctorIdFromMpUserId(
        body.user_id != null ? String(body.user_id) : undefined
      );
    }

    if (!doctorId) {
      const platformToken = mercadoPagoConfig.platformAccessToken;
      if (platformToken) {
        try {
          const mpPayment = await MercadoPagoApiClient.getPayment(platformToken, dataId);
          if (mpPayment.external_reference) {
            const byRef = await prisma.mercadoPagoPayment.findUnique({
              where: { externalReference: mpPayment.external_reference },
            });
            doctorId = byRef?.doctorId || null;
          }
        } catch (err) {
          securityLogger.warn('MP webhook: no se pudo obtener pago con token plataforma', err);
        }
      }
    }

    if (!doctorId) {
      return { notFound: true, retry: true };
    }

    const localPaymentHint =
      localPayment ||
      (await prisma.mercadoPagoPayment.findFirst({
        where: {
          doctorId,
          OR: [
            { providerPaymentId: dataId },
            {
              status: 'pending',
              createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
      }));

    try {
      const accessToken = await MercadoPagoOAuthService.getValidAccessToken(doctorId);
      let mpPayment;
      try {
        mpPayment = await MercadoPagoApiClient.getPayment(accessToken, dataId);
      } catch (getErr) {
        if (!isMpNotFoundError(getErr)) throw getErr;
        const resolved = await resolveMpPaymentWithFallback({
          paymentId: dataId,
          doctorAccessToken: accessToken,
          preferenceId: localPaymentHint?.providerPreferenceId,
          externalReference: localPaymentHint?.externalReference,
        });
        mpPayment = resolved.payment;
        securityLogger.info('MP webhook: resolved payment via fallback', {
          dataId,
          source: resolved.source,
        });
      }

      const payment = await applyMpPaymentToLocal(mpPayment, doctorId, localPaymentHint);
      if (!payment) {
        return { paymentNotFound: true, retry: true };
      }

      if (
        (payment.status === 'rejected' || payment.status === 'cancelled') &&
        payment.appointmentId &&
        payment.paymentType === 'teleconsultation'
      ) {
        const settings = await prisma.doctorMercadoPagoSettings.findUnique({
          where: { doctorId: payment.doctorId },
        });
        if (settings?.autoCancelOnPaymentRejected) {
          await prisma.appointment.update({
            where: { id: payment.appointmentId },
            data: {
              status: 'CANCELLED',
              confirmationStatus: 'CANCELLED',
              cancelledAt: new Date(),
              cancellationReason: 'Pago de teleconsulta rechazado',
            },
          });
        }
      }

      await markMercadoPagoWebhookProcessed(providerEventId);

      return { processed: true, paymentId: payment.id, status: payment.status };
    } catch (err) {
      if (isMpNotFoundError(err)) {
        try {
          const accessToken = await MercadoPagoOAuthService.getValidAccessToken(doctorId);
          const resolved = await resolveMpPaymentWithFallback({
            paymentId: dataId,
            doctorAccessToken: accessToken,
            preferenceId: localPaymentHint?.providerPreferenceId,
            externalReference: localPaymentHint?.externalReference,
          });
          const payment = await applyMpPaymentToLocal(resolved.payment, doctorId, localPaymentHint);
          if (payment) {
            await markMercadoPagoWebhookProcessed(providerEventId);
            securityLogger.info('MP webhook: recovered payment in catch via fallback', {
              dataId,
              source: resolved.source,
            });
            return { processed: true, paymentId: payment.id, status: payment.status };
          }
        } catch (fallbackErr) {
          securityLogger.warn('MP payment webhook: fallback also failed', {
            dataId,
            doctorId,
            fallbackErr,
          });
        }
      }
      securityLogger.warn('MP payment webhook: getPayment/apply failed', { dataId, doctorId, err });
      return { error: true, retry: true };
    }
  }
}
