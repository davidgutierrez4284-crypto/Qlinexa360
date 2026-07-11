import prisma from '../../config/database';
import { securityLogger } from '../../utils/logger.utils';
import { mercadoPagoConfig } from './mercadopago.config';

const STALE_UNPROCESSED_MS = 15 * 60 * 1000;

export type WebhookClaimResult = 'claim' | 'duplicate' | 'busy' | 'rejected';

/**
 * Construye un ID estable para deduplicar webhooks. En producción exige x-request-id.
 */
export function buildWebhookProviderEventId(
  prefix: string,
  resourceId: string,
  requestId?: string
): string | null {
  if (requestId) {
    return `${prefix}:${resourceId}:${requestId}`;
  }
  if (mercadoPagoConfig.env !== 'production') {
    return `${prefix}:${resourceId}:dev-no-request-id`;
  }
  securityLogger.warn('MP webhook rejected: missing x-request-id in production', {
    prefix,
    resourceId,
  });
  return null;
}

/**
 * Insert-at-most-once: solo un worker procesa cada evento. Eventos stale sin processed pueden reclamarse.
 */
export async function claimMercadoPagoWebhookEvent(params: {
  providerEventId: string;
  eventType: string;
  payloadJson: object;
}): Promise<WebhookClaimResult> {
  const { providerEventId, eventType, payloadJson } = params;

  const inserted = await prisma.paymentWebhookEvent.createMany({
    data: [
      {
        providerEventId,
        eventType,
        payloadJson,
        processed: false,
      },
    ],
    skipDuplicates: true,
  });

  if (inserted.count === 1) {
    return 'claim';
  }

  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: { providerEventId },
  });

  if (!existing) {
    return 'busy';
  }

  if (existing.processed) {
    return 'duplicate';
  }

  const ageMs = Date.now() - existing.createdAt.getTime();
  if (ageMs < STALE_UNPROCESSED_MS) {
    return 'busy';
  }

  securityLogger.warn('MP webhook reclaiming stale unprocessed event', {
    providerEventId,
    ageMs,
  });
  return 'claim';
}

export async function markMercadoPagoWebhookProcessed(providerEventId: string): Promise<void> {
  await prisma.paymentWebhookEvent.update({
    where: { providerEventId },
    data: { processed: true, processedAt: new Date() },
  });
}

export async function markMercadoPagoWebhookSkipped(providerEventId: string): Promise<void> {
  await markMercadoPagoWebhookProcessed(providerEventId);
}
