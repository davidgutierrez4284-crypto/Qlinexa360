"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLabReportHandler = exports.getSmartLabAdminMetricsHandler = exports.patchAdminAnalyteCatalog = exports.createAdminAnalyteCatalog = exports.listAdminAnalyteCatalog = exports.getAnalyteCatalog = exports.downloadLabReportPdf = exports.compareLabReports = exports.comparePatientLabAnalyte = exports.getPatientLabDashboard = exports.dismissPatientLabAlert = exports.getPatientLabAlerts = exports.rejectLabReportHandler = exports.confirmLabReportHandler = exports.patchLabReportResults = exports.listPatientReports = exports.getLabReport = exports.processLabReportHandler = exports.uploadPatientLabReport = exports.getSmartLabStatus = void 0;
const error_utils_1 = require("../utils/error.utils");
const lab_constants_1 = require("../constants/lab.constants");
const labUpload_service_1 = require("../services/smartLab/labUpload.service");
const labReport_service_1 = require("../services/smartLab/labReport.service");
const labAccess_service_1 = require("../services/smartLab/labAccess.service");
const labAlerts_service_1 = require("../services/smartLab/labAlerts.service");
const labDashboard_service_1 = require("../services/smartLab/labDashboard.service");
const labCompare_service_1 = require("../services/smartLab/labCompare.service");
const labAudit_service_1 = require("../services/smartLab/labAudit.service");
const labCatalog_service_1 = require("../services/smartLab/labCatalog.service");
const database_1 = __importDefault(require("../config/database"));
const file_utils_1 = require("../utils/file.utils");
function sendError(res, error) {
    const err = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error en laboratorio inteligente', 500);
    return res.status(err.statusCode).json({ message: err.message, status: err.status });
}
const getSmartLabStatus = async (_req, res) => {
    res.json({ module: 'laboratorio-inteligente', status: 'ready', disclaimer: lab_constants_1.LAB_DISCLAIMER_ES });
};
exports.getSmartLabStatus = getSmartLabStatus;
const uploadPatientLabReport = async (req, res, next) => {
    var _a;
    try {
        if (!req.file)
            throw new error_utils_1.AppError('No se ha subido ningun archivo PDF.', 400);
        const { patientId } = req.params;
        await (0, labAccess_service_1.assertPatientAccess)(req, patientId);
        const report = await (0, labUpload_service_1.uploadLabReportPdf)(req, patientId, req.file);
        const processed = await (0, labReport_service_1.processLabReport)(report.id, (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId);
        res.status(201).json({ report: processed, disclaimer: lab_constants_1.LAB_DISCLAIMER_ES });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.uploadPatientLabReport = uploadPatientLabReport;
const processLabReportHandler = async (req, res) => {
    var _a;
    try {
        const report = await (0, labAccess_service_1.assertReportAccess)(req, req.params.reportId);
        const processed = await (0, labReport_service_1.processLabReport)(report.id, (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId);
        res.json({ report: processed });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.processLabReportHandler = processLabReportHandler;
const getLabReport = async (req, res) => {
    var _a;
    try {
        await (0, labAccess_service_1.assertReportAccess)(req, req.params.reportId);
        const report = await (0, labReport_service_1.getLabReportById)(req.params.reportId);
        (0, labAudit_service_1.recordLabAuditFireAndForget)({
            actorUserId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId,
            patientId: report.patientId,
            labReportId: report.id,
            action: 'view',
        });
        res.json({ report });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.getLabReport = getLabReport;
const listPatientReports = async (req, res) => {
    try {
        const { patientId } = req.params;
        await (0, labAccess_service_1.assertPatientAccess)(req, patientId);
        const reports = await (0, labReport_service_1.listPatientLabReports)(patientId);
        res.json({ reports });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.listPatientReports = listPatientReports;
const patchLabReportResults = async (req, res) => {
    var _a;
    try {
        await (0, labAccess_service_1.assertReportAccess)(req, req.params.reportId);
        const corrections = Array.isArray((_a = req.body) === null || _a === void 0 ? void 0 : _a.results) ? req.body.results : [];
        const report = await (0, labReport_service_1.applyLabResultCorrections)(req.params.reportId, corrections);
        res.json({ report });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.patchLabReportResults = patchLabReportResults;
const confirmLabReportHandler = async (req, res) => {
    var _a;
    try {
        const corrections = Array.isArray((_a = req.body) === null || _a === void 0 ? void 0 : _a.results) ? req.body.results : undefined;
        const report = await (0, labReport_service_1.confirmLabReport)(req, req.params.reportId, corrections);
        res.json({ report, disclaimer: lab_constants_1.LAB_DISCLAIMER_ES });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.confirmLabReportHandler = confirmLabReportHandler;
const rejectLabReportHandler = async (req, res) => {
    var _a;
    try {
        const report = await (0, labReport_service_1.rejectLabReport)(req, req.params.reportId, (_a = req.body) === null || _a === void 0 ? void 0 : _a.reason);
        res.json({ report });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.rejectLabReportHandler = rejectLabReportHandler;
const getPatientLabAlerts = async (req, res) => {
    try {
        const { patientId } = req.params;
        await (0, labAccess_service_1.assertPatientAccess)(req, patientId);
        const alerts = await (0, labAlerts_service_1.listPatientAlerts)(patientId);
        res.json({ alerts });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.getPatientLabAlerts = getPatientLabAlerts;
const dismissPatientLabAlert = async (req, res) => {
    try {
        if (!req.user)
            throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.UNAUTHORIZED, 401);
        const existing = await database_1.default.labAlert.findUnique({ where: { id: req.params.alertId } });
        if (!existing)
            throw new error_utils_1.AppError('Alerta no encontrada', 404);
        await (0, labAccess_service_1.assertPatientAccess)(req, existing.patientId);
        const alert = await (0, labAlerts_service_1.dismissLabAlert)(req.params.alertId, req.user.userId);
        res.json({ alert });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.dismissPatientLabAlert = dismissPatientLabAlert;
const getPatientLabDashboard = async (req, res) => {
    try {
        const { patientId } = req.params;
        await (0, labAccess_service_1.assertPatientAccess)(req, patientId);
        const dashboard = await (0, labDashboard_service_1.getPatientDashboard)(patientId);
        res.json({ dashboard, disclaimer: lab_constants_1.LAB_DISCLAIMER_ES });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.getPatientLabDashboard = getPatientLabDashboard;
const comparePatientLabAnalyte = async (req, res) => {
    try {
        const { patientId } = req.params;
        const analyteCatalogId = String(req.query.analyteCatalogId || '');
        if (!analyteCatalogId)
            throw new error_utils_1.AppError('analyteCatalogId es requerido', 400);
        await (0, labAccess_service_1.assertPatientAccess)(req, patientId);
        const comparison = await (0, labCompare_service_1.comparePatientAnalyte)(patientId, analyteCatalogId);
        res.json({ comparison });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.comparePatientLabAnalyte = comparePatientLabAnalyte;
function parseCompareReportIds(query) {
    const rawIds = query.reportIds;
    if (rawIds) {
        if (Array.isArray(rawIds))
            return rawIds.map(String).filter(Boolean);
        return String(rawIds)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    const reportIdA = String(query.reportIdA || '');
    const reportIdB = String(query.reportIdB || '');
    if (reportIdA && reportIdB)
        return [reportIdA, reportIdB];
    return [];
}
const compareLabReports = async (req, res) => {
    try {
        const reportIds = parseCompareReportIds(req.query);
        if (reportIds.length < 2) {
            throw new error_utils_1.AppError('Se requieren al menos dos reportIds (reportIds o reportIdA/reportIdB)', 400);
        }
        const first = await (0, labAccess_service_1.assertReportAccess)(req, reportIds[0]);
        for (let i = 1; i < reportIds.length; i++) {
            await (0, labAccess_service_1.assertReportAccess)(req, reportIds[i]);
        }
        if (first.patientId)
            await (0, labAccess_service_1.assertPatientAccess)(req, first.patientId);
        const comparison = await (0, labCompare_service_1.compareReports)(reportIds);
        res.json({ comparison });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.compareLabReports = compareLabReports;
const downloadLabReportPdf = async (req, res) => {
    var _a;
    try {
        const report = await (0, labAccess_service_1.assertReportAccess)(req, req.params.reportId);
        const signedUrl = await (0, file_utils_1.getS3SignedUrl)(report.sourcePdfUrl);
        (0, labAudit_service_1.recordLabAuditFireAndForget)({
            actorUserId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId,
            patientId: report.patientId,
            labReportId: report.id,
            action: 'download',
        });
        res.json({ url: signedUrl });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.downloadLabReportPdf = downloadLabReportPdf;
const getAnalyteCatalog = async (req, res) => {
    try {
        const category = req.query.category ? String(req.query.category) : undefined;
        const items = await (0, labCatalog_service_1.listAnalyteCatalog)({ activeOnly: true, category });
        res.json({ items, catalog: items });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.getAnalyteCatalog = getAnalyteCatalog;
const listAdminAnalyteCatalog = async (req, res) => {
    try {
        const category = req.query.category ? String(req.query.category) : undefined;
        const activeOnly = req.query.includeInactive === 'true' ? false : true;
        const items = await (0, labCatalog_service_1.listAnalyteCatalog)({ activeOnly, category });
        res.json({ items, catalog: items });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.listAdminAnalyteCatalog = listAdminAnalyteCatalog;
const createAdminAnalyteCatalog = async (req, res) => {
    var _a;
    try {
        const entry = await (0, labCatalog_service_1.createAnalyteCatalogEntry)((_a = req.body) !== null && _a !== void 0 ? _a : {});
        res.status(201).json({ item: entry, catalog: entry });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.createAdminAnalyteCatalog = createAdminAnalyteCatalog;
const patchAdminAnalyteCatalog = async (req, res) => {
    var _a;
    try {
        const entry = await (0, labCatalog_service_1.updateAnalyteCatalogEntry)(req.params.id, (_a = req.body) !== null && _a !== void 0 ? _a : {});
        res.json({ item: entry, catalog: entry });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.patchAdminAnalyteCatalog = patchAdminAnalyteCatalog;
const getSmartLabAdminMetricsHandler = async (_req, res) => {
    try {
        const metrics = await (0, labCatalog_service_1.getSmartLabAdminMetrics)();
        res.json({ metrics });
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.getSmartLabAdminMetricsHandler = getSmartLabAdminMetricsHandler;
const deleteLabReportHandler = async (req, res) => {
    try {
        const result = await (0, labReport_service_1.deleteLabReport)(req, req.params.reportId);
        res.json(result);
    }
    catch (e) {
        sendError(res, e);
    }
};
exports.deleteLabReportHandler = deleteLabReportHandler;
