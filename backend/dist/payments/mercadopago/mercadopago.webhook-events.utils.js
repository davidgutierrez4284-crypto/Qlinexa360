"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWebhookProviderEventId = buildWebhookProviderEventId;
exports.claimMercadoPagoWebhookEvent = claimMercadoPagoWebhookEvent;
exports.markMercadoPagoWebhookProcessed = markMercadoPagoWebhookProcessed;
exports.markMercadoPagoWebhookSkipped = markMercadoPagoWebhookSkipped;
const database_1 = __importDefault(require("../../config/database"));
const logger_utils_1 = require("../../utils/logger.utils");
const mercadopago_config_1 = require("./mercadopago.config");
const STALE_UNPROCESSED_MS = 15 * 60 * 1000;
/**
 * Construye un ID estable para deduplicar webhooks. En producción exige x-request-id.
 */
function buildWebhookProviderEventId(prefix, resourceId, requestId) {
    if (requestId) {
        return `${prefix}:${resourceId}:${requestId}`;
    }
    if (mercadopago_config_1.mercadoPagoConfig.env !== 'production') {
        return `${prefix}:${resourceId}:dev-no-request-id`;
    }
    logger_utils_1.securityLogger.warn('MP webhook rejected: missing x-request-id in production', {
        prefix,
        resourceId,
    });
    return null;
}
/**
 * Insert-at-most-once: solo un worker procesa cada evento. Eventos stale sin processed pueden reclamarse.
 */
async function claimMercadoPagoWebhookEvent(params) {
    const { providerEventId, eventType, payloadJson } = params;
    const inserted = await database_1.default.paymentWebhookEvent.createMany({
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
    const existing = await database_1.default.paymentWebhookEvent.findUnique({
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
    logger_utils_1.securityLogger.warn('MP webhook reclaiming stale unprocessed event', {
        providerEventId,
        ageMs,
    });
    return 'claim';
}
async function markMercadoPagoWebhookProcessed(providerEventId) {
    await database_1.default.paymentWebhookEvent.update({
        where: { providerEventId },
        data: { processed: true, processedAt: new Date() },
    });
}
async function markMercadoPagoWebhookSkipped(providerEventId) {
    await markMercadoPagoWebhookProcessed(providerEventId);
}
