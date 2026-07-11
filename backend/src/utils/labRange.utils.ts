import { LabAbnormalFlag } from '@prisma/client';

export function computeAbnormalFlag(
  value: number | null | undefined,
  low: number | null | undefined,
  high: number | null | undefined
): LabAbnormalFlag {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  if (low == null && high == null) return 'unknown';

  const hasLow = low != null && Number.isFinite(low);
  const hasHigh = high != null && Number.isFinite(high);

  if (hasLow && value < low!) {
    const ratio = low! > 0 ? value / low! : 0;
    return ratio < 0.5 ? 'critical_low' : 'low';
  }
  if (hasHigh && value > high!) {
    const ratio = high! > 0 ? value / high! : value;
    return ratio > 1.5 ? 'critical_high' : 'high';
  }
  if (hasLow && hasHigh && value >= low! && value <= high!) return 'normal';
  if (hasHigh && !hasLow && value <= high!) return 'normal';
  if (hasLow && !hasHigh && value >= low!) return 'normal';
  return 'unknown';
}
