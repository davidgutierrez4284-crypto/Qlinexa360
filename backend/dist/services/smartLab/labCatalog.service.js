"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAnalyteCatalog = listAnalyteCatalog;
exports.createAnalyteCatalogEntry = createAnalyteCatalogEntry;
exports.updateAnalyteCatalogEntry = updateAnalyteCatalogEntry;
exports.getSmartLabAdminMetrics = getSmartLabAdminMetrics;
const database_1 = __importDefault(require("../../config/database"));
const error_utils_1 = require("../../utils/error.utils");
const lab_constants_1 = require("../../constants/lab.constants");
async function listAnalyteCatalog(options = {}) {
    const { activeOnly = true, category } = options;
    const where = {};
    if (activeOnly)
        where.active = true;
    if (category === null || category === void 0 ? void 0 : category.trim())
        where.category = category.trim();
    const items = await database_1.default.labAnalyteCatalog.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return items;
}
async function createAnalyteCatalogEntry(input) {
    var _a, _b, _c, _d, _e, _f, _g;
    const category = String(input.category || '').trim();
    const name = String(input.name || '').trim();
    if (!category || !name)
        throw new error_utils_1.AppError('category y name son requeridos', 400);
    const entry = await database_1.default.labAnalyteCatalog.create({
        data: {
            category,
            name,
            aliasesJson: Array.isArray(input.aliasesJson) ? input.aliasesJson : [],
            loincCode: (_a = input.loincCode) !== null && _a !== void 0 ? _a : null,
            allowedUnitsJson: Array.isArray(input.allowedUnitsJson) ? input.allowedUnitsJson : [],
            defaultUnit: (_b = input.defaultUnit) !== null && _b !== void 0 ? _b : null,
            defaultReferenceLow: (_c = input.defaultReferenceLow) !== null && _c !== void 0 ? _c : null,
            defaultReferenceHigh: (_d = input.defaultReferenceHigh) !== null && _d !== void 0 ? _d : null,
            referenceNotes: (_e = input.referenceNotes) !== null && _e !== void 0 ? _e : null,
            sexSpecific: (_f = input.sexSpecific) !== null && _f !== void 0 ? _f : false,
            ageSpecific: (_g = input.ageSpecific) !== null && _g !== void 0 ? _g : false,
            active: input.active !== false,
        },
    });
    return entry;
}
async function updateAnalyteCatalogEntry(id, input) {
    const existing = await database_1.default.labAnalyteCatalog.findUnique({ where: { id } });
    if (!existing)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.CATALOG_NOT_FOUND, 404);
    const data = {};
    if (input.category !== undefined) {
        const category = String(input.category).trim();
        if (!category)
            throw new error_utils_1.AppError('category no puede estar vacio', 400);
        data.category = category;
    }
    if (input.name !== undefined) {
        const name = String(input.name).trim();
        if (!name)
            throw new error_utils_1.AppError('name no puede estar vacio', 400);
        data.name = name;
    }
    if (input.aliasesJson !== undefined) {
        data.aliasesJson = Array.isArray(input.aliasesJson) ? input.aliasesJson : [];
    }
    if (input.loincCode !== undefined)
        data.loincCode = input.loincCode;
    if (input.allowedUnitsJson !== undefined) {
        data.allowedUnitsJson = Array.isArray(input.allowedUnitsJson) ? input.allowedUnitsJson : [];
    }
    if (input.defaultUnit !== undefined)
        data.defaultUnit = input.defaultUnit;
    if (input.defaultReferenceLow !== undefined)
        data.defaultReferenceLow = input.defaultReferenceLow;
    if (input.defaultReferenceHigh !== undefined)
        data.defaultReferenceHigh = input.defaultReferenceHigh;
    if (input.referenceNotes !== undefined)
        data.referenceNotes = input.referenceNotes;
    if (input.sexSpecific !== undefined)
        data.sexSpecific = input.sexSpecific;
    if (input.ageSpecific !== undefined)
        data.ageSpecific = input.ageSpecific;
    if (input.active !== undefined)
        data.active = input.active;
    return database_1.default.labAnalyteCatalog.update({ where: { id }, data });
}
async function getSmartLabAdminMetrics() {
    const [reportsTotal, reportsByStatus, alertsOpen, catalogActive, catalogTotal, patientsWithReports, manuallyCorrected, reportsWithTrace, vendorBreakdown,] = await Promise.all([
        database_1.default.labReport.count(),
        database_1.default.labReport.groupBy({ by: ['extractionStatus'], _count: { _all: true } }),
        database_1.default.labAlert.count({ where: { dismissedAt: null } }),
        database_1.default.labAnalyteCatalog.count({ where: { active: true } }),
        database_1.default.labAnalyteCatalog.count(),
        database_1.default.labReport.findMany({ distinct: ['patientId'], select: { patientId: true } }),
        database_1.default.labResult.count({ where: { manuallyCorrected: true } }),
        database_1.default.labReport.findMany({
            where: { parserUsed: { not: null } },
            select: { extractionTraceJson: true, classifiedVendor: true, parserUsed: true },
        }),
        database_1.default.labReport.groupBy({
            by: ['classifiedVendor'],
            _count: { _all: true },
            where: { classifiedVendor: { not: null } },
        }),
    ]);
    const statusCounts = Object.fromEntries(reportsByStatus.map((row) => [row.extractionStatus, row._count._all]));
    const traceRows = reportsWithTrace
        .map((r) => r.extractionTraceJson)
        .filter(Boolean);
    const avgProcessingMs = traceRows.length > 0
        ? traceRows.reduce((sum, t) => { var _a; return sum + ((_a = t === null || t === void 0 ? void 0 : t.processingMs) !== null && _a !== void 0 ? _a : 0); }, 0) / traceRows.length
        : null;
    const avgExtractedRows = traceRows.length > 0
        ? traceRows.reduce((sum, t) => { var _a; return sum + ((_a = t === null || t === void 0 ? void 0 : t.rowCount) !== null && _a !== void 0 ? _a : 0); }, 0) / traceRows.length
        : null;
    const totalResults = await database_1.default.labResult.count();
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
            vendorBreakdown: Object.fromEntries(vendorBreakdown.map((v) => { var _a; return [(_a = v.classifiedVendor) !== null && _a !== void 0 ? _a : 'unknown', v._count._all]; })),
        },
    };
}
