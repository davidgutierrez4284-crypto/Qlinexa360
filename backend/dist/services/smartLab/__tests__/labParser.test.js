"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const labParser_service_1 = require("../labParser.service");
const labMetadata_service_1 = require("../labMetadata.service");
const fixturePath = path_1.default.join(__dirname, 'fixtures', 'sampleLabText.txt');
describe('labParser', () => {
    it('parses common MX lab line patterns from fixture text', () => {
        const text = fs_1.default.readFileSync(fixturePath, 'utf8');
        const parsed = (0, labParser_service_1.parseLabResultsFromText)(text);
        const names = parsed.map((p) => p.analyteNameRaw.toLowerCase());
        expect(names.some((n) => n.includes('hemoglobina'))).toBe(true);
        expect(names.some((n) => n.includes('glucosa'))).toBe(true);
        expect(parsed.every((p) => p.rawTextSnippet.length > 0)).toBe(true);
    });
    it('deduplicates repeated analyte names', () => {
        const text = 'Glucosa 90 mg/dL 70-100\nGlucosa 91 mg/dL 70-100';
        const parsed = (0, labParser_service_1.parseLabResultsFromText)(text);
        expect(parsed.filter((p) => p.analyteNameRaw.toLowerCase().includes('glucosa'))).toHaveLength(1);
    });
    it('captures reference ranges when present', () => {
        const text = 'Creatinina 1.0 mg/dL ref: 0.6-1.2';
        const [row] = (0, labParser_service_1.parseLabResultsFromText)(text);
        expect(row.referenceRangeLow).toBeCloseTo(0.6);
        expect(row.referenceRangeHigh).toBeCloseTo(1.2);
    });
    it('parses tab-separated table rows and H/L flags', () => {
        const text = 'Hemoglobina    14.2    g/dL    12-16    H';
        const [row] = (0, labParser_service_1.parseLabResultsFromText)(text);
        expect(row.analyteNameRaw.toLowerCase()).toContain('hemoglobina');
        expect(row.resultValue).toBeCloseTo(14.2);
        expect(row.referenceRangeLow).toBeCloseTo(12);
        expect(row.referenceRangeHigh).toBeCloseTo(16);
    });
    it('parses values with less-than prefix', () => {
        const text = 'Proteina C reactiva <0.5 mg/dL 0-0.5';
        const [row] = (0, labParser_service_1.parseLabResultsFromText)(text);
        expect(row.resultValue).toBeCloseTo(0.5);
        expect(row.resultValueText).toContain('<');
    });
    it('allows partial rows without reference range', () => {
        const text = 'TSH 2.4 mUI/L';
        const [row] = (0, labParser_service_1.parseLabResultsFromText)(text);
        expect(row.analyteNameRaw).toMatch(/TSH/i);
        expect(row.resultValue).toBeCloseTo(2.4);
        expect(row.confidence).toBeGreaterThan(0.4);
    });
});
describe('lab metadata extraction', () => {
    it('parses MX fixture metadata before line parsing', () => {
        var _a;
        const text = fs_1.default.readFileSync(fixturePath, 'utf8');
        const meta = (0, labMetadata_service_1.parseStudyMetadataFromText)(text);
        expect((_a = meta.laboratoryName) === null || _a === void 0 ? void 0 : _a.toLowerCase()).toContain('laboratorio');
        expect(meta.studyDate).toBeInstanceOf(Date);
    });
    it('reads labeled study and report dates', () => {
        var _a, _b, _c, _d;
        const text = `
LABORATORIO DE ANALISIS CLINICOS DEL CENTRO
Biometria hematica
Fecha de toma: 08/07/2026
Fecha de resultado: 09/07/2026
`;
        const meta = (0, labMetadata_service_1.parseStudyMetadataFromText)(text);
        expect((_a = meta.laboratoryName) === null || _a === void 0 ? void 0 : _a.toLowerCase()).toContain('analisis');
        expect((_b = meta.studyType) === null || _b === void 0 ? void 0 : _b.toLowerCase()).toContain('biometr');
        expect((_c = meta.studyDate) === null || _c === void 0 ? void 0 : _c.getFullYear()).toBe(2026);
        expect((_d = meta.reportDate) === null || _d === void 0 ? void 0 : _d.getDate()).toBe(9);
    });
    it('parseMxDateString uses day/month/year order', () => {
        const d = (0, labMetadata_service_1.parseMxDateString)('15/03/2024');
        expect(d === null || d === void 0 ? void 0 : d.getFullYear()).toBe(2024);
        expect(d === null || d === void 0 ? void 0 : d.getMonth()).toBe(2);
        expect(d === null || d === void 0 ? void 0 : d.getDate()).toBe(15);
    });
    it('boosts report confidence when metadata is present', () => {
        const meta = (0, labMetadata_service_1.parseStudyMetadataFromText)('Laboratorio: Clinica Norte\nEstudio: Quimica sanguinea\nFecha: 01/02/2023\nGlucosa 90 mg/dL 70-100');
        const withRows = (0, labMetadata_service_1.computeReportExtractionConfidence)([0.7], meta);
        const withoutRows = (0, labMetadata_service_1.computeReportExtractionConfidence)([], meta);
        expect(withRows).toBeGreaterThan(0.7);
        expect(withoutRows).toBeGreaterThan(0.4);
    });
    it('prefers LAPI sample collection date over birth date', () => {
        var _a, _b, _c, _d;
        const text = `
Laboratorio de Análisis Patológicos e Inmunológicos LAPI
Paciente: GUTIERREZ GRADOS MARIANA
F/N: 21/12/1988
Edad: 36 años
Fechas: Atención / Toma Muestra / Emisión
19/12/2025    09:59:16    20:23:01
BIOMETRÍA HEMÁTICA
`;
        const meta = (0, labMetadata_service_1.parseStudyMetadataFromText)(text);
        expect((_a = meta.studyDate) === null || _a === void 0 ? void 0 : _a.getFullYear()).toBe(2025);
        expect((_b = meta.studyDate) === null || _b === void 0 ? void 0 : _b.getMonth()).toBe(11);
        expect((_c = meta.studyDate) === null || _c === void 0 ? void 0 : _c.getDate()).toBe(19);
        expect((_d = meta.studyDate) === null || _d === void 0 ? void 0 : _d.getFullYear()).not.toBe(1988);
    });
    it('prefers Biomédica Fecha Toma de Muestra over F.NAC', () => {
        var _a, _b, _c, _d;
        const text = `
PACIENTE: Gutierrez Grados Marisel
SEXO: FEDAD:   40  AÑOSF.NAC:   30/11/1984
Fecha Toma de Muestra:08/04/2025
Biometria Hematica Completa
`;
        const meta = (0, labMetadata_service_1.parseStudyMetadataFromText)(text);
        expect((_a = meta.studyDate) === null || _a === void 0 ? void 0 : _a.getFullYear()).toBe(2025);
        expect((_b = meta.studyDate) === null || _b === void 0 ? void 0 : _b.getMonth()).toBe(3);
        expect((_c = meta.studyDate) === null || _c === void 0 ? void 0 : _c.getDate()).toBe(8);
        expect((_d = meta.studyDate) === null || _d === void 0 ? void 0 : _d.getFullYear()).not.toBe(1984);
    });
});
