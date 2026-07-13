import { parseNumericValue } from '../../utils/labUnitConversion.utils';
import type { ParsedLabLine } from './labParser.service';

const CHOPO_MARKER = /chopo\.com\.mx|grupo\s+diagn[oó]stico\s+m[eé]dico\s+proa/i;

const FOOTER_SIGNATURE_PATTERN =
  /\b(q\.?\s*f\.?\s*b\.?|c[eé]dula\s+prof(?:esional)?|responsable\s+del\s+laboratorio)\b/i;

const CHOPO_SKIP_LINE =
  /^(hoja:|p[aá]gina|prueba$|paciente:|sexo:|fecha:|dirigido|edad:|orden:|id paciente|fecha de nacimiento|resultados$|an[aá]lisis cl[ií]nicos|bajo \(lr\)|dentro \(lr\)|sobre \(lr\)|l[ií]mites de referencia|a[nñ]os$|www\.|gracias por|grupo diagn[oó]stico|sucursal |av\.|cup[oó]n|vigencia|descuento|producto|c[oó]digo|estimado paciente|paciente id:|m[eé]todo:|informe final|responsable|acreditaci[oó]n|consulte el|recuerde que|descarga nuestra|en\s+caso\s+de|aviso importante|el\s+prestador|aplica en|posteriores|reproceso del|universidad|c[eé]dula|q\.?\s*f\.?\s*b\.?|te sugerimos|el descuento|precios sujetos|mientras m[aá]s|_{3,}$|criterios de interpretaci[oó]n|nota:$|esta gu[ií]a recomienda|la tasa de filtraci[oó]n)/i;

const CHOPO_VALUE_LINE = /^[<>]?\s*[\d.,]+$/;

/** Qualitative culture / EGO result tokens (non-numeric CHOPO stacked values). */
const CHOPO_TEXT_VALUE_LINE =
  /^(No Observados|Sin desarrollo microbiano|Negativo|Positivo|Ausentes?|Escasas?|Abundantes?|[AÁ]mbar|Amarillo|Turbio|Claro|Urato Amorfo|Oxalato de Calcio|Fosfato Amorfo)$/i;

const CHOPO_TEXT_REF_LINE =
  /^(Negativo|Positivo|Ausentes?|Escasas?|Abundantes?|Amarillo|Claro|Negativo\b|Ausentes?\b|.*\b(?:leu|eri)\/uL\b|.*\/campo\b|.*\bmg\/dL\b)/i;

const DEMOGRAPHIC_LINE = /^(masculino|femenino|a quien corresponda)$/i;

const CHOPO_SECTION_START =
  /\b(CURVA\s+DE\s+TOLERANCIA\s+A\s+LA\s+GLUCOSA|CURVA\s+DE\s+INSULINA|(?:SUPER\s+)?QU[IÍ]MICA(?:\s+INTEGRAL)?\s+DE\s+\d+\s+ELEMENTOS|INSULINA EN SUERO|BIOMETR[IÍ]A|HEMOGRAMA|PERFIL(?:\s+DE)?\s+LIP[IÍ]D(?:OS|ICO)(?:\s+EN\s+SUERO)?|PERFIL\s+[A-ZÁÉÍÓÚ]+|TRANSAMINASA|BILIRRUBINAS?\s+EN\s+SANGRE|FOSFATASA ALCALINA|GAMMA GLUTAMIL|PROTE[IÍ]NAS EN SUERO|TIROideos|ELECTROLITOS|COAGULACI[OÓ]N|UROAN[AÁ]LISIS|UROCULTIVO|EXAMEN GENERAL DE ORINA|EXAMEN F[IÍ]SICO|EXAMEN QU[IÍ]MICO|EXAMEN MICROSC[OÓ]PICO|FUNCI[OÓ]N RENAL|RIESGO CARDIOVASCULAR|INMUNOGLOBULINAS?\s+EN\s+SUERO)\b/i;

const CHOPO_SECTION_TITLE =
  /^(CURVA\s+DE\s+TOLERANCIA|CURVA\s+DE\s+INSULINA|TRANSAMINASA|BILIRRUBINAS?\s+EN\s+SANGRE|FOSFATASA ALCALINA|GAMMA GLUTAMIL|PROTE[IÍ]NAS EN SUERO|(?:SUPER\s+)?QU[IÍ]MICA(?:\s+INTEGRAL)?\s+DE\s+\d+\s+ELEMENTOS|INSULINA EN SUERO|BIOMETR[IÍ]A|HEMOGRAMA|PERFIL(?:\s+DE)?\s+LIP[IÍ]D(?:OS|ICO)(?:\s+EN\s+SUERO)?|PERFIL\s+[A-ZÁÉÍÓÚ]+|UROCULTIVO|EXAMEN GENERAL DE ORINA|EXAMEN F[IÍ]SICO|EXAMEN QU[IÍ]MICO|EXAMEN MICROSC[OÓ]PICO|FUNCI[OÓ]N RENAL|RIESGO CARDIOVASCULAR|MICROSCOPIA|CULTIVO$)/i;

const CHOPO_CURVE_GLUCOSE_SECTION = /CURVA\s+DE\s+TOLERANCIA\s+A\s+LA\s+GLUCOSA/i;
const CHOPO_CURVE_INSULIN_SECTION = /CURVA\s+DE\s+INSULINA/i;

const CHOPO_INSULIN_SAMPLE_NAME = /^\d+[ªaº°]?\.\s*Muestra\s+Insulina/i;
const CHOPO_INSULIN_REF_TABLE_ROW =
  /^(BASAL|1\s+hora|2\s+horas|3\s+horas|>=?\s*4\s*hrs?|4\s+horas|\d+\s+horas?)$/i;

const GLUCOSE_CURVE_TIME_LABELS = ['basal', '30 min', '1 hora', '2 horas', '3 horas'] as const;
const INSULIN_CURVE_TIME_LABELS = ['basal', '30 min', '1 hora', '2 horas', '3 horas', '4 horas'] as const;

const INSULIN_CURVE_REF_RANGES: Record<string, { low: number; high: number }> = {
  basal: { low: 2.6, high: 24.9 },
  '1 hora': { low: 20, high: 123 },
  '2 horas': { low: 18, high: 56 },
  '3 horas': { low: 8, high: 22 },
  '4 horas': { low: 6, high: 21 },
};

const KNOWN_LAB_UNITS =
  /^(mg\/dL|g\/dL(?:\s*\(%\))?|g\/l|mg\/l|mmol\/L|mEq\/L|meq\/L|U\/L|u\/l|μg\/dL|µg\/dL|ug\/dL|μUI\/mL|µUI\/mL|uUI\/mL|mUI\/L|UI\/L|UI\/mL|%|pg\/mL|ng\/mL|fL|10\^3\/μL|10\^6\/μL|10\^3uL|10\^6uL|umol\/L|mm\/hr|copias\/mL|s|seg|ratio|millones\/mm3|miles\/mm3|miles\/[μµ]L|millones\/[μµ]L|mUl\/L|μg\/L|ug\/L|mOsmol\/Kg|g\/cm2|g\/cm²|kg|m|mL\/min\/1\.73\s*m2|leu\/uL|eri\/uL)$/i;

/** CHOPO 2012 PDFs often prefix unit lines with bullets/dots: ". mg/dL", "· mg/dL". */
function stripUnitLinePrefix(line: string): string {
  return line.trim().replace(/^[\s.·•\-–—]+/, '').trim();
}

export function extractKnownUnitToken(line: string): string | null {
  const cleaned = stripUnitLinePrefix(line);
  if (!cleaned) return null;
  if (KNOWN_LAB_UNITS.test(cleaned)) return cleaned;
  return null;
}

export function isUnitOnlyLine(line: string): boolean {
  return extractKnownUnitToken(line) != null;
}

export function isChopoReport(text: string): boolean {
  return CHOPO_MARKER.test(text);
}

export function isFooterOrSignatureLine(text: string): boolean {
  return FOOTER_SIGNATURE_PATTERN.test(text.trim());
}

export function isProfessionalLicenseValue(name: string, value: number | null): boolean {
  if (value == null || !Number.isFinite(value)) return false;
  const digits = String(Math.trunc(value));
  if (digits.length < 5 || digits.length > 8) return false;
  return /\bc[eé]dula\b/i.test(name) || isFooterOrSignatureLine(name);
}

export function isRangeFragmentName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (CHOPO_INSULIN_SAMPLE_NAME.test(n)) return false;
  if (/^\d/.test(n)) return true;
  if (/^[\d.,]+\s*[-–—]\s*$/i.test(n)) return true;
  if (/^>\s*o\s*=/i.test(n)) return true;
  if (/^hoja:\s*\d+/i.test(n)) return true;
  if (/^\d{5,}/.test(n)) return true;
  if (/^\d+\s*[-–—]\s*\d+\s+(deseable|normal|[oó]ptimo|alto|lim[ií]trofe|moderadamente)/i.test(n)) return true;
  if (/^<\s*[\d.,]+\s+(deseable|normal|[oó]ptimo|alto)/i.test(n)) return true;
  if (/^>=?\s*[\d.,]+\s+(deseable|normal|[oó]ptimo|alto|riesgo|lim[ií]trofe)/i.test(n)) return true;
  if (/^>=?\s*[\d.,]+\s+\w/i.test(n)) return true;
  if (/^[<>]\s*[\d.,]+\s+[a-zA-Zμµ%/]+$/i.test(n)) return true;
  if (/paciente\s*id/i.test(n)) return true;
  if (/^qu[ií]mica de\s+\d+/i.test(n)) return true;
  if (CHOPO_SECTION_TITLE.test(n)) return true;
  if (/^<\s*[\d.,]+\s*a[nñ]os\b/i.test(n)) return true;
  if (/^>\s*[\d.,]+\s*a[nñ]os\b/i.test(n)) return true;
  if (/^(deseable|normal|bajo|alto|lim[ií]trofe|muy\s+alto|moderado|[oó]ptimo|ideal|t[oó]xico|negativo|ausentes?|escasas?|abundantes?)\b/i.test(n)) return true;
  if (/^(bajo|alto)\s+(riesgo|menor|mayor)\b/i.test(n)) return true;
  if (/^a\s+partir\s+del\s+\d+/i.test(n)) return true;
  if (/^fecha\s+toma\s+de\s+muestra/i.test(n)) return true;
  if (/^valor(es)?\s+de\s+referencia/i.test(n)) return true;
  if (/^recomendados\s+por/i.test(n)) return true;
  if (/^\d+\s*[-–—]\s*\d+\s+(mg\/dL|mg\/dl|g\/dL|%)/i.test(n)) return true;
  if (/^mayor\s+de\s+\d+/i.test(n)) return true;
  if (/^menor\s+de\s+\d+/i.test(n)) return true;
  if (CHOPO_TEXT_VALUE_LINE.test(n)) return true;
  if (/^microscopia$|^cultivo$/i.test(n)) return true;
  return false;
}

export function isValidAnalyteName(name: string): boolean {
  if (name.length < 2 || name.length > 90) return false;
  if (DEMOGRAPHIC_LINE.test(name)) return false;
  if (isRangeFragmentName(name)) return false;
  if (isFooterOrSignatureLine(name)) return false;
  if (CHOPO_SKIP_LINE.test(name)) return false;
  // Unidades de laboratorio conocidas no son nombres de analito (p. ej. "mg/dL", ". mg/dL" en CHOPO 2012)
  if (isUnitOnlyLine(name)) return false;
  if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]{2,}/.test(name)) return false;
  if (/^=+$/.test(name)) return false;
  return true;
}

export function isValidLabUnit(unit: string | null | undefined): boolean {
  if (!unit) return true;
  const u = stripUnitLinePrefix(unit);
  if (!u) return true;
  if (/\d{1,2}\/\d{1,2}/.test(u) && !/^mL\/min\/1\.73/i.test(u)) return false;
  if (/^\/\d/.test(u)) return false;
  if (/^(alto|bajo|normal|deseable|[oó]ptimo|lim[ií]trofe|elementos)$/i.test(u)) return false;
  if (KNOWN_LAB_UNITS.test(u)) return true;
  if (/^mL\/min\/1\.73\s*m2$/i.test(u)) return true;
  if (/^g\/dL\s*\(%\)$/i.test(u)) return true;
  return /^[a-zA-Zμµ%\/\^°]+(?:\/[a-zA-Zμµ]+)?$/i.test(u);
}

function shouldSkipChopoLine(line: string): boolean {
  if (!line || line.length < 2) return true;
  if (CHOPO_SKIP_LINE.test(line)) return true;
  if (/^=+$/.test(line)) return true;
  if (/l[ií]mites de referencia/i.test(line)) return true;
  return false;
}

function parseChopoRangeLine(rangeLine: string): {
  unit: string | null;
  low: number | null;
  high: number | null;
  rangeText: string | null;
} | null {
  const line = rangeLine.trim();
  if (!line || shouldSkipChopoLine(line)) return null;

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

  const geLower = line.match(/^>\s*o\s*=\s*([\d.,]+)\s*(.*)$/i);
  if (geLower) {
    const unit = geLower[2]?.trim() || null;
    return {
      low: parseNumericValue(geLower[1]),
      high: null,
      unit: unit && isValidLabUnit(unit) ? unit : null,
      rangeText: line.trim(),
    };
  }

  const lower = line.match(/^>\s*([\d.,]+)\s*(.*)$/i);
  if (lower) {
    const unit = lower[2]?.trim() || null;
    return {
      low: parseNumericValue(lower[1]),
      high: null,
      unit: unit && isValidLabUnit(unit) ? unit : null,
      rangeText: line.trim(),
    };
  }

  return null;
}

/** Unit header that starts an inverted CHOPO row (unit → value → name). */
function isInvertedRowUnitLine(line: string): boolean {
  if (extractKnownUnitToken(line) != null) return true;
  const trimmed = line.trim();
  return trimmed.length > 0 && /^[\s.·•\-–—]+$/.test(trimmed);
}

function isNextInvertedRowStart(lines: string[], index: number): boolean {
  if (!isInvertedRowUnitLine(lines[index] ?? '')) return false;
  return index + 1 < lines.length && CHOPO_VALUE_LINE.test(lines[index + 1] ?? '');
}

function extractInvertedReferenceBlock(
  lines: string[],
  startIdx: number
): {
  low: number | null;
  high: number | null;
  rangeText: string | null;
  unit: string | null;
  consumed: number;
} {
  let low: number | null = null;
  let high: number | null = null;
  let rangeText: string | null = null;
  let unit: string | null = null;
  let j = startIdx;

  while (j < lines.length) {
    const line = lines[j];

    if (isNextInvertedRowStart(lines, j)) break;
    if (detectSectionContext(line)) break;
    if (/^responsable del laboratorio/i.test(line)) break;
    if (isFooterOrSignatureLine(line)) break;

    if (/l[ií]mites de referencia/i.test(line)) {
      const unitInHeader = line.match(/\(([^)]+)\)/);
      if (unitInHeader?.[1] && isValidLabUnit(unitInHeader[1])) {
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
        if (parsed.unit) unit = parsed.unit;
        j++;
        while (j < lines.length) {
          const skipLine = lines[j];
          if (isNextInvertedRowStart(lines, j)) break;
          if (detectSectionContext(skipLine)) break;
          if (/^responsable del laboratorio/i.test(skipLine)) break;
          if (isFooterOrSignatureLine(skipLine)) break;
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

function normalizeValueRaw(raw: string): string {
  return raw.replace(/\s+/g, '').trim();
}

function scoreChopoLine(row: Omit<ParsedLabLine, 'confidence'>): number {
  let c = 0.75;
  if (row.resultValue != null) c += 0.1;
  if (row.resultUnit) c += 0.05;
  if (row.referenceRangeLow != null || row.referenceRangeHigh != null) c += 0.08;
  return Math.min(0.95, c);
}

type ChopoSectionContext = 'none' | 'glucose_curve' | 'insulin_curve' | 'generic';

function detectSectionContext(line: string): ChopoSectionContext | null {
  if (CHOPO_CURVE_GLUCOSE_SECTION.test(line)) return 'glucose_curve';
  if (CHOPO_CURVE_INSULIN_SECTION.test(line)) return 'insulin_curve';
  if (CHOPO_SECTION_START.test(line)) return 'generic';
  return null;
}

function extractGlucoseTimeFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (/curva\s+tolerancia|glucosa\s*\(?\s*basal|glucosa\s+basal/.test(lower)) return 'basal';
  const minMatch = lower.match(/(?:a\s+los\s+|en\s+)?(\d+)\s*min/);
  if (minMatch) return `${minMatch[1]} min`;
  const hourMatch = lower.match(/(?:de\s+|a\s+los\s+)?(\d+)\s+horas?/);
  if (hourMatch) return `${hourMatch[1]} ${parseInt(hourMatch[1], 10) === 1 ? 'hora' : 'horas'}`;
  return null;
}

function normalizeGlucoseCurveAnalyteName(rawName: string, timeIndex: number): string {
  const timeFromName = extractGlucoseTimeFromName(rawName);
  if (timeFromName) {
    return timeFromName === 'basal' ? 'Glucosa basal' : `Glucosa ${timeFromName}`;
  }
  if (/^glucosa$/i.test(rawName.trim())) {
    const label = GLUCOSE_CURVE_TIME_LABELS[timeIndex] ?? `${timeIndex}`;
    return label === 'basal' ? 'Glucosa basal' : `Glucosa ${label}`;
  }
  return rawName;
}

function normalizeInsulinCurveAnalyteName(rawName: string, sampleIndex: number): string {
  const ordinalMatch = rawName.match(/^(\d+)[ªaº°]?\.\s*Muestra\s+Insulina/i);
  if (ordinalMatch) {
    const n = parseInt(ordinalMatch[1], 10);
    const label = INSULIN_CURVE_TIME_LABELS[n - 1] ?? `muestra ${n}`;
    return label === 'basal' ? 'Insulina basal' : `Insulina ${label}`;
  }
  if (/insulina/i.test(rawName) && sampleIndex === 0) return 'Insulina basal';
  const label = INSULIN_CURVE_TIME_LABELS[sampleIndex];
  if (label) return label === 'basal' ? 'Insulina basal' : `Insulina ${label}`;
  return rawName;
}

function insulinTimeKeyFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes('basal')) return 'basal';
  const minMatch = lower.match(/(\d+)\s*min/);
  if (minMatch) return `${minMatch[1]} min`;
  const hourMatch = lower.match(/(\d+)\s+horas?/);
  if (hourMatch) {
    const h = parseInt(hourMatch[1], 10);
    return `${h} ${h === 1 ? 'hora' : 'horas'}`;
  }
  return null;
}

function pushChopoResult(
  results: ParsedLabLine[],
  seen: Set<string>,
  row: Omit<ParsedLabLine, 'confidence'>
): void {
  const key = `${row.analyteNameRaw.toLowerCase()}|${row.resultValueText}|${row.referenceRangeLow ?? ''}|${row.referenceRangeHigh ?? ''}|${row.resultUnit ?? ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  const parsed: ParsedLabLine = { ...row, confidence: scoreChopoLine(row) };
  results.push(parsed);
}

function applyCurveContext(
  nameLine: string,
  sectionContext: ChopoSectionContext,
  unit: string | null,
  low: number | null,
  high: number | null,
  rangeText: string | null,
  glucoseTimeIndex: number,
  insulinSampleIndex: number,
  defaultGlucoseUnit: string | null,
  defaultInsulinUnit: string | null
): {
  analyteNameRaw: string;
  unit: string | null;
  low: number | null;
  high: number | null;
  rangeText: string | null;
  glucoseTimeIndex: number;
  insulinSampleIndex: number;
  defaultGlucoseUnit: string | null;
  defaultInsulinUnit: string | null;
} {
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
    if (!nextUnit && nextDefaultGlucose) nextUnit = nextDefaultGlucose;
    if (nextUnit && !nextDefaultGlucose) nextDefaultGlucose = nextUnit;
    nextGlucose++;
  } else if (sectionContext === 'insulin_curve' || CHOPO_INSULIN_SAMPLE_NAME.test(nameLine)) {
    analyteNameRaw = normalizeInsulinCurveAnalyteName(nameLine, insulinSampleIndex);
    if (!nextUnit && nextDefaultInsulin) nextUnit = nextDefaultInsulin;
    if (nextUnit && !nextDefaultInsulin) nextDefaultInsulin = nextUnit;
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

export function parseChopoStackedResults(text: string): ParsedLabLine[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const results: ParsedLabLine[] = [];
  const seen = new Set<string>();
  let i = 0;
  let inResultsSection = false;
  let sectionContext: ChopoSectionContext = 'none';
  let glucoseTimeIndex = 0;
  let insulinSampleIndex = 0;
  let defaultGlucoseUnit: string | null = null;
  let defaultInsulinUnit: string | null = null;

  while (i < lines.length) {
    const line = lines[i];

    const nextSection = detectSectionContext(line);
    if (nextSection) {
      inResultsSection = true;
      sectionContext = nextSection;
      if (nextSection === 'glucose_curve') glucoseTimeIndex = 0;
      if (nextSection === 'insulin_curve') insulinSampleIndex = 0;
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
      if (
        isValidAnalyteName(nameLine) &&
        !shouldSkipChopoLine(nameLine) &&
        !CHOPO_INSULIN_REF_TABLE_ROW.test(nameLine)
      ) {
        const headerUnit = extractKnownUnitToken(lines[i]);
        const valueRaw = normalizeValueRaw(lines[i + 1]);
        const resultValue = parseNumericValue(valueRaw);
        const refStart = i + 3;
        const refBlock = extractInvertedReferenceBlock(lines, refStart);
        let unit = headerUnit ?? refBlock.unit;
        let low = refBlock.low;
        let high = refBlock.high;
        let rangeText = refBlock.rangeText;
        const consumed = 3 + refBlock.consumed;

        const curve = applyCurveContext(
          nameLine,
          sectionContext,
          unit,
          low,
          high,
          rangeText,
          glucoseTimeIndex,
          insulinSampleIndex,
          defaultGlucoseUnit,
          defaultInsulinUnit
        );
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
    if (
      shouldSkipChopoLine(line) ||
      CHOPO_INSULIN_REF_TABLE_ROW.test(line) ||
      !isValidAnalyteName(line)
    ) {
      i++;
      continue;
    }

    if (i + 1 >= lines.length) break;

    let valueLineIndex = i + 1;
    let headerUnit: string | null = null;
    const unitHeaderToken = extractKnownUnitToken(lines[valueLineIndex] ?? '');
    if (
      unitHeaderToken &&
      !CHOPO_VALUE_LINE.test(lines[valueLineIndex]) &&
      valueLineIndex + 1 < lines.length &&
      CHOPO_VALUE_LINE.test(lines[valueLineIndex + 1])
    ) {
      headerUnit = unitHeaderToken;
      valueLineIndex++;
    }

    const valueLine = lines[valueLineIndex];

    // Qualitative culture / EGO rows: name → text value → optional reference text
    if (!CHOPO_VALUE_LINE.test(valueLine) && CHOPO_TEXT_VALUE_LINE.test(valueLine)) {
      const valueRaw = valueLine.trim();
      let rangeText: string | null = null;
      let consumed = valueLineIndex - i + 1;
      const rangeLineIndex = valueLineIndex + 1;
      if (rangeLineIndex < lines.length) {
        const maybeRef = lines[rangeLineIndex].trim();
        if (
          !CHOPO_VALUE_LINE.test(maybeRef) &&
          !isValidAnalyteName(maybeRef) &&
          (CHOPO_TEXT_REF_LINE.test(maybeRef) || CHOPO_TEXT_VALUE_LINE.test(maybeRef))
        ) {
          rangeText = maybeRef;
          consumed = rangeLineIndex - i + 1;
        } else if (
          !isValidAnalyteName(maybeRef) &&
          !shouldSkipChopoLine(maybeRef) &&
          !detectSectionContext(maybeRef) &&
          maybeRef.length <= 60
        ) {
          // Soft qualitative reference (e.g. "Amarillo", "Negativo ó < 10 leu/uL")
          rangeText = maybeRef;
          consumed = rangeLineIndex - i + 1;
        }
      }

      pushChopoResult(results, seen, {
        analyteNameRaw: line,
        resultValue: null,
        resultValueText: valueRaw,
        resultUnit: null,
        referenceRangeLow: null,
        referenceRangeHigh: null,
        referenceRangeText: rangeText,
        rawTextSnippet: lines.slice(i, i + consumed).join(' | ').slice(0, 200),
      });
      i += consumed;
      continue;
    }

    if (!CHOPO_VALUE_LINE.test(valueLine)) {
      i++;
      continue;
    }

    const valueRaw = normalizeValueRaw(valueLine);
    const resultValue = parseNumericValue(valueRaw);
    let unit: string | null = headerUnit;
    let low: number | null = null;
    let high: number | null = null;
    let rangeText: string | null = null;
    let consumed = valueLineIndex - i + 1;

    const rangeLineIndex = valueLineIndex + 1;
    if (rangeLineIndex < lines.length) {
      const parsedRange = parseChopoRangeLine(lines[rangeLineIndex]);
      if (parsedRange) {
        unit = parsedRange.unit ?? unit;
        low = parsedRange.low;
        high = parsedRange.high;
        rangeText = parsedRange.rangeText;
        consumed = rangeLineIndex - i + 1;
      } else if (
        sectionContext === 'glucose_curve' &&
        isValidLabUnit(lines[rangeLineIndex]) &&
        !isValidAnalyteName(lines[rangeLineIndex])
      ) {
        unit = lines[rangeLineIndex].trim();
        consumed = rangeLineIndex - i + 1;
      }
    }

    const curve = applyCurveContext(
      line,
      sectionContext,
      unit,
      low,
      high,
      rangeText,
      glucoseTimeIndex,
      insulinSampleIndex,
      defaultGlucoseUnit,
      defaultInsulinUnit
    );
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
