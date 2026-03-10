"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalCalendarController = void 0;
const client_1 = require("@prisma/client");
const logger_utils_1 = require("../utils/logger.utils");
const externalCalendar_service_1 = require("../services/externalCalendar.service");
const prisma = new client_1.PrismaClient();
class ExternalCalendarController {
    // Obtener calendarios externos del doctor
    static async getExternalCalendars(req, res) {
        var _a;
        try {
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (!doctorId) {
                return res.status(401).json({ error: 'No autorizado' });
            }
            const calendars = await prisma.externalCalendarLink.findMany({
                where: {
                    doctorId,
                    activo: true
                },
                orderBy: {
                    fechaVinculacion: 'desc'
                }
            });
            res.json({
                success: true,
                data: calendars
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener calendarios externos:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Conectar calendario de Google
    static async connectGoogleCalendar(req, res) {
        var _a;
        try {
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (!doctorId) {
                return res.status(401).json({ error: 'No autorizado' });
            }
            // Generar URL de autorización para Google Calendar
            const authUrl = externalCalendar_service_1.ExternalCalendarService.generateGoogleAuthUrl(doctorId);
            res.json({
                success: true,
                message: 'URL de autorización generada',
                data: {
                    authUrl
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al conectar con Google Calendar:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                details: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }
    // Conectar calendario de Outlook
    static async connectOutlookCalendar(req, res) {
        var _a;
        try {
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (!doctorId) {
                return res.status(401).json({ error: 'No autorizado' });
            }
            // Generar URL de autorización para Outlook Calendar
            const authUrl = externalCalendar_service_1.ExternalCalendarService.generateOutlookAuthUrl(doctorId);
            res.json({
                success: true,
                message: 'URL de autorización generada',
                data: {
                    authUrl
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al conectar con Outlook Calendar:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                details: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }
    // Desconectar calendario externo
    static async disconnectCalendar(req, res) {
        var _a;
        try {
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            const { calendarId } = req.params;
            if (!doctorId) {
                return res.status(401).json({ error: 'No autorizado' });
            }
            const calendar = await prisma.externalCalendarLink.findFirst({
                where: {
                    id: calendarId,
                    doctorId,
                    activo: true
                }
            });
            if (!calendar) {
                return res.status(404).json({ error: 'Calendario no encontrado' });
            }
            await prisma.externalCalendarLink.update({
                where: { id: calendarId },
                data: { activo: false }
            });
            res.json({
                success: true,
                message: 'Calendario desconectado exitosamente'
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al desconectar calendario:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Sincronizar eventos con calendario externo
    static async syncExternalCalendar(req, res) {
        var _a;
        try {
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            const { calendarId } = req.params;
            const { startDate, endDate } = req.body;
            if (!doctorId) {
                return res.status(401).json({ error: 'No autorizado' });
            }
            const calendar = await prisma.externalCalendarLink.findFirst({
                where: {
                    id: calendarId,
                    doctorId,
                    activo: true
                }
            });
            if (!calendar) {
                return res.status(404).json({ error: 'Calendario no encontrado' });
            }
            // Usar fechas proporcionadas o por defecto (últimos 30 días)
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const syncResult = await externalCalendar_service_1.ExternalCalendarService.syncCalendarEvents(doctorId, calendarId, start, end);
            if (syncResult.success) {
                res.json({
                    success: true,
                    message: 'Sincronización completada exitosamente',
                    data: {
                        calendarType: calendar.tipoConexion,
                        lastSync: new Date(),
                        eventsAdded: syncResult.eventsAdded,
                        eventsUpdated: syncResult.eventsUpdated,
                        eventsDeleted: syncResult.eventsDeleted
                    }
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    message: 'Error en la sincronización',
                    errors: syncResult.errors
                });
            }
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al sincronizar calendario:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Obtener eventos de calendario externo para una fecha específica
    static async getExternalCalendarEvents(req, res) {
        var _a;
        try {
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            const { calendarId } = req.params;
            const { fecha, startDate, endDate } = req.query;
            if (!doctorId) {
                return res.status(401).json({ error: 'No autorizado' });
            }
            const calendar = await prisma.externalCalendarLink.findFirst({
                where: {
                    id: calendarId,
                    doctorId,
                    activo: true
                }
            });
            if (!calendar) {
                return res.status(404).json({ error: 'Calendario no encontrado' });
            }
            let start;
            let end;
            if (fecha) {
                // Si se proporciona una fecha específica, obtener eventos de ese día
                const targetDate = new Date(fecha);
                start = new Date(targetDate.setHours(0, 0, 0, 0));
                end = new Date(targetDate.setHours(23, 59, 59, 999));
            }
            else if (startDate && endDate) {
                // Si se proporcionan fechas de inicio y fin
                start = new Date(startDate);
                end = new Date(endDate);
            }
            else {
                // Por defecto, obtener eventos de hoy
                const today = new Date();
                start = new Date(today.setHours(0, 0, 0, 0));
                end = new Date(today.setHours(23, 59, 59, 999));
            }
            let events = [];
            if (calendar.tipoConexion === 'GOOGLE') {
                events = await externalCalendar_service_1.ExternalCalendarService.getGoogleCalendarEvents(calendar.accessToken, calendar.calendarioId, start, end);
            }
            else if (calendar.tipoConexion === 'OUTLOOK') {
                events = await externalCalendar_service_1.ExternalCalendarService.getOutlookCalendarEvents(calendar.accessToken, calendar.calendarioId, start, end);
            }
            res.json({
                success: true,
                data: {
                    calendarType: calendar.tipoConexion,
                    events: events,
                    date: fecha || start.toISOString().split('T')[0],
                    startDate: start.toISOString(),
                    endDate: end.toISOString()
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener eventos del calendario externo:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Manejar callback de autorización de Google
    static async handleGoogleCallback(req, res) {
        try {
            const { code, state, error } = req.query;
            if (error) {
                return res.redirect('/dashboard/profile?calendar_error=access_denied');
            }
            if (!code || !state) {
                return res.redirect('/dashboard/profile?calendar_error=invalid_request');
            }
            // Decodificar el estado para obtener el doctorId
            const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
            const { doctorId } = stateData;
            // Intercambiar código por tokens
            const tokens = await externalCalendar_service_1.ExternalCalendarService.exchangeGoogleCode(code);
            // Obtener información del calendario principal
            const calendarInfo = await fetch(`${externalCalendar_service_1.ExternalCalendarService['GOOGLE_CALENDAR_API_BASE']}/users/me/calendarList/primary`, {
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }).then(res => res.json());
            // Guardar la conexión en la base de datos
            const existingConnection = await prisma.externalCalendarLink.findFirst({
                where: {
                    doctorId,
                    tipoConexion: 'GOOGLE'
                }
            });
            if (existingConnection) {
                await prisma.externalCalendarLink.update({
                    where: { id: existingConnection.id },
                    data: {
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        calendarioId: calendarInfo.id,
                        activo: true,
                        fechaVinculacion: new Date()
                    }
                });
            }
            else {
                await prisma.externalCalendarLink.create({
                    data: {
                        doctorId,
                        tipoConexion: 'GOOGLE',
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        calendarioId: calendarInfo.id,
                        activo: true,
                        fechaVinculacion: new Date()
                    }
                });
            }
            res.redirect('/dashboard/profile?calendar_success=google_connected');
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error en callback de Google:', error);
            res.redirect('/dashboard/profile?calendar_error=server_error');
        }
    }
    // Manejar callback de autorización de Outlook
    static async handleOutlookCallback(req, res) {
        try {
            const { code, state, error } = req.query;
            if (error) {
                return res.redirect('/dashboard/profile?calendar_error=access_denied');
            }
            if (!code || !state) {
                return res.redirect('/dashboard/profile?calendar_error=invalid_request');
            }
            // Decodificar el estado para obtener el doctorId
            const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
            const { doctorId } = stateData;
            // Intercambiar código por tokens
            const tokens = await externalCalendar_service_1.ExternalCalendarService.exchangeOutlookCode(code);
            // Obtener información del calendario principal
            const calendarInfo = await fetch(`${externalCalendar_service_1.ExternalCalendarService['MICROSOFT_GRAPH_API_BASE']}/me/calendar`, {
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }).then(res => res.json());
            // Guardar la conexión en la base de datos
            const existingConnection = await prisma.externalCalendarLink.findFirst({
                where: {
                    doctorId,
                    tipoConexion: 'OUTLOOK'
                }
            });
            if (existingConnection) {
                await prisma.externalCalendarLink.update({
                    where: { id: existingConnection.id },
                    data: {
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        calendarioId: calendarInfo.id,
                        activo: true,
                        fechaVinculacion: new Date()
                    }
                });
            }
            else {
                await prisma.externalCalendarLink.create({
                    data: {
                        doctorId,
                        tipoConexion: 'OUTLOOK',
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        calendarioId: calendarInfo.id,
                        activo: true,
                        fechaVinculacion: new Date()
                    }
                });
            }
            res.redirect('/dashboard/profile?calendar_success=outlook_connected');
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error en callback de Outlook:', error);
            res.redirect('/dashboard/profile?calendar_error=server_error');
        }
    }
    // Conectar calendario de Apple
    static async connectAppleCalendar(req, res) {
        var _a;
        try {
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (!doctorId) {
                return res.status(401).json({ error: 'No autorizado' });
            }
            // Generar URL de autorización para Apple Calendar
            const authUrl = externalCalendar_service_1.ExternalCalendarService.generateAppleAuthUrl(doctorId);
            res.json({
                success: true,
                message: 'URL de autorización generada',
                data: {
                    authUrl
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al conectar con Apple Calendar:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                details: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }
    // Conectar calendario de Notion
    static async connectNotionCalendar(req, res) {
        var _a;
        try {
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (!doctorId) {
                return res.status(401).json({ error: 'No autorizado' });
            }
            // Generar URL de autorización para Notion Calendar
            const authUrl = externalCalendar_service_1.ExternalCalendarService.generateNotionAuthUrl(doctorId);
            res.json({
                success: true,
                message: 'URL de autorización generada',
                data: {
                    authUrl
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al conectar con Notion Calendar:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                details: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }
    // Manejar callback de autorización de Apple
    static async handleAppleCallback(req, res) {
        try {
            const { code, state, error } = req.query;
            if (error) {
                return res.redirect('/dashboard/profile?calendar_error=access_denied');
            }
            if (!code || !state) {
                return res.redirect('/dashboard/profile?calendar_error=invalid_request');
            }
            // Decodificar el estado para obtener el doctorId
            const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
            const { doctorId } = stateData;
            // Intercambiar código por tokens
            const tokens = await externalCalendar_service_1.ExternalCalendarService.exchangeAppleCode(code);
            // Guardar la conexión en la base de datos
            const existingConnection = await prisma.externalCalendarLink.findFirst({
                where: {
                    doctorId,
                    tipoConexion: 'APPLE'
                }
            });
            if (existingConnection) {
                await prisma.externalCalendarLink.update({
                    where: { id: existingConnection.id },
                    data: {
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        calendarioId: 'primary',
                        activo: true,
                        fechaVinculacion: new Date()
                    }
                });
            }
            else {
                await prisma.externalCalendarLink.create({
                    data: {
                        doctorId,
                        tipoConexion: 'APPLE',
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        calendarioId: 'primary',
                        activo: true,
                        fechaVinculacion: new Date()
                    }
                });
            }
            res.redirect('/dashboard/profile?calendar_success=apple_connected');
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error en callback de Apple:', error);
            res.redirect('/dashboard/profile?calendar_error=server_error');
        }
    }
    // Manejar callback de autorización de Notion
    static async handleNotionCallback(req, res) {
        try {
            const { code, state, error } = req.query;
            if (error) {
                return res.redirect('/dashboard/profile?calendar_error=access_denied');
            }
            if (!code || !state) {
                return res.redirect('/dashboard/profile?calendar_error=invalid_request');
            }
            // Decodificar el estado para obtener el doctorId
            const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
            const { doctorId } = stateData;
            // Intercambiar código por tokens
            const tokens = await externalCalendar_service_1.ExternalCalendarService.exchangeNotionCode(code);
            // Guardar la conexión en la base de datos
            const existingConnection = await prisma.externalCalendarLink.findFirst({
                where: {
                    doctorId,
                    tipoConexion: 'NOTION'
                }
            });
            if (existingConnection) {
                await prisma.externalCalendarLink.update({
                    where: { id: existingConnection.id },
                    data: {
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        calendarioId: 'primary',
                        activo: true,
                        fechaVinculacion: new Date()
                    }
                });
            }
            else {
                await prisma.externalCalendarLink.create({
                    data: {
                        doctorId,
                        tipoConexion: 'NOTION',
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        calendarioId: 'primary',
                        activo: true,
                        fechaVinculacion: new Date()
                    }
                });
            }
            res.redirect('/dashboard/profile?calendar_success=notion_connected');
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error en callback de Notion:', error);
            res.redirect('/dashboard/profile?calendar_error=server_error');
        }
    }
}
exports.ExternalCalendarController = ExternalCalendarController;
