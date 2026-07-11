"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parameterCandidateToParsedLine = parameterCandidateToParsedLine;
exports.parsedLineToParameterCandidate = parsedLineToParameterCandidate;
function parameterCandidateToParsedLine(candidate) {
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
function parsedLineToParameterCandidate(line) {
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
