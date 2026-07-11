import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../config/database';
import { mercadoPagoConfig } from './mercadopago.config';

export type CommissionInput = {
  amount: number;
  paymentType: 'teleconsultation' | 'in_person' | 'other';
};

export async function getActiveCommissionRule() {
  return prisma.platformMercadoPagoCommissionRule.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function calculateMarketplaceFee(input: CommissionInput): Promise<{
  feeAmount: number;
  feePercent: number;
}> {
  const rule = await getActiveCommissionRule();
  const percent = rule
    ? Number(rule.commissionPercentage)
    : mercadoPagoConfig.marketplaceFeePercentage;
  const fixed = rule ? Number(rule.commissionFixedAmount) : 0;
  const min = rule ? Number(rule.minCommissionAmount) : 0;
  const max = rule?.maxCommissionAmount != null ? Number(rule.maxCommissionAmount) : null;

  if (rule) {
    if (input.paymentType === 'teleconsultation' && !rule.applyCommissionToTeleconsultation) {
      return { feeAmount: 0, feePercent: 0 };
    }
    if (input.paymentType === 'in_person' && !rule.applyCommissionToInPersonConsultation) {
      return { feeAmount: 0, feePercent: 0 };
    }
  }

  let fee = (input.amount * percent) / 100 + fixed;
  if (fee < min) fee = min;
  if (max != null && fee > max) fee = max;
  fee = Math.round(fee * 100) / 100;
  return { feeAmount: fee, feePercent: percent };
}

export function decimalToNumber(value: Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : Number(value);
}
