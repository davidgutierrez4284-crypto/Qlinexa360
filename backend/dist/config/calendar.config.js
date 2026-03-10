"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCalendarConfig = exports.calendarConfig = void 0;
exports.calendarConfig = {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/external-calendars/google/callback',
        scopes: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/userinfo.email'
        ],
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        apiBaseUrl: 'https://www.googleapis.com/calendar/v3'
    },
    outlook: {
        clientId: process.env.OUTLOOK_CLIENT_ID || '',
        clientSecret: process.env.OUTLOOK_CLIENT_SECRET || '',
        redirectUri: process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:3000/api/external-calendars/outlook/callback',
        scopes: [
            'https://graph.microsoft.com/Calendars.ReadWrite',
            'https://graph.microsoft.com/User.Read'
        ],
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        apiBaseUrl: 'https://graph.microsoft.com/v1.0'
    },
    apple: {
        clientId: process.env.APPLE_CLIENT_ID || '',
        clientSecret: process.env.APPLE_CLIENT_SECRET || '',
        redirectUri: process.env.APPLE_REDIRECT_URI || 'http://localhost:3000/api/external-calendars/apple/callback',
        scopes: [
            'https://caldav.icloud.com/',
            'https://www.icloud.com/'
        ],
        authUrl: 'https://appleid.apple.com/auth/authorize',
        tokenUrl: 'https://appleid.apple.com/auth/token',
        apiBaseUrl: 'https://caldav.icloud.com'
    },
    notion: {
        clientId: process.env.NOTION_CLIENT_ID || '',
        clientSecret: process.env.NOTION_CLIENT_SECRET || '',
        redirectUri: process.env.NOTION_REDIRECT_URI || 'http://localhost:3000/api/external-calendars/notion/callback',
        scopes: [
            'calendar:read',
            'calendar:write'
        ],
        authUrl: 'https://api.notion.com/v1/oauth/authorize',
        tokenUrl: 'https://api.notion.com/v1/oauth/token',
        apiBaseUrl: 'https://api.notion.com/v1'
    }
};
const validateCalendarConfig = () => {
    const missingVars = [];
    if (!exports.calendarConfig.google.clientId)
        missingVars.push('GOOGLE_CLIENT_ID');
    if (!exports.calendarConfig.google.clientSecret)
        missingVars.push('GOOGLE_CLIENT_SECRET');
    if (!exports.calendarConfig.outlook.clientId)
        missingVars.push('OUTLOOK_CLIENT_ID');
    if (!exports.calendarConfig.outlook.clientSecret)
        missingVars.push('OUTLOOK_CLIENT_SECRET');
    if (!exports.calendarConfig.apple.clientId)
        missingVars.push('APPLE_CLIENT_ID');
    if (!exports.calendarConfig.apple.clientSecret)
        missingVars.push('APPLE_CLIENT_SECRET');
    if (!exports.calendarConfig.notion.clientId)
        missingVars.push('NOTION_CLIENT_ID');
    if (!exports.calendarConfig.notion.clientSecret)
        missingVars.push('NOTION_CLIENT_SECRET');
    if (missingVars.length > 0) {
        console.warn('⚠️ Variables de entorno faltantes para calendarios externos:', missingVars.join(', '));
        return false;
    }
    return true;
};
exports.validateCalendarConfig = validateCalendarConfig;
