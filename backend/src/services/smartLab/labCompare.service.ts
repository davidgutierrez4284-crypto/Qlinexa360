import prisma from '../../config/database';
import { AppError } from '../../utils/error.utils';
import { LAB_ERRORS, MAX_COMPARE_REPORTS } from '../../constants/lab.constants';

export async function comparePatientAnalyte(
  patientId: string,
  analyteCatalogId: string,
  limit = 10
) {
  const catalog = await prisma.labAnalyteCatalog.findUnique({ where: { id: analyteCatalogId } });
  if (!catalog) throw new AppError(LAB_ERRORS.CATALOG_NOT_FOUND, 404);

  const reports = await prisma.labReport.findMany({
    where: { patientId, extractionStatus: 'confirmed' },
    orderBy: [{ studyDate: 'desc' }, { confirmedAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      studyDate: true,
      confirmedAt: true,
      laboratoryName: true,
      results: {
        where: { analyteCatalogId },
        take: 1,
      },
    },
  });

  const points = reports
    .filter((r) => r.results.length > 0)
    .map((r) => ({
      reportId: r.id,
      studyDate: r.studyDate,
      confirmedAt: r.confirmedAt,
      laboratoryName: r.laboratoryName,
      result: r.results[0],
    }));

  if (points.length < 2) {
    throw new AppError(LAB_ERRORS.COMPARE_REQUIRES_TWO, 400);
  }

  return {
    analyte: { id: catalog.id, name: catalog.name, category: catalog.category, defaultUnit: catalog.defaultUnit },
    points: points.reverse(),
  };
}

export function buildMultiReportResultDiffs<
  T extends {
    analyteCatalogId: string | null;
    analyteNameRaw: string;
    analyteNameNormalized: string | null;
  },
>(allResults: T[][]) {
  const keyOrder: string[] = [];
  const seen = new Set<string>();
  const keyToName = new Map<string, string>();

  for (const results of allResults) {
    for (const r of results) {
      const key = r.analyteCatalogId ?? r.analyteNameRaw;
      if (!seen.has(key)) {
        seen.add(key);
        keyOrder.push(key);
      }
      if (!keyToName.has(key)) {
        keyToName.set(key, r.analyteNameNormalized || r.analyteNameRaw);
      }
    }
  }

  const maps = allResults.map((results) =>
    new Map(results.map((r) => [r.analyteCatalogId ?? r.analyteNameRaw, r]))
  );

  return keyOrder.map((key) => ({
    analyte: keyToName.get(key)!,
    values: maps.map((m) => m.get(key) ?? null),
  }));
}

export function buildReportResultDiffs<
  T extends {
    analyteCatalogId: string | null;
    analyteNameRaw: string;
    analyteNameNormalized: string | null;
  },
>(resultsA: T[], resultsB: T[]) {
  return buildMultiReportResultDiffs([resultsA, resultsB]).map((d) => ({
    analyte: d.analyte,
    reportA: d.values[0],
    reportB: d.values[1] ?? null,
  }));
}

export async function compareReports(reportIds: string[]) {
  const unique = [...new Set(reportIds)];
  if (unique.length !== reportIds.length) {
    throw new AppError(LAB_ERRORS.COMPARE_DUPLICATE_REPORTS, 400);
  }
  if (reportIds.length < 2) {
    throw new AppError(LAB_ERRORS.COMPARE_REQUIRES_MIN, 400);
  }
  if (reportIds.length > MAX_COMPARE_REPORTS) {
    throw new AppError(LAB_ERRORS.COMPARE_MAX_REPORTS, 400);
  }

  const reports = await Promise.all(
    reportIds.map((id) =>
      prisma.labReport.findUnique({ where: { id }, include: { results: true } })
    )
  );

  if (reports.some((r) => !r)) throw new AppError(LAB_ERRORS.REPORT_NOT_FOUND, 404);

  const patientId = reports[0]!.patientId;
  if (reports.some((r) => r!.patientId !== patientId)) {
    throw new AppError(LAB_ERRORS.FORBIDDEN, 403);
  }
  if (reports.some((r) => r!.extractionStatus !== 'confirmed')) {
    throw new AppError(LAB_ERRORS.INVALID_STATUS, 400);
  }

  const diffs = buildMultiReportResultDiffs(reports.map((r) => r!.results));

  return { reports, diffs };
}

export async function compareTwoReports(reportIdA: string, reportIdB: string) {
  return compareReports([reportIdA, reportIdB]);
}
