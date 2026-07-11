import prisma from '../../config/database';
import { LabAlertType, LabSeverity } from '@prisma/client';
import { LAB_ALERT_NON_DIAGNOSTIC_PREFIX } from '../../constants/lab.constants';
import { getSmartLabMissingFollowupMonths } from '../../config/smartLab.config';

export function mapAbnormalFlagToLabSeverity(flag: string): LabSeverity {
  if (flag === 'critical_low' || flag === 'critical_high') return 'red';
  if (flag === 'low' || flag === 'high') return 'yellow';
  if (flag === 'normal') return 'green';
  return 'gray';
}

export async function refreshAlertsForPatient(patientId: string): Promise<void> {
  const latestReport = await prisma.labReport.findFirst({
    where: { patientId, extractionStatus: 'confirmed' },
    orderBy: [{ confirmedAt: 'desc' }, { createdAt: 'desc' }],
    include: { results: true },
  });
  if (!latestReport) return;

  for (const result of latestReport.results) {
    if (!['low', 'high', 'critical_low', 'critical_high'].includes(result.abnormalFlag)) continue;

    const existing = await prisma.labAlert.findFirst({
      where: {
        patientId,
        labResultId: result.id,
        dismissedAt: null,
      },
    });
    if (existing) continue;

    const severity = mapAbnormalFlagToLabSeverity(result.abnormalFlag);
    const title = result.analyteNameNormalized || result.analyteNameRaw;
    await prisma.labAlert.create({
      data: {
        patientId,
        labResultId: result.id,
        analyteCatalogId: result.analyteCatalogId,
        alertType: severity === 'red' ? 'critical' : 'out_of_range',
        severity,
        title,
        message: `${LAB_ALERT_NON_DIAGNOSTIC_PREFIX} ${title}: ${result.resultValueText ?? result.resultValue ?? 'N/D'} ${result.resultUnit ?? ''}`.trim(),
      },
    });
  }

  await evaluateTrendAlerts(patientId);
  await evaluateMissingFollowupAlert(patientId);
}

async function evaluateTrendAlerts(patientId: string): Promise<void> {
  const confirmed = await prisma.labReport.findMany({
    where: { patientId, extractionStatus: 'confirmed' },
    orderBy: [{ confirmedAt: 'desc' }],
    take: 2,
    include: { results: true },
  });
  if (confirmed.length < 2) return;

  const [newer, older] = confirmed;
  const olderMap = new Map(older.results.map((r) => [r.analyteCatalogId ?? r.analyteNameRaw, r]));

  for (const r of newer.results) {
    if (r.resultValue == null) continue;
    const key = r.analyteCatalogId ?? r.analyteNameRaw;
    const prev = olderMap.get(key);
    if (!prev || prev.resultValue == null || prev.resultValue === 0) continue;
    const pct = ((r.resultValue - prev.resultValue) / Math.abs(prev.resultValue)) * 100;
    if (Math.abs(pct) < 15) continue;

    const alertType: LabAlertType = pct > 0 ? 'trend_up' : 'trend_down';
    const dup = await prisma.labAlert.findFirst({
      where: { patientId, labResultId: r.id, alertType, dismissedAt: null },
    });
    if (dup) continue;

    await prisma.labAlert.create({
      data: {
        patientId,
        labResultId: r.id,
        analyteCatalogId: r.analyteCatalogId,
        alertType,
        severity: 'yellow',
        title: r.analyteNameNormalized || r.analyteNameRaw,
        message: `Cambio significativo (${pct.toFixed(0)}%) respecto al estudio anterior.`,
      },
    });
  }
}

async function evaluateMissingFollowupAlert(patientId: string): Promise<void> {
  const months = getSmartLabMissingFollowupMonths();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const last = await prisma.labReport.findFirst({
    where: { patientId, extractionStatus: 'confirmed' },
    orderBy: [{ confirmedAt: 'desc' }],
  });
  if (!last?.confirmedAt || last.confirmedAt > cutoff) return;

  const dup = await prisma.labAlert.findFirst({
    where: { patientId, alertType: 'missing_followup', dismissedAt: null },
  });
  if (dup) return;

  await prisma.labAlert.create({
    data: {
      patientId,
      alertType: 'missing_followup',
      severity: 'gray',
      title: 'Seguimiento de laboratorio',
      message: `No hay estudios confirmados en los ultimos ${months} meses.`,
    },
  });
}

export async function listPatientAlerts(patientId: string, includeDismissed = false) {
  return prisma.labAlert.findMany({
    where: {
      patientId,
      ...(includeDismissed ? {} : { dismissedAt: null }),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function dismissLabAlert(alertId: string, userId: string) {
  const alert = await prisma.labAlert.findUnique({ where: { id: alertId } });
  if (!alert) return null;
  return prisma.labAlert.update({
    where: { id: alertId },
    data: { dismissedAt: new Date(), dismissedByUserId: userId },
  });
}

