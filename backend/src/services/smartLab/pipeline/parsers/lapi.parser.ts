import { parseNumericValue } from '../../../../utils/labUnitConversion.utils';
import {
  extractKnownUnitToken,
  isValidAnalyteName,
  isValidLabUnit,
} from '../../chopoParser.service';
import { parseStackedLayout } from '../stackedParser.utils';
import type { LabParser } from '../labParser.interface';
import type { ClassifiedDocument, ParameterCandidate } from '../types';

const LAPI_MARKER =
  /\blapi\b|lapi\.com|laboratorio\s+de\s+an[aá]lisis\s+patol[oó]gicos\s+e\s+inmunol[oó]gicos/i;

const LAPI_SKIP =
  /^(hoja:|p[aá]gina|paciente:|sexo:|edad:|orden:|f\/n|f\.?\s*n\.?|fecha|fechas:|resultados$|examen$|www\.|laboratorio|gracias|aviso|privacidad|city\s*shops|del\s+valle|perfil\s+plus$|nombre|m[eé]dico|doctor|sucursal|^\d{5,}$|\borde[nr]\b|\d+\s*a[nñ]os|valores?\s+de\s+referencia$|brincos|promocion\s+call\s+center|betya|resultados\s+parciales|recomendable|deseable|[oó]ptimo|lim[ií]trofe|elementos$|\*+$|q\.?\s*f\.?\s*b|c[eé]dula|responsable|acreditaci[oó]n|informe\s+final|aviso\s+importante)/i;

const LAPI_METADATA =
  /\b(city\s*shops|del\s+valle|orden\s+\d|\bperfil\s+plus\b|\bsucursal\b|\bplaza\b|\bshops\b|\b749109\b)/i;

const LAPI_NOISE_LINE =
  /^(p\s*a\s*c\s*i\s*e\s*n\s*t\s*e|examen\s*resultado\s*valores|gutierrez\s+grados|f\/n\s*:|f\.?\s*n\.?\s*:|\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i;

const SECTION_START =
  /\b(QU[IÍ]MICA|BIOMETR[IÍ]A|HEMOGRAMA|PERFIL\s+[A-ZÁÉÍÓÚ]+|UROAN[AÁ]LISIS|COPROLOG[IÍ]A|ORINA|TIROIDES|LIPIDOS|HEP[AÁ]TICO|RENAL|INTEGRAL)\b/i;

const TABLE_HEADER = /^(examen|resultado|valores?\s+de\s+referencia|examen\s*resultado)/i;

const LAPI_TABLE_ROW =
  /^([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9()/\s%-]{1,48}?)\s{2,}([<>]?\s*[\d.,]+)\s{2,}(.+)$/;

const LAPI_TABLE_ROW_TIGHT =
  /^([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9()/\s%-]{1,48}?)\s+([<>]?\s*[\d.,]+)\s+([\d.,]+\s*[-–—]\s*[\d.,]+.+|<\s*[\d.,]+.+)$/;

/** Value + low - high(+unit glued) on the line after the analyte name. */
const LAPI_VALUE_RANGE_LINE =
  /^\s*([<>]?\s*[\d.,]+)(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+)?\s+([\d.,]+)\s*[-–—]\s*(.+)$/;

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
] as const;

function shouldSkipLapiLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return true;
  if (trimmed === '*') return true;
  if (LAPI_SKIP.test(trimmed)) return true;
  if (LAPI_NOISE_LINE.test(trimmed)) return true;
  if (TABLE_HEADER.test(trimmed)) return true;
  if (LAPI_METADATA.test(trimmed)) return true;
  if (/^\d{5,8}$/.test(trimmed)) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/f\/n\s*:\s*\d{2}\/\d{2}\/\d{4}/i.test(trimmed)) return true;
  if (
    /^[A-ZÁÉÍÓÚÑ]{2,}(\s+[A-ZÁÉÍÓÚÑ]{2,}){1,5}$/.test(trimmed) &&
    !/\d/.test(trimmed)
  ) {
    return true;
  }
  return false;
}

function tryUnGlueHighAndUnit(tail: string, unit: string): string | null {
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

export function splitGluedHighAndUnit(tail: string): {
  high: number | null;
  unit: string | null;
} {
  const trimmed = tail.trim();
  if (!trimmed) return { high: null, unit: null };

  for (const unit of LAPI_GLUE_UNITS) {
    const highStr = tryUnGlueHighAndUnit(trimmed, unit);
    if (highStr != null && highStr.length > 0) {
      const high = parseNumericValue(highStr);
      if (high != null) {
        return { high, unit: isValidLabUnit(unit) ? unit : null };
      }
    }
  }

  const upper = trimmed.match(/^<\s*([\d.,]+)\s*(.*)$/i);
  if (upper) {
    const unit = upper[2]?.trim() || null;
    return {
      high: parseNumericValue(upper[1]),
      unit: unit && isValidLabUnit(unit) ? unit : null,
    };
  }

  const fallback = trimmed.match(/^([\d.,]+)(.*)$/);
  if (fallback) {
    const unit = fallback[2]?.trim() || null;
    return {
      high: parseNumericValue(fallback[1]),
      unit: unit && isValidLabUnit(unit) ? unit : null,
    };
  }

  return { high: parseNumericValue(trimmed), unit: null };
}

function parseLapiRangeTail(tail: string): {
  unit: string | null;
  low: number | null;
  high: number | null;
  rangeText: string | null;
} {
  const line = tail.trim();
  if (!line) return { unit: null, low: null, high: null, rangeText: null };

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

  const paired = line.match(/^([\d.,]+)\s*[-–—]\s*([\d.,]+)\s*(.*)$/i);
  if (paired) {
    const unit = paired[3]?.trim() || null;
    return {
      low: parseNumericValue(paired[1]),
      high: parseNumericValue(paired[2]),
      unit: unit && isValidLabUnit(unit) ? unit : null,
      rangeText: `${paired[1].trim()}-${paired[2].trim()}`,
    };
  }

  return { unit: null, low: null, high: null, rangeText: line };
}

function scoreLapiRow(row: Omit<ParameterCandidate, 'confidence' | 'validationErrors' | 'canonicalName'>): number {
  let c = 0.78;
  if (row.value != null) c += 0.1;
  if (row.unit) c += 0.05;
  if (row.referenceLow != null || row.referenceHigh != null) c += 0.07;
  return Math.min(0.95, c);
}

function parseLapiTabularLine(line: string): ParameterCandidate | null {
  if (shouldSkipLapiLine(line)) return null;

  const cols = line.split(/\t|\s{2,}/).map((c) => c.trim()).filter(Boolean);
  let name: string | undefined;
  let valueRaw: string | undefined;
  let rangePart: string | undefined;

  if (cols.length >= 3) {
    name = cols[0];
    valueRaw = cols[1];
    rangePart = cols.slice(2).join(' ');
  } else {
    const spaced = line.match(LAPI_TABLE_ROW);
    if (spaced) {
      name = spaced[1].trim();
      valueRaw = spaced[2].replace(/\s+/g, '').trim();
      rangePart = spaced[3].trim();
    } else {
      const tight = line.match(LAPI_TABLE_ROW_TIGHT);
      if (!tight) return null;
      name = tight[1].trim();
      valueRaw = tight[2].replace(/\s+/g, '').trim();
      rangePart = tight[3].trim();
    }
  }

  if (!name || !valueRaw || !rangePart) return null;
  if (!isValidAnalyteName(name)) return null;

  const value = parseNumericValue(valueRaw);
  const range = parseLapiRangeTail(rangePart);

  const row: ParameterCandidate = {
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

function collectTrailingUnit(lines: string[], startIdx: number): {
  unit: string | null;
  consumed: number;
} {
  let idx = startIdx;
  if (idx < lines.length && lines[idx] === '*') idx++;

  if (idx < lines.length) {
    const unitToken = extractKnownUnitToken(lines[idx]);
    if (unitToken && !isValidAnalyteName(lines[idx])) {
      return { unit: unitToken, consumed: idx - startIdx + 1 };
    }
  }

  return { unit: null, consumed: 0 };
}

export function parseLapiTwoLineResults(text: string): ParameterCandidate[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const results: ParameterCandidate[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const nameLine = lines[i];
    if (shouldSkipLapiLine(nameLine)) continue;
    if (!isValidAnalyteName(nameLine)) continue;
    if (i + 1 >= lines.length) continue;

    const valueLine = lines[i + 1];
    const valueRangeMatch = valueLine.match(LAPI_VALUE_RANGE_LINE);
    if (!valueRangeMatch) continue;

    const valueRaw = valueRangeMatch[1].replace(/\s+/g, '').trim();
    const lowRaw = valueRangeMatch[2];
    const tail = valueRangeMatch[3].trim();
    const { high, unit: gluedUnit } = splitGluedHighAndUnit(tail);

    const trailing = collectTrailingUnit(lines, i + 2);
    const unit = gluedUnit ?? trailing.unit;
    const consumed = 1 + 1 + trailing.consumed;

    const key = nameLine.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const row: ParameterCandidate = {
      rawName: nameLine,
      canonicalName: null,
      value: parseNumericValue(valueRaw),
      valueText: valueRaw,
      unit,
      referenceLow: parseNumericValue(lowRaw),
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

export function parseLapiTabularResults(text: string): ParameterCandidate[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const results: ParameterCandidate[] = [];
  const seen = new Set<string>();
  let inResultsSection = false;

  for (const line of lines) {
    if (SECTION_START.test(line)) {
      inResultsSection = true;
      continue;
    }
    if (!inResultsSection) continue;

    const row = parseLapiTabularLine(line);
    if (!row) continue;
    const key = row.rawName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(row);
  }

  return results;
}

export function parseLapiStackedResults(text: string): ParameterCandidate[] {
  return parseStackedLayout(text, {
    sectionStart: SECTION_START,
    skipLine: LAPI_SKIP,
  }).filter((row) => !LAPI_METADATA.test(row.rawName) && !shouldSkipLapiLine(row.rawName));
}

export const lapiParser: LabParser = {
  vendor: 'lapi',
  name: 'LapiParser',

  canParse(classification: ClassifiedDocument, text: string): boolean {
    return classification.vendor === 'lapi' || LAPI_MARKER.test(text);
  },

  parse(text: string): ParameterCandidate[] {
    const tabular = parseLapiTabularResults(text);
    if (tabular.length > 0) return tabular;

    const twoLine = parseLapiTwoLineResults(text);
    if (twoLine.length > 0) return twoLine;

    return parseLapiStackedResults(text);
  },
};
