"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const labNormalization_service_1 = require("../labNormalization.service");
const labParser_service_1 = require("../labParser.service");
const chopoPanelFixturePath = path_1.default.join(__dirname, 'fixtures', 'chopoHemoglobinImmunoglobulinPanel.txt');
const chopoCholesterolFixturePath = path_1.default.join(__dirname, 'fixtures', 'chopoCholesterolPanel.txt');
const hematologyCatalog = [
    {
        id: 'cat-hb',
        category: 'Biometría hemática',
        name: 'Hemoglobina',
        aliasesJson: ['Hb', 'HGB', 'Hemoglobin'],
        defaultUnit: 'g/dL',
        defaultReferenceLow: 12,
        defaultReferenceHigh: 16,
        allowedUnitsJson: ['g/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-hcm',
        category: 'Biometría hemática',
        name: 'HCM',
        aliasesJson: ['MCH', 'Hemoglobina corp. media', 'Hemoglobina Corp. Media'],
        defaultUnit: 'pg',
        defaultReferenceLow: 27,
        defaultReferenceHigh: 33,
        allowedUnitsJson: ['pg'],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-hba1c',
        category: 'Diabetes',
        name: 'HbA1c',
        aliasesJson: ['A1c', 'Hemoglobina glicosilada', 'Hemoglobina glicosilada A1c', 'Hb A1c'],
        defaultUnit: '%',
        defaultReferenceLow: null,
        defaultReferenceHigh: 5.7,
        allowedUnitsJson: ['%'],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-globulina',
        category: 'Química sanguínea',
        name: 'Globulina',
        aliasesJson: ['Globulin', 'Globulinas'],
        defaultUnit: 'g/dL',
        defaultReferenceLow: 2,
        defaultReferenceHigh: 3.5,
        allowedUnitsJson: ['g/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-iga',
        category: 'Inmunología',
        name: 'Inmunoglobulina A',
        aliasesJson: ['IgA', 'Immunoglobulin A'],
        defaultUnit: 'mg/dL',
        defaultReferenceLow: 70,
        defaultReferenceHigh: 400,
        allowedUnitsJson: ['mg/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-igg',
        category: 'Inmunología',
        name: 'Inmunoglobulina G',
        aliasesJson: ['IgG', 'Immunoglobulin G'],
        defaultUnit: 'mg/dL',
        defaultReferenceLow: 700,
        defaultReferenceHigh: 1600,
        allowedUnitsJson: ['mg/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-igm',
        category: 'Inmunología',
        name: 'Inmunoglobulina M',
        aliasesJson: ['IgM', 'Immunoglobulin M'],
        defaultUnit: 'mg/dL',
        defaultReferenceLow: 40,
        defaultReferenceHigh: 230,
        allowedUnitsJson: ['mg/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
];
const lipidCatalog = [
    {
        id: 'cat-ct',
        category: 'Perfil lipídico',
        name: 'Colesterol total',
        aliasesJson: ['Total cholesterol', 'CT', 'Colesterol', 'Colesterol (total)'],
        defaultUnit: 'mg/dL',
        defaultReferenceLow: null,
        defaultReferenceHigh: 200,
        allowedUnitsJson: ['mg/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-hdl',
        category: 'Perfil lipídico',
        name: 'HDL',
        aliasesJson: ['HDL-C', 'Colesterol HDL'],
        defaultUnit: 'mg/dL',
        defaultReferenceLow: 40,
        defaultReferenceHigh: null,
        allowedUnitsJson: ['mg/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-ldl',
        category: 'Perfil lipídico',
        name: 'LDL',
        aliasesJson: ['LDL-C', 'Colesterol LDL'],
        defaultUnit: 'mg/dL',
        defaultReferenceLow: null,
        defaultReferenceHigh: 100,
        allowedUnitsJson: ['mg/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-vldl',
        category: 'Perfil lipídico',
        name: 'VLDL',
        aliasesJson: ['VLDL-C', 'VLDL colesterol', 'Colesterol VLDL'],
        defaultUnit: 'mg/dL',
        defaultReferenceLow: 5,
        defaultReferenceHigh: 40,
        allowedUnitsJson: ['mg/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-nhdl',
        category: 'Perfil lipídico',
        name: 'Colesterol no-HDL',
        aliasesJson: ['Colesterol no HDL', 'Non-HDL cholesterol', 'no-HDL'],
        defaultUnit: 'mg/dL',
        defaultReferenceLow: null,
        defaultReferenceHigh: 130,
        allowedUnitsJson: ['mg/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-tg',
        category: 'Perfil lipídico',
        name: 'Triglicéridos',
        aliasesJson: ['Triglycerides', 'TG', 'Triglicéridos'],
        defaultUnit: 'mg/dL',
        defaultReferenceLow: null,
        defaultReferenceHigh: 150,
        allowedUnitsJson: ['mg/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-ai',
        category: 'Perfil lipídico',
        name: 'Índice aterogénico',
        aliasesJson: ['Atherogenic index', 'CT/HDL', 'Índice aterogénico'],
        defaultUnit: null,
        defaultReferenceLow: null,
        defaultReferenceHigh: 4.5,
        allowedUnitsJson: [],
        sexSpecific: false,
        ageSpecific: false,
    },
    {
        id: 'cat-mg',
        category: 'Electrolitos',
        name: 'Magnesio',
        aliasesJson: ['Mg', 'Magnesium'],
        defaultUnit: 'mg/dL',
        defaultReferenceLow: 1.7,
        defaultReferenceHigh: 2.2,
        allowedUnitsJson: ['mg/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
];
const catalog = [
    {
        id: 'cat-glucosa',
        category: 'Quimica sanguinea',
        name: 'Glucosa',
        aliasesJson: ['Glu', 'Glucose'],
        defaultUnit: 'mg/dL',
        defaultReferenceLow: 70,
        defaultReferenceHigh: 100,
        allowedUnitsJson: ['mg/dL'],
        sexSpecific: false,
        ageSpecific: false,
    },
];
const baseLine = (overrides = {}) => (Object.assign({ analyteNameRaw: 'Glucosa', resultValue: 110, resultValueText: '110', resultUnit: 'mg/dL', referenceRangeLow: null, referenceRangeHigh: null, referenceRangeText: null, rawTextSnippet: 'Glucosa 110 mg/dL', confidence: 0.8 }, overrides));
describe('labNormalization', () => {
    it('maps catalog category aliases to dashboard keys', () => {
        expect((0, labNormalization_service_1.mapCatalogCategoryToDashboard)('Biometria hematica')).toBe('hematologia');
        expect((0, labNormalization_service_1.mapCatalogCategoryToDashboard)('Perfil lipidico')).toBe('perfil_lipidico');
    });
    it('matches catalog entry by name or alias', () => {
        const normalized = (0, labNormalization_service_1.normalizeParsedLine)(baseLine({ analyteNameRaw: 'Glu' }), catalog);
        expect(normalized.analyteCatalogId).toBe('cat-glucosa');
        expect(normalized.analyteNameNormalized).toBe('Glucosa');
        expect(normalized.referenceRangeLow).toBe(70);
        expect(normalized.referenceRangeHigh).toBe(100);
        expect(normalized.abnormalFlag).toBe('high');
    });
    it('returns otros when no catalog match', () => {
        const normalized = (0, labNormalization_service_1.normalizeParsedLine)(baseLine({ analyteNameRaw: 'Parametro raro' }), catalog);
        expect(normalized.analyteCatalogId).toBeNull();
        expect(normalized.dashboardCategory).toBe('otros');
    });
    it('dashboardCategoryLabel falls back to otros label', () => {
        expect((0, labNormalization_service_1.dashboardCategoryLabel)('hematologia')).toContain('Hemat');
        expect((0, labNormalization_service_1.dashboardCategoryLabel)('unknown_key')).toBeTruthy();
    });
    it('does not match Insulina basal to short alias Na (Sodio)', () => {
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Na', 'Insulina basal')).toBe(false);
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Na', 'Sodio')).toBe(true);
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Insulina basal', 'Insulina basal')).toBe(true);
    });
    it('does not match Mg alias to mg/dL unit token', () => {
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Mg', 'mg/dL')).toBe(false);
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Mg', 'Magnesio')).toBe(true);
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Mg', 'Colesterol')).toBe(false);
    });
    it('prefers Insulina over Sodio when unit is µUI/mL', () => {
        const fullCatalog = [
            {
                id: 'cat-sodio',
                category: 'Electrolitos',
                name: 'Sodio',
                aliasesJson: ['Na', 'Sodium'],
                defaultUnit: 'mEq/L',
                defaultReferenceLow: 135,
                defaultReferenceHigh: 145,
                allowedUnitsJson: ['mEq/L'],
                sexSpecific: false,
                ageSpecific: false,
            },
            {
                id: 'cat-insulina',
                category: 'Diabetes',
                name: 'Insulina',
                aliasesJson: ['Insulin', 'Insulina basal'],
                defaultUnit: 'µU/mL',
                defaultReferenceLow: 2,
                defaultReferenceHigh: 25,
                allowedUnitsJson: ['µU/mL', 'μUI/mL'],
                sexSpecific: false,
                ageSpecific: false,
            },
        ];
        const normalized = (0, labNormalization_service_1.normalizeParsedLine)(baseLine({
            analyteNameRaw: 'Insulina basal',
            resultValue: 14.68,
            resultValueText: '14.68',
            resultUnit: 'μUI/mL',
            referenceRangeLow: 2.6,
            referenceRangeHigh: 24.9,
        }), fullCatalog);
        expect(normalized.analyteNameNormalized).toBe('Insulina');
        expect(normalized.analyteCatalogId).toBe('cat-insulina');
    });
    it('normalizes corrected Vitamina D (25 Hidroxi) to catalog Vitamina D', () => {
        const vitDCatalog = [
            {
                id: 'cat-vitd',
                category: 'Vitaminas',
                name: 'Vitamina D',
                aliasesJson: ['25-OH vitamin D', 'Vit D', '25-hidroxivitamina D'],
                defaultUnit: 'ng/mL',
                defaultReferenceLow: 30,
                defaultReferenceHigh: 100,
                allowedUnitsJson: ['ng/mL'],
                sexSpecific: false,
                ageSpecific: false,
            },
        ];
        const normalized = (0, labNormalization_service_1.normalizeParsedLine)(baseLine({
            analyteNameRaw: 'Vitamina D (25 Hidroxi)',
            resultValue: 38.47,
            resultValueText: '38.47',
            resultUnit: 'ng/mL',
            referenceRangeLow: 30,
            referenceRangeHigh: 100,
        }), vitDCatalog);
        expect(normalized.analyteNameNormalized).toBe('Vitamina D');
        expect(normalized.analyteCatalogId).toBe('cat-vitd');
        expect(normalized.abnormalFlag).toBe('normal');
    });
    it('does not match Globulina alias inside Inmunoglobulina', () => {
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Globulina', 'Inmunoglobulina A')).toBe(false);
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Globulina', 'Globulinas')).toBe(true);
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Inmunoglobulina A', 'Inmunoglobulina A')).toBe(true);
    });
    it('distinguishes Hemoglobina, HCM and HbA1c from CHOPO-style names', () => {
        const hb = (0, labNormalization_service_1.normalizeParsedLine)(baseLine({
            analyteNameRaw: 'Hemoglobina',
            resultValue: 16.9,
            resultUnit: 'g/dL',
            referenceRangeLow: 14,
            referenceRangeHigh: 18,
        }), hematologyCatalog);
        expect(hb.analyteCatalogId).toBe('cat-hb');
        expect(hb.analyteNameNormalized).toBe('Hemoglobina');
        const hcm = (0, labNormalization_service_1.normalizeParsedLine)(baseLine({
            analyteNameRaw: 'Hemoglobina Corp. Media',
            resultValue: 30.1,
            resultUnit: 'pg',
            referenceRangeLow: 27,
            referenceRangeHigh: 31,
        }), hematologyCatalog);
        expect(hcm.analyteCatalogId).toBe('cat-hcm');
        expect(hcm.analyteNameNormalized).toBe('Hemoglobina Corp. Media');
        const hba1c = (0, labNormalization_service_1.normalizeParsedLine)(baseLine({
            analyteNameRaw: 'Hemoglobina glicosilada A1c',
            resultValue: 5.9,
            resultUnit: '%',
            referenceRangeLow: 4,
            referenceRangeHigh: 6,
        }), hematologyCatalog);
        expect(hba1c.analyteCatalogId).toBe('cat-hba1c');
        expect(hba1c.analyteNameNormalized).toBe('Hemoglobina glicosilada A1c');
    });
    it('maps immunoglobulins to distinct catalog entries, not Globulina', () => {
        for (const [raw, id, display] of [
            ['Inmunoglobulina A', 'cat-iga', 'Inmunoglobulina A'],
            ['Inmunoglobulina G', 'cat-igg', 'Inmunoglobulina G'],
            ['Inmunoglobulina M', 'cat-igm', 'Inmunoglobulina M'],
        ]) {
            const normalized = (0, labNormalization_service_1.normalizeParsedLine)(baseLine({
                analyteNameRaw: raw,
                resultValue: 100,
                resultUnit: 'mg/dL',
                referenceRangeLow: 40,
                referenceRangeHigh: 400,
            }), hematologyCatalog);
            expect(normalized.analyteCatalogId).toBe(id);
            expect(normalized.analyteNameNormalized).toBe(display);
        }
        const globulinas = (0, labNormalization_service_1.normalizeParsedLine)(baseLine({
            analyteNameRaw: 'Globulinas',
            resultValue: 2.7,
            resultUnit: 'g/dL',
            referenceRangeLow: 2.9,
            referenceRangeHigh: 3.1,
        }), hematologyCatalog);
        expect(globulinas.analyteCatalogId).toBe('cat-globulina');
        expect(globulinas.analyteNameNormalized).toBe('Globulina');
    });
    it('normalizes CHOPO hemoglobin/immunoglobulin panel without name collapse', () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
        const text = fs_1.default.readFileSync(chopoPanelFixturePath, 'utf8');
        const parsed = (0, labParser_service_1.parseLabResultsFromText)(text);
        const normalized = parsed.map((line) => (0, labNormalization_service_1.normalizeParsedLine)(line, hematologyCatalog));
        const byRaw = Object.fromEntries(normalized.map((n) => [n.analyteNameRaw.toLowerCase(), n]));
        expect((_a = byRaw.hemoglobina) === null || _a === void 0 ? void 0 : _a.analyteNameNormalized).toBe('Hemoglobina');
        expect((_b = byRaw.hemoglobina) === null || _b === void 0 ? void 0 : _b.analyteCatalogId).toBe('cat-hb');
        expect((_c = byRaw['hemoglobina corp. media']) === null || _c === void 0 ? void 0 : _c.analyteNameNormalized).toBe('Hemoglobina Corp. Media');
        expect((_d = byRaw['hemoglobina corp. media']) === null || _d === void 0 ? void 0 : _d.analyteCatalogId).toBe('cat-hcm');
        expect((_e = byRaw['hemoglobina glicosilada a1c']) === null || _e === void 0 ? void 0 : _e.analyteNameNormalized).toBe('Hemoglobina glicosilada A1c');
        expect((_f = byRaw['hemoglobina glicosilada a1c']) === null || _f === void 0 ? void 0 : _f.analyteCatalogId).toBe('cat-hba1c');
        expect((_g = byRaw.globulinas) === null || _g === void 0 ? void 0 : _g.analyteNameNormalized).toBe('Globulina');
        expect((_h = byRaw['inmunoglobulina a']) === null || _h === void 0 ? void 0 : _h.analyteNameNormalized).toBe('Inmunoglobulina A');
        expect((_j = byRaw['inmunoglobulina g']) === null || _j === void 0 ? void 0 : _j.analyteNameNormalized).toBe('Inmunoglobulina G');
        expect((_k = byRaw['inmunoglobulina m']) === null || _k === void 0 ? void 0 : _k.analyteNameNormalized).toBe('Inmunoglobulina M');
        const keyDisplayNames = [
            (_l = byRaw.hemoglobina) === null || _l === void 0 ? void 0 : _l.analyteNameNormalized,
            (_m = byRaw['hemoglobina corp. media']) === null || _m === void 0 ? void 0 : _m.analyteNameNormalized,
            (_o = byRaw['hemoglobina glicosilada a1c']) === null || _o === void 0 ? void 0 : _o.analyteNameNormalized,
            (_p = byRaw.globulinas) === null || _p === void 0 ? void 0 : _p.analyteNameNormalized,
            (_q = byRaw['inmunoglobulina a']) === null || _q === void 0 ? void 0 : _q.analyteNameNormalized,
            (_r = byRaw['inmunoglobulina g']) === null || _r === void 0 ? void 0 : _r.analyteNameNormalized,
            (_s = byRaw['inmunoglobulina m']) === null || _s === void 0 ? void 0 : _s.analyteNameNormalized,
        ];
        expect(new Set(keyDisplayNames).size).toBe(keyDisplayNames.length);
        const rawNames = parsed.map((p) => p.analyteNameRaw.toLowerCase());
        expect(rawNames).toContain('eosinófilos');
        expect(rawNames).toContain('eosinófilos (absoluto)');
        expect(rawNames).toContain('linfocitos');
        expect(rawNames).toContain('linfocitos (absoluto)');
    });
    it('does not match Colesterol alias to lipid subtypes', () => {
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Colesterol', 'Colesterol HDL')).toBe(false);
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Colesterol', 'Colesterol LDL')).toBe(false);
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Colesterol', 'VLDL colesterol')).toBe(false);
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Colesterol', 'Colesterol no-HDL')).toBe(false);
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Colesterol', 'Colesterol')).toBe(true);
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Colesterol HDL', 'Colesterol HDL')).toBe(true);
        expect((0, labNormalization_service_1.aliasMatchesAnalyteName)('Colesterol HDL', 'Colesterol no-HDL')).toBe(false);
    });
    it('distinguishes CHOPO cholesterol subtypes without name collapse', () => {
        for (const [raw, id, display] of [
            ['Colesterol', 'cat-ct', 'Colesterol total'],
            ['Colesterol HDL', 'cat-hdl', 'Colesterol HDL'],
            ['Colesterol LDL', 'cat-ldl', 'Colesterol LDL'],
            ['VLDL colesterol', 'cat-vldl', 'VLDL colesterol'],
            ['Colesterol no-HDL', 'cat-nhdl', 'Colesterol no-HDL'],
        ]) {
            const normalized = (0, labNormalization_service_1.normalizeParsedLine)(baseLine({
                analyteNameRaw: raw,
                resultValue: 100,
                resultUnit: 'mg/dL',
            }), lipidCatalog);
            expect(normalized.analyteCatalogId).toBe(id);
            expect(normalized.analyteNameNormalized).toBe(display);
        }
    });
    it('normalizes CHOPO cholesterol panel without name collapse', () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const text = fs_1.default.readFileSync(chopoCholesterolFixturePath, 'utf8');
        const parsed = (0, labParser_service_1.parseLabResultsFromText)(text);
        const normalized = parsed.map((line) => (0, labNormalization_service_1.normalizeParsedLine)(line, lipidCatalog));
        const byRaw = Object.fromEntries(normalized.map((n) => [n.analyteNameRaw.toLowerCase(), n]));
        expect((_a = byRaw.colesterol) === null || _a === void 0 ? void 0 : _a.analyteNameNormalized).toBe('Colesterol total');
        expect((_b = byRaw.colesterol) === null || _b === void 0 ? void 0 : _b.analyteCatalogId).toBe('cat-ct');
        expect((_c = byRaw.colesterol) === null || _c === void 0 ? void 0 : _c.resultValue).toBeCloseTo(237);
        expect((_d = byRaw['colesterol hdl']) === null || _d === void 0 ? void 0 : _d.analyteNameNormalized).toBe('Colesterol HDL');
        expect((_e = byRaw['colesterol hdl']) === null || _e === void 0 ? void 0 : _e.analyteCatalogId).toBe('cat-hdl');
        expect((_f = byRaw['colesterol hdl']) === null || _f === void 0 ? void 0 : _f.resultValue).toBeCloseTo(41);
        expect((_g = byRaw['colesterol ldl']) === null || _g === void 0 ? void 0 : _g.analyteNameNormalized).toBe('Colesterol LDL');
        expect((_h = byRaw['colesterol ldl']) === null || _h === void 0 ? void 0 : _h.analyteCatalogId).toBe('cat-ldl');
        expect((_j = byRaw['colesterol ldl']) === null || _j === void 0 ? void 0 : _j.resultValue).toBeCloseTo(169);
        expect((_k = byRaw['vldl colesterol']) === null || _k === void 0 ? void 0 : _k.analyteNameNormalized).toBe('VLDL colesterol');
        expect((_l = byRaw['vldl colesterol']) === null || _l === void 0 ? void 0 : _l.analyteCatalogId).toBe('cat-vldl');
        expect((_m = byRaw['vldl colesterol']) === null || _m === void 0 ? void 0 : _m.resultValue).toBeCloseTo(41);
        expect((_o = byRaw['colesterol no-hdl']) === null || _o === void 0 ? void 0 : _o.analyteNameNormalized).toBe('Colesterol no-HDL');
        expect((_p = byRaw['colesterol no-hdl']) === null || _p === void 0 ? void 0 : _p.analyteCatalogId).toBe('cat-nhdl');
        expect((_q = byRaw['colesterol no-hdl']) === null || _q === void 0 ? void 0 : _q.resultValue).toBeCloseTo(196);
        const displayNames = normalized
            .filter((n) => n.analyteNameRaw.toLowerCase().includes('colesterol') || n.analyteNameRaw.toLowerCase().includes('vldl'))
            .map((n) => n.analyteNameNormalized);
        expect(new Set(displayNames).size).toBe(displayNames.length);
    });
    it('normalizes 2012 CHOPO lipid panel without Magnesio mislabeling', () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const text = fs_1.default.readFileSync(path_1.default.join(__dirname, 'fixtures', 'chopoLipidPanel2012LabText.txt'), 'utf8');
        const parsed = (0, labParser_service_1.parseLabResultsFromText)(text);
        const normalized = parsed.map((line) => (0, labNormalization_service_1.normalizeParsedLine)(line, lipidCatalog));
        const byRaw = Object.fromEntries(normalized.map((n) => [n.analyteNameRaw.toLowerCase(), n]));
        expect(parsed).toHaveLength(6);
        expect(normalized.every((n) => n.analyteNameNormalized !== 'Magnesio')).toBe(true);
        expect((_a = byRaw.colesterol) === null || _a === void 0 ? void 0 : _a.analyteNameNormalized).toBe('Colesterol total');
        expect((_b = byRaw.colesterol) === null || _b === void 0 ? void 0 : _b.analyteCatalogId).toBe('cat-ct');
        expect((_c = byRaw.colesterol) === null || _c === void 0 ? void 0 : _c.resultValue).toBeCloseTo(260);
        expect((_d = byRaw.colesterol) === null || _d === void 0 ? void 0 : _d.abnormalFlag).toBe('high');
        expect((_e = byRaw['colesterol hdl']) === null || _e === void 0 ? void 0 : _e.analyteNameNormalized).toBe('Colesterol HDL');
        expect((_f = byRaw['colesterol ldl']) === null || _f === void 0 ? void 0 : _f.analyteNameNormalized).toBe('Colesterol LDL');
        expect((_g = byRaw['colesterol no-hdl']) === null || _g === void 0 ? void 0 : _g.analyteNameNormalized).toBe('Colesterol no-HDL');
        expect((_h = byRaw.triglicéridos) === null || _h === void 0 ? void 0 : _h.analyteNameNormalized).toBe('Triglicéridos');
        expect((_j = byRaw['índice aterogénico']) === null || _j === void 0 ? void 0 : _j.analyteNameNormalized).toBe('Índice aterogénico');
        expect((_k = byRaw['índice aterogénico']) === null || _k === void 0 ? void 0 : _k.analyteCatalogId).toBe('cat-ai');
        expect((_l = byRaw['índice aterogénico']) === null || _l === void 0 ? void 0 : _l.resultValue).toBeCloseTo(5.8);
        expect((_m = byRaw['índice aterogénico']) === null || _m === void 0 ? void 0 : _m.referenceRangeHigh).toBeCloseTo(4.5);
        expect((_o = byRaw['índice aterogénico']) === null || _o === void 0 ? void 0 : _o.abnormalFlag).toBe('high');
    });
});
