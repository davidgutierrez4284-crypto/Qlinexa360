import fs from 'fs';
import path from 'path';
import {
  dashboardCategoryLabel,
  mapCatalogCategoryToDashboard,
  normalizeParsedLine,
  aliasMatchesAnalyteName,
} from '../labNormalization.service';
import { parseLabResultsFromText } from '../labParser.service';
import type { ParsedLabLine } from '../labParser.service';

const chopoPanelFixturePath = path.join(
  __dirname,
  'fixtures',
  'chopoHemoglobinImmunoglobulinPanel.txt'
);

const chopoCholesterolFixturePath = path.join(
  __dirname,
  'fixtures',
  'chopoCholesterolPanel.txt'
);

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

const baseLine = (overrides: Partial<ParsedLabLine> = {}): ParsedLabLine => ({
  analyteNameRaw: 'Glucosa',
  resultValue: 110,
  resultValueText: '110',
  resultUnit: 'mg/dL',
  referenceRangeLow: null,
  referenceRangeHigh: null,
  referenceRangeText: null,
  rawTextSnippet: 'Glucosa 110 mg/dL',
  confidence: 0.8,
  ...overrides,
});

describe('labNormalization', () => {
  it('maps catalog category aliases to dashboard keys', () => {
    expect(mapCatalogCategoryToDashboard('Biometria hematica')).toBe('hematologia');
    expect(mapCatalogCategoryToDashboard('Perfil lipidico')).toBe('perfil_lipidico');
  });

  it('matches catalog entry by name or alias', () => {
    const normalized = normalizeParsedLine(baseLine({ analyteNameRaw: 'Glu' }), catalog);
    expect(normalized.analyteCatalogId).toBe('cat-glucosa');
    expect(normalized.analyteNameNormalized).toBe('Glucosa');
    expect(normalized.referenceRangeLow).toBe(70);
    expect(normalized.referenceRangeHigh).toBe(100);
    expect(normalized.abnormalFlag).toBe('high');
  });

  it('returns otros when no catalog match', () => {
    const normalized = normalizeParsedLine(baseLine({ analyteNameRaw: 'Parametro raro' }), catalog);
    expect(normalized.analyteCatalogId).toBeNull();
    expect(normalized.dashboardCategory).toBe('otros');
  });

  it('dashboardCategoryLabel falls back to otros label', () => {
    expect(dashboardCategoryLabel('hematologia')).toContain('Hemat');
    expect(dashboardCategoryLabel('unknown_key')).toBeTruthy();
  });

  it('does not match Insulina basal to short alias Na (Sodio)', () => {
    expect(aliasMatchesAnalyteName('Na', 'Insulina basal')).toBe(false);
    expect(aliasMatchesAnalyteName('Na', 'Sodio')).toBe(true);
    expect(aliasMatchesAnalyteName('Insulina basal', 'Insulina basal')).toBe(true);
  });

  it('does not match Mg alias to mg/dL unit token', () => {
    expect(aliasMatchesAnalyteName('Mg', 'mg/dL')).toBe(false);
    expect(aliasMatchesAnalyteName('Mg', 'Magnesio')).toBe(true);
    expect(aliasMatchesAnalyteName('Mg', 'Colesterol')).toBe(false);
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
    const normalized = normalizeParsedLine(
      baseLine({
        analyteNameRaw: 'Insulina basal',
        resultValue: 14.68,
        resultValueText: '14.68',
        resultUnit: 'μUI/mL',
        referenceRangeLow: 2.6,
        referenceRangeHigh: 24.9,
      }),
      fullCatalog
    );
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
    const normalized = normalizeParsedLine(
      baseLine({
        analyteNameRaw: 'Vitamina D (25 Hidroxi)',
        resultValue: 38.47,
        resultValueText: '38.47',
        resultUnit: 'ng/mL',
        referenceRangeLow: 30,
        referenceRangeHigh: 100,
      }),
      vitDCatalog
    );
    expect(normalized.analyteNameNormalized).toBe('Vitamina D');
    expect(normalized.analyteCatalogId).toBe('cat-vitd');
    expect(normalized.abnormalFlag).toBe('normal');
  });

  it('does not match Globulina alias inside Inmunoglobulina', () => {
    expect(aliasMatchesAnalyteName('Globulina', 'Inmunoglobulina A')).toBe(false);
    expect(aliasMatchesAnalyteName('Globulina', 'Globulinas')).toBe(true);
    expect(aliasMatchesAnalyteName('Inmunoglobulina A', 'Inmunoglobulina A')).toBe(true);
  });

  it('distinguishes Hemoglobina, HCM and HbA1c from CHOPO-style names', () => {
    const hb = normalizeParsedLine(
      baseLine({
        analyteNameRaw: 'Hemoglobina',
        resultValue: 16.9,
        resultUnit: 'g/dL',
        referenceRangeLow: 14,
        referenceRangeHigh: 18,
      }),
      hematologyCatalog
    );
    expect(hb.analyteCatalogId).toBe('cat-hb');
    expect(hb.analyteNameNormalized).toBe('Hemoglobina');

    const hcm = normalizeParsedLine(
      baseLine({
        analyteNameRaw: 'Hemoglobina Corp. Media',
        resultValue: 30.1,
        resultUnit: 'pg',
        referenceRangeLow: 27,
        referenceRangeHigh: 31,
      }),
      hematologyCatalog
    );
    expect(hcm.analyteCatalogId).toBe('cat-hcm');
    expect(hcm.analyteNameNormalized).toBe('Hemoglobina Corp. Media');

    const hba1c = normalizeParsedLine(
      baseLine({
        analyteNameRaw: 'Hemoglobina glicosilada A1c',
        resultValue: 5.9,
        resultUnit: '%',
        referenceRangeLow: 4,
        referenceRangeHigh: 6,
      }),
      hematologyCatalog
    );
    expect(hba1c.analyteCatalogId).toBe('cat-hba1c');
    expect(hba1c.analyteNameNormalized).toBe('Hemoglobina glicosilada A1c');
  });

  it('maps immunoglobulins to distinct catalog entries, not Globulina', () => {
    for (const [raw, id, display] of [
      ['Inmunoglobulina A', 'cat-iga', 'Inmunoglobulina A'],
      ['Inmunoglobulina G', 'cat-igg', 'Inmunoglobulina G'],
      ['Inmunoglobulina M', 'cat-igm', 'Inmunoglobulina M'],
    ] as const) {
      const normalized = normalizeParsedLine(
        baseLine({
          analyteNameRaw: raw,
          resultValue: 100,
          resultUnit: 'mg/dL',
          referenceRangeLow: 40,
          referenceRangeHigh: 400,
        }),
        hematologyCatalog
      );
      expect(normalized.analyteCatalogId).toBe(id);
      expect(normalized.analyteNameNormalized).toBe(display);
    }

    const globulinas = normalizeParsedLine(
      baseLine({
        analyteNameRaw: 'Globulinas',
        resultValue: 2.7,
        resultUnit: 'g/dL',
        referenceRangeLow: 2.9,
        referenceRangeHigh: 3.1,
      }),
      hematologyCatalog
    );
    expect(globulinas.analyteCatalogId).toBe('cat-globulina');
    expect(globulinas.analyteNameNormalized).toBe('Globulina');
  });

  it('normalizes CHOPO hemoglobin/immunoglobulin panel without name collapse', () => {
    const text = fs.readFileSync(chopoPanelFixturePath, 'utf8');
    const parsed = parseLabResultsFromText(text);
    const normalized = parsed.map((line) => normalizeParsedLine(line, hematologyCatalog));
    const byRaw = Object.fromEntries(normalized.map((n) => [n.analyteNameRaw.toLowerCase(), n]));

    expect(byRaw.hemoglobina?.analyteNameNormalized).toBe('Hemoglobina');
    expect(byRaw.hemoglobina?.analyteCatalogId).toBe('cat-hb');

    expect(byRaw['hemoglobina corp. media']?.analyteNameNormalized).toBe('Hemoglobina Corp. Media');
    expect(byRaw['hemoglobina corp. media']?.analyteCatalogId).toBe('cat-hcm');

    expect(byRaw['hemoglobina glicosilada a1c']?.analyteNameNormalized).toBe('Hemoglobina glicosilada A1c');
    expect(byRaw['hemoglobina glicosilada a1c']?.analyteCatalogId).toBe('cat-hba1c');

    expect(byRaw.globulinas?.analyteNameNormalized).toBe('Globulina');
    expect(byRaw['inmunoglobulina a']?.analyteNameNormalized).toBe('Inmunoglobulina A');
    expect(byRaw['inmunoglobulina g']?.analyteNameNormalized).toBe('Inmunoglobulina G');
    expect(byRaw['inmunoglobulina m']?.analyteNameNormalized).toBe('Inmunoglobulina M');

    const keyDisplayNames = [
      byRaw.hemoglobina?.analyteNameNormalized,
      byRaw['hemoglobina corp. media']?.analyteNameNormalized,
      byRaw['hemoglobina glicosilada a1c']?.analyteNameNormalized,
      byRaw.globulinas?.analyteNameNormalized,
      byRaw['inmunoglobulina a']?.analyteNameNormalized,
      byRaw['inmunoglobulina g']?.analyteNameNormalized,
      byRaw['inmunoglobulina m']?.analyteNameNormalized,
    ];
    expect(new Set(keyDisplayNames).size).toBe(keyDisplayNames.length);

    const rawNames = parsed.map((p) => p.analyteNameRaw.toLowerCase());
    expect(rawNames).toContain('eosinófilos');
    expect(rawNames).toContain('eosinófilos (absoluto)');
    expect(rawNames).toContain('linfocitos');
    expect(rawNames).toContain('linfocitos (absoluto)');
  });

  it('does not match Colesterol alias to lipid subtypes', () => {
    expect(aliasMatchesAnalyteName('Colesterol', 'Colesterol HDL')).toBe(false);
    expect(aliasMatchesAnalyteName('Colesterol', 'Colesterol LDL')).toBe(false);
    expect(aliasMatchesAnalyteName('Colesterol', 'VLDL colesterol')).toBe(false);
    expect(aliasMatchesAnalyteName('Colesterol', 'Colesterol no-HDL')).toBe(false);
    expect(aliasMatchesAnalyteName('Colesterol', 'Colesterol')).toBe(true);
    expect(aliasMatchesAnalyteName('Colesterol HDL', 'Colesterol HDL')).toBe(true);
    expect(aliasMatchesAnalyteName('Colesterol HDL', 'Colesterol no-HDL')).toBe(false);
  });

  it('distinguishes CHOPO cholesterol subtypes without name collapse', () => {
    for (const [raw, id, display] of [
      ['Colesterol', 'cat-ct', 'Colesterol total'],
      ['Colesterol HDL', 'cat-hdl', 'Colesterol HDL'],
      ['Colesterol LDL', 'cat-ldl', 'Colesterol LDL'],
      ['VLDL colesterol', 'cat-vldl', 'VLDL colesterol'],
      ['Colesterol no-HDL', 'cat-nhdl', 'Colesterol no-HDL'],
    ] as const) {
      const normalized = normalizeParsedLine(
        baseLine({
          analyteNameRaw: raw,
          resultValue: 100,
          resultUnit: 'mg/dL',
        }),
        lipidCatalog
      );
      expect(normalized.analyteCatalogId).toBe(id);
      expect(normalized.analyteNameNormalized).toBe(display);
    }
  });

  it('normalizes CHOPO cholesterol panel without name collapse', () => {
    const text = fs.readFileSync(chopoCholesterolFixturePath, 'utf8');
    const parsed = parseLabResultsFromText(text);
    const normalized = parsed.map((line) => normalizeParsedLine(line, lipidCatalog));
    const byRaw = Object.fromEntries(normalized.map((n) => [n.analyteNameRaw.toLowerCase(), n]));

    expect(byRaw.colesterol?.analyteNameNormalized).toBe('Colesterol total');
    expect(byRaw.colesterol?.analyteCatalogId).toBe('cat-ct');
    expect(byRaw.colesterol?.resultValue).toBeCloseTo(237);

    expect(byRaw['colesterol hdl']?.analyteNameNormalized).toBe('Colesterol HDL');
    expect(byRaw['colesterol hdl']?.analyteCatalogId).toBe('cat-hdl');
    expect(byRaw['colesterol hdl']?.resultValue).toBeCloseTo(41);

    expect(byRaw['colesterol ldl']?.analyteNameNormalized).toBe('Colesterol LDL');
    expect(byRaw['colesterol ldl']?.analyteCatalogId).toBe('cat-ldl');
    expect(byRaw['colesterol ldl']?.resultValue).toBeCloseTo(169);

    expect(byRaw['vldl colesterol']?.analyteNameNormalized).toBe('VLDL colesterol');
    expect(byRaw['vldl colesterol']?.analyteCatalogId).toBe('cat-vldl');
    expect(byRaw['vldl colesterol']?.resultValue).toBeCloseTo(41);

    expect(byRaw['colesterol no-hdl']?.analyteNameNormalized).toBe('Colesterol no-HDL');
    expect(byRaw['colesterol no-hdl']?.analyteCatalogId).toBe('cat-nhdl');
    expect(byRaw['colesterol no-hdl']?.resultValue).toBeCloseTo(196);

    const displayNames = normalized
      .filter((n) => n.analyteNameRaw.toLowerCase().includes('colesterol') || n.analyteNameRaw.toLowerCase().includes('vldl'))
      .map((n) => n.analyteNameNormalized);
    expect(new Set(displayNames).size).toBe(displayNames.length);
  });

  it('normalizes 2012 CHOPO lipid panel without Magnesio mislabeling', () => {
    const text = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'chopoLipidPanel2012LabText.txt'),
      'utf8'
    );
    const parsed = parseLabResultsFromText(text);
    const normalized = parsed.map((line) => normalizeParsedLine(line, lipidCatalog));
    const byRaw = Object.fromEntries(normalized.map((n) => [n.analyteNameRaw.toLowerCase(), n]));

    expect(parsed).toHaveLength(6);
    expect(normalized.every((n) => n.analyteNameNormalized !== 'Magnesio')).toBe(true);

    expect(byRaw.colesterol?.analyteNameNormalized).toBe('Colesterol total');
    expect(byRaw.colesterol?.analyteCatalogId).toBe('cat-ct');
    expect(byRaw.colesterol?.resultValue).toBeCloseTo(260);
    expect(byRaw.colesterol?.abnormalFlag).toBe('high');

    expect(byRaw['colesterol hdl']?.analyteNameNormalized).toBe('Colesterol HDL');
    expect(byRaw['colesterol ldl']?.analyteNameNormalized).toBe('Colesterol LDL');
    expect(byRaw['colesterol no-hdl']?.analyteNameNormalized).toBe('Colesterol no-HDL');
    expect(byRaw.triglicéridos?.analyteNameNormalized).toBe('Triglicéridos');

    expect(byRaw['índice aterogénico']?.analyteNameNormalized).toBe('Índice aterogénico');
    expect(byRaw['índice aterogénico']?.analyteCatalogId).toBe('cat-ai');
    expect(byRaw['índice aterogénico']?.resultValue).toBeCloseTo(5.8);
    expect(byRaw['índice aterogénico']?.referenceRangeHigh).toBeCloseTo(4.5);
    expect(byRaw['índice aterogénico']?.abnormalFlag).toBe('high');
  });
});
