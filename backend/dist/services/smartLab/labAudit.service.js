"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordLabAudit = recordLabAudit;
exports.recordLabAuditFireAndForget = recordLabAuditFireAndForget;
const database_1 = __importDefault(require("../../config/database"));
async function recordLabAudit(params) {
    var _a, _b, _c, _d;
    try {
        await database_1.default.labAuditLog.create({
            data: {
                actorUserId: (_a = params.actorUserId) !== null && _a !== void 0 ? _a : null,
                patientId: (_b = params.patientId) !== null && _b !== void 0 ? _b : null,
                labReportId: (_c = params.labReportId) !== null && _c !== void 0 ? _c : null,
                action: params.action,
                metadata: ((_d = params.metadata) !== null && _d !== void 0 ? _d : undefined),
            },
        });
    }
    catch (e) {
        console.warn('[LabAudit] no se pudo registrar:', e);
    }
}
function recordLabAuditFireAndForget(params) {
    void recordLabAudit(params);
}
