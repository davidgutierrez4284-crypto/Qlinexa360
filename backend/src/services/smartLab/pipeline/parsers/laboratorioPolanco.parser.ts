import { parseNumericValue } from '../../../../utils/labUnitConversion.utils';
import { isValidAnalyteName, isValidLabUnit } from '../../chopoParser.service';
import type { LabParser } from '../labParser.interface';
import { candidateFromParsedLine } from '../labParser.interface';
import type { ClassifiedDocument, ParameterCandidate } from '../types';

/**
 * Marcadores de reportes reales de Laboratorio Médico Polanco (LMP).
 * pdf-parse no trae el logo; el nombre completo del laboratorio solo aparece en el
 * pie de página ("LABORATORIO MEDICO POLANCO, S.A. DE C.V. ..."), por lo que también
 * se reconoce por la sucursal "Plaza Miramontes (LMP)", el prefijo de factura "PL-" y
 * el número de acreditación ema "CL-088".
 */
export const LABORATORIO_POLANCO_MARKER =
  /laboratorio\s+m[eé]dico\s+polanco|plaza\s+miramontes\s*\(lmp\)|factura\s*:\s*pl-?\d{4,}|acreditaci[oó]n\s+no\s*\.?\s*cl-088/i;

/** Líneas de encabezado/pie de página que nunca son nombres de analito ni valores. */
const LMP_SKIP =
  /^(sexo:edad:|toma:|expediente:|impresi[oó]n:|m[eé]dico:|empresa:|estatus:|nacimiento:|nacionalidad:|centro de proceso:|cdmx|examenintervalo de referencia|bajo intervalo|de referencia|dentro intervalo|sobre intervalo|indicador|muestra:|sangre total|plasma|suero|orina|m[eé]todo:|a quien corresponda|masculino|femenino|impedancia|electroquimioluminiscencia|fotometr[ií]a|c[aá]lculo|laboratorio\s+medico\s+polanco|ced\.\s*profesional|q\.f\.b\.|direcci[oó]n\s+de\s+laboratorio|garant[ií]a\s+de\s+calidad|para\s+los\s+m[eé]dicos|seleccionar\s+intervalo|en\s+el\s+intervalo\s+de\s+referencia|diferente\s+a\s+valor\s+de\s+referencia|\^?\s*prueba\s+no\s+acreditada|los\s+resultados\s+obtenidos|verificar\s+resultados|laboratorio\s+de\s+ensayo\s+acreditado)/i;

/** Etiquetas glued al final de la línea (columna invertida por pdf-parse). */
const LMP_SUFFIX_SKIP = /(paciente:|sucursal:|m[eé]todo:)\s*$/i;

/** Valores demográficos/administrativos sin etiqueta explícita al inicio. */
const LMP_STANDALONE_SKIP =
  /^(\d+\s*\/\s*\d+|\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2})?|\d{1,3}\s*a[nñ]os|factura\s*:\s*pl-?\d+)$/i;

function shouldSkipPolancoLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length < 1) return true;
  if (LMP_SKIP.test(t)) return true;
  if (LMP_SUFFIX_SKIP.test(t)) return true;
  if (LMP_STANDALONE_SKIP.test(t)) return true;
  return false;
}

/** true si la línea es "de título" (solo mayúsculas/dígitos/puntuación, sin minúsculas). */
function looksLikeTitleLine(line: string): boolean {
  return /[A-ZÁÉÍÓÚÑ]/.test(line) && !/[a-záéíóúñ]/.test(line);
}

function cleanUnit(raw: string | undefined | null): string | null {
  const u = (raw ?? '').trim();
  if (!u) return null;
  return isValidLabUnit(u) ? u : null;
}

type TierBound = { low: number | null; high: number | null; unit: string | null; raw: string };

function parseBoundOrPair(rest: string): { low: number | null; high: number | null; unit: string | null } | null {
  const t = rest.trim();
  if (!t) return null;

  const paired = t.match(/^([\d.,]+)\s*[-–—]\s*([\d.,]+)\s*([a-zA-Z0-9μµ%/^]*)$/);
  if (paired) {
    return {
      low: parseNumericValue(paired[1]),
      high: parseNumericValue(paired[2]),
      unit: cleanUnit(paired[3]),
    };
  }

  const upperSymbol = t.match(/^[<≤]=?\s*([\d.,]+)\s*([a-zA-Z0-9μµ%/^]*)$/);
  if (upperSymbol) {
    return { low: null, high: parseNumericValue(upperSymbol[1]), unit: cleanUnit(upperSymbol[2]) };
  }

  const lowerSymbol = t.match(/^[>≥]=?\s*([\d.,]+)\s*([a-zA-Z0-9μµ%/^]*)$/);
  if (lowerSymbol) {
    return { low: parseNumericValue(lowerSymbol[1]), high: null, unit: cleanUnit(lowerSymbol[2]) };
  }

  const upperWord = t.match(/^menor\s+o\s+igual\s+a\s*([\d.,]+)\s*([a-zA-Z0-9μµ%/^]*)$/i);
  if (upperWord) {
    return { low: null, high: parseNumericValue(upperWord[1]), unit: cleanUnit(upperWord[2]) };
  }

  const lowerWord = t.match(/^mayor\s+o\s+igual\s+a\s*([\d.,]+)\s*([a-zA-Z0-9μµ%/^]*)$/i);
  if (lowerWord) {
    return { low: parseNumericValue(lowerWord[1]), high: null, unit: cleanUnit(lowerWord[2]) };
  }

  return null;
}

/**
 * Parsea una línea de referencia, con o sin etiqueta previa (p. ej. "Normal:", "Deseable:",
 * "Límite alto:", "Menor o igual a"). Los reportes de LMP presentan valores cuantitativos
 * con rangos de referencia de varios niveles (Normal/Intolerancia/Diabetes, Deseable/Alto, etc.).
 */
function parseTierLine(line: string): TierBound | null {
  const t = line.trim();
  if (!t) return null;

  const labeled = t.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9()\s]{0,70}?):\s*(.+)$/);
  if (labeled) {
    const bound = parseBoundOrPair(labeled[2]);
    if (bound) return { ...bound, raw: t };
  }

  const bound = parseBoundOrPair(t);
  if (bound) return { ...bound, raw: t };

  return null;
}

function scorePolancoRow(row: {
  value: number | null;
  valueText: string | null;
  unit: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
}): number {
  let c = 0.78;
  if (row.value != null) c += 0.1;
  else if (row.valueText) c += 0.05;
  if (row.unit) c += 0.04;
  if (row.referenceLow != null || row.referenceHigh != null) c += 0.08;
  return Math.min(0.95, c);
}

function pushCandidate(
  results: ParameterCandidate[],
  seen: Set<string>,
  fields: {
    rawName: string;
    value: number | null;
    valueText: string | null;
    unit: string | null;
    referenceLow: number | null;
    referenceHigh: number | null;
    referenceText: string | null;
    sourceLines: string[];
  }
) {
  const key = `${fields.rawName.toLowerCase()}|${fields.value ?? fields.valueText ?? ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  results.push(
    candidateFromParsedLine({
      ...fields,
      confidence: scorePolancoRow(fields),
    })
  );
}

/**
 * Layout real de Laboratorio Médico Polanco (pdf-parse):
 *   NOMBRE_ANALITO
 *   VALOR
 *   BAJO - ALTO  UNIDAD          (uno o varios niveles: "Normal:", "Deseable:", etc.)
 *
 * FROTIS es texto libre (morfología) en vez de un valor numérico.
 */
export function parseLaboratorioPolancoResults(text: string): ParameterCandidate[] {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: ParameterCandidate[] = [];
  const seen = new Set<string>();
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (shouldSkipPolancoLine(line)) {
      i++;
      continue;
    }

    if (/^FROTIS$/i.test(line)) {
      let j = i + 1;
      const textLines: string[] = [];
      while (j < lines.length) {
        const candidate = lines[j];
        if (shouldSkipPolancoLine(candidate) || looksLikeTitleLine(candidate)) break;
        textLines.push(candidate);
        j++;
      }
      if (textLines.length > 0) {
        pushCandidate(results, seen, {
          rawName: 'FROTIS',
          value: null,
          valueText: textLines.join(' '),
          unit: null,
          referenceLow: null,
          referenceHigh: null,
          referenceText: null,
          sourceLines: [line, ...textLines],
        });
      }
      i = j;
      continue;
    }

    if (!isValidAnalyteName(line)) {
      i++;
      continue;
    }

    const valueLine = lines[i + 1];
    const valueMatch = valueLine?.match(/^([<>]?\s*[\d.,]+)$/);
    if (!valueMatch) {
      // No es una fila de analito real (p. ej. título de sección como "BIOMETRIA HEMATICA"
      // o "PROCALCITONINA. ^" seguido de boilerplate, no de un valor numérico).
      i++;
      continue;
    }

    const value = parseNumericValue(valueMatch[1]);
    const valueText = valueMatch[1].replace(/\s+/g, '').trim();

    let k = i + 2;
    const tiers: TierBound[] = [];
    while (k < lines.length) {
      const candidate = lines[k];
      if (shouldSkipPolancoLine(candidate)) break;
      const tier = parseTierLine(candidate);
      if (!tier) break;
      tiers.push(tier);
      k++;
    }

    const primary = tiers[0] ?? null;
    pushCandidate(results, seen, {
      rawName: line,
      value,
      valueText,
      unit: primary?.unit ?? null,
      referenceLow: primary?.low ?? null,
      referenceHigh: primary?.high ?? null,
      referenceText: tiers.length > 0 ? tiers.map((t) => t.raw).join('; ') : null,
      sourceLines: [line, valueLine, ...tiers.map((t) => t.raw)],
    });

    i = k;
  }

  return results;
}

export const laboratorioPolancoParser: LabParser = {
  vendor: 'laboratorio_polanco',
  name: 'LaboratorioPolancoParser',

  canParse(classification: ClassifiedDocument, text: string): boolean {
    return classification.vendor === 'laboratorio_polanco' || LABORATORIO_POLANCO_MARKER.test(text);
  },

  parse(text: string): ParameterCandidate[] {
    return parseLaboratorioPolancoResults(text);
  },
};
