import axios from 'axios';
import { OAuthConfig, getOAuthConfig } from '../config/oauth.config';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export class OAuthService {
  // Generar URL de autorización OAuth2
  static generateAuthUrl(provider: string, state: string): string | null {
    const config = getOAuthConfig(provider);
    if (!config) {
      console.warn(`OAuth no configurado para ${provider}`);
      return null;
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope,
      response_type: 'code',
      state: state
    });

    if (provider === 'google') {
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
      params.set('include_granted_scopes', 'true');
    } else if (provider === 'outlook') {
      params.set('response_mode', 'query');
      params.set('prompt', 'consent');
    }

    return `${config.authUrl}?${params.toString()}`;
  }

  // Intercambiar código de autorización por tokens
  static async exchangeCodeForTokens(provider: string, code: string): Promise<OAuthTokens | null> {
    const config = getOAuthConfig(provider);
    if (!config) {
      console.error(`OAuth no configurado para ${provider}`);
      return null;
    }

    try {
      const tokenData = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri
      });

      const response = await axios.post(config.tokenUrl, tokenData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Error intercambiando código por tokens para ${provider}:`, error);
      return null;
    }
  }

  // Refrescar token de acceso
  static async refreshAccessToken(provider: string, refreshToken: string): Promise<OAuthTokens | null> {
    const config = getOAuthConfig(provider);
    if (!config) {
      console.error(`OAuth no configurado para ${provider}`);
      return null;
    }

    try {
      const tokenData = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      const response = await axios.post(config.tokenUrl, tokenData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Error refrescando token para ${provider}:`, error);
      return null;
    }
  }

  // Verificar si un token es válido
  static async validateToken(provider: string, accessToken: string): Promise<boolean> {
    try {
      switch (provider) {
        case 'google':
          const googleResponse = await axios.get('https://www.googleapis.com/oauth2/v1/tokeninfo', {
            params: { access_token: accessToken }
          });
          return googleResponse.status === 200;

        case 'outlook':
          const outlookResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          return outlookResponse.status === 200;

        default:
          return false;
      }
    } catch (error) {
      console.error(`Error validando token para ${provider}:`, error);
      return false;
    }
  }
}
