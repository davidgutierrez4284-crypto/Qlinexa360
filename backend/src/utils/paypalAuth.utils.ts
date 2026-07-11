import axios from 'axios';

export function getPayPalApiBaseUrl(): string {
  const isSandbox = process.env.PAYPAL_ENVIRONMENT === 'sandbox' || !process.env.PAYPAL_ENVIRONMENT;
  return isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}

export async function getPayPalAccessToken(): Promise<string | null> {
  try {
    const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim();
    const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
    const baseUrl = getPayPalApiBaseUrl();

    if (!clientId || !clientSecret) {
      console.error(
        'PayPal credentials not configured (clientId:',
        !!clientId,
        ', clientSecret:',
        !!clientSecret,
        ')',
      );
      return null;
    }

    const response = await axios.post(
      `${baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: clientId,
          password: clientSecret,
        },
      },
    );

    return response.data.access_token;
  } catch (error: any) {
    const paypalError = error.response?.data;
    const status = error.response?.status;
    console.error('Error obteniendo token de PayPal:', {
      status,
      error: paypalError?.error || paypalError?.error_description || error.message,
    });
    return null;
  }
}
