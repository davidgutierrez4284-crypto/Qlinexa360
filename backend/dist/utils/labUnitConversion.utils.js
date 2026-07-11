"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryConvertToDefaultUnit = tryConvertToDefaultUnit;
exports.parseNumericValue = parseNumericValue;
/** Conversiones seguras mg/dL <-> mmol/L (glucosa, colesterol, trigliceridos). */
const MG_DL_TO_MMOL = {
    glucosa: 0.0555,
    glucose: 0.0555,
    colesterol: 0.0259,
    cholesterol: 0.0259,
    hdl: 0.0259,
    ldl: 0.0259,
    trigliceridos: 0.0113,
    triglycerides: 0.0113,
};
function normalizeAnalyteKey(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
function tryConvertToDefaultUnit(analyteName, value, fromUnit, defaultUnit) {
    if (!fromUnit || !defaultUnit)
        return null;
    const from = fromUnit.toLowerCase().replace(/\s/g, '');
    const to = defaultUnit.toLowerCase().replace(/\s/g, '');
    if (from === to)
        return { value, unit: defaultUnit };
    const key = normalizeAnalyteKey(analyteName);
    const factorEntry = Object.entries(MG_DL_TO_MMOL).find(([k]) => key.includes(k));
    if (!factorEntry)
        return null;
    const factor = factorEntry[1];
    if (from === 'mg/dl' && to === 'mmol/l') {
        return { value: Math.round(value * factor * 1000) / 1000, unit: defaultUnit };
    }
    if (from === 'mmol/l' && to === 'mg/dl') {
        return { value: Math.round((value / factor) * 100) / 100, unit: defaultUnit };
    }
    return null;
}
function parseNumericValue(raw) {
    const cleaned = raw.replace(/,/g, '.').replace(/[^\d.-]/g, '');
    if (!cleaned)
        return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
}
