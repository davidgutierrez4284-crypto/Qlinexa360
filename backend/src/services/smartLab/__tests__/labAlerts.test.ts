import { mapAbnormalFlagToLabSeverity } from '../labAlerts.service';

describe('labAlerts severity mapping', () => {
  it('maps critical flags to red', () => {
    expect(mapAbnormalFlagToLabSeverity('critical_high')).toBe('red');
    expect(mapAbnormalFlagToLabSeverity('critical_low')).toBe('red');
  });

  it('maps borderline flags to yellow', () => {
    expect(mapAbnormalFlagToLabSeverity('high')).toBe('yellow');
    expect(mapAbnormalFlagToLabSeverity('low')).toBe('yellow');
  });

  it('maps normal to green and unknown to gray', () => {
    expect(mapAbnormalFlagToLabSeverity('normal')).toBe('green');
    expect(mapAbnormalFlagToLabSeverity('unknown')).toBe('gray');
  });
});
