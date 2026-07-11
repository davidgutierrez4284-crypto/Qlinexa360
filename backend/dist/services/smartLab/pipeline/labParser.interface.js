"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.candidateFromParsedLine = candidateFromParsedLine;
function candidateFromParsedLine(fields) {
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
