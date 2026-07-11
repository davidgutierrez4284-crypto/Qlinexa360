import { parseChopoStackedResults } from '../../chopoParser.service';
import type { LabParser } from '../labParser.interface';
import { candidateFromParsedLine } from '../labParser.interface';
import type { ClassifiedDocument, ParameterCandidate } from '../types';
import type { ParsedLabLine } from '../../labParser.service';

export const chopoParser: LabParser = {
  vendor: 'chopo',
  name: 'ChopoStackedParser',

  canParse(classification: ClassifiedDocument): boolean {
    return classification.vendor === 'chopo';
  },

  parse(text: string): ParameterCandidate[] {
    return parseChopoStackedResults(text).map((row: ParsedLabLine) =>
      candidateFromParsedLine({
        rawName: row.analyteNameRaw,
        value: row.resultValue,
        valueText: row.resultValueText,
        unit: row.resultUnit,
        referenceLow: row.referenceRangeLow,
        referenceHigh: row.referenceRangeHigh,
        referenceText: row.referenceRangeText,
        sourceLines: row.rawTextSnippet.split(' | ').filter(Boolean),
        confidence: row.confidence,
      })
    );
  },
};
