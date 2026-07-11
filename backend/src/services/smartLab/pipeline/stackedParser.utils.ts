import { parseNumericValue } from '../../../utils/labUnitConversion.utils';
import type { ParameterCandidate } from './types';
import { isRangeFragmentName, isValidAnalyteName, isValidLabUnit, extractKnownUnitToken } from '../chopoParser.service';

export type StackedParserConfig = {
  sectionStart: RegExp;
  skipLine: RegExp;
  valueLine?: RegExp;
};

const DEFAULT_VALUE_LINE = /^[<>]?\s*[\d.,]+$/;

function parseRangeLine(rangeLine: string, skipLine: RegExp): {
  unit: string | null;
  low: number | null;
  high: number | null;
  rangeText: string | null;
} | null {
  const line = rangeLine.trim();
  if (!line || skipLine.test(line) || /^=+$/.test(line) || /l[ií]mites de referencia/i.test(line)) {
    return null;
  }

  const paired = line.match(/^([<>]?\s*[\d.,]+)\s*[-–—]\s*([\d.,]+)\s*(.*)$/i);
  if (paired) {
    const unit = paired[3]?.trim() || null;
    return {
      low: parseNumericValue(paired[1]),
      high: parseNumericValue(paired[2]),
      unit: unit && isValidLabUnit(unit) ? unit : null,
      rangeText: `${paired[1].trim()}-${paired[2].trim()}`,
    };
  }

  const upper = line.match(/^<\s*([\d.,]+)\s*(.*)$/i);
  if (upper) {
    const unit = upper[2]?.trim() || null;
    return {
      low: null,
      high: parseNumericValue(upper[1]),
      unit: unit && isValidLabUnit(unit) ? unit : null,
      rangeText: line,
    };
  }

  const lower = line.match(/^>\s*([\d.,]+)\s*(.*)$/i);
  if (lower) {
    const unit = lower[2]?.trim() || null;
    return {
      low: parseNumericValue(lower[1]),
      high: null,
      unit: unit && isValidLabUnit(unit) ? unit : null,
      rangeText: line,
    };
  }

  return null;
}

function scoreStackedLine(row: Omit<ParameterCandidate, 'confidence' | 'validationErrors' | 'canonicalName'>): number {
  let c = 0.75;
  if (row.value != null) c += 0.1;
  if (row.unit) c += 0.05;
  if (row.referenceLow != null || row.referenceHigh != null) c += 0.08;
  return Math.min(0.95, c);
}

export function parseStackedLayout(text: string, config: StackedParserConfig): ParameterCandidate[] {
  const valueLineRe = config.valueLine ?? DEFAULT_VALUE_LINE;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const results: ParameterCandidate[] = [];
  const seen = new Set<string>();
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

    if (config.skipLine.test(nameLine) || !isValidAnalyteName(nameLine)) {
      i++;
      continue;
    }

    if (i + 1 >= lines.length) break;

    let valueLineIndex = i + 1;
    let headerUnit: string | null = null;
    const unitHeaderToken = extractKnownUnitToken(lines[valueLineIndex] ?? '');
    if (
      unitHeaderToken &&
      !valueLineRe.test(lines[valueLineIndex]) &&
      valueLineIndex + 1 < lines.length &&
      valueLineRe.test(lines[valueLineIndex + 1])
    ) {
      headerUnit = unitHeaderToken;
      valueLineIndex++;
    }

    const valueLine = lines[valueLineIndex];
    if (!valueLineRe.test(valueLine)) {
      i++;
      continue;
    }

    const valueRaw = valueLine.replace(/\s+/g, '').trim();
    const value = parseNumericValue(valueRaw);
    let unit: string | null = headerUnit;
    let low: number | null = null;
    let high: number | null = null;
    let rangeText: string | null = null;
    let consumed = valueLineIndex - i + 1;

    const rangeLineIndex = valueLineIndex + 1;
    if (rangeLineIndex < lines.length) {
      const parsedRange = parseRangeLine(lines[rangeLineIndex], config.skipLine);
      if (parsedRange) {
        unit = parsedRange.unit ?? unit;
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
      const row: ParameterCandidate = {
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

export function parseTabularLayout(
  text: string,
  parseLine: (line: string) => ParameterCandidate | null
): ParameterCandidate[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 3);
  const results: ParameterCandidate[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (isRangeFragmentName(line)) continue;
    const row = parseLine(line);
    if (!row) continue;
    const key = row.rawName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(row);
  }

  return results;
}
