"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAffiliateAudit = recordAffiliateAudit;
const database_1 = __importDefault(require("../config/database"));
/**
 * Registro de audit trail del módulo de afiliados.
 * Fire-and-forget: nunca debe romper el flujo principal (try/catch + warn).
 */
async function recordAffiliateAudit(params) {
    var _a, _b, _c, _d;
    try {
        await database_1.default.affiliateAuditLog.create({
            data: {
                actorUserId: (_a = params.actorUserId) !== null && _a !== void 0 ? _a : null,
                action: params.action,
                targetType: (_b = params.targetType) !== null && _b !== void 0 ? _b : null,
                targetId: (_c = params.targetId) !== null && _c !== void 0 ? _c : null,
                metadata: ((_d = params.metadata) !== null && _d !== void 0 ? _d : undefined)
            }
        });
    }
    catch (e) {
        console.warn('[AffiliateAudit] no se pudo registrar:', e);
    }
}
