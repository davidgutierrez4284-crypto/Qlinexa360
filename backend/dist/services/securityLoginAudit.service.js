"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordSecurityLoginAudit = recordSecurityLoginAudit;
const database_1 = __importDefault(require("../config/database"));
const auditEvidenceMask_utils_1 = require("../utils/auditEvidenceMask.utils");
async function recordSecurityLoginAudit(params) {
    try {
        await database_1.default.securityLoginAudit.create({
            data: {
                userId: params.userId || null,
                emailHash: (0, auditEvidenceMask_utils_1.hashEmail)(params.email || undefined),
                success: params.success,
                ipMasked: (0, auditEvidenceMask_utils_1.maskIp)(params.ip || undefined),
                userAgent: params.userAgent ? params.userAgent.slice(0, 500) : null,
            },
        });
    }
    catch (e) {
        console.warn('[SecurityLoginAudit] no se pudo registrar:', e);
    }
}
