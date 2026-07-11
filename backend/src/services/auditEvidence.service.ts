import crypto from 'crypto';
import https from 'https';
import { URL } from 'url';
import puppeteer from 'puppeteer';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { env } from '../config/env';
import { hashId, maskIp } from '../utils/auditEvidenceMask.utils';

export const AUDIT_EVIDENCE_CATEGORIES = [
  'system_access',
  'clinical_record_access',
  'file_clinical_access',
  'consent_accepted',
  'https_validation',
  'login_events',
  'medical_record_changes',
] as const;

export type AuditEvidenceCategory = (typeof AUDIT_EVIDENCE_CATEGORIES)[number];

export function environmentLabel(): string {
  if (env.NODE_ENV === 'production') return 'production';
  if (env.NODE_ENV === 'staging') return 'staging';
  return 'development';
}

async function probeHttps(urlStr: string): Promise<Record<string, unknown>> {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:') {
      return {
        checkedUrl: urlStr,
        tlsActive: false,
        note: 'La URL configurada no usa esquema https:// (típico en staging local).',
      };
    }
    return await new Promise((resolve) => {
      const req = https.request(
        {
          hostname: u.hostname,
          port: u.port || 443,
          path: u.pathname || '/',
          method: 'HEAD',
          rejectUnauthorized: true,
          timeout: 10000,
          servername: u.hostname,
        },
        (res) => {
          const sock = res.socket as { getProtocol?: () => string } | null;
          const tlsProtocol = sock?.getProtocol?.() || undefined;
          resolve({
            checkedUrl: urlStr,
            tlsActive: true,
            statusCode: res.statusCode,
            tlsProtocol: tlsProtocol || 'TLS',
          });
          res.resume();
        }
      );
      req.on('error', () =>
        resolve({ checkedUrl: urlStr, tlsActive: false, error: 'CONNECTION_OR_TLS_ERROR' })
      );
      req.on('timeout', () => {
        req.destroy();
        resolve({ checkedUrl: urlStr, tlsActive: false, error: 'TIMEOUT' });
      });
      req.end();
    });
  } catch {
    return { checkedUrl: urlStr, tlsActive: false, error: 'INVALID_URL' };
  }
}

export async function buildAnonymizedEvidencePayload(params: {
  daysBack: number;
  categories: AuditEvidenceCategory[];
}): Promise<{ data: Record<string, unknown>; rowCounts: Record<string, number> }> {
  const since = new Date();
  since.setDate(since.getDate() - Math.min(Math.max(params.daysBack, 1), 365));
  const { categories } = params;
  const data: Record<string, unknown> = {};
  const rowCounts: Record<string, number> = {};

  if (categories.includes('system_access')) {
    const rows = await prisma.accessLog.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take: 5000,
    });
    data.system_access = rows.map((r) => ({
      id: hashId(r.id),
      userId: hashId(r.userId),
      patientId: hashId(r.patientId),
      moduleAccessed: r.moduleAccessed,
      timestamp: r.timestamp.toISOString(),
      userIp: maskIp(r.userIp),
    }));
    rowCounts.system_access = rows.length;
  }

  if (categories.includes('clinical_record_access')) {
    const rows = await prisma.accessLog.findMany({
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
      id: hashId(r.id),
      userId: hashId(r.userId),
      patientId: hashId(r.patientId),
      moduleAccessed: r.moduleAccessed,
      timestamp: r.timestamp.toISOString(),
      userIp: maskIp(r.userIp),
    }));
    rowCounts.clinical_record_access = rows.length;
  }

  if (categories.includes('file_clinical_access')) {
    const rows = await prisma.fileAccessLog.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take: 5000,
      include: {
        file: { select: { id: true, category: true, medicalRecordId: true } },
      },
    });
    data.file_clinical_access = rows.map((r) => ({
      id: hashId(r.id),
      fileId: hashId(r.fileId),
      userId: hashId(r.userId),
      action: r.action,
      timestamp: r.timestamp.toISOString(),
      ip: maskIp(r.ip),
      userAgent: r.userAgent ? r.userAgent.slice(0, 80) + '…' : null,
      fileCategory: r.file?.category ?? null,
      medicalRecordId: r.file?.medicalRecordId ? hashId(r.file.medicalRecordId) : null,
    }));
    rowCounts.file_clinical_access = rows.length;
  }

  if (categories.includes('consent_accepted')) {
    const rows = await prisma.consentHistory.findMany({
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
      id: hashId(r.id),
      userId: hashId(r.userId),
      type: r.type,
      version: r.version,
      acceptedAt: r.acceptedAt.toISOString(),
      pdfStored: r.pdfUrl ? 'yes_redacted' : 'no',
    }));
    rowCounts.consent_accepted = rows.length;
  }

  if (categories.includes('https_validation')) {
    const checkUrl =
      env.AUDIT_EVIDENCE_HTTPS_URL || env.FRONTEND_URL || 'https://localhost';
    const probe = await probeHttps(checkUrl.startsWith('http') ? checkUrl : `https://${checkUrl}`);
    data.https_validation = { ...probe, probedAt: new Date().toISOString() };
    rowCounts.https_validation = 1;
  }

  if (categories.includes('login_events')) {
    const rows = await prisma.securityLoginAudit.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
    data.login_events = rows.map((r) => ({
      id: hashId(r.id),
      userId: r.userId ? hashId(r.userId) : null,
      emailHash: r.emailHash,
      success: r.success,
      ipMasked: r.ipMasked,
      userAgent: r.userAgent ? r.userAgent.slice(0, 80) + '…' : null,
      createdAt: r.createdAt.toISOString(),
    }));
    rowCounts.login_events = rows.length;
  }

  if (categories.includes('medical_record_changes')) {
    const rows = await prisma.$queryRaw<
      { id: string; patientId: string; userId: string; createdAt: Date; updatedAt: Date; isEditable: boolean }[]
    >(Prisma.sql`
      SELECT id, "patientId", "userId", "createdAt", "updatedAt", "isEditable"
      FROM "MedicalRecord"
      WHERE "updatedAt" > "createdAt" + interval '1 millisecond'
        AND "updatedAt" >= ${since}
      ORDER BY "updatedAt" DESC
      LIMIT 2000
    `);
    data.medical_record_changes = rows.map((r) => ({
      id: hashId(r.id),
      patientId: hashId(r.patientId),
      userId: hashId(r.userId),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      isEditable: r.isEditable,
    }));
    rowCounts.medical_record_changes = rows.length;
  }

  return { data, rowCounts };
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export function evidenceToCsv(payload: { meta: Record<string, unknown>; data: Record<string, unknown> }): string {
  const lines = ['\ufeffsection,payload_json'];
  lines.push(`meta,${csvEscape(JSON.stringify(payload.meta))}`);
  for (const [k, v] of Object.entries(payload.data)) {
    lines.push(`${csvEscape(k)},${csvEscape(JSON.stringify(v))}`);
  }
  return lines.join('\n');
}

export async function evidenceHtmlToPdf(html: string): Promise<Buffer> {
  let browser;
  try {
    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
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
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
      printBackground: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) await browser.close();
  }
}

export function buildEvidencePdfHtml(meta: Record<string, unknown>, data: Record<string, unknown>): string {
  const esc = (s: unknown) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const sections = Object.entries(data)
    .map(
      ([key, val]) =>
        `<h2>${esc(key)}</h2><pre style="font-size:9px;white-space:pre-wrap;">${esc(
          JSON.stringify(val, null, 2)
        )}</pre>`
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Evidencia auditoría</title></head><body style="font-family:Arial,sans-serif">
<h1>Evidencia de producción (anonimizada)</h1>
<pre style="font-size:11px;background:#f5f5f5;padding:12px;">${esc(JSON.stringify(meta, null, 2))}</pre>
${sections}
<p style="font-size:10px;color:#666;">Qlinexa360 — HU-01. Sin datos clínicos ni identificadores reversibles.</p>
</body></html>`;
}

export function sha256Buffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
