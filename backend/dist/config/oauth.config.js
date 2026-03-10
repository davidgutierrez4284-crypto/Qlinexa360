"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOAuthConfig = exports.isOAuthConfigured = exports.oauthConfig = void 0;
exports.oauthConfig = {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar-sync/auth/google/callback',
        scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token'
    },
    outlook: {
        clientId: process.env.OUTLOOK_CLIENT_ID || '',
        clientSecret: process.env.OUTLOOK_CLIENT_SECRET || '',
        redirectUri: process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:3000/api/calendar-sync/auth/outlook/callback',
        scope: 'offline_access Calendars.ReadWrite OnlineMeetings.ReadWrite',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    },
    notion: {
        clientId: process.env.NOTION_CLIENT_ID || '',
        clientSecret: process.env.NOTION_CLIENT_SECRET || '',
        redirectUri: process.env.NOTION_REDIRECT_URI || 'http://localhost:3000/api/calendar-sync/auth/notion/callback',
        scope: '', // Notion no usa scopes tradicionales, los permisos se configuran en la integración
        authUrl: 'https://api.notion.com/v1/oauth/authorize',
        tokenUrl: 'https://api.notion.com/v1/oauth/token'
    },
    apple: {
        clientId: process.env.APPLE_CLIENT_ID || '',
        clientSecret: process.env.APPLE_CLIENT_SECRET || '',
        redirectUri: process.env.APPLE_REDIRECT_URI || 'http://localhost:3000/api/calendar-sync/auth/apple/callback',
        scope: 'calendars',
        authUrl: 'https://appleid.apple.com/auth/authorize',
        tokenUrl: 'https://appleid.apple.com/auth/token'
    }
};
const isOAuthConfigured = (provider) => {
    const config = exports.oauthConfig[provider];
    return !!((config === null || config === void 0 ? void 0 : config.clientId) && (config === null || config === void 0 ? void 0 : config.clientSecret));
};
exports.isOAuthConfigured = isOAuthConfigured;
const getOAuthConfig = (provider) => {
    if (!(0, exports.isOAuthConfigured)(provider)) {
        return null;
    }
    return exports.oauthConfig[provider];
};
exports.getOAuthConfig = getOAuthConfig;
