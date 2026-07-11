"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const documentClassifier_service_1 = require("../pipeline/documentClassifier.service");
const biomedica_parser_1 = require("../pipeline/parsers/biomedica.parser");
const labMetadata_service_1 = require("../labMetadata.service");
const labPipeline_service_1 = require("../pipeline/labPipeline.service");
const fixturesDir = path_1.default.join(__dirname, 'fixtures');
function loadFixture(name) {
    return fs_1.default.readFileSync(path_1.default.join(fixturesDir, name), 'utf8');
}
describe('Biomédica parser', () => {
    it('classifies Biomédica reports', () => {
        const text = loadFixture('biomedicaFullPanel2025LabText.txt');
        const doc = (0, documentClassifier_service_1.classifyLabDocument)(text);
        expect(doc.vendor).toBe('biomedica');
        expect(doc.laboratoryName).toMatch(/Biom[eé]dica/i);
    });
    it('uses Fecha Toma de Muestra instead of F.NAC for study date', () => {
        var _a, _b, _c, _d;
        const text = loadFixture('biomedicaFullPanel2025LabText.txt');
        const meta = (0, labMetadata_service_1.parseStudyMetadataFromText)(text);
        expect((_a = meta.studyDate) === null || _a === void 0 ? void 0 : _a.getFullYear()).toBe(2025);
        expect((_b = meta.studyDate) === null || _b === void 0 ? void 0 : _b.getMonth()).toBe(3);
        expect((_c = meta.studyDate) === null || _c === void 0 ? void 0 : _c.getDate()).toBe(8);
        expect((_d = meta.studyDate) === null || _d === void 0 ? void 0 : _d.getFullYear()).not.toBe(1984);
    });
    it('parses biometría hemática with 20+ rows from glued tabular layout', () => {
        var _a, _b, _c, _d, _e, _f;
        const text = loadFixture('biomedicaFullPanel2025LabText.txt');
        const rows = (0, biomedica_parser_1.parseBiomedicaResults)(text);
        const biometriaRows = rows.filter((r) => /eritrocito|hemoglobina|hematocrito|leucocito|plaqueta|neutr[oó]filo|linfocito|monocito|eosin[oó]filo|bas[oó]filo|volumen|ancho|concentraci[oó]n/i.test(r.rawName));
        expect(biometriaRows.length).toBeGreaterThanOrEqual(20);
        const byName = Object.fromEntries(rows.map((r) => [r.rawName.toLowerCase(), r]));
        expect((_a = byName.eritrocitos) === null || _a === void 0 ? void 0 : _a.value).toBeCloseTo(4.88);
        expect((_b = byName.eritrocitos) === null || _b === void 0 ? void 0 : _b.unit).toMatch(/millones\/mm3/i);
        expect((_c = byName.eritrocitos) === null || _c === void 0 ? void 0 : _c.referenceLow).toBeCloseTo(4.2);
        expect((_d = byName.eritrocitos) === null || _d === void 0 ? void 0 : _d.referenceHigh).toBeCloseTo(5.4);
        expect((_e = byName.hemoglobina) === null || _e === void 0 ? void 0 : _e.value).toBeCloseTo(13.8);
        expect((_f = byName.plaquetas) === null || _f === void 0 ? void 0 : _f.value).toBeCloseTo(283);
    });
    it('rejects lipid reference tier lines as analytes', () => {
        const text = loadFixture('biomedicaFullPanel2025LabText.txt');
        const rows = (0, biomedica_parser_1.parseBiomedicaResults)(text);
        const names = rows.map((r) => r.rawName.toLowerCase());
        expect(names.some((n) => n.includes('<50') || n.includes('años'))).toBe(false);
        expect(names.some((n) => /^alto\b/.test(n) || n.includes('160 -'))).toBe(false);
        expect(names.some((n) => n.includes('bajo menor') || n.includes('deseable'))).toBe(false);
        expect(names.some((n) => n.includes('fecha toma'))).toBe(false);
        expect(names.some((n) => n.includes('a partir del'))).toBe(false);
    });
    it('parses chemistry rows across multi-page sections', () => {
        const text = loadFixture('biomedicaFullPanel2025LabText.txt');
        const rows = biomedica_parser_1.biomedicaParser.parse(text);
        expect(rows.length).toBeGreaterThanOrEqual(40);
        const glucosa = rows.find((r) => r.rawName.toLowerCase().includes('glucosa'));
        expect(glucosa === null || glucosa === void 0 ? void 0 : glucosa.value).toBeCloseTo(84);
        expect(glucosa === null || glucosa === void 0 ? void 0 : glucosa.unit).toMatch(/mg\/dL/i);
    });
    it('runs full pipeline with BiomedicaParser (not GenericRegexParser)', async () => {
        var _a;
        const text = loadFixture('biomedicaFullPanel2025LabText.txt');
        const result = await (0, labPipeline_service_1.runLabExtractionPipeline)(text, 'pdf-parse');
        expect(result.classification.vendor).toBe('biomedica');
        expect(result.trace.parserUsed).toBe('BiomedicaParser');
        expect(result.candidates.length).toBeGreaterThanOrEqual(40);
        expect((_a = result.metadata.studyDate) === null || _a === void 0 ? void 0 : _a.getFullYear()).toBe(2025);
    });
});
