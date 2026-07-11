"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashId = hashId;
exports.hashEmail = hashEmail;
exports.maskIp = maskIp;
const crypto_1 = __importDefault(require("crypto"));
/** Identificador corto irreversible (no reversible a UUID completo sin diccionario). */
function hashId(id) {
    if (!id)
        return '—';
    return crypto_1.default.createHash('sha256').update(id).digest('hex').slice(0, 16);
}
function hashEmail(email) {
    if (!email)
        return null;
    const n = email.trim().toLowerCase();
    return crypto_1.default.createHash('sha256').update(n).digest('hex').slice(0, 24);
}
/** IPv4: a.b.*.* ; IPv6: primer segmento + '::…' */
function maskIp(ip) {
    if (!ip)
        return null;
    const v = ip.replace(/^::ffff:/, '');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
        const p = v.split('.');
        return `${p[0]}.${p[1]}.*.*`;
    }
    const seg = v.split(':')[0];
    return seg ? `${seg}:…` : '*';
}
