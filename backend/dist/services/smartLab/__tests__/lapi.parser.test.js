"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const lapi_parser_1 = require("../pipeline/parsers/lapi.parser");
const fixturesDir = path_1.default.join(__dirname, 'fixtures');
function loadFixture(name) {
    return fs_1.default.readFileSync(path_1.default.join(fixturesDir, name), 'utf8');
}
describe('splitGluedHighAndUnit', () => {
    it('splits glued 10^6uL from reference high', () => {
        expect((0, lapi_parser_1.splitGluedHighAndUnit)('5.4410^6uL')).toEqual({
            high: 5.44,
            unit: '10^6uL',
        });
    });
    it('splits glued 10^3uL from reference high', () => {
        expect((0, lapi_parser_1.splitGluedHighAndUnit)('11.0010^3uL')).toEqual({
            high: 11.0,
            unit: '10^3uL',
        });
    });
    it('splits g/dL glued to high', () => {
        expect((0, lapi_parser_1.splitGluedHighAndUnit)('16.3g/dL')).toEqual({
            high: 16.3,
            unit: 'g/dL',
        });
    });
    it('splits percent glued to high', () => {
        expect((0, lapi_parser_1.splitGluedHighAndUnit)('48.9%')).toEqual({
            high: 48.9,
            unit: '%',
        });
    });
});
describe('parseLapiTwoLineResults', () => {
    it('parses page 1 biometria with 20+ hematology rows', () => {
        var _a, _b, _c, _d, _e, _f, _g;
        const text = loadFixture('lapiBiometriaHematica2025LabText.txt');
        const rows = (0, lapi_parser_1.parseLapiTwoLineResults)(text);
        expect(rows.length).toBeGreaterThanOrEqual(20);
        const byName = Object.fromEntries(rows.map((r) => [r.rawName.toLowerCase(), r]));
        expect((_a = byName.eritrocitos) === null || _a === void 0 ? void 0 : _a.value).toBeCloseTo(5.07);
        expect((_b = byName.eritrocitos) === null || _b === void 0 ? void 0 : _b.referenceLow).toBeCloseTo(3.87);
        expect((_c = byName.eritrocitos) === null || _c === void 0 ? void 0 : _c.referenceHigh).toBeCloseTo(5.44);
        expect((_d = byName.eritrocitos) === null || _d === void 0 ? void 0 : _d.unit).toBe('10^6uL');
        expect((_e = byName.hemoglobina) === null || _e === void 0 ? void 0 : _e.value).toBeCloseTo(15.2);
        expect((_f = byName.hematocrito) === null || _f === void 0 ? void 0 : _f.unit).toBe('%');
        expect((_g = byName.plaquetas) === null || _g === void 0 ? void 0 : _g.value).toBeCloseTo(245);
        expect(rows.some((r) => /city\s*shops/i.test(r.rawName))).toBe(false);
        expect(rows.some((r) => r.value === 749109)).toBe(false);
    });
    it('parses lipid multi-line unit after asterisk', () => {
        const text = loadFixture('lapiPerfilPlus2025LabText.txt');
        const rows = (0, lapi_parser_1.parseLapiTwoLineResults)(text);
        const colesterol = rows.find((r) => r.rawName.toLowerCase().includes('colesterol total'));
        expect(colesterol === null || colesterol === void 0 ? void 0 : colesterol.value).toBeCloseTo(218);
        expect(colesterol === null || colesterol === void 0 ? void 0 : colesterol.referenceLow).toBeCloseTo(130);
        expect(colesterol === null || colesterol === void 0 ? void 0 : colesterol.referenceHigh).toBeCloseTo(199);
        expect(colesterol === null || colesterol === void 0 ? void 0 : colesterol.unit).toMatch(/mg\/dL/i);
    });
    it('parses full PERFIL PLUS with 80+ numeric results', () => {
        const text = loadFixture('lapiPerfilPlus2025LabText.txt');
        const rows = lapi_parser_1.lapiParser.parse(text);
        expect(rows.length).toBeGreaterThanOrEqual(80);
    });
    it('still parses legacy stacked lipid fixture', () => {
        const text = loadFixture('lapiLabText.txt');
        const rows = lapi_parser_1.lapiParser.parse(text);
        expect(rows.length).toBeGreaterThanOrEqual(3);
        const colesterol = rows.find((r) => r.rawName.toLowerCase().includes('colesterol'));
        expect(colesterol === null || colesterol === void 0 ? void 0 : colesterol.value).toBeCloseTo(210);
    });
});
