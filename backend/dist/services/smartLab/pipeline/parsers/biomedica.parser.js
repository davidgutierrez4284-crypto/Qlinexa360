"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.biomedicaParser = void 0;
exports.parseBiomedicaResults = parseBiomedicaResults;
const labUnitConversion_utils_1 = require("../../../../utils/labUnitConversion.utils");
const chopoParser_service_1 = require("../../chopoParser.service");
const BIOMEDICA_MARKER = /\bbiom[eé]dica\b|biom[eé]dica\s+de\s+referencia|biom[eé]dica\s+an[aá]lisis\s+cl[ií]nicos|bioderef\.com/i;
const BIOMEDICA_SKIP = /^(p[aá]gina|paciente:|sexo:|edad:|registro:|centro de toma|dr\.?\(a\)|c[oó]digo:|fecha\s+toma|f\.?\s*n\.?\s*:|f\/n|examenresultado|examen\s*microscopico|observaciones|contin[uú]a|\.\.\.|aviso|privacidad|formato de fechas|www\.|^\*+\s*\(|resultados fuera)/i;
const METHOD_LINE = /^\s*m[eé]todo\b/i;
const SECTION_OR_PANEL = /^(biometria|hemograma|examen general de orina|qu[ií]mica|perfil\s+)/i;
const REFERENCE_TIER = /^(deseable|normal|bajo(\s+riesgo|\s+menor)?|alto(\s+riesgo|\s+mayor|\s+160)?|lim[ií]trofe|muy\s+alto|moderado|[oó]ptimo|ideal|t[oó]xico|negativo|premenopausia|posmenopausia|hipotiroidismo|valor(es)?\s+(de\s+)?referencia|recomendados\s+por|valor de referencia de acuerdo|a\s+la\s+asociacion|diabetes\s+\(ada\)|por\s+cambios|anal[ií]ticos?\.?|a\s+partir\s+del\s+\d+)/i;
const DATE_FRAGMENT = /^(a\s+partir\s+del|del\s+\d+\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))/i;
const VALUE_ONLY = /^[<>*]?\s*[\d.,]+$/;
const GLUED_NAME_VALUE = /^([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9()/\s,#%-]{1,72}?)([<>*]?\s*[\d.,]+)$/;
function shouldSkipBiomedicaLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 2)
        return true;
    if (BIOMEDICA_SKIP.test(trimmed))
        return true;
    if (REFERENCE_TIER.test(trimmed))
        return true;
    if (DATE_FRAGMENT.test(trimmed))
        return true;
    if (/^<\s*[\d.,]+\s*a[nñ]os\b/i.test(trimmed))
        return true;
    if (/^>\s*[\d.,]+\s*a[nñ]os\b/i.test(trimmed))
        return true;
    if (/^\d+\s*[-–—]\s*\d+\s+(mg\/dL|mg\/dl|g\/dL|%)/i.test(trimmed))
        return true;
    if (/^mayor\s+de\s+\d+/i.test(trimmed))
        return true;
    if (/^menor\s+de\s+\d+/i.test(trimmed))
        return true;
    if (/^[\d.,]+\s*[-–—]\s*[\d.,]+\s+(normal|prediabetes|diabetes|bajo|moderado|ideal)/i.test(trimmed))
        return true;
    if (/^no\s+se\s+(observ|observa)/i.test(trimmed))
        return true;
    if (/^escasas?\.?$/i.test(trimmed))
        return true;
    if (/^transparente$/i.test(trimmed))
        return true;
    if (/^amarillo$/i.test(trimmed))
        return true;
    return false;
}
function parseUnitLine(line) {
    const token = (0, chopoParser_service_1.extractKnownUnitToken)(line);
    if (token)
        return token;
    const cleaned = line.trim();
    if ((0, chopoParser_service_1.isValidLabUnit)(cleaned))
        return cleaned;
    return null;
}
function parseBiomedicaRange(line) {
    var _a, _b, _c;
    const trimmed = line.trim();
    if (!trimmed || shouldSkipBiomedicaLine(trimmed))
        return null;
    const paired = trimmed.match(/^([<>*]?\s*[\d.,]+)\s*[-–—]\s*([\d.,]+)\s*(.*)$/i);
    if (paired) {
        const unit = ((_a = paired[3]) === null || _a === void 0 ? void 0 : _a.trim()) || null;
        return {
            low: (0, labUnitConversion_utils_1.parseNumericValue)(paired[1]),
            high: (0, labUnitConversion_utils_1.parseNumericValue)(paired[2]),
            unit: unit && (0, chopoParser_service_1.isValidLabUnit)(unit) ? unit : null,
            rangeText: `${paired[1].trim()}-${paired[2].trim()}`,
        };
    }
    const upper = trimmed.match(/^<\s*([\d.,]+)\s*(.*)$/i);
    if (upper) {
        const unit = ((_b = upper[2]) === null || _b === void 0 ? void 0 : _b.trim()) || null;
        return {
            low: null,
            high: (0, labUnitConversion_utils_1.parseNumericValue)(upper[1]),
            unit: unit && (0, chopoParser_service_1.isValidLabUnit)(unit) ? unit : null,
            rangeText: trimmed,
        };
    }
    const lower = trimmed.match(/^>\s*([\d.,]+)\s*(.*)$/i);
    if (lower) {
        const unit = ((_c = lower[2]) === null || _c === void 0 ? void 0 : _c.trim()) || null;
        return {
            low: (0, labUnitConversion_utils_1.parseNumericValue)(lower[1]),
            high: null,
            unit: unit && (0, chopoParser_service_1.isValidLabUnit)(unit) ? unit : null,
            rangeText: trimmed,
        };
    }
    return null;
}
function scoreBiomedicaRow(row) {
    let c = 0.78;
    if (row.value != null)
        c += 0.1;
    if (row.unit)
        c += 0.05;
    if (row.referenceLow != null || row.referenceHigh != null)
        c += 0.07;
    return Math.min(0.95, c);
}
function pushRow(results, seen, row) {
    const key = row.rawName.toLowerCase();
    if (seen.has(key))
        return;
    seen.add(key);
    const candidate = Object.assign(Object.assign({}, row), { canonicalName: null, validationErrors: [], confidence: 0 });
    candidate.confidence = scoreBiomedicaRow(candidate);
    results.push(candidate);
}
function skipMethodLines(lines, startIdx) {
    let idx = startIdx;
    while (idx < lines.length && METHOD_LINE.test(lines[idx]))
        idx++;
    return idx;
}
function isLikelyAnalyteName(line) {
    if (shouldSkipBiomedicaLine(line))
        return false;
    if (SECTION_OR_PANEL.test(line) && !/,|\(CL\d+\)/i.test(line))
        return false;
    if (/^\s*m[eé]todo\b/i.test(line))
        return false;
    return (0, chopoParser_service_1.isValidAnalyteName)(line);
}
function parseGluedNameValue(line) {
    const match = line.match(GLUED_NAME_VALUE);
    if (!match)
        return null;
    const name = match[1].replace(/\s+/g, ' ').trim();
    if (!isLikelyAnalyteName(name))
        return null;
    return { name, valueRaw: match[2].replace(/\s+/g, '').trim() };
}
function parseBiomedicaResults(text) {
    var _a, _b, _c, _d;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const results = [];
    const seen = new Set();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (shouldSkipBiomedicaLine(line))
            continue;
        const glued = parseGluedNameValue(line);
        if (glued) {
            let unit = null;
            let low = null;
            let high = null;
            let rangeText = null;
            let consumed = 1;
            const unitIdx = i + consumed;
            if (unitIdx < lines.length) {
                const unitCandidate = parseUnitLine(lines[unitIdx]);
                if (unitCandidate && !VALUE_ONLY.test(lines[unitIdx])) {
                    unit = unitCandidate;
                    consumed++;
                    const rangeIdx = i + consumed;
                    if (rangeIdx < lines.length) {
                        const parsedRange = parseBiomedicaRange(lines[rangeIdx]);
                        if (parsedRange) {
                            unit = (_a = parsedRange.unit) !== null && _a !== void 0 ? _a : unit;
                            low = parsedRange.low;
                            high = parsedRange.high;
                            rangeText = parsedRange.rangeText;
                            consumed++;
                        }
                    }
                }
                else {
                    const parsedRange = parseBiomedicaRange(lines[unitIdx]);
                    if (parsedRange) {
                        unit = (_b = parsedRange.unit) !== null && _b !== void 0 ? _b : unit;
                        low = parsedRange.low;
                        high = parsedRange.high;
                        rangeText = parsedRange.rangeText;
                        consumed++;
                    }
                }
            }
            pushRow(results, seen, {
                rawName: glued.name,
                value: (0, labUnitConversion_utils_1.parseNumericValue)(glued.valueRaw),
                valueText: glued.valueRaw,
                unit,
                referenceLow: low,
                referenceHigh: high,
                referenceText: rangeText,
                sourceLines: lines.slice(i, i + consumed),
            });
            i += consumed - 1;
            continue;
        }
        if (!isLikelyAnalyteName(line))
            continue;
        let idx = skipMethodLines(lines, i + 1);
        if (idx >= lines.length)
            continue;
        const valueLine = lines[idx];
        if (!VALUE_ONLY.test(valueLine))
            continue;
        const valueRaw = valueLine.replace(/\s+/g, '').trim();
        let unit = null;
        let low = null;
        let high = null;
        let rangeText = null;
        let consumed = idx - i + 1;
        idx++;
        if (idx < lines.length) {
            const unitCandidate = parseUnitLine(lines[idx]);
            if (unitCandidate && !isLikelyAnalyteName(lines[idx]) && !VALUE_ONLY.test(lines[idx])) {
                unit = unitCandidate;
                consumed = idx - i + 1;
                idx++;
                if (idx < lines.length) {
                    const parsedRange = parseBiomedicaRange(lines[idx]);
                    if (parsedRange) {
                        unit = (_c = parsedRange.unit) !== null && _c !== void 0 ? _c : unit;
                        low = parsedRange.low;
                        high = parsedRange.high;
                        rangeText = parsedRange.rangeText;
                        consumed = idx - i + 1;
                    }
                }
            }
            else {
                const parsedRange = parseBiomedicaRange(lines[idx]);
                if (parsedRange) {
                    unit = (_d = parsedRange.unit) !== null && _d !== void 0 ? _d : unit;
                    low = parsedRange.low;
                    high = parsedRange.high;
                    rangeText = parsedRange.rangeText;
                    consumed = idx - i + 1;
                }
            }
        }
        pushRow(results, seen, {
            rawName: line.replace(/\s+/g, ' ').trim(),
            value: (0, labUnitConversion_utils_1.parseNumericValue)(valueRaw),
            valueText: valueRaw,
            unit,
            referenceLow: low,
            referenceHigh: high,
            referenceText: rangeText,
            sourceLines: lines.slice(i, i + consumed),
        });
        i += consumed - 1;
    }
    return results;
}
exports.biomedicaParser = {
    vendor: 'biomedica',
    name: 'BiomedicaParser',
    canParse(classification, text) {
        return classification.vendor === 'biomedica' || BIOMEDICA_MARKER.test(text);
    },
    parse(text) {
        return parseBiomedicaResults(text);
    },
};
