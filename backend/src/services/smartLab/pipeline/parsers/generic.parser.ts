import { parseLabResultsFromText, scoreParsedLine } from '../../labParser.service';
import type { LabParser } from '../labParser.interface';
import { candidateFromParsedLine } from '../labParser.interface';
import type { ClassifiedDocument, ParameterCandidate } from '../types';

export const genericParser: LabParser = {
  vendor: 'unknown',
  name: 'GenericRegexParser',

  canParse(classification: ClassifiedDocument): boolean {
    return classification.vendor === 'unknown';
  },

  parse(text: string): ParameterCandidate[] {
    return parseLabResultsFromText(text).map((row) =>
      candidateFromParsedLine({
        rawName: row.analyteNameRaw,
        value: row.resultValue,
        valueText: row.resultValueText,
        unit: row.resultUnit,
        referenceLow: row.referenceRangeLow,
        referenceHigh: row.referenceRangeHigh,
        referenceText: row.referenceRangeText,
        sourceLines: row.rawTextSnippet ? [row.rawTextSnippet] : [],
        confidence: row.confidence || scoreParsedLine({ ...row, partial: false }),
      })
    );
  },
};

export function parseWithRegisteredParsers(
  text: string,
  classification: ClassifiedDocument,
  parsers: LabParser[]
): { candidates: ParameterCandidate[]; parserUsed: string } {
  for (const parser of parsers) {
    if (!parser.canParse(classification, text)) continue;
    const candidates = parser.parse(text);
    if (candidates.length > 0) {
      return { candidates, parserUsed: parser.name };
    }
    // Vendor parser ran but found nothing — do not fall back to generic regex.
    if (parser.vendor !== 'unknown' && parser.vendor === classification.vendor) {
      return { candidates: [], parserUsed: parser.name };
    }
  }

  if (genericParser.canParse(classification, text)) {
    const fallback = genericParser.parse(text);
    return { candidates: fallback, parserUsed: genericParser.name };
  }

  return { candidates: [], parserUsed: classification.vendor };
}
