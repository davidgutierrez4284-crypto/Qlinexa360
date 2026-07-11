"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutlookCalendarSyncService = void 0;
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
const oauth_service_1 = require("./oauth.service");
const calendarAuth_utils_1 = require("../utils/calendarAuth.utils");
const prisma = new client_1.PrismaClient();
class OutlookCalendarSyncService {
    static async getDoctorConfig(doctorId) {
        return prisma.calendarSyncConfig.findFirst({
            where: {
                doctorId,
                provider: 'outlook',
                isConnected: true,
                accessToken: { not: null }
            }
        });
    }
    static needsRefresh(config) {
        if (!config.expiresAt)
            return false;
        return config.expiresAt.getTime() <= Date.now() + 60 * 1000;
    }
    static async ensureValidCredentials(config) {
        var _a;
        if (this.needsRefresh(config) && config.refreshToken) {
            const refreshed = await oauth_service_1.OAuthService.refreshAccessToken('outlook', config.refreshToken);
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
                return {
                    accessToken: refreshed.access_token,
                    config: updated
                };
            }
            else {
                await (0, calendarAuth_utils_1.notifyCalendarReconnectNeeded)({
                    doctorId: config.doctorId,
                    provider: 'outlook',
                    reason: 'Conexión expirada. Vuelve a conectar Outlook.'
                });
            }
        }
        return {
            accessToken: (_a = config.accessToken) !== null && _a !== void 0 ? _a : '',
            config
        };
    }
    static async executeWithRetry(doctorId, initialConfig, executor) {
        var _a;
        let config = initialConfig;
        if (!config) {
            config = await OutlookCalendarSyncService.getDoctorConfig(doctorId);
        }
        if (!config || !config.accessToken) {
            return null;
        }
        try {
            const { accessToken, config: activeConfig } = await OutlookCalendarSyncService.ensureValidCredentials(config);
            return await executor(accessToken, activeConfig);
        }
        catch (error) {
            const status = ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status) ||
                (error === null || error === void 0 ? void 0 : error.status) ||
                (error === null || error === void 0 ? void 0 : error.code);
            if ((status === 401 || status === 403) && config.refreshToken) {
                const refreshed = await oauth_service_1.OAuthService.refreshAccessToken('outlook', config.refreshToken);
                if (!(refreshed === null || refreshed === void 0 ? void 0 : refreshed.access_token)) {
                    await (0, calendarAuth_utils_1.notifyCalendarReconnectNeeded)({
                        doctorId: config.doctorId,
                        provider: 'outlook',
                        reason: 'Conexión expirada. Vuelve a conectar Outlook.'
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
                return executor(refreshed.access_token, updatedConfig);
            }
            throw error;
        }
    }
    static buildEventBody(payload) {
        var _a;
        // Si se pide deshabilitar explícitamente, nunca habilitar Teams (presencial)
        const wantsTeams = !payload.disableConference &&
            (payload.teamsEnabled || payload.conferenceType === 'teams');
        // Si hay attendees (pacientes), agregar emoji de Qlinexa360 y "consulta" al título para que se destaque en el calendario del paciente
        // Primero limpiar TODOS los emojis 🏥 y la palabra "consulta" que puedan existir
        let cleanTitle = payload.title.replace(/🏥\s*/g, '').trim();
        cleanTitle = cleanTitle.replace(/\s+consulta$/i, '').trim();
        const titleForExternal = payload.attendees && payload.attendees.length > 0
            ? `🏥 ${cleanTitle} consulta`
            : cleanTitle;
        return {
            subject: titleForExternal,
            body: {
                contentType: 'text',
                content: payload.description || ''
            },
            location: {
                // La reunión de Teams vive en onlineMeeting; nunca en "location".
                // Limpiamos location para evitar que el invitado vea una liga vieja además de la actual.
                displayName: /meet\.google\.com|teams\.microsoft\.com|zoom\.us/i.test(payload.location || '')
                    ? ''
                    : (payload.location || '')
            },
            start: {
                dateTime: payload.start.toISOString(),
                timeZone: OutlookCalendarSyncService.TIMEZONE
            },
            end: {
                dateTime: payload.end.toISOString(),
                timeZone: OutlookCalendarSyncService.TIMEZONE
            },
            attendees: ((_a = payload.attendees) === null || _a === void 0 ? void 0 : _a.map(email => ({
                emailAddress: { address: email },
                type: 'required'
            }))) || [],
            isOnlineMeeting: wantsTeams,
            onlineMeetingProvider: wantsTeams ? 'teamsForBusiness' : undefined
        };
    }
    static async upsertEvent(doctorId, payload) {
        return OutlookCalendarSyncService.executeWithRetry(doctorId, null, async (accessToken, activeConfig) => {
            var _a;
            const eventBody = OutlookCalendarSyncService.buildEventBody(payload);
            const headers = {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            };
            const urlBase = `${OutlookCalendarSyncService.GRAPH_BASE}/me/events`;
            let response;
            if (payload.externalEventId) {
                response = await axios_1.default.patch(`${urlBase}/${payload.externalEventId}`, eventBody, { headers });
            }
            else {
                response = await axios_1.default.post(urlBase, eventBody, { headers });
            }
            const data = response.data;
            await prisma.calendarSyncConfig.update({
                where: { id: activeConfig.id },
                data: {
                    lastSync: new Date(),
                    error: null
                }
            });
            return {
                externalEventId: data.id,
                externalUpdatedAt: data.lastModifiedDateTime
                    ? new Date(data.lastModifiedDateTime)
                    : new Date(),
                conferenceLink: ((_a = data.onlineMeeting) === null || _a === void 0 ? void 0 : _a.joinUrl) || null
            };
        });
    }
    // Obtener un evento específico de Outlook Calendar por su ID
    static async getEvent(doctorId, externalEventId) {
        return OutlookCalendarSyncService.executeWithRetry(doctorId, null, async (accessToken, activeConfig) => {
            var _a;
            const headers = {
                Authorization: `Bearer ${accessToken}`
            };
            try {
                const response = await axios_1.default.get(`${OutlookCalendarSyncService.GRAPH_BASE}/me/events/${externalEventId}`, { headers });
                return response.data;
            }
            catch (error) {
                const status = ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status) ||
                    (error === null || error === void 0 ? void 0 : error.status);
                if (status === 404) {
                    return null;
                }
                console.error('Error obteniendo evento de Outlook Calendar:', error);
                return null;
            }
        });
    }
    static async deleteEvent(doctorId, externalEventId) {
        await OutlookCalendarSyncService.executeWithRetry(doctorId, null, async (accessToken, activeConfig) => {
            var _a;
            const headers = {
                Authorization: `Bearer ${accessToken}`
            };
            try {
                await axios_1.default.delete(`${OutlookCalendarSyncService.GRAPH_BASE}/me/events/${externalEventId}`, { headers });
                await prisma.calendarSyncConfig.update({
                    where: { id: activeConfig.id },
                    data: {
                        lastSync: new Date(),
                        error: null
                    }
                });
            }
            catch (error) {
                const status = ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status) ||
                    (error === null || error === void 0 ? void 0 : error.status);
                if (status === 404) {
                    await prisma.calendarSyncConfig.update({
                        where: { id: activeConfig.id },
                        data: {
                            lastSync: new Date(),
                            error: null
                        }
                    });
                    return;
                }
                throw error;
            }
        });
    }
    static async syncCalendar(doctorId, config) {
        const syncResult = await OutlookCalendarSyncService.executeWithRetry(doctorId, config, async (accessToken, activeConfig) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const headers = {
                Authorization: `Bearer ${accessToken}`
            };
            const now = new Date();
            const timeMin = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            const timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
            const filter = `start/dateTime ge '${timeMin.toISOString()}' and end/dateTime le '${timeMax.toISOString()}'`;
            const response = await axios_1.default.get(`${OutlookCalendarSyncService.GRAPH_BASE}/me/events`, {
                headers,
                params: {
                    $select: 'id,subject,body,start,end,location,lastModifiedDateTime,isOnlineMeeting,onlineMeeting,attendees',
                    $orderby: 'start/dateTime',
                    $top: 1000,
                    $filter: filter
                }
            });
            const items = ((_a = response.data) === null || _a === void 0 ? void 0 : _a.value) || [];
            const existingEvents = await prisma.internalCalendarEvent.findMany({
                where: {
                    doctorId,
                    externalProvider: 'outlook',
                    fechaHoraInicio: {
                        gte: timeMin,
                        lte: timeMax
                    }
                }
            });
            const existingMap = new Map();
            existingEvents.forEach(event => {
                if (event.externalEventId) {
                    existingMap.set(event.externalEventId, event);
                }
            });
            const seen = new Set();
            let created = 0;
            let updated = 0;
            const normalizeDate = (dateTime) => {
                if (!dateTime)
                    return null;
                const hasOffset = dateTime.endsWith('Z') || /[+-]\d\d:\d\d$/.test(dateTime);
                const iso = hasOffset ? dateTime : `${dateTime}Z`;
                return new Date(iso);
            };
            for (const item of items) {
                if (!(item === null || item === void 0 ? void 0 : item.id))
                    continue;
                const startDate = normalizeDate((_b = item.start) === null || _b === void 0 ? void 0 : _b.dateTime);
                const endDate = normalizeDate((_c = item.end) === null || _c === void 0 ? void 0 : _c.dateTime);
                if (!startDate || !endDate)
                    continue;
                seen.add(item.id);
                const payload = {
                    titulo: item.subject || 'Sin título',
                    descripcion: ((_d = item.body) === null || _d === void 0 ? void 0 : _d.content) || null,
                    fechaHoraInicio: startDate,
                    fechaHoraFin: endDate,
                    origenEvento: 'outlook',
                    linkMeeting: ((_e = item.onlineMeeting) === null || _e === void 0 ? void 0 : _e.joinUrl) || null,
                    externalProvider: 'outlook',
                    externalEventId: item.id,
                    externalUpdatedAt: item.lastModifiedDateTime
                        ? new Date(item.lastModifiedDateTime)
                        : new Date(),
                    creadoPor: doctorId
                };
                const existing = existingMap.get(item.id);
                if (existing) {
                    await prisma.internalCalendarEvent.update({
                        where: { id: existing.id },
                        data: payload
                    });
                    updated += 1;
                }
                else {
                    await prisma.internalCalendarEvent.create({
                        data: Object.assign({ doctorId }, payload)
                    });
                    created += 1;
                }
                // CRÍTICO: Verificar si algún attendee (paciente) aceptó o rechazó la invitación
                // y actualizar el confirmationStatus del appointment relacionado
                if (item.attendees && Array.isArray(item.attendees)) {
                    for (const attendee of item.attendees) {
                        const attendeeEmail = (_f = attendee.emailAddress) === null || _f === void 0 ? void 0 : _f.address;
                        const attendeeStatus = (_g = attendee.status) === null || _g === void 0 ? void 0 : _g.toLowerCase();
                        // Verificar si el attendee aceptó o rechazó la invitación
                        if ((attendeeStatus === 'accepted' || attendeeStatus === 'declined') && attendeeEmail) {
                            try {
                                // Buscar el paciente por email
                                const patient = await prisma.patient.findFirst({
                                    where: {
                                        OR: [
                                            { email: attendeeEmail },
                                            {
                                                user: {
                                                    email: attendeeEmail
                                                }
                                            }
                                        ],
                                        doctors: {
                                            some: {
                                                doctorId: doctorId
                                            }
                                        }
                                    },
                                    select: {
                                        id: true
                                    }
                                });
                                if (patient) {
                                    // Buscar el appointment relacionado
                                    const searchStart = new Date(startDate);
                                    searchStart.setMinutes(searchStart.getMinutes() - 30);
                                    const searchEnd = new Date(startDate);
                                    searchEnd.setMinutes(searchEnd.getMinutes() + 30);
                                    const appointment = await prisma.appointment.findFirst({
                                        where: {
                                            patientId: patient.id,
                                            doctorId: doctorId,
                                            date: {
                                                gte: searchStart,
                                                lte: searchEnd
                                            }
                                        }
                                    });
                                    if (appointment) {
                                        if (attendeeStatus === 'accepted') {
                                            // Actualizar el appointment a CONFIRMED solo si no está ya cancelado
                                            if (appointment.confirmationStatus !== 'CANCELLED') {
                                                await prisma.appointment.update({
                                                    where: { id: appointment.id },
                                                    data: {
                                                        confirmationStatus: 'CONFIRMED',
                                                        confirmedAt: new Date()
                                                    }
                                                });
                                                console.log(`✅ Appointment ${appointment.id} actualizado a CONFIRMED - paciente aceptó en Outlook Calendar`);
                                            }
                                        }
                                        else if (attendeeStatus === 'declined') {
                                            // Actualizar el appointment a CANCELLED si el paciente rechazó
                                            await prisma.appointment.update({
                                                where: { id: appointment.id },
                                                data: {
                                                    confirmationStatus: 'CANCELLED',
                                                    cancelledAt: new Date()
                                                }
                                            });
                                            console.log(`❌ Appointment ${appointment.id} actualizado a CANCELLED - paciente rechazó en Outlook Calendar`);
                                        }
                                    }
                                }
                            }
                            catch (error) {
                                console.error('Error verificando attendee response en Outlook:', error);
                                // Continuar con el siguiente attendee aunque haya error
                            }
                        }
                    }
                }
            }
            const toRemove = existingEvents.filter(event => event.externalEventId && !seen.has(event.externalEventId));
            if (toRemove.length > 0) {
                await prisma.internalCalendarEvent.deleteMany({
                    where: {
                        id: {
                            in: toRemove.map(event => event.id)
                        }
                    }
                });
            }
            await prisma.calendarSyncConfig.update({
                where: { id: activeConfig.id },
                data: {
                    lastSync: new Date(),
                    error: null
                }
            });
            return {
                created,
                updated,
                removed: toRemove.length
            };
        });
        return (syncResult || {
            created: 0,
            updated: 0,
            removed: 0
        });
    }
}
exports.OutlookCalendarSyncService = OutlookCalendarSyncService;
OutlookCalendarSyncService.GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
OutlookCalendarSyncService.TIMEZONE = process.env.CALENDAR_DEFAULT_TIMEZONE || 'America/Mexico_City';
