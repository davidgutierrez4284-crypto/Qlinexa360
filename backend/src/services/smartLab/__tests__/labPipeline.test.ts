import fs from 'fs';
import path from 'path';
import { classifyLabDocument } from '../pipeline/documentClassifier.service';
import { validateParameterCandidate } from '../pipeline/clinicalValidator.service';
import { runLabExtractionPipeline } from '../pipeline/labPipeline.service';
import { candidateFromParsedLine } from '../pipeline/labParser.interface';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('documentClassifier', () => {
  it('classifies CHOPO reports', () => {
    const text = loadFixture('chopoLabText.txt');
    const doc = classifyLabDocument(text);
    expect(doc.vendor).toBe('chopo');
    expect(doc.laboratoryName).toBe('CHOPO');
  });

  it('classifies Salud Digna reports', () => {
    const doc = classifyLabDocument(loadFixture('saludDignaLabText.txt'));
    expect(doc.vendor).toBe('salud_digna');
  });

  it('classifies LAPI reports', () => {
    const doc = classifyLabDocument(loadFixture('lapiLabText.txt'));
    expect(doc.vendor).toBe('lapi');
  });

  it('classifies OLAB reports', () => {
    const doc = classifyLabDocument(loadFixture('olabLabText.txt'));
    expect(doc.vendor).toBe('olab');
  });

  it('classifies Laboratorios Ruiz reports', () => {
    const doc = classifyLabDocument(loadFixture('laboratoriosRuizLabText.txt'));
    expect(doc.vendor).toBe('laboratorios_ruiz');
  });

  it('classifies Carpermor reports', () => {
    const doc = classifyLabDocument(loadFixture('carpermorLabText.txt'));
    expect(doc.vendor).toBe('carpermor');
  });

  it('classifies Biomédica reports', () => {
    const doc = classifyLabDocument(loadFixture('biomedicaFullPanel2025LabText.txt'));
    expect(doc.vendor).toBe('biomedica');
    expect(doc.laboratoryName).toMatch(/Biom[eé]dica/i);
  });
});

describe('clinicalValidator', () => {
  it('rejects plaquetas with mg/dL', () => {
    const row = validateParameterCandidate(
      candidateFromParsedLine({
        rawName: 'Plaquetas',
        value: 250000,
        valueText: '250000',
        unit: 'mg/dL',
        referenceLow: null,
        referenceHigh: null,
        referenceText: null,
        sourceLines: [],
        confidence: 0.9,
      })
    );
    expect(row.validationErrors.length).toBeGreaterThan(0);
    expect(row.confidence).toBeLessThan(0.9);
  });

  it('accepts glucosa with mg/dL', () => {
    const row = validateParameterCandidate(
      candidateFromParsedLine({
        rawName: 'Glucosa',
        value: 90,
        valueText: '90',
        unit: 'mg/dL',
        referenceLow: 70,
        referenceHigh: 100,
        referenceText: '70-100',
        sourceLines: [],
        confidence: 0.9,
      })
    );
    expect(row.validationErrors).toHaveLength(0);
  });
});

describe('lab extraction pipeline', () => {
  const cases: Array<{ fixture: string; vendor: string; analyte: string }> = [
    { fixture: 'chopoLabText.txt', vendor: 'chopo', analyte: 'glucosa' },
    { fixture: 'chopoBiometriaHematicaMateo2017LabText.txt', vendor: 'chopo', analyte: 'hemoglobina' },
    { fixture: 'chopoQuimica4Elementos2018LabText.txt', vendor: 'chopo', analyte: 'glucosa' },
    { fixture: 'chopoQuimica45Elementos2020LabText.txt', vendor: 'chopo', analyte: 'sodio' },
    { fixture: 'chopoUrocultivoBiometria35elementos2017LabText.txt', vendor: 'chopo', analyte: 'creatinina' },
    { fixture: 'chopoUrocultivo45Elementos2020LabText.txt', vendor: 'chopo', analyte: 'colesterol' },
    { fixture: 'chopoBiometriaYQuimicaLabText.txt', vendor: 'chopo', analyte: 'plaquetas' },
    { fixture: 'saludDignaLabText.txt', vendor: 'salud_digna', analyte: 'glucosa' },
    { fixture: 'saludDignaFullPanel2025LabText.txt', vendor: 'salud_digna', analyte: 'leucocitos' },
    { fixture: 'lapiLabText.txt', vendor: 'lapi', analyte: 'colesterol' },
    { fixture: 'olabLabText.txt', vendor: 'olab', analyte: 'hemoglobina' },
    { fixture: 'laboratoriosRuizLabText.txt', vendor: 'laboratorios_ruiz', analyte: 'potasio' },
    { fixture: 'carpermorLabText.txt', vendor: 'carpermor', analyte: 'ast' },
  ];

  it.each(cases)('parses $fixture with vendor $vendor', async ({ fixture, vendor, analyte }) => {
    const result = await runLabExtractionPipeline(loadFixture(fixture), 'pdf-parse');
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

    const result = await runLabExtractionPipeline(text, 'pdf-parse');
    const names = result.candidates.map((c) => c.rawName.toLowerCase());

    expect(names.some((n) => n.includes('insulina'))).toBe(true);
    expect(names.some((n) => n.includes('vitamina d'))).toBe(true);
    expect(names.filter((n) => n === 'sodio')).toHaveLength(0);
  });

  it('parses 2012 CHOPO lipid panel with dot-prefixed unit lines end-to-end', async () => {
    const result = await runLabExtractionPipeline(
      loadFixture('chopoLipidPanel2012LabText.txt'),
      'pdf-parse'
    );
    const byName = Object.fromEntries(result.candidates.map((c) => [c.rawName.toLowerCase(), c]));

    expect(result.classification.vendor).toBe('chopo');
    expect(result.trace.parserUsed).toBe('ChopoStackedParser');
    expect(result.candidates).toHaveLength(6);
    expect(byName.colesterol?.value).toBeCloseTo(260);
    expect(byName.colesterol?.unit).toMatch(/mg\/dL/i);
    expect(byName.colesterol?.referenceHigh).toBeCloseTo(200);
    expect(byName['colesterol hdl']?.referenceLow).toBeCloseTo(60);
    expect(byName['índice aterogénico']?.value).toBeCloseTo(5.8);
    expect(byName['índice aterogénico']?.referenceHigh).toBeCloseTo(4.5);
    expect(result.candidates.some((c) => /mg\/dl/i.test(c.rawName))).toBe(false);
    expect(result.candidates.some((c) => /q\.f\.b|c[eé]dula/i.test(c.rawName))).toBe(false);
  });

  it('parses LAPI biometria hematica tabular report with correct study date', async () => {
    const result = await runLabExtractionPipeline(
      loadFixture('lapiBiometriaHematica2025LabText.txt'),
      'pdf-parse'
    );
    const byName = Object.fromEntries(result.candidates.map((c) => [c.rawName.toLowerCase(), c]));

    expect(result.classification.vendor).toBe('lapi');
    expect(result.trace.parserUsed).toBe('LapiParser');
    expect(result.trace.parserUsed).not.toBe('GenericRegexParser');
    expect(result.candidates.length).toBeGreaterThanOrEqual(20);
    expect(byName.eritrocitos?.value).toBeCloseTo(5.07);
    expect(byName.hemoglobina?.value).toBeCloseTo(15.2);
    expect(byName.hematocrito?.value).toBeCloseTo(45.6);
    expect(byName.leucocitos?.value).toBeCloseTo(5.7);
    expect(byName.plaquetas?.value).toBeCloseTo(245);
    expect(result.candidates.some((c) => /city\s*shops/i.test(c.rawName))).toBe(false);
    expect(result.candidates.some((c) => c.value === 749109)).toBe(false);
    expect(result.metadata.studyDate?.getFullYear()).toBe(2025);
    expect(result.metadata.studyDate?.getMonth()).toBe(11);
    expect(result.metadata.studyDate?.getDate()).toBe(19);
    expect(result.metadata.studyDate?.getFullYear()).not.toBe(1988);
  });

  it('does not route classified CHOPO reports to GenericRegexParser on footer-only text', async () => {
    const text = [
      'www.chopo.com.mx',
      'GRUPO DIAGNÓSTICO MÉDICO PROA S.A. DE C.V.',
      'PERFIL DE LIPIDOS EN SUERO',
      'Responsable del Laboratorio',
      'Q.F.B Mario García Sánchez Cédula Profesional 895854',
    ].join('\n');

    const result = await runLabExtractionPipeline(text, 'pdf-parse');
    expect(result.classification.vendor).toBe('chopo');
    expect(result.trace.parserUsed).toBe('ChopoStackedParser');
    expect(result.trace.parserUsed).not.toBe('GenericRegexParser');
    expect(result.candidates).toHaveLength(0);
  });
});
