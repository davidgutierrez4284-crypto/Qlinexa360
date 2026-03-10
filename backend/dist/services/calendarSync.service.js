"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const googleapis_1 = require("googleapis");
const msal_node_1 = require("@azure/msal-node");
const client_1 = require("@prisma/client");
const node_cron_1 = __importDefault(require("node-cron"));
const crypto_js_1 = __importDefault(require("crypto-js"));
const prisma = new client_1.PrismaClient();
// Configuración de encriptación
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-key-32-chars-long';
// Función para encriptar tokens
const encryptToken = (token) => {
    return crypto_js_1.default.AES.encrypt(token, ENCRYPTION_KEY).toString();
};
// Función para desencriptar tokens
const decryptToken = (encryptedToken) => {
    const bytes = crypto_js_1.default.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
    return bytes.toString(crypto_js_1.default.enc.Utf8);
};
// Servicio de Google Calendar
class GoogleCalendarService {
    constructor() {
        this.oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
    }
    // Generar URL de autorización
    generateAuthUrl() {
        const scopes = [
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/calendar.events.readonly'
        ];
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });
    }
    // Obtener tokens desde código de autorización
    async getTokensFromCode(code) {
        const { tokens } = await this.oauth2Client.getToken(code);
        return tokens;
    }
    // Obtener eventos de Google Calendar
    async getEvents(accessToken, calendarId = 'primary', timeMin, timeMax) {
        this.oauth2Client.setCredentials({ access_token: accessToken });
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth: this.oauth2Client });
        const response = await calendar.events.list({
            calendarId,
            timeMin: timeMin === null || timeMin === void 0 ? void 0 : timeMin.toISOString(),
            timeMax: timeMax === null || timeMax === void 0 ? void 0 : timeMax.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });
        return response.data.items || [];
    }
    // Refrescar token
    async refreshToken(refreshToken) {
        this.oauth2Client.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        return credentials;
    }
}
// Servicio de Microsoft Outlook
class OutlookCalendarService {
    constructor() {
        // Verificar que las credenciales de Microsoft estén configuradas
        const clientId = process.env.MICROSOFT_CLIENT_ID;
        const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
        const tenantId = process.env.MICROSOFT_TENANT_ID;
        if (!clientId || !clientSecret) {
            console.warn('⚠️  Microsoft Calendar: Credenciales no configuradas. La sincronización de Outlook estará deshabilitada.');
            this.msalConfig = null;
            return;
        }
        this.msalConfig = {
            auth: {
                clientId,
                authority: `https://login.microsoftonline.com/${tenantId || 'common'}`,
                clientSecret
            }
        };
        console.log('✅ Microsoft Calendar: Credenciales configuradas correctamente');
    }
    // Generar URL de autorización
    async generateAuthUrl() {
        if (!this.msalConfig) {
            throw new Error('Microsoft Calendar: Credenciales no configuradas');
        }
        const msalInstance = new msal_node_1.ConfidentialClientApplication(this.msalConfig);
        const redirectUri = process.env.MICROSOFT_REDIRECT_URI || '';
        if (!redirectUri) {
            throw new Error('MICROSOFT_REDIRECT_URI no está configurado');
        }
        return await msalInstance.getAuthCodeUrl({
            scopes: ['https://graph.microsoft.com/Calendars.Read'],
            redirectUri
        });
    }
    // Obtener tokens desde código de autorización
    async getTokensFromCode(code) {
        if (!this.msalConfig) {
            throw new Error('Microsoft Calendar: Credenciales no configuradas');
        }
        const msalInstance = new msal_node_1.ConfidentialClientApplication(this.msalConfig);
        const redirectUri = process.env.MICROSOFT_REDIRECT_URI || '';
        if (!redirectUri) {
            throw new Error('MICROSOFT_REDIRECT_URI no está configurado');
        }
        const response = await msalInstance.acquireTokenByCode({
            code,
            scopes: ['https://graph.microsoft.com/Calendars.Read'],
            redirectUri
        });
        return {
            access_token: response.accessToken,
            refresh_token: undefined // MSAL no devuelve refresh token directamente
        };
    }
    // Obtener eventos de Outlook Calendar
    async getEvents(accessToken, calendarId = 'default', timeMin, timeMax) {
        const baseUrl = 'https://graph.microsoft.com/v1.0';
        const endpoint = calendarId === 'default'
            ? `${baseUrl}/me/calendarView`
            : `${baseUrl}/me/calendars/${calendarId}/calendarView`;
        const params = new URLSearchParams();
        if (timeMin)
            params.append('startDateTime', timeMin.toISOString());
        if (timeMax)
            params.append('endDateTime', timeMax.toISOString());
        const response = await fetch(`${endpoint}?${params}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        return data.value || [];
    }
}
// Servicio principal de sincronización
class CalendarSyncService {
    constructor() {
        this.googleService = new GoogleCalendarService();
        this.outlookService = new OutlookCalendarService();
    }
    // Iniciar sincronización automática (cada hora)
    startAutoSync() {
        node_cron_1.default.schedule('0 * * * *', () => {
            console.log('Iniciando sincronización automática de calendarios...');
            this.syncAllCalendars();
        });
    }
    // Sincronizar todos los calendarios vinculados
    async syncAllCalendars() {
        try {
            const activeLinks = await prisma.externalCalendarLink.findMany({
                where: { activo: true }
            });
            for (const link of activeLinks) {
                await this.syncCalendar(link);
            }
        }
        catch (error) {
            console.error('Error en sincronización automática:', error);
        }
    }
    // Sincronizar un calendario específico
    async syncCalendar(link) {
        var _a, _b;
        try {
            const decryptedAccessToken = decryptToken(link.accessToken);
            const timeMin = new Date();
            const timeMax = new Date();
            timeMax.setDate(timeMax.getDate() + 30); // Sincronizar próximos 30 días
            let events = [];
            switch (link.tipoConexion) {
                case 'google':
                    events = await this.googleService.getEvents(decryptedAccessToken, link.calendarioId, timeMin, timeMax);
                    break;
                case 'outlook':
                    events = await this.outlookService.getEvents(decryptedAccessToken, link.calendarioId, timeMin, timeMax);
                    break;
                // Agregar otros casos según sea necesario
            }
            await this.processExternalEvents(events, link);
        }
        catch (error) {
            console.error(`Error sincronizando calendario ${link.tipoConexion}:`, error);
            // Si el token expiró, intentar refrescar
            if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('token')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('unauthorized'))) {
                await this.refreshToken(link);
            }
        }
    }
    // Procesar eventos externos y evitar duplicados
    async processExternalEvents(events, link) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        for (const event of events) {
            // Crear un hash único para evitar duplicados
            const eventHash = this.createEventHash(event, link);
            // Verificar si ya existe
            const existingEvent = await prisma.internalCalendarEvent.findFirst({
                where: {
                    doctorId: link.doctorId,
                    origenEvento: link.tipoConexion,
                    titulo: event.summary || event.subject || 'Sin título',
                    fechaHoraInicio: new Date(((_a = event.start) === null || _a === void 0 ? void 0 : _a.dateTime) || ((_b = event.start) === null || _b === void 0 ? void 0 : _b.date)),
                    fechaHoraFin: new Date(((_c = event.end) === null || _c === void 0 ? void 0 : _c.dateTime) || ((_d = event.end) === null || _d === void 0 ? void 0 : _d.date))
                }
            });
            if (!existingEvent) {
                // Insertar evento como "sombra" (solo lectura)
                await prisma.internalCalendarEvent.create({
                    data: {
                        doctorId: link.doctorId,
                        titulo: event.summary || event.subject || 'Sin título',
                        descripcion: event.description || ((_e = event.body) === null || _e === void 0 ? void 0 : _e.content) || '',
                        fechaHoraInicio: new Date(((_f = event.start) === null || _f === void 0 ? void 0 : _f.dateTime) || ((_g = event.start) === null || _g === void 0 ? void 0 : _g.date)),
                        fechaHoraFin: new Date(((_h = event.end) === null || _h === void 0 ? void 0 : _h.dateTime) || ((_j = event.end) === null || _j === void 0 ? void 0 : _j.date)),
                        origenEvento: link.tipoConexion,
                        linkMeeting: event.hangoutLink || ((_k = event.onlineMeeting) === null || _k === void 0 ? void 0 : _k.joinUrl) || '',
                        creadoPor: link.doctorId
                    }
                });
            }
        }
    }
    // Crear hash único para evento
    createEventHash(event, link) {
        var _a, _b, _c, _d;
        const eventData = {
            doctorId: link.doctorId,
            origenEvento: link.tipoConexion,
            titulo: event.summary || event.subject,
            fechaInicio: ((_a = event.start) === null || _a === void 0 ? void 0 : _a.dateTime) || ((_b = event.start) === null || _b === void 0 ? void 0 : _b.date),
            fechaFin: ((_c = event.end) === null || _c === void 0 ? void 0 : _c.dateTime) || ((_d = event.end) === null || _d === void 0 ? void 0 : _d.date)
        };
        return crypto_js_1.default.SHA256(JSON.stringify(eventData)).toString();
    }
    // Refrescar token expirado
    async refreshToken(link) {
        try {
            if (!link.refreshToken)
                return;
            const decryptedRefreshToken = decryptToken(link.refreshToken);
            let newTokens;
            switch (link.tipoConexion) {
                case 'google':
                    newTokens = await this.googleService.refreshToken(decryptedRefreshToken);
                    break;
                case 'outlook':
                    // Implementar refresh para Outlook
                    break;
            }
            if (newTokens) {
                await prisma.externalCalendarLink.update({
                    where: { id: link.id },
                    data: {
                        accessToken: encryptToken(newTokens.access_token),
                        refreshToken: newTokens.refresh_token ? encryptToken(newTokens.refresh_token) : link.refreshToken
                    }
                });
            }
        }
        catch (error) {
            console.error('Error refrescando token:', error);
            // Desactivar el enlace si no se puede refrescar
            await prisma.externalCalendarLink.update({
                where: { id: link.id },
                data: { activo: false }
            });
        }
    }
    // Vincular calendario externo
    async linkExternalCalendar(doctorId, tipoConexion, tokens, calendarioId) {
        const encryptedAccessToken = encryptToken(tokens.access_token);
        const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
        return await prisma.externalCalendarLink.create({
            data: {
                doctorId,
                tipoConexion,
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                calendarioId,
                activo: true
            }
        });
    }
    // Desvincular calendario externo
    async unlinkExternalCalendar(linkId, doctorId) {
        await prisma.externalCalendarLink.deleteMany({
            where: {
                id: linkId,
                doctorId
            }
        });
    }
    // Obtener enlaces de calendario de un doctor
    async getDoctorCalendarLinks(doctorId) {
        return await prisma.externalCalendarLink.findMany({
            where: { doctorId },
            orderBy: { fechaVinculacion: 'desc' }
        });
    }
    // Activar/desactivar sincronización
    async toggleSync(linkId, doctorId, activo) {
        await prisma.externalCalendarLink.updateMany({
            where: {
                id: linkId,
                doctorId
            },
            data: { activo }
        });
    }
    // Generar URL de autorización según el tipo
    async generateAuthUrl(tipoConexion) {
        switch (tipoConexion) {
            case 'google':
                return this.googleService.generateAuthUrl();
            case 'outlook':
                return await this.outlookService.generateAuthUrl();
            default:
                throw new Error('Tipo de conexión no soportado');
        }
    }
    // Obtener tokens desde código según el tipo
    async getTokensFromCode(tipoConexion, code) {
        switch (tipoConexion) {
            case 'google':
                return await this.googleService.getTokensFromCode(code);
            case 'outlook':
                return await this.outlookService.getTokensFromCode(code);
            default:
                throw new Error('Tipo de conexión no soportado');
        }
    }
}
exports.default = CalendarSyncService;
