import { isAxiosError } from 'axios';
import { securityLogger } from '../../utils/logger.utils';
import { MercadoPagoApiClient } from './mercadopago.api.client';
import { mercadoPagoConfig } from './mercadopago.config';

export type MpPaymentPayload = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string;
  date_approved?: string;
  transaction_amount?: number;
  fee_details?: Array<{ type?: string; amount?: number; fee_payer?: string }>;
  transaction_details?: {
    net_received_amount?: number;
    total_paid_amount?: number;
  };
};

export type MpPaymentResolveSource =
  | 'doctor_getPayment'
  | 'platform_getPayment'
  | 'merchant_order'
  | 'doctor_search'
  | 'platform_search';

export interface ResolveMpPaymentInput {
  paymentId?: string | null;
  doctorAccessToken?: string | null;
  preferenceId?: string | null;
  externalReference?: string | null;
}

export interface ResolveMpPaymentResult {
  payment: MpPaymentPayload;
  source: MpPaymentResolveSource;
  accessToken: string;
}

export function isMpNotFoundError(err: unknown): boolean {
  return isAxiosError(err) && err.response?.status === 404;
}

function pickBestMpPayment(results?: MpPaymentPayload[]): MpPaymentPayload | undefined {
  if (!results?.length) return undefined;
  return (
    results.find((p) => p.status === 'approved') ||
    results.find((p) => p.status === 'rejected' || p.status === 'cancelled') ||
    results[0]
  );
}

async function tryGetPayment(
  paymentId: string,
  accessToken: string
): Promise<MpPaymentPayload | null> {
  try {
    return await MercadoPagoApiClient.getPayment(accessToken, paymentId);
  } catch (err) {
    if (isMpNotFoundError(err)) return null;
    throw err;
  }
}

/**
 * Resolves a Mercado Pago payment using doctor token first, then platform/marketplace fallbacks.
 * In sandbox/marketplace, seller OAuth may return 404 for platform-collected payments.
 */
export async function resolveMpPaymentWithFallback(
  input: ResolveMpPaymentInput
): Promise<ResolveMpPaymentResult> {
  const { paymentId, doctorAccessToken, preferenceId, externalReference } = input;
  const platformToken = mercadoPagoConfig.platformAccessToken || null;

  if (paymentId && doctorAccessToken) {
    const payment = await tryGetPayment(paymentId, doctorAccessToken);
    if (payment) {
      return { payment, source: 'doctor_getPayment', accessToken: doctorAccessToken };
    }
  }

  if (paymentId && platformToken) {
    const payment = await tryGetPayment(paymentId, platformToken);
    if (payment) {
      return { payment, source: 'platform_getPayment', accessToken: platformToken };
    }
  }

  if (preferenceId) {
    for (const token of [doctorAccessToken, platformToken].filter(Boolean) as string[]) {
      try {
        const orders = await MercadoPagoApiClient.searchMerchantOrders(token, {
          preference_id: preferenceId,
        });
        for (const order of orders.elements || []) {
          const orderPayments = order.payments || [];
          const match =
            (paymentId
              ? orderPayments.find((p) => String(p.id) === String(paymentId))
              : undefined) ||
            orderPayments.find((p) => p.status === 'approved') ||
            orderPayments[0];

          if (!match?.id) continue;

          const resolved =
            (await tryGetPayment(String(match.id), token)) ||
            ({ id: match.id, status: match.status } as MpPaymentPayload);

          if (paymentId && String(resolved.id) !== String(paymentId)) continue;

          return { payment: resolved, source: 'merchant_order', accessToken: token };
        }
      } catch (err) {
        if (!isMpNotFoundError(err)) {
          securityLogger.warn('MP resolve: merchant_orders search failed', {
            preferenceId,
            err,
          });
        }
      }
    }
  }

  if (externalReference) {
    if (doctorAccessToken) {
      try {
        const search = await MercadoPagoApiClient.searchPayments(doctorAccessToken, {
          external_reference: externalReference,
        });
        const payment = paymentId
          ? search.results?.find((p) => String(p.id) === String(paymentId)) ||
            pickBestMpPayment(search.results)
          : pickBestMpPayment(search.results);
        if (payment) {
          return { payment, source: 'doctor_search', accessToken: doctorAccessToken };
        }
      } catch (err) {
        if (!isMpNotFoundError(err)) throw err;
      }
    }

    if (platformToken) {
      try {
        const search = await MercadoPagoApiClient.searchPayments(platformToken, {
          external_reference: externalReference,
        });
        const payment = paymentId
          ? search.results?.find((p) => String(p.id) === String(paymentId)) ||
            pickBestMpPayment(search.results)
          : pickBestMpPayment(search.results);
        if (payment) {
          return { payment, source: 'platform_search', accessToken: platformToken };
        }
      } catch (err) {
        if (!isMpNotFoundError(err)) throw err;
      }
    }
  }

  throw new Error(
    `Unable to resolve Mercado Pago payment${paymentId ? ` ${paymentId}` : ''} from MP API`
  );
}
