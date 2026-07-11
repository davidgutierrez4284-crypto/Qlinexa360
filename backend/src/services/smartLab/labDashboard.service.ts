import prisma from '../../config/database';
import { LabSeverity } from '@prisma/client';
import { LAB_DASHBOARD_CATEGORIES } from '../../constants/lab.constants';
import { dashboardCategoryLabel, mapCatalogCategoryToDashboard } from './labNormalization.service';

function worstSeverity(flags: string[]): LabSeverity {
  if (flags.some((f) => f === 'critical_low' || f === 'critical_high')) return 'red';
  if (flags.some((f) => f === 'low' || f === 'high')) return 'yellow';
  if (flags.length && flags.every((f) => f === 'normal')) return 'green';
  return 'gray';
}

export async function refreshDashboardForPatient(patientId: string): Promise<void> {
  const reports = await prisma.labReport.findMany({
    where: { patientId, extractionStatus: 'confirmed' },
    orderBy: [{ confirmedAt: 'desc' }],
    take: 5,
    include: {
      results: {
        include: { analyteCatalog: { select: { category: true } } },
      },
    },
  });

  const byCategory: Record<string, string[]> = {};
  for (const key of Object.keys(LAB_DASHBOARD_CATEGORIES)) {
    byCategory[key] = [];
  }

  for (const report of reports) {
    for (const r of report.results) {
      const cat = r.analyteCatalog?.category
        ? mapCatalogCategoryToDashboard(r.analyteCatalog.category)
        : 'otros';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(r.abnormalFlag);
    }
  }

  for (const [category, flags] of Object.entries(byCategory)) {
    const status = worstSeverity(flags);
    const summary =
      flags.length === 0
        ? 'Sin resultados recientes en esta categoria.'
        : `${flags.length} analito(s) evaluados en estudios confirmados recientes.`;

    await prisma.labHealthDashboardScore.upsert({
      where: { patientId_category: { patientId, category } },
      create: {
        patientId,
        category,
        status,
        score: status === 'green' ? 100 : status === 'yellow' ? 70 : status === 'red' ? 40 : 50,
        summary,
      },
      update: {
        status,
        score: status === 'green' ? 100 : status === 'yellow' ? 70 : status === 'red' ? 40 : 50,
        summary,
        lastUpdatedAt: new Date(),
      },
    });
  }
}

export async function getPatientDashboard(patientId: string) {
  const scores = await prisma.labHealthDashboardScore.findMany({
    where: { patientId },
    orderBy: { category: 'asc' },
  });

  return scores.map((s) => ({
    ...s,
    label: dashboardCategoryLabel(s.category),
  }));
}
