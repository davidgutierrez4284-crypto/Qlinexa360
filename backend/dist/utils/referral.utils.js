"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeReferralCode = normalizeReferralCode;
exports.referralRegisterBaseUrl = referralRegisterBaseUrl;
exports.generateUniqueReferralCode = generateUniqueReferralCode;
const crypto_1 = __importDefault(require("crypto"));
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function normalizeReferralCode(raw) {
    if (raw == null || typeof raw !== 'string')
        return '';
    return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 32);
}
/**
 * Base URL del SPA para enlaces de registro por referido (WhatsApp, correo, /api/referrals/me).
 * El apex qlinexa360.com suele no tener DNS; el sitio público es https://www.qlinexa360.com
 */
function referralRegisterBaseUrl(frontendUrl) {
    const fallback = 'http://localhost:5173';
    const raw = (frontendUrl || '').trim() || fallback;
    const trimmed = raw.replace(/\/$/, '');
    try {
        const u = new URL(trimmed);
        if (u.hostname.toLowerCase() === 'qlinexa360.com') {
            u.hostname = 'www.qlinexa360.com';
        }
        return u.toString().replace(/\/$/, '');
    }
    catch (_a) {
        return trimmed;
    }
}
async function generateUniqueReferralCode(prisma) {
    for (let attempt = 0; attempt < 30; attempt++) {
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += CODE_CHARS[crypto_1.default.randomInt(0, CODE_CHARS.length)];
        }
        const exists = await prisma.doctor.findFirst({
            where: { referralCode: code },
            select: { id: true },
        });
        if (!exists)
            return code;
    }
    throw new Error('No se pudo generar un código de referido único');
}
