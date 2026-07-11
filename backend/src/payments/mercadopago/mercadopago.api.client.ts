import axios from 'axios';
import { mercadoPagoConfig } from './mercadopago.config';

type MpTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
  public_key?: string;
};

export class MercadoPagoApiClient {
  static async exchangeAuthorizationCode(code: string): Promise<MpTokenResponse> {
    const { data } = await axios.post<MpTokenResponse>(
      `${mercadoPagoConfig.apiBaseUrl}/oauth/token`,
      {
        client_id: mercadoPagoConfig.clientId,
        client_secret: mercadoPagoConfig.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: mercadoPagoConfig.redirectUri,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return data;
  }

  static async refreshAccessToken(refreshToken: string): Promise<MpTokenResponse> {
    const { data } = await axios.post<MpTokenResponse>(
      `${mercadoPagoConfig.apiBaseUrl}/oauth/token`,
      {
        client_id: mercadoPagoConfig.clientId,
        client_secret: mercadoPagoConfig.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return data;
  }

  static async createPreference(accessToken: string, payload: Record<string, unknown>) {
    try {
      const { data } = await axios.post(
        `${mercadoPagoConfig.apiBaseUrl}/checkout/preferences`,
        payload,
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
      );
      return data as { id: string; init_point: string; sandbox_init_point?: string };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const mpBody = error.response?.data;
        const mpMessage =
          mpBody && typeof mpBody === 'object' && 'message' in mpBody
            ? String((mpBody as { message: unknown }).message)
            : error.message;
        const detail = mpBody ? JSON.stringify(mpBody) : mpMessage;
        throw new Error(
          `Mercado Pago createPreference ${error.response?.status ?? 'error'}: ${detail}`
        );
      }
      throw error;
    }
  }

  static async getPayment(accessToken: string, paymentId: string) {
    const { data } = await axios.get(`${mercadoPagoConfig.apiBaseUrl}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data as MpPaymentPayload;
  }

  static async searchPayments(
    accessToken: string,
    filters: { external_reference?: string }
  ) {
    const params = new URLSearchParams({
      sort: 'date_created',
      criteria: 'desc',
      range: 'date_created',
      begin_date: 'NOW-30DAYS',
      end_date: 'NOW',
    });
    if (filters.external_reference) params.set('external_reference', filters.external_reference);
    const { data } = await axios.get(`${mercadoPagoConfig.apiBaseUrl}/v1/payments/search?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data as { results?: MpPaymentPayload[]; paging?: { total: number } };
  }

  static async getMerchantOrder(accessToken: string, merchantOrderId: string) {
    const { data } = await axios.get(
      `${mercadoPagoConfig.apiBaseUrl}/merchant_orders/${merchantOrderId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return data as {
      preference_id?: string;
      payments?: Array<{ id: number; status: string }>;
    };
  }

  static async searchMerchantOrders(
    accessToken: string,
    filters: { preference_id?: string; external_reference?: string }
  ) {
    const params = new URLSearchParams();
    if (filters.preference_id) params.set('preference_id', filters.preference_id);
    if (filters.external_reference) params.set('external_reference', filters.external_reference);
    const { data } = await axios.get(
      `${mercadoPagoConfig.apiBaseUrl}/merchant_orders/search?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return data as {
      elements?: Array<{
        id: number;
        preference_id?: string;
        external_reference?: string;
        payments?: Array<{ id: number; status: string }>;
      }>;
    };
  }

  static async createRefund(
    accessToken: string,
    paymentId: string,
    options?: { amount?: number; idempotencyKey?: string }
  ) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    if (options?.idempotencyKey) {
      headers['X-Idempotency-Key'] = options.idempotencyKey;
    }
    const body = options?.amount != null ? { amount: options.amount } : undefined;
    try {
      const { data } = await axios.post(
        `${mercadoPagoConfig.apiBaseUrl}/v1/payments/${paymentId}/refunds`,
        body,
        { headers }
      );
      return data as MpRefundPayload;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const mpBody = error.response?.data;
        const detail = mpBody ? JSON.stringify(mpBody) : error.message;
        throw new Error(
          `Mercado Pago createRefund ${error.response?.status ?? 'error'}: ${detail}`
        );
      }
      throw error;
    }
  }
}

type MpRefundPayload = {
  id: number;
  payment_id: number;
  amount: number;
  status: string;
};

type MpPaymentPayload = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string;
  metadata?: Record<string, string>;
  fee_details?: Array<{ type?: string; amount?: number; fee_payer?: string }>;
  transaction_details?: {
    net_received_amount?: number;
    total_paid_amount?: number;
  };
};
