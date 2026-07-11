"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleCalendarSyncService = exports.GoogleCalendarNotReadyError = void 0;
const client_1 = require("@prisma/client");
const googleapis_1 = require("googleapis");
const node_crypto_1 = require("node:crypto");
const oauth_service_1 = require("./oauth.service");
const calendarAuth_utils_1 = require("../utils/calendarAuth.utils");
const oauth_config_1 = require("../config/oauth.config");
const date_utils_1 = require("../utils/date.utils");
const calendarSync_utils_1 = require("../utils/calendarSync.utils");
const prisma = new client_1.PrismaClient();
class GoogleCalendarNotReadyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GoogleCalendarNotReadyError';
    }
}
exports.GoogleCalendarNotReadyError = GoogleCalendarNotReadyError;
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
        const tokenExpired = !!config.expiresAt && config.expiresAt.getTime() <= Date.now() + 60 * 1000;
        if (tokenExpired && config.refreshToken) {
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
                const reason = 'Conexión con Google Calendar expirada. Vuelve a enlazar tu calendario en Configuración → Calendario.';
                await (0, calendarAuth_utils_1.notifyCalendarReconnectNeeded)({
                    doctorId: config.doctorId,
                    provider: 'google',
                    reason
                });
                await prisma.calendarSyncConfig.update({
                    where: { id: config.id },
                    data: { error: reason }
                });
                throw new GoogleCalendarNotReadyError(reason);
            }
        }
        else if (tokenExpired && !config.refreshToken) {
            const reason = 'Google Calendar requiere volver a autorizarse (sin refresh token). Enlázalo de nuevo en Configuración → Calendario.';
            await prisma.calendarSyncConfig.update({
                where: { id: config.id },
                data: { error: reason }
            });
            throw new GoogleCalendarNotReadyError(reason);
        }
        authClient.setCredentials({
            access_token: (_a = config.accessToken) !== null && _a !== void 0 ? _a : undefined,
            refresh_token: (_b = config.refreshToken) !== null && _b !== void 0 ? _b : undefined
        });
        return config;
    }
    static buildEventBody(payload, timezone) {
        var _a, _b, _c;
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
                dateTime: (0, date_utils_1.formatDateTimeForExternalCalendar)(payload.start, timezone),
                timeZone: timezone
            },
            end: {
                dateTime: (0, date_utils_1.formatDateTimeForExternalCalendar)(payload.end, timezone),
                timeZone: timezone
            },
            // La liga de videollamada vive en conferenceData (Google Meet nativo), nunca en "location".
            // Forzamos limpiar "location" para que el invitado (p. ej. en Outlook) no vea dos ligas:
            // la de conferenceData y una vieja que hubiera quedado en location tras una reprogramación.
            location: /meet\.google\.com|teams\.microsoft\.com|zoom\.us/i.test((_b = payload.location) !== null && _b !== void 0 ? _b : '')
                ? ''
                : ((_c = payload.location) !== null && _c !== void 0 ? _c : '')
        };
        if (payload.attendees && payload.attendees.length > 0) {
            event.attendees = payload.attendees.map(email => ({
                email,
                responseStatus: payload.attendeesResponseStatus
            }));
        }
        return event;
    }
    static eventDateTimeToMs(dt) {
        if (!dt)
            return null;
        if (dt.dateTime)
            return new Date(dt.dateTime).getTime();
        if (dt.date)
            return new Date(dt.date).getTime();
        return null;
    }
    static eventHasVideoConference(event) {
        var _a, _b, _c;
        if (event.hangoutLink)
            return true;
        return ((_c = (_b = (_a = event.conferenceData) === null || _a === void 0 ? void 0 : _a.entryPoints) === null || _b === void 0 ? void 0 : _b.some(entry => entry.entryPointType === 'video')) !== null && _c !== void 0 ? _c : false);
    }
    static extractAttendeeResponseStatus(event, attendeeEmails) {
        var _a;
        if (!((_a = event.attendees) === null || _a === void 0 ? void 0 : _a.length) || !attendeeEmails.length)
            return undefined;
        const targets = new Set(attendeeEmails.map(email => email.toLowerCase().trim()));
        const match = event.attendees.find(attendee => attendee.email && targets.has(attendee.email.toLowerCase().trim()));
        if ((match === null || match === void 0 ? void 0 : match.responseStatus) === 'accepted')
            return 'accepted';
        if ((match === null || match === void 0 ? void 0 : match.responseStatus) === 'declined')
            return 'declined';
        return undefined;
    }
    static toComparableFromGoogleEvent(event, attendeeEmails) {
        return {
            summary: event.summary,
            description: event.description,
            startMs: GoogleCalendarSyncService.eventDateTimeToMs(event.start),
            endMs: GoogleCalendarSyncService.eventDateTimeToMs(event.end),
            attendeeEmails,
            attendeeResponseStatus: GoogleCalendarSyncService.extractAttendeeResponseStatus(event, attendeeEmails),
            hasVideoConference: GoogleCalendarSyncService.eventHasVideoConference(event),
            location: event.location,
        };
    }
    static toComparableFromRequestBody(requestBody, payload, options) {
        var _a, _b;
        const hasVideoConference = !options.shouldStripConference &&
            (options.shouldCreateConference ||
                !!((_a = payload.conferenceLink) === null || _a === void 0 ? void 0 : _a.includes('meet.google.com')) ||
                GoogleCalendarSyncService.eventHasVideoConference(requestBody));
        return {
            summary: requestBody.summary,
            description: requestBody.description,
            startMs: GoogleCalendarSyncService.eventDateTimeToMs(requestBody.start),
            endMs: GoogleCalendarSyncService.eventDateTimeToMs(requestBody.end),
            attendeeEmails: (_b = payload.attendees) !== null && _b !== void 0 ? _b : [],
            attendeeResponseStatus: payload.attendeesResponseStatus,
            hasVideoConference,
            location: typeof requestBody.location === 'string' ? requestBody.location : null,
        };
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const client = GoogleCalendarSyncService.createClient();
        if (!client) {
            const msg = 'Google OAuth no está configurado en el servidor (faltan GOOGLE_CLIENT_ID/SECRET).';
            await prisma.calendarSyncConfig.updateMany({
                where: { doctorId, provider: 'google', isConnected: true },
                data: { error: msg }
            });
            throw new GoogleCalendarNotReadyError(msg);
        }
        const { calendar, authClient } = client;
        const config = await GoogleCalendarSyncService.getDoctorConfig(doctorId);
        if (!config) {
            const msg = 'Google Calendar aparece conectado pero no hay token de acceso válido. Vuelve a enlazarlo en Configuración → Calendario.';
            await prisma.calendarSyncConfig.updateMany({
                where: { doctorId, provider: 'google' },
                data: { error: msg }
            });
            throw new GoogleCalendarNotReadyError(msg);
        }
        let workingConfig = await GoogleCalendarSyncService.ensureValidCredentials(authClient, config);
        const doctor = await prisma.doctor.findUnique({
            where: { id: doctorId },
            select: { timezone: true }
        });
        const eventTimezone = payload.timezone ||
            (doctor === null || doctor === void 0 ? void 0 : doctor.timezone) ||
            process.env.PRACTICE_TIMEZONE ||
            GoogleCalendarSyncService.TIMEZONE;
        const requestBody = GoogleCalendarSyncService.buildEventBody(payload, eventTimezone);
        const wantsConference = payload.conferenceType === 'google-meet';
        const existingConferenceLink = (_a = payload.conferenceLink) !== null && _a !== void 0 ? _a : null;
        const hasExistingGoogleMeet = !!existingConferenceLink && existingConferenceLink.includes('meet.google.com');
        const shouldCreateConference = (wantsConference || payload.googleMeetEnabled) && !hasExistingGoogleMeet;
        const shouldStripConference = payload.disableConference === true;
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
            const hasAttendees = ((_c = (_b = payload.attendees) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0) > 0;
            const resolvedSendUpdatesOnInsert = (_d = payload.sendUpdates) !== null && _d !== void 0 ? _d : (hasAttendees ? 'all' : 'none');
            const resolvedSendUpdatesOnUpdate = (_e = payload.sendUpdates) !== null && _e !== void 0 ? _e : 'none';
            console.log('🔧 GoogleCalendarSyncService.upsertEvent:');
            console.log('   Event ID:', payload.id);
            console.log('   External Event ID:', payload.externalEventId || 'NUEVO');
            console.log('   Attendees:', ((_f = payload.attendees) === null || _f === void 0 ? void 0 : _f.join(', ')) || 'NINGUNO');
            console.log('   Request Body attendees:', ((_g = requestBody.attendees) === null || _g === void 0 ? void 0 : _g.map(a => a.email).join(', ')) || 'NINGUNO');
            console.log('   sendUpdates (update/create):', payload.externalEventId ? resolvedSendUpdatesOnUpdate : resolvedSendUpdatesOnInsert);
            const { result } = await GoogleCalendarSyncService.executeWithRetry(calendar, authClient, workingConfig, async (cal) => {
                var _a, _b, _c, _d, _e;
                if (payload.externalEventId) {
                    try {
                        console.log('   📝 Actualizando evento existente en Google Calendar...');
                        if (shouldStripConference) {
                            const existing = await cal.events.get({
                                calendarId: GoogleCalendarSyncService.CALENDAR_ID,
                                eventId: payload.externalEventId
                            });
                            const merged = Object.assign(Object.assign(Object.assign({}, existing.data), requestBody), { conferenceData: undefined, hangoutLink: undefined });
                            delete merged.conferenceData;
                            delete merged.hangoutLink;
                            const result = await cal.events.update({
                                calendarId: GoogleCalendarSyncService.CALENDAR_ID,
                                eventId: payload.externalEventId,
                                requestBody: merged,
                                sendUpdates: resolvedSendUpdatesOnUpdate
                            });
                            console.log('   ✅ Evento actualizado (sin videollamada)');
                            if (resolvedSendUpdatesOnUpdate === 'all') {
                                console.log('   📧 Google enviará actualización de invitación a:', ((_a = merged.attendees) === null || _a === void 0 ? void 0 : _a.map(a => a.email).join(', ')) || 'NINGUNO');
                            }
                            else {
                                console.log('   📧 sendUpdates=none — no se reenvían invitaciones por correo');
                            }
                            return result;
                        }
                        const existing = await cal.events.get({
                            calendarId: GoogleCalendarSyncService.CALENDAR_ID,
                            eventId: payload.externalEventId
                        });
                        const mergedForUpdate = Object.assign(Object.assign({}, existing.data), requestBody);
                        const desiredComparable = GoogleCalendarSyncService.toComparableFromRequestBody(mergedForUpdate, payload, {
                            shouldCreateConference: !!shouldCreateConference,
                            shouldStripConference: !!shouldStripConference,
                        });
                        const existingComparable = GoogleCalendarSyncService.toComparableFromGoogleEvent(existing.data, (_b = payload.attendees) !== null && _b !== void 0 ? _b : []);
                        if (!(0, calendarSync_utils_1.externalCalendarEventNeedsUpdate)(existingComparable, desiredComparable) &&
                            !shouldCreateConference &&
                            !shouldStripConference) {
                            console.log('   ⏭️ Sin cambios significativos — omitiendo update en Google Calendar');
                            return { data: existing.data };
                        }
                        const sendUpdates = resolvedSendUpdatesOnUpdate;
                        const updateParams = {
                            calendarId: GoogleCalendarSyncService.CALENDAR_ID,
                            eventId: payload.externalEventId,
                            requestBody: mergedForUpdate,
                            sendUpdates
                        };
                        if (shouldCreateConference) {
                            updateParams.conferenceDataVersion = 1;
                        }
                        const result = await cal.events.update(updateParams);
                        console.log('   ✅ Evento actualizado en Google Calendar');
                        if (sendUpdates === 'all') {
                            console.log('   📧 Google enviará actualización de invitación a:', ((_c = requestBody.attendees) === null || _c === void 0 ? void 0 : _c.map(a => a.email).join(', ')) || 'NINGUNO');
                        }
                        else {
                            console.log('   📧 sendUpdates=none — no se reenvían invitaciones por correo');
                        }
                        return result;
                    }
                    catch (error) {
                        const status = (error === null || error === void 0 ? void 0 : error.code) || ((_d = error === null || error === void 0 ? void 0 : error.response) === null || _d === void 0 ? void 0 : _d.status);
                        if (status !== 404) {
                            throw error;
                        }
                    }
                }
                console.log('   📝 Creando nuevo evento en Google Calendar...');
                const insertParams = {
                    calendarId: GoogleCalendarSyncService.CALENDAR_ID,
                    requestBody,
                    // Primera creación: enviar invitación al paciente
                    sendUpdates: resolvedSendUpdatesOnInsert
                };
                if (shouldCreateConference) {
                    insertParams.conferenceDataVersion = 1;
                }
                const result = await cal.events.insert(insertParams);
                console.log('   ✅ Evento creado en Google Calendar con ID:', result.data.id);
                if (resolvedSendUpdatesOnInsert === 'all') {
                    console.log('   📧 Google enviará invitación a:', ((_e = requestBody.attendees) === null || _e === void 0 ? void 0 : _e.map(a => a.email).join(', ')) || 'NINGUNO');
                }
                else {
                    console.log('   📧 sendUpdates=none — no se envían invitaciones por correo');
                }
                return result;
            });
            const updatedEvent = result.data;
            if (!(updatedEvent === null || updatedEvent === void 0 ? void 0 : updatedEvent.id)) {
                const msg = 'Google Calendar no devolvió ID de evento tras crear/actualizar.';
                throw new Error(msg);
            }
            await prisma.calendarSyncConfig.update({
                where: { id: workingConfig.id },
                data: {
                    lastSync: new Date(),
                    error: null
                }
            });
            const conferenceLink = shouldCreateConference
                ? updatedEvent.hangoutLink ||
                    ((_k = (_j = (_h = updatedEvent.conferenceData) === null || _h === void 0 ? void 0 : _h.entryPoints) === null || _j === void 0 ? void 0 : _j.find(entry => entry.entryPointType === 'video')) === null || _k === void 0 ? void 0 : _k.uri) ||
                    ((_o = (_m = (_l = updatedEvent.conferenceData) === null || _l === void 0 ? void 0 : _l.entryPoints) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.uri) ||
                    null
                : null;
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
