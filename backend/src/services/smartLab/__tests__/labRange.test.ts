import { computeAbnormalFlag } from '../../../utils/labRange.utils';

describe('labRange computeAbnormalFlag', () => {
  it('returns normal inside range', () => {
    expect(computeAbnormalFlag(90, 70, 100)).toBe('normal');
  });

  it('returns high when moderately above max', () => {
    expect(computeAbnormalFlag(120, 70, 100)).toBe('high');
  });

  it('returns critical_high when far above max', () => {
    expect(computeAbnormalFlag(200, 70, 100)).toBe('critical_high');
  });

  it('returns low and critical_low below min', () => {
    expect(computeAbnormalFlag(65, 70, 100)).toBe('low');
    expect(computeAbnormalFlag(20, 70, 100)).toBe('critical_low');
  });

  it('returns unknown without value or range', () => {
    expect(computeAbnormalFlag(null, 70, 100)).toBe('unknown');
    expect(computeAbnormalFlag(90, null, null)).toBe('unknown');
  });

  it('handles one-sided reference ranges', () => {
    expect(computeAbnormalFlag(260, null, 200)).toBe('high');
    expect(computeAbnormalFlag(180, null, 200)).toBe('normal');
    expect(computeAbnormalFlag(45, 60, null)).toBe('low');
    expect(computeAbnormalFlag(65, 60, null)).toBe('normal');
    expect(computeAbnormalFlag(5.8, null, 4.5)).toBe('high');
  });
});
