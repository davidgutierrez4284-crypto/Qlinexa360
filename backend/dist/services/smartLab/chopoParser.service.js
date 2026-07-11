"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractKnownUnitToken = extractKnownUnitToken;
exports.isUnitOnlyLine = isUnitOnlyLine;
exports.isChopoReport = isChopoReport;
exports.isFooterOrSignatureLine = isFooterOrSignatureLine;
exports.isProfessionalLicenseValue = isProfessionalLicenseValue;
exports.isRangeFragmentName = isRangeFragmentName;
exports.isValidAnalyteName = isValidAnalyteName;
exports.isValidLabUnit = isValidLabUnit;
exports.parseChopoStackedResults = parseChopoStackedResults;
const labUnitConversion_utils_1 = require("../../utils/labUnitConversion.utils");
const CHOPO_MARKER = /chopo\.com\.mx|grupo\s+diagn[oó]stico\s+m[eé]dico\s+proa/i;
const FOOTER_SIGNATURE_PATTERN = /\b(q\.?\s*f\.?\s*b\.?|c[eé]dula\s+prof(?:esional)?|responsable\s+del\s+laboratorio)\b/i;
const CHOPO_SKIP_LINE = /^(hoja:|p[aá]gina|prueba$|paciente:|sexo:|fecha:|dirigido|edad:|orden:|id paciente|fecha de nacimiento|resultados$|an[aá]lisis cl[ií]nicos|bajo \(lr\)|dentro \(lr\)|sobre \(lr\)|l[ií]mites de referencia|a[nñ]os$|www\.|gracias por|grupo diagn[oó]stico|sucursal |av\.|cup[oó]n|vigencia|descuento|producto|c[oó]digo|estimado paciente|paciente id:|m[eé]todo:|informe final|responsable|acreditaci[oó]n|consulte el|recuerde que|descarga nuestra|en\s+caso\s+de|aviso importante|el\s+prestador|aplica en|posteriores|reproceso del|universidad|c[eé]dula|q\.?\s*f\.?\s*b\.?|te sugerimos|el descuento|precios sujetos|mientras m[aá]s)/i;
const CHOPO_VALUE_LINE = /^[<>]?\s*[\d.,]+$/;
const DEMOGRAPHIC_LINE = /^(masculino|femenino|a quien corresponda)$/i;
const CHOPO_SECTION_START = /\b(CURVA\s+DE\s+TOLERANCIA\s+A\s+LA\s+GLUCOSA|CURVA\s+DE\s+INSULINA|QU[IÍ]MICA DE \d+ ELEMENTOS|INSULINA EN SUERO|BIOMETR[IÍ]A|HEMOGRAMA|PERFIL(?:\s+DE)?\s+LIP[IÍ]D(?:OS|ICO)(?:\s+EN\s+SUERO)?|PERFIL\s+[A-ZÁÉÍÓÚ]+|TRANSAMINASA|BILIRRUBINAS?\s+EN\s+SANGRE|FOSFATASA ALCALINA|GAMMA GLUTAMIL|PROTE[IÍ]NAS EN SUERO|TIROideos|ELECTROLITOS|COAGULACI[OÓ]N|UROAN[AÁ]LISIS)\b/i;
const CHOPO_SECTION_TITLE = /^(CURVA\s+DE\s+TOLERANCIA|CURVA\s+DE\s+INSULINA|TRANSAMINASA|BILIRRUBINAS?\s+EN\s+SANGRE|FOSFATASA ALCALINA|GAMMA GLUTAMIL|PROTE[IÍ]NAS EN SUERO|QU[IÍ]MICA DE \d+ ELEMENTOS|INSULINA EN SUERO|BIOMETR[IÍ]A|HEMOGRAMA|PERFIL(?:\s+DE)?\s+LIP[IÍ]D(?:OS|ICO)(?:\s+EN\s+SUERO)?|PERFIL\s+[A-ZÁÉÍÓÚ]+)/i;
const CHOPO_CURVE_GLUCOSE_SECTION = /CURVA\s+DE\s+TOLERANCIA\s+A\s+LA\s+GLUCOSA/i;
const CHOPO_CURVE_INSULIN_SECTION = /CURVA\s+DE\s+INSULINA/i;
const CHOPO_INSULIN_SAMPLE_NAME = /^\d+[ªaº°]?\.\s*Muestra\s+Insulina/i;
const CHOPO_INSULIN_REF_TABLE_ROW = /^(BASAL|1\s+hora|2\s+horas|3\s+horas|>=?\s*4\s*hrs?|4\s+horas|\d+\s+horas?)$/i;
const GLUCOSE_CURVE_TIME_LABELS = ['basal', '30 min', '1 hora', '2 horas', '3 horas'];
const INSULIN_CURVE_TIME_LABELS = ['basal', '30 min', '1 hora', '2 horas', '3 horas', '4 horas'];
const INSULIN_CURVE_REF_RANGES = {
    basal: { low: 2.6, high: 24.9 },
    '1 hora': { low: 20, high: 123 },
    '2 horas': { low: 18, high: 56 },
    '3 horas': { low: 8, high: 22 },
    '4 horas': { low: 6, high: 21 },
};
const KNOWN_LAB_UNITS = /^(mg\/dL|g\/dL|g\/l|mg\/l|mmol\/L|mEq\/L|meq\/L|U\/L|u\/l|μg\/dL|µg\/dL|ug\/dL|μUI\/mL|µUI\/mL|uUI\/mL|mUI\/L|UI\/L|%|pg\/mL|ng\/mL|fL|g\/dL|10\^3\/μL|10\^6\/μL|10\^3uL|10\^6uL|umol\/L|mm\/hr|copias\/mL|mm\/hr|s|seg|ratio|millones\/mm3|miles\/mm3|mUl\/L|μg\/L|ug\/L|mOsmol\/Kg|pg\/mL)$/i;
/** CHOPO 2012 PDFs often prefix unit lines with bullets/dots: ". mg/dL", "· mg/dL". */
function stripUnitLinePrefix(line) {
    return line.trim().replace(/^[\s.·•\-–—]+/, '').trim();
}
function extractKnownUnitToken(line) {
    const cleaned = stripUnitLinePrefix(line);
    if (!cleaned)
        return null;
    if (KNOWN_LAB_UNITS.test(cleaned))
        return cleaned;
    return null;
}
function isUnitOnlyLine(line) {
    return extractKnownUnitToken(line) != null;
}
function isChopoReport(text) {
    return CHOPO_MARKER.test(text);
}
function isFooterOrSignatureLine(text) {
    return FOOTER_SIGNATURE_PATTERN.test(text.trim());
}
function isProfessionalLicenseValue(name, value) {
    if (value == null || !Number.isFinite(value))
        return false;
    const digits = String(Math.trunc(value));
    if (digits.length < 5 || digits.length > 8)
        return false;
    return /\bc[eé]dula\b/i.test(name) || isFooterOrSignatureLine(name);
}
function isRangeFragmentName(name) {
    const n = name.trim();
    if (!n)
        return true;
    if (CHOPO_INSULIN_SAMPLE_NAME.test(n))
        return false;
    if (/^\d/.test(n))
        return true;
    if (/^[\d.,]+\s*[-–—]\s*$/i.test(n))
        return true;
    if (/^>\s*o\s*=/i.test(n))
        return true;
    if (/^hoja:\s*\d+/i.test(n))
        return true;
    if (/^\d{5,}/.test(n))
        return true;
    if (/^\d+\s*[-–—]\s*\d+\s+(deseable|normal|[oó]ptimo|alto|lim[ií]trofe|moderadamente)/i.test(n))
        return true;
    if (/^<\s*[\d.,]+\s+(deseable|normal|[oó]ptimo|alto)/i.test(n))
        return true;
    if (/^>=?\s*[\d.,]+\s+(deseable|normal|[oó]ptimo|alto|riesgo|lim[ií]trofe)/i.test(n))
        return true;
    if (/^>=?\s*[\d.,]+\s+\w/i.test(n))
        return true;
    if (/^[<>]\s*[\d.,]+\s+[a-zA-Zμµ%/]+$/i.test(n))
        return true;
    if (/paciente\s*id/i.test(n))
        return true;
    if (/^qu[ií]mica de\s+\d+/i.test(n))
        return true;
    if (CHOPO_SECTION_TITLE.test(n))
        return true;
    if (/^<\s*[\d.,]+\s*a[nñ]os\b/i.test(n))
        return true;
    if (/^>\s*[\d.,]+\s*a[nñ]os\b/i.test(n))
        return true;
    if (/^(deseable|normal|bajo|alto|lim[ií]trofe|muy\s+alto|moderado|[oó]ptimo|ideal|t[oó]xico|negativo)\b/i.test(n))
        return true;
    if (/^(bajo|alto)\s+(riesgo|menor|mayor)\b/i.test(n))
        return true;
    if (/^a\s+partir\s+del\s+\d+/i.test(n))
        return true;
    if (/^fecha\s+toma\s+de\s+muestra/i.test(n))
        return true;
    if (/^valor(es)?\s+de\s+referencia/i.test(n))
        return true;
    if (/^recomendados\s+por/i.test(n))
        return true;
    if (/^\d+\s*[-–—]\s*\d+\s+(mg\/dL|mg\/dl|g\/dL|%)/i.test(n))
        return true;
    if (/^mayor\s+de\s+\d+/i.test(n))
        return true;
    if (/^menor\s+de\s+\d+/i.test(n))
        return true;
    return false;
}
function isValidAnalyteName(name) {
    if (name.length < 2 || name.length > 90)
        return false;
    if (DEMOGRAPHIC_LINE.test(name))
        return false;
    if (isRangeFragmentName(name))
        return false;
    if (isFooterOrSignatureLine(name))
        return false;
    if (CHOPO_SKIP_LINE.test(name))
        return false;
    // Unidades de laboratorio conocidas no son nombres de analito (p. ej. "mg/dL", ". mg/dL" en CHOPO 2012)
    if (isUnitOnlyLine(name))
        return false;
    if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]{2,}/.test(name))
        return false;
    if (/^=+$/.test(name))
        return false;
    return true;
}
function isValidLabUnit(unit) {
    if (!unit)
        return true;
    const u = stripUnitLinePrefix(unit);
    if (!u)
        return true;
    if (/\d{1,2}\/\d{1,2}/.test(u))
        return false;
    if (/^\/\d/.test(u))
        return false;
    if (/^(alto|bajo|normal|deseable|[oó]ptimo|lim[ií]trofe|elementos)$/i.test(u))
        return false;
    return KNOWN_LAB_UNITS.test(u) || /^[a-zA-Zμµ%\/\^°]+(?:\/[a-zA-Zμµ]+)?$/i.test(u);
}
function shouldSkipChopoLine(line) {
    if (!line || line.length < 2)
        return true;
    if (CHOPO_SKIP_LINE.test(line))
        return true;
    if (/^=+$/.test(line))
        return true;
    if (/l[ií]mites de referencia/i.test(line))
        return true;
    return false;
}
function parseChopoRangeLine(rangeLine) {
    var _a, _b, _c, _d;
    const line = rangeLine.trim();
    if (!line || shouldSkipChopoLine(line))
        return null;
    const paired = line.match(/^([<>]?\s*[\d.,]+)\s*[-–—]\s*([\d.,]+)\s*(.*)$/i);
    if (paired) {
        const unit = ((_a = paired[3]) === null || _a === void 0 ? void 0 : _a.trim()) || null;
        return {
            low: (0, labUnitConversion_utils_1.parseNumericValue)(paired[1]),
            high: (0, labUnitConversion_utils_1.parseNumericValue)(paired[2]),
            unit: unit && isValidLabUnit(unit) ? unit : null,
            rangeText: `${paired[1].trim()}-${paired[2].trim()}`,
        };
    }
    const upper = line.match(/^<\s*([\d.,]+)\s*(.*)$/i);
    if (upper) {
        const unit = ((_b = upper[2]) === null || _b === void 0 ? void 0 : _b.trim()) || null;
        return {
            low: null,
            high: (0, labUnitConversion_utils_1.parseNumericValue)(upper[1]),
            unit: unit && isValidLabUnit(unit) ? unit : null,
            rangeText: line,
        };
    }
    const geLower = line.match(/^>\s*o\s*=\s*([\d.,]+)\s*(.*)$/i);
    if (geLower) {
        const unit = ((_c = geLower[2]) === null || _c === void 0 ? void 0 : _c.trim()) || null;
        return {
            low: (0, labUnitConversion_utils_1.parseNumericValue)(geLower[1]),
            high: null,
            unit: unit && isValidLabUnit(unit) ? unit : null,
            rangeText: line.trim(),
        };
    }
    const lower = line.match(/^>\s*([\d.,]+)\s*(.*)$/i);
    if (lower) {
        const unit = ((_d = lower[2]) === null || _d === void 0 ? void 0 : _d.trim()) || null;
        return {
            low: (0, labUnitConversion_utils_1.parseNumericValue)(lower[1]),
            high: null,
            unit: unit && isValidLabUnit(unit) ? unit : null,
            rangeText: line.trim(),
        };
    }
    return null;
}
/** Unit header that starts an inverted CHOPO row (unit → value → name). */
function isInvertedRowUnitLine(line) {
    if (extractKnownUnitToken(line) != null)
        return true;
    const trimmed = line.trim();
    return trimmed.length > 0 && /^[\s.·•\-–—]+$/.test(trimmed);
}
function isNextInvertedRowStart(lines, index) {
    var _a, _b;
    if (!isInvertedRowUnitLine((_a = lines[index]) !== null && _a !== void 0 ? _a : ''))
        return false;
    return index + 1 < lines.length && CHOPO_VALUE_LINE.test((_b = lines[index + 1]) !== null && _b !== void 0 ? _b : '');
}
function extractInvertedReferenceBlock(lines, startIdx) {
    let low = null;
    let high = null;
    let rangeText = null;
    let unit = null;
    let j = startIdx;
    while (j < lines.length) {
        const line = lines[j];
        if (isNextInvertedRowStart(lines, j))
            break;
        if (detectSectionContext(line))
            break;
        if (/^responsable del laboratorio/i.test(line))
            break;
        if (isFooterOrSignatureLine(line))
            break;
        if (/l[ií]mites de referencia/i.test(line)) {
            const unitInHeader = line.match(/\(([^)]+)\)/);
            if ((unitInHeader === null || unitInHeader === void 0 ? void 0 : unitInHeader[1]) && isValidLabUnit(unitInHeader[1])) {
                unit = stripUnitLinePrefix(unitInHeader[1]);
            }
            j++;
            continue;
        }
        if (low == null && high == null) {
            const parsed = parseChopoRangeLine(line);
            if (parsed) {
                low = parsed.low;
                high = parsed.high;
                rangeText = parsed.rangeText;
                if (parsed.unit)
                    unit = parsed.unit;
                j++;
                while (j < lines.length) {
                    const skipLine = lines[j];
                    if (isNextInvertedRowStart(lines, j))
                        break;
                    if (detectSectionContext(skipLine))
                        break;
                    if (/^responsable del laboratorio/i.test(skipLine))
                        break;
                    if (isFooterOrSignatureLine(skipLine))
                        break;
                    j++;
                }
                break;
            }
        }
        if (/^>=\s*[\d.,]+/i.test(line.trim())) {
            j++;
            continue;
        }
        j++;
    }
    return { low, high, rangeText, unit, consumed: j - startIdx };
}
function normalizeValueRaw(raw) {
    return raw.replace(/\s+/g, '').trim();
}
function scoreChopoLine(row) {
    let c = 0.75;
    if (row.resultValue != null)
        c += 0.1;
    if (row.resultUnit)
        c += 0.05;
    if (row.referenceRangeLow != null || row.referenceRangeHigh != null)
        c += 0.08;
    return Math.min(0.95, c);
}
function detectSectionContext(line) {
    if (CHOPO_CURVE_GLUCOSE_SECTION.test(line))
        return 'glucose_curve';
    if (CHOPO_CURVE_INSULIN_SECTION.test(line))
        return 'insulin_curve';
    if (CHOPO_SECTION_START.test(line))
        return 'generic';
    return null;
}
function extractGlucoseTimeFromName(name) {
    const lower = name.toLowerCase();
    if (/curva\s+tolerancia|glucosa\s*\(?\s*basal|glucosa\s+basal/.test(lower))
        return 'basal';
    const minMatch = lower.match(/(?:a\s+los\s+|en\s+)?(\d+)\s*min/);
    if (minMatch)
        return `${minMatch[1]} min`;
    const hourMatch = lower.match(/(?:de\s+|a\s+los\s+)?(\d+)\s+horas?/);
    if (hourMatch)
        return `${hourMatch[1]} ${parseInt(hourMatch[1], 10) === 1 ? 'hora' : 'horas'}`;
    return null;
}
function normalizeGlucoseCurveAnalyteName(rawName, timeIndex) {
    var _a;
    const timeFromName = extractGlucoseTimeFromName(rawName);
    if (timeFromName) {
        return timeFromName === 'basal' ? 'Glucosa basal' : `Glucosa ${timeFromName}`;
    }
    if (/^glucosa$/i.test(rawName.trim())) {
        const label = (_a = GLUCOSE_CURVE_TIME_LABELS[timeIndex]) !== null && _a !== void 0 ? _a : `${timeIndex}`;
        return label === 'basal' ? 'Glucosa basal' : `Glucosa ${label}`;
    }
    return rawName;
}
function normalizeInsulinCurveAnalyteName(rawName, sampleIndex) {
    var _a;
    const ordinalMatch = rawName.match(/^(\d+)[ªaº°]?\.\s*Muestra\s+Insulina/i);
    if (ordinalMatch) {
        const n = parseInt(ordinalMatch[1], 10);
        const label = (_a = INSULIN_CURVE_TIME_LABELS[n - 1]) !== null && _a !== void 0 ? _a : `muestra ${n}`;
        return label === 'basal' ? 'Insulina basal' : `Insulina ${label}`;
    }
    if (/insulina/i.test(rawName) && sampleIndex === 0)
        return 'Insulina basal';
    const label = INSULIN_CURVE_TIME_LABELS[sampleIndex];
    if (label)
        return label === 'basal' ? 'Insulina basal' : `Insulina ${label}`;
    return rawName;
}
function insulinTimeKeyFromName(name) {
    const lower = name.toLowerCase();
    if (lower.includes('basal'))
        return 'basal';
    const minMatch = lower.match(/(\d+)\s*min/);
    if (minMatch)
        return `${minMatch[1]} min`;
    const hourMatch = lower.match(/(\d+)\s+horas?/);
    if (hourMatch) {
        const h = parseInt(hourMatch[1], 10);
        return `${h} ${h === 1 ? 'hora' : 'horas'}`;
    }
    return null;
}
function pushChopoResult(results, seen, row) {
    var _a, _b, _c;
    const key = `${row.analyteNameRaw.toLowerCase()}|${row.resultValueText}|${(_a = row.referenceRangeLow) !== null && _a !== void 0 ? _a : ''}|${(_b = row.referenceRangeHigh) !== null && _b !== void 0 ? _b : ''}|${(_c = row.resultUnit) !== null && _c !== void 0 ? _c : ''}`;
    if (seen.has(key))
        return;
    seen.add(key);
    const parsed = Object.assign(Object.assign({}, row), { confidence: scoreChopoLine(row) });
    results.push(parsed);
}
function applyCurveContext(nameLine, sectionContext, unit, low, high, rangeText, glucoseTimeIndex, insulinSampleIndex, defaultGlucoseUnit, defaultInsulinUnit) {
    let analyteNameRaw = nameLine;
    let nextGlucose = glucoseTimeIndex;
    let nextInsulin = insulinSampleIndex;
    let nextDefaultGlucose = defaultGlucoseUnit;
    let nextDefaultInsulin = defaultInsulinUnit;
    let nextUnit = unit;
    let nextLow = low;
    let nextHigh = high;
    let nextRangeText = rangeText;
    if (sectionContext === 'glucose_curve') {
        analyteNameRaw = normalizeGlucoseCurveAnalyteName(nameLine, glucoseTimeIndex);
        if (!nextUnit && nextDefaultGlucose)
            nextUnit = nextDefaultGlucose;
        if (nextUnit && !nextDefaultGlucose)
            nextDefaultGlucose = nextUnit;
        nextGlucose++;
    }
    else if (sectionContext === 'insulin_curve' || CHOPO_INSULIN_SAMPLE_NAME.test(nameLine)) {
        analyteNameRaw = normalizeInsulinCurveAnalyteName(nameLine, insulinSampleIndex);
        if (!nextUnit && nextDefaultInsulin)
            nextUnit = nextDefaultInsulin;
        if (nextUnit && !nextDefaultInsulin)
            nextDefaultInsulin = nextUnit;
        if (nextLow == null && nextHigh == null) {
            const timeKey = insulinTimeKeyFromName(analyteNameRaw);
            const ref = timeKey ? INSULIN_CURVE_REF_RANGES[timeKey] : undefined;
            if (ref) {
                nextLow = ref.low;
                nextHigh = ref.high;
                nextRangeText = `${ref.low}-${ref.high}`;
            }
        }
        nextInsulin++;
    }
    return {
        analyteNameRaw,
        unit: nextUnit,
        low: nextLow,
        high: nextHigh,
        rangeText: nextRangeText,
        glucoseTimeIndex: nextGlucose,
        insulinSampleIndex: nextInsulin,
        defaultGlucoseUnit: nextDefaultGlucose,
        defaultInsulinUnit: nextDefaultInsulin,
    };
}
function parseChopoStackedResults(text) {
    var _a, _b;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const results = [];
    const seen = new Set();
    let i = 0;
    let inResultsSection = false;
    let sectionContext = 'none';
    let glucoseTimeIndex = 0;
    let insulinSampleIndex = 0;
    let defaultGlucoseUnit = null;
    let defaultInsulinUnit = null;
    while (i < lines.length) {
        const line = lines[i];
        const nextSection = detectSectionContext(line);
        if (nextSection) {
            inResultsSection = true;
            sectionContext = nextSection;
            if (nextSection === 'glucose_curve')
                glucoseTimeIndex = 0;
            if (nextSection === 'insulin_curve')
                insulinSampleIndex = 0;
            i++;
            continue;
        }
        // Activar tras encabezado de resultados (formato CHOPO clásico)
        if (/^an[aá]lisis cl[ií]nicos$/i.test(line)) {
            inResultsSection = true;
            i++;
            continue;
        }
        if (!inResultsSection) {
            i++;
            continue;
        }
        // Formato CHOPO invertido (pdf-parse column order): unidad → valor → nombre → bloque LR
        if (isNextInvertedRowStart(lines, i) && i + 2 < lines.length) {
            const nameLine = lines[i + 2];
            if (isValidAnalyteName(nameLine) &&
                !shouldSkipChopoLine(nameLine) &&
                !CHOPO_INSULIN_REF_TABLE_ROW.test(nameLine)) {
                const headerUnit = extractKnownUnitToken(lines[i]);
                const valueRaw = normalizeValueRaw(lines[i + 1]);
                const resultValue = (0, labUnitConversion_utils_1.parseNumericValue)(valueRaw);
                const refStart = i + 3;
                const refBlock = extractInvertedReferenceBlock(lines, refStart);
                let unit = headerUnit !== null && headerUnit !== void 0 ? headerUnit : refBlock.unit;
                let low = refBlock.low;
                let high = refBlock.high;
                let rangeText = refBlock.rangeText;
                const consumed = 3 + refBlock.consumed;
                const curve = applyCurveContext(nameLine, sectionContext, unit, low, high, rangeText, glucoseTimeIndex, insulinSampleIndex, defaultGlucoseUnit, defaultInsulinUnit);
                glucoseTimeIndex = curve.glucoseTimeIndex;
                insulinSampleIndex = curve.insulinSampleIndex;
                defaultGlucoseUnit = curve.defaultGlucoseUnit;
                defaultInsulinUnit = curve.defaultInsulinUnit;
                if (!isProfessionalLicenseValue(curve.analyteNameRaw, resultValue)) {
                    pushChopoResult(results, seen, {
                        analyteNameRaw: curve.analyteNameRaw,
                        resultValue,
                        resultValueText: valueRaw,
                        resultUnit: curve.unit,
                        referenceRangeLow: curve.low,
                        referenceRangeHigh: curve.high,
                        referenceRangeText: curve.rangeText,
                        rawTextSnippet: lines.slice(i, i + consumed).join(' | ').slice(0, 200),
                    });
                }
                i += consumed;
                continue;
            }
        }
        // Formato CHOPO clásico: nombre → [unidad] → valor → [rango]
        if (shouldSkipChopoLine(line) ||
            CHOPO_INSULIN_REF_TABLE_ROW.test(line) ||
            !isValidAnalyteName(line)) {
            i++;
            continue;
        }
        if (i + 1 >= lines.length)
            break;
        let valueLineIndex = i + 1;
        let headerUnit = null;
        const unitHeaderToken = extractKnownUnitToken((_a = lines[valueLineIndex]) !== null && _a !== void 0 ? _a : '');
        if (unitHeaderToken &&
            !CHOPO_VALUE_LINE.test(lines[valueLineIndex]) &&
            valueLineIndex + 1 < lines.length &&
            CHOPO_VALUE_LINE.test(lines[valueLineIndex + 1])) {
            headerUnit = unitHeaderToken;
            valueLineIndex++;
        }
        const valueLine = lines[valueLineIndex];
        if (!CHOPO_VALUE_LINE.test(valueLine)) {
            i++;
            continue;
        }
        const valueRaw = normalizeValueRaw(valueLine);
        const resultValue = (0, labUnitConversion_utils_1.parseNumericValue)(valueRaw);
        let unit = headerUnit;
        let low = null;
        let high = null;
        let rangeText = null;
        let consumed = valueLineIndex - i + 1;
        const rangeLineIndex = valueLineIndex + 1;
        if (rangeLineIndex < lines.length) {
            const parsedRange = parseChopoRangeLine(lines[rangeLineIndex]);
            if (parsedRange) {
                unit = (_b = parsedRange.unit) !== null && _b !== void 0 ? _b : unit;
                low = parsedRange.low;
                high = parsedRange.high;
                rangeText = parsedRange.rangeText;
                consumed = rangeLineIndex - i + 1;
            }
            else if (sectionContext === 'glucose_curve' &&
                isValidLabUnit(lines[rangeLineIndex]) &&
                !isValidAnalyteName(lines[rangeLineIndex])) {
                unit = lines[rangeLineIndex].trim();
                consumed = rangeLineIndex - i + 1;
            }
        }
        const curve = applyCurveContext(line, sectionContext, unit, low, high, rangeText, glucoseTimeIndex, insulinSampleIndex, defaultGlucoseUnit, defaultInsulinUnit);
        glucoseTimeIndex = curve.glucoseTimeIndex;
        insulinSampleIndex = curve.insulinSampleIndex;
        defaultGlucoseUnit = curve.defaultGlucoseUnit;
        defaultInsulinUnit = curve.defaultInsulinUnit;
        if (!isProfessionalLicenseValue(curve.analyteNameRaw, resultValue)) {
            pushChopoResult(results, seen, {
                analyteNameRaw: curve.analyteNameRaw,
                resultValue,
                resultValueText: valueRaw,
                resultUnit: curve.unit,
                referenceRangeLow: curve.low,
                referenceRangeHigh: curve.high,
                referenceRangeText: curve.rangeText,
                rawTextSnippet: lines.slice(i, i + consumed).join(' | ').slice(0, 200),
            });
        }
        i += consumed;
    }
    return results;
}
