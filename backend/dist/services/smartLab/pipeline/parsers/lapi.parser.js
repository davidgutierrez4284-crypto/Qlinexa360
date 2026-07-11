"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lapiParser = void 0;
exports.splitGluedHighAndUnit = splitGluedHighAndUnit;
exports.parseLapiTwoLineResults = parseLapiTwoLineResults;
exports.parseLapiTabularResults = parseLapiTabularResults;
exports.parseLapiStackedResults = parseLapiStackedResults;
const labUnitConversion_utils_1 = require("../../../../utils/labUnitConversion.utils");
const chopoParser_service_1 = require("../../chopoParser.service");
const stackedParser_utils_1 = require("../stackedParser.utils");
const LAPI_MARKER = /\blapi\b|lapi\.com|laboratorio\s+de\s+an[aá]lisis\s+patol[oó]gicos\s+e\s+inmunol[oó]gicos/i;
const LAPI_SKIP = /^(hoja:|p[aá]gina|paciente:|sexo:|edad:|orden:|f\/n|f\.?\s*n\.?|fecha|fechas:|resultados$|examen$|www\.|laboratorio|gracias|aviso|privacidad|city\s*shops|del\s+valle|perfil\s+plus$|nombre|m[eé]dico|doctor|sucursal|^\d{5,}$|\borde[nr]\b|\d+\s*a[nñ]os|valores?\s+de\s+referencia$|brincos|promocion\s+call\s+center|betya|resultados\s+parciales|recomendable|deseable|[oó]ptimo|lim[ií]trofe|elementos$|\*+$|q\.?\s*f\.?\s*b|c[eé]dula|responsable|acreditaci[oó]n|informe\s+final|aviso\s+importante)/i;
const LAPI_METADATA = /\b(city\s*shops|del\s+valle|orden\s+\d|\bperfil\s+plus\b|\bsucursal\b|\bplaza\b|\bshops\b|\b749109\b)/i;
const LAPI_NOISE_LINE = /^(p\s*a\s*c\s*i\s*e\s*n\s*t\s*e|examen\s*resultado\s*valores|gutierrez\s+grados|f\/n\s*:|f\.?\s*n\.?\s*:|\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i;
const SECTION_START = /\b(QU[IÍ]MICA|BIOMETR[IÍ]A|HEMOGRAMA|PERFIL\s+[A-ZÁÉÍÓÚ]+|UROAN[AÁ]LISIS|COPROLOG[IÍ]A|ORINA|TIROIDES|LIPIDOS|HEP[AÁ]TICO|RENAL|INTEGRAL)\b/i;
const TABLE_HEADER = /^(examen|resultado|valores?\s+de\s+referencia|examen\s*resultado)/i;
const LAPI_TABLE_ROW = /^([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9()/\s%-]{1,48}?)\s{2,}([<>]?\s*[\d.,]+)\s{2,}(.+)$/;
const LAPI_TABLE_ROW_TIGHT = /^([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9()/\s%-]{1,48}?)\s+([<>]?\s*[\d.,]+)\s+([\d.,]+\s*[-–—]\s*[\d.,]+.+|<\s*[\d.,]+.+)$/;
/** Value + low - high(+unit glued) on the line after the analyte name. */
const LAPI_VALUE_RANGE_LINE = /^\s*([<>]?\s*[\d.,]+)(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+)?\s+([\d.,]+)\s*[-–—]\s*(.+)$/;
const LAPI_GLUE_UNITS = [
    '10^6/μL',
    '10^3/μL',
    '10^6/ul',
    '10^3/ul',
    '10^6uL',
    '10^3uL',
    'μUI/mL',
    'µUI/mL',
    'uUI/mL',
    'mUI/L',
    'ng/mL',
    'pg/mL',
    'ug/dL',
    'μg/dL',
    'umol/L',
    'mmol/L',
    'mEq/L',
    'mg/dL',
    'g/dL',
    'UI/L',
    'U/L',
    'fL',
    'pg',
    '%',
];
function shouldSkipLapiLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 2)
        return true;
    if (trimmed === '*')
        return true;
    if (LAPI_SKIP.test(trimmed))
        return true;
    if (LAPI_NOISE_LINE.test(trimmed))
        return true;
    if (TABLE_HEADER.test(trimmed))
        return true;
    if (LAPI_METADATA.test(trimmed))
        return true;
    if (/^\d{5,8}$/.test(trimmed))
        return true;
    if (/^https?:\/\//i.test(trimmed))
        return true;
    if (/f\/n\s*:\s*\d{2}\/\d{2}\/\d{4}/i.test(trimmed))
        return true;
    if (/^[A-ZÁÉÍÓÚÑ]{2,}(\s+[A-ZÁÉÍÓÚÑ]{2,}){1,5}$/.test(trimmed) &&
        !/\d/.test(trimmed)) {
        return true;
    }
    return false;
}
function tryUnGlueHighAndUnit(tail, unit) {
    if (tail.endsWith(unit)) {
        return tail.slice(0, -unit.length);
    }
    if (unit.length > 0 && /\d/.test(unit[0])) {
        const unitRest = unit.slice(1);
        if (unitRest && tail.endsWith(unitRest)) {
            const prefix = tail.slice(0, -unitRest.length);
            if (prefix.length > 0 && /\d$/.test(prefix)) {
                return prefix.slice(0, -1);
            }
        }
    }
    return null;
}
function splitGluedHighAndUnit(tail) {
    var _a, _b;
    const trimmed = tail.trim();
    if (!trimmed)
        return { high: null, unit: null };
    for (const unit of LAPI_GLUE_UNITS) {
        const highStr = tryUnGlueHighAndUnit(trimmed, unit);
        if (highStr != null && highStr.length > 0) {
            const high = (0, labUnitConversion_utils_1.parseNumericValue)(highStr);
            if (high != null) {
                return { high, unit: (0, chopoParser_service_1.isValidLabUnit)(unit) ? unit : null };
            }
        }
    }
    const upper = trimmed.match(/^<\s*([\d.,]+)\s*(.*)$/i);
    if (upper) {
        const unit = ((_a = upper[2]) === null || _a === void 0 ? void 0 : _a.trim()) || null;
        return {
            high: (0, labUnitConversion_utils_1.parseNumericValue)(upper[1]),
            unit: unit && (0, chopoParser_service_1.isValidLabUnit)(unit) ? unit : null,
        };
    }
    const fallback = trimmed.match(/^([\d.,]+)(.*)$/);
    if (fallback) {
        const unit = ((_b = fallback[2]) === null || _b === void 0 ? void 0 : _b.trim()) || null;
        return {
            high: (0, labUnitConversion_utils_1.parseNumericValue)(fallback[1]),
            unit: unit && (0, chopoParser_service_1.isValidLabUnit)(unit) ? unit : null,
        };
    }
    return { high: (0, labUnitConversion_utils_1.parseNumericValue)(trimmed), unit: null };
}
function parseLapiRangeTail(tail) {
    var _a, _b;
    const line = tail.trim();
    if (!line)
        return { unit: null, low: null, high: null, rangeText: null };
    const upper = line.match(/^<\s*([\d.,]+)\s*(.*)$/i);
    if (upper) {
        const unit = ((_a = upper[2]) === null || _a === void 0 ? void 0 : _a.trim()) || null;
        return {
            low: null,
            high: (0, labUnitConversion_utils_1.parseNumericValue)(upper[1]),
            unit: unit && (0, chopoParser_service_1.isValidLabUnit)(unit) ? unit : null,
            rangeText: line,
        };
    }
    const paired = line.match(/^([\d.,]+)\s*[-–—]\s*([\d.,]+)\s*(.*)$/i);
    if (paired) {
        const unit = ((_b = paired[3]) === null || _b === void 0 ? void 0 : _b.trim()) || null;
        return {
            low: (0, labUnitConversion_utils_1.parseNumericValue)(paired[1]),
            high: (0, labUnitConversion_utils_1.parseNumericValue)(paired[2]),
            unit: unit && (0, chopoParser_service_1.isValidLabUnit)(unit) ? unit : null,
            rangeText: `${paired[1].trim()}-${paired[2].trim()}`,
        };
    }
    return { unit: null, low: null, high: null, rangeText: line };
}
function scoreLapiRow(row) {
    let c = 0.78;
    if (row.value != null)
        c += 0.1;
    if (row.unit)
        c += 0.05;
    if (row.referenceLow != null || row.referenceHigh != null)
        c += 0.07;
    return Math.min(0.95, c);
}
function parseLapiTabularLine(line) {
    if (shouldSkipLapiLine(line))
        return null;
    const cols = line.split(/\t|\s{2,}/).map((c) => c.trim()).filter(Boolean);
    let name;
    let valueRaw;
    let rangePart;
    if (cols.length >= 3) {
        name = cols[0];
        valueRaw = cols[1];
        rangePart = cols.slice(2).join(' ');
    }
    else {
        const spaced = line.match(LAPI_TABLE_ROW);
        if (spaced) {
            name = spaced[1].trim();
            valueRaw = spaced[2].replace(/\s+/g, '').trim();
            rangePart = spaced[3].trim();
        }
        else {
            const tight = line.match(LAPI_TABLE_ROW_TIGHT);
            if (!tight)
                return null;
            name = tight[1].trim();
            valueRaw = tight[2].replace(/\s+/g, '').trim();
            rangePart = tight[3].trim();
        }
    }
    if (!name || !valueRaw || !rangePart)
        return null;
    if (!(0, chopoParser_service_1.isValidAnalyteName)(name))
        return null;
    const value = (0, labUnitConversion_utils_1.parseNumericValue)(valueRaw);
    const range = parseLapiRangeTail(rangePart);
    const row = {
        rawName: name,
        canonicalName: null,
        value,
        valueText: valueRaw,
        unit: range.unit,
        referenceLow: range.low,
        referenceHigh: range.high,
        referenceText: range.rangeText,
        sourceLines: [line],
        validationErrors: [],
        confidence: 0,
    };
    row.confidence = scoreLapiRow(row);
    return row;
}
function collectTrailingUnit(lines, startIdx) {
    let idx = startIdx;
    if (idx < lines.length && lines[idx] === '*')
        idx++;
    if (idx < lines.length) {
        const unitToken = (0, chopoParser_service_1.extractKnownUnitToken)(lines[idx]);
        if (unitToken && !(0, chopoParser_service_1.isValidAnalyteName)(lines[idx])) {
            return { unit: unitToken, consumed: idx - startIdx + 1 };
        }
    }
    return { unit: null, consumed: 0 };
}
function parseLapiTwoLineResults(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const results = [];
    const seen = new Set();
    for (let i = 0; i < lines.length; i++) {
        const nameLine = lines[i];
        if (shouldSkipLapiLine(nameLine))
            continue;
        if (!(0, chopoParser_service_1.isValidAnalyteName)(nameLine))
            continue;
        if (i + 1 >= lines.length)
            continue;
        const valueLine = lines[i + 1];
        const valueRangeMatch = valueLine.match(LAPI_VALUE_RANGE_LINE);
        if (!valueRangeMatch)
            continue;
        const valueRaw = valueRangeMatch[1].replace(/\s+/g, '').trim();
        const lowRaw = valueRangeMatch[2];
        const tail = valueRangeMatch[3].trim();
        const { high, unit: gluedUnit } = splitGluedHighAndUnit(tail);
        const trailing = collectTrailingUnit(lines, i + 2);
        const unit = gluedUnit !== null && gluedUnit !== void 0 ? gluedUnit : trailing.unit;
        const consumed = 1 + 1 + trailing.consumed;
        const key = nameLine.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        const row = {
            rawName: nameLine,
            canonicalName: null,
            value: (0, labUnitConversion_utils_1.parseNumericValue)(valueRaw),
            valueText: valueRaw,
            unit,
            referenceLow: (0, labUnitConversion_utils_1.parseNumericValue)(lowRaw),
            referenceHigh: high,
            referenceText: high != null ? `${lowRaw}-${high}` : lowRaw,
            sourceLines: lines.slice(i, i + consumed),
            validationErrors: [],
            confidence: 0,
        };
        row.confidence = scoreLapiRow(row);
        results.push(row);
        i += consumed - 1;
    }
    return results;
}
function parseLapiTabularResults(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const results = [];
    const seen = new Set();
    let inResultsSection = false;
    for (const line of lines) {
        if (SECTION_START.test(line)) {
            inResultsSection = true;
            continue;
        }
        if (!inResultsSection)
            continue;
        const row = parseLapiTabularLine(line);
        if (!row)
            continue;
        const key = row.rawName.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        results.push(row);
    }
    return results;
}
function parseLapiStackedResults(text) {
    return (0, stackedParser_utils_1.parseStackedLayout)(text, {
        sectionStart: SECTION_START,
        skipLine: LAPI_SKIP,
    }).filter((row) => !LAPI_METADATA.test(row.rawName) && !shouldSkipLapiLine(row.rawName));
}
exports.lapiParser = {
    vendor: 'lapi',
    name: 'LapiParser',
    canParse(classification, text) {
        return classification.vendor === 'lapi' || LAPI_MARKER.test(text);
    },
    parse(text) {
        const tabular = parseLapiTabularResults(text);
        if (tabular.length > 0)
            return tabular;
        const twoLine = parseLapiTwoLineResults(text);
        if (twoLine.length > 0)
            return twoLine;
        return parseLapiStackedResults(text);
    },
};
