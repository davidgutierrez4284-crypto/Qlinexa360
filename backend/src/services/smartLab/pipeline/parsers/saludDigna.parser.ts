import { parseNumericValue } from '../../../../utils/labUnitConversion.utils';
import {
  extractKnownUnitToken,
  isValidAnalyteName,
  isValidLabUnit,
} from '../../chopoParser.service';
import { parseStackedLayout } from '../stackedParser.utils';
import type { LabParser } from '../labParser.interface';
import { candidateFromParsedLine } from '../labParser.interface';
import type { ClassifiedDocument, ParameterCandidate } from '../types';

/** Marcadores de reportes reales Salud Digna (pdf-parse a menudo no trae el logo/texto "Salud Digna"). */
export const SALUD_DIGNA_MARKER =
  /salud\s*digna|salud-digna\.(?:com|org)|saluddigna\.com|centro\s+anal[ií]tico\s+de\s+coyoac[aá]n|\bRSV\d{8,}\b/i;

/** Densitometría / FRISK: pdf-parse suele listar etiquetas y luego valores en columna. */
const FRISK_MARKER =
  /riesgo\s+de\s+fractura\s*\(?\s*FRISK|densitometr[ií]a|DMO\s+CUELLO\s+DE\s+F[EÉ]MUR|SCORE\s+DE\s+CA[IÍ]DAS/i;

const FRISK_NOISE_CUT =
  /estos resultados han sido descargados|nombre del estudio:\s*MASTOGRAFIA|\bBIRADS\b|patr[oó]n mastogr[aá]fico/i;

/**
 * Orden de la columna de valores RESULTADOS DE EVALUACIÓN (pdf-parse).
 * Las etiquetas arriba salen en otro orden (p. ej. DMO CUELLO antes que LUMBAR);
 * los valores siguen el layout del PDF: LUMBAR (0.9530) luego FÉMUR (0.8100).
 */
const FRISK_EVAL_ORDER: Array<{ name: string; unitHint?: RegExp }> = [
  { name: 'SCORE DE CAÍDAS' },
  { name: 'Riesgo de fractura' },
  { name: '# FX PREVIAS >20 AÑOS' },
  { name: 'PESO', unitHint: /\bkg\b/i },
  { name: 'DMO COLUMNA LUMBAR', unitHint: /g\/cm/i },
  { name: 'DMO CUELLO DE FÉMUR', unitHint: /g\/cm/i },
];

const SD_SKIP =
  /^(n[ºo°]\.?\s*cliente|folio:|edad:|m[eé]dico:|sexo:|paciente:|fecha|valido:|de$|reimpresi[oó]n|q\.?b\.?p|c[eé]dula|universidad|responsable|estudios\s+realizamos|\*=|\*\*|tipo de muestra|m[eé]todo:|equipo:|aviso|privacidad|nota:|cambio de valores|masculino|femenino|sin riesgo|riesgo moderado|alto riesgo|mujeres|embarazad|trimestre|anticonceptivos|a quien corresponda|p[aá]gina|hoja:|examen f[ií]sico|examen qu[ií]mico|examen microscopico|examen general de orina|hematolog[ií]a|qu[ií]mica cl[ií]nica|inmunolog[ií]a|uroan[aá]lisis|biometr[ií]a|en esta hoja|este registro|resumen comparativo|^\d+$|^\d{5,}$)/i;

const SECTION_START =
  /^(HEMATOLOG[IÍ]A|BIOMETR[IÍ]A(?:\s+HEMATICA)?|QU[IÍ]MICA(?:\s+CL[IÍ]NICA)?|INMUNOLOG[IÍ]A|URO[AÁ]N[AÁ]LISIS|EXAMEN\s+GENERAL(?:\s+DE\s+ORINA)?|EXAMEN\s+(?:F[IÍ]SICO|QU[IÍ]MICO|MICROSCOPICO)|TIROIDES)\s*$/i;

const COMPARATIVE_SUMMARY =
  /resumen\s+comparativo|en esta hoja encontrar[aá]s el resumen/i;

const RISK_TIER =
  /^(sin riesgo|riesgo moderado|alto riesgo|masculino|femenino|mujeres|embarazad|trimestre|anticonceptivos)/i;

/** Unidades ordenadas de más largas a más cortas para despegar texto de pdf-parse. */
const SD_UNITS = [
  '10^3/μL',
  '10^6/μL',
  '10^3/ul',
  '10^6/ul',
  '10^3/µL',
  '10^6/µL',
  'μUI/mL',
  'µUI/mL',
  'uUI/mL',
  'Cel/μL',
  'Cel/ul',
  'Cel/µL',
  'por campo',
  'ng/mL',
  'ng/dL',
  'pg/mL',
  'μg/dL',
  'µg/dL',
  'ug/dL',
  'mg/dL',
  'g/dL',
  'mmol/L',
  'mEq/L',
  'U/L',
  'UI/L',
  'fL',
  'pg',
  '%',
] as const;

const QUALITATIVE_VALUES =
  /^(Negativo|Normal|Positivo|Ausentes?|Presentes?|Claro|Turbio|Amarillo(?:\s+claro|\s+oscuro)?|Leve|Escasas?)$/i;

function shouldSkipLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length < 1) return true;
  if (t === '*') return true;
  if (SD_SKIP.test(t)) return true;
  if (RISK_TIER.test(t)) return true;
  if (/^_{3,}$/.test(t)) return true;
  if (/^\(\s*<\s*[\d.,]+\s*mg\/dL\s*\)$/i.test(t)) return true;
  if (/^av\.\s+/i.test(t)) return true;
  if (/^q\.?b\.?p/i.test(t)) return true;
  return false;
}

function findUnitIndex(text: string): { unit: string; index: number } | null {
  const lower = text.toLowerCase();
  let best: { unit: string; index: number } | null = null;
  for (const unit of SD_UNITS) {
    const idx = lower.indexOf(unit.toLowerCase());
    if (idx < 0) continue;
    if (!best || idx < best.index || (idx === best.index && unit.length > best.unit.length)) {
      best = { unit, index: idx };
    }
  }
  return best;
}

function splitNameValue(prefix: string): { name: string; valueRaw: string } | null {
  const m = prefix.match(
    /^([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9()/%.\s,#-]{0,72}?)([<>]?\s*[\d.,]+)$/
  );
  if (!m) return null;
  const name = m[1].replace(/\s+/g, ' ').trim();
  if (!isValidAnalyteName(name)) return null;
  return { name, valueRaw: m[2].replace(/\s+/g, '').trim() };
}

function splitNameQualitative(prefix: string): { name: string; valueText: string } | null {
  const m = prefix.match(
    /^([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9()/%.\s,#-]{1,60}?)(Negativo|Normal|Positivo|Ausentes?|Presentes?|Claro|Turbio|Amarillo(?:\s+claro|\s+oscuro)?)$/i
  );
  if (!m) return null;
  const name = m[1].replace(/\s+/g, ' ').trim();
  if (!isValidAnalyteName(name)) return null;
  return { name, valueText: m[2].trim() };
}

function parseRangeTail(tail: string): {
  low: number | null;
  high: number | null;
  rangeText: string | null;
} {
  const t = tail.replace(/\s+/g, ' ').trim();
  if (!t) return { low: null, high: null, rangeText: null };

  const paired = t.match(/^([\d.,]+)\s*[-–—]\s*([\d.,]+)/);
  if (paired) {
    return {
      low: parseNumericValue(paired[1]),
      high: parseNumericValue(paired[2]),
      rangeText: `${paired[1]}-${paired[2]}`,
    };
  }

  // pdf-parse a veces pega valor.rango: 17.96.0 - 25.0  o  7.004.80 - 7.40
  const glued = t.match(/^(\d+\.\d{1,2})(\d+\.\d{1,2})\s*[-–—]\s*([\d.,]+)/);
  if (glued) {
    return {
      low: parseNumericValue(glued[2]),
      high: parseNumericValue(glued[3]),
      rangeText: `${glued[2]}-${glued[3]}`,
    };
  }

  const upper = t.match(/^[<≤]\s*([\d.,]+)/);
  if (upper) {
    return { low: null, high: parseNumericValue(upper[1]), rangeText: t };
  }

  const lower = t.match(/^[>≥]\s*([\d.,]+)/);
  if (lower) {
    return { low: parseNumericValue(lower[1]), high: null, rangeText: t };
  }

  if (QUALITATIVE_VALUES.test(t)) {
    return { low: null, high: null, rangeText: t };
  }

  return { low: null, high: null, rangeText: t || null };
}

function parseUnitRangeLine(line: string): {
  unit: string | null;
  low: number | null;
  high: number | null;
  rangeText: string | null;
} | null {
  const t = line.trim();
  if (!t || t === '*') return null;

  const unitHit = findUnitIndex(t);
  if (unitHit && unitHit.index === 0) {
    const after = t.slice(unitHit.unit.length).trim();
    const range = parseRangeTail(after);
    return { unit: unitHit.unit, ...range };
  }

  const known = extractKnownUnitToken(t);
  if (known) {
    return { unit: known, low: null, high: null, rangeText: null };
  }

  // Rango sin unidad (p. ej. GRAVEDAD ESPECIFICA → 1.016 - 1.022)
  const rangeOnly = parseRangeTail(t);
  if (rangeOnly.low != null || rangeOnly.high != null) {
    return { unit: null, ...rangeOnly };
  }

  return null;
}

function scoreRow(row: {
  value: number | null;
  valueText: string | null;
  unit: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
}): number {
  let c = 0.72;
  if (row.value != null) c += 0.1;
  else if (row.valueText) c += 0.06;
  if (row.unit) c += 0.05;
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
  const key = `${fields.rawName.toLowerCase()}|${fields.value ?? fields.valueText ?? ''}|${fields.unit ?? ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  results.push(
    candidateFromParsedLine({
      ...fields,
      confidence: scoreRow(fields),
    })
  );
}

function parseFriskValueLine(line: string): {
  value: number | null;
  valueText: string;
  unit: string | null;
} | null {
  const t = line.trim();
  const withUnit = t.match(/^([<>]?\s*[\d.,]+)\s*(kg|g\/cm[²2]?|m)$/i);
  if (withUnit) {
    const rawUnit = withUnit[2];
    const unit = /g\/cm/i.test(rawUnit) ? 'g/cm2' : rawUnit;
    return {
      value: parseNumericValue(withUnit[1]),
      valueText: withUnit[1].replace(/\s+/g, '').trim(),
      unit,
    };
  }
  if (/^[<>]?\s*[\d.,]+$/.test(t)) {
    return {
      value: parseNumericValue(t),
      valueText: t.replace(/\s+/g, '').trim(),
      unit: null,
    };
  }
  return null;
}

/**
 * Riesgo de fractura (FRISK) / densitometría DXA.
 * pdf-parse entrega etiquetas desordenadas y luego la columna de valores:
 *   1 / 4.44 / 1 / 50.0 kg / 0.9530 g/cm² (LUMBAR) / 0.8100 g/cm² (FÉMUR)
 */
export function parseSaludDignaFriskResults(text: string): ParameterCandidate[] {
  if (!FRISK_MARKER.test(text)) return [];

  const noiseCut = text.search(FRISK_NOISE_CUT);
  const body = noiseCut >= 0 ? text.slice(0, noiseCut) : text;
  const lines = body
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: ParameterCandidate[] = [];
  const seen = new Set<string>();

  const imcIdx = lines.findIndex((l) => /^IMC:?$/i.test(l));
  if (imcIdx >= 0 && imcIdx + 1 < lines.length) {
    const imcVal = parseFriskValueLine(lines[imcIdx + 1]);
    if (imcVal?.value != null) {
      pushCandidate(results, seen, {
        rawName: 'IMC',
        value: imcVal.value,
        valueText: imcVal.valueText,
        unit: null,
        referenceLow: null,
        referenceHigh: null,
        referenceText: null,
        sourceLines: [lines[imcIdx], lines[imcIdx + 1]],
      });
    }
  }

  const tallaIdx = lines.findIndex((l) => /^Talla:?/i.test(l));
  if (tallaIdx >= 0) {
    for (let j = tallaIdx + 1; j < Math.min(tallaIdx + 4, lines.length); j++) {
      const tv = parseFriskValueLine(lines[j]);
      if (tv?.value != null && tv.value > 0.5 && tv.value < 2.5) {
        pushCandidate(results, seen, {
          rawName: 'Talla',
          value: tv.value,
          valueText: tv.valueText,
          unit: tv.unit || 'm',
          referenceLow: null,
          referenceHigh: null,
          referenceText: null,
          sourceLines: [lines[tallaIdx], lines[j]],
        });
        break;
      }
    }
  }

  const denomIdx = lines.findIndex((l) => /^Denominaci[oó]n:?$/i.test(l));
  if (denomIdx >= 0 && denomIdx + 1 < lines.length) {
    const label = lines[denomIdx + 1];
    if (/^(Normal|Osteopenia|Osteoporosis)$/i.test(label)) {
      pushCandidate(results, seen, {
        rawName: 'Denominación OMS (DMO)',
        value: null,
        valueText: label,
        unit: null,
        referenceLow: null,
        referenceHigh: null,
        referenceText: 'Criterios OMS',
        sourceLines: [lines[denomIdx], label],
      });
    }
  }

  // Columna de evaluación: tras encabezados, antes de la tabla de interpretación narrativa.
  const evalStart = lines.findIndex(
    (l) => /^RESULTADOS\s+DE\s+EVALUACI[OÓ]N$/i.test(l) || /^TABLA\s+DE\s+INTERPRETACI[OÓ]N$/i.test(l)
  );
  if (evalStart < 0) return results;

  const valueLines: string[] = [];
  for (let i = evalStart + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^Valores:\s*Riesgo|^Menor a|^Mayor o igual|^CALCULO\s+DE\s+RIESGO|^Riesgo\s+(BAJO|ALTO)\b/i.test(line)) {
      break;
    }
    if (parseFriskValueLine(line)) valueLines.push(line);
  }

  for (let i = 0; i < FRISK_EVAL_ORDER.length && i < valueLines.length; i++) {
    const spec = FRISK_EVAL_ORDER[i];
    const parsed = parseFriskValueLine(valueLines[i]);
    if (!parsed || parsed.value == null) continue;
    if (spec.unitHint && parsed.unit && !spec.unitHint.test(parsed.unit)) continue;

    let referenceLow: number | null = null;
    let referenceHigh: number | null = null;
    let referenceText: string | null = null;
    if (/riesgo de fractura/i.test(spec.name)) {
      // Menor a 5.4 = bajo; >= 5.4 = alto
      referenceHigh = 5.4;
      referenceText = '< 5.4 riesgo bajo; ≥ 5.4 riesgo alto';
    }

    pushCandidate(results, seen, {
      rawName: spec.name,
      value: parsed.value,
      valueText: parsed.valueText,
      unit: parsed.unit,
      referenceLow,
      referenceHigh,
      referenceText,
      sourceLines: [valueLines[i]],
    });
  }

  return results;
}

/**
 * Layout real Salud Digna (pdf-parse):
 * - LEUCOCITOS5.60  /  10^3/μL3.98 - 10.04
 * - GLUCOSA91.5mg/dL82.0 - 115.0
 * - VOLUMEN...95.70 / * / fL79.40 - 94.80
 */
export function parseSaludDignaResults(text: string): ParameterCandidate[] {
  const frisk = parseSaludDignaFriskResults(text);
  if (frisk.length >= 3) return frisk;

  const cut = text.search(COMPARATIVE_SUMMARY);
  const body = cut >= 0 ? text.slice(0, cut) : text;
  const lines = body
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: ParameterCandidate[] = [];
  const seen = new Set<string>();
  let i = 0;
  let inResults = false;

  while (i < lines.length) {
    const line = lines[i];

    if (SECTION_START.test(line)) {
      inResults = true;
      i++;
      continue;
    }

    if (!inResults) {
      i++;
      continue;
    }

    if (shouldSkipLine(line)) {
      i++;
      continue;
    }

    // Caso A: línea completa name+value+unit+range
    const unitHit = findUnitIndex(line);
    if (unitHit && unitHit.index > 0) {
      const prefix = line.slice(0, unitHit.index);
      const after = line.slice(unitHit.index + unitHit.unit.length).trim();
      const nv = splitNameValue(prefix);
      if (nv) {
        const range = parseRangeTail(after);
        pushCandidate(results, seen, {
          rawName: nv.name,
          value: parseNumericValue(nv.valueRaw),
          valueText: nv.valueRaw,
          unit: unitHit.unit,
          referenceLow: range.low,
          referenceHigh: range.high,
          referenceText: range.rangeText,
          sourceLines: [line],
        });
        i++;
        continue;
      }

      const nq = splitNameQualitative(prefix);
      if (nq) {
        pushCandidate(results, seen, {
          rawName: nq.name,
          value: null,
          valueText: nq.valueText,
          unit: isValidLabUnit(unitHit.unit) ? unitHit.unit : unitHit.unit,
          referenceLow: null,
          referenceHigh: null,
          referenceText: QUALITATIVE_VALUES.test(after) ? after : after || null,
          sourceLines: [line],
        });
        i++;
        continue;
      }
    }

    // Caso B: name+value pegados; rango/unidad en líneas siguientes
    const nv = splitNameValue(line);
    if (nv) {
      let j = i + 1;
      while (j < lines.length && lines[j] === '*') j++;
      const next = j < lines.length ? lines[j] : '';
      const parsedNext = next ? parseUnitRangeLine(next) : null;

      // REACCION pH7.004.80 - 7.40 (value+range en la misma línea name)
      const sameLineGlued = line.match(
        /^([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9()/%.\s,#-]{1,50}?)(\d+\.\d{2})(\d+\.\d{2})\s*[-–—]\s*([\d.,]+)$/
      );
      if (sameLineGlued) {
        const name = sameLineGlued[1].replace(/\s+/g, ' ').trim();
        if (isValidAnalyteName(name)) {
          pushCandidate(results, seen, {
            rawName: name,
            value: parseNumericValue(sameLineGlued[2]),
            valueText: sameLineGlued[2],
            unit: null,
            referenceLow: parseNumericValue(sameLineGlued[3]),
            referenceHigh: parseNumericValue(sameLineGlued[4]),
            referenceText: `${sameLineGlued[3]}-${sameLineGlued[4]}`,
            sourceLines: [line],
          });
          i++;
          continue;
        }
      }

      // RELACIÓN BUN/CREATININA17.96.0 - 25.0
      const bunGlued = line.match(
        /^([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9()/%.\s,#/-]{1,50}?)(\d+\.\d)(\d+\.\d)\s*[-–—]\s*([\d.,]+)$/
      );
      if (bunGlued && !findUnitIndex(line)) {
        const name = bunGlued[1].replace(/\s+/g, ' ').trim();
        if (isValidAnalyteName(name)) {
          pushCandidate(results, seen, {
            rawName: name,
            value: parseNumericValue(bunGlued[2]),
            valueText: bunGlued[2],
            unit: null,
            referenceLow: parseNumericValue(bunGlued[3]),
            referenceHigh: parseNumericValue(bunGlued[4]),
            referenceText: `${bunGlued[3]}-${bunGlued[4]}`,
            sourceLines: [line],
          });
          i++;
          continue;
        }
      }

      if (parsedNext && (parsedNext.low != null || parsedNext.high != null || parsedNext.unit)) {
        pushCandidate(results, seen, {
          rawName: nv.name,
          value: parseNumericValue(nv.valueRaw),
          valueText: nv.valueRaw,
          unit: parsedNext.unit,
          referenceLow: parsedNext.low,
          referenceHigh: parsedNext.high,
          referenceText: parsedNext.rangeText,
          sourceLines: [line, next],
        });
        i = j + 1;
        continue;
      }

      pushCandidate(results, seen, {
        rawName: nv.name,
        value: parseNumericValue(nv.valueRaw),
        valueText: nv.valueRaw,
        unit: null,
        referenceLow: null,
        referenceHigh: null,
        referenceText: null,
        sourceLines: [line],
      });
      i++;
      continue;
    }

    // Caso C: cualitativo name+valor (+ ref en misma o siguiente)
    const colorLine = line.match(
      /^(COLOR|ASPECTO)(.+)$/i
    );
    if (colorLine) {
      let valueText = colorLine[2].replace(/\*/g, '').trim();
      let refText: string | null = null;
      let j = i + 1;
      while (j < lines.length && lines[j] === '*') j++;
      if (j < lines.length && !shouldSkipLine(lines[j]) && !splitNameValue(lines[j]) && !SECTION_START.test(lines[j])) {
        // ASPECTOClaroClaro → value Claro, ref Claro
        const aspect = valueText.match(/^(Claro|Turbio)(Claro|Turbio)$/i);
        if (aspect) {
          valueText = aspect[1];
          refText = aspect[2];
        } else if (QUALITATIVE_VALUES.test(lines[j]) || /^Amarillo/i.test(lines[j])) {
          refText = lines[j];
          i = j + 1;
          pushCandidate(results, seen, {
            rawName: colorLine[1],
            value: null,
            valueText,
            unit: null,
            referenceLow: null,
            referenceHigh: null,
            referenceText: refText,
            sourceLines: [line, lines[j]],
          });
          continue;
        }
      }
      const aspectSame = valueText.match(/^(Claro|Turbio)(Claro|Turbio)$/i);
      if (aspectSame) {
        valueText = aspectSame[1];
        refText = aspectSame[2];
      }
      pushCandidate(results, seen, {
        rawName: colorLine[1],
        value: null,
        valueText,
        unit: null,
        referenceLow: null,
        referenceHigh: null,
        referenceText: refText,
        sourceLines: [line],
      });
      i++;
      continue;
    }

    const qualFull = line.match(
      /^([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9()/%.\s,#-]{1,50}?)(Negativo|Normal|Positivo|Ausentes?)(?:(Cel\/μL|Cel\/ul|mg\/dL|por campo))?(Negativo|Normal|Positivo|Ausentes?)?$/i
    );
    if (qualFull) {
      const name = qualFull[1].replace(/\s+/g, ' ').trim();
      if (isValidAnalyteName(name)) {
        pushCandidate(results, seen, {
          rawName: name,
          value: null,
          valueText: qualFull[2],
          unit: qualFull[3] || null,
          referenceLow: null,
          referenceHigh: null,
          referenceText: qualFull[4] || qualFull[2],
          sourceLines: [line],
        });
      }
      i++;
      continue;
    }

    // LEUCOCITOS1por campo0 - 2
    const micro = line.match(
      /^([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9()/%.\s,#-]{1,40}?)([\d.,]+)por campo\s*([\d.,]+)\s*[-–—]\s*([\d.,]+)$/i
    );
    if (micro) {
      const name = micro[1].replace(/\s+/g, ' ').trim();
      if (isValidAnalyteName(name)) {
        pushCandidate(results, seen, {
          rawName: name,
          value: parseNumericValue(micro[2]),
          valueText: micro[2],
          unit: 'por campo',
          referenceLow: parseNumericValue(micro[3]),
          referenceHigh: parseNumericValue(micro[4]),
          referenceText: `${micro[3]}-${micro[4]}`,
          sourceLines: [line],
        });
      }
      i++;
      continue;
    }

    i++;
  }

  return results;
}

const STACKED_SECTION =
  /\b(QU[IÍ]MICA|BIOMETR[IÍ]A|HEMOGRAMA|PERFIL\s+[A-ZÁÉÍÓÚ]+|UROAN[AÁ]LISIS|COPROLOG[IÍ]A|ORINA|TIROIDES|LIPIDOS|HEP[AÁ]TICO|RENAL)\b/i;

const STACKED_SKIP =
  /^(hoja:|p[aá]gina|paciente:|sexo:|fecha:|edad:|orden:|resultados$|www\.|gracias|aviso|privacidad|cup[oó]n|descuento|vigencia|producto|c[oó]digo|m[eé]todo:|informe|responsable|acreditaci[oó]n)/i;

export const saludDignaParser: LabParser = {
  vendor: 'salud_digna',
  name: 'SaludDignaParser',

  canParse(classification: ClassifiedDocument, text: string): boolean {
    return classification.vendor === 'salud_digna' || SALUD_DIGNA_MARKER.test(text);
  },

  parse(text: string): ParameterCandidate[] {
    const inline = parseSaludDignaResults(text);
    if (inline.length >= 3) return inline;
    // Fixture legacy apilado (nombre / valor / rango)
    return parseStackedLayout(text, {
      sectionStart: STACKED_SECTION,
      skipLine: STACKED_SKIP,
    });
  },
};
