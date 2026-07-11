"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DATA_ENCRYPTION_KEY = void 0;
exports.validateProductionSecrets = validateProductionSecrets;
const env_1 = require("./env");
const DEFAULT_DATA_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
exports.DEFAULT_DATA_ENCRYPTION_KEY = DEFAULT_DATA_ENCRYPTION_KEY;
const DEFAULT_JWT_SECRET = 'your-secret-key';
function isValidHexKey(value, byteLength) {
    return value.length === byteLength * 2 && /^[0-9a-f]+$/i.test(value);
}
/**
 * Falla al arrancar en producción si faltan secretos críticos (tokens OAuth MP, JWT, etc.).
 */
function validateProductionSecrets() {
    var _a;
    if (env_1.env.NODE_ENV !== 'production') {
        return;
    }
    const errors = [];
    if (!process.env.DATA_ENCRYPTION_KEY || env_1.env.DATA_ENCRYPTION_KEY === DEFAULT_DATA_ENCRYPTION_KEY) {
        errors.push('DATA_ENCRYPTION_KEY must be set in Secrets Manager (not the default dev key).');
    }
    else if (!isValidHexKey(env_1.env.DATA_ENCRYPTION_KEY, 32)) {
        errors.push('DATA_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes for AES-256).');
    }
    if (!process.env.JWT_SECRET || env_1.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
        errors.push('JWT_SECRET must be set in production.');
    }
    if (env_1.env.MERCADOPAGO_ENV === 'production' && !process.env.MERCADOPAGO_WEBHOOK_SECRET) {
        errors.push('MERCADOPAGO_WEBHOOK_SECRET is required when MERCADOPAGO_ENV=production.');
    }
    if (env_1.env.MERCADOPAGO_ENV === 'production' && !((_a = env_1.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN) === null || _a === void 0 ? void 0 : _a.trim())) {
        errors.push('MERCADOPAGO_PLATFORM_ACCESS_TOKEN is required in production for marketplace refunds (integrator account).');
    }
    if (errors.length > 0) {
        throw new Error(`Production startup validation failed:\n- ${errors.join('\n- ')}`);
    }
}
