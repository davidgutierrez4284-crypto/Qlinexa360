"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStackedLayout = parseStackedLayout;
exports.parseTabularLayout = parseTabularLayout;
const labUnitConversion_utils_1 = require("../../../utils/labUnitConversion.utils");
const chopoParser_service_1 = require("../chopoParser.service");
const DEFAULT_VALUE_LINE = /^[<>]?\s*[\d.,]+$/;
function parseRangeLine(rangeLine, skipLine) {
    var _a, _b, _c;
    const line = rangeLine.trim();
    if (!line || skipLine.test(line) || /^=+$/.test(line) || /l[ií]mites de referencia/i.test(line)) {
        return null;
    }
    const paired = line.match(/^([<>]?\s*[\d.,]+)\s*[-–—]\s*([\d.,]+)\s*(.*)$/i);
    if (paired) {
        const unit = ((_a = paired[3]) === null || _a === void 0 ? void 0 : _a.trim()) || null;
        return {
            low: (0, labUnitConversion_utils_1.parseNumericValue)(paired[1]),
            high: (0, labUnitConversion_utils_1.parseNumericValue)(paired[2]),
            unit: unit && (0, chopoParser_service_1.isValidLabUnit)(unit) ? unit : null,
            rangeText: `${paired[1].trim()}-${paired[2].trim()}`,
        };
    }
    const upper = line.match(/^<\s*([\d.,]+)\s*(.*)$/i);
    if (upper) {
        const unit = ((_b = upper[2]) === null || _b === void 0 ? void 0 : _b.trim()) || null;
        return {
            low: null,
            high: (0, labUnitConversion_utils_1.parseNumericValue)(upper[1]),
            unit: unit && (0, chopoParser_service_1.isValidLabUnit)(unit) ? unit : null,
            rangeText: line,
        };
    }
    const lower = line.match(/^>\s*([\d.,]+)\s*(.*)$/i);
    if (lower) {
        const unit = ((_c = lower[2]) === null || _c === void 0 ? void 0 : _c.trim()) || null;
        return {
            low: (0, labUnitConversion_utils_1.parseNumericValue)(lower[1]),
            high: null,
            unit: unit && (0, chopoParser_service_1.isValidLabUnit)(unit) ? unit : null,
            rangeText: line,
        };
    }
    return null;
}
function scoreStackedLine(row) {
    let c = 0.75;
    if (row.value != null)
        c += 0.1;
    if (row.unit)
        c += 0.05;
    if (row.referenceLow != null || row.referenceHigh != null)
        c += 0.08;
    return Math.min(0.95, c);
}
function parseStackedLayout(text, config) {
    var _a, _b, _c;
    const valueLineRe = (_a = config.valueLine) !== null && _a !== void 0 ? _a : DEFAULT_VALUE_LINE;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const results = [];
    const seen = new Set();
    let i = 0;
    let inResultsSection = false;
    while (i < lines.length) {
        const nameLine = lines[i];
        if (config.sectionStart.test(nameLine)) {
            inResultsSection = true;
            i++;
            continue;
        }
        if (!inResultsSection) {
            i++;
            continue;
        }
        if (config.skipLine.test(nameLine) || !(0, chopoParser_service_1.isValidAnalyteName)(nameLine)) {
            i++;
            continue;
        }
        if (i + 1 >= lines.length)
            break;
        let valueLineIndex = i + 1;
        let headerUnit = null;
        const unitHeaderToken = (0, chopoParser_service_1.extractKnownUnitToken)((_b = lines[valueLineIndex]) !== null && _b !== void 0 ? _b : '');
        if (unitHeaderToken &&
            !valueLineRe.test(lines[valueLineIndex]) &&
            valueLineIndex + 1 < lines.length &&
            valueLineRe.test(lines[valueLineIndex + 1])) {
            headerUnit = unitHeaderToken;
            valueLineIndex++;
        }
        const valueLine = lines[valueLineIndex];
        if (!valueLineRe.test(valueLine)) {
            i++;
            continue;
        }
        const valueRaw = valueLine.replace(/\s+/g, '').trim();
        const value = (0, labUnitConversion_utils_1.parseNumericValue)(valueRaw);
        let unit = headerUnit;
        let low = null;
        let high = null;
        let rangeText = null;
        let consumed = valueLineIndex - i + 1;
        const rangeLineIndex = valueLineIndex + 1;
        if (rangeLineIndex < lines.length) {
            const parsedRange = parseRangeLine(lines[rangeLineIndex], config.skipLine);
            if (parsedRange) {
                unit = (_c = parsedRange.unit) !== null && _c !== void 0 ? _c : unit;
                low = parsedRange.low;
                high = parsedRange.high;
                rangeText = parsedRange.rangeText;
                consumed = rangeLineIndex - i + 1;
            }
        }
        const key = nameLine.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            const sourceLines = lines.slice(i, i + consumed);
            const row = {
                rawName: nameLine,
                canonicalName: null,
                value,
                valueText: valueRaw,
                unit,
                referenceLow: low,
                referenceHigh: high,
                referenceText: rangeText,
                sourceLines,
                validationErrors: [],
                confidence: 0,
            };
            row.confidence = scoreStackedLine(row);
            results.push(row);
        }
        i += consumed;
    }
    return results;
}
function parseTabularLayout(text, parseLine) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 3);
    const results = [];
    const seen = new Set();
    for (const line of lines) {
        if ((0, chopoParser_service_1.isRangeFragmentName)(line))
            continue;
        const row = parseLine(line);
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
