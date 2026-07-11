import {
  isFooterOrSignatureLine,
  isProfessionalLicenseValue,
  isRangeFragmentName,
  isValidLabUnit,
} from '../chopoParser.service';
import type { ParameterCandidate } from './types';
import { getSmartLabReviewThreshold } from '../../../config/smartLab.config';

type UnitRule = {
  namePattern: RegExp;
  allowedUnits: RegExp;
  forbiddenUnits?: RegExp;
  message: string;
};

const UNIT_RULES: UnitRule[] = [
  {
    namePattern: /plaquet|plt|platelet/i,
    allowedUnits: /\/mm3|10\^3|10\^6|k\/|\/μl|\/ul|cel|fL|%|fl/i,
    forbiddenUnits: /mg\/dL|g\/dL|mmol/i,
    message: 'Plaquetas no usan unidades de concentración (mg/dL, g/dL)',
  },
  {
    namePattern: /leucocit|wbc|gl[oó]bulos?\s+blancos/i,
    allowedUnits: /\/mm3|10\^3|k\/|\/μl|\/ul|cel|%/i,
    forbiddenUnits: /mg\/dL|g\/dL|mmol/i,
    message: 'Leucocitos no usan unidades de concentración (mg/dL, g/dL)',
  },
  {
    namePattern: /eritrocit|rbc|gl[oó]bulos?\s+rojos/i,
    allowedUnits: /\/mm3|10\^6|mill|mill[oó]n|\/μl|\/ul|cel|%/i,
    forbiddenUnits: /mg\/dL|meq/i,
    message: 'Eritrocitos no usan mg/dL o mEq/L',
  },
  {
    namePattern: /\btsh\b|tiroides|tiroxina|triyodotironina/i,
    allowedUnits: /ui\/|μui|µui|mui|pg\/|ng\/|µg\/|ug\//i,
    forbiddenUnits: /g\/dL|mg\/dL(?!.*\/)/i,
    message: 'Marcadores tiroideos no usan g/dL',
  },
  {
    namePattern: /insulina/i,
    allowedUnits: /ui\/|μui|µui|mui|pmol/i,
    forbiddenUnits: /g\/dL|mg\/dL|meq/i,
    message: 'Insulina no usa g/dL, mg/dL ni mEq/L',
  },
  {
    namePattern: /corpuscular|volumen\s+corpuscular|\bvcm\b|\bhcm\b|\bchcm\b|rdw|distribuci[oó]n\s+eritrocitaria/i,
    allowedUnits: /fL|pg|g\/dL|%|fl/i,
    message: 'Índices eritrocitarios usan fL, pg, g/dL o %',
  },
  {
    namePattern: /volumen\s+plaquetario|distribuci[oó]n\s+plaquetaria|\bmpv\b|\bpdw\b/i,
    allowedUnits: /fL|%|fl/i,
    message: 'Índices plaquetarios usan fL o %',
  },
  {
    namePattern: /^(?!.*corpuscular).*(?:hemoglobina|hemoglobin)|\bhb\b/i,
    allowedUnits: /g\/dL|g\/l|mmol\/l|%|g\/100/i,
    forbiddenUnits: /meq|ui\/|u\/l(?!.*\/)/i,
    message: 'Hemoglobina no usa mEq/L ni U/L',
  },
  {
    namePattern: /glucosa|glucose|glucemia/i,
    allowedUnits: /mg\/dL|mmol\/l|g\/l/i,
    forbiddenUnits: /\/mm3|10\^3|meq\/l(?!.*gluc)/i,
    message: 'Glucosa no usa unidades celulares',
  },
  {
    namePattern: /\bsodio\b|\bna\b/i,
    allowedUnits: /meq|mmol/i,
    forbiddenUnits: /ui\/|μui|µui|ng\/|pg\/|mg\/d/i,
    message: 'Sodio debe expresarse en mEq/L o mmol/L',
  },
  {
    namePattern: /\bpotasio\b|\bcloro\b|\bcl\b/i,
    allowedUnits: /meq|mmol/i,
    forbiddenUnits: /ui\/|μui|µui|ng\/|pg\/|mg\/d/i,
    message: 'Electrolitos deben expresarse en mEq/L o mmol/L',
  },
];

function normalizeUnit(u: string | null | undefined): string {
  return (u ?? '').trim().toLowerCase().replace(/µ/g, 'μ');
}

function validateName(rawName: string): string[] {
  const errors: string[] = [];
  if (isRangeFragmentName(rawName)) {
    errors.push('Nombre parece fragmento de rango de referencia');
  }
  if (isFooterOrSignatureLine(rawName)) {
    errors.push('Nombre parece firma o pie de página del laboratorio');
  }
  if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]{2,}/.test(rawName)) {
    errors.push('Nombre de indicador inválido');
  }
  if (/\d{5,}/.test(rawName)) {
    errors.push('Nombre contiene código numérico de producto');
  }
  return errors;
}

function validateUnitForAnalyte(rawName: string, unit: string | null): string[] {
  if (!unit) return [];
  const errors: string[] = [];
  const u = normalizeUnit(unit);

  if (!isValidLabUnit(unit)) {
    errors.push(`Unidad no válida: ${unit}`);
  }

  for (const rule of UNIT_RULES) {
    if (!rule.namePattern.test(rawName)) continue;
    if (rule.forbiddenUnits?.test(u)) {
      errors.push(rule.message);
    } else if (!rule.allowedUnits.test(u)) {
      errors.push(`Unidad inusual para ${rawName}: ${unit}`);
    }
  }

  return errors;
}

function validateValue(rawName: string, value: number | null): string[] {
  if (value == null) return [];
  const errors: string[] = [];
  if (isProfessionalLicenseValue(rawName, value)) {
    errors.push('Valor parece cédula profesional, no resultado de laboratorio');
  }
  if (
    /hemoglobina|hemoglobin|\bhb\b/i.test(rawName) &&
    !/corpuscular|media|glucosilada/i.test(rawName) &&
    value > 25
  ) {
    errors.push(`Hemoglobina ${value} fuera de rango fisiológico`);
  }
  if (/potasio|\bk\b/i.test(rawName) && value > 15) {
    errors.push(`Potasio ${value} fuera de rango fisiológico`);
  }
  if (/glucosa|glucose/i.test(rawName) && value > 600) {
    errors.push(`Glucosa ${value} fuera de rango fisiológico`);
  }
  return errors;
}

export function validateParameterCandidate(candidate: ParameterCandidate): ParameterCandidate {
  const errors = [
    ...candidate.validationErrors,
    ...validateName(candidate.rawName),
    ...validateUnitForAnalyte(candidate.rawName, candidate.unit),
    ...validateValue(candidate.rawName, candidate.value),
  ];

  let confidence = candidate.confidence;
  if (errors.length > 0) {
    confidence = Math.max(0.1, confidence - errors.length * 0.15);
  }

  return {
    ...candidate,
    validationErrors: errors,
    confidence,
  };
}

export function validateParameterCandidates(candidates: ParameterCandidate[]): ParameterCandidate[] {
  return candidates.map(validateParameterCandidate);
}

export function isLowConfidence(confidence: number): boolean {
  return confidence < getSmartLabReviewThreshold();
}

export function reportHasBlockingValidationErrors(candidates: ParameterCandidate[]): boolean {
  return candidates.some((c) => c.validationErrors.length > 0 && c.confidence < 0.5);
}

export function countLowConfidenceRows(candidates: ParameterCandidate[]): number {
  return candidates.filter((c) => isLowConfidence(c.confidence)).length;
}
