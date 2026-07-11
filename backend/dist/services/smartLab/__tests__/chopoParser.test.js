"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const labParser_service_1 = require("../labParser.service");
const labMetadata_service_1 = require("../labMetadata.service");
const chopoParser_service_1 = require("../chopoParser.service");
const chopoFixturePath = path_1.default.join(__dirname, 'fixtures', 'chopoLabText.txt');
const fixturesDir = path_1.default.join(__dirname, 'fixtures');
describe('CHOPO lab parser', () => {
    const text = fs_1.default.readFileSync(chopoFixturePath, 'utf8');
    it('detects CHOPO reports', () => {
        expect((0, chopoParser_service_1.isChopoReport)(text)).toBe(true);
    });
    it('parses stacked name/value/range rows from CHOPO fixture', () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const parsed = (0, labParser_service_1.parseLabResultsFromText)(text);
        const byName = Object.fromEntries(parsed.map((p) => [p.analyteNameRaw.toLowerCase(), p]));
        expect(parsed.length).toBeGreaterThanOrEqual(6);
        expect((_a = byName.glucosa) === null || _a === void 0 ? void 0 : _a.resultValue).toBeCloseTo(90);
        expect((_b = byName.glucosa) === null || _b === void 0 ? void 0 : _b.resultUnit).toMatch(/mg\/dL/i);
        expect((_c = byName.glucosa) === null || _c === void 0 ? void 0 : _c.referenceRangeLow).toBeCloseTo(55);
        expect((_d = byName.glucosa) === null || _d === void 0 ? void 0 : _d.referenceRangeHigh).toBeCloseTo(99);
        expect((_e = byName.colesterol) === null || _e === void 0 ? void 0 : _e.resultValue).toBeCloseTo(241);
        expect((_f = byName.colesterol) === null || _f === void 0 ? void 0 : _f.referenceRangeHigh).toBeCloseTo(200);
        expect((_g = byName.potasio) === null || _g === void 0 ? void 0 : _g.resultValue).toBeCloseTo(4.6);
        expect((_h = byName.potasio) === null || _h === void 0 ? void 0 : _h.resultUnit).toMatch(/meq\/L/i);
        expect((_j = byName['ast (tgo)']) === null || _j === void 0 ? void 0 : _j.resultValue).toBeCloseTo(26);
        expect((_k = byName['ast (tgo)']) === null || _k === void 0 ? void 0 : _k.referenceRangeHigh).toBeCloseTo(39);
    });
    it('does not parse reference fragments or coupon lines as analytes', () => {
        const parsed = (0, labParser_service_1.parseLabResultsFromText)(text);
        const names = parsed.map((p) => p.analyteNameRaw);
        expect(names.some((n) => /^\d/.test(n))).toBe(false);
        expect(names.some((n) => n.includes('/12/2021'))).toBe(false);
        expect(names.some((n) => /^55 -$/i.test(n))).toBe(false);
    });
    it('extracts CHOPO metadata without disclaimer as study type', () => {
        var _a, _b;
        const meta = (0, labMetadata_service_1.parseStudyMetadataFromText)(text);
        expect(meta.laboratoryName).toBe('CHOPO');
        expect((_a = meta.studyType) === null || _a === void 0 ? void 0 : _a.toLowerCase()).toContain('química de 27 elementos');
        expect((_b = meta.studyType) === null || _b === void 0 ? void 0 : _b.toLowerCase()).not.toContain('se realiza en la misma muestra');
    });
    it('parses hepatic panel with multiple CHOPO sections (2017 format)', () => {
        const text = fs_1.default.readFileSync(path_1.default.join(fixturesDir, 'chopoHepatic2017LabText.txt'), 'utf8');
        const result = (0, chopoParser_service_1.parseChopoStackedResults)(text);
        const names = result.map((p) => p.analyteNameRaw.toLowerCase());
        expect(result.length).toBeGreaterThanOrEqual(14);
        expect(names.some((n) => n.includes('tgo') || n.includes('ast'))).toBe(true);
        expect(names.some((n) => n.includes('tgp') || n.includes('alt'))).toBe(true);
        expect(names.some((n) => n.includes('bilirrubina total'))).toBe(true);
        expect(names.some((n) => n.includes('proteínas totales') || n.includes('proteinas totales'))).toBe(true);
        expect(names.some((n) => n.includes('insulina'))).toBe(true);
        expect(names.some((n) => n.includes('glucosa'))).toBe(true);
        expect(names.some((n) => n === 'sodio')).toBe(false);
    });
    it('parses 3-hr glucose tolerance + insulin curve (2017 CHOPO format)', () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3;
        const text = fs_1.default.readFileSync(path_1.default.join(fixturesDir, 'chopoGlucoseInsulinCurve2017LabText.txt'), 'utf8');
        const result = (0, chopoParser_service_1.parseChopoStackedResults)(text);
        const byName = Object.fromEntries(result.map((p) => [p.analyteNameRaw.toLowerCase(), p]));
        expect(result).toHaveLength(11);
        expect((_a = byName['glucosa basal']) === null || _a === void 0 ? void 0 : _a.resultValue).toBeCloseTo(97);
        expect((_b = byName['glucosa basal']) === null || _b === void 0 ? void 0 : _b.resultUnit).toMatch(/mg\/dL/i);
        expect((_c = byName['glucosa basal']) === null || _c === void 0 ? void 0 : _c.referenceRangeLow).toBeCloseTo(55);
        expect((_d = byName['glucosa basal']) === null || _d === void 0 ? void 0 : _d.referenceRangeHigh).toBeCloseTo(99);
        expect((_e = byName['glucosa 30 min']) === null || _e === void 0 ? void 0 : _e.resultValue).toBeCloseTo(149);
        expect((_f = byName['glucosa 30 min']) === null || _f === void 0 ? void 0 : _f.resultUnit).toMatch(/mg\/dL/i);
        expect((_g = byName['glucosa 1 hora']) === null || _g === void 0 ? void 0 : _g.resultValue).toBeCloseTo(152);
        expect((_h = byName['glucosa 1 hora']) === null || _h === void 0 ? void 0 : _h.resultUnit).toMatch(/mg\/dL/i);
        expect((_j = byName['glucosa 2 horas']) === null || _j === void 0 ? void 0 : _j.resultValue).toBeCloseTo(103);
        expect((_k = byName['glucosa 2 horas']) === null || _k === void 0 ? void 0 : _k.resultUnit).toMatch(/mg\/dL/i);
        expect((_l = byName['glucosa 3 horas']) === null || _l === void 0 ? void 0 : _l.resultValue).toBeCloseTo(81);
        expect((_m = byName['glucosa 3 horas']) === null || _m === void 0 ? void 0 : _m.resultUnit).toMatch(/mg\/dL/i);
        expect((_o = byName['insulina basal']) === null || _o === void 0 ? void 0 : _o.resultValue).toBeCloseTo(18.6);
        expect((_p = byName['insulina basal']) === null || _p === void 0 ? void 0 : _p.resultUnit).toMatch(/µUI\/mL|μUI\/mL/i);
        expect((_q = byName['insulina basal']) === null || _q === void 0 ? void 0 : _q.referenceRangeLow).toBeCloseTo(2.6);
        expect((_r = byName['insulina basal']) === null || _r === void 0 ? void 0 : _r.referenceRangeHigh).toBeCloseTo(24.9);
        expect((_s = byName['insulina 30 min']) === null || _s === void 0 ? void 0 : _s.resultValue).toBeCloseTo(121.9);
        expect((_t = byName['insulina 30 min']) === null || _t === void 0 ? void 0 : _t.resultUnit).toMatch(/µUI\/mL|μUI\/mL/i);
        expect((_u = byName['insulina 1 hora']) === null || _u === void 0 ? void 0 : _u.resultValue).toBeCloseTo(193.7);
        expect((_v = byName['insulina 2 horas']) === null || _v === void 0 ? void 0 : _v.resultValue).toBeCloseTo(140.5);
        expect((_w = byName['insulina 2 horas']) === null || _w === void 0 ? void 0 : _w.referenceRangeLow).toBeCloseTo(18);
        expect((_x = byName['insulina 2 horas']) === null || _x === void 0 ? void 0 : _x.referenceRangeHigh).toBeCloseTo(56);
        expect((_y = byName['insulina 3 horas']) === null || _y === void 0 ? void 0 : _y.resultValue).toBeCloseTo(63.7);
        expect((_z = byName['insulina 3 horas']) === null || _z === void 0 ? void 0 : _z.referenceRangeLow).toBeCloseTo(8);
        expect((_0 = byName['insulina 3 horas']) === null || _0 === void 0 ? void 0 : _0.referenceRangeHigh).toBeCloseTo(22);
        expect((_1 = byName['insulina 4 horas']) === null || _1 === void 0 ? void 0 : _1.resultValue).toBeCloseTo(68.6);
        expect((_2 = byName['insulina 4 horas']) === null || _2 === void 0 ? void 0 : _2.referenceRangeLow).toBeCloseTo(6);
        expect((_3 = byName['insulina 4 horas']) === null || _3 === void 0 ? void 0 : _3.referenceRangeHigh).toBeCloseTo(21);
    });
    it('extracts curve study metadata without coupon noise (2017 CHOPO)', () => {
        var _a, _b, _c;
        const text = fs_1.default.readFileSync(path_1.default.join(fixturesDir, 'chopoGlucoseInsulinCurve2017LabText.txt'), 'utf8');
        const meta = (0, labMetadata_service_1.parseStudyMetadataFromText)(text);
        expect(meta.laboratoryName).toBe('CHOPO');
        expect((_a = meta.studyType) === null || _a === void 0 ? void 0 : _a.toLowerCase()).toContain('curva de tolerancia a la glucosa');
        expect((_b = meta.studyType) === null || _b === void 0 ? void 0 : _b.toLowerCase()).toContain('curva de insulina');
        expect((_c = meta.studyType) === null || _c === void 0 ? void 0 : _c.toLowerCase()).not.toContain('química de 35 elementos');
        expect(meta.studyType).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
    it('parses CHOPO lipid panel preserving cholesterol subtype names', () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const text = fs_1.default.readFileSync(path_1.default.join(fixturesDir, 'chopoCholesterolPanel.txt'), 'utf8');
        const result = (0, chopoParser_service_1.parseChopoStackedResults)(text);
        const byName = Object.fromEntries(result.map((p) => [p.analyteNameRaw.toLowerCase(), p]));
        expect(result.length).toBeGreaterThanOrEqual(6);
        expect((_a = byName.colesterol) === null || _a === void 0 ? void 0 : _a.resultValue).toBeCloseTo(237);
        expect((_b = byName.colesterol) === null || _b === void 0 ? void 0 : _b.referenceRangeHigh).toBeCloseTo(200);
        expect((_c = byName['colesterol hdl']) === null || _c === void 0 ? void 0 : _c.resultValue).toBeCloseTo(41);
        expect((_d = byName['colesterol hdl']) === null || _d === void 0 ? void 0 : _d.referenceRangeLow).toBeCloseTo(60);
        expect((_e = byName['colesterol ldl']) === null || _e === void 0 ? void 0 : _e.resultValue).toBeCloseTo(169);
        expect((_f = byName['colesterol ldl']) === null || _f === void 0 ? void 0 : _f.referenceRangeHigh).toBeCloseTo(100);
        expect((_g = byName['vldl colesterol']) === null || _g === void 0 ? void 0 : _g.resultValue).toBeCloseTo(41);
        expect((_h = byName['vldl colesterol']) === null || _h === void 0 ? void 0 : _h.referenceRangeHigh).toBeCloseTo(35);
        expect((_j = byName['colesterol no-hdl']) === null || _j === void 0 ? void 0 : _j.resultValue).toBeCloseTo(196);
        expect((_k = byName['colesterol no-hdl']) === null || _k === void 0 ? void 0 : _k.referenceRangeHigh).toBeCloseTo(130);
        const cholesterolNames = result
            .filter((p) => /colesterol|vldl/i.test(p.analyteNameRaw))
            .map((p) => p.analyteNameRaw.toLowerCase());
        expect(new Set(cholesterolNames).size).toBe(cholesterolNames.length);
    });
    it('parses 2012 CHOPO lipid panel with unit header lines and aterogenic index', () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const text = fs_1.default.readFileSync(path_1.default.join(fixturesDir, 'chopoLipidPanel2012LabText.txt'), 'utf8');
        const result = (0, chopoParser_service_1.parseChopoStackedResults)(text);
        const byName = Object.fromEntries(result.map((p) => [p.analyteNameRaw.toLowerCase(), p]));
        expect(result).toHaveLength(6);
        expect((_a = byName.colesterol) === null || _a === void 0 ? void 0 : _a.resultValue).toBeCloseTo(260);
        expect((_b = byName.colesterol) === null || _b === void 0 ? void 0 : _b.resultUnit).toMatch(/mg\/dL/i);
        expect((_c = byName.colesterol) === null || _c === void 0 ? void 0 : _c.referenceRangeHigh).toBeCloseTo(200);
        expect((_d = byName['colesterol hdl']) === null || _d === void 0 ? void 0 : _d.resultValue).toBeCloseTo(45);
        expect((_e = byName['colesterol hdl']) === null || _e === void 0 ? void 0 : _e.resultUnit).toMatch(/mg\/dL/i);
        expect((_f = byName['colesterol hdl']) === null || _f === void 0 ? void 0 : _f.referenceRangeLow).toBeCloseTo(60);
        expect((_g = byName['colesterol ldl']) === null || _g === void 0 ? void 0 : _g.resultValue).toBeCloseTo(194);
        expect((_h = byName['colesterol ldl']) === null || _h === void 0 ? void 0 : _h.referenceRangeHigh).toBeCloseTo(100);
        expect((_j = byName['colesterol no-hdl']) === null || _j === void 0 ? void 0 : _j.resultValue).toBeCloseTo(215);
        expect((_k = byName['colesterol no-hdl']) === null || _k === void 0 ? void 0 : _k.referenceRangeHigh).toBeCloseTo(130);
        expect((_l = byName.triglicéridos) === null || _l === void 0 ? void 0 : _l.resultValue).toBeCloseTo(106);
        expect((_m = byName.triglicéridos) === null || _m === void 0 ? void 0 : _m.resultUnit).toMatch(/mg\/dL/i);
        expect((_o = byName['índice aterogénico']) === null || _o === void 0 ? void 0 : _o.resultValue).toBeCloseTo(5.8);
        expect((_p = byName['índice aterogénico']) === null || _p === void 0 ? void 0 : _p.resultUnit).toBeNull();
        expect((_q = byName['índice aterogénico']) === null || _q === void 0 ? void 0 : _q.referenceRangeHigh).toBeCloseTo(4.5);
        const names = result.map((p) => p.analyteNameRaw.toLowerCase());
        expect(names.some((n) => n === 'mg/dl')).toBe(false);
    });
    it('extracts 2012 lipid panel study metadata', () => {
        var _a;
        const text = fs_1.default.readFileSync(path_1.default.join(fixturesDir, 'chopoLipidPanel2012LabText.txt'), 'utf8');
        const meta = (0, labMetadata_service_1.parseStudyMetadataFromText)(text);
        expect(meta.laboratoryName).toBe('CHOPO');
        expect((_a = meta.studyType) === null || _a === void 0 ? void 0 : _a.toLowerCase()).toContain('perfil de lipidos en suero');
    });
});
describe('lab parser validation helpers', () => {
    it('rejects range fragments as analyte names', () => {
        expect((0, chopoParser_service_1.isRangeFragmentName)('0.01 -')).toBe(true);
        expect((0, chopoParser_service_1.isRangeFragmentName)('55 -')).toBe(true);
        expect((0, chopoParser_service_1.isRangeFragmentName)('Glucosa')).toBe(false);
        expect((0, chopoParser_service_1.isRangeFragmentName)('1a. Muestra Insulina')).toBe(false);
    });
    it('rejects date fragments as units', () => {
        expect((0, chopoParser_service_1.isValidLabUnit)('/12/2021')).toBe(false);
        expect((0, chopoParser_service_1.isValidLabUnit)('mg/dL')).toBe(true);
        expect((0, chopoParser_service_1.isValidLabUnit)('. mg/dL')).toBe(true);
    });
    it('rejects dot-prefixed unit lines as analyte names', () => {
        expect((0, chopoParser_service_1.isUnitOnlyLine)('. mg/dL')).toBe(true);
        expect((0, chopoParser_service_1.isUnitOnlyLine)('mg/dL')).toBe(true);
        expect((0, chopoParser_service_1.isUnitOnlyLine)('Colesterol')).toBe(false);
    });
    it('rejects laboratory footer and signature lines', () => {
        expect((0, chopoParser_service_1.isFooterOrSignatureLine)('Q.F.B Mario García Sánchez Cédula Profesional')).toBe(true);
        expect((0, chopoParser_service_1.isFooterOrSignatureLine)('Responsable del Laboratorio')).toBe(true);
        expect((0, chopoParser_service_1.isFooterOrSignatureLine)('Colesterol')).toBe(false);
        expect((0, chopoParser_service_1.isProfessionalLicenseValue)('Q.F.B Mario García Sánchez Cédula Profesional', 895854)).toBe(true);
        expect((0, chopoParser_service_1.isProfessionalLicenseValue)('Colesterol', 260)).toBe(false);
    });
});
