import { buildMultiReportResultDiffs, buildReportResultDiffs } from '../labCompare.service';

describe('labCompare buildReportResultDiffs', () => {
  const mk = (name: string, catalogId: string | null, value: number) => ({
    analyteCatalogId: catalogId,
    analyteNameRaw: name,
    analyteNameNormalized: name,
    resultValue: value,
  });

  it('pairs results by catalog id across reports', () => {
    const a = [mk('Glucosa', 'id-glu', 90), mk('Hb', 'id-hb', 14)];
    const b = [mk('Glucosa', 'id-glu', 95), mk('Urea', 'id-urea', 30)];
    const diffs = buildReportResultDiffs(a, b);
    expect(diffs).toHaveLength(3);
    expect(diffs[0].reportA?.resultValue).toBe(90);
    expect(diffs[0].reportB?.resultValue).toBe(95);
    expect(diffs[1].reportA?.resultValue).toBe(14);
    expect(diffs[1].reportB).toBeNull();
    expect(diffs[2].reportA).toBeNull();
    expect(diffs[2].reportB?.resultValue).toBe(30);
  });

  it('falls back to raw name when catalog id is missing', () => {
    const a = [mk('Parametro X', null, 1)];
    const b = [mk('Parametro X', null, 2)];
    const [diff] = buildReportResultDiffs(a, b);
    expect(diff.reportB?.resultValue).toBe(2);
  });
});

describe('labCompare buildMultiReportResultDiffs', () => {
  const mk = (name: string, catalogId: string | null, value: number) => ({
    analyteCatalogId: catalogId,
    analyteNameRaw: name,
    analyteNameNormalized: name,
    resultValue: value,
  });

  it('merges analytes across three reports', () => {
    const a = [mk('Glucosa', 'id-glu', 90)];
    const b = [mk('Glucosa', 'id-glu', 95), mk('Urea', 'id-urea', 30)];
    const c = [mk('Hb', 'id-hb', 14)];
    const diffs = buildMultiReportResultDiffs([a, b, c]);
    expect(diffs).toHaveLength(3);
    expect(diffs[0].values).toEqual([a[0], b[0], null]);
    expect(diffs[1].values[1]?.resultValue).toBe(30);
    expect(diffs[2].values[2]?.resultValue).toBe(14);
  });
});
