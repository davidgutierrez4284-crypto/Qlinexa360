import type { ParsedLabLine } from '../labParser.service';
import type { ParameterCandidate } from './types';

export function parameterCandidateToParsedLine(candidate: ParameterCandidate): ParsedLabLine {
  return {
    analyteNameRaw: candidate.rawName,
    resultValue: candidate.value,
    resultValueText: candidate.valueText,
    resultUnit: candidate.unit,
    referenceRangeLow: candidate.referenceLow,
    referenceRangeHigh: candidate.referenceHigh,
    referenceRangeText: candidate.referenceText,
    rawTextSnippet: candidate.sourceLines.join(' | ').slice(0, 200),
    confidence: candidate.confidence,
  };
}

export function parsedLineToParameterCandidate(line: ParsedLabLine): ParameterCandidate {
  return {
    rawName: line.analyteNameRaw,
    canonicalName: null,
    value: line.resultValue,
    valueText: line.resultValueText,
    unit: line.resultUnit,
    referenceLow: line.referenceRangeLow,
    referenceHigh: line.referenceRangeHigh,
    referenceText: line.referenceRangeText,
    sourceLines: line.rawTextSnippet ? line.rawTextSnippet.split(' | ').filter(Boolean) : [],
    validationErrors: [],
    confidence: line.confidence,
  };
}
