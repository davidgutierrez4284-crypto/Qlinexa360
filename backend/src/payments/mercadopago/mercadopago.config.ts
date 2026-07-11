import { env } from '../../config/env';

export const mercadoPagoConfig = {
  clientId: env.MERCADOPAGO_CLIENT_ID,
  clientSecret: env.MERCADOPAGO_CLIENT_SECRET,
  redirectUri: env.MERCADOPAGO_REDIRECT_URI,
  webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET,
  platformAccessToken: env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN,
  env: env.MERCADOPAGO_ENV,
  marketplaceFeePercentage: env.QLINEXA360_MARKETPLACE_FEE_PERCENTAGE,
  apiBaseUrl: 'https://api.mercadopago.com',
  /** México: auth.mercadopago.com.mx (doc Split Payments / OAuth marketplace). */
  authBaseUrl: env.MERCADOPAGO_AUTH_BASE_URL,
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  },
};

export function getFrontendBaseUrl(): string {
  const frontendUrl = (env.FRONTEND_URL || '').replace(/\/$/, '');
  const baseUrl = (env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

  if (baseUrl.includes('api.qlinexa360.com')) {
    return 'https://www.qlinexa360.com';
  }
  if (frontendUrl) return frontendUrl;
  if (baseUrl.includes('localhost:3000') || baseUrl.includes('127.0.0.1:3000')) {
    return 'http://localhost:5173';
  }
  return 'http://localhost:5173';
}

/** Mercado Pago exige back_urls HTTPS y rechaza localhost (error 400 invalid_back_urls). */
export function isMercadoPagoCompatibleReturnUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1';
  } catch {
    return false;
  }
}

/** Base URL para back_urls de MP; null si no hay URL pública HTTPS (el checkout sigue funcionando). */
export function buildTeleconsultationConsentUrl(confirmationToken: string): string {
  return `${getFrontendBaseUrl()}/teleconsulta/${confirmationToken}`;
}

export function buildConfirmAppointmentUrl(confirmationToken: string): string {
  return `${getFrontendBaseUrl()}/confirm-appointment/${confirmationToken}`;
}

export function getMercadoPagoReturnBaseUrl(): string | null {
  const baseUrl = (env.BASE_URL || '').replace(/\/$/, '');
  if (baseUrl.includes('api.qlinexa360.com')) {
    return 'https://www.qlinexa360.com';
  }

  const candidates = [env.FRONTEND_PUBLIC_URL, env.FRONTEND_URL]
    .map((u) => (u || '').replace(/\/$/, ''))
    .filter(Boolean);

  for (const url of candidates) {
    if (isMercadoPagoCompatibleReturnUrl(url)) return url;
  }
  return null;
}
