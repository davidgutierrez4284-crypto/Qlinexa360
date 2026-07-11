"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAuditEvidenceExports = exports.exportAuditEvidence = void 0;
const database_1 = __importDefault(require("../config/database"));
const error_utils_1 = require("../utils/error.utils");
const auditEvidenceMask_utils_1 = require("../utils/auditEvidenceMask.utils");
const auditEvidence_service_1 = require("../services/auditEvidence.service");
const FORMATS = ['json', 'csv', 'pdf'];
function parseCategories(body) {
    const raw = body === null || body === void 0 ? void 0 : body.categories;
    const arr = Array.isArray(raw) ? raw : auditEvidence_service_1.AUDIT_EVIDENCE_CATEGORIES.slice();
    const set = new Set();
    for (const c of arr) {
        if (typeof c === 'string' && auditEvidence_service_1.AUDIT_EVIDENCE_CATEGORIES.includes(c)) {
            set.add(c);
        }
    }
    if (set.size === 0)
        return [...auditEvidence_service_1.AUDIT_EVIDENCE_CATEGORIES];
    return Array.from(set);
}
const exportAuditEvidence = async (req, res) => {
    var _a, _b, _c;
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            throw new error_utils_1.AppError('Solo administradores pueden exportar evidencias de auditoría.', 403);
        }
        const format = String(((_a = req.body) === null || _a === void 0 ? void 0 : _a.format) || 'json').toLowerCase();
        if (!FORMATS.includes(format)) {
            throw new error_utils_1.AppError('Formato inválido. Use json, csv o pdf.', 400);
        }
        const daysBack = Math.min(365, Math.max(1, parseInt(String((_c = (_b = req.body) === null || _b === void 0 ? void 0 : _b.daysBack) !== null && _c !== void 0 ? _c : 30), 10) || 30));
        const categories = parseCategories(req.body);
        const { data, rowCounts } = await (0, auditEvidence_service_1.buildAnonymizedEvidencePayload)({ daysBack, categories });
        const metaSans = {
            generatedAt: new Date().toISOString(),
            generatedByUserHash: (0, auditEvidenceMask_utils_1.hashId)(req.user.userId),
            environment: (0, auditEvidence_service_1.environmentLabel)(),
            categories,
            daysBack,
            anonymizationVersion: '1.0',
            rowCounts,
        };
        const canonicalPayload = JSON.stringify({
            generatedAt: metaSans.generatedAt,
            categories,
            daysBack,
            rowCounts,
            data,
        });
        const canonicalPayloadSha256 = (0, auditEvidence_service_1.sha256Buffer)(Buffer.from(canonicalPayload, 'utf-8'));
        const meta = Object.assign(Object.assign({}, metaSans), { canonicalPayloadSha256 });
        const payload = { meta, data };
        let buffer;
        let contentType;
        let ext;
        if (format === 'json') {
            buffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
            contentType = 'application/json; charset=utf-8';
            ext = 'json';
        }
        else if (format === 'csv') {
            buffer = Buffer.from((0, auditEvidence_service_1.evidenceToCsv)(payload), 'utf-8');
            contentType = 'text/csv; charset=utf-8';
            ext = 'csv';
        }
        else {
            const html = (0, auditEvidence_service_1.buildEvidencePdfHtml)(meta, data);
            buffer = await (0, auditEvidence_service_1.evidenceHtmlToPdf)(html);
            contentType = 'application/pdf';
            ext = 'pdf';
        }
        const finalHash = (0, auditEvidence_service_1.sha256Buffer)(buffer);
        await database_1.default.adminAuditEvidenceExport.create({
            data: {
                adminUserId: req.user.userId,
                environment: meta.environment,
                format,
                categoriesJson: JSON.stringify(categories),
                daysBack,
                rowCountsJson: JSON.stringify(rowCounts),
                fileSha256: finalHash,
            },
        });
        const fname = `audit-evidence-${meta.environment}-${Date.now()}.${ext}`;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
        res.setHeader('X-Audit-Evidence-Sha256', finalHash);
        res.send(buffer);
    }
    catch (e) {
        const err = e instanceof error_utils_1.AppError ? e : new error_utils_1.AppError((e === null || e === void 0 ? void 0 : e.message) || 'Error al generar evidencia', 500);
        res.status(err.statusCode).json({ message: err.message });
    }
};
exports.exportAuditEvidence = exportAuditEvidence;
const listAuditEvidenceExports = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            throw new error_utils_1.AppError('Solo administradores.', 403);
        }
        const rows = await database_1.default.adminAuditEvidenceExport.findMany({
            take: 100,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                createdAt: true,
                environment: true,
                format: true,
                daysBack: true,
                categoriesJson: true,
                rowCountsJson: true,
                fileSha256: true,
                adminUserId: true,
            },
        });
        res.json({
            exports: rows.map((r) => (Object.assign(Object.assign({}, r), { adminUserId: (0, auditEvidenceMask_utils_1.hashId)(r.adminUserId) }))),
        });
    }
    catch (e) {
        const err = e instanceof error_utils_1.AppError ? e : new error_utils_1.AppError((e === null || e === void 0 ? void 0 : e.message) || 'Error', 500);
        res.status(err.statusCode).json({ message: err.message });
    }
};
exports.listAuditEvidenceExports = listAuditEvidenceExports;
