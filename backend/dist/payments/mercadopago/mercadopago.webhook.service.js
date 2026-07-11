"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoWebhookService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../../config/database"));
const logger_utils_1 = require("../../utils/logger.utils");
const mercadopago_api_client_1 = require("./mercadopago.api.client");
const mercadopago_config_1 = require("./mercadopago.config");
const mercadopago_preference_service_1 = require("./mercadopago.preference.service");
const mercadopago_oauth_service_1 = require("./mercadopago.oauth.service");
const mercadopago_inperson_service_1 = require("./mercadopago.inperson.service");
const mercadopago_teleconsultation_service_1 = require("./mercadopago.teleconsultation.service");
const mercadopago_payment_resolve_service_1 = require("./mercadopago.payment-resolve.service");
const mercadopago_payment_fees_utils_1 = require("./mercadopago.payment-fees.utils");
const mercadopago_webhook_events_utils_1 = require("./mercadopago.webhook-events.utils");
function validateWebhookSignature(xSignature, xRequestId, dataId) {
    if (!mercadopago_config_1.mercadoPagoConfig.webhookSecret) {
        return mercadopago_config_1.mercadoPagoConfig.env === 'sandbox';
    }
    if (!xSignature || !xRequestId)
        return false;
    const parts = Object.fromEntries(xSignature.split(',').map((p) => {
        const [k, v] = p.split('=');
        return [k.trim(), v === null || v === void 0 ? void 0 : v.trim()];
    }));
    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1)
        return false;
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = crypto_1.default
        .createHmac('sha256', mercadopago_config_1.mercadoPagoConfig.webhookSecret)
        .update(manifest)
        .digest('hex');
    return expected === v1;
}
async function resolveDoctorIdFromMpUserId(userId) {
    if (!userId)
        return null;
    const conn = await database_1.default.paymentProviderConnection.findFirst({
        where: { provider: 'mercadopago', providerUserId: userId, status: 'active' },
        select: { doctorId: true },
    });
    return (conn === null || conn === void 0 ? void 0 : conn.doctorId) || null;
}
/** Las notificaciones IPN merchant_order no traen user_id; probamos token OAuth de doctores con cobros pendientes. */
async function resolveDoctorAndMerchantOrder(orderId, hintedDoctorId) {
    const doctorIds = [];
    if (hintedDoctorId)
        doctorIds.push(hintedDoctorId);
    const pending = await database_1.default.mercadoPagoPayment.findMany({
        where: { status: 'pending', createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        select: { doctorId: true },
        distinct: ['doctorId'],
    });
    for (const p of pending) {
        if (!doctorIds.includes(p.doctorId))
            doctorIds.push(p.doctorId);
    }
    for (const doctorId of doctorIds) {
        try {
            const accessToken = await mercadopago_oauth_service_1.MercadoPagoOAuthService.getValidAccessToken(doctorId);
            const order = (await mercadopago_api_client_1.MercadoPagoApiClient.getMerchantOrder(accessToken, orderId));
            return { doctorId, order };
        }
        catch (_a) {
            // Otro doctor / token distinto
        }
    }
    return null;
}
async function applyMpPaymentToLocal(mpPayment, doctorId, localPaymentHint) {
    const mappedStatus = mercadopago_preference_service_1.MercadoPagoPreferenceService.mapMpStatus(mpPayment.status);
    let payment = localPaymentHint ||
        (await database_1.default.mercadoPagoPayment.findFirst({
            where: { providerPaymentId: String(mpPayment.id) },
        })) ||
        (mpPayment.external_reference
            ? await database_1.default.mercadoPagoPayment.findUnique({
                where: { externalReference: mpPayment.external_reference },
            })
            : null);
    if (!payment && mpPayment.external_reference) {
        payment = await database_1.default.mercadoPagoPayment.findFirst({
            where: {
                doctorId,
                externalReference: mpPayment.external_reference,
                status: 'pending',
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    if (!payment)
        return null;
    const financials = mappedStatus === 'approved' ? (0, mercadopago_payment_fees_utils_1.buildPaymentFinancialUpdate)(mpPayment, payment) : undefined;
    const updated = await database_1.default.mercadoPagoPayment.update({
        where: { id: payment.id },
        data: Object.assign({ status: mappedStatus, providerPaymentId: String(mpPayment.id), paidAt: mpPayment.date_approved ? new Date(mpPayment.date_approved) : payment.paidAt }, (financials !== null && financials !== void 0 ? financials : {})),
    });
    await database_1.default.paymentAuditLog.create({
        data: {
            paymentId: payment.id,
            eventType: 'WEBHOOK_PAYMENT_APPLIED',
            rawPayloadJson: mpPayment,
        },
    });
    if (mappedStatus === 'approved' && payment.appointmentId) {
        if (payment.paymentType === 'teleconsultation') {
            await (0, mercadopago_teleconsultation_service_1.finalizeTeleconsultationAfterPayment)(payment.appointmentId);
        }
        else if (payment.paymentType === 'in_person') {
            await (0, mercadopago_inperson_service_1.finalizeInPersonAfterPayment)(payment.appointmentId);
        }
    }
    return updated;
}
class MercadoPagoWebhookService {
    static async processWebhook(body, headers) {
        const topic = String(body.topic || '');
        if (topic === 'merchant_order') {
            return this.processMerchantOrderWebhook(body, headers);
        }
        return this.processPaymentWebhook(body, headers);
    }
    static async processMerchantOrderWebhook(body, headers) {
        var _a;
        const resource = String(body.resource || '');
        const orderIdMatch = resource.match(/merchant_orders\/(\d+)/);
        const orderId = (orderIdMatch === null || orderIdMatch === void 0 ? void 0 : orderIdMatch[1]) || '';
        if (orderId &&
            mercadopago_config_1.mercadoPagoConfig.webhookSecret &&
            !validateWebhookSignature(headers['x-signature'], headers['x-request-id'], orderId)) {
            logger_utils_1.securityLogger.warn('Mercado Pago merchant_order webhook: firma inválida', { orderId });
            if (mercadopago_config_1.mercadoPagoConfig.env !== 'sandbox') {
                throw new Error('Invalid webhook signature');
            }
        }
        const providerEventId = (0, mercadopago_webhook_events_utils_1.buildWebhookProviderEventId)('merchant_order', orderId || 'unknown', headers['x-request-id']);
        if (!providerEventId) {
            return { rejected: true, reason: 'missing_request_id' };
        }
        const claim = await (0, mercadopago_webhook_events_utils_1.claimMercadoPagoWebhookEvent)({
            providerEventId,
            eventType: 'merchant_order',
            payloadJson: body,
        });
        if (claim === 'duplicate')
            return { duplicate: true };
        if (claim === 'busy')
            return { skipped: true, retry: true };
        if (!resource || !orderId) {
            await (0, mercadopago_webhook_events_utils_1.markMercadoPagoWebhookSkipped)(providerEventId);
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
            const accessToken = await mercadopago_oauth_service_1.MercadoPagoOAuthService.getValidAccessToken(doctorId);
            if (!((_a = order.payments) === null || _a === void 0 ? void 0 : _a.length)) {
                order = (await mercadopago_api_client_1.MercadoPagoApiClient.getMerchantOrder(accessToken, orderId));
            }
            let applied = false;
            for (const p of order.payments || []) {
                if (p.status !== 'approved')
                    continue;
                try {
                    let mpPayment;
                    try {
                        mpPayment = await mercadopago_api_client_1.MercadoPagoApiClient.getPayment(accessToken, String(p.id));
                    }
                    catch (getErr) {
                        if (!(0, mercadopago_payment_resolve_service_1.isMpNotFoundError)(getErr))
                            throw getErr;
                        const localHint = order.external_reference
                            ? await database_1.default.mercadoPagoPayment.findUnique({
                                where: { externalReference: order.external_reference },
                            })
                            : null;
                        const resolvedPayment = await (0, mercadopago_payment_resolve_service_1.resolveMpPaymentWithFallback)({
                            paymentId: String(p.id),
                            doctorAccessToken: accessToken,
                            preferenceId: order.preference_id || (localHint === null || localHint === void 0 ? void 0 : localHint.providerPreferenceId),
                            externalReference: order.external_reference || (localHint === null || localHint === void 0 ? void 0 : localHint.externalReference),
                        });
                        mpPayment = resolvedPayment.payment;
                    }
                    const local = order.external_reference
                        ? await database_1.default.mercadoPagoPayment.findUnique({
                            where: { externalReference: order.external_reference },
                        })
                        : null;
                    const result = await applyMpPaymentToLocal(mpPayment, doctorId, local);
                    if (result)
                        applied = true;
                }
                catch (err) {
                    logger_utils_1.securityLogger.warn('MP merchant_order: error aplicando pago', { orderId, paymentId: p.id, err });
                }
            }
            if (applied) {
                await (0, mercadopago_webhook_events_utils_1.markMercadoPagoWebhookProcessed)(providerEventId);
                return { processed: true, source: 'merchant_order' };
            }
            return { pending: true, retry: true };
        }
        catch (err) {
            logger_utils_1.securityLogger.warn('MP merchant_order webhook error', { orderId, err });
            return { error: true, retry: true };
        }
    }
    static async processPaymentWebhook(body, headers) {
        const action = String(body.action || body.type || 'unknown');
        const data = body.data || {};
        const dataId = data.id != null ? String(data.id) : '';
        const providerEventId = (0, mercadopago_webhook_events_utils_1.buildWebhookProviderEventId)(action, dataId || 'unknown', headers['x-request-id']);
        if (!providerEventId) {
            return { rejected: true, reason: 'missing_request_id' };
        }
        if (dataId && !validateWebhookSignature(headers['x-signature'], headers['x-request-id'], dataId)) {
            logger_utils_1.securityLogger.warn('Mercado Pago webhook: firma inválida', { dataId, action });
            if (mercadopago_config_1.mercadoPagoConfig.env !== 'sandbox') {
                throw new Error('Invalid webhook signature');
            }
        }
        const claim = await (0, mercadopago_webhook_events_utils_1.claimMercadoPagoWebhookEvent)({
            providerEventId,
            eventType: action,
            payloadJson: body,
        });
        if (claim === 'duplicate')
            return { duplicate: true };
        if (claim === 'busy')
            return { skipped: true, retry: true };
        if (!dataId ||
            (action !== 'payment.created' && action !== 'payment.updated' && body.type !== 'payment')) {
            await (0, mercadopago_webhook_events_utils_1.markMercadoPagoWebhookSkipped)(providerEventId);
            return { skipped: true };
        }
        const localPayment = await database_1.default.mercadoPagoPayment.findFirst({
            where: { providerPaymentId: dataId },
        });
        let doctorId = (localPayment === null || localPayment === void 0 ? void 0 : localPayment.doctorId) || null;
        if (!doctorId) {
            doctorId = await resolveDoctorIdFromMpUserId(body.user_id != null ? String(body.user_id) : undefined);
        }
        if (!doctorId) {
            const platformToken = mercadopago_config_1.mercadoPagoConfig.platformAccessToken;
            if (platformToken) {
                try {
                    const mpPayment = await mercadopago_api_client_1.MercadoPagoApiClient.getPayment(platformToken, dataId);
                    if (mpPayment.external_reference) {
                        const byRef = await database_1.default.mercadoPagoPayment.findUnique({
                            where: { externalReference: mpPayment.external_reference },
                        });
                        doctorId = (byRef === null || byRef === void 0 ? void 0 : byRef.doctorId) || null;
                    }
                }
                catch (err) {
                    logger_utils_1.securityLogger.warn('MP webhook: no se pudo obtener pago con token plataforma', err);
                }
            }
        }
        if (!doctorId) {
            return { notFound: true, retry: true };
        }
        const localPaymentHint = localPayment ||
            (await database_1.default.mercadoPagoPayment.findFirst({
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
            const accessToken = await mercadopago_oauth_service_1.MercadoPagoOAuthService.getValidAccessToken(doctorId);
            let mpPayment;
            try {
                mpPayment = await mercadopago_api_client_1.MercadoPagoApiClient.getPayment(accessToken, dataId);
            }
            catch (getErr) {
                if (!(0, mercadopago_payment_resolve_service_1.isMpNotFoundError)(getErr))
                    throw getErr;
                const resolved = await (0, mercadopago_payment_resolve_service_1.resolveMpPaymentWithFallback)({
                    paymentId: dataId,
                    doctorAccessToken: accessToken,
                    preferenceId: localPaymentHint === null || localPaymentHint === void 0 ? void 0 : localPaymentHint.providerPreferenceId,
                    externalReference: localPaymentHint === null || localPaymentHint === void 0 ? void 0 : localPaymentHint.externalReference,
                });
                mpPayment = resolved.payment;
                logger_utils_1.securityLogger.info('MP webhook: resolved payment via fallback', {
                    dataId,
                    source: resolved.source,
                });
            }
            const payment = await applyMpPaymentToLocal(mpPayment, doctorId, localPaymentHint);
            if (!payment) {
                return { paymentNotFound: true, retry: true };
            }
            if ((payment.status === 'rejected' || payment.status === 'cancelled') &&
                payment.appointmentId &&
                payment.paymentType === 'teleconsultation') {
                const settings = await database_1.default.doctorMercadoPagoSettings.findUnique({
                    where: { doctorId: payment.doctorId },
                });
                if (settings === null || settings === void 0 ? void 0 : settings.autoCancelOnPaymentRejected) {
                    await database_1.default.appointment.update({
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
            await (0, mercadopago_webhook_events_utils_1.markMercadoPagoWebhookProcessed)(providerEventId);
            return { processed: true, paymentId: payment.id, status: payment.status };
        }
        catch (err) {
            if ((0, mercadopago_payment_resolve_service_1.isMpNotFoundError)(err)) {
                try {
                    const accessToken = await mercadopago_oauth_service_1.MercadoPagoOAuthService.getValidAccessToken(doctorId);
                    const resolved = await (0, mercadopago_payment_resolve_service_1.resolveMpPaymentWithFallback)({
                        paymentId: dataId,
                        doctorAccessToken: accessToken,
                        preferenceId: localPaymentHint === null || localPaymentHint === void 0 ? void 0 : localPaymentHint.providerPreferenceId,
                        externalReference: localPaymentHint === null || localPaymentHint === void 0 ? void 0 : localPaymentHint.externalReference,
                    });
                    const payment = await applyMpPaymentToLocal(resolved.payment, doctorId, localPaymentHint);
                    if (payment) {
                        await (0, mercadopago_webhook_events_utils_1.markMercadoPagoWebhookProcessed)(providerEventId);
                        logger_utils_1.securityLogger.info('MP webhook: recovered payment in catch via fallback', {
                            dataId,
                            source: resolved.source,
                        });
                        return { processed: true, paymentId: payment.id, status: payment.status };
                    }
                }
                catch (fallbackErr) {
                    logger_utils_1.securityLogger.warn('MP payment webhook: fallback also failed', {
                        dataId,
                        doctorId,
                        fallbackErr,
                    });
                }
            }
            logger_utils_1.securityLogger.warn('MP payment webhook: getPayment/apply failed', { dataId, doctorId, err });
            return { error: true, retry: true };
        }
    }
}
exports.MercadoPagoWebhookService = MercadoPagoWebhookService;
