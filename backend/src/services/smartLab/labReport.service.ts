import prisma from '../../config/database';
import { deleteFromS3, fetchBufferFromUrl } from '../../utils/file.utils';
import { AppError } from '../../utils/error.utils';
import { LAB_ERRORS } from '../../constants/lab.constants';
import { extractAndParseLabPdf } from './labProcessing.service';
import { normalizeParsedResults } from './labNormalization.service';
import { recordLabAuditFireAndForget } from './labAudit.service';
import { refreshAlertsForPatient } from './labAlerts.service';
import { refreshDashboardForPatient } from './labDashboard.service';
import { computeAbnormalFlag } from '../../utils/labRange.utils';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { assertReportAccess } from './labAccess.service';

export async function processLabReport(reportId: string, actorUserId?: string | null) {
  const report = await prisma.labReport.findUnique({ where: { id: reportId } });
  if (!report) throw new AppError(LAB_ERRORS.REPORT_NOT_FOUND, 404);
  if (!['uploaded', 'extraction_failed', 'pending_review', 'processing'].includes(report.extractionStatus)) {
    throw new AppError(LAB_ERRORS.INVALID_STATUS, 400);
  }

  await prisma.labReport.update({
    where: { id: reportId },
    data: { extractionStatus: 'processing' },
  });

  try {
    const { buffer } = await fetchBufferFromUrl(report.sourcePdfUrl);
    const patient = await prisma.patient.findUnique({
      where: { id: report.patientId },
      select: { gender: true, dateOfBirth: true },
    });
    const processed = await extractAndParseLabPdf(buffer);
    const { text, engine, pipeline, reportConfidence } = processed;
    const meta = pipeline.metadata;
    const normalized = await normalizeParsedResults(processed.parsedLines, {
      patientGender: patient?.gender,
      patientBirthDate: patient?.dateOfBirth ?? null,
    }, pipeline.candidates);

    await prisma.labResult.deleteMany({ where: { labReportId: reportId } });

    const MIN_TEXT_FOR_MANUAL_REVIEW = 80;

    if (normalized.length === 0) {
      if (text.length < MIN_TEXT_FOR_MANUAL_REVIEW) {
        await prisma.labReport.update({
          where: { id: reportId },
          data: {
            extractionStatus: 'extraction_failed',
            extractionEngine: engine,
            rawText: text.slice(0, 50000),
            classifiedVendor: pipeline.classification.vendor,
            parserUsed: pipeline.trace.parserUsed,
            extractionTraceJson: pipeline.trace as object,
          },
        });
        recordLabAuditFireAndForget({
          actorUserId,
          patientId: report.patientId,
          labReportId: reportId,
          action: 'extract_failed',
          metadata: { reason: 'insufficient_text' },
        });
        return prisma.labReport.findUnique({ where: { id: reportId }, include: { results: true } });
      }

      const manualReview = await prisma.labReport.update({
        where: { id: reportId },
        data: {
          extractionStatus: 'pending_review',
          extractionEngine: engine,
          extractionConfidence: reportConfidence,
          rawText: text.slice(0, 50000),
          laboratoryName: meta.laboratoryName ?? report.laboratoryName,
          studyType: meta.studyType ?? report.studyType,
          studyDate: meta.studyDate ?? report.studyDate,
          reportDate: meta.reportDate ?? report.reportDate,
          classifiedVendor: pipeline.classification.vendor,
          parserUsed: pipeline.trace.parserUsed,
          extractionTraceJson: pipeline.trace as object,
        },
        include: { results: true },
      });
      recordLabAuditFireAndForget({
        actorUserId,
        patientId: report.patientId,
        labReportId: reportId,
        action: 'extract',
        metadata: { resultCount: 0, engine, note: 'no_auto_params', parser: pipeline.trace.parserUsed },
      });
      return manualReview;
    }

    await prisma.labResult.createMany({
      data: normalized.map((r) => ({
        labReportId: reportId,
        patientId: report.patientId,
        analyteCatalogId: r.analyteCatalogId,
        analyteNameRaw: r.analyteNameRaw,
        analyteNameNormalized: r.analyteNameNormalized,
        resultValue: r.resultValue,
        resultValueText: r.resultValueText,
        resultUnit: r.resultUnit,
        referenceRangeLow: r.referenceRangeLow,
        referenceRangeHigh: r.referenceRangeHigh,
        referenceRangeText: r.referenceRangeText,
        abnormalFlag: r.abnormalFlag,
        extractionConfidence: r.extractionConfidence,
        rawTextSnippet: r.rawTextSnippet,
        validationErrorsJson: r.validationErrorsJson,
      })),
    });

    const updated = await prisma.labReport.update({
      where: { id: reportId },
      data: {
        extractionStatus: 'pending_review',
        extractionEngine: engine,
        extractionConfidence: reportConfidence,
        rawText: text.slice(0, 50000),
        laboratoryName: meta.laboratoryName ?? report.laboratoryName,
        studyType: meta.studyType ?? report.studyType,
        studyDate: meta.studyDate ?? report.studyDate,
        reportDate: meta.reportDate ?? report.reportDate,
        classifiedVendor: pipeline.classification.vendor,
        parserUsed: pipeline.trace.parserUsed,
        extractionTraceJson: pipeline.trace as object,
      },
      include: { results: true },
    });

    recordLabAuditFireAndForget({
      actorUserId,
      patientId: report.patientId,
      labReportId: reportId,
      action: 'extract',
      metadata: {
        resultCount: normalized.length,
        engine,
        parser: pipeline.trace.parserUsed,
        vendor: pipeline.classification.vendor,
        validationIssues: pipeline.trace.rowsWithValidationErrors,
      },
    });

    return updated;
  } catch (e) {
    await prisma.labReport.update({
      where: { id: reportId },
      data: { extractionStatus: 'extraction_failed' },
    });
    recordLabAuditFireAndForget({
      actorUserId,
      patientId: report.patientId,
      labReportId: reportId,
      action: 'extract_failed',
      metadata: { message: e instanceof Error ? e.message : 'unknown' },
    });
    throw e instanceof AppError ? e : new AppError('Error al procesar el PDF de laboratorio', 500);
  }
}

export async function listPatientLabReports(patientId: string) {
  return prisma.labReport.findMany({
    where: { patientId, extractionStatus: { not: 'archived' } },
    orderBy: [{ studyDate: 'desc' }, { createdAt: 'desc' }],
    include: {
      results: { orderBy: { analyteNameRaw: 'asc' } },
    },
  });
}

export async function getLabReportById(reportId: string) {
  const report = await prisma.labReport.findUnique({
    where: { id: reportId },
    include: { results: { orderBy: { analyteNameRaw: 'asc' } } },
  });
  if (!report) throw new AppError(LAB_ERRORS.REPORT_NOT_FOUND, 404);
  return report;
}

export type LabResultCorrection = {
  id: string;
  resultValue?: number | null;
  resultValueText?: string | null;
  resultUnit?: string | null;
  referenceRangeLow?: number | null;
  referenceRangeHigh?: number | null;
  analyteCatalogId?: string | null;
  analyteNameNormalized?: string | null;
};

export async function applyLabResultCorrections(reportId: string, corrections: LabResultCorrection[]) {
  const report = await prisma.labReport.findUnique({ where: { id: reportId } });
  if (!report) throw new AppError(LAB_ERRORS.REPORT_NOT_FOUND, 404);
  if (!['pending_review', 'confirmed'].includes(report.extractionStatus)) {
    throw new AppError(LAB_ERRORS.INVALID_STATUS, 400);
  }

  for (const c of corrections) {
    const existing = await prisma.labResult.findFirst({
      where: { id: c.id, labReportId: reportId },
    });
    if (!existing) throw new AppError(LAB_ERRORS.RESULT_NOT_FOUND, 404);

    const value = c.resultValue !== undefined ? c.resultValue : existing.resultValue;
    const low = c.referenceRangeLow !== undefined ? c.referenceRangeLow : existing.referenceRangeLow;
    const high = c.referenceRangeHigh !== undefined ? c.referenceRangeHigh : existing.referenceRangeHigh;

    await prisma.labResult.update({
      where: { id: c.id },
      data: {
        resultValue: c.resultValue !== undefined ? c.resultValue : undefined,
        resultValueText: c.resultValueText !== undefined ? c.resultValueText : undefined,
        resultUnit: c.resultUnit !== undefined ? c.resultUnit : undefined,
        referenceRangeLow: c.referenceRangeLow !== undefined ? c.referenceRangeLow : undefined,
        referenceRangeHigh: c.referenceRangeHigh !== undefined ? c.referenceRangeHigh : undefined,
        analyteCatalogId: c.analyteCatalogId !== undefined ? c.analyteCatalogId : undefined,
        analyteNameNormalized: c.analyteNameNormalized !== undefined ? c.analyteNameNormalized : undefined,
        abnormalFlag: computeAbnormalFlag(value, low, high),
        manuallyCorrected: true,
        validationErrorsJson: [],
      },
    });
  }

  return getLabReportById(reportId);
}

export async function confirmLabReport(req: AuthRequest, reportId: string, corrections?: LabResultCorrection[]) {
  if (!req.user) throw new AppError(LAB_ERRORS.UNAUTHORIZED, 401);
  const report = await assertReportAccess(req, reportId);
  if (report.extractionStatus !== 'pending_review') {
    throw new AppError(LAB_ERRORS.INVALID_STATUS, 400);
  }

  const results = await prisma.labResult.findMany({ where: { labReportId: reportId } });
  const hasUncorrectedValidationErrors = results.some((r) => {
    if (r.manuallyCorrected) return false;
    const errors = Array.isArray(r.validationErrorsJson) ? r.validationErrorsJson : [];
    return errors.length > 0;
  });
  if (hasUncorrectedValidationErrors && !corrections?.length) {
    throw new AppError(
      'Hay indicadores con errores de validación. Corrígelos o guarda borrador antes de confirmar.',
      400
    );
  }

  if (corrections?.length) {
    await applyLabResultCorrections(reportId, corrections);
  }

  const confirmed = await prisma.labReport.update({
    where: { id: reportId },
    data: {
      extractionStatus: 'confirmed',
      reviewedByUserId: req.user.userId,
      confirmedAt: new Date(),
    },
    include: { results: true },
  });

  recordLabAuditFireAndForget({
    actorUserId: req.user.userId,
    patientId: confirmed.patientId,
    labReportId: reportId,
    action: 'confirm',
  });

  if (corrections?.length) {
    recordLabAuditFireAndForget({
      actorUserId: req.user.userId,
      patientId: confirmed.patientId,
      labReportId: reportId,
      action: 'manual_correction',
      metadata: { count: corrections.length },
    });
  }

  // Alertas/dashboard no deben tumbar la confirmación (p. ej. Prisma lento o fallo puntual en local).
  try {
    await refreshAlertsForPatient(confirmed.patientId);
  } catch (e) {
    console.warn(
      'Smart Lab: refreshAlertsForPatient falló tras confirmar:',
      e instanceof Error ? e.message : e
    );
  }
  try {
    await refreshDashboardForPatient(confirmed.patientId);
  } catch (e) {
    console.warn(
      'Smart Lab: refreshDashboardForPatient falló tras confirmar:',
      e instanceof Error ? e.message : e
    );
  }

  return confirmed;
}

export async function rejectLabReport(req: AuthRequest, reportId: string, reason?: string) {
  if (!req.user) throw new AppError(LAB_ERRORS.UNAUTHORIZED, 401);
  await assertReportAccess(req, reportId);

  const rejected = await prisma.labReport.update({
    where: { id: reportId },
    data: { extractionStatus: 'rejected' },
    include: { results: true },
  });

  recordLabAuditFireAndForget({
    actorUserId: req.user.userId,
    patientId: rejected.patientId,
    labReportId: reportId,
    action: 'reject',
    metadata: reason ? { reason } : undefined,
  });

  return rejected;
}

export async function deleteLabReport(req: AuthRequest, reportId: string) {
  if (!req.user) throw new AppError(LAB_ERRORS.UNAUTHORIZED, 401);
  const report = await assertReportAccess(req, reportId);
  const { patientId, sourcePdfUrl, extractionStatus, studyType, studyDate } = report;

  recordLabAuditFireAndForget({
    actorUserId: req.user.userId,
    patientId,
    labReportId: reportId,
    action: 'delete',
    metadata: {
      extractionStatus,
      studyType: studyType ?? null,
      studyDate: studyDate ? studyDate.toISOString() : null,
    },
  });

  await prisma.labReport.delete({ where: { id: reportId } });

  if (sourcePdfUrl) {
    try {
      await deleteFromS3(sourcePdfUrl);
    } catch {
      // El estudio ya no está en la base; el PDF en S3 puede limpiarse después.
    }
  }

  await refreshAlertsForPatient(patientId);
  await refreshDashboardForPatient(patientId);

  return { deleted: true, id: reportId };
}

