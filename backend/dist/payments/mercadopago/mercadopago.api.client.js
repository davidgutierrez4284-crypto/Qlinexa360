"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const mercadopago_config_1 = require("./mercadopago.config");
class MercadoPagoApiClient {
    static async exchangeAuthorizationCode(code) {
        const { data } = await axios_1.default.post(`${mercadopago_config_1.mercadoPagoConfig.apiBaseUrl}/oauth/token`, {
            client_id: mercadopago_config_1.mercadoPagoConfig.clientId,
            client_secret: mercadopago_config_1.mercadoPagoConfig.clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: mercadopago_config_1.mercadoPagoConfig.redirectUri,
        }, { headers: { 'Content-Type': 'application/json' } });
        return data;
    }
    static async refreshAccessToken(refreshToken) {
        const { data } = await axios_1.default.post(`${mercadopago_config_1.mercadoPagoConfig.apiBaseUrl}/oauth/token`, {
            client_id: mercadopago_config_1.mercadoPagoConfig.clientId,
            client_secret: mercadopago_config_1.mercadoPagoConfig.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }, { headers: { 'Content-Type': 'application/json' } });
        return data;
    }
    static async createPreference(accessToken, payload) {
        var _a, _b, _c;
        try {
            const { data } = await axios_1.default.post(`${mercadopago_config_1.mercadoPagoConfig.apiBaseUrl}/checkout/preferences`, payload, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } });
            return data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                const mpBody = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data;
                const mpMessage = mpBody && typeof mpBody === 'object' && 'message' in mpBody
                    ? String(mpBody.message)
                    : error.message;
                const detail = mpBody ? JSON.stringify(mpBody) : mpMessage;
                throw new Error(`Mercado Pago createPreference ${(_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.status) !== null && _c !== void 0 ? _c : 'error'}: ${detail}`);
            }
            throw error;
        }
    }
    static async getPayment(accessToken, paymentId) {
        const { data } = await axios_1.default.get(`${mercadopago_config_1.mercadoPagoConfig.apiBaseUrl}/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        return data;
    }
    static async searchPayments(accessToken, filters) {
        const params = new URLSearchParams({
            sort: 'date_created',
            criteria: 'desc',
            range: 'date_created',
            begin_date: 'NOW-30DAYS',
            end_date: 'NOW',
        });
        if (filters.external_reference)
            params.set('external_reference', filters.external_reference);
        const { data } = await axios_1.default.get(`${mercadopago_config_1.mercadoPagoConfig.apiBaseUrl}/v1/payments/search?${params}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        return data;
    }
    static async getMerchantOrder(accessToken, merchantOrderId) {
        const { data } = await axios_1.default.get(`${mercadopago_config_1.mercadoPagoConfig.apiBaseUrl}/merchant_orders/${merchantOrderId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        return data;
    }
    static async searchMerchantOrders(accessToken, filters) {
        const params = new URLSearchParams();
        if (filters.preference_id)
            params.set('preference_id', filters.preference_id);
        if (filters.external_reference)
            params.set('external_reference', filters.external_reference);
        const { data } = await axios_1.default.get(`${mercadopago_config_1.mercadoPagoConfig.apiBaseUrl}/merchant_orders/search?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        return data;
    }
    static async createRefund(accessToken, paymentId, options) {
        var _a, _b, _c;
        const headers = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };
        if (options === null || options === void 0 ? void 0 : options.idempotencyKey) {
            headers['X-Idempotency-Key'] = options.idempotencyKey;
        }
        const body = (options === null || options === void 0 ? void 0 : options.amount) != null ? { amount: options.amount } : undefined;
        try {
            const { data } = await axios_1.default.post(`${mercadopago_config_1.mercadoPagoConfig.apiBaseUrl}/v1/payments/${paymentId}/refunds`, body, { headers });
            return data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                const mpBody = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data;
                const detail = mpBody ? JSON.stringify(mpBody) : error.message;
                throw new Error(`Mercado Pago createRefund ${(_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.status) !== null && _c !== void 0 ? _c : 'error'}: ${detail}`);
            }
            throw error;
        }
    }
}
exports.MercadoPagoApiClient = MercadoPagoApiClient;
