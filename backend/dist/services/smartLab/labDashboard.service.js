"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshDashboardForPatient = refreshDashboardForPatient;
exports.getPatientDashboard = getPatientDashboard;
const database_1 = __importDefault(require("../../config/database"));
const lab_constants_1 = require("../../constants/lab.constants");
const labNormalization_service_1 = require("./labNormalization.service");
function worstSeverity(flags) {
    if (flags.some((f) => f === 'critical_low' || f === 'critical_high'))
        return 'red';
    if (flags.some((f) => f === 'low' || f === 'high'))
        return 'yellow';
    if (flags.length && flags.every((f) => f === 'normal'))
        return 'green';
    return 'gray';
}
async function refreshDashboardForPatient(patientId) {
    var _a;
    const reports = await database_1.default.labReport.findMany({
        where: { patientId, extractionStatus: 'confirmed' },
        orderBy: [{ confirmedAt: 'desc' }],
        take: 5,
        include: {
            results: {
                include: { analyteCatalog: { select: { category: true } } },
            },
        },
    });
    const byCategory = {};
    for (const key of Object.keys(lab_constants_1.LAB_DASHBOARD_CATEGORIES)) {
        byCategory[key] = [];
    }
    for (const report of reports) {
        for (const r of report.results) {
            const cat = ((_a = r.analyteCatalog) === null || _a === void 0 ? void 0 : _a.category)
                ? (0, labNormalization_service_1.mapCatalogCategoryToDashboard)(r.analyteCatalog.category)
                : 'otros';
            if (!byCategory[cat])
                byCategory[cat] = [];
            byCategory[cat].push(r.abnormalFlag);
        }
    }
    for (const [category, flags] of Object.entries(byCategory)) {
        const status = worstSeverity(flags);
        const summary = flags.length === 0
            ? 'Sin resultados recientes en esta categoria.'
            : `${flags.length} analito(s) evaluados en estudios confirmados recientes.`;
        await database_1.default.labHealthDashboardScore.upsert({
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
async function getPatientDashboard(patientId) {
    const scores = await database_1.default.labHealthDashboardScore.findMany({
        where: { patientId },
        orderBy: { category: 'asc' },
    });
    return scores.map((s) => (Object.assign(Object.assign({}, s), { label: (0, labNormalization_service_1.dashboardCategoryLabel)(s.category) })));
}
