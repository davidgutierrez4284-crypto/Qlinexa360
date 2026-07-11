"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const documentClassifier_service_1 = require("../pipeline/documentClassifier.service");
const clinicalValidator_service_1 = require("../pipeline/clinicalValidator.service");
const labPipeline_service_1 = require("../pipeline/labPipeline.service");
const labParser_interface_1 = require("../pipeline/labParser.interface");
const fixturesDir = path_1.default.join(__dirname, 'fixtures');
function loadFixture(name) {
    return fs_1.default.readFileSync(path_1.default.join(fixturesDir, name), 'utf8');
}
describe('documentClassifier', () => {
    it('classifies CHOPO reports', () => {
        const text = loadFixture('chopoLabText.txt');
        const doc = (0, documentClassifier_service_1.classifyLabDocument)(text);
        expect(doc.vendor).toBe('chopo');
        expect(doc.laboratoryName).toBe('CHOPO');
    });
    it('classifies Salud Digna reports', () => {
        const doc = (0, documentClassifier_service_1.classifyLabDocument)(loadFixture('saludDignaLabText.txt'));
        expect(doc.vendor).toBe('salud_digna');
    });
    it('classifies LAPI reports', () => {
        const doc = (0, documentClassifier_service_1.classifyLabDocument)(loadFixture('lapiLabText.txt'));
        expect(doc.vendor).toBe('lapi');
    });
    it('classifies OLAB reports', () => {
        const doc = (0, documentClassifier_service_1.classifyLabDocument)(loadFixture('olabLabText.txt'));
        expect(doc.vendor).toBe('olab');
    });
    it('classifies Laboratorios Ruiz reports', () => {
        const doc = (0, documentClassifier_service_1.classifyLabDocument)(loadFixture('laboratoriosRuizLabText.txt'));
        expect(doc.vendor).toBe('laboratorios_ruiz');
    });
    it('classifies Carpermor reports', () => {
        const doc = (0, documentClassifier_service_1.classifyLabDocument)(loadFixture('carpermorLabText.txt'));
        expect(doc.vendor).toBe('carpermor');
    });
    it('classifies Biomédica reports', () => {
        const doc = (0, documentClassifier_service_1.classifyLabDocument)(loadFixture('biomedicaFullPanel2025LabText.txt'));
        expect(doc.vendor).toBe('biomedica');
        expect(doc.laboratoryName).toMatch(/Biom[eé]dica/i);
    });
});
describe('clinicalValidator', () => {
    it('rejects plaquetas with mg/dL', () => {
        const row = (0, clinicalValidator_service_1.validateParameterCandidate)((0, labParser_interface_1.candidateFromParsedLine)({
            rawName: 'Plaquetas',
            value: 250000,
            valueText: '250000',
            unit: 'mg/dL',
            referenceLow: null,
            referenceHigh: null,
            referenceText: null,
            sourceLines: [],
            confidence: 0.9,
        }));
        expect(row.validationErrors.length).toBeGreaterThan(0);
        expect(row.confidence).toBeLessThan(0.9);
    });
    it('accepts glucosa with mg/dL', () => {
        const row = (0, clinicalValidator_service_1.validateParameterCandidate)((0, labParser_interface_1.candidateFromParsedLine)({
            rawName: 'Glucosa',
            value: 90,
            valueText: '90',
            unit: 'mg/dL',
            referenceLow: 70,
            referenceHigh: 100,
            referenceText: '70-100',
            sourceLines: [],
            confidence: 0.9,
        }));
        expect(row.validationErrors).toHaveLength(0);
    });
});
describe('lab extraction pipeline', () => {
    const cases = [
        { fixture: 'chopoLabText.txt', vendor: 'chopo', analyte: 'glucosa' },
        { fixture: 'saludDignaLabText.txt', vendor: 'salud_digna', analyte: 'glucosa' },
        { fixture: 'lapiLabText.txt', vendor: 'lapi', analyte: 'colesterol' },
        { fixture: 'olabLabText.txt', vendor: 'olab', analyte: 'hemoglobina' },
        { fixture: 'laboratoriosRuizLabText.txt', vendor: 'laboratorios_ruiz', analyte: 'potasio' },
        { fixture: 'carpermorLabText.txt', vendor: 'carpermor', analyte: 'ast' },
    ];
    it.each(cases)('parses $fixture with vendor $vendor', async ({ fixture, vendor, analyte }) => {
        const result = await (0, labPipeline_service_1.runLabExtractionPipeline)(loadFixture(fixture), 'pdf-parse');
        expect(result.classification.vendor).toBe(vendor);
        expect(result.candidates.length).toBeGreaterThan(0);
        const names = result.candidates.map((c) => c.rawName.toLowerCase());
        expect(names.some((n) => n.includes(analyte))).toBe(true);
        expect(result.trace.parserUsed).not.toBe('GenericRegexParser');
    });
    it('corrects mislabeled CHOPO-style Sodio rows via unit/range inference', async () => {
        const text = [
            'www.chopo.com.mx',
            'GRUPO DIAGNÓSTICO MÉDICO PROA S.A. DE C.V.',
            'Análisis Clínicos',
            'QUÍMICA DE 27 ELEMENTOS',
            'Sodio',
            '14.68',
            '2.6 - 24.9 μUI/mL',
            'Sodio',
            '38.47',
            '30 - 100 ng/mL',
        ].join('\n');
        const result = await (0, labPipeline_service_1.runLabExtractionPipeline)(text, 'pdf-parse');
        const names = result.candidates.map((c) => c.rawName.toLowerCase());
        expect(names.some((n) => n.includes('insulina'))).toBe(true);
        expect(names.some((n) => n.includes('vitamina d'))).toBe(true);
        expect(names.filter((n) => n === 'sodio')).toHaveLength(0);
    });
    it('parses 2012 CHOPO lipid panel with dot-prefixed unit lines end-to-end', async () => {
        var _a, _b, _c, _d, _e, _f;
        const result = await (0, labPipeline_service_1.runLabExtractionPipeline)(loadFixture('chopoLipidPanel2012LabText.txt'), 'pdf-parse');
        const byName = Object.fromEntries(result.candidates.map((c) => [c.rawName.toLowerCase(), c]));
        expect(result.classification.vendor).toBe('chopo');
        expect(result.trace.parserUsed).toBe('ChopoStackedParser');
        expect(result.candidates).toHaveLength(6);
        expect((_a = byName.colesterol) === null || _a === void 0 ? void 0 : _a.value).toBeCloseTo(260);
        expect((_b = byName.colesterol) === null || _b === void 0 ? void 0 : _b.unit).toMatch(/mg\/dL/i);
        expect((_c = byName.colesterol) === null || _c === void 0 ? void 0 : _c.referenceHigh).toBeCloseTo(200);
        expect((_d = byName['colesterol hdl']) === null || _d === void 0 ? void 0 : _d.referenceLow).toBeCloseTo(60);
        expect((_e = byName['índice aterogénico']) === null || _e === void 0 ? void 0 : _e.value).toBeCloseTo(5.8);
        expect((_f = byName['índice aterogénico']) === null || _f === void 0 ? void 0 : _f.referenceHigh).toBeCloseTo(4.5);
        expect(result.candidates.some((c) => /mg\/dl/i.test(c.rawName))).toBe(false);
        expect(result.candidates.some((c) => /q\.f\.b|c[eé]dula/i.test(c.rawName))).toBe(false);
    });
    it('parses LAPI biometria hematica tabular report with correct study date', async () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const result = await (0, labPipeline_service_1.runLabExtractionPipeline)(loadFixture('lapiBiometriaHematica2025LabText.txt'), 'pdf-parse');
        const byName = Object.fromEntries(result.candidates.map((c) => [c.rawName.toLowerCase(), c]));
        expect(result.classification.vendor).toBe('lapi');
        expect(result.trace.parserUsed).toBe('LapiParser');
        expect(result.trace.parserUsed).not.toBe('GenericRegexParser');
        expect(result.candidates.length).toBeGreaterThanOrEqual(20);
        expect((_a = byName.eritrocitos) === null || _a === void 0 ? void 0 : _a.value).toBeCloseTo(5.07);
        expect((_b = byName.hemoglobina) === null || _b === void 0 ? void 0 : _b.value).toBeCloseTo(15.2);
        expect((_c = byName.hematocrito) === null || _c === void 0 ? void 0 : _c.value).toBeCloseTo(45.6);
        expect((_d = byName.leucocitos) === null || _d === void 0 ? void 0 : _d.value).toBeCloseTo(5.7);
        expect((_e = byName.plaquetas) === null || _e === void 0 ? void 0 : _e.value).toBeCloseTo(245);
        expect(result.candidates.some((c) => /city\s*shops/i.test(c.rawName))).toBe(false);
        expect(result.candidates.some((c) => c.value === 749109)).toBe(false);
        expect((_f = result.metadata.studyDate) === null || _f === void 0 ? void 0 : _f.getFullYear()).toBe(2025);
        expect((_g = result.metadata.studyDate) === null || _g === void 0 ? void 0 : _g.getMonth()).toBe(11);
        expect((_h = result.metadata.studyDate) === null || _h === void 0 ? void 0 : _h.getDate()).toBe(19);
        expect((_j = result.metadata.studyDate) === null || _j === void 0 ? void 0 : _j.getFullYear()).not.toBe(1988);
    });
    it('does not route classified CHOPO reports to GenericRegexParser on footer-only text', async () => {
        const text = [
            'www.chopo.com.mx',
            'GRUPO DIAGNÓSTICO MÉDICO PROA S.A. DE C.V.',
            'PERFIL DE LIPIDOS EN SUERO',
            'Responsable del Laboratorio',
            'Q.F.B Mario García Sánchez Cédula Profesional 895854',
        ].join('\n');
        const result = await (0, labPipeline_service_1.runLabExtractionPipeline)(text, 'pdf-parse');
        expect(result.classification.vendor).toBe('chopo');
        expect(result.trace.parserUsed).toBe('ChopoStackedParser');
        expect(result.trace.parserUsed).not.toBe('GenericRegexParser');
        expect(result.candidates).toHaveLength(0);
    });
});
