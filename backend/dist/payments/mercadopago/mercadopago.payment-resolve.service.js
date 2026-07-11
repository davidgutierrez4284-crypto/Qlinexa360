"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMpNotFoundError = isMpNotFoundError;
exports.resolveMpPaymentWithFallback = resolveMpPaymentWithFallback;
const axios_1 = require("axios");
const logger_utils_1 = require("../../utils/logger.utils");
const mercadopago_api_client_1 = require("./mercadopago.api.client");
const mercadopago_config_1 = require("./mercadopago.config");
function isMpNotFoundError(err) {
    var _a;
    return (0, axios_1.isAxiosError)(err) && ((_a = err.response) === null || _a === void 0 ? void 0 : _a.status) === 404;
}
function pickBestMpPayment(results) {
    if (!(results === null || results === void 0 ? void 0 : results.length))
        return undefined;
    return (results.find((p) => p.status === 'approved') ||
        results.find((p) => p.status === 'rejected' || p.status === 'cancelled') ||
        results[0]);
}
async function tryGetPayment(paymentId, accessToken) {
    try {
        return await mercadopago_api_client_1.MercadoPagoApiClient.getPayment(accessToken, paymentId);
    }
    catch (err) {
        if (isMpNotFoundError(err))
            return null;
        throw err;
    }
}
/**
 * Resolves a Mercado Pago payment using doctor token first, then platform/marketplace fallbacks.
 * In sandbox/marketplace, seller OAuth may return 404 for platform-collected payments.
 */
async function resolveMpPaymentWithFallback(input) {
    var _a, _b;
    const { paymentId, doctorAccessToken, preferenceId, externalReference } = input;
    const platformToken = mercadopago_config_1.mercadoPagoConfig.platformAccessToken || null;
    if (paymentId && doctorAccessToken) {
        const payment = await tryGetPayment(paymentId, doctorAccessToken);
        if (payment) {
            return { payment, source: 'doctor_getPayment', accessToken: doctorAccessToken };
        }
    }
    if (paymentId && platformToken) {
        const payment = await tryGetPayment(paymentId, platformToken);
        if (payment) {
            return { payment, source: 'platform_getPayment', accessToken: platformToken };
        }
    }
    if (preferenceId) {
        for (const token of [doctorAccessToken, platformToken].filter(Boolean)) {
            try {
                const orders = await mercadopago_api_client_1.MercadoPagoApiClient.searchMerchantOrders(token, {
                    preference_id: preferenceId,
                });
                for (const order of orders.elements || []) {
                    const orderPayments = order.payments || [];
                    const match = (paymentId
                        ? orderPayments.find((p) => String(p.id) === String(paymentId))
                        : undefined) ||
                        orderPayments.find((p) => p.status === 'approved') ||
                        orderPayments[0];
                    if (!(match === null || match === void 0 ? void 0 : match.id))
                        continue;
                    const resolved = (await tryGetPayment(String(match.id), token)) ||
                        { id: match.id, status: match.status };
                    if (paymentId && String(resolved.id) !== String(paymentId))
                        continue;
                    return { payment: resolved, source: 'merchant_order', accessToken: token };
                }
            }
            catch (err) {
                if (!isMpNotFoundError(err)) {
                    logger_utils_1.securityLogger.warn('MP resolve: merchant_orders search failed', {
                        preferenceId,
                        err,
                    });
                }
            }
        }
    }
    if (externalReference) {
        if (doctorAccessToken) {
            try {
                const search = await mercadopago_api_client_1.MercadoPagoApiClient.searchPayments(doctorAccessToken, {
                    external_reference: externalReference,
                });
                const payment = paymentId
                    ? ((_a = search.results) === null || _a === void 0 ? void 0 : _a.find((p) => String(p.id) === String(paymentId))) ||
                        pickBestMpPayment(search.results)
                    : pickBestMpPayment(search.results);
                if (payment) {
                    return { payment, source: 'doctor_search', accessToken: doctorAccessToken };
                }
            }
            catch (err) {
                if (!isMpNotFoundError(err))
                    throw err;
            }
        }
        if (platformToken) {
            try {
                const search = await mercadopago_api_client_1.MercadoPagoApiClient.searchPayments(platformToken, {
                    external_reference: externalReference,
                });
                const payment = paymentId
                    ? ((_b = search.results) === null || _b === void 0 ? void 0 : _b.find((p) => String(p.id) === String(paymentId))) ||
                        pickBestMpPayment(search.results)
                    : pickBestMpPayment(search.results);
                if (payment) {
                    return { payment, source: 'platform_search', accessToken: platformToken };
                }
            }
            catch (err) {
                if (!isMpNotFoundError(err))
                    throw err;
            }
        }
    }
    throw new Error(`Unable to resolve Mercado Pago payment${paymentId ? ` ${paymentId}` : ''} from MP API`);
}
