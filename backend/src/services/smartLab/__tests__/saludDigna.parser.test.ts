import fs from 'fs';
import path from 'path';
import { classifyLabDocument } from '../pipeline/documentClassifier.service';
import { parseStudyMetadataFromText } from '../labMetadata.service';
import { runLabExtractionPipeline } from '../pipeline/labPipeline.service';
import {
  parseSaludDignaFriskResults,
  parseSaludDignaResults,
  saludDignaParser,
} from '../pipeline/parsers/saludDigna.parser';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('Salud Digna parser', () => {
  it('classifies real Salud Digna panel without logo text', () => {
    const text = loadFixture('saludDignaFullPanel2025LabText.txt');
    const doc = classifyLabDocument(text);
    expect(doc.vendor).toBe('salud_digna');
    expect(doc.laboratoryName).toMatch(/Salud Digna/i);
  });

  it('keeps legacy stacked fixture classified as salud_digna', () => {
    const doc = classifyLabDocument(loadFixture('saludDignaLabText.txt'));
    expect(doc.vendor).toBe('salud_digna');
  });

  it('uses Fecha de Toma (not birth date) as study date', () => {
    const text = loadFixture('saludDignaFullPanel2025LabText.txt');
    const meta = parseStudyMetadataFromText(text);
    expect(meta.laboratoryName).toMatch(/Salud Digna/i);
    expect(meta.studyDate?.getFullYear()).toBe(2025);
    expect(meta.studyDate?.getMonth()).toBe(8); // septiembre
    expect(meta.studyDate?.getDate()).toBe(11);
    expect(meta.studyDate?.getFullYear()).not.toBe(1942);
  });

  it('parses biometría hemática glued name+value / unit+range lines', () => {
    const text = loadFixture('saludDignaFullPanel2025LabText.txt');
    const rows = parseSaludDignaResults(text);
    const leucocitos = rows.find(
      (r) => /^leucocitos$/i.test(r.rawName.trim()) && /10\^3/i.test(r.unit || '')
    );
    expect(leucocitos?.value).toBeCloseTo(5.6);
    expect(leucocitos?.referenceLow).toBeCloseTo(3.98);
    expect(leucocitos?.referenceHigh).toBeCloseTo(10.04);

    const eritrocitos = rows.find((r) => /^eritrocitos$/i.test(r.rawName.trim()));
    expect(eritrocitos?.value).toBeCloseTo(4.22);
    expect(rows.find((r) => /^hemoglobina$/i.test(r.rawName.trim()))?.value).toBeCloseTo(13.5);
    expect(rows.find((r) => /^hematocrito$/i.test(r.rawName.trim()))?.value).toBeCloseTo(40.4);
    expect(rows.find((r) => /^plaquetas$/i.test(r.rawName.trim()))?.value).toBeCloseTo(349);

    const vcm = rows.find((r) => /volumen corpuscular medio/i.test(r.rawName));
    expect(vcm?.value).toBeCloseTo(95.7);
    expect(vcm?.unit).toMatch(/fL/i);
    expect(vcm?.referenceLow).toBeCloseTo(79.4);
  });

  it('parses chemistry rows glued on a single line', () => {
    const text = loadFixture('saludDignaFullPanel2025LabText.txt');
    const rows = parseSaludDignaResults(text);
    const glucosa = rows.find((r) => /^glucosa$/i.test(r.rawName.trim()));
    expect(glucosa?.value).toBeCloseTo(91.5);
    expect(glucosa?.unit).toMatch(/mg\/dL/i);
    expect(glucosa?.referenceLow).toBeCloseTo(82);
    expect(glucosa?.referenceHigh).toBeCloseTo(115);

    const creatinina = rows.find((r) => /creatinina/i.test(r.rawName));
    expect(creatinina?.value).toBeCloseTo(0.69);

    const colesterol = rows.find((r) => /colesterol total/i.test(r.rawName));
    expect(colesterol?.value).toBeCloseTo(183.5);
    expect(colesterol?.referenceHigh).toBeCloseTo(200);
  });

  it('parses thyroid and skips comparative summary page', () => {
    const text = loadFixture('saludDignaFullPanel2025LabText.txt');
    const rows = parseSaludDignaResults(text);
    const tsh = rows.find((r) => /^tsh\b/i.test(r.rawName.trim()));
    expect(tsh?.value).toBeCloseTo(1.99);
    expect(tsh?.unit).toMatch(/μUI\/mL|uUI\/mL|µUI\/mL/i);

    const t4Libre = rows.find((r) => /t4 libre/i.test(r.rawName));
    expect(t4Libre?.value).toBeCloseTo(1.35);
    expect(t4Libre?.unit).toMatch(/ng\/dL/i);

    const glucosas = rows.filter((r) => /^glucosa$/i.test(r.rawName.trim()) && r.value != null);
    expect(glucosas.every((g) => g.value !== null && g.value < 95)).toBe(true);
  });

  it('returns 40+ candidates on full panel', () => {
    const text = loadFixture('saludDignaFullPanel2025LabText.txt');
    const rows = saludDignaParser.parse(text);
    expect(rows.length).toBeGreaterThanOrEqual(40);
  });

  it('still parses legacy stacked fixture', () => {
    const rows = saludDignaParser.parse(loadFixture('saludDignaLabText.txt'));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => /glucosa/i.test(r.rawName))).toBe(true);
  });

  it('runs full pipeline with SaludDignaParser', async () => {
    const text = loadFixture('saludDignaFullPanel2025LabText.txt');
    const result = await runLabExtractionPipeline(text, 'pdf-parse');
    expect(result.classification.vendor).toBe('salud_digna');
    expect(result.trace.parserUsed).toBe('SaludDignaParser');
    expect(result.candidates.length).toBeGreaterThanOrEqual(40);
    expect(result.metadata.studyDate?.getFullYear()).toBe(2025);
  });

  describe('Riesgo de fractura / densitometría FRISK', () => {
    const fixture = 'saludDignaRiesgoFractura2026LabText.txt';

    it('classifies FRISK report as salud_digna', () => {
      const text = loadFixture(fixture);
      const doc = classifyLabDocument(text);
      expect(doc.vendor).toBe('salud_digna');
      expect(doc.laboratoryName).toMatch(/Salud Digna/i);
      expect(doc.studyType).toMatch(/fractura|densitometr/i);
    });

    it('uses fecha de toma 21/01/2026 (not birth 1942)', () => {
      const meta = parseStudyMetadataFromText(loadFixture(fixture));
      expect(meta.studyDate?.getFullYear()).toBe(2026);
      expect(meta.studyDate?.getMonth()).toBe(0); // enero
      expect(meta.studyDate?.getDate()).toBe(21);
      expect(meta.studyDate?.getFullYear()).not.toBe(1942);
    });

    it('parses FRISK evaluation column and somatometría', () => {
      const rows = parseSaludDignaFriskResults(loadFixture(fixture));
      expect(rows.find((r) => /^IMC$/i.test(r.rawName))?.value).toBeCloseTo(24);
      expect(rows.find((r) => /^Talla$/i.test(r.rawName))?.value).toBeCloseTo(1.45);
      expect(rows.find((r) => /Denominaci[oó]n OMS/i.test(r.rawName))?.valueText).toMatch(/Normal/i);

      expect(rows.find((r) => /SCORE DE CA[IÍ]DAS/i.test(r.rawName))?.value).toBe(1);
      expect(rows.find((r) => /Riesgo de fractura/i.test(r.rawName))?.value).toBeCloseTo(4.44);
      expect(rows.find((r) => /FX PREVIAS/i.test(r.rawName))?.value).toBe(1);

      const peso = rows.find((r) => /^PESO$/i.test(r.rawName));
      expect(peso?.value).toBeCloseTo(50);
      expect(peso?.unit).toMatch(/kg/i);

      // PDF "CALCULO DE RIESGO DE FRACTURA": LUMBAR 0.9530, FÉMUR 0.8100
      // (pdf-parse lista etiquetas DMO en orden inverso al de la columna de valores)
      const dmoLumbar = rows.find((r) => /DMO COLUMNA LUMBAR/i.test(r.rawName));
      expect(dmoLumbar?.value).toBeCloseTo(0.953);
      expect(dmoLumbar?.unit).toMatch(/g\/cm/i);

      const dmoFemur = rows.find((r) => /DMO CUELLO DE F[EÉ]MUR/i.test(r.rawName));
      expect(dmoFemur?.value).toBeCloseTo(0.81);
      expect(dmoFemur?.unit).toMatch(/g\/cm/i);

      expect(dmoLumbar?.value).not.toBeCloseTo(dmoFemur?.value ?? -1);
    });

    it('skips mastografía page noise', () => {
      const rows = parseSaludDignaResults(loadFixture(fixture));
      expect(rows.some((r) => /BIRADS|mastogr/i.test(r.rawName))).toBe(false);
      expect(rows.some((r) => /BIRADS|mastogr/i.test(r.valueText || ''))).toBe(false);
      expect(rows.length).toBeGreaterThanOrEqual(6);
    });

    it('runs pipeline with FRISK fixture', async () => {
      const result = await runLabExtractionPipeline(loadFixture(fixture), 'pdf-parse');
      expect(result.classification.vendor).toBe('salud_digna');
      expect(result.trace.parserUsed).toBe('SaludDignaParser');
      expect(result.candidates.some((c) => /Riesgo de fractura/i.test(c.rawName))).toBe(true);
      expect(result.candidates.find((c) => /DMO COLUMNA LUMBAR/i.test(c.rawName))?.value).toBeCloseTo(0.953);
      expect(result.candidates.find((c) => /DMO CUELLO DE F[EÉ]MUR/i.test(c.rawName))?.value).toBeCloseTo(0.81);
      expect(result.metadata.studyDate?.getFullYear()).toBe(2026);
    });
  });
});
