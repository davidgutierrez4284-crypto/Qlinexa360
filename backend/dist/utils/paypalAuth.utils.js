"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPayPalApiBaseUrl = getPayPalApiBaseUrl;
exports.getPayPalAccessToken = getPayPalAccessToken;
const axios_1 = __importDefault(require("axios"));
function getPayPalApiBaseUrl() {
    const isSandbox = process.env.PAYPAL_ENVIRONMENT === 'sandbox' || !process.env.PAYPAL_ENVIRONMENT;
    return isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}
async function getPayPalAccessToken() {
    var _a, _b;
    try {
        const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim();
        const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
        const baseUrl = getPayPalApiBaseUrl();
        if (!clientId || !clientSecret) {
            console.error('PayPal credentials not configured (clientId:', !!clientId, ', clientSecret:', !!clientSecret, ')');
            return null;
        }
        const response = await axios_1.default.post(`${baseUrl}/v1/oauth2/token`, 'grant_type=client_credentials', {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            auth: {
                username: clientId,
                password: clientSecret,
            },
        });
        return response.data.access_token;
    }
    catch (error) {
        const paypalError = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data;
        const status = (_b = error.response) === null || _b === void 0 ? void 0 : _b.status;
        console.error('Error obteniendo token de PayPal:', {
            status,
            error: (paypalError === null || paypalError === void 0 ? void 0 : paypalError.error) || (paypalError === null || paypalError === void 0 ? void 0 : paypalError.error_description) || error.message,
        });
        return null;
    }
}
