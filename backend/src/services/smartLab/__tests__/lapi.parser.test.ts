import fs from 'fs';
import path from 'path';
import {
  lapiParser,
  parseLapiTwoLineResults,
  splitGluedHighAndUnit,
} from '../pipeline/parsers/lapi.parser';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('splitGluedHighAndUnit', () => {
  it('splits glued 10^6uL from reference high', () => {
    expect(splitGluedHighAndUnit('5.4410^6uL')).toEqual({
      high: 5.44,
      unit: '10^6uL',
    });
  });

  it('splits glued 10^3uL from reference high', () => {
    expect(splitGluedHighAndUnit('11.0010^3uL')).toEqual({
      high: 11.0,
      unit: '10^3uL',
    });
  });

  it('splits g/dL glued to high', () => {
    expect(splitGluedHighAndUnit('16.3g/dL')).toEqual({
      high: 16.3,
      unit: 'g/dL',
    });
  });

  it('splits percent glued to high', () => {
    expect(splitGluedHighAndUnit('48.9%')).toEqual({
      high: 48.9,
      unit: '%',
    });
  });
});

describe('parseLapiTwoLineResults', () => {
  it('parses page 1 biometria with 20+ hematology rows', () => {
    const text = loadFixture('lapiBiometriaHematica2025LabText.txt');
    const rows = parseLapiTwoLineResults(text);

    expect(rows.length).toBeGreaterThanOrEqual(20);

    const byName = Object.fromEntries(rows.map((r) => [r.rawName.toLowerCase(), r]));
    expect(byName.eritrocitos?.value).toBeCloseTo(5.07);
    expect(byName.eritrocitos?.referenceLow).toBeCloseTo(3.87);
    expect(byName.eritrocitos?.referenceHigh).toBeCloseTo(5.44);
    expect(byName.eritrocitos?.unit).toBe('10^6uL');
    expect(byName.hemoglobina?.value).toBeCloseTo(15.2);
    expect(byName.hematocrito?.unit).toBe('%');
    expect(byName.plaquetas?.value).toBeCloseTo(245);
    expect(rows.some((r) => /city\s*shops/i.test(r.rawName))).toBe(false);
    expect(rows.some((r) => r.value === 749109)).toBe(false);
  });

  it('parses lipid multi-line unit after asterisk', () => {
    const text = loadFixture('lapiPerfilPlus2025LabText.txt');
    const rows = parseLapiTwoLineResults(text);
    const colesterol = rows.find((r) => r.rawName.toLowerCase().includes('colesterol total'));

    expect(colesterol?.value).toBeCloseTo(218);
    expect(colesterol?.referenceLow).toBeCloseTo(130);
    expect(colesterol?.referenceHigh).toBeCloseTo(199);
    expect(colesterol?.unit).toMatch(/mg\/dL/i);
  });

  it('parses full PERFIL PLUS with 80+ numeric results', () => {
    const text = loadFixture('lapiPerfilPlus2025LabText.txt');
    const rows = lapiParser.parse(text);

    expect(rows.length).toBeGreaterThanOrEqual(80);
  });

  it('still parses legacy stacked lipid fixture', () => {
    const text = loadFixture('lapiLabText.txt');
    const rows = lapiParser.parse(text);

    expect(rows.length).toBeGreaterThanOrEqual(3);
    const colesterol = rows.find((r) => r.rawName.toLowerCase().includes('colesterol'));
    expect(colesterol?.value).toBeCloseTo(210);
  });
});
