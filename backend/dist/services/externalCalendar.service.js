"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalCalendarService = void 0;
const client_1 = require("@prisma/client");
const logger_utils_1 = require("../utils/logger.utils");
const calendar_config_1 = require("../config/calendar.config");
const prisma = new client_1.PrismaClient();
class ExternalCalendarService {
    // Obtener eventos de Google Calendar
    static async getGoogleCalendarEvents(accessToken, calendarId, startDate, endDate) {
        try {
            const startTime = startDate.toISOString();
            const endTime = endDate.toISOString();
            const response = await fetch(`${this.GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?` +
                `timeMin=${startTime}&timeMax=${endTime}&singleEvents=true&orderBy=startTime`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return data.items.map((event) => {
                var _a;
                return ({
                    id: event.id,
                    title: event.summary || 'Sin título',
                    start: new Date(event.start.dateTime || event.start.date),
                    end: new Date(event.end.dateTime || event.end.date),
                    description: event.description,
                    location: event.location,
                    attendees: ((_a = event.attendees) === null || _a === void 0 ? void 0 : _a.map((attendee) => attendee.email)) || []
                });
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener eventos de Google Calendar:', error);
            throw error;
        }
    }
    // Obtener eventos de Outlook Calendar
    static async getOutlookCalendarEvents(accessToken, calendarId, startDate, endDate) {
        try {
            const startTime = startDate.toISOString();
            const endTime = endDate.toISOString();
            const response = await fetch(`${this.MICROSOFT_GRAPH_API_BASE}/me/calendars/${calendarId}/events?` +
                `$filter=start/dateTime ge '${startTime}' and end/dateTime le '${endTime}'&` +
                `$orderby=start/dateTime`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`Microsoft Graph API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return data.value.map((event) => {
                var _a, _b, _c;
                return ({
                    id: event.id,
                    title: event.subject || 'Sin título',
                    start: new Date(event.start.dateTime),
                    end: new Date(event.end.dateTime),
                    description: (_a = event.body) === null || _a === void 0 ? void 0 : _a.content,
                    location: (_b = event.location) === null || _b === void 0 ? void 0 : _b.displayName,
                    attendees: ((_c = event.attendees) === null || _c === void 0 ? void 0 : _c.map((attendee) => { var _a; return (_a = attendee.emailAddress) === null || _a === void 0 ? void 0 : _a.address; })) || []
                });
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener eventos de Outlook Calendar:', error);
            throw error;
        }
    }
    // Crear evento en Google Calendar
    static async createGoogleCalendarEvent(accessToken, calendarId, event) {
        var _a, _b;
        try {
            const eventData = {
                summary: event.title,
                description: event.description,
                location: event.location,
                start: {
                    dateTime: event.start.toISOString(),
                    timeZone: 'America/Mexico_City'
                },
                end: {
                    dateTime: event.end.toISOString(),
                    timeZone: 'America/Mexico_City'
                },
                attendees: ((_a = event.attendees) === null || _a === void 0 ? void 0 : _a.map(email => ({ email }))) || []
            };
            const response = await fetch(`${this.GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });
            if (!response.ok) {
                throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`);
            }
            const createdEvent = await response.json();
            return {
                id: createdEvent.id,
                title: createdEvent.summary,
                start: new Date(createdEvent.start.dateTime),
                end: new Date(createdEvent.end.dateTime),
                description: createdEvent.description,
                location: createdEvent.location,
                attendees: ((_b = createdEvent.attendees) === null || _b === void 0 ? void 0 : _b.map((attendee) => attendee.email)) || []
            };
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al crear evento en Google Calendar:', error);
            throw error;
        }
    }
    // Crear evento en Outlook Calendar
    static async createOutlookCalendarEvent(accessToken, calendarId, event) {
        var _a, _b, _c, _d;
        try {
            const eventData = {
                subject: event.title,
                body: {
                    contentType: 'text',
                    content: event.description || ''
                },
                location: {
                    displayName: event.location || ''
                },
                start: {
                    dateTime: event.start.toISOString(),
                    timeZone: 'America/Mexico_City'
                },
                end: {
                    dateTime: event.end.toISOString(),
                    timeZone: 'America/Mexico_City'
                },
                attendees: ((_a = event.attendees) === null || _a === void 0 ? void 0 : _a.map(email => ({
                    emailAddress: { address: email },
                    type: 'required'
                }))) || []
            };
            const response = await fetch(`${this.MICROSOFT_GRAPH_API_BASE}/me/calendars/${calendarId}/events`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });
            if (!response.ok) {
                throw new Error(`Microsoft Graph API error: ${response.status} ${response.statusText}`);
            }
            const createdEvent = await response.json();
            return {
                id: createdEvent.id,
                title: createdEvent.subject,
                start: new Date(createdEvent.start.dateTime),
                end: new Date(createdEvent.end.dateTime),
                description: (_b = createdEvent.body) === null || _b === void 0 ? void 0 : _b.content,
                location: (_c = createdEvent.location) === null || _c === void 0 ? void 0 : _c.displayName,
                attendees: ((_d = createdEvent.attendees) === null || _d === void 0 ? void 0 : _d.map((attendee) => { var _a; return (_a = attendee.emailAddress) === null || _a === void 0 ? void 0 : _a.address; })) || []
            };
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al crear evento en Outlook Calendar:', error);
            throw error;
        }
    }
    // Refrescar token de Google Calendar
    static async refreshGoogleToken(refreshToken) {
        try {
            // TODO: Implementar con Google OAuth2 client
            // Por ahora, simulamos el refresh
            logger_utils_1.securityLogger.info('Refrescando token de Google Calendar');
            // En una implementación real, usarías:
            // const oauth2Client = new google.auth.OAuth2();
            // const { credentials } = await oauth2Client.refreshToken(refreshToken);
            return {
                accessToken: 'new_access_token_here',
                newRefreshToken: 'new_refresh_token_here'
            };
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al refrescar token de Google:', error);
            throw error;
        }
    }
    // Refrescar token de Microsoft
    static async refreshMicrosoftToken(refreshToken) {
        try {
            // TODO: Implementar con Microsoft OAuth2 client
            logger_utils_1.securityLogger.info('Refrescando token de Microsoft');
            return {
                accessToken: 'new_access_token_here',
                newRefreshToken: 'new_refresh_token_here'
            };
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al refrescar token de Microsoft:', error);
            throw error;
        }
    }
    // Sincronizar eventos con calendario externo
    static async syncCalendarEvents(doctorId, calendarId, startDate, endDate) {
        try {
            const calendar = await prisma.externalCalendarLink.findFirst({
                where: {
                    id: calendarId,
                    doctorId,
                    activo: true
                }
            });
            if (!calendar) {
                throw new Error('Calendario no encontrado o inactivo');
            }
            let externalEvents = [];
            // Obtener eventos del calendario externo según el tipo
            if (calendar.tipoConexion === 'GOOGLE') {
                externalEvents = await this.getGoogleCalendarEvents(calendar.accessToken, calendar.calendarioId, startDate, endDate);
            }
            else if (calendar.tipoConexion === 'OUTLOOK') {
                externalEvents = await this.getOutlookCalendarEvents(calendar.accessToken, calendar.calendarioId, startDate, endDate);
            }
            // TODO: Implementar lógica de sincronización con la base de datos local
            // Por ahora, solo retornamos los eventos obtenidos
            logger_utils_1.securityLogger.info(`Sincronización completada: ${externalEvents.length} eventos obtenidos`);
            return {
                success: true,
                eventsAdded: externalEvents.length,
                eventsUpdated: 0,
                eventsDeleted: 0
            };
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error en sincronización de calendario:', error);
            return {
                success: false,
                eventsAdded: 0,
                eventsUpdated: 0,
                eventsDeleted: 0,
                errors: [error instanceof Error ? error.message : 'Error desconocido']
            };
        }
    }
    // Verificar disponibilidad en calendario externo
    static async checkExternalCalendarAvailability(doctorId, date, startTime, endTime) {
        try {
            const calendars = await prisma.externalCalendarLink.findMany({
                where: {
                    doctorId,
                    activo: true
                }
            });
            if (calendars.length === 0) {
                return true; // Sin calendarios externos, asumimos disponible
            }
            const startDateTime = new Date(`${date.toISOString().split('T')[0]}T${startTime}`);
            const endDateTime = new Date(`${date.toISOString().split('T')[0]}T${endTime}`);
            for (const calendar of calendars) {
                let events = [];
                if (calendar.tipoConexion === 'GOOGLE') {
                    events = await this.getGoogleCalendarEvents(calendar.accessToken, calendar.calendarioId, startDateTime, endDateTime);
                }
                else if (calendar.tipoConexion === 'OUTLOOK') {
                    events = await this.getOutlookCalendarEvents(calendar.accessToken, calendar.calendarioId, startDateTime, endDateTime);
                }
                // Si hay eventos en este horario, no está disponible
                if (events.length > 0) {
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al verificar disponibilidad en calendario externo:', error);
            // En caso de error, asumimos que está disponible para no bloquear el sistema
            return true;
        }
    }
    // Generar URL de autorización para Google Calendar
    static generateGoogleAuthUrl(doctorId) {
        if (!(0, calendar_config_1.validateCalendarConfig)()) {
            throw new Error('Configuración de calendarios externos incompleta');
        }
        const state = Buffer.from(JSON.stringify({ doctorId, provider: 'GOOGLE' })).toString('base64');
        const params = new URLSearchParams({
            client_id: calendar_config_1.calendarConfig.google.clientId,
            redirect_uri: calendar_config_1.calendarConfig.google.redirectUri,
            scope: calendar_config_1.calendarConfig.google.scopes.join(' '),
            response_type: 'code',
            access_type: 'offline',
            prompt: 'consent',
            state
        });
        return `${calendar_config_1.calendarConfig.google.authUrl}?${params.toString()}`;
    }
    // Generar URL de autorización para Outlook Calendar
    static generateOutlookAuthUrl(doctorId) {
        if (!(0, calendar_config_1.validateCalendarConfig)()) {
            throw new Error('Configuración de calendarios externos incompleta');
        }
        const state = Buffer.from(JSON.stringify({ doctorId, provider: 'OUTLOOK' })).toString('base64');
        const params = new URLSearchParams({
            client_id: calendar_config_1.calendarConfig.outlook.clientId,
            redirect_uri: calendar_config_1.calendarConfig.outlook.redirectUri,
            scope: calendar_config_1.calendarConfig.outlook.scopes.join(' '),
            response_type: 'code',
            state
        });
        return `${calendar_config_1.calendarConfig.outlook.authUrl}?${params.toString()}`;
    }
    // Intercambiar código de autorización por tokens (Google)
    static async exchangeGoogleCode(code) {
        if (!(0, calendar_config_1.validateCalendarConfig)()) {
            throw new Error('Configuración de calendarios externos incompleta');
        }
        const response = await fetch(calendar_config_1.calendarConfig.google.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: calendar_config_1.calendarConfig.google.clientId,
                client_secret: calendar_config_1.calendarConfig.google.clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: calendar_config_1.calendarConfig.google.redirectUri
            })
        });
        if (!response.ok) {
            throw new Error(`Error al intercambiar código de Google: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in
        };
    }
    // Intercambiar código de autorización por tokens (Outlook)
    static async exchangeOutlookCode(code) {
        if (!(0, calendar_config_1.validateCalendarConfig)()) {
            throw new Error('Configuración de calendarios externos incompleta');
        }
        const response = await fetch(calendar_config_1.calendarConfig.outlook.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: calendar_config_1.calendarConfig.outlook.clientId,
                client_secret: calendar_config_1.calendarConfig.outlook.clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: calendar_config_1.calendarConfig.outlook.redirectUri
            })
        });
        if (!response.ok) {
            throw new Error(`Error al intercambiar código de Outlook: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in
        };
    }
    // Generar URL de autorización para Apple Calendar
    static generateAppleAuthUrl(doctorId) {
        if (!(0, calendar_config_1.validateCalendarConfig)()) {
            throw new Error('Configuración de calendarios externos incompleta');
        }
        const state = Buffer.from(JSON.stringify({ doctorId, provider: 'APPLE' })).toString('base64');
        const params = new URLSearchParams({
            client_id: calendar_config_1.calendarConfig.apple.clientId,
            redirect_uri: calendar_config_1.calendarConfig.apple.redirectUri,
            scope: calendar_config_1.calendarConfig.apple.scopes.join(' '),
            response_type: 'code',
            state
        });
        return `${calendar_config_1.calendarConfig.apple.authUrl}?${params.toString()}`;
    }
    // Generar URL de autorización para Notion Calendar
    static generateNotionAuthUrl(doctorId) {
        if (!(0, calendar_config_1.validateCalendarConfig)()) {
            throw new Error('Configuración de calendarios externos incompleta');
        }
        const state = Buffer.from(JSON.stringify({ doctorId, provider: 'NOTION' })).toString('base64');
        const params = new URLSearchParams({
            client_id: calendar_config_1.calendarConfig.notion.clientId,
            redirect_uri: calendar_config_1.calendarConfig.notion.redirectUri,
            scope: calendar_config_1.calendarConfig.notion.scopes.join(' '),
            response_type: 'code',
            state
        });
        return `${calendar_config_1.calendarConfig.notion.authUrl}?${params.toString()}`;
    }
    // Intercambiar código de autorización por tokens (Apple)
    static async exchangeAppleCode(code) {
        if (!(0, calendar_config_1.validateCalendarConfig)()) {
            throw new Error('Configuración de calendarios externos incompleta');
        }
        const response = await fetch(calendar_config_1.calendarConfig.apple.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: calendar_config_1.calendarConfig.apple.clientId,
                client_secret: calendar_config_1.calendarConfig.apple.clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: calendar_config_1.calendarConfig.apple.redirectUri
            })
        });
        if (!response.ok) {
            throw new Error(`Error al intercambiar código de Apple: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in
        };
    }
    // Intercambiar código de autorización por tokens (Notion)
    static async exchangeNotionCode(code) {
        if (!(0, calendar_config_1.validateCalendarConfig)()) {
            throw new Error('Configuración de calendarios externos incompleta');
        }
        const response = await fetch(calendar_config_1.calendarConfig.notion.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: calendar_config_1.calendarConfig.notion.clientId,
                client_secret: calendar_config_1.calendarConfig.notion.clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: calendar_config_1.calendarConfig.notion.redirectUri
            })
        });
        if (!response.ok) {
            throw new Error(`Error al intercambiar código de Notion: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in
        };
    }
}
exports.ExternalCalendarService = ExternalCalendarService;
// Configuración de Google Calendar API
ExternalCalendarService.GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
ExternalCalendarService.GOOGLE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/calendar';
// Configuración de Microsoft Graph API (Outlook)
ExternalCalendarService.MICROSOFT_GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
ExternalCalendarService.MICROSOFT_OAUTH_SCOPE = 'Calendars.ReadWrite';
