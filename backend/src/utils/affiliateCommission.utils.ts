/**
 * Cálculo de comisiones de afiliados.
 *
 * Base de comisión = pago SIN IVA. Fórmula:
 *   paymentAmountNet = round(gross / (1 + vatRate), 2)
 *   commissionAmount = round(net * (commissionPercentage / 100), 2)
 *
 * Ejemplo Qlinexa360: 499 / 1.16 = 430.17 ; 430.17 * 0.30 = 129.05
 */

export interface CommissionCalcInput {
  grossAmount: number;
  vatRate: number;
  commissionPercentage: number;
  /** Contexto opcional para enriquecer el calculation_trace_json. */
  commissionMonthNumber?: number;
  commissionDurationMonths?: number;
  paypalPaymentId?: string;
  doctorUserId?: string;
  affiliateCode?: string;
  currency?: string;
}

export interface CommissionCalcResult {
  netBase: number;
  commissionAmount: number;
  trace: Record<string, unknown>;
}

/** Redondeo monetario a 2 decimales, estable ante errores de punto flotante. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula la base sin IVA y el importe de comisión, y construye el trace de auditoría.
 */
export function computeCommission(input: CommissionCalcInput): CommissionCalcResult {
  const gross = Number(input.grossAmount);
  const vatRate = Number(input.vatRate);
  const pct = Number(input.commissionPercentage);

  if (!Number.isFinite(gross) || gross < 0) {
    throw new Error(`grossAmount inválido: ${input.grossAmount}`);
  }
  if (!Number.isFinite(vatRate) || vatRate < 0) {
    throw new Error(`vatRate inválido: ${input.vatRate}`);
  }
  if (!Number.isFinite(pct) || pct < 0) {
    throw new Error(`commissionPercentage inválido: ${input.commissionPercentage}`);
  }

  const netBase = roundMoney(gross / (1 + vatRate));
  const commissionAmount = roundMoney(netBase * (pct / 100));

  const trace: Record<string, unknown> = {
    grossAmount: roundMoney(gross),
    vatRate,
    netBase,
    commissionPercentage: pct,
    commissionAmount,
    commissionMonthNumber: input.commissionMonthNumber ?? null,
    commissionDurationMonths: input.commissionDurationMonths ?? null,
    paypalPaymentId: input.paypalPaymentId ?? null,
    doctorUserId: input.doctorUserId ?? null,
    affiliateCode: input.affiliateCode ?? null,
    currency: input.currency ?? null,
    calculatedAt: new Date().toISOString()
  };

  return { netBase, commissionAmount, trace };
}
