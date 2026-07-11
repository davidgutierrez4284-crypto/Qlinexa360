"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.comparePatientAnalyte = comparePatientAnalyte;
exports.buildMultiReportResultDiffs = buildMultiReportResultDiffs;
exports.buildReportResultDiffs = buildReportResultDiffs;
exports.compareReports = compareReports;
exports.compareTwoReports = compareTwoReports;
const database_1 = __importDefault(require("../../config/database"));
const error_utils_1 = require("../../utils/error.utils");
const lab_constants_1 = require("../../constants/lab.constants");
async function comparePatientAnalyte(patientId, analyteCatalogId, limit = 10) {
    const catalog = await database_1.default.labAnalyteCatalog.findUnique({ where: { id: analyteCatalogId } });
    if (!catalog)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.CATALOG_NOT_FOUND, 404);
    const reports = await database_1.default.labReport.findMany({
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
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.COMPARE_REQUIRES_TWO, 400);
    }
    return {
        analyte: { id: catalog.id, name: catalog.name, category: catalog.category, defaultUnit: catalog.defaultUnit },
        points: points.reverse(),
    };
}
function buildMultiReportResultDiffs(allResults) {
    var _a;
    const keyOrder = [];
    const seen = new Set();
    const keyToName = new Map();
    for (const results of allResults) {
        for (const r of results) {
            const key = (_a = r.analyteCatalogId) !== null && _a !== void 0 ? _a : r.analyteNameRaw;
            if (!seen.has(key)) {
                seen.add(key);
                keyOrder.push(key);
            }
            if (!keyToName.has(key)) {
                keyToName.set(key, r.analyteNameNormalized || r.analyteNameRaw);
            }
        }
    }
    const maps = allResults.map((results) => new Map(results.map((r) => { var _a; return [(_a = r.analyteCatalogId) !== null && _a !== void 0 ? _a : r.analyteNameRaw, r]; })));
    return keyOrder.map((key) => ({
        analyte: keyToName.get(key),
        values: maps.map((m) => { var _a; return (_a = m.get(key)) !== null && _a !== void 0 ? _a : null; }),
    }));
}
function buildReportResultDiffs(resultsA, resultsB) {
    return buildMultiReportResultDiffs([resultsA, resultsB]).map((d) => {
        var _a;
        return ({
            analyte: d.analyte,
            reportA: d.values[0],
            reportB: (_a = d.values[1]) !== null && _a !== void 0 ? _a : null,
        });
    });
}
async function compareReports(reportIds) {
    const unique = [...new Set(reportIds)];
    if (unique.length !== reportIds.length) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.COMPARE_DUPLICATE_REPORTS, 400);
    }
    if (reportIds.length < 2) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.COMPARE_REQUIRES_MIN, 400);
    }
    if (reportIds.length > lab_constants_1.MAX_COMPARE_REPORTS) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.COMPARE_MAX_REPORTS, 400);
    }
    const reports = await Promise.all(reportIds.map((id) => database_1.default.labReport.findUnique({ where: { id }, include: { results: true } })));
    if (reports.some((r) => !r))
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.REPORT_NOT_FOUND, 404);
    const patientId = reports[0].patientId;
    if (reports.some((r) => r.patientId !== patientId)) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.FORBIDDEN, 403);
    }
    if (reports.some((r) => r.extractionStatus !== 'confirmed')) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.INVALID_STATUS, 400);
    }
    const diffs = buildMultiReportResultDiffs(reports.map((r) => r.results));
    return { reports, diffs };
}
async function compareTwoReports(reportIdA, reportIdB) {
    return compareReports([reportIdA, reportIdB]);
}
