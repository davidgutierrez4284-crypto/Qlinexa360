import prisma from '../../config/database';
import { AppError } from '../../utils/error.utils';
import { LAB_ERRORS } from '../../constants/lab.constants';

export type CatalogUpsertInput = {
  category?: string;
  name?: string;
  aliasesJson?: unknown;
  loincCode?: string | null;
  allowedUnitsJson?: unknown;
  defaultUnit?: string | null;
  defaultReferenceLow?: number | null;
  defaultReferenceHigh?: number | null;
  referenceNotes?: string | null;
  sexSpecific?: boolean;
  ageSpecific?: boolean;
  active?: boolean;
};

export async function listAnalyteCatalog(options: { activeOnly?: boolean; category?: string } = {}) {
  const { activeOnly = true, category } = options;
  const where: { active?: boolean; category?: string } = {};
  if (activeOnly) where.active = true;
  if (category?.trim()) where.category = category.trim();

  const items = await prisma.labAnalyteCatalog.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return items;
}

export async function createAnalyteCatalogEntry(input: CatalogUpsertInput) {
  const category = String(input.category || '').trim();
  const name = String(input.name || '').trim();
  if (!category || !name) throw new AppError('category y name son requeridos', 400);

  const entry = await prisma.labAnalyteCatalog.create({
    data: {
      category,
      name,
      aliasesJson: Array.isArray(input.aliasesJson) ? input.aliasesJson : [],
      loincCode: input.loincCode ?? null,
      allowedUnitsJson: Array.isArray(input.allowedUnitsJson) ? input.allowedUnitsJson : [],
      defaultUnit: input.defaultUnit ?? null,
      defaultReferenceLow: input.defaultReferenceLow ?? null,
      defaultReferenceHigh: input.defaultReferenceHigh ?? null,
      referenceNotes: input.referenceNotes ?? null,
      sexSpecific: input.sexSpecific ?? false,
      ageSpecific: input.ageSpecific ?? false,
      active: input.active !== false,
    },
  });
  return entry;
}

export async function updateAnalyteCatalogEntry(id: string, input: CatalogUpsertInput) {
  const existing = await prisma.labAnalyteCatalog.findUnique({ where: { id } });
  if (!existing) throw new AppError(LAB_ERRORS.CATALOG_NOT_FOUND, 404);

  const data: Record<string, unknown> = {};
  if (input.category !== undefined) {
    const category = String(input.category).trim();
    if (!category) throw new AppError('category no puede estar vacio', 400);
    data.category = category;
  }
  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw new AppError('name no puede estar vacio', 400);
    data.name = name;
  }
  if (input.aliasesJson !== undefined) {
    data.aliasesJson = Array.isArray(input.aliasesJson) ? input.aliasesJson : [];
  }
  if (input.loincCode !== undefined) data.loincCode = input.loincCode;
  if (input.allowedUnitsJson !== undefined) {
    data.allowedUnitsJson = Array.isArray(input.allowedUnitsJson) ? input.allowedUnitsJson : [];
  }
  if (input.defaultUnit !== undefined) data.defaultUnit = input.defaultUnit;
  if (input.defaultReferenceLow !== undefined) data.defaultReferenceLow = input.defaultReferenceLow;
  if (input.defaultReferenceHigh !== undefined) data.defaultReferenceHigh = input.defaultReferenceHigh;
  if (input.referenceNotes !== undefined) data.referenceNotes = input.referenceNotes;
  if (input.sexSpecific !== undefined) data.sexSpecific = input.sexSpecific;
  if (input.ageSpecific !== undefined) data.ageSpecific = input.ageSpecific;
  if (input.active !== undefined) data.active = input.active;

  return prisma.labAnalyteCatalog.update({ where: { id }, data });
}

export async function getSmartLabAdminMetrics() {
  const [
    reportsTotal,
    reportsByStatus,
    alertsOpen,
    catalogActive,
    catalogTotal,
    patientsWithReports,
    manuallyCorrected,
    reportsWithTrace,
    vendorBreakdown,
  ] = await Promise.all([
    prisma.labReport.count(),
    prisma.labReport.groupBy({ by: ['extractionStatus'], _count: { _all: true } }),
    prisma.labAlert.count({ where: { dismissedAt: null } }),
    prisma.labAnalyteCatalog.count({ where: { active: true } }),
    prisma.labAnalyteCatalog.count(),
    prisma.labReport.findMany({ distinct: ['patientId'], select: { patientId: true } }),
    prisma.labResult.count({ where: { manuallyCorrected: true } }),
    prisma.labReport.findMany({
      where: { parserUsed: { not: null } },
      select: { extractionTraceJson: true, classifiedVendor: true, parserUsed: true },
    }),
    prisma.labReport.groupBy({
      by: ['classifiedVendor'],
      _count: { _all: true },
      where: { classifiedVendor: { not: null } },
    }),
  ]);

  const statusCounts = Object.fromEntries(
    reportsByStatus.map((row) => [row.extractionStatus, row._count._all])
  );

  const traceRows = reportsWithTrace
    .map((r) => r.extractionTraceJson as { rowCount?: number; processingMs?: number } | null)
    .filter(Boolean);
  const avgProcessingMs =
    traceRows.length > 0
      ? traceRows.reduce((sum, t) => sum + (t?.processingMs ?? 0), 0) / traceRows.length
      : null;
  const avgExtractedRows =
    traceRows.length > 0
      ? traceRows.reduce((sum, t) => sum + (t?.rowCount ?? 0), 0) / traceRows.length
      : null;

  const totalResults = await prisma.labResult.count();
  const manualCorrectionRate = totalResults > 0 ? manuallyCorrected / totalResults : 0;

  return {
    reportsTotal,
    reportsByStatus: statusCounts,
    alertsOpen,
    catalogActive,
    catalogTotal,
    patientsWithLabReports: patientsWithReports.length,
    extraction: {
      avgProcessingMs,
      avgExtractedRows,
      manualCorrectionRate,
      reportsWithTrace: traceRows.length,
      vendorBreakdown: Object.fromEntries(
        vendorBreakdown.map((v) => [v.classifiedVendor ?? 'unknown', v._count._all])
      ),
    },
  };
}
