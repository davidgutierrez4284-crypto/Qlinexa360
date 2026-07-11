"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapCatalogCategoryToDashboard = mapCatalogCategoryToDashboard;
exports.aliasMatchesAnalyteName = aliasMatchesAnalyteName;
exports.catalogMatchScore = catalogMatchScore;
exports.resolveAnalyteDisplayName = resolveAnalyteDisplayName;
exports.loadActiveCatalog = loadActiveCatalog;
exports.normalizeParsedLine = normalizeParsedLine;
exports.normalizeParsedResults = normalizeParsedResults;
exports.dashboardCategoryLabel = dashboardCategoryLabel;
const database_1 = __importDefault(require("../../config/database"));
const lab_constants_1 = require("../../constants/lab.constants");
const labUnitConversion_utils_1 = require("../../utils/labUnitConversion.utils");
const labRange_utils_1 = require("../../utils/labRange.utils");
function normalizeToken(s) {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
function normalizeUnitToken(u) {
    return u.toLowerCase().replace(/µ/g, 'μ').trim();
}
function mapCatalogCategoryToDashboard(category) {
    const n = normalizeToken(category);
    for (const [alias, key] of Object.entries(lab_constants_1.LAB_CATEGORY_ALIASES)) {
        if (n.includes(alias))
            return key;
    }
    if (n.includes('hemat') || n.includes('hemograma'))
        return 'hematologia';
    if (n.includes('quimica') || n.includes('bioquimica'))
        return 'quimica_sanguinea';
    if (n.includes('lipid'))
        return 'perfil_lipidico';
    if (n.includes('hepat') || n.includes('hepatic'))
        return 'funcion_hepatica';
    if (n.includes('renal'))
        return 'funcion_renal';
    if (n.includes('tiroid') || n.includes('tiro'))
        return 'tiroides';
    if (n.includes('electrolit'))
        return 'electrolitos';
    return 'otros';
}
function tokensOf(s) {
    return normalizeToken(s).split(/\s+/).filter(Boolean);
}
function tokenEquivalent(a, b) {
    if (a === b)
        return true;
    if (a.length > 3 && a.endsWith('s') && a.slice(0, -1) === b)
        return true;
    if (b.length > 3 && b.endsWith('s') && b.slice(0, -1) === a)
        return true;
    return false;
}
function rawHasToken(rawTokens, token) {
    return rawTokens.some((t) => tokenEquivalent(t, token));
}
/** Símbolos químicos cortos → nombres completos aceptados (evita "Na" dentro de "insulina", "Mg" dentro de "mg/dL"). */
const SHORT_SYMBOL_FULL_NAMES = {
    na: ['sodio', 'sodium'],
    k: ['potasio', 'potassium'],
    cl: ['cloro', 'chloride', 'cloruro'],
    mg: ['magnesio', 'magnesium'],
};
const LIPID_SUBTYPE_TOKENS = new Set(['hdl', 'ldl', 'vldl']);
function isNonHdlCholesterol(rawTokens) {
    for (let i = 0; i < rawTokens.length - 1; i++) {
        const t = rawTokens[i];
        const next = rawTokens[i + 1];
        if ((t === 'no' || t === 'non') && tokenEquivalent(next, 'hdl'))
            return true;
    }
    return false;
}
function hasLipidSubtypeQualifier(rawTokens) {
    if (rawTokens.some((t) => LIPID_SUBTYPE_TOKENS.has(t)))
        return true;
    return isNonHdlCholesterol(rawTokens);
}
function aliasMatchesAnalyteName(alias, rawName) {
    const a = normalizeToken(alias);
    const r = normalizeToken(rawName);
    if (!a || !r)
        return false;
    if (r === a)
        return true;
    // Símbolos cortos (Na, K, Cl, Mg): token completo o nombre químico completo, nunca substring
    if (a.length <= 3) {
        const fullNames = SHORT_SYMBOL_FULL_NAMES[a];
        if (fullNames) {
            return fullNames.some((fn) => r === fn || tokensOf(rawName).includes(fn));
        }
        if (tokensOf(rawName).includes(a))
            return true;
        return false;
    }
    const aliasTokens = tokensOf(alias);
    const rawTokens = tokensOf(rawName);
    // Colesterol no-HDL: el token "hdl" no debe emparejar alias de HDL
    if (aliasTokens.some((t) => tokenEquivalent(t, 'hdl')) && isNonHdlCholesterol(rawTokens)) {
        return false;
    }
    // Alias multi-palabra: todos los tokens del alias deben aparecer en el nombre crudo
    if (aliasTokens.length > 1 && aliasTokens.every((t) => rawHasToken(rawTokens, t)))
        return true;
    // Alias de una palabra: coincidencia por token completo (evita "globulina" dentro de "inmunoglobulina")
    if (aliasTokens.length === 1 && rawHasToken(rawTokens, aliasTokens[0])) {
        // "Colesterol" genérico no debe absorber HDL/LDL/VLDL/no-HDL
        if (aliasTokens[0] === 'colesterol' && hasLipidSubtypeQualifier(rawTokens))
            return false;
        return true;
    }
    return false;
}
/** Puntuación de especificidad del match catálogo ↔ nombre crudo (mayor = más específico). */
function catalogMatchScore(entry, rawName) {
    const names = [entry.name, ...(Array.isArray(entry.aliasesJson) ? entry.aliasesJson : [])];
    let best = 0;
    for (const alias of names) {
        if (!aliasMatchesAnalyteName(alias, rawName))
            continue;
        const aNorm = normalizeToken(alias);
        const rNorm = normalizeToken(rawName);
        if (rNorm === aNorm)
            return 10000 + aNorm.length;
        const aliasTokens = tokensOf(alias);
        const rawTokens = tokensOf(rawName);
        if (aliasTokens.length > 1 && aliasTokens.every((t) => rawHasToken(rawTokens, t))) {
            best = Math.max(best, 5000 + aNorm.length);
        }
        else if (aliasTokens.length === 1 && rawHasToken(rawTokens, aliasTokens[0])) {
            best = Math.max(best, 1000 + aNorm.length);
        }
    }
    return best;
}
/** Conserva el nombre crudo cuando es más específico que el canónico del catálogo. */
function resolveAnalyteDisplayName(rawName, match) {
    const raw = rawName.trim();
    const catalog = match.name;
    if (normalizeToken(raw) === normalizeToken(catalog))
        return catalog;
    const rawTokens = tokensOf(raw);
    const catalogTokens = tokensOf(catalog);
    const aliases = Array.isArray(match.aliasesJson) ? match.aliasesJson : [];
    if (aliases.some((a) => normalizeToken(a) === normalizeToken(raw))) {
        if (catalog.length <= 5 && raw.length > catalog.length)
            return raw;
        return catalog;
    }
    // Variante con paréntesis o sufijo sobre el nombre canónico (p. ej. Vitamina D (25 Hidroxi))
    if (catalogTokens.length > 0 &&
        catalogTokens.every((t) => rawHasToken(rawTokens, t)) &&
        raw.toLowerCase().startsWith(catalog.toLowerCase())) {
        return catalog;
    }
    // Nombre canónico abreviado (HbA1c, HCM, IgA): preferir forma descriptiva del PDF
    if (catalog.length <= 5 && raw.length > catalog.length)
        return raw;
    if (catalogTokens.length > 0 &&
        catalogTokens.every((t) => rawHasToken(rawTokens, t)) &&
        rawTokens.length > catalogTokens.length) {
        return raw;
    }
    const matchingLabels = [catalog, ...aliases]
        .filter((a) => aliasMatchesAnalyteName(a, raw))
        .sort((a, b) => normalizeToken(b).length - normalizeToken(a).length);
    const bestLabel = matchingLabels[0];
    if (bestLabel && normalizeToken(raw).length >= normalizeToken(bestLabel).length && raw.length > catalog.length) {
        return raw;
    }
    return catalog;
}
function catalogMatchesName(entry, rawName) {
    const names = [entry.name, ...(Array.isArray(entry.aliasesJson) ? entry.aliasesJson : [])];
    return names.some((alias) => aliasMatchesAnalyteName(alias, rawName));
}
function findBestCatalogMatch(rawName, unit, catalog) {
    const matches = catalog.filter((c) => catalogMatchesName(c, rawName));
    if (matches.length === 0)
        return undefined;
    if (matches.length === 1)
        return matches[0];
    const unitCompatible = matches.filter((m) => unitAllowedForCatalog(unit, m));
    const pool = unitCompatible.length > 0 ? unitCompatible : matches;
    return pool.sort((a, b) => catalogMatchScore(b, rawName) - catalogMatchScore(a, rawName))[0];
}
function unitAllowedForCatalog(unit, match) {
    if (!unit)
        return true;
    const allowed = Array.isArray(match.allowedUnitsJson) ? match.allowedUnitsJson : [];
    if (allowed.length === 0)
        return true;
    const u = normalizeUnitToken(unit);
    return allowed.some((a) => normalizeUnitToken(a) === u || u.includes(normalizeUnitToken(a)));
}
async function loadActiveCatalog() {
    return database_1.default.labAnalyteCatalog.findMany({
        where: { active: true },
        select: {
            id: true,
            category: true,
            name: true,
            aliasesJson: true,
            defaultUnit: true,
            defaultReferenceLow: true,
            defaultReferenceHigh: true,
            allowedUnitsJson: true,
            sexSpecific: true,
            ageSpecific: true,
        },
    });
}
function normalizeParsedLine(line, catalog, context = {}, validationErrors = []) {
    var _a;
    let value = line.resultValue;
    let unit = line.resultUnit;
    const match = findBestCatalogMatch(line.analyteNameRaw, unit, catalog);
    let low = line.referenceRangeLow;
    let high = line.referenceRangeHigh;
    let rangeText = line.referenceRangeText;
    const errors = [...validationErrors];
    if (match) {
        if (unit && !unitAllowedForCatalog(unit, match)) {
            errors.push(`Unidad ${unit} no permitida para ${match.name}`);
        }
        if (value != null && unit && match.defaultUnit) {
            const converted = (0, labUnitConversion_utils_1.tryConvertToDefaultUnit)(match.name, value, unit, match.defaultUnit);
            if (converted) {
                value = converted.value;
                unit = converted.unit;
            }
        }
        if (low == null && match.defaultReferenceLow != null)
            low = match.defaultReferenceLow;
        if (high == null && match.defaultReferenceHigh != null)
            high = match.defaultReferenceHigh;
        if (!rangeText && low != null && high != null)
            rangeText = `${low}-${high}`;
        if (match.sexSpecific && context.patientGender) {
            // Rangos sexo-específicos requieren curación en catálogo; por ahora solo anotamos contexto.
            void context.patientGender;
        }
        if (match.ageSpecific && context.patientBirthDate) {
            void context.patientBirthDate;
        }
    }
    const abnormalFlag = (0, labRange_utils_1.computeAbnormalFlag)(value, low, high);
    const dashboardCategory = match ? mapCatalogCategoryToDashboard(match.category) : 'otros';
    let confidence = match ? Math.min(0.95, line.confidence + 0.08) : line.confidence;
    if (errors.length > 0)
        confidence = Math.max(0.1, confidence - errors.length * 0.1);
    return {
        analyteNameRaw: line.analyteNameRaw,
        analyteNameNormalized: match ? resolveAnalyteDisplayName(line.analyteNameRaw, match) : null,
        analyteCatalogId: (_a = match === null || match === void 0 ? void 0 : match.id) !== null && _a !== void 0 ? _a : null,
        resultValue: value,
        resultValueText: line.resultValueText,
        resultUnit: unit,
        referenceRangeLow: low,
        referenceRangeHigh: high,
        referenceRangeText: rangeText,
        abnormalFlag,
        extractionConfidence: confidence,
        rawTextSnippet: line.rawTextSnippet,
        validationErrorsJson: errors,
        dashboardCategory,
    };
}
async function normalizeParsedResults(lines, context = {}, candidates) {
    const catalog = await loadActiveCatalog();
    return lines.map((line, idx) => {
        var _a, _b;
        const validationErrors = (_b = (_a = candidates === null || candidates === void 0 ? void 0 : candidates[idx]) === null || _a === void 0 ? void 0 : _a.validationErrors) !== null && _b !== void 0 ? _b : [];
        return normalizeParsedLine(line, catalog, context, validationErrors);
    });
}
function dashboardCategoryLabel(key) {
    var _a;
    return (_a = lab_constants_1.LAB_DASHBOARD_CATEGORIES[key]) !== null && _a !== void 0 ? _a : lab_constants_1.LAB_DASHBOARD_CATEGORIES.otros;
}
