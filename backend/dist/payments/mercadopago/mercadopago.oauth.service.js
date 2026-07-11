"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoOAuthService = void 0;
exports.parseEncryptedToken = parseEncryptedToken;
exports.serializeEncryptedToken = serializeEncryptedToken;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../../config/database"));
const env_1 = require("../../config/env");
const encryption_utils_1 = require("../../utils/encryption.utils");
const mercadopago_api_client_1 = require("./mercadopago.api.client");
const mercadopago_config_1 = require("./mercadopago.config");
function serializeEncryptedToken(token) {
    return JSON.stringify((0, encryption_utils_1.encrypt)(token));
}
function parseEncryptedToken(stored) {
    return (0, encryption_utils_1.decrypt)(JSON.parse(stored));
}
class MercadoPagoOAuthService {
    static createState(doctorId) {
        const payload = { doctorId, nonce: crypto_1.default.randomBytes(16).toString('hex') };
        return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, { expiresIn: '15m' });
    }
    static verifyState(state) {
        return jsonwebtoken_1.default.verify(state, env_1.env.JWT_SECRET);
    }
    static getConnectUrl(doctorId) {
        const state = this.createState(doctorId);
        const params = new URLSearchParams({
            client_id: mercadopago_config_1.mercadoPagoConfig.clientId,
            response_type: 'code',
            platform_id: 'mp',
            redirect_uri: mercadopago_config_1.mercadoPagoConfig.redirectUri,
            state,
        });
        return `${mercadopago_config_1.mercadoPagoConfig.authBaseUrl}/authorization?${params.toString()}`;
    }
    static async handleCallback(code, state) {
        const { doctorId } = this.verifyState(state);
        const tokenData = await mercadopago_api_client_1.MercadoPagoApiClient.exchangeAuthorizationCode(code);
        const expiresAt = tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null;
        await database_1.default.paymentProviderConnection.upsert({
            where: { doctorId_provider: { doctorId, provider: 'mercadopago' } },
            create: {
                doctorId,
                provider: 'mercadopago',
                providerUserId: tokenData.user_id != null ? String(tokenData.user_id) : null,
                accessTokenEncrypted: serializeEncryptedToken(tokenData.access_token),
                refreshTokenEncrypted: tokenData.refresh_token
                    ? serializeEncryptedToken(tokenData.refresh_token)
                    : null,
                tokenExpiresAt: expiresAt,
                publicKey: tokenData.public_key || null,
                status: 'active',
                lastConnectionAt: new Date(),
                disconnectedAt: null,
            },
            update: {
                providerUserId: tokenData.user_id != null ? String(tokenData.user_id) : null,
                accessTokenEncrypted: serializeEncryptedToken(tokenData.access_token),
                refreshTokenEncrypted: tokenData.refresh_token
                    ? serializeEncryptedToken(tokenData.refresh_token)
                    : null,
                tokenExpiresAt: expiresAt,
                publicKey: tokenData.public_key || null,
                status: 'active',
                lastConnectionAt: new Date(),
                disconnectedAt: null,
            },
        });
        return doctorId;
    }
    static async disconnect(doctorId) {
        await database_1.default.paymentProviderConnection.updateMany({
            where: { doctorId, provider: 'mercadopago' },
            data: { status: 'disconnected', disconnectedAt: new Date() },
        });
    }
    static async getConnectionStatus(doctorId) {
        const conn = await database_1.default.paymentProviderConnection.findUnique({
            where: { doctorId_provider: { doctorId, provider: 'mercadopago' } },
            select: {
                status: true,
                providerUserId: true,
                accountEmail: true,
                lastConnectionAt: true,
                disconnectedAt: true,
                tokenExpiresAt: true,
            },
        });
        return {
            connected: (conn === null || conn === void 0 ? void 0 : conn.status) === 'active',
            status: (conn === null || conn === void 0 ? void 0 : conn.status) || 'disconnected',
            providerUserId: (conn === null || conn === void 0 ? void 0 : conn.providerUserId) || null,
            accountEmail: (conn === null || conn === void 0 ? void 0 : conn.accountEmail) || null,
            lastConnectionAt: (conn === null || conn === void 0 ? void 0 : conn.lastConnectionAt) || null,
        };
    }
    static async getValidAccessToken(doctorId) {
        const conn = await database_1.default.paymentProviderConnection.findUnique({
            where: { doctorId_provider: { doctorId, provider: 'mercadopago' } },
        });
        if (!conn || conn.status !== 'active') {
            throw new Error('Mercado Pago no conectado para este doctor');
        }
        const accessToken = parseEncryptedToken(conn.accessTokenEncrypted);
        const needsRefresh = conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000;
        if (!needsRefresh || !conn.refreshTokenEncrypted) {
            return accessToken;
        }
        const refreshToken = parseEncryptedToken(conn.refreshTokenEncrypted);
        const refreshed = await mercadopago_api_client_1.MercadoPagoApiClient.refreshAccessToken(refreshToken);
        const expiresAt = refreshed.expires_in
            ? new Date(Date.now() + refreshed.expires_in * 1000)
            : conn.tokenExpiresAt;
        await database_1.default.paymentProviderConnection.update({
            where: { id: conn.id },
            data: {
                accessTokenEncrypted: serializeEncryptedToken(refreshed.access_token),
                refreshTokenEncrypted: refreshed.refresh_token
                    ? serializeEncryptedToken(refreshed.refresh_token)
                    : conn.refreshTokenEncrypted,
                tokenExpiresAt: expiresAt,
            },
        });
        return refreshed.access_token;
    }
}
exports.MercadoPagoOAuthService = MercadoPagoOAuthService;
