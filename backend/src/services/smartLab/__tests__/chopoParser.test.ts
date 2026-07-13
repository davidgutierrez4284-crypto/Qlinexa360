import fs from 'fs';
import path from 'path';
import { parseLabResultsFromText } from '../labParser.service';
import { parseStudyMetadataFromText } from '../labMetadata.service';
import { isChopoReport, isFooterOrSignatureLine, isProfessionalLicenseValue, isRangeFragmentName, isValidLabUnit, isUnitOnlyLine, parseChopoStackedResults } from '../chopoParser.service';

const chopoFixturePath = path.join(__dirname, 'fixtures', 'chopoLabText.txt');
const fixturesDir = path.join(__dirname, 'fixtures');

describe('CHOPO lab parser', () => {
  const text = fs.readFileSync(chopoFixturePath, 'utf8');

  it('detects CHOPO reports', () => {
    expect(isChopoReport(text)).toBe(true);
  });

  it('parses stacked name/value/range rows from CHOPO fixture', () => {
    const parsed = parseLabResultsFromText(text);
    const byName = Object.fromEntries(parsed.map((p) => [p.analyteNameRaw.toLowerCase(), p]));

    expect(parsed.length).toBeGreaterThanOrEqual(6);
    expect(byName.glucosa?.resultValue).toBeCloseTo(90);
    expect(byName.glucosa?.resultUnit).toMatch(/mg\/dL/i);
    expect(byName.glucosa?.referenceRangeLow).toBeCloseTo(55);
    expect(byName.glucosa?.referenceRangeHigh).toBeCloseTo(99);

    expect(byName.colesterol?.resultValue).toBeCloseTo(241);
    expect(byName.colesterol?.referenceRangeHigh).toBeCloseTo(200);

    expect(byName.potasio?.resultValue).toBeCloseTo(4.6);
    expect(byName.potasio?.resultUnit).toMatch(/meq\/L/i);

    expect(byName['ast (tgo)']?.resultValue).toBeCloseTo(26);
    expect(byName['ast (tgo)']?.referenceRangeHigh).toBeCloseTo(39);
  });

  it('does not parse reference fragments or coupon lines as analytes', () => {
    const parsed = parseLabResultsFromText(text);
    const names = parsed.map((p) => p.analyteNameRaw);
    expect(names.some((n) => /^\d/.test(n))).toBe(false);
    expect(names.some((n) => n.includes('/12/2021'))).toBe(false);
    expect(names.some((n) => /^55 -$/i.test(n))).toBe(false);
  });

  it('extracts CHOPO metadata without disclaimer as study type', () => {
    const meta = parseStudyMetadataFromText(text);
    expect(meta.laboratoryName).toBe('CHOPO');
    expect(meta.studyType?.toLowerCase()).toContain('química de 27 elementos');
    expect(meta.studyType?.toLowerCase()).not.toContain('se realiza en la misma muestra');
  });

  it('parses hepatic panel with multiple CHOPO sections (2017 format)', () => {
    const text = fs.readFileSync(path.join(fixturesDir, 'chopoHepatic2017LabText.txt'), 'utf8');
    const result = parseChopoStackedResults(text);
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
    const text = fs.readFileSync(
      path.join(fixturesDir, 'chopoGlucoseInsulinCurve2017LabText.txt'),
      'utf8'
    );
    const result = parseChopoStackedResults(text);
    const byName = Object.fromEntries(result.map((p) => [p.analyteNameRaw.toLowerCase(), p]));

    expect(result).toHaveLength(11);

    expect(byName['glucosa basal']?.resultValue).toBeCloseTo(97);
    expect(byName['glucosa basal']?.resultUnit).toMatch(/mg\/dL/i);
    expect(byName['glucosa basal']?.referenceRangeLow).toBeCloseTo(55);
    expect(byName['glucosa basal']?.referenceRangeHigh).toBeCloseTo(99);

    expect(byName['glucosa 30 min']?.resultValue).toBeCloseTo(149);
    expect(byName['glucosa 30 min']?.resultUnit).toMatch(/mg\/dL/i);
    expect(byName['glucosa 1 hora']?.resultValue).toBeCloseTo(152);
    expect(byName['glucosa 1 hora']?.resultUnit).toMatch(/mg\/dL/i);
    expect(byName['glucosa 2 horas']?.resultValue).toBeCloseTo(103);
    expect(byName['glucosa 2 horas']?.resultUnit).toMatch(/mg\/dL/i);
    expect(byName['glucosa 3 horas']?.resultValue).toBeCloseTo(81);
    expect(byName['glucosa 3 horas']?.resultUnit).toMatch(/mg\/dL/i);

    expect(byName['insulina basal']?.resultValue).toBeCloseTo(18.6);
    expect(byName['insulina basal']?.resultUnit).toMatch(/µUI\/mL|μUI\/mL/i);
    expect(byName['insulina basal']?.referenceRangeLow).toBeCloseTo(2.6);
    expect(byName['insulina basal']?.referenceRangeHigh).toBeCloseTo(24.9);

    expect(byName['insulina 30 min']?.resultValue).toBeCloseTo(121.9);
    expect(byName['insulina 30 min']?.resultUnit).toMatch(/µUI\/mL|μUI\/mL/i);
    expect(byName['insulina 1 hora']?.resultValue).toBeCloseTo(193.7);
    expect(byName['insulina 2 horas']?.resultValue).toBeCloseTo(140.5);
    expect(byName['insulina 2 horas']?.referenceRangeLow).toBeCloseTo(18);
    expect(byName['insulina 2 horas']?.referenceRangeHigh).toBeCloseTo(56);
    expect(byName['insulina 3 horas']?.resultValue).toBeCloseTo(63.7);
    expect(byName['insulina 3 horas']?.referenceRangeLow).toBeCloseTo(8);
    expect(byName['insulina 3 horas']?.referenceRangeHigh).toBeCloseTo(22);
    expect(byName['insulina 4 horas']?.resultValue).toBeCloseTo(68.6);
    expect(byName['insulina 4 horas']?.referenceRangeLow).toBeCloseTo(6);
    expect(byName['insulina 4 horas']?.referenceRangeHigh).toBeCloseTo(21);
  });

  it('extracts curve study metadata without coupon noise (2017 CHOPO)', () => {
    const text = fs.readFileSync(
      path.join(fixturesDir, 'chopoGlucoseInsulinCurve2017LabText.txt'),
      'utf8'
    );
    const meta = parseStudyMetadataFromText(text);
    expect(meta.laboratoryName).toBe('CHOPO');
    expect(meta.studyType?.toLowerCase()).toContain('curva de tolerancia a la glucosa');
    expect(meta.studyType?.toLowerCase()).toContain('curva de insulina');
    expect(meta.studyType?.toLowerCase()).not.toContain('química de 35 elementos');
    expect(meta.studyType).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('parses CHOPO lipid panel preserving cholesterol subtype names', () => {
    const text = fs.readFileSync(path.join(fixturesDir, 'chopoCholesterolPanel.txt'), 'utf8');
    const result = parseChopoStackedResults(text);
    const byName = Object.fromEntries(result.map((p) => [p.analyteNameRaw.toLowerCase(), p]));

    expect(result.length).toBeGreaterThanOrEqual(6);
    expect(byName.colesterol?.resultValue).toBeCloseTo(237);
    expect(byName.colesterol?.referenceRangeHigh).toBeCloseTo(200);

    expect(byName['colesterol hdl']?.resultValue).toBeCloseTo(41);
    expect(byName['colesterol hdl']?.referenceRangeLow).toBeCloseTo(60);

    expect(byName['colesterol ldl']?.resultValue).toBeCloseTo(169);
    expect(byName['colesterol ldl']?.referenceRangeHigh).toBeCloseTo(100);

    expect(byName['vldl colesterol']?.resultValue).toBeCloseTo(41);
    expect(byName['vldl colesterol']?.referenceRangeHigh).toBeCloseTo(35);

    expect(byName['colesterol no-hdl']?.resultValue).toBeCloseTo(196);
    expect(byName['colesterol no-hdl']?.referenceRangeHigh).toBeCloseTo(130);

    const cholesterolNames = result
      .filter((p) => /colesterol|vldl/i.test(p.analyteNameRaw))
      .map((p) => p.analyteNameRaw.toLowerCase());
    expect(new Set(cholesterolNames).size).toBe(cholesterolNames.length);
  });

  it('parses 2012 CHOPO lipid panel with unit header lines and aterogenic index', () => {
    const text = fs.readFileSync(path.join(fixturesDir, 'chopoLipidPanel2012LabText.txt'), 'utf8');
    const result = parseChopoStackedResults(text);
    const byName = Object.fromEntries(result.map((p) => [p.analyteNameRaw.toLowerCase(), p]));

    expect(result).toHaveLength(6);

    expect(byName.colesterol?.resultValue).toBeCloseTo(260);
    expect(byName.colesterol?.resultUnit).toMatch(/mg\/dL/i);
    expect(byName.colesterol?.referenceRangeHigh).toBeCloseTo(200);

    expect(byName['colesterol hdl']?.resultValue).toBeCloseTo(45);
    expect(byName['colesterol hdl']?.resultUnit).toMatch(/mg\/dL/i);
    expect(byName['colesterol hdl']?.referenceRangeLow).toBeCloseTo(60);

    expect(byName['colesterol ldl']?.resultValue).toBeCloseTo(194);
    expect(byName['colesterol ldl']?.referenceRangeHigh).toBeCloseTo(100);

    expect(byName['colesterol no-hdl']?.resultValue).toBeCloseTo(215);
    expect(byName['colesterol no-hdl']?.referenceRangeHigh).toBeCloseTo(130);

    expect(byName.triglicéridos?.resultValue).toBeCloseTo(106);
    expect(byName.triglicéridos?.resultUnit).toMatch(/mg\/dL/i);

    expect(byName['índice aterogénico']?.resultValue).toBeCloseTo(5.8);
    expect(byName['índice aterogénico']?.resultUnit).toBeNull();
    expect(byName['índice aterogénico']?.referenceRangeHigh).toBeCloseTo(4.5);

    const names = result.map((p) => p.analyteNameRaw.toLowerCase());
    expect(names.some((n) => n === 'mg/dl')).toBe(false);
  });

  it('extracts 2012 lipid panel study metadata', () => {
    const text = fs.readFileSync(path.join(fixturesDir, 'chopoLipidPanel2012LabText.txt'), 'utf8');
    const meta = parseStudyMetadataFromText(text);
    expect(meta.laboratoryName).toBe('CHOPO');
    expect(meta.studyType?.toLowerCase()).toContain('perfil de lipidos en suero');
  });

  it('parses biometría hemática + immunoglobulins (Mateo 2017)', () => {
    const text = fs.readFileSync(
      path.join(fixturesDir, 'chopoBiometriaHematicaMateo2017LabText.txt'),
      'utf8'
    );
    const result = parseChopoStackedResults(text);
    const byName = Object.fromEntries(result.map((p) => [p.analyteNameRaw.toLowerCase(), p]));

    expect(isChopoReport(text)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(25);
    expect(byName.leucocitos?.resultValue).toBeCloseTo(12.98);
    expect(byName.leucocitos?.resultUnit).toMatch(/miles\/[μµ]L/i);
    expect(byName.hemoglobina?.resultValue).toBeCloseTo(13.5);
    expect(byName.plaquetas?.resultValue).toBeCloseTo(503);
    expect(byName['inmunoglobulina e (ige)']?.resultValue).toBeCloseTo(798.3);
    expect(byName['igg 4']?.resultValue).toBeCloseTo(55.1);
  });

  it('parses química de 4 elementos with hepatic panel (2018)', () => {
    const text = fs.readFileSync(path.join(fixturesDir, 'chopoQuimica4Elementos2018LabText.txt'), 'utf8');
    const result = parseChopoStackedResults(text);
    const byName = Object.fromEntries(result.map((p) => [p.analyteNameRaw.toLowerCase(), p]));
    const meta = parseStudyMetadataFromText(text);

    expect(result.length).toBeGreaterThanOrEqual(15);
    expect(byName.glucosa?.resultValue).toBeCloseTo(91);
    expect(byName.urea?.resultValue).toBeCloseTo(28.7);
    expect(byName.creatinina?.resultValue).toBeCloseTo(1.11);
    expect(byName['ácido úrico']?.resultValue).toBeCloseTo(6.9);
    expect(byName['tgo (ast)']?.resultValue).toBeCloseTo(19);
    expect(byName['vitamina d (25,hidroxi)']?.resultValue).toBeCloseTo(32.64);
    expect(meta.laboratoryName).toBe('CHOPO');
    expect(meta.studyType?.toLowerCase()).toMatch(/qu[ií]mica de 4 elementos/);
  });

  it('parses química integral de 45 elementos (2020)', () => {
    const text = fs.readFileSync(
      path.join(fixturesDir, 'chopoQuimica45Elementos2020LabText.txt'),
      'utf8'
    );
    const result = parseChopoStackedResults(text);
    const byName = Object.fromEntries(result.map((p) => [p.analyteNameRaw.toLowerCase(), p]));

    expect(result.length).toBeGreaterThanOrEqual(40);
    expect(byName.glucosa?.resultValue).toBeCloseTo(85);
    expect(byName.sodio?.resultValue).toBeCloseTo(137);
    expect(byName.potasio?.resultValue).toBeCloseTo(3.8);
    expect(byName['colesterol hdl']?.resultValue).toBeCloseTo(69);
    expect(byName['tasa de filtración glomerular']?.resultValue).toBeCloseTo(114.6);
    expect(byName['tasa de filtración glomerular']?.resultUnit).toMatch(/mL\/min\/1\.73/i);
    expect(byName.hemoglobina?.resultValue).toBeCloseTo(14.4);
  });

  it('parses urocultivo + super química 35 + biometría (2017)', () => {
    const text = fs.readFileSync(
      path.join(fixturesDir, 'chopoUrocultivoBiometria35elementos2017LabText.txt'),
      'utf8'
    );
    const result = parseChopoStackedResults(text);
    const numeric = (name: string) =>
      result.find((p) => p.analyteNameRaw.toLowerCase() === name && p.resultValue != null);
    const culture = result.filter((p) =>
      /aislamiento|no observados|sin desarrollo/i.test(
        `${p.analyteNameRaw} ${p.resultValueText ?? ''}`
      )
    );

    expect(result.length).toBeGreaterThanOrEqual(50);
    expect(numeric('glucosa')?.resultValue).toBeCloseTo(88);
    expect(numeric('leucocitos')?.resultValue).toBeCloseTo(8.03);
    expect(numeric('hemoglobina')?.resultValue).toBeCloseTo(14.2);
    expect(numeric('densidad')?.resultValue).toBeCloseTo(1.026);

    const aislamiento = result.find((p) => /aislamiento/i.test(p.analyteNameRaw));
    expect(aislamiento?.resultValue).toBeNull();
    expect(aislamiento?.resultValueText).toMatch(/sin desarrollo microbiano/i);

    const microLeuc = result.filter(
      (p) => /leucocitos/i.test(p.analyteNameRaw) && /no observados/i.test(p.resultValueText ?? '')
    );
    expect(microLeuc.length).toBeGreaterThanOrEqual(1);
    expect(culture.length).toBeGreaterThanOrEqual(2);
  });

  it('parses urocultivo + química 45 with EGO qualitative rows (2020)', () => {
    const text = fs.readFileSync(
      path.join(fixturesDir, 'chopoUrocultivo45Elementos2020LabText.txt'),
      'utf8'
    );
    const result = parseChopoStackedResults(text);
    const byName = Object.fromEntries(result.map((p) => [p.analyteNameRaw.toLowerCase(), p]));
    const numericGlucosa = result.find(
      (p) => /glucosa/i.test(p.analyteNameRaw) && p.resultValue != null
    );

    expect(numericGlucosa?.resultValue).toBeCloseTo(85);
    expect(byName.aspecto?.resultValueText).toMatch(/turbio/i);
    expect(byName.color?.resultValueText).toMatch(/[aá]mbar/i);
    expect(byName.nitritos?.resultValueText).toMatch(/negativo/i);

    const aislamiento = result.find((p) => /aislamiento/i.test(p.analyteNameRaw));
    expect(aislamiento?.resultValueText).toMatch(/sin desarrollo microbiano/i);
  });

  it('parses biometría + química lipídica + coagulación', () => {
    const text = fs.readFileSync(path.join(fixturesDir, 'chopoBiometriaYQuimicaLabText.txt'), 'utf8');
    const result = parseChopoStackedResults(text);
    const byName = Object.fromEntries(result.map((p) => [p.analyteNameRaw.toLowerCase(), p]));

    expect(byName.glucosa?.resultValue).toBeCloseTo(79);
    expect(byName.colesterol?.resultValue).toBeCloseTo(280);
    expect(byName.triglicéridos?.resultValue).toBeCloseTo(282);
    expect(byName.hemoglobina?.resultValue).toBeCloseTo(11.5);
    expect(byName['tiempo de protrombina']?.resultValue).toBeCloseTo(11);
    expect(byName.inr?.resultValue).toBeCloseTo(1);
  });
});

describe('lab parser validation helpers', () => {
  it('rejects range fragments as analyte names', () => {
    expect(isRangeFragmentName('0.01 -')).toBe(true);
    expect(isRangeFragmentName('55 -')).toBe(true);
    expect(isRangeFragmentName('Glucosa')).toBe(false);
    expect(isRangeFragmentName('1a. Muestra Insulina')).toBe(false);
  });

  it('rejects date fragments as units', () => {
    expect(isValidLabUnit('/12/2021')).toBe(false);
    expect(isValidLabUnit('mg/dL')).toBe(true);
    expect(isValidLabUnit('. mg/dL')).toBe(true);
  });

  it('rejects dot-prefixed unit lines as analyte names', () => {
    expect(isUnitOnlyLine('. mg/dL')).toBe(true);
    expect(isUnitOnlyLine('mg/dL')).toBe(true);
    expect(isUnitOnlyLine('Colesterol')).toBe(false);
  });

  it('rejects laboratory footer and signature lines', () => {
    expect(isFooterOrSignatureLine('Q.F.B Mario García Sánchez Cédula Profesional')).toBe(true);
    expect(isFooterOrSignatureLine('Responsable del Laboratorio')).toBe(true);
    expect(isFooterOrSignatureLine('Colesterol')).toBe(false);
    expect(
      isProfessionalLicenseValue('Q.F.B Mario García Sánchez Cédula Profesional', 895854)
    ).toBe(true);
    expect(isProfessionalLicenseValue('Colesterol', 260)).toBe(false);
  });
});
