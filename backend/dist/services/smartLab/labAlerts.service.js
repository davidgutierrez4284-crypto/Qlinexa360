"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAbnormalFlagToLabSeverity = mapAbnormalFlagToLabSeverity;
exports.refreshAlertsForPatient = refreshAlertsForPatient;
exports.listPatientAlerts = listPatientAlerts;
exports.dismissLabAlert = dismissLabAlert;
const database_1 = __importDefault(require("../../config/database"));
const lab_constants_1 = require("../../constants/lab.constants");
const smartLab_config_1 = require("../../config/smartLab.config");
function mapAbnormalFlagToLabSeverity(flag) {
    if (flag === 'critical_low' || flag === 'critical_high')
        return 'red';
    if (flag === 'low' || flag === 'high')
        return 'yellow';
    if (flag === 'normal')
        return 'green';
    return 'gray';
}
async function refreshAlertsForPatient(patientId) {
    var _a, _b, _c;
    const latestReport = await database_1.default.labReport.findFirst({
        where: { patientId, extractionStatus: 'confirmed' },
        orderBy: [{ confirmedAt: 'desc' }, { createdAt: 'desc' }],
        include: { results: true },
    });
    if (!latestReport)
        return;
    for (const result of latestReport.results) {
        if (!['low', 'high', 'critical_low', 'critical_high'].includes(result.abnormalFlag))
            continue;
        const existing = await database_1.default.labAlert.findFirst({
            where: {
                patientId,
                labResultId: result.id,
                dismissedAt: null,
            },
        });
        if (existing)
            continue;
        const severity = mapAbnormalFlagToLabSeverity(result.abnormalFlag);
        const title = result.analyteNameNormalized || result.analyteNameRaw;
        await database_1.default.labAlert.create({
            data: {
                patientId,
                labResultId: result.id,
                analyteCatalogId: result.analyteCatalogId,
                alertType: severity === 'red' ? 'critical' : 'out_of_range',
                severity,
                title,
                message: `${lab_constants_1.LAB_ALERT_NON_DIAGNOSTIC_PREFIX} ${title}: ${(_b = (_a = result.resultValueText) !== null && _a !== void 0 ? _a : result.resultValue) !== null && _b !== void 0 ? _b : 'N/D'} ${(_c = result.resultUnit) !== null && _c !== void 0 ? _c : ''}`.trim(),
            },
        });
    }
    await evaluateTrendAlerts(patientId);
    await evaluateMissingFollowupAlert(patientId);
}
async function evaluateTrendAlerts(patientId) {
    var _a;
    const confirmed = await database_1.default.labReport.findMany({
        where: { patientId, extractionStatus: 'confirmed' },
        orderBy: [{ confirmedAt: 'desc' }],
        take: 2,
        include: { results: true },
    });
    if (confirmed.length < 2)
        return;
    const [newer, older] = confirmed;
    const olderMap = new Map(older.results.map((r) => { var _a; return [(_a = r.analyteCatalogId) !== null && _a !== void 0 ? _a : r.analyteNameRaw, r]; }));
    for (const r of newer.results) {
        if (r.resultValue == null)
            continue;
        const key = (_a = r.analyteCatalogId) !== null && _a !== void 0 ? _a : r.analyteNameRaw;
        const prev = olderMap.get(key);
        if (!prev || prev.resultValue == null || prev.resultValue === 0)
            continue;
        const pct = ((r.resultValue - prev.resultValue) / Math.abs(prev.resultValue)) * 100;
        if (Math.abs(pct) < 15)
            continue;
        const alertType = pct > 0 ? 'trend_up' : 'trend_down';
        const dup = await database_1.default.labAlert.findFirst({
            where: { patientId, labResultId: r.id, alertType, dismissedAt: null },
        });
        if (dup)
            continue;
        await database_1.default.labAlert.create({
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
async function evaluateMissingFollowupAlert(patientId) {
    const months = (0, smartLab_config_1.getSmartLabMissingFollowupMonths)();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const last = await database_1.default.labReport.findFirst({
        where: { patientId, extractionStatus: 'confirmed' },
        orderBy: [{ confirmedAt: 'desc' }],
    });
    if (!(last === null || last === void 0 ? void 0 : last.confirmedAt) || last.confirmedAt > cutoff)
        return;
    const dup = await database_1.default.labAlert.findFirst({
        where: { patientId, alertType: 'missing_followup', dismissedAt: null },
    });
    if (dup)
        return;
    await database_1.default.labAlert.create({
        data: {
            patientId,
            alertType: 'missing_followup',
            severity: 'gray',
            title: 'Seguimiento de laboratorio',
            message: `No hay estudios confirmados en los ultimos ${months} meses.`,
        },
    });
}
async function listPatientAlerts(patientId, includeDismissed = false) {
    return database_1.default.labAlert.findMany({
        where: Object.assign({ patientId }, (includeDismissed ? {} : { dismissedAt: null })),
        orderBy: { createdAt: 'desc' },
    });
}
async function dismissLabAlert(alertId, userId) {
    const alert = await database_1.default.labAlert.findUnique({ where: { id: alertId } });
    if (!alert)
        return null;
    return database_1.default.labAlert.update({
        where: { id: alertId },
        data: { dismissedAt: new Date(), dismissedByUserId: userId },
    });
}
