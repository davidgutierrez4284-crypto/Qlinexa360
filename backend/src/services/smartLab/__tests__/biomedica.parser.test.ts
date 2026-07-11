import fs from 'fs';
import path from 'path';
import { classifyLabDocument } from '../pipeline/documentClassifier.service';
import { biomedicaParser, parseBiomedicaResults } from '../pipeline/parsers/biomedica.parser';
import { parseStudyMetadataFromText } from '../labMetadata.service';
import { runLabExtractionPipeline } from '../pipeline/labPipeline.service';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('Biomédica parser', () => {
  it('classifies Biomédica reports', () => {
    const text = loadFixture('biomedicaFullPanel2025LabText.txt');
    const doc = classifyLabDocument(text);
    expect(doc.vendor).toBe('biomedica');
    expect(doc.laboratoryName).toMatch(/Biom[eé]dica/i);
  });

  it('uses Fecha Toma de Muestra instead of F.NAC for study date', () => {
    const text = loadFixture('biomedicaFullPanel2025LabText.txt');
    const meta = parseStudyMetadataFromText(text);
    expect(meta.studyDate?.getFullYear()).toBe(2025);
    expect(meta.studyDate?.getMonth()).toBe(3);
    expect(meta.studyDate?.getDate()).toBe(8);
    expect(meta.studyDate?.getFullYear()).not.toBe(1984);
  });

  it('parses biometría hemática with 20+ rows from glued tabular layout', () => {
    const text = loadFixture('biomedicaFullPanel2025LabText.txt');
    const rows = parseBiomedicaResults(text);
    const biometriaRows = rows.filter((r) =>
      /eritrocito|hemoglobina|hematocrito|leucocito|plaqueta|neutr[oó]filo|linfocito|monocito|eosin[oó]filo|bas[oó]filo|volumen|ancho|concentraci[oó]n/i.test(
        r.rawName
      )
    );

    expect(biometriaRows.length).toBeGreaterThanOrEqual(20);

    const byName = Object.fromEntries(rows.map((r) => [r.rawName.toLowerCase(), r]));
    expect(byName.eritrocitos?.value).toBeCloseTo(4.88);
    expect(byName.eritrocitos?.unit).toMatch(/millones\/mm3/i);
    expect(byName.eritrocitos?.referenceLow).toBeCloseTo(4.2);
    expect(byName.eritrocitos?.referenceHigh).toBeCloseTo(5.4);
    expect(byName.hemoglobina?.value).toBeCloseTo(13.8);
    expect(byName.plaquetas?.value).toBeCloseTo(283);
  });

  it('rejects lipid reference tier lines as analytes', () => {
    const text = loadFixture('biomedicaFullPanel2025LabText.txt');
    const rows = parseBiomedicaResults(text);
    const names = rows.map((r) => r.rawName.toLowerCase());

    expect(names.some((n) => n.includes('<50') || n.includes('años'))).toBe(false);
    expect(names.some((n) => /^alto\b/.test(n) || n.includes('160 -'))).toBe(false);
    expect(names.some((n) => n.includes('bajo menor') || n.includes('deseable'))).toBe(false);
    expect(names.some((n) => n.includes('fecha toma'))).toBe(false);
    expect(names.some((n) => n.includes('a partir del'))).toBe(false);
  });

  it('parses chemistry rows across multi-page sections', () => {
    const text = loadFixture('biomedicaFullPanel2025LabText.txt');
    const rows = biomedicaParser.parse(text);

    expect(rows.length).toBeGreaterThanOrEqual(40);
    const glucosa = rows.find((r) => r.rawName.toLowerCase().includes('glucosa'));
    expect(glucosa?.value).toBeCloseTo(84);
    expect(glucosa?.unit).toMatch(/mg\/dL/i);
  });

  it('runs full pipeline with BiomedicaParser (not GenericRegexParser)', async () => {
    const text = loadFixture('biomedicaFullPanel2025LabText.txt');
    const result = await runLabExtractionPipeline(text, 'pdf-parse');

    expect(result.classification.vendor).toBe('biomedica');
    expect(result.trace.parserUsed).toBe('BiomedicaParser');
    expect(result.candidates.length).toBeGreaterThanOrEqual(40);
    expect(result.metadata.studyDate?.getFullYear()).toBe(2025);
  });
});
