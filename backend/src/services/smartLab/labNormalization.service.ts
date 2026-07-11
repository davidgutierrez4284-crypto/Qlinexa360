import prisma from '../../config/database';
import { LabReportStatus } from '@prisma/client';
import { LAB_CATEGORY_ALIASES, LAB_DASHBOARD_CATEGORIES } from '../../constants/lab.constants';
import { tryConvertToDefaultUnit } from '../../utils/labUnitConversion.utils';
import { computeAbnormalFlag } from '../../utils/labRange.utils';
import type { ParsedLabLine } from './labParser.service';
import type { ParameterCandidate } from './pipeline/types';

export type NormalizedLabResult = {
  analyteNameRaw: string;
  analyteNameNormalized: string | null;
  analyteCatalogId: string | null;
  resultValue: number | null;
  resultValueText: string | null;
  resultUnit: string | null;
  referenceRangeLow: number | null;
  referenceRangeHigh: number | null;
  referenceRangeText: string | null;
  abnormalFlag: import('@prisma/client').LabAbnormalFlag;
  extractionConfidence: number;
  rawTextSnippet: string | null;
  validationErrorsJson: string[];
  dashboardCategory: string;
};

type CatalogEntry = {
  id: string;
  category: string;
  name: string;
  aliasesJson: unknown;
  defaultUnit: string | null;
  defaultReferenceLow: number | null;
  defaultReferenceHigh: number | null;
  allowedUnitsJson: unknown;
  sexSpecific: boolean;
  ageSpecific: boolean;
};

export type NormalizationContext = {
  patientGender?: string | null;
  patientBirthDate?: Date | null;
};

function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeUnitToken(u: string): string {
  return u.toLowerCase().replace(/µ/g, 'μ').trim();
}

export function mapCatalogCategoryToDashboard(category: string): string {
  const n = normalizeToken(category);
  for (const [alias, key] of Object.entries(LAB_CATEGORY_ALIASES)) {
    if (n.includes(alias)) return key;
  }
  if (n.includes('hemat') || n.includes('hemograma')) return 'hematologia';
  if (n.includes('quimica') || n.includes('bioquimica')) return 'quimica_sanguinea';
  if (n.includes('lipid')) return 'perfil_lipidico';
  if (n.includes('hepat') || n.includes('hepatic')) return 'funcion_hepatica';
  if (n.includes('renal')) return 'funcion_renal';
  if (n.includes('tiroid') || n.includes('tiro')) return 'tiroides';
  if (n.includes('electrolit')) return 'electrolitos';
  return 'otros';
}

function tokensOf(s: string): string[] {
  return normalizeToken(s).split(/\s+/).filter(Boolean);
}

function tokenEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length > 3 && a.endsWith('s') && a.slice(0, -1) === b) return true;
  if (b.length > 3 && b.endsWith('s') && b.slice(0, -1) === a) return true;
  return false;
}

function rawHasToken(rawTokens: string[], token: string): boolean {
  return rawTokens.some((t) => tokenEquivalent(t, token));
}

/** Símbolos químicos cortos → nombres completos aceptados (evita "Na" dentro de "insulina", "Mg" dentro de "mg/dL"). */
const SHORT_SYMBOL_FULL_NAMES: Record<string, string[]> = {
  na: ['sodio', 'sodium'],
  k: ['potasio', 'potassium'],
  cl: ['cloro', 'chloride', 'cloruro'],
  mg: ['magnesio', 'magnesium'],
};

const LIPID_SUBTYPE_TOKENS = new Set(['hdl', 'ldl', 'vldl']);

function isNonHdlCholesterol(rawTokens: string[]): boolean {
  for (let i = 0; i < rawTokens.length - 1; i++) {
    const t = rawTokens[i]!;
    const next = rawTokens[i + 1]!;
    if ((t === 'no' || t === 'non') && tokenEquivalent(next, 'hdl')) return true;
  }
  return false;
}

function hasLipidSubtypeQualifier(rawTokens: string[]): boolean {
  if (rawTokens.some((t) => LIPID_SUBTYPE_TOKENS.has(t))) return true;
  return isNonHdlCholesterol(rawTokens);
}

export function aliasMatchesAnalyteName(alias: string, rawName: string): boolean {
  const a = normalizeToken(alias);
  const r = normalizeToken(rawName);
  if (!a || !r) return false;
  if (r === a) return true;

  // Símbolos cortos (Na, K, Cl, Mg): token completo o nombre químico completo, nunca substring
  if (a.length <= 3) {
    const fullNames = SHORT_SYMBOL_FULL_NAMES[a];
    if (fullNames) {
      return fullNames.some((fn) => r === fn || tokensOf(rawName).includes(fn));
    }
    if (tokensOf(rawName).includes(a)) return true;
    return false;
  }

  const aliasTokens = tokensOf(alias);
  const rawTokens = tokensOf(rawName);

  // Colesterol no-HDL: el token "hdl" no debe emparejar alias de HDL
  if (aliasTokens.some((t) => tokenEquivalent(t, 'hdl')) && isNonHdlCholesterol(rawTokens)) {
    return false;
  }

  // Alias multi-palabra: todos los tokens del alias deben aparecer en el nombre crudo
  if (aliasTokens.length > 1 && aliasTokens.every((t) => rawHasToken(rawTokens, t))) return true;

  // Alias de una palabra: coincidencia por token completo (evita "globulina" dentro de "inmunoglobulina")
  if (aliasTokens.length === 1 && rawHasToken(rawTokens, aliasTokens[0]!)) {
    // "Colesterol" genérico no debe absorber HDL/LDL/VLDL/no-HDL
    if (aliasTokens[0] === 'colesterol' && hasLipidSubtypeQualifier(rawTokens)) return false;
    return true;
  }

  return false;
}

/** Puntuación de especificidad del match catálogo ↔ nombre crudo (mayor = más específico). */
export function catalogMatchScore(entry: CatalogEntry, rawName: string): number {
  const names = [entry.name, ...(Array.isArray(entry.aliasesJson) ? (entry.aliasesJson as string[]) : [])];
  let best = 0;
  for (const alias of names) {
    if (!aliasMatchesAnalyteName(alias, rawName)) continue;
    const aNorm = normalizeToken(alias);
    const rNorm = normalizeToken(rawName);
    if (rNorm === aNorm) return 10000 + aNorm.length;

    const aliasTokens = tokensOf(alias);
    const rawTokens = tokensOf(rawName);
    if (aliasTokens.length > 1 && aliasTokens.every((t) => rawHasToken(rawTokens, t))) {
      best = Math.max(best, 5000 + aNorm.length);
    } else if (aliasTokens.length === 1 && rawHasToken(rawTokens, aliasTokens[0]!)) {
      best = Math.max(best, 1000 + aNorm.length);
    }
  }
  return best;
}

/** Conserva el nombre crudo cuando es más específico que el canónico del catálogo. */
export function resolveAnalyteDisplayName(rawName: string, match: CatalogEntry): string {
  const raw = rawName.trim();
  const catalog = match.name;
  if (normalizeToken(raw) === normalizeToken(catalog)) return catalog;

  const rawTokens = tokensOf(raw);
  const catalogTokens = tokensOf(catalog);
  const aliases = Array.isArray(match.aliasesJson) ? (match.aliasesJson as string[]) : [];

  if (aliases.some((a) => normalizeToken(a) === normalizeToken(raw))) {
    if (catalog.length <= 5 && raw.length > catalog.length) return raw;
    return catalog;
  }

  // Variante con paréntesis o sufijo sobre el nombre canónico (p. ej. Vitamina D (25 Hidroxi))
  if (
    catalogTokens.length > 0 &&
    catalogTokens.every((t) => rawHasToken(rawTokens, t)) &&
    raw.toLowerCase().startsWith(catalog.toLowerCase())
  ) {
    return catalog;
  }

  // Nombre canónico abreviado (HbA1c, HCM, IgA): preferir forma descriptiva del PDF
  if (catalog.length <= 5 && raw.length > catalog.length) return raw;

  if (
    catalogTokens.length > 0 &&
    catalogTokens.every((t) => rawHasToken(rawTokens, t)) &&
    rawTokens.length > catalogTokens.length
  ) {
    return raw;
  }

  const matchingLabels = [catalog, ...aliases]
    .filter((a) => aliasMatchesAnalyteName(a, raw))
    .sort((a, b) => normalizeToken(b).length - normalizeToken(a).length);
  const bestLabel = matchingLabels[0];
  if (bestLabel && normalizeToken(raw).length >= normalizeToken(bestLabel).length && raw.length > catalog.length) {
    return raw;
  }

  return catalog;
}

function catalogMatchesName(entry: CatalogEntry, rawName: string): boolean {
  const names = [entry.name, ...(Array.isArray(entry.aliasesJson) ? (entry.aliasesJson as string[]) : [])];
  return names.some((alias) => aliasMatchesAnalyteName(alias, rawName));
}

function findBestCatalogMatch(
  rawName: string,
  unit: string | null,
  catalog: CatalogEntry[]
): CatalogEntry | undefined {
  const matches = catalog.filter((c) => catalogMatchesName(c, rawName));
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  const unitCompatible = matches.filter((m) => unitAllowedForCatalog(unit, m));
  const pool = unitCompatible.length > 0 ? unitCompatible : matches;
  return pool.sort((a, b) => catalogMatchScore(b, rawName) - catalogMatchScore(a, rawName))[0];
}

function unitAllowedForCatalog(unit: string | null, match: CatalogEntry): boolean {
  if (!unit) return true;
  const allowed = Array.isArray(match.allowedUnitsJson) ? (match.allowedUnitsJson as string[]) : [];
  if (allowed.length === 0) return true;
  const u = normalizeUnitToken(unit);
  return allowed.some((a) => normalizeUnitToken(a) === u || u.includes(normalizeUnitToken(a)));
}

export async function loadActiveCatalog(): Promise<CatalogEntry[]> {
  return prisma.labAnalyteCatalog.findMany({
    where: { active: true },
    select: {
      id: true,
      category: true,
      name: true,
      aliasesJson: true,
      defaultUnit: true,
      defaultReferenceLow: true,
      defaultReferenceHigh: true,
      allowedUnitsJson: true,
      sexSpecific: true,
      ageSpecific: true,
    },
  });
}

export function normalizeParsedLine(
  line: ParsedLabLine,
  catalog: CatalogEntry[],
  context: NormalizationContext = {},
  validationErrors: string[] = []
): NormalizedLabResult {
  let value = line.resultValue;
  let unit = line.resultUnit;
  const match = findBestCatalogMatch(line.analyteNameRaw, unit, catalog);
  let low = line.referenceRangeLow;
  let high = line.referenceRangeHigh;
  let rangeText = line.referenceRangeText;
  const errors = [...validationErrors];

  if (match) {
    if (unit && !unitAllowedForCatalog(unit, match)) {
      errors.push(`Unidad ${unit} no permitida para ${match.name}`);
    }
    if (value != null && unit && match.defaultUnit) {
      const converted = tryConvertToDefaultUnit(match.name, value, unit, match.defaultUnit);
      if (converted) {
        value = converted.value;
        unit = converted.unit;
      }
    }
    if (low == null && match.defaultReferenceLow != null) low = match.defaultReferenceLow;
    if (high == null && match.defaultReferenceHigh != null) high = match.defaultReferenceHigh;
    if (!rangeText && low != null && high != null) rangeText = `${low}-${high}`;

    if (match.sexSpecific && context.patientGender) {
      // Rangos sexo-específicos requieren curación en catálogo; por ahora solo anotamos contexto.
      void context.patientGender;
    }
    if (match.ageSpecific && context.patientBirthDate) {
      void context.patientBirthDate;
    }
  }

  const abnormalFlag = computeAbnormalFlag(value, low, high);
  const dashboardCategory = match ? mapCatalogCategoryToDashboard(match.category) : 'otros';
  let confidence = match ? Math.min(0.95, line.confidence + 0.08) : line.confidence;
  if (errors.length > 0) confidence = Math.max(0.1, confidence - errors.length * 0.1);

  return {
    analyteNameRaw: line.analyteNameRaw,
    analyteNameNormalized: match ? resolveAnalyteDisplayName(line.analyteNameRaw, match) : null,
    analyteCatalogId: match?.id ?? null,
    resultValue: value,
    resultValueText: line.resultValueText,
    resultUnit: unit,
    referenceRangeLow: low,
    referenceRangeHigh: high,
    referenceRangeText: rangeText,
    abnormalFlag,
    extractionConfidence: confidence,
    rawTextSnippet: line.rawTextSnippet,
    validationErrorsJson: errors,
    dashboardCategory,
  };
}

export async function normalizeParsedResults(
  lines: ParsedLabLine[],
  context: NormalizationContext = {},
  candidates?: ParameterCandidate[]
): Promise<NormalizedLabResult[]> {
  const catalog = await loadActiveCatalog();
  return lines.map((line, idx) => {
    const validationErrors = candidates?.[idx]?.validationErrors ?? [];
    return normalizeParsedLine(line, catalog, context, validationErrors);
  });
}

export function dashboardCategoryLabel(key: string): string {
  return LAB_DASHBOARD_CATEGORIES[key] ?? LAB_DASHBOARD_CATEGORIES.otros;
}
