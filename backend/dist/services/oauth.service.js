"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthService = void 0;
const axios_1 = __importDefault(require("axios"));
const oauth_config_1 = require("../config/oauth.config");
class OAuthService {
    // Generar URL de autorización OAuth2
    static generateAuthUrl(provider, state) {
        const config = (0, oauth_config_1.getOAuthConfig)(provider);
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
        }
        else if (provider === 'outlook') {
            params.set('response_mode', 'query');
            params.set('prompt', 'consent');
        }
        return `${config.authUrl}?${params.toString()}`;
    }
    // Intercambiar código de autorización por tokens
    static async exchangeCodeForTokens(provider, code) {
        const config = (0, oauth_config_1.getOAuthConfig)(provider);
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
            const response = await axios_1.default.post(config.tokenUrl, tokenData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error(`Error intercambiando código por tokens para ${provider}:`, error);
            return null;
        }
    }
    // Refrescar token de acceso
    static async refreshAccessToken(provider, refreshToken) {
        const config = (0, oauth_config_1.getOAuthConfig)(provider);
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
            const response = await axios_1.default.post(config.tokenUrl, tokenData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error(`Error refrescando token para ${provider}:`, error);
            return null;
        }
    }
    // Verificar si un token es válido
    static async validateToken(provider, accessToken) {
        try {
            switch (provider) {
                case 'google':
                    const googleResponse = await axios_1.default.get('https://www.googleapis.com/oauth2/v1/tokeninfo', {
                        params: { access_token: accessToken }
                    });
                    return googleResponse.status === 200;
                case 'outlook':
                    const outlookResponse = await axios_1.default.get('https://graph.microsoft.com/v1.0/me', {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    return outlookResponse.status === 200;
                default:
                    return false;
            }
        }
        catch (error) {
            console.error(`Error validando token para ${provider}:`, error);
            return false;
        }
    }
}
exports.OAuthService = OAuthService;
