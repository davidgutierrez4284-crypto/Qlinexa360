"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTrustedDeviceToken = exports.generateTrustedDeviceToken = exports.verifyConsentToken = exports.generateConsentToken = exports.verifyToken = exports.generateTwoFactorToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const normalizeExpiresIn = (value) => value;
const generateToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, { expiresIn: normalizeExpiresIn(env_1.env.JWT_EXPIRES_IN || '24h') });
};
exports.generateToken = generateToken;
const generateTwoFactorToken = (payload, expiresIn = '10m') => {
    return jsonwebtoken_1.default.sign(Object.assign(Object.assign({}, payload), { twoFactorPending: true }), env_1.env.JWT_SECRET, { expiresIn: normalizeExpiresIn(expiresIn) });
};
exports.generateTwoFactorToken = generateTwoFactorToken;
const verifyToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
    }
    catch (error) {
        throw new Error('Token inválido');
    }
};
exports.verifyToken = verifyToken;
/** Token de corta duración para completar consentimientos tras registro (asistente) */
const generateConsentToken = (userId, expiresIn = '10m') => {
    return jsonwebtoken_1.default.sign({ userId, purpose: 'consent' }, env_1.env.JWT_SECRET, { expiresIn: normalizeExpiresIn(expiresIn) });
};
exports.generateConsentToken = generateConsentToken;
const verifyConsentToken = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        if (decoded.purpose !== 'consent')
            throw new Error('Token inválido');
        return { userId: decoded.userId };
    }
    catch (_a) {
        throw new Error('Token de consentimiento inválido o expirado');
    }
};
exports.verifyConsentToken = verifyConsentToken;
/** Token para "recordar dispositivo" - evita pedir 2FA por 30 días en el mismo dispositivo */
const TRUSTED_DEVICE_EXPIRY = '30d';
const generateTrustedDeviceToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId, purpose: 'trustedDevice' }, env_1.env.JWT_SECRET, { expiresIn: TRUSTED_DEVICE_EXPIRY });
};
exports.generateTrustedDeviceToken = generateTrustedDeviceToken;
const verifyTrustedDeviceToken = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        if (decoded.purpose !== 'trustedDevice')
            return null;
        return { userId: decoded.userId };
    }
    catch (_a) {
        return null;
    }
};
exports.verifyTrustedDeviceToken = verifyTrustedDeviceToken;
