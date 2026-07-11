"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreParsedLine = scoreParsedLine;
exports.expandTextToCandidateLines = expandTextToCandidateLines;
exports.parseLabResultsFromText = parseLabResultsFromText;
const labUnitConversion_utils_1 = require("../../utils/labUnitConversion.utils");
const chopoParser_service_1 = require("./chopoParser.service");
const TABLE_HEADER = /^(nombre|analito|par[a\u00e1]metro|prueba|resultado|unidad|referencia|valores?\s+de\s+referencia)/i;
const LINE_NOISE = /^(p[a\u00e1]gina|page|www\.|http|tel\.?|rfc|curp|direcci[o\u00f3]n|av\.|col\.|cp\s*\d|responsable\s+del\s+laboratorio)/i;
const LINE_PATTERNS = [
    {
        re: /^(.{2,55}?)\s{2,}([<>]?\s*[\d.,]+)\s{2,}([a-zA-Z%\/\u00b5^0-9]{1,20})?\s{2,}([\d.,]+\s*[-\u2013\u2014a]\s*[\d.,]+)(?:\s{2,}([HL*]))?\s*$/i,
    },
    {
        re: /^(.{2,60}?)\s+([<>]?\s*[\d.,]+)\s+([a-zA-Z%\/\u00b5^0-9]{1,15})?\s+ref\s*:?\s*([\d.,]+)\s*[-\u2013\u2014]\s*([\d.,]+)(?:\s+([HL*]))?\s*$/i,
    },
    {
        re: /^(.{2,60}?)\s+([<>]?\s*[\d.,]+)\s*([a-zA-Z%\/\u00b5^0-9]{1,15})?\s*(?:\(|\[)?\s*([\d.,]+)\s*[-\u2013\u2014]\s*([\d.,]+)\s*(?:\)|\])?(?:\s+([HL*]))?\s*$/i,
    },
    {
        re: /^(.{2,60}?)\s+([<>]?\s*[\d.,]+)\s*([a-zA-Z%\/\u00b5^0-9]{1,15})?\s+([\d.,]+)\s*[-\u2013\u2014]\s*([\d.,]+)(?:\s+([HL*]))?\s*$/i,
    },
    {
        re: /^(.{2,60}?)\s*[:=]\s*([<>]?\s*[\d.,]+)\s*([a-zA-Z%\/\u00b5^0-9]{1,15})?\s*(?:ref\.?|referencia)?\s*[:]?\s*([\d.,]+)\s*[-\u2013\u2014]\s*([\d.,]+)\s*$/i,
    },
    {
        re: /^(.{2,60}?)\s+([<>]?\s*[\d.,]+)\s*([a-zA-Z%\/\u00b5^0-9]{1,15})?\s+de\s+([\d.,]+)\s+a\s+([\d.,]+)\s*$/i,
    },
    {
        re: /^(.{2,55}?)\s+([<>]?\s*[\d.,]+)\s*([a-zA-Z%\/\u00b5^0-9]{1,15})?\s*$/i,
        partial: true,
    },
    {
        re: /^(.{2,55}?)\s*[:=]\s*([<>]?\s*[\d.,]+)\s*([a-zA-Z%\/\u00b5^0-9]{1,15})?\s*$/i,
        partial: true,
    },
];
function parseRangePair(a, b) {
    const low = a ? (0, labUnitConversion_utils_1.parseNumericValue)(a) : null;
    const high = b ? (0, labUnitConversion_utils_1.parseNumericValue)(b) : null;
    return { low, high };
}
function parseInlineRange(text) {
    if (!text)
        return { low: null, high: null, text: null };
    const m = text.match(/([\d.,]+)\s*[-\u2013\u2014a]\s*([\d.,]+)/i);
    if (!m)
        return { low: null, high: null, text: text.trim() };
    const { low, high } = parseRangePair(m[1], m[2]);
    return { low, high, text: `${m[1]}-${m[2]}` };
}
function normalizeValueRaw(raw) {
    return raw.replace(/\s+/g, '').trim();
}
function scoreParsedLine(line) {
    let c = line.partial ? 0.42 : 0.55;
    if (line.resultValue != null)
        c += 0.14;
    else if (line.resultValueText)
        c += 0.06;
    if (line.resultUnit)
        c += 0.08;
    if (line.referenceRangeLow != null || line.referenceRangeHigh != null)
        c += 0.08;
    if (line.referenceRangeLow != null && line.referenceRangeHigh != null)
        c += 0.07;
    return Math.min(0.92, c);
}
function tryMatchLine(line) {
    var _a, _b;
    for (const { re, partial } of LINE_PATTERNS) {
        const m = line.match(re);
        if (!m)
            continue;
        const name = m[1].replace(/\s+/g, ' ').trim();
        if (name.length < 2 || TABLE_HEADER.test(name) || !(0, chopoParser_service_1.isValidAnalyteName)(name))
            continue;
        const valueRaw = normalizeValueRaw(m[2]);
        const unitRaw = ((_a = m[3]) === null || _a === void 0 ? void 0 : _a.trim()) || undefined;
        const unit = unitRaw && (0, chopoParser_service_1.isValidLabUnit)(unitRaw) ? unitRaw : undefined;
        if (m[4] && /[-\u2013\u2014a]/i.test(m[4])) {
            const r = parseInlineRange(m[4]);
            return {
                name,
                valueRaw,
                unit,
                rangeA: r.low != null ? String(r.low) : undefined,
                rangeB: r.high != null ? String(r.high) : undefined,
                rangeText: (_b = r.text) !== null && _b !== void 0 ? _b : undefined,
                partial: !!partial,
            };
        }
        if (m[4] && m[5]) {
            return {
                name,
                valueRaw,
                unit,
                rangeA: m[4],
                rangeB: m[5],
                partial: !!partial,
            };
        }
        return { name, valueRaw, unit, partial: !!partial };
    }
    return null;
}
function expandTextToCandidateLines(text) {
    const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 3);
    const out = [];
    const seenLine = new Set();
    const push = (line) => {
        const key = line.toLowerCase();
        if (seenLine.has(key))
            return;
        seenLine.add(key);
        out.push(line);
    };
    for (const line of rawLines) {
        if (LINE_NOISE.test(line) ||
            TABLE_HEADER.test(line) ||
            (0, chopoParser_service_1.isRangeFragmentName)(line) ||
            (0, chopoParser_service_1.isFooterOrSignatureLine)(line)) {
            continue;
        }
        if (/\d{5,}[A-Z].*\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line))
            continue;
        push(line);
        if (/\s{2,}/.test(line)) {
            const cols = line.split(/\s{2,}/).filter(Boolean);
            if (cols.length >= 3) {
                const synthetic = `${cols[0]} ${cols[1]}${cols[2] ? ` ${cols[2]}` : ''}${cols[3] ? ` ${cols[3]}` : ''}`;
                push(synthetic.trim());
            }
        }
    }
    return out;
}
function parseLabResultsFromText(text) {
    var _a;
    if ((0, chopoParser_service_1.isChopoReport)(text)) {
        const chopoResults = (0, chopoParser_service_1.parseChopoStackedResults)(text);
        if (chopoResults.length > 0)
            return chopoResults;
    }
    const lines = expandTextToCandidateLines(text);
    const results = [];
    const seen = new Set();
    for (const line of lines) {
        const matched = tryMatchLine(line);
        if (!matched)
            continue;
        const key = matched.name.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        const value = (0, labUnitConversion_utils_1.parseNumericValue)(matched.valueRaw);
        const valueText = matched.valueRaw;
        const { low, high } = parseRangePair(matched.rangeA, matched.rangeB);
        const rangeText = (_a = matched.rangeText) !== null && _a !== void 0 ? _a : (low != null && high != null ? `${low}-${high}` : null);
        const row = {
            analyteNameRaw: matched.name,
            resultValue: value,
            resultValueText: valueText,
            resultUnit: matched.unit || null,
            referenceRangeLow: low,
            referenceRangeHigh: high,
            referenceRangeText: rangeText,
            rawTextSnippet: line.slice(0, 200),
            confidence: 0,
        };
        row.confidence = scoreParsedLine(Object.assign(Object.assign({}, row), { partial: matched.partial }));
        results.push(row);
    }
    return results;
}
