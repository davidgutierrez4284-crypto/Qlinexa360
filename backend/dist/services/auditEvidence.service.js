"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUDIT_EVIDENCE_CATEGORIES = void 0;
exports.environmentLabel = environmentLabel;
exports.buildAnonymizedEvidencePayload = buildAnonymizedEvidencePayload;
exports.evidenceToCsv = evidenceToCsv;
exports.evidenceHtmlToPdf = evidenceHtmlToPdf;
exports.buildEvidencePdfHtml = buildEvidencePdfHtml;
exports.sha256Buffer = sha256Buffer;
const crypto_1 = __importDefault(require("crypto"));
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
const puppeteer_1 = __importDefault(require("puppeteer"));
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../config/database"));
const env_1 = require("../config/env");
const auditEvidenceMask_utils_1 = require("../utils/auditEvidenceMask.utils");
exports.AUDIT_EVIDENCE_CATEGORIES = [
    'system_access',
    'clinical_record_access',
    'file_clinical_access',
    'consent_accepted',
    'https_validation',
    'login_events',
    'medical_record_changes',
];
function environmentLabel() {
    if (env_1.env.NODE_ENV === 'production')
        return 'production';
    if (env_1.env.NODE_ENV === 'staging')
        return 'staging';
    return 'development';
}
async function probeHttps(urlStr) {
    try {
        const u = new url_1.URL(urlStr);
        if (u.protocol !== 'https:') {
            return {
                checkedUrl: urlStr,
                tlsActive: false,
                note: 'La URL configurada no usa esquema https:// (típico en staging local).',
            };
        }
        return await new Promise((resolve) => {
            const req = https_1.default.request({
                hostname: u.hostname,
                port: u.port || 443,
                path: u.pathname || '/',
                method: 'HEAD',
                rejectUnauthorized: true,
                timeout: 10000,
                servername: u.hostname,
            }, (res) => {
                var _a;
                const sock = res.socket;
                const tlsProtocol = ((_a = sock === null || sock === void 0 ? void 0 : sock.getProtocol) === null || _a === void 0 ? void 0 : _a.call(sock)) || undefined;
                resolve({
                    checkedUrl: urlStr,
                    tlsActive: true,
                    statusCode: res.statusCode,
                    tlsProtocol: tlsProtocol || 'TLS',
                });
                res.resume();
            });
            req.on('error', () => resolve({ checkedUrl: urlStr, tlsActive: false, error: 'CONNECTION_OR_TLS_ERROR' }));
            req.on('timeout', () => {
                req.destroy();
                resolve({ checkedUrl: urlStr, tlsActive: false, error: 'TIMEOUT' });
            });
            req.end();
        });
    }
    catch (_a) {
        return { checkedUrl: urlStr, tlsActive: false, error: 'INVALID_URL' };
    }
}
async function buildAnonymizedEvidencePayload(params) {
    const since = new Date();
    since.setDate(since.getDate() - Math.min(Math.max(params.daysBack, 1), 365));
    const { categories } = params;
    const data = {};
    const rowCounts = {};
    if (categories.includes('system_access')) {
        const rows = await database_1.default.accessLog.findMany({
            where: { timestamp: { gte: since } },
            orderBy: { timestamp: 'desc' },
            take: 5000,
        });
        data.system_access = rows.map((r) => ({
            id: (0, auditEvidenceMask_utils_1.hashId)(r.id),
            userId: (0, auditEvidenceMask_utils_1.hashId)(r.userId),
            patientId: (0, auditEvidenceMask_utils_1.hashId)(r.patientId),
            moduleAccessed: r.moduleAccessed,
            timestamp: r.timestamp.toISOString(),
            userIp: (0, auditEvidenceMask_utils_1.maskIp)(r.userIp),
        }));
        rowCounts.system_access = rows.length;
    }
    if (categories.includes('clinical_record_access')) {
        const rows = await database_1.default.accessLog.findMany({
            where: {
                timestamp: { gte: since },
                OR: [
                    { moduleAccessed: { contains: 'medical', mode: 'insensitive' } },
                    { moduleAccessed: { contains: 'clinic', mode: 'insensitive' } },
                    { moduleAccessed: { contains: 'record', mode: 'insensitive' } },
                    { moduleAccessed: { contains: 'historial', mode: 'insensitive' } },
                ],
            },
            orderBy: { timestamp: 'desc' },
            take: 5000,
        });
        data.clinical_record_access = rows.map((r) => ({
            id: (0, auditEvidenceMask_utils_1.hashId)(r.id),
            userId: (0, auditEvidenceMask_utils_1.hashId)(r.userId),
            patientId: (0, auditEvidenceMask_utils_1.hashId)(r.patientId),
            moduleAccessed: r.moduleAccessed,
            timestamp: r.timestamp.toISOString(),
            userIp: (0, auditEvidenceMask_utils_1.maskIp)(r.userIp),
        }));
        rowCounts.clinical_record_access = rows.length;
    }
    if (categories.includes('file_clinical_access')) {
        const rows = await database_1.default.fileAccessLog.findMany({
            where: { timestamp: { gte: since } },
            orderBy: { timestamp: 'desc' },
            take: 5000,
            include: {
                file: { select: { id: true, category: true, medicalRecordId: true } },
            },
        });
        data.file_clinical_access = rows.map((r) => {
            var _a, _b, _c;
            return ({
                id: (0, auditEvidenceMask_utils_1.hashId)(r.id),
                fileId: (0, auditEvidenceMask_utils_1.hashId)(r.fileId),
                userId: (0, auditEvidenceMask_utils_1.hashId)(r.userId),
                action: r.action,
                timestamp: r.timestamp.toISOString(),
                ip: (0, auditEvidenceMask_utils_1.maskIp)(r.ip),
                userAgent: r.userAgent ? r.userAgent.slice(0, 80) + '…' : null,
                fileCategory: (_b = (_a = r.file) === null || _a === void 0 ? void 0 : _a.category) !== null && _b !== void 0 ? _b : null,
                medicalRecordId: ((_c = r.file) === null || _c === void 0 ? void 0 : _c.medicalRecordId) ? (0, auditEvidenceMask_utils_1.hashId)(r.file.medicalRecordId) : null,
            });
        });
        rowCounts.file_clinical_access = rows.length;
    }
    if (categories.includes('consent_accepted')) {
        const rows = await database_1.default.consentHistory.findMany({
            where: { acceptedAt: { gte: since } },
            orderBy: { acceptedAt: 'desc' },
            take: 5000,
            select: {
                id: true,
                userId: true,
                type: true,
                version: true,
                acceptedAt: true,
                pdfUrl: true,
            },
        });
        data.consent_accepted = rows.map((r) => ({
            id: (0, auditEvidenceMask_utils_1.hashId)(r.id),
            userId: (0, auditEvidenceMask_utils_1.hashId)(r.userId),
            type: r.type,
            version: r.version,
            acceptedAt: r.acceptedAt.toISOString(),
            pdfStored: r.pdfUrl ? 'yes_redacted' : 'no',
        }));
        rowCounts.consent_accepted = rows.length;
    }
    if (categories.includes('https_validation')) {
        const checkUrl = env_1.env.AUDIT_EVIDENCE_HTTPS_URL || env_1.env.FRONTEND_URL || 'https://localhost';
        const probe = await probeHttps(checkUrl.startsWith('http') ? checkUrl : `https://${checkUrl}`);
        data.https_validation = Object.assign(Object.assign({}, probe), { probedAt: new Date().toISOString() });
        rowCounts.https_validation = 1;
    }
    if (categories.includes('login_events')) {
        const rows = await database_1.default.securityLoginAudit.findMany({
            where: { createdAt: { gte: since } },
            orderBy: { createdAt: 'desc' },
            take: 10000,
        });
        data.login_events = rows.map((r) => ({
            id: (0, auditEvidenceMask_utils_1.hashId)(r.id),
            userId: r.userId ? (0, auditEvidenceMask_utils_1.hashId)(r.userId) : null,
            emailHash: r.emailHash,
            success: r.success,
            ipMasked: r.ipMasked,
            userAgent: r.userAgent ? r.userAgent.slice(0, 80) + '…' : null,
            createdAt: r.createdAt.toISOString(),
        }));
        rowCounts.login_events = rows.length;
    }
    if (categories.includes('medical_record_changes')) {
        const rows = await database_1.default.$queryRaw(client_1.Prisma.sql `
      SELECT id, "patientId", "userId", "createdAt", "updatedAt", "isEditable"
      FROM "MedicalRecord"
      WHERE "updatedAt" > "createdAt" + interval '1 millisecond'
        AND "updatedAt" >= ${since}
      ORDER BY "updatedAt" DESC
      LIMIT 2000
    `);
        data.medical_record_changes = rows.map((r) => ({
            id: (0, auditEvidenceMask_utils_1.hashId)(r.id),
            patientId: (0, auditEvidenceMask_utils_1.hashId)(r.patientId),
            userId: (0, auditEvidenceMask_utils_1.hashId)(r.userId),
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            isEditable: r.isEditable,
        }));
        rowCounts.medical_record_changes = rows.length;
    }
    return { data, rowCounts };
}
function csvEscape(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
}
function evidenceToCsv(payload) {
    const lines = ['\ufeffsection,payload_json'];
    lines.push(`meta,${csvEscape(JSON.stringify(payload.meta))}`);
    for (const [k, v] of Object.entries(payload.data)) {
        lines.push(`${csvEscape(k)},${csvEscape(JSON.stringify(v))}`);
    }
    return lines.join('\n');
}
async function evidenceHtmlToPdf(html) {
    let browser;
    try {
        const launchOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
            ],
        };
        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }
        browser = await puppeteer_1.default.launch(launchOptions);
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
            printBackground: true,
        });
        return Buffer.from(pdfBuffer);
    }
    finally {
        if (browser)
            await browser.close();
    }
}
function buildEvidencePdfHtml(meta, data) {
    const esc = (s) => String(s !== null && s !== void 0 ? s : '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const sections = Object.entries(data)
        .map(([key, val]) => `<h2>${esc(key)}</h2><pre style="font-size:9px;white-space:pre-wrap;">${esc(JSON.stringify(val, null, 2))}</pre>`)
        .join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Evidencia auditoría</title></head><body style="font-family:Arial,sans-serif">
<h1>Evidencia de producción (anonimizada)</h1>
<pre style="font-size:11px;background:#f5f5f5;padding:12px;">${esc(JSON.stringify(meta, null, 2))}</pre>
${sections}
<p style="font-size:10px;color:#666;">Qlinexa360 — HU-01. Sin datos clínicos ni identificadores reversibles.</p>
</body></html>`;
}
function sha256Buffer(buf) {
    return crypto_1.default.createHash('sha256').update(buf).digest('hex');
}
