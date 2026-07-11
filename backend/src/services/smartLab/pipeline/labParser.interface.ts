import type { ClassifiedDocument, LabVendor, ParameterCandidate } from './types';

export interface LabParser {
  readonly vendor: LabVendor;
  readonly name: string;
  canParse(classification: ClassifiedDocument, text: string): boolean;
  parse(text: string): ParameterCandidate[];
}

export function candidateFromParsedLine(fields: {
  rawName: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceText: string | null;
  sourceLines: string[];
  confidence: number;
}): ParameterCandidate {
  return {
    rawName: fields.rawName,
    canonicalName: null,
    value: fields.value,
    valueText: fields.valueText,
    unit: fields.unit,
    referenceLow: fields.referenceLow,
    referenceHigh: fields.referenceHigh,
    referenceText: fields.referenceText,
    sourceLines: fields.sourceLines,
    validationErrors: [],
    confidence: fields.confidence,
  };
}
