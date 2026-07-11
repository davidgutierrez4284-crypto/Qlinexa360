"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.genericParser = void 0;
exports.parseWithRegisteredParsers = parseWithRegisteredParsers;
const labParser_service_1 = require("../../labParser.service");
const labParser_interface_1 = require("../labParser.interface");
exports.genericParser = {
    vendor: 'unknown',
    name: 'GenericRegexParser',
    canParse(classification) {
        return classification.vendor === 'unknown';
    },
    parse(text) {
        return (0, labParser_service_1.parseLabResultsFromText)(text).map((row) => (0, labParser_interface_1.candidateFromParsedLine)({
            rawName: row.analyteNameRaw,
            value: row.resultValue,
            valueText: row.resultValueText,
            unit: row.resultUnit,
            referenceLow: row.referenceRangeLow,
            referenceHigh: row.referenceRangeHigh,
            referenceText: row.referenceRangeText,
            sourceLines: row.rawTextSnippet ? [row.rawTextSnippet] : [],
            confidence: row.confidence || (0, labParser_service_1.scoreParsedLine)(Object.assign(Object.assign({}, row), { partial: false })),
        }));
    },
};
function parseWithRegisteredParsers(text, classification, parsers) {
    for (const parser of parsers) {
        if (!parser.canParse(classification, text))
            continue;
        const candidates = parser.parse(text);
        if (candidates.length > 0) {
            return { candidates, parserUsed: parser.name };
        }
        // Vendor parser ran but found nothing — do not fall back to generic regex.
        if (parser.vendor !== 'unknown' && parser.vendor === classification.vendor) {
            return { candidates: [], parserUsed: parser.name };
        }
    }
    if (exports.genericParser.canParse(classification, text)) {
        const fallback = exports.genericParser.parse(text);
        return { candidates: fallback, parserUsed: exports.genericParser.name };
    }
    return { candidates: [], parserUsed: classification.vendor };
}
