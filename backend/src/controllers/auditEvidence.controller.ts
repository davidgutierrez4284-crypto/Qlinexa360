import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error.utils';
import { hashId } from '../utils/auditEvidenceMask.utils';
import {
  AUDIT_EVIDENCE_CATEGORIES,
  AuditEvidenceCategory,
  buildAnonymizedEvidencePayload,
  buildEvidencePdfHtml,
  environmentLabel,
  evidenceHtmlToPdf,
  evidenceToCsv,
  sha256Buffer,
} from '../services/auditEvidence.service';

const FORMATS = ['json', 'csv', 'pdf'] as const;
type ExportFormat = (typeof FORMATS)[number];

function parseCategories(body: unknown): AuditEvidenceCategory[] {
  const raw = (body as { categories?: unknown })?.categories;
  const arr = Array.isArray(raw) ? raw : AUDIT_EVIDENCE_CATEGORIES.slice();
  const set = new Set<string>();
  for (const c of arr) {
    if (typeof c === 'string' && (AUDIT_EVIDENCE_CATEGORIES as readonly string[]).includes(c)) {
      set.add(c);
    }
  }
  if (set.size === 0) return [...AUDIT_EVIDENCE_CATEGORIES];
  return Array.from(set) as AuditEvidenceCategory[];
}

export const exportAuditEvidence = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Solo administradores pueden exportar evidencias de auditoría.', 403);
    }

    const format = String((req.body as { format?: string })?.format || 'json').toLowerCase() as ExportFormat;
    if (!FORMATS.includes(format)) {
      throw new AppError('Formato inválido. Use json, csv o pdf.', 400);
    }

    const daysBack = Math.min(
      365,
      Math.max(1, parseInt(String((req.body as { daysBack?: unknown })?.daysBack ?? 30), 10) || 30)
    );
    const categories = parseCategories(req.body);

    const { data, rowCounts } = await buildAnonymizedEvidencePayload({ daysBack, categories });

    const metaSans = {
      generatedAt: new Date().toISOString(),
      generatedByUserHash: hashId(req.user.userId),
      environment: environmentLabel(),
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
    const canonicalPayloadSha256 = sha256Buffer(Buffer.from(canonicalPayload, 'utf-8'));
    const meta = { ...metaSans, canonicalPayloadSha256 };
    const payload = { meta, data };

    let buffer: Buffer;
    let contentType: string;
    let ext: string;

    if (format === 'json') {
      buffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
      contentType = 'application/json; charset=utf-8';
      ext = 'json';
    } else if (format === 'csv') {
      buffer = Buffer.from(evidenceToCsv(payload), 'utf-8');
      contentType = 'text/csv; charset=utf-8';
      ext = 'csv';
    } else {
      const html = buildEvidencePdfHtml(meta, data);
      buffer = await evidenceHtmlToPdf(html);
      contentType = 'application/pdf';
      ext = 'pdf';
    }

    const finalHash = sha256Buffer(buffer);

    await prisma.adminAuditEvidenceExport.create({
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
  } catch (e: unknown) {
    const err = e instanceof AppError ? e : new AppError((e as Error)?.message || 'Error al generar evidencia', 500);
    res.status(err.statusCode).json({ message: err.message });
  }
};

export const listAuditEvidenceExports = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('Solo administradores.', 403);
    }
    const rows = await prisma.adminAuditEvidenceExport.findMany({
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
      exports: rows.map((r) => ({
        ...r,
        adminUserId: hashId(r.adminUserId),
      })),
    });
  } catch (e: unknown) {
    const err = e instanceof AppError ? e : new AppError((e as Error)?.message || 'Error', 500);
    res.status(err.statusCode).json({ message: err.message });
  }
};
