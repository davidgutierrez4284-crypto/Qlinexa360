"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferAnalyteFromUnitRange = inferAnalyteFromUnitRange;
function unitToken(unit) {
    return (unit !== null && unit !== void 0 ? unit : '').toLowerCase().replace(/µ/g, 'μ').trim();
}
/**
 * Corrige nombres mal asignados usando la firma unidad + rango de referencia.
 * Evita falsos positivos como "Sodio" para Insulina basal (14.68 μUI/mL).
 */
function inferAnalyteFromUnitRange(candidate) {
    const u = unitToken(candidate.unit);
    const low = candidate.referenceLow;
    const high = candidate.referenceHigh;
    const name = candidate.rawName.trim();
    const nameLower = name.toLowerCase();
    if (/μui|µui|uui|mui/.test(u) && low != null && high != null && low >= 2 && high <= 30) {
        if (!nameLower.includes('insulina')) {
            return Object.assign(Object.assign({}, candidate), { rawName: 'Insulina basal', canonicalName: 'Insulina', validationErrors: [
                    ...candidate.validationErrors,
                    `Nombre corregido de "${name}" a Insulina basal por unidad/rango`,
                ] });
        }
    }
    // Firma típica vitamina D 25-hidroxi (30-100 ng/mL) con nombre mal asignado (p. ej. "Sodio")
    if (/ng\/ml/.test(u) &&
        low != null &&
        high != null &&
        low >= 25 &&
        high <= 120 &&
        candidate.value != null &&
        candidate.value >= 5 &&
        candidate.value <= 200 &&
        !/vitamina|vit d|25-oh|25 hidroxi|ferritina|b12|estradiol|prolactina/i.test(nameLower)) {
        return Object.assign(Object.assign({}, candidate), { rawName: 'Vitamina D (25 Hidroxi)', canonicalName: 'Vitamina D', validationErrors: [
                ...candidate.validationErrors,
                `Nombre corregido de "${name}" a Vitamina D (25 Hidroxi) por unidad/rango`,
            ] });
    }
    if ((/^sodio$/i.test(name) || /^potasio$/i.test(name) || /^cloro$/i.test(name)) &&
        !/meq|mmol/.test(u)) {
        return Object.assign(Object.assign({}, candidate), { validationErrors: [
                ...candidate.validationErrors,
                'Electrolito con unidad incompatible; posible desalineación del PDF (dato descartado)',
            ], confidence: 0.05 });
    }
    return candidate;
}
