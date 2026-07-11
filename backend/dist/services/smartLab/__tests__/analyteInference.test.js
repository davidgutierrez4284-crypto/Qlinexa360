"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const analyteInference_service_1 = require("../pipeline/analyteInference.service");
const labParser_interface_1 = require("../pipeline/labParser.interface");
const clinicalValidator_service_1 = require("../pipeline/clinicalValidator.service");
describe('analyteInference', () => {
    it('corrects Sodio mislabel to Insulina basal when unit/range match insulin', () => {
        const row = (0, labParser_interface_1.candidateFromParsedLine)({
            rawName: 'Sodio',
            value: 14.68,
            valueText: '14.68',
            unit: 'μUI/mL',
            referenceLow: 2.6,
            referenceHigh: 24.9,
            referenceText: '2.6-24.9',
            sourceLines: [],
            confidence: 0.9,
        });
        const inferred = (0, analyteInference_service_1.inferAnalyteFromUnitRange)(row);
        expect(inferred.rawName).toBe('Insulina basal');
    });
    it('corrects Sodio mislabel to Vitamina D when ng/mL range matches 25-hidroxi', () => {
        const row = (0, labParser_interface_1.candidateFromParsedLine)({
            rawName: 'Sodio',
            value: 38.47,
            valueText: '38.47',
            unit: 'ng/mL',
            referenceLow: 30,
            referenceHigh: 100,
            referenceText: '30-100',
            sourceLines: [],
            confidence: 0.9,
        });
        const inferred = (0, clinicalValidator_service_1.validateParameterCandidate)((0, analyteInference_service_1.inferAnalyteFromUnitRange)(row));
        expect(inferred.rawName).toBe('Vitamina D (25 Hidroxi)');
        expect(inferred.canonicalName).toBe('Vitamina D');
        expect(inferred.confidence).toBeGreaterThanOrEqual(0.15);
        expect(inferred.validationErrors.some((e) => e.includes('Vitamina D'))).toBe(true);
    });
    it('discards fake Sodio row with incompatible electrolyte unit', () => {
        const row = (0, labParser_interface_1.candidateFromParsedLine)({
            rawName: 'Sodio',
            value: 140,
            valueText: '140',
            unit: 'μUI/mL',
            referenceLow: 135,
            referenceHigh: 145,
            referenceText: '135-145',
            sourceLines: [],
            confidence: 0.9,
        });
        const inferred = (0, clinicalValidator_service_1.validateParameterCandidate)((0, analyteInference_service_1.inferAnalyteFromUnitRange)(row));
        expect(inferred.confidence).toBeLessThan(0.15);
        expect(inferred.validationErrors.some((e) => e.includes('incompatible'))).toBe(true);
    });
});
