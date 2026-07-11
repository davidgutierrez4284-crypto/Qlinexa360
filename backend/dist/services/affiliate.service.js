"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWebhookEvent = registerWebhookEvent;
exports.markWebhookEventProcessed = markWebhookEventProcessed;
exports.processPaymentForCommission = processPaymentForCommission;
exports.reverseCommissionForRefund = reverseCommissionForRefund;
exports.markReferralCancelledIfNoPayment = markReferralCancelledIfNoPayment;
const database_1 = __importDefault(require("../config/database"));
const affiliateCommission_utils_1 = require("../utils/affiliateCommission.utils");
const affiliateAudit_service_1 = require("./affiliateAudit.service");
const affiliate_constants_1 = require("../constants/affiliate.constants");
/**
 * Servicio de comisiones de afiliados.
 *
 * Hooks de PayPal:
 *  - PAYMENT.SALE.COMPLETED  -> processPaymentForCommission (genera comisión sobre base sin IVA)
 *  - PAYMENT.SALE.REFUNDED   -> reverseCommissionForRefund (REVERSED si ya pagada, si no CANCELLED)
 *  - BILLING.SUBSCRIPTION.CANCELLED -> markReferralCancelledIfNoPayment
 */
/** Idempotencia de webhooks: registra el evento. Devuelve si ya fue procesado antes. */
async function registerWebhookEvent(event) {
    const paypalEventId = String((event === null || event === void 0 ? void 0 : event.id) || '').trim();
    const eventType = String((event === null || event === void 0 ? void 0 : event.event_type) || '').trim();
    if (!paypalEventId) {
        // Sin id no podemos deduplicar; permitimos continuar pero avisamos.
        console.warn('[Affiliate] webhook sin id; no se puede registrar idempotencia');
        return { alreadyProcessed: false };
    }
    const existing = await database_1.default.paypalWebhookEvent.findUnique({ where: { paypalEventId } });
    if (existing) {
        return { alreadyProcessed: existing.processed };
    }
    try {
        await database_1.default.paypalWebhookEvent.create({
            data: { paypalEventId, eventType, payloadJson: event, processed: false }
        });
    }
    catch (e) {
        // Carrera: otro proceso lo creó primero.
        console.warn('[Affiliate] no se pudo registrar webhook event (posible carrera):', e);
    }
    return { alreadyProcessed: false };
}
/** Marca un evento de webhook como procesado. */
async function markWebhookEventProcessed(event) {
    const paypalEventId = String((event === null || event === void 0 ? void 0 : event.id) || '').trim();
    if (!paypalEventId)
        return;
    try {
        await database_1.default.paypalWebhookEvent.updateMany({
            where: { paypalEventId },
            data: { processed: true, processedAt: new Date() }
        });
    }
    catch (e) {
        console.warn('[Affiliate] no se pudo marcar webhook como procesado:', e);
    }
}
/** Resuelve el User.id del doctor a partir del id de suscripción PayPal. */
async function resolveDoctorUserIdBySubscription(paypalSubscriptionId) {
    var _a;
    const id = (paypalSubscriptionId || '').trim();
    if (!id)
        return null;
    const doctor = await database_1.default.doctor.findFirst({
        where: { subscription: { paypalSubscriptionId: id } },
        select: { userId: true }
    });
    return (_a = doctor === null || doctor === void 0 ? void 0 : doctor.userId) !== null && _a !== void 0 ? _a : null;
}
/**
 * Genera la comisión correspondiente a un pago exitoso de PayPal, si aplica.
 * Idempotente por paypalPaymentId. No lanza: cualquier error se registra y se ignora.
 */
async function processPaymentForCommission(event) {
    var _a, _b;
    try {
        const payment = event === null || event === void 0 ? void 0 : event.resource;
        const paypalPaymentId = String((payment === null || payment === void 0 ? void 0 : payment.id) || '').trim();
        const paypalSubscriptionId = String((payment === null || payment === void 0 ? void 0 : payment.billing_agreement_id) || '').trim();
        if (!paypalPaymentId || !paypalSubscriptionId)
            return;
        // Idempotencia: este pago ya generó comisión.
        const existing = await database_1.default.affiliateCommission.findUnique({ where: { paypalPaymentId } });
        if (existing)
            return;
        const doctorUserId = await resolveDoctorUserIdBySubscription(paypalSubscriptionId);
        if (!doctorUserId)
            return;
        const referral = await database_1.default.affiliateReferral.findUnique({
            where: { doctorUserId },
            include: { affiliate: true }
        });
        if (!referral || !referral.affiliate)
            return;
        if (referral.affiliate.status !== 'ACTIVE') {
            console.log(`[Affiliate] afiliado ${referral.affiliateId} no ACTIVE; sin comisión.`);
            return;
        }
        // Reglas: afiliado (override) > regla activa > constantes.
        const activeRule = await database_1.default.affiliateCommissionRule.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        const commissionPercentage = Number(referral.affiliate.defaultCommissionPercentage) ||
            (activeRule ? Number(activeRule.commissionPercentage) : affiliate_constants_1.DEFAULT_COMMISSION_PERCENTAGE);
        const commissionMonths = referral.affiliate.defaultCommissionMonths ||
            (activeRule === null || activeRule === void 0 ? void 0 : activeRule.commissionMonths) ||
            affiliate_constants_1.DEFAULT_COMMISSION_MONTHS;
        const vatRate = activeRule ? Number(activeRule.vatRate) : affiliate_constants_1.DEFAULT_VAT_RATE;
        // ¿Cuántas comisiones válidas ya se generaron para este doctor/afiliado?
        const priorCount = await database_1.default.affiliateCommission.count({
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
        const grossRaw = Number((_a = payment === null || payment === void 0 ? void 0 : payment.amount) === null || _a === void 0 ? void 0 : _a.total);
        const grossAmount = Number.isFinite(grossRaw) && grossRaw > 0 ? grossRaw : 499;
        if (!(Number.isFinite(grossRaw) && grossRaw > 0)) {
            console.warn('[Affiliate] pago sin amount.total; usando 499 como fallback.');
        }
        const currency = String(((_b = payment === null || payment === void 0 ? void 0 : payment.amount) === null || _b === void 0 ? void 0 : _b.currency) || affiliate_constants_1.DEFAULT_COMMISSION_CURRENCY);
        const paymentDate = (payment === null || payment === void 0 ? void 0 : payment.create_time) ? new Date(payment.create_time) : new Date();
        const { netBase, commissionAmount, trace } = (0, affiliateCommission_utils_1.computeCommission)({
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
        await database_1.default.$transaction(async (tx) => {
            var _a;
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
                    calculationTraceJson: trace
                }
            });
            await tx.affiliateReferral.update({
                where: { id: referral.id },
                data: {
                    status: 'ACTIVE_PAID',
                    firstPaymentDate: (_a = referral.firstPaymentDate) !== null && _a !== void 0 ? _a : paymentDate
                }
            });
        });
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.COMMISSION_GENERATED,
            targetType: 'AffiliateCommission',
            targetId: paypalPaymentId,
            metadata: { affiliateId: referral.affiliateId, doctorUserId, commissionMonthNumber, commissionAmount }
        });
        console.log(`[Affiliate] comisión generada: afiliado=${referral.affiliateId} doctor=${doctorUserId} mes=${commissionMonthNumber} monto=${commissionAmount} ${currency}`);
    }
    catch (e) {
        // Carrera contra el índice único de paypalPaymentId u otro error: no romper el webhook.
        if ((e === null || e === void 0 ? void 0 : e.code) === 'P2002') {
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
async function reverseCommissionForRefund(event) {
    try {
        const refund = event === null || event === void 0 ? void 0 : event.resource;
        // En PAYMENT.SALE.REFUNDED, el id del sale original suele venir en sale_id; fallback a parent_payment.
        const saleId = String((refund === null || refund === void 0 ? void 0 : refund.sale_id) || (refund === null || refund === void 0 ? void 0 : refund.parent_payment) || (refund === null || refund === void 0 ? void 0 : refund.id) || '').trim();
        if (!saleId)
            return;
        const commission = await database_1.default.affiliateCommission.findUnique({ where: { paypalPaymentId: saleId } });
        if (!commission)
            return;
        if (commission.status === 'CANCELLED' || commission.status === 'REVERSED')
            return;
        const newStatus = commission.status === 'PAID' ? 'REVERSED' : 'CANCELLED';
        const prevTrace = commission.calculationTraceJson && typeof commission.calculationTraceJson === 'object'
            ? commission.calculationTraceJson
            : {};
        await database_1.default.affiliateCommission.update({
            where: { id: commission.id },
            data: {
                status: newStatus,
                calculationTraceJson: Object.assign(Object.assign({}, prevTrace), { refund: {
                        reversedAt: new Date().toISOString(),
                        previousStatus: commission.status,
                        negativeAdjustment: newStatus === 'REVERSED' ? Number(commission.commissionAmount) : 0,
                        refundId: String((refund === null || refund === void 0 ? void 0 : refund.id) || '')
                    } })
            }
        });
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.COMMISSION_REVERSED,
            targetType: 'AffiliateCommission',
            targetId: commission.id,
            metadata: { saleId, from: commission.status, to: newStatus }
        });
        console.log(`[Affiliate] comisión ${commission.id} -> ${newStatus} por refund de sale ${saleId}`);
    }
    catch (e) {
        console.error('[Affiliate] error reversando comisión por refund:', e);
    }
}
/**
 * Si el doctor cancela su suscripción antes del primer pago, marca su referral como CANCELLED.
 * No afecta comisiones ya generadas.
 */
async function markReferralCancelledIfNoPayment(paypalSubscriptionId) {
    try {
        const doctorUserId = await resolveDoctorUserIdBySubscription(paypalSubscriptionId);
        if (!doctorUserId)
            return;
        const referral = await database_1.default.affiliateReferral.findUnique({ where: { doctorUserId } });
        if (!referral)
            return;
        if (referral.firstPaymentDate)
            return; // ya pagó: no cancelar el referral
        await database_1.default.affiliateReferral.update({
            where: { id: referral.id },
            data: { status: 'CANCELLED' }
        });
    }
    catch (e) {
        console.error('[Affiliate] error marcando referral CANCELLED:', e);
    }
}
