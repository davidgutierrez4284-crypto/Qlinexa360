import fs from 'fs';
import path from 'path';
import { classifyLabDocument } from '../pipeline/documentClassifier.service';
import { parseStudyMetadataFromText } from '../labMetadata.service';
import { runLabExtractionPipeline } from '../pipeline/labPipeline.service';
import {
  laboratorioPolancoParser,
  parseLaboratorioPolancoResults,
} from '../pipeline/parsers/laboratorioPolanco.parser';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('Laboratorio Médico Polanco parser', () => {
  const fixture = 'laboratorioPolancoBiometriaQuimica2026LabText.txt';

  it('classifies real LMP report without logo text', () => {
    const text = loadFixture(fixture);
    const doc = classifyLabDocument(text);
    expect(doc.vendor).toBe('laboratorio_polanco');
    expect(doc.laboratoryName).toMatch(/Laboratorio M[eé]dico Polanco/i);
  });

  it('uses Toma (not Nacimiento) as study date and Impresión as report date', () => {
    const text = loadFixture(fixture);
    const meta = parseStudyMetadataFromText(text);
    expect(meta.laboratoryName).toMatch(/Laboratorio M[eé]dico Polanco/i);
    expect(meta.studyDate?.getFullYear()).toBe(2026);
    expect(meta.studyDate?.getMonth()).toBe(6); // julio
    expect(meta.studyDate?.getDate()).toBe(13);
    expect(meta.studyDate?.getFullYear()).not.toBe(1944);

    expect(meta.reportDate?.getFullYear()).toBe(2026);
    expect(meta.reportDate?.getMonth()).toBe(6);
    expect(meta.reportDate?.getDate()).toBe(14);
  });

  it('parses BIOMETRIA HEMATICA rows with value/unit/reference range', () => {
    const text = loadFixture(fixture);
    const rows = parseLaboratorioPolancoResults(text);

    const leucocitos = rows.find((r) => /^leucocitos$/i.test(r.rawName));
    expect(leucocitos?.value).toBeCloseTo(8.0);
    expect(leucocitos?.unit).toMatch(/10\^3\/μL/i);
    expect(leucocitos?.referenceLow).toBeCloseTo(3.84);
    expect(leucocitos?.referenceHigh).toBeCloseTo(9.79);

    const eritrocitos = rows.find((r) => /^eritrocitos$/i.test(r.rawName));
    expect(eritrocitos?.value).toBeCloseTo(4.38);
    expect(eritrocitos?.referenceLow).toBeCloseTo(4.39);
    expect(eritrocitos?.referenceHigh).toBeCloseTo(6.1);

    const hemoglobina = rows.find((r) => /^hemoglobina$/i.test(r.rawName));
    expect(hemoglobina?.value).toBeCloseTo(12.2);
    expect(hemoglobina?.unit).toMatch(/g\/dL/i);
    expect(hemoglobina?.referenceLow).toBeCloseTo(13.8);
    expect(hemoglobina?.referenceHigh).toBeCloseTo(18.5);
    // Bajo el intervalo de referencia (13.8 - 18.5)
    expect(hemoglobina!.value! < hemoglobina!.referenceLow!).toBe(true);

    const plaquetas = rows.find((r) => /^plaquetas$/i.test(r.rawName));
    expect(plaquetas?.value).toBeCloseTo(259.0);
    expect(plaquetas?.unit).toMatch(/10\^3\/μL/i);

    const neutrofilos = rows.find((r) => /^neutrofilos$/i.test(r.rawName));
    expect(neutrofilos?.value).toBeCloseTo(85.6);
    expect(neutrofilos?.unit).toMatch(/%/);
    expect(neutrofilos!.value! > neutrofilos!.referenceHigh!).toBe(true);

    const linfocitos = rows.find((r) => /^linfocitos$/i.test(r.rawName));
    expect(linfocitos?.value).toBeCloseTo(3.2);
    expect(linfocitos!.value! < linfocitos!.referenceLow!).toBe(true);

    const monocitos = rows.find((r) => /^monocitos$/i.test(r.rawName));
    expect(monocitos?.value).toBeCloseTo(10.7);
    expect(monocitos!.value! > monocitos!.referenceHigh!).toBe(true);

    const eosinofilos = rows.find((r) => /^eosinofilos$/i.test(r.rawName));
    expect(eosinofilos?.value).toBeCloseTo(0.2);
    expect(eosinofilos!.value! < eosinofilos!.referenceLow!).toBe(true);

    const basofilos = rows.find((r) => /^basofilos$/i.test(r.rawName));
    expect(basofilos?.value).toBeCloseTo(0.3);

    const neutrofilosAbs = rows.find((r) => /^neutrofilos absolutos$/i.test(r.rawName));
    expect(neutrofilosAbs?.value).toBeCloseTo(6.85);
    expect(neutrofilosAbs?.unit).toMatch(/10\^3\/μL/i);

    const linfocitosAbs = rows.find((r) => /^linfocitos absolutos$/i.test(r.rawName));
    expect(linfocitosAbs?.value).toBeCloseTo(0.26);
  });

  it('captures FROTIS as free-text morphology note', () => {
    const text = loadFixture(fixture);
    const rows = parseLaboratorioPolancoResults(text);
    const frotis = rows.find((r) => /^frotis$/i.test(r.rawName));
    expect(frotis?.value).toBeNull();
    expect(frotis?.valueText).toMatch(/poiquilocitosis/i);
    expect(frotis?.valueText).toMatch(/no se observaron formas inmaduras/i);
  });

  it('parses PROCALCITONINA with an upper-bound reference', () => {
    const text = loadFixture(fixture);
    const rows = parseLaboratorioPolancoResults(text);
    const pct = rows.find((r) => /^procalcitonina$/i.test(r.rawName));
    expect(pct?.value).toBeCloseTo(0.33);
    expect(pct?.unit).toMatch(/ng\/ml/i);
    expect(pct?.referenceLow).toBeNull();
    expect(pct?.referenceHigh).toBeCloseTo(0.5);
  });

  it('parses QUIMICA SANGUINEA DE 6 ELEMENTOS rows including multi-tier reference text', () => {
    const text = loadFixture(fixture);
    const rows = parseLaboratorioPolancoResults(text);

    const glucosa = rows.find((r) => /^glucosa$/i.test(r.rawName));
    expect(glucosa?.value).toBeCloseTo(198);
    expect(glucosa?.unit).toMatch(/mg\/dL/i);
    expect(glucosa?.referenceLow).toBeCloseTo(70);
    expect(glucosa?.referenceHigh).toBeCloseTo(99);
    expect(glucosa?.referenceText).toMatch(/diabetes/i);
    expect(glucosa!.value! > glucosa!.referenceHigh!).toBe(true);

    const urea = rows.find((r) => /^nitrogeno de urea$/i.test(r.rawName));
    expect(urea?.value).toBeCloseTo(22.4);
    expect(urea?.referenceLow).toBeCloseTo(7);
    expect(urea?.referenceHigh).toBeCloseTo(25);
    expect(urea?.unit).toMatch(/mg\/dL/i);

    const creatinina = rows.find((r) => /^creatinina$/i.test(r.rawName));
    expect(creatinina?.value).toBeCloseTo(1.1);
    expect(creatinina?.referenceLow).toBeCloseTo(0.6);
    expect(creatinina?.referenceHigh).toBeCloseTo(1.3);

    const relacion = rows.find((r) => /relacion nitrogeno ureico\/creatinina/i.test(r.rawName));
    expect(relacion?.value).toBeCloseTo(20.4);
    expect(relacion?.referenceLow).toBeCloseTo(10);
    expect(relacion?.referenceHigh).toBeCloseTo(20);

    const acidoUrico = rows.find((r) => /^acido urico$/i.test(r.rawName));
    expect(acidoUrico?.value).toBeCloseTo(7.4);
    expect(acidoUrico?.referenceLow).toBeCloseTo(4.4);
    expect(acidoUrico?.referenceHigh).toBeCloseTo(7.6);

    const colesterol = rows.find((r) => /^colesterol total$/i.test(r.rawName));
    expect(colesterol?.value).toBeCloseTo(152);
    expect(colesterol?.referenceHigh).toBeCloseTo(200);
    expect(colesterol?.unit).toMatch(/mg\/dL/i);

    const trigliceridos = rows.find((r) => /^trigliceridos$/i.test(r.rawName));
    expect(trigliceridos?.value).toBeCloseTo(111);
    expect(trigliceridos?.referenceHigh).toBeCloseTo(150);
  });

  it('parses PROTEINA C REACTIVA as high with upper-bound reference', () => {
    const text = loadFixture(fixture);
    const rows = parseLaboratorioPolancoResults(text);
    const pcr = rows.find((r) => /^proteina c reactiva$/i.test(r.rawName));
    expect(pcr?.value).toBeCloseTo(135.4);
    expect(pcr?.unit).toMatch(/mg\/L/i);
    expect(pcr?.referenceHigh).toBeCloseTo(10);
    expect(pcr!.value! > pcr!.referenceHigh!).toBe(true);
  });

  it('does not leak section titles or footer/accreditation noise as analytes', () => {
    const text = loadFixture(fixture);
    const rows = parseLaboratorioPolancoResults(text);
    expect(rows.some((r) => /^biometria hematica$/i.test(r.rawName))).toBe(false);
    expect(rows.some((r) => /^quimica sanguinea/i.test(r.rawName))).toBe(false);
    expect(rows.some((r) => /ced\.\s*profesional/i.test(r.rawName))).toBe(false);
    expect(rows.some((r) => /q\.f\.b\./i.test(r.rawName))).toBe(false);
    expect(rows.some((r) => /acreditad/i.test(r.rawName))).toBe(false);
  });

  it('returns a rich candidate set via the registered parser', () => {
    const text = loadFixture(fixture);
    const rows = laboratorioPolancoParser.parse(text);
    expect(rows.length).toBeGreaterThanOrEqual(20);
  });

  it('runs full pipeline with LaboratorioPolancoParser', async () => {
    const text = loadFixture(fixture);
    const result = await runLabExtractionPipeline(text, 'pdf-parse');
    expect(result.classification.vendor).toBe('laboratorio_polanco');
    expect(result.trace.parserUsed).toBe('LaboratorioPolancoParser');
    expect(result.candidates.length).toBeGreaterThanOrEqual(20);
    expect(result.metadata.laboratoryName).toMatch(/Laboratorio M[eé]dico Polanco/i);
    expect(result.metadata.studyDate?.getFullYear()).toBe(2026);
    expect(result.candidates.some((c) => /^glucosa$/i.test(c.rawName))).toBe(true);
    expect(result.candidates.some((c) => /^proteina c reactiva$/i.test(c.rawName))).toBe(true);
  });
});
