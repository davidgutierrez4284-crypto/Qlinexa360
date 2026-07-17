import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error.utils';
import { LAB_DISCLAIMER_ES, LAB_ERRORS } from '../constants/lab.constants';
import { uploadLabReportPdf } from '../services/smartLab/labUpload.service';
import {
  applyLabResultCorrections,
  confirmLabReport,
  getLabReportById,
  listPatientLabReports,
  processLabReport,
  rejectLabReport,
  deleteLabReport,
} from '../services/smartLab/labReport.service';
import { assertPatientAccess, assertReportAccess } from '../services/smartLab/labAccess.service';
import { dismissLabAlert, listPatientAlerts } from '../services/smartLab/labAlerts.service';
import { getPatientDashboard } from '../services/smartLab/labDashboard.service';
import { comparePatientAnalyte, compareReports } from '../services/smartLab/labCompare.service';
import { recordLabAuditFireAndForget } from '../services/smartLab/labAudit.service';
import {
  createAnalyteCatalogEntry,
  getSmartLabAdminMetrics,
  listAnalyteCatalog,
  updateAnalyteCatalogEntry,
} from '../services/smartLab/labCatalog.service';
import prisma from '../config/database';
import { getS3SignedUrl, isLocalUploadUrl } from '../utils/file.utils';

function sendError(res: Response, error: unknown) {
  const err = error instanceof AppError ? error : new AppError('Error en laboratorio inteligente', 500);
  return res.status(err.statusCode).json({ message: err.message, status: err.status });
}

export const getSmartLabStatus = async (_req: AuthRequest, res: Response) => {
  res.json({ module: 'laboratorio-inteligente', status: 'ready', disclaimer: LAB_DISCLAIMER_ES });
};

export const uploadPatientLabReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No se ha subido ningun archivo PDF.', 400);
    const { patientId } = req.params;
    await assertPatientAccess(req, patientId);

    const report = await uploadLabReportPdf(req, patientId, req.file);
    const processed = await processLabReport(report.id, req.user?.userId);

    res.status(201).json({ report: processed, disclaimer: LAB_DISCLAIMER_ES });
  } catch (e) {
    sendError(res, e);
  }
};

export const processLabReportHandler = async (req: AuthRequest, res: Response) => {
  try {
    const report = await assertReportAccess(req, req.params.reportId);
    const processed = await processLabReport(report.id, req.user?.userId);
    res.json({ report: processed });
  } catch (e) {
    sendError(res, e);
  }
};

export const getLabReport = async (req: AuthRequest, res: Response) => {
  try {
    await assertReportAccess(req, req.params.reportId);
    const report = await getLabReportById(req.params.reportId);
    recordLabAuditFireAndForget({
      actorUserId: req.user?.userId,
      patientId: report.patientId,
      labReportId: report.id,
      action: 'view',
    });
    res.json({ report });
  } catch (e) {
    sendError(res, e);
  }
};

export const listPatientReports = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    await assertPatientAccess(req, patientId);
    const reports = await listPatientLabReports(patientId);
    res.json({ reports });
  } catch (e) {
    sendError(res, e);
  }
};

export const patchLabReportResults = async (req: AuthRequest, res: Response) => {
  try {
    await assertReportAccess(req, req.params.reportId);
    const corrections = Array.isArray(req.body?.results) ? req.body.results : [];
    const report = await applyLabResultCorrections(req.params.reportId, corrections);
    res.json({ report });
  } catch (e) {
    sendError(res, e);
  }
};

export const confirmLabReportHandler = async (req: AuthRequest, res: Response) => {
  try {
    const corrections = Array.isArray(req.body?.results) ? req.body.results : undefined;
    const report = await confirmLabReport(req, req.params.reportId, corrections);
    res.json({ report, disclaimer: LAB_DISCLAIMER_ES });
  } catch (e) {
    sendError(res, e);
  }
};

export const rejectLabReportHandler = async (req: AuthRequest, res: Response) => {
  try {
    const report = await rejectLabReport(req, req.params.reportId, req.body?.reason);
    res.json({ report });
  } catch (e) {
    sendError(res, e);
  }
};

export const getPatientLabAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    await assertPatientAccess(req, patientId);
    const alerts = await listPatientAlerts(patientId);
    res.json({ alerts });
  } catch (e) {
    sendError(res, e);
  }
};

export const dismissPatientLabAlert = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError(LAB_ERRORS.UNAUTHORIZED, 401);
    const existing = await prisma.labAlert.findUnique({ where: { id: req.params.alertId } });
    if (!existing) throw new AppError('Alerta no encontrada', 404);
    await assertPatientAccess(req, existing.patientId);
    const alert = await dismissLabAlert(req.params.alertId, req.user.userId);
    res.json({ alert });
  } catch (e) {
    sendError(res, e);
  }
};

export const getPatientLabDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    await assertPatientAccess(req, patientId);
    const dashboard = await getPatientDashboard(patientId);
    res.json({ dashboard, disclaimer: LAB_DISCLAIMER_ES });
  } catch (e) {
    sendError(res, e);
  }
};

export const comparePatientLabAnalyte = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const analyteCatalogId = String(req.query.analyteCatalogId || '');
    if (!analyteCatalogId) throw new AppError('analyteCatalogId es requerido', 400);
    await assertPatientAccess(req, patientId);
    const comparison = await comparePatientAnalyte(patientId, analyteCatalogId);
    res.json({ comparison });
  } catch (e) {
    sendError(res, e);
  }
};

function parseCompareReportIds(query: AuthRequest['query']): string[] {
  const rawIds = query.reportIds;
  if (rawIds) {
    if (Array.isArray(rawIds)) return rawIds.map(String).filter(Boolean);
    return String(rawIds)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const reportIdA = String(query.reportIdA || '');
  const reportIdB = String(query.reportIdB || '');
  if (reportIdA && reportIdB) return [reportIdA, reportIdB];
  return [];
}

export const compareLabReports = async (req: AuthRequest, res: Response) => {
  try {
    const reportIds = parseCompareReportIds(req.query);
    if (reportIds.length < 2) {
      throw new AppError('Se requieren al menos dos reportIds (reportIds o reportIdA/reportIdB)', 400);
    }
    const first = await assertReportAccess(req, reportIds[0]);
    for (let i = 1; i < reportIds.length; i++) {
      await assertReportAccess(req, reportIds[i]);
    }
    if (first.patientId) await assertPatientAccess(req, first.patientId);
    const comparison = await compareReports(reportIds);
    res.json({ comparison });
  } catch (e) {
    sendError(res, e);
  }
};

export const downloadLabReportPdf = async (req: AuthRequest, res: Response) => {
  try {
    const report = await assertReportAccess(req, req.params.reportId);
    const downloadUrl = isLocalUploadUrl(report.sourcePdfUrl)
      ? report.sourcePdfUrl
      : await getS3SignedUrl(report.sourcePdfUrl);
    recordLabAuditFireAndForget({
      actorUserId: req.user?.userId,
      patientId: report.patientId,
      labReportId: report.id,
      action: 'download',
    });
    res.json({ url: downloadUrl });
  } catch (e) {
    sendError(res, e);
  }
};

export const getAnalyteCatalog = async (req: AuthRequest, res: Response) => {
  try {
    const category = req.query.category ? String(req.query.category) : undefined;
    const items = await listAnalyteCatalog({ activeOnly: true, category });
    res.json({ items, catalog: items });
  } catch (e) {
    sendError(res, e);
  }
};

export const listAdminAnalyteCatalog = async (req: AuthRequest, res: Response) => {
  try {
    const category = req.query.category ? String(req.query.category) : undefined;
    const activeOnly = req.query.includeInactive === 'true' ? false : true;
    const items = await listAnalyteCatalog({ activeOnly, category });
    res.json({ items, catalog: items });
  } catch (e) {
    sendError(res, e);
  }
};

export const createAdminAnalyteCatalog = async (req: AuthRequest, res: Response) => {
  try {
    const entry = await createAnalyteCatalogEntry(req.body ?? {});
    res.status(201).json({ item: entry, catalog: entry });
  } catch (e) {
    sendError(res, e);
  }
};

export const patchAdminAnalyteCatalog = async (req: AuthRequest, res: Response) => {
  try {
    const entry = await updateAnalyteCatalogEntry(req.params.id, req.body ?? {});
    res.json({ item: entry, catalog: entry });
  } catch (e) {
    sendError(res, e);
  }
};

export const getSmartLabAdminMetricsHandler = async (_req: AuthRequest, res: Response) => {
  try {
    const metrics = await getSmartLabAdminMetrics();
    res.json({ metrics });
  } catch (e) {
    sendError(res, e);
  }
};

export const deleteLabReportHandler = async (req: AuthRequest, res: Response) => {
  try {
    const result = await deleteLabReport(req, req.params.reportId);
    res.json(result);
  } catch (e) {
    sendError(res, e);
  }
};
