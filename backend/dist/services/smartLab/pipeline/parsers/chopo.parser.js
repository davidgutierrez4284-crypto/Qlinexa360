"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chopoParser = void 0;
const chopoParser_service_1 = require("../../chopoParser.service");
const labParser_interface_1 = require("../labParser.interface");
exports.chopoParser = {
    vendor: 'chopo',
    name: 'ChopoStackedParser',
    canParse(classification) {
        return classification.vendor === 'chopo';
    },
    parse(text) {
        return (0, chopoParser_service_1.parseChopoStackedResults)(text).map((row) => (0, labParser_interface_1.candidateFromParsedLine)({
            rawName: row.analyteNameRaw,
            value: row.resultValue,
            valueText: row.resultValueText,
            unit: row.resultUnit,
            referenceLow: row.referenceRangeLow,
            referenceHigh: row.referenceRangeHigh,
            referenceText: row.referenceRangeText,
            sourceLines: row.rawTextSnippet.split(' | ').filter(Boolean),
            confidence: row.confidence,
        }));
    },
};
