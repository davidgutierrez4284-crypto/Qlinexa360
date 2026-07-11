import { Decimal } from '@prisma/client/runtime/library';
import { decimalToNumber } from './mercadopago.commission.utils';

export type MpPaymentFinancialPayload = {
  transaction_amount?: number;
  fee_details?: Array<{ type?: string; amount?: number; fee_payer?: string }>;
  transaction_details?: {
    net_received_amount?: number;
    total_paid_amount?: number;
  };
};

export function extractMercadoPagoProcessingFee(
  mpPayment: MpPaymentFinancialPayload,
  grossAmount: number,
  platformCommission: number
): number {
  const fees = mpPayment.fee_details || [];
  let fromDetails = 0;

  for (const fee of fees) {
    const type = (fee.type || '').toLowerCase();
    if (type.includes('application') || type === 'marketplace_fee') continue;
    if (type.includes('mercadopago') || type.includes('financing') || fee.fee_payer === 'collector') {
      fromDetails += Number(fee.amount || 0);
    }
  }

  if (fromDetails > 0) {
    return Math.round(fromDetails * 100) / 100;
  }

  const net = mpPayment.transaction_details?.net_received_amount;
  if (net != null && Number.isFinite(Number(net))) {
    const derived = grossAmount - platformCommission - Number(net);
    if (derived > 0) {
      return Math.round(derived * 100) / 100;
    }
  }

  return 0;
}

export function extractNetReceivedAmount(
  mpPayment: MpPaymentFinancialPayload,
  grossAmount: number,
  platformCommission: number,
  mpProcessingFee: number
): number {
  const net = mpPayment.transaction_details?.net_received_amount;
  if (net != null && Number.isFinite(Number(net))) {
    return Math.round(Number(net) * 100) / 100;
  }
  return Math.max(0, Math.round((grossAmount - platformCommission - mpProcessingFee) * 100) / 100);
}

export function buildPaymentFinancialUpdate(
  mpPayment: MpPaymentFinancialPayload,
  localPayment: { amount: Decimal | number; platformCommissionAmount: Decimal | number }
) {
  const grossAmount = decimalToNumber(localPayment.amount);
  const platformCommission = decimalToNumber(localPayment.platformCommissionAmount);
  const providerProcessingFeeAmount = extractMercadoPagoProcessingFee(
    mpPayment,
    grossAmount,
    platformCommission
  );
  const netReceivedAmount = extractNetReceivedAmount(
    mpPayment,
    grossAmount,
    platformCommission,
    providerProcessingFeeAmount
  );

  return { providerProcessingFeeAmount, netReceivedAmount };
}

export function computeNetToReceive(
  amount: number,
  platformCommission: number,
  mpProcessingFee: number,
  netReceivedAmount?: number | null
): number {
  if (netReceivedAmount != null && netReceivedAmount > 0) {
    return Math.round(netReceivedAmount * 100) / 100;
  }
  return Math.max(0, Math.round((amount - platformCommission - mpProcessingFee) * 100) / 100);
}
