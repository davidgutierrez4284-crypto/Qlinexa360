"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mercadoPagoConfig = void 0;
exports.getFrontendBaseUrl = getFrontendBaseUrl;
exports.isMercadoPagoCompatibleReturnUrl = isMercadoPagoCompatibleReturnUrl;
exports.buildTeleconsultationConsentUrl = buildTeleconsultationConsentUrl;
exports.buildConfirmAppointmentUrl = buildConfirmAppointmentUrl;
exports.getMercadoPagoReturnBaseUrl = getMercadoPagoReturnBaseUrl;
const env_1 = require("../../config/env");
exports.mercadoPagoConfig = {
    clientId: env_1.env.MERCADOPAGO_CLIENT_ID,
    clientSecret: env_1.env.MERCADOPAGO_CLIENT_SECRET,
    redirectUri: env_1.env.MERCADOPAGO_REDIRECT_URI,
    webhookSecret: env_1.env.MERCADOPAGO_WEBHOOK_SECRET,
    platformAccessToken: env_1.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN,
    env: env_1.env.MERCADOPAGO_ENV,
    marketplaceFeePercentage: env_1.env.QLINEXA360_MARKETPLACE_FEE_PERCENTAGE,
    apiBaseUrl: 'https://api.mercadopago.com',
    /** México: auth.mercadopago.com.mx (doc Split Payments / OAuth marketplace). */
    authBaseUrl: env_1.env.MERCADOPAGO_AUTH_BASE_URL,
    isConfigured() {
        return !!(this.clientId && this.clientSecret);
    },
};
function getFrontendBaseUrl() {
    const frontendUrl = (env_1.env.FRONTEND_URL || '').replace(/\/$/, '');
    const baseUrl = (env_1.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    if (baseUrl.includes('api.qlinexa360.com')) {
        return 'https://www.qlinexa360.com';
    }
    if (frontendUrl)
        return frontendUrl;
    if (baseUrl.includes('localhost:3000') || baseUrl.includes('127.0.0.1:3000')) {
        return 'http://localhost:5173';
    }
    return 'http://localhost:5173';
}
/** Mercado Pago exige back_urls HTTPS y rechaza localhost (error 400 invalid_back_urls). */
function isMercadoPagoCompatibleReturnUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:')
            return false;
        const host = parsed.hostname.toLowerCase();
        return host !== 'localhost' && host !== '127.0.0.1';
    }
    catch (_a) {
        return false;
    }
}
/** Base URL para back_urls de MP; null si no hay URL pública HTTPS (el checkout sigue funcionando). */
function buildTeleconsultationConsentUrl(confirmationToken) {
    return `${getFrontendBaseUrl()}/teleconsulta/${confirmationToken}`;
}
function buildConfirmAppointmentUrl(confirmationToken) {
    return `${getFrontendBaseUrl()}/confirm-appointment/${confirmationToken}`;
}
function getMercadoPagoReturnBaseUrl() {
    const baseUrl = (env_1.env.BASE_URL || '').replace(/\/$/, '');
    if (baseUrl.includes('api.qlinexa360.com')) {
        return 'https://www.qlinexa360.com';
    }
    const candidates = [env_1.env.FRONTEND_PUBLIC_URL, env_1.env.FRONTEND_URL]
        .map((u) => (u || '').replace(/\/$/, ''))
        .filter(Boolean);
    for (const url of candidates) {
        if (isMercadoPagoCompatibleReturnUrl(url))
            return url;
    }
    return null;
}
