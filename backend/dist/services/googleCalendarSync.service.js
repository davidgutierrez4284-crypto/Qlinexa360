"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleCalendarSyncService = void 0;
const client_1 = require("@prisma/client");
const googleapis_1 = require("googleapis");
const node_crypto_1 = require("node:crypto");
const oauth_service_1 = require("./oauth.service");
const calendarAuth_utils_1 = require("../utils/calendarAuth.utils");
const oauth_config_1 = require("../config/oauth.config");
const prisma = new client_1.PrismaClient();
class GoogleCalendarSyncService {
    static createClient() {
        const config = (0, oauth_config_1.getOAuthConfig)('google');
        if (!config) {
            return null;
        }
        const authClient = new googleapis_1.google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth: authClient });
        return { calendar, authClient };
    }
    static async getDoctorConfig(doctorId) {
        return prisma.calendarSyncConfig.findFirst({
            where: {
                doctorId,
                provider: 'google',
                isConnected: true,
                accessToken: { not: null }
            }
        });
    }
    static async ensureValidCredentials(authClient, config) {
        var _a, _b;
        if (config.expiresAt &&
            config.expiresAt.getTime() <= Date.now() + 60 * 1000 &&
            config.refreshToken) {
            const refreshed = await oauth_service_1.OAuthService.refreshAccessToken('google', config.refreshToken);
            if (refreshed === null || refreshed === void 0 ? void 0 : refreshed.access_token) {
                const updated = await prisma.calendarSyncConfig.update({
                    where: { id: config.id },
                    data: {
                        accessToken: refreshed.access_token,
                        refreshToken: refreshed.refresh_token || config.refreshToken,
                        expiresAt: refreshed.expires_in
                            ? new Date(Date.now() + refreshed.expires_in * 1000)
                            : config.expiresAt,
                        error: null
                    }
                });
                config = updated;
            }
            else {
                await (0, calendarAuth_utils_1.notifyCalendarReconnectNeeded)({
                    doctorId: config.doctorId,
                    provider: 'google',
                    reason: 'Conexión expirada. Vuelve a conectar Google Calendar.'
                });
            }
        }
        authClient.setCredentials({
            access_token: (_a = config.accessToken) !== null && _a !== void 0 ? _a : undefined,
            refresh_token: (_b = config.refreshToken) !== null && _b !== void 0 ? _b : undefined
        });
        return config;
    }
    static buildEventBody(payload) {
        var _a, _b;
        // Si hay attendees (pacientes), agregar emoji de Qlinexa360 y "consulta" al título para que se destaque en el calendario del paciente
        // Primero limpiar TODOS los emojis 🏥 y la palabra "consulta" que puedan existir
        let cleanTitle = payload.title.replace(/🏥\s*/g, '').trim();
        cleanTitle = cleanTitle.replace(/\s+consulta$/i, '').trim();
        const titleForExternal = payload.attendees && payload.attendees.length > 0
            ? `🏥 ${cleanTitle} consulta`
            : cleanTitle;
        const event = {
            summary: titleForExternal,
            description: (_a = payload.description) !== null && _a !== void 0 ? _a : undefined,
            start: {
                dateTime: payload.start.toISOString(),
                timeZone: GoogleCalendarSyncService.TIMEZONE
            },
            end: {
                dateTime: payload.end.toISOString(),
                timeZone: GoogleCalendarSyncService.TIMEZONE
            },
            location: (_b = payload.location) !== null && _b !== void 0 ? _b : undefined
        };
        if (payload.attendees && payload.attendees.length > 0) {
            event.attendees = payload.attendees.map(email => ({
                email,
                responseStatus: payload.attendeesResponseStatus
            }));
        }
        return event;
    }
    static async executeWithRetry(calendar, authClient, config, fn) {
        var _a, _b, _c;
        try {
            const result = await fn(calendar);
            return { result, updatedConfig: config };
        }
        catch (error) {
            const status = (error === null || error === void 0 ? void 0 : error.code) || ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status);
            if ((status === 401 || status === 403) && config.refreshToken) {
                const refreshed = await oauth_service_1.OAuthService.refreshAccessToken('google', config.refreshToken);
                if (!(refreshed === null || refreshed === void 0 ? void 0 : refreshed.access_token)) {
                    await (0, calendarAuth_utils_1.notifyCalendarReconnectNeeded)({
                        doctorId: config.doctorId,
                        provider: 'google',
                        reason: 'Conexión expirada. Vuelve a conectar Google Calendar.'
                    });
                    throw error;
                }
                const updatedConfig = await prisma.calendarSyncConfig.update({
                    where: { id: config.id },
                    data: {
                        accessToken: refreshed.access_token,
                        refreshToken: refreshed.refresh_token || config.refreshToken,
                        expiresAt: refreshed.expires_in
                            ? new Date(Date.now() + refreshed.expires_in * 1000)
                            : config.expiresAt,
                        error: null
                    }
                });
                authClient.setCredentials({
                    access_token: (_b = updatedConfig.accessToken) !== null && _b !== void 0 ? _b : undefined,
                    refresh_token: (_c = updatedConfig.refreshToken) !== null && _c !== void 0 ? _c : undefined
                });
                const result = await fn(calendar);
                return { result, updatedConfig };
            }
            throw error;
        }
    }
    static async upsertEvent(doctorId, payload) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const client = GoogleCalendarSyncService.createClient();
        if (!client) {
            return null;
        }
        const { calendar, authClient } = client;
        const config = await GoogleCalendarSyncService.getDoctorConfig(doctorId);
        if (!config) {
            return null;
        }
        let workingConfig = await GoogleCalendarSyncService.ensureValidCredentials(authClient, config);
        const requestBody = GoogleCalendarSyncService.buildEventBody(payload);
        const wantsConference = payload.conferenceType === 'google-meet';
        const existingConferenceLink = (_a = payload.conferenceLink) !== null && _a !== void 0 ? _a : null;
        const hasExistingGoogleMeet = !!existingConferenceLink && existingConferenceLink.includes('meet.google.com');
        const shouldCreateConference = (wantsConference || payload.googleMeetEnabled) && !hasExistingGoogleMeet;
        if (shouldCreateConference) {
            requestBody.conferenceData = {
                createRequest: {
                    requestId: (0, node_crypto_1.randomUUID)(),
                    conferenceSolutionKey: {
                        type: 'hangoutsMeet'
                    }
                }
            };
        }
        try {
            console.log('🔧 GoogleCalendarSyncService.upsertEvent:');
            console.log('   Event ID:', payload.id);
            console.log('   External Event ID:', payload.externalEventId || 'NUEVO');
            console.log('   Attendees:', ((_b = payload.attendees) === null || _b === void 0 ? void 0 : _b.join(', ')) || 'NINGUNO');
            console.log('   Request Body attendees:', ((_c = requestBody.attendees) === null || _c === void 0 ? void 0 : _c.map(a => a.email).join(', ')) || 'NINGUNO');
            const { result } = await GoogleCalendarSyncService.executeWithRetry(calendar, authClient, workingConfig, async (cal) => {
                var _a, _b, _c;
                if (payload.externalEventId) {
                    try {
                        console.log('   📝 Actualizando evento existente en Google Calendar...');
                        const updateParams = {
                            calendarId: GoogleCalendarSyncService.CALENDAR_ID,
                            eventId: payload.externalEventId,
                            requestBody,
                            // CRÍTICO: Enviar invitaciones a todos los attendees (pacientes) cuando se actualiza
                            sendUpdates: 'all' // 'all' envía a todos, 'externalOnly' solo a externos, 'none' no envía
                        };
                        if (shouldCreateConference) {
                            updateParams.conferenceDataVersion = 1;
                        }
                        const result = await cal.events.patch(updateParams);
                        console.log('   ✅ Evento actualizado en Google Calendar');
                        console.log('   📧 Invitaciones enviadas a:', ((_a = requestBody.attendees) === null || _a === void 0 ? void 0 : _a.map(a => a.email).join(', ')) || 'NINGUNO');
                        return result;
                    }
                    catch (error) {
                        const status = (error === null || error === void 0 ? void 0 : error.code) || ((_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.status);
                        if (status !== 404) {
                            throw error;
                        }
                    }
                }
                console.log('   📝 Creando nuevo evento en Google Calendar...');
                const insertParams = {
                    calendarId: GoogleCalendarSyncService.CALENDAR_ID,
                    requestBody,
                    // CRÍTICO: Enviar invitaciones a todos los attendees (pacientes)
                    sendUpdates: 'all' // 'all' envía a todos, 'externalOnly' solo a externos, 'none' no envía
                };
                if (shouldCreateConference) {
                    insertParams.conferenceDataVersion = 1;
                }
                const result = await cal.events.insert(insertParams);
                console.log('   ✅ Evento creado en Google Calendar con ID:', result.data.id);
                console.log('   📧 Invitaciones enviadas a:', ((_c = requestBody.attendees) === null || _c === void 0 ? void 0 : _c.map(a => a.email).join(', ')) || 'NINGUNO');
                return result;
            });
            const updatedEvent = result.data;
            if (!(updatedEvent === null || updatedEvent === void 0 ? void 0 : updatedEvent.id)) {
                return null;
            }
            await prisma.calendarSyncConfig.update({
                where: { id: workingConfig.id },
                data: {
                    lastSync: new Date(),
                    error: null
                }
            });
            const conferenceLink = updatedEvent.hangoutLink ||
                ((_f = (_e = (_d = updatedEvent.conferenceData) === null || _d === void 0 ? void 0 : _d.entryPoints) === null || _e === void 0 ? void 0 : _e.find(entry => entry.entryPointType === 'video')) === null || _f === void 0 ? void 0 : _f.uri) ||
                ((_j = (_h = (_g = updatedEvent.conferenceData) === null || _g === void 0 ? void 0 : _g.entryPoints) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.uri) ||
                null;
            return {
                externalEventId: updatedEvent.id,
                externalUpdatedAt: updatedEvent.updated
                    ? new Date(updatedEvent.updated)
                    : new Date(),
                conferenceLink
            };
        }
        catch (error) {
            await prisma.calendarSyncConfig.update({
                where: { id: workingConfig.id },
                data: {
                    error: (error === null || error === void 0 ? void 0 : error.message) ||
                        'Error desconocido al sincronizar evento con Google Calendar'
                }
            });
            throw error;
        }
    }
    static async deleteEvent(doctorId, externalEventId) {
        var _a;
        const client = GoogleCalendarSyncService.createClient();
        if (!client) {
            return;
        }
        const { calendar, authClient } = client;
        const config = await GoogleCalendarSyncService.getDoctorConfig(doctorId);
        if (!config) {
            return;
        }
        const workingConfig = await GoogleCalendarSyncService.ensureValidCredentials(authClient, config);
        try {
            await GoogleCalendarSyncService.executeWithRetry(calendar, authClient, workingConfig, cal => cal.events.delete({
                calendarId: GoogleCalendarSyncService.CALENDAR_ID,
                eventId: externalEventId
            }));
            await prisma.calendarSyncConfig.update({
                where: { id: workingConfig.id },
                data: {
                    lastSync: new Date(),
                    error: null
                }
            });
        }
        catch (error) {
            const status = (error === null || error === void 0 ? void 0 : error.code) || ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status);
            if (status === 404) {
                await prisma.calendarSyncConfig.update({
                    where: { id: workingConfig.id },
                    data: {
                        lastSync: new Date(),
                        error: null
                    }
                });
                return;
            }
            await prisma.calendarSyncConfig.update({
                where: { id: workingConfig.id },
                data: {
                    error: (error === null || error === void 0 ? void 0 : error.message) ||
                        'Error desconocido al eliminar evento en Google Calendar'
                }
            });
            throw error;
        }
    }
    // Obtener un evento específico de Google Calendar por su ID
    static async getEvent(doctorId, externalEventId) {
        var _a;
        const client = GoogleCalendarSyncService.createClient();
        if (!client) {
            return null;
        }
        const { calendar, authClient } = client;
        const syncConfig = await prisma.calendarSyncConfig.findFirst({
            where: {
                doctorId,
                provider: 'google',
                isConnected: true
            }
        });
        if (!syncConfig || !syncConfig.accessToken) {
            return null;
        }
        authClient.setCredentials({
            access_token: syncConfig.accessToken,
            refresh_token: syncConfig.refreshToken || undefined
        });
        try {
            const response = await calendar.events.get({
                calendarId: GoogleCalendarSyncService.CALENDAR_ID,
                eventId: externalEventId,
                // Incluir attendees para poder verificar el estado de respuesta
                fields: 'id,summary,description,start,end,attendees,conferenceData,location'
            });
            return response.data;
        }
        catch (error) {
            const status = (error === null || error === void 0 ? void 0 : error.code) || ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status);
            if ((status === 401 || status === 403) && syncConfig.refreshToken) {
                const refreshed = await oauth_service_1.OAuthService.refreshAccessToken('google', syncConfig.refreshToken);
                if (refreshed === null || refreshed === void 0 ? void 0 : refreshed.access_token) {
                    await prisma.calendarSyncConfig.update({
                        where: { id: syncConfig.id },
                        data: {
                            accessToken: refreshed.access_token,
                            refreshToken: refreshed.refresh_token || syncConfig.refreshToken,
                            expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : syncConfig.expiresAt
                        }
                    });
                    authClient.setCredentials({
                        access_token: refreshed.access_token,
                        refresh_token: refreshed.refresh_token || syncConfig.refreshToken
                    });
                    const response = await calendar.events.get({
                        calendarId: GoogleCalendarSyncService.CALENDAR_ID,
                        eventId: externalEventId,
                        // Incluir attendees para poder verificar el estado de respuesta
                        fields: 'id,summary,description,start,end,attendees,conferenceData,location'
                    });
                    return response.data;
                }
                else {
                    await (0, calendarAuth_utils_1.notifyCalendarReconnectNeeded)({
                        doctorId: syncConfig.doctorId,
                        provider: 'google',
                        reason: 'Conexión expirada. Vuelve a conectar Google Calendar.'
                    });
                }
            }
            console.error('Error obteniendo evento de Google Calendar:', error);
            return null;
        }
    }
}
exports.GoogleCalendarSyncService = GoogleCalendarSyncService;
GoogleCalendarSyncService.CALENDAR_ID = 'primary';
GoogleCalendarSyncService.TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE || 'UTC';
