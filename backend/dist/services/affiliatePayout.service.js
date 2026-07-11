"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.arePaypalPayoutsEnabled = arePaypalPayoutsEnabled;
exports.payAffiliateViaPaypal = payAffiliateViaPaypal;
exports.handlePayoutItemEvent = handlePayoutItemEvent;
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../config/database"));
const affiliateAudit_service_1 = require("./affiliateAudit.service");
const affiliate_constants_1 = require("../constants/affiliate.constants");
const paypalAuth_utils_1 = require("../utils/paypalAuth.utils");
/**
 * Pagos a afiliados vía PayPal Payouts API.
 *
 * - Solo aplica a afiliados con método de pago PAYPAL (los de SPEI se pagan manual).
 * - Detrás del flag PAYPAL_PAYOUTS_ENABLED.
 * - México (MX): las cuentas Business solo pueden RECIBIR payouts, no ENVIAR (limitación PayPal).
 *   En prod: pagar manualmente y «Marcar pagada». En sandbox: usar cuenta Business US para probar la API.
 * - Reconciliación por webhooks PAYMENT.PAYOUTS-ITEM.* (ver handlePayoutItemEvent).
 */
function arePaypalPayoutsEnabled() {
    return String(process.env.PAYPAL_PAYOUTS_ENABLED || '').trim().toLowerCase() === 'true';
}
/** Mensaje legible cuando PayPal rechaza un payout (p. ej. restricción por país del emisor). */
function payoutErrorMessage(raw, code) {
    const lower = String(raw || '').toLowerCase();
    if (code === 'PAYOUT_NOT_AVAILABLE' ||
        lower.includes('not allowed to send') ||
        lower.includes('user_country_not_allowed')) {
        return ('PayPal no permite enviar pagos automáticos (Payouts) desde cuentas Business en México. ' +
            'México solo puede recibir este tipo de transferencias, no emitirlas. ' +
            'Para afiliados internacionales puedes pagar manualmente desde tu cuenta PayPal y usar «Marcar pagada» en Comisiones. ' +
            'Para probar la integración en sandbox, necesitas una cuenta Business de prueba en un país que sí permita enviar (p. ej. EE.UU.).');
    }
    return `PayPal rechazó el pago: ${raw}`;
}
/**
 * Envía un único payout de PayPal con el total de comisiones pendientes (PENDING/APPROVED)
 * de un afiliado. Marca esas comisiones como PROCESSING; el webhook las pasa a PAID o las regresa.
 */
async function payAffiliateViaPaypal(affiliateId, adminUserId) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!arePaypalPayoutsEnabled()) {
        return { ok: false, status: 409, message: 'Los pagos automáticos por PayPal están deshabilitados (PAYPAL_PAYOUTS_ENABLED).' };
    }
    const profile = await database_1.default.affiliateProfile.findUnique({ where: { id: affiliateId } });
    if (!profile)
        return { ok: false, status: 404, message: 'Afiliado no encontrado.' };
    const bank = await database_1.default.affiliateBankAccount.findFirst({
        where: { affiliateId, isActive: true },
        orderBy: { createdAt: 'desc' }
    });
    if (!bank || bank.payoutMethod !== 'PAYPAL' || !bank.paypalEmail) {
        return { ok: false, status: 400, message: 'El afiliado no tiene un correo de PayPal registrado como método de pago.' };
    }
    const commissions = await database_1.default.affiliateCommission.findMany({
        where: { affiliateId, status: { in: ['PENDING', 'APPROVED'] } }
    });
    if (commissions.length === 0) {
        return { ok: false, status: 400, message: 'El afiliado no tiene comisiones pendientes por pagar.' };
    }
    const total = commissions.reduce((sum, c) => sum + Number(c.commissionAmount), 0);
    const currency = commissions[0].currency || 'MXN';
    const totalStr = total.toFixed(2);
    const token = await (0, paypalAuth_utils_1.getPayPalAccessToken)();
    if (!token) {
        return { ok: false, status: 502, message: 'No se pudo obtener token de PayPal.' };
    }
    const senderBatchId = `aff-${affiliateId.slice(0, 8)}-${Date.now()}`;
    const baseUrl = (0, paypalAuth_utils_1.getPayPalApiBaseUrl)();
    let payoutBatchId = '';
    let payoutItemId = null;
    try {
        const response = await axios_1.default.post(`${baseUrl}/v1/payments/payouts`, {
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
        }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
        payoutBatchId = ((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.batch_header) === null || _b === void 0 ? void 0 : _b.payout_batch_id) || '';
        payoutItemId = ((_e = (_d = (_c = response.data) === null || _c === void 0 ? void 0 : _c.items) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.payout_item_id) || null;
    }
    catch (error) {
        const detail = (_f = error.response) === null || _f === void 0 ? void 0 : _f.data;
        const rawMsg = (detail === null || detail === void 0 ? void 0 : detail.message) || (detail === null || detail === void 0 ? void 0 : detail.name) || error.message;
        console.error('[Payout] error al crear payout de PayPal:', { status: (_g = error.response) === null || _g === void 0 ? void 0 : _g.status, detail });
        const friendly = payoutErrorMessage(rawMsg, detail === null || detail === void 0 ? void 0 : detail.name);
        return { ok: false, status: 502, message: friendly };
    }
    if (!payoutBatchId) {
        return { ok: false, status: 502, message: 'PayPal no devolvió un identificador de lote (payout_batch_id).' };
    }
    await database_1.default.affiliateCommission.updateMany({
        where: { id: { in: commissions.map((c) => c.id) } },
        data: { status: 'PROCESSING', payoutBatchId, payoutItemId, paidByAdminUserId: adminUserId || null }
    });
    void (0, affiliateAudit_service_1.recordAffiliateAudit)({
        actorUserId: adminUserId,
        action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.PAYOUT_INITIATED,
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
async function handlePayoutItemEvent(event) {
    var _a;
    const eventType = String((event === null || event === void 0 ? void 0 : event.event_type) || '');
    const resource = (event === null || event === void 0 ? void 0 : event.resource) || {};
    const payoutBatchId = resource.payout_batch_id || ((_a = resource === null || resource === void 0 ? void 0 : resource.payout_batch_header) === null || _a === void 0 ? void 0 : _a.payout_batch_id);
    const payoutItemId = resource.payout_item_id || null;
    if (!payoutBatchId) {
        console.warn('[Payout] webhook sin payout_batch_id, ignorado:', eventType);
        return;
    }
    const commissions = await database_1.default.affiliateCommission.findMany({
        where: { payoutBatchId, status: 'PROCESSING' }
    });
    if (commissions.length === 0) {
        console.log(`[Payout] ${eventType}: sin comisiones PROCESSING para batch ${payoutBatchId}`);
        return;
    }
    const ids = commissions.map((c) => c.id);
    if (eventType === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED') {
        await database_1.default.affiliateCommission.updateMany({
            where: { id: { in: ids } },
            data: { status: 'PAID', paidAt: new Date(), payoutItemId }
        });
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.PAYOUT_SUCCEEDED,
            targetType: 'AffiliateProfile',
            targetId: commissions[0].affiliateId,
            metadata: { payoutBatchId, payoutItemId, count: ids.length }
        });
        console.log(`[Payout] batch ${payoutBatchId} -> PAID (${ids.length} comisiones)`);
        return;
    }
    if (FAILED_STATES.has(eventType)) {
        await database_1.default.affiliateCommission.updateMany({
            where: { id: { in: ids } },
            data: { status: 'APPROVED', payoutItemId }
        });
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.PAYOUT_FAILED,
            targetType: 'AffiliateProfile',
            targetId: commissions[0].affiliateId,
            metadata: { payoutBatchId, payoutItemId, eventType, count: ids.length, reason: (resource === null || resource === void 0 ? void 0 : resource.errors) || (resource === null || resource === void 0 ? void 0 : resource.transaction_status) }
        });
        console.log(`[Payout] batch ${payoutBatchId} -> ${eventType}, comisiones regresadas a APPROVED`);
        return;
    }
    // UNCLAIMED / HELD / PENDING u otros: se mantienen en PROCESSING.
    console.log(`[Payout] ${eventType} para batch ${payoutBatchId}: sin cambio (se mantiene PROCESSING)`);
}
