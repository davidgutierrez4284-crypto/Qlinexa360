"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processLabReport = processLabReport;
exports.listPatientLabReports = listPatientLabReports;
exports.getLabReportById = getLabReportById;
exports.applyLabResultCorrections = applyLabResultCorrections;
exports.confirmLabReport = confirmLabReport;
exports.rejectLabReport = rejectLabReport;
exports.deleteLabReport = deleteLabReport;
const database_1 = __importDefault(require("../../config/database"));
const file_utils_1 = require("../../utils/file.utils");
const error_utils_1 = require("../../utils/error.utils");
const lab_constants_1 = require("../../constants/lab.constants");
const labProcessing_service_1 = require("./labProcessing.service");
const labNormalization_service_1 = require("./labNormalization.service");
const labAudit_service_1 = require("./labAudit.service");
const labAlerts_service_1 = require("./labAlerts.service");
const labDashboard_service_1 = require("./labDashboard.service");
const labRange_utils_1 = require("../../utils/labRange.utils");
const labAccess_service_1 = require("./labAccess.service");
async function processLabReport(reportId, actorUserId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const report = await database_1.default.labReport.findUnique({ where: { id: reportId } });
    if (!report)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.REPORT_NOT_FOUND, 404);
    if (!['uploaded', 'extraction_failed', 'pending_review'].includes(report.extractionStatus)) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.INVALID_STATUS, 400);
    }
    await database_1.default.labReport.update({
        where: { id: reportId },
        data: { extractionStatus: 'processing' },
    });
    try {
        const { buffer } = await (0, file_utils_1.fetchBufferFromUrl)(report.sourcePdfUrl);
        const patient = await database_1.default.patient.findUnique({
            where: { id: report.patientId },
            select: { gender: true, dateOfBirth: true },
        });
        const processed = await (0, labProcessing_service_1.extractAndParseLabPdf)(buffer);
        const { text, engine, pipeline, reportConfidence } = processed;
        const meta = pipeline.metadata;
        const normalized = await (0, labNormalization_service_1.normalizeParsedResults)(processed.parsedLines, {
            patientGender: patient === null || patient === void 0 ? void 0 : patient.gender,
            patientBirthDate: (_a = patient === null || patient === void 0 ? void 0 : patient.dateOfBirth) !== null && _a !== void 0 ? _a : null,
        }, pipeline.candidates);
        await database_1.default.labResult.deleteMany({ where: { labReportId: reportId } });
        const MIN_TEXT_FOR_MANUAL_REVIEW = 80;
        if (normalized.length === 0) {
            if (text.length < MIN_TEXT_FOR_MANUAL_REVIEW) {
                await database_1.default.labReport.update({
                    where: { id: reportId },
                    data: {
                        extractionStatus: 'extraction_failed',
                        extractionEngine: engine,
                        rawText: text.slice(0, 50000),
                        classifiedVendor: pipeline.classification.vendor,
                        parserUsed: pipeline.trace.parserUsed,
                        extractionTraceJson: pipeline.trace,
                    },
                });
                (0, labAudit_service_1.recordLabAuditFireAndForget)({
                    actorUserId,
                    patientId: report.patientId,
                    labReportId: reportId,
                    action: 'extract_failed',
                    metadata: { reason: 'insufficient_text' },
                });
                return database_1.default.labReport.findUnique({ where: { id: reportId }, include: { results: true } });
            }
            const manualReview = await database_1.default.labReport.update({
                where: { id: reportId },
                data: {
                    extractionStatus: 'pending_review',
                    extractionEngine: engine,
                    extractionConfidence: reportConfidence,
                    rawText: text.slice(0, 50000),
                    laboratoryName: (_b = meta.laboratoryName) !== null && _b !== void 0 ? _b : report.laboratoryName,
                    studyType: (_c = meta.studyType) !== null && _c !== void 0 ? _c : report.studyType,
                    studyDate: (_d = meta.studyDate) !== null && _d !== void 0 ? _d : report.studyDate,
                    reportDate: (_e = meta.reportDate) !== null && _e !== void 0 ? _e : report.reportDate,
                    classifiedVendor: pipeline.classification.vendor,
                    parserUsed: pipeline.trace.parserUsed,
                    extractionTraceJson: pipeline.trace,
                },
                include: { results: true },
            });
            (0, labAudit_service_1.recordLabAuditFireAndForget)({
                actorUserId,
                patientId: report.patientId,
                labReportId: reportId,
                action: 'extract',
                metadata: { resultCount: 0, engine, note: 'no_auto_params', parser: pipeline.trace.parserUsed },
            });
            return manualReview;
        }
        await database_1.default.labResult.createMany({
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
        const updated = await database_1.default.labReport.update({
            where: { id: reportId },
            data: {
                extractionStatus: 'pending_review',
                extractionEngine: engine,
                extractionConfidence: reportConfidence,
                rawText: text.slice(0, 50000),
                laboratoryName: (_f = meta.laboratoryName) !== null && _f !== void 0 ? _f : report.laboratoryName,
                studyType: (_g = meta.studyType) !== null && _g !== void 0 ? _g : report.studyType,
                studyDate: (_h = meta.studyDate) !== null && _h !== void 0 ? _h : report.studyDate,
                reportDate: (_j = meta.reportDate) !== null && _j !== void 0 ? _j : report.reportDate,
                classifiedVendor: pipeline.classification.vendor,
                parserUsed: pipeline.trace.parserUsed,
                extractionTraceJson: pipeline.trace,
            },
            include: { results: true },
        });
        (0, labAudit_service_1.recordLabAuditFireAndForget)({
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
    }
    catch (e) {
        await database_1.default.labReport.update({
            where: { id: reportId },
            data: { extractionStatus: 'extraction_failed' },
        });
        (0, labAudit_service_1.recordLabAuditFireAndForget)({
            actorUserId,
            patientId: report.patientId,
            labReportId: reportId,
            action: 'extract_failed',
            metadata: { message: e instanceof Error ? e.message : 'unknown' },
        });
        throw e instanceof error_utils_1.AppError ? e : new error_utils_1.AppError('Error al procesar el PDF de laboratorio', 500);
    }
}
async function listPatientLabReports(patientId) {
    return database_1.default.labReport.findMany({
        where: { patientId, extractionStatus: { not: 'archived' } },
        orderBy: [{ studyDate: 'desc' }, { createdAt: 'desc' }],
        include: {
            results: { orderBy: { analyteNameRaw: 'asc' } },
        },
    });
}
async function getLabReportById(reportId) {
    const report = await database_1.default.labReport.findUnique({
        where: { id: reportId },
        include: { results: { orderBy: { analyteNameRaw: 'asc' } } },
    });
    if (!report)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.REPORT_NOT_FOUND, 404);
    return report;
}
async function applyLabResultCorrections(reportId, corrections) {
    const report = await database_1.default.labReport.findUnique({ where: { id: reportId } });
    if (!report)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.REPORT_NOT_FOUND, 404);
    if (!['pending_review', 'confirmed'].includes(report.extractionStatus)) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.INVALID_STATUS, 400);
    }
    for (const c of corrections) {
        const existing = await database_1.default.labResult.findFirst({
            where: { id: c.id, labReportId: reportId },
        });
        if (!existing)
            throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.RESULT_NOT_FOUND, 404);
        const value = c.resultValue !== undefined ? c.resultValue : existing.resultValue;
        const low = c.referenceRangeLow !== undefined ? c.referenceRangeLow : existing.referenceRangeLow;
        const high = c.referenceRangeHigh !== undefined ? c.referenceRangeHigh : existing.referenceRangeHigh;
        await database_1.default.labResult.update({
            where: { id: c.id },
            data: {
                resultValue: c.resultValue !== undefined ? c.resultValue : undefined,
                resultValueText: c.resultValueText !== undefined ? c.resultValueText : undefined,
                resultUnit: c.resultUnit !== undefined ? c.resultUnit : undefined,
                referenceRangeLow: c.referenceRangeLow !== undefined ? c.referenceRangeLow : undefined,
                referenceRangeHigh: c.referenceRangeHigh !== undefined ? c.referenceRangeHigh : undefined,
                analyteCatalogId: c.analyteCatalogId !== undefined ? c.analyteCatalogId : undefined,
                analyteNameNormalized: c.analyteNameNormalized !== undefined ? c.analyteNameNormalized : undefined,
                abnormalFlag: (0, labRange_utils_1.computeAbnormalFlag)(value, low, high),
                manuallyCorrected: true,
                validationErrorsJson: [],
            },
        });
    }
    return getLabReportById(reportId);
}
async function confirmLabReport(req, reportId, corrections) {
    if (!req.user)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.UNAUTHORIZED, 401);
    const report = await (0, labAccess_service_1.assertReportAccess)(req, reportId);
    if (report.extractionStatus !== 'pending_review') {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.INVALID_STATUS, 400);
    }
    const results = await database_1.default.labResult.findMany({ where: { labReportId: reportId } });
    const hasUncorrectedValidationErrors = results.some((r) => {
        if (r.manuallyCorrected)
            return false;
        const errors = Array.isArray(r.validationErrorsJson) ? r.validationErrorsJson : [];
        return errors.length > 0;
    });
    if (hasUncorrectedValidationErrors && !(corrections === null || corrections === void 0 ? void 0 : corrections.length)) {
        throw new error_utils_1.AppError('Hay indicadores con errores de validación. Corrígelos o guarda borrador antes de confirmar.', 400);
    }
    if (corrections === null || corrections === void 0 ? void 0 : corrections.length) {
        await applyLabResultCorrections(reportId, corrections);
    }
    const confirmed = await database_1.default.labReport.update({
        where: { id: reportId },
        data: {
            extractionStatus: 'confirmed',
            reviewedByUserId: req.user.userId,
            confirmedAt: new Date(),
        },
        include: { results: true },
    });
    (0, labAudit_service_1.recordLabAuditFireAndForget)({
        actorUserId: req.user.userId,
        patientId: confirmed.patientId,
        labReportId: reportId,
        action: 'confirm',
    });
    if (corrections === null || corrections === void 0 ? void 0 : corrections.length) {
        (0, labAudit_service_1.recordLabAuditFireAndForget)({
            actorUserId: req.user.userId,
            patientId: confirmed.patientId,
            labReportId: reportId,
            action: 'manual_correction',
            metadata: { count: corrections.length },
        });
    }
    await (0, labAlerts_service_1.refreshAlertsForPatient)(confirmed.patientId);
    await (0, labDashboard_service_1.refreshDashboardForPatient)(confirmed.patientId);
    return confirmed;
}
async function rejectLabReport(req, reportId, reason) {
    if (!req.user)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.UNAUTHORIZED, 401);
    await (0, labAccess_service_1.assertReportAccess)(req, reportId);
    const rejected = await database_1.default.labReport.update({
        where: { id: reportId },
        data: { extractionStatus: 'rejected' },
        include: { results: true },
    });
    (0, labAudit_service_1.recordLabAuditFireAndForget)({
        actorUserId: req.user.userId,
        patientId: rejected.patientId,
        labReportId: reportId,
        action: 'reject',
        metadata: reason ? { reason } : undefined,
    });
    return rejected;
}
async function deleteLabReport(req, reportId) {
    if (!req.user)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.UNAUTHORIZED, 401);
    const report = await (0, labAccess_service_1.assertReportAccess)(req, reportId);
    const { patientId, sourcePdfUrl, extractionStatus, studyType, studyDate } = report;
    (0, labAudit_service_1.recordLabAuditFireAndForget)({
        actorUserId: req.user.userId,
        patientId,
        labReportId: reportId,
        action: 'delete',
        metadata: {
            extractionStatus,
            studyType: studyType !== null && studyType !== void 0 ? studyType : null,
            studyDate: studyDate ? studyDate.toISOString() : null,
        },
    });
    await database_1.default.labReport.delete({ where: { id: reportId } });
    if (sourcePdfUrl) {
        try {
            await (0, file_utils_1.deleteFromS3)(sourcePdfUrl);
        }
        catch (_a) {
            // El estudio ya no está en la base; el PDF en S3 puede limpiarse después.
        }
    }
    await (0, labAlerts_service_1.refreshAlertsForPatient)(patientId);
    await (0, labDashboard_service_1.refreshDashboardForPatient)(patientId);
    return { deleted: true, id: reportId };
}
