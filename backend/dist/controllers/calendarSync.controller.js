"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarSyncController = void 0;
const client_1 = require("@prisma/client");
const googleapis_1 = require("googleapis");
const oauth_service_1 = require("../services/oauth.service");
const calendarAuth_utils_1 = require("../utils/calendarAuth.utils");
const outlookCalendarSync_service_1 = require("../services/outlookCalendarSync.service");
const appleCalendarSync_service_1 = require("../services/appleCalendarSync.service");
const notionCalendarSync_service_1 = require("../services/notionCalendarSync.service");
const oauth_config_1 = require("../config/oauth.config");
const error_utils_1 = require("../utils/error.utils");
const calendarSync_utils_1 = require("../utils/calendarSync.utils");
const prisma = new client_1.PrismaClient();
const DEFAULT_CALENDAR_TIMEZONE = process.env.CALENDAR_DEFAULT_TIMEZONE || 'America/Mexico_City';
const resolveDoctorId = async (req) => {
    if (!req.user) {
        throw new error_utils_1.AppError('Usuario no autenticado', 401);
    }
    if (req.user.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.userId },
            select: { id: true }
        });
        if (!doctor) {
            throw new error_utils_1.AppError('Perfil de doctor no encontrado', 404);
        }
        return doctor.id;
    }
    if (req.user.role === 'ASISTENTE') {
        const selectedDoctorId = req.headers['x-selected-doctor-id'];
        if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
            throw new error_utils_1.AppError('Doctor seleccionado requerido', 400);
        }
        const link = await prisma.asistenteDoctorVinculo.findFirst({
            where: {
                doctorId: selectedDoctorId,
                asistenteId: req.user.userId,
                activo: true
            },
            select: { id: true }
        });
        if (!link) {
            throw new error_utils_1.AppError('Asistente no vinculado a este doctor', 403);
        }
        return selectedDoctorId;
    }
    throw new error_utils_1.AppError('Acceso denegado', 403);
};
class CalendarSyncController {
    // Obtener estado de sincronización de todos los calendarios
    static async getSyncStatus(req, res) {
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de doctor requerido'
                });
            }
            // Buscar configuraciones de sincronización del doctor
            const syncConfigs = await prisma.calendarSyncConfig.findMany({
                where: { doctorId },
                select: {
                    provider: true,
                    isConnected: true,
                    lastSync: true,
                    error: true,
                    accessToken: true,
                    refreshToken: true,
                    expiresAt: true
                }
            });
            // Crear respuesta con estado de cada proveedor
            const syncStatus = {
                outlook: { connected: false, loading: false, lastSync: null, error: null },
                google: { connected: false, loading: false, lastSync: null, error: null },
                notion: { connected: false, loading: false, lastSync: null, error: null },
                apple: { connected: false, loading: false, lastSync: null, error: null }
            };
            syncConfigs.forEach(config => {
                if (syncStatus[config.provider]) {
                    syncStatus[config.provider] = {
                        connected: config.isConnected,
                        loading: false,
                        lastSync: config.lastSync,
                        error: config.error
                    };
                }
            });
            res.json({
                success: true,
                data: syncStatus
            });
        }
        catch (error) {
            console.error('Error getting sync status:', error);
            const handled = error instanceof error_utils_1.AppError
                ? error
                : new error_utils_1.AppError('Error al obtener estado de sincronización', 500);
            res.status(handled.statusCode).json({
                success: false,
                message: handled.message
            });
        }
    }
    // Autenticación con Outlook
    static async authOutlook(req, res) {
        var _a;
        try {
            const { code, state, doctorId: queryDoctorId } = req.query;
            // Obtener doctorId del usuario autenticado, parámetro o state
            let doctorId;
            if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId) {
                doctorId = req.user.doctorId;
            }
            if (!doctorId && queryDoctorId && typeof queryDoctorId === 'string') {
                doctorId = queryDoctorId;
            }
            if (!doctorId && state && typeof state === 'string') {
                try {
                    const parsedState = JSON.parse(state);
                    if (parsedState === null || parsedState === void 0 ? void 0 : parsedState.doctorId) {
                        doctorId = parsedState.doctorId;
                    }
                }
                catch (error) {
                    console.warn('No se pudo parsear state de Outlook OAuth:', error);
                }
            }
            if (!doctorId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de doctor requerido'
                });
            }
            const isConfigured = (0, oauth_config_1.isOAuthConfigured)('outlook');
            // Si OAuth no está configurado, no permitir conexión simulada (evitar éxito falso)
            if (!isConfigured) {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                return res.status(503).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Integración no configurada</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #EF4444; }
              .info { color: #6B7280; margin: 20px 0; }
              .loading { color: #6B7280; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h2 class="error">⚠️ Integración no configurada</h2>
            <p class="info">La conexión con Microsoft Outlook no está disponible. El administrador debe configurar las credenciales OAuth (OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_REDIRECT_URI) en el servidor.</p>
            <p class="loading">Redirigiendo a la plataforma...</p>
            <script>
              setTimeout(() => { window.location.href = '${frontendUrl}/dashboard/calendario'; }, 3000);
            </script>
          </body>
          </html>
        `);
            }
            // Si OAuth está configurado pero no hay código, generar URL de OAuth y redirigir
            if (!code) {
                const state = JSON.stringify({ doctorId });
                const authUrl = oauth_service_1.OAuthService.generateAuthUrl('outlook', state);
                if (!authUrl) {
                    return res.status(500).json({
                        success: false,
                        message: 'Error al generar URL de autenticación'
                    });
                }
                return res.redirect(authUrl);
            }
            const tokens = await oauth_service_1.OAuthService.exchangeCodeForTokens('outlook', code);
            if (!(tokens === null || tokens === void 0 ? void 0 : tokens.access_token)) {
                throw new Error('No se pudieron obtener los tokens de Outlook');
            }
            const expiresAt = tokens.expires_in
                ? new Date(Date.now() + tokens.expires_in * 1000)
                : new Date(Date.now() + 3600000);
            // Guardar configuración de sincronización con tokens reales
            await prisma.calendarSyncConfig.upsert({
                where: {
                    doctorId_provider: {
                        doctorId,
                        provider: 'outlook'
                    }
                },
                update: {
                    isConnected: true,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token || null,
                    expiresAt,
                    lastSync: new Date(),
                    error: null
                },
                create: {
                    doctorId,
                    provider: 'outlook',
                    isConnected: true,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token || null,
                    expiresAt,
                    lastSync: new Date(),
                    error: null
                }
            });
            // Retornar página HTML que notifique al padre
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Autenticación Exitosa</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #10B981; }
            .loading { color: #6B7280; margin-top: 20px; }
            .close-btn { 
              background: #3B82F6; 
              color: white; 
              border: none; 
              padding: 10px 20px; 
              border-radius: 5px; 
              cursor: pointer; 
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <h2 class="success">✅ Autenticación Exitosa</h2>
          <p>Tu calendario de Outlook ha sido conectado exitosamente.</p>
          <p class="loading">Redirigiendo a la plataforma...</p>
          <script>
            if (window.opener) {
              // Si se abrió como popup, notificar al padre y cerrar
              window.opener.postMessage({
                type: 'CALENDAR_AUTH_SUCCESS',
                provider: 'outlook'
              }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              // Si es redirección normal, redirigir a la plataforma
              setTimeout(() => {
                window.location.href = '${frontendUrl}/dashboard/calendario';
              }, 1500);
            }
          </script>
        </body>
        </html>
      `);
        }
        catch (error) {
            console.error('Error in Outlook auth:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error de Autenticación</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #EF4444; }
            .loading { color: #6B7280; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2 class="error">❌ Error de Autenticación</h2>
          <p>No se pudo conectar con Outlook. Por favor, intenta nuevamente.</p>
          <p class="loading">Redirigiendo a la plataforma...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'CALENDAR_AUTH_ERROR',
                provider: 'outlook',
                error: 'Error de autenticación'
              }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              setTimeout(() => {
                window.location.href = '${frontendUrl}/dashboard/calendario';
              }, 1500);
            }
          </script>
        </body>
        </html>
      `);
        }
    }
    // Autenticación con Google Calendar
    static async authGoogle(req, res) {
        var _a;
        try {
            const { code, state, doctorId: queryDoctorId } = req.query;
            let doctorId;
            if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId) {
                doctorId = req.user.doctorId;
            }
            if (!doctorId && queryDoctorId && typeof queryDoctorId === 'string') {
                doctorId = queryDoctorId;
            }
            if (!doctorId && state && typeof state === 'string') {
                try {
                    const parsedState = JSON.parse(state);
                    if (parsedState === null || parsedState === void 0 ? void 0 : parsedState.doctorId) {
                        doctorId = parsedState.doctorId;
                    }
                }
                catch (error) {
                    console.warn('No se pudo parsear state de Google OAuth:', error);
                }
            }
            if (!doctorId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de doctor requerido'
                });
            }
            const oauthConfigured = (0, oauth_config_1.isOAuthConfigured)('google');
            // Si OAuth no está configurado, no permitir conexión simulada (evitar éxito falso)
            if (!oauthConfigured) {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                return res.status(503).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Integración no configurada</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #EF4444; }
              .info { color: #6B7280; margin: 20px 0; }
              .loading { color: #6B7280; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h2 class="error">⚠️ Integración no configurada</h2>
            <p class="info">La conexión con Google Calendar no está disponible. El administrador debe configurar las credenciales OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI) en el servidor.</p>
            <p class="loading">Redirigiendo a la plataforma...</p>
            <script>
              setTimeout(() => { window.location.href = '${frontendUrl}/dashboard/calendario'; }, 3000);
            </script>
          </body>
          </html>
        `);
            }
            // Si OAuth está configurado pero no hay código, generar URL de OAuth y redirigir
            if (!code) {
                const state = JSON.stringify({ doctorId });
                const authUrl = oauth_service_1.OAuthService.generateAuthUrl('google', state);
                if (!authUrl) {
                    return res.status(500).json({
                        success: false,
                        message: 'Error al generar URL de autenticación'
                    });
                }
                return res.redirect(authUrl);
            }
            // Autenticación OAuth2 real (ya verificamos que está configurado arriba)
            const tokens = await oauth_service_1.OAuthService.exchangeCodeForTokens('google', code);
            if (!tokens) {
                throw new Error('Error al obtener tokens de Google');
            }
            const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;
            // Guardar configuración con tokens reales
            const syncConfig = await prisma.calendarSyncConfig.upsert({
                where: {
                    doctorId_provider: {
                        doctorId,
                        provider: 'google'
                    }
                },
                update: {
                    isConnected: true,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token || null,
                    expiresAt,
                    lastSync: new Date(),
                    error: null
                },
                create: {
                    doctorId,
                    provider: 'google',
                    isConnected: true,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token || null,
                    expiresAt,
                    lastSync: new Date(),
                    error: null
                }
            });
            // Realizar sincronización inicial inmediatamente para traer eventos
            try {
                await CalendarSyncController.syncGoogleCalendar(doctorId, syncConfig);
            }
            catch (syncError) {
                console.warn('No se pudo realizar la sincronización inicial de Google:', syncError);
            }
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Autenticación Exitosa</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #10B981; }
            .loading { color: #6B7280; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2 class="success">✅ Autenticación Exitosa</h2>
          <p>Tu calendario de Google ha sido conectado exitosamente.</p>
          <p class="loading">Redirigiendo a la plataforma...</p>
          <script>
            if (window.opener) {
              // Si se abrió como popup, notificar al padre y cerrar
              window.opener.postMessage({
                type: 'CALENDAR_AUTH_SUCCESS',
                provider: 'google'
              }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              // Si es redirección normal, redirigir a la plataforma
              setTimeout(() => {
                window.location.href = '${frontendUrl}/dashboard/calendario';
              }, 1500);
            }
          </script>
        </body>
        </html>
      `);
        }
        catch (error) {
            console.error('Error in Google auth:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error de Autenticación</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #EF4444; }
            .loading { color: #6B7280; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2 class="error">❌ Error de Autenticación</h2>
          <p>No se pudo conectar con Google Calendar.</p>
          <p class="loading">Redirigiendo a la plataforma...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'CALENDAR_AUTH_ERROR',
                provider: 'google',
                error: 'Error de autenticación'
              }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              setTimeout(() => {
                window.location.href = '${frontendUrl}/dashboard/calendario';
              }, 1500);
            }
          </script>
        </body>
        </html>
      `);
        }
    }
    // Autenticación con Notion
    static async authNotion(req, res) {
        var _a;
        try {
            const { code, state, doctorId: queryDoctorId } = req.query;
            let doctorId;
            if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId) {
                doctorId = req.user.doctorId;
            }
            if (!doctorId && queryDoctorId && typeof queryDoctorId === 'string') {
                doctorId = queryDoctorId;
            }
            if (!doctorId && state && typeof state === 'string') {
                try {
                    const parsedState = JSON.parse(state);
                    if (parsedState === null || parsedState === void 0 ? void 0 : parsedState.doctorId) {
                        doctorId = parsedState.doctorId;
                    }
                }
                catch (error) {
                    console.warn('No se pudo parsear state de Notion OAuth:', error);
                }
            }
            if (!doctorId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de doctor requerido'
                });
            }
            const isConfigured = (0, oauth_config_1.isOAuthConfigured)('notion');
            // Si OAuth no está configurado, no permitir conexión simulada (evitar éxito falso)
            if (!isConfigured) {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                return res.status(503).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Integración no configurada</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #EF4444; }
              .info { color: #6B7280; margin: 20px 0; }
              .loading { color: #6B7280; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h2 class="error">⚠️ Integración no configurada</h2>
            <p class="info">La conexión con Notion Calendar no está disponible. El administrador debe configurar las credenciales OAuth (NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, NOTION_REDIRECT_URI) en el servidor.</p>
            <p class="loading">Redirigiendo a la plataforma...</p>
            <script>
              setTimeout(() => { window.location.href = '${frontendUrl}/dashboard/calendario'; }, 3000);
            </script>
          </body>
          </html>
        `);
            }
            // Si OAuth está configurado pero no hay código, generar URL de OAuth y redirigir
            if (!code) {
                const state = JSON.stringify({ doctorId });
                const authUrl = oauth_service_1.OAuthService.generateAuthUrl('notion', state);
                if (!authUrl) {
                    return res.status(500).json({
                        success: false,
                        message: 'Error al generar URL de autenticación'
                    });
                }
                return res.redirect(authUrl);
            }
            const tokens = await oauth_service_1.OAuthService.exchangeCodeForTokens('notion', code);
            if (!(tokens === null || tokens === void 0 ? void 0 : tokens.access_token)) {
                throw new Error('No se pudieron obtener los tokens de Notion');
            }
            const expiresAt = tokens.expires_in
                ? new Date(Date.now() + tokens.expires_in * 1000)
                : new Date(Date.now() + 3600000);
            // Guardar configuración de sincronización con tokens reales
            await prisma.calendarSyncConfig.upsert({
                where: {
                    doctorId_provider: {
                        doctorId,
                        provider: 'notion'
                    }
                },
                update: {
                    isConnected: true,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token || null,
                    expiresAt,
                    lastSync: new Date(),
                    error: null
                },
                create: {
                    doctorId,
                    provider: 'notion',
                    isConnected: true,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token || null,
                    expiresAt,
                    lastSync: new Date(),
                    error: null
                }
            });
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Autenticación Exitosa</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #10B981; }
            .loading { color: #6B7280; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2 class="success">✅ Autenticación Exitosa</h2>
          <p>Tu workspace de Notion ha sido conectado exitosamente.</p>
          <p class="loading">Redirigiendo a la plataforma...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'CALENDAR_AUTH_SUCCESS',
                provider: 'notion'
              }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              setTimeout(() => {
                window.location.href = '${frontendUrl}/dashboard/calendario';
              }, 1500);
            }
          </script>
        </body>
        </html>
      `);
        }
        catch (error) {
            console.error('Error in Notion auth:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error de Autenticación</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #EF4444; }
            .loading { color: #6B7280; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2 class="error">❌ Error de Autenticación</h2>
          <p>No se pudo conectar con Notion.</p>
          <p class="loading">Redirigiendo a la plataforma...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'CALENDAR_AUTH_ERROR',
                provider: 'notion',
                error: 'Error de autenticación'
              }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              setTimeout(() => {
                window.location.href = '${frontendUrl}/dashboard/calendario';
              }, 1500);
            }
          </script>
        </body>
        </html>
      `);
        }
    }
    // Autenticación con Apple Calendar
    static async authApple(req, res) {
        var _a;
        try {
            const { code, state, doctorId: queryDoctorId } = req.query;
            let doctorId;
            if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId) {
                doctorId = req.user.doctorId;
            }
            if (!doctorId && queryDoctorId && typeof queryDoctorId === 'string') {
                doctorId = queryDoctorId;
            }
            if (!doctorId && state && typeof state === 'string') {
                try {
                    const parsedState = JSON.parse(state);
                    if (parsedState === null || parsedState === void 0 ? void 0 : parsedState.doctorId) {
                        doctorId = parsedState.doctorId;
                    }
                }
                catch (error) {
                    console.warn('No se pudo parsear state de Apple OAuth:', error);
                }
            }
            if (!doctorId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de doctor requerido'
                });
            }
            const isConfigured = (0, oauth_config_1.isOAuthConfigured)('apple');
            // Si OAuth no está configurado, no permitir conexión simulada (evitar éxito falso)
            if (!isConfigured) {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                return res.status(503).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Integración no configurada</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #EF4444; }
              .info { color: #6B7280; margin: 20px 0; }
              .loading { color: #6B7280; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h2 class="error">⚠️ Integración no configurada</h2>
            <p class="info">La conexión con Apple Calendar no está disponible. El administrador debe configurar las credenciales OAuth (APPLE_CLIENT_ID, APPLE_CLIENT_SECRET, APPLE_REDIRECT_URI) en el servidor.</p>
            <p class="loading">Redirigiendo a la plataforma...</p>
            <script>
              setTimeout(() => { window.location.href = '${frontendUrl}/dashboard/calendario'; }, 3000);
            </script>
          </body>
          </html>
        `);
            }
            // Si OAuth está configurado pero no hay código, generar URL de OAuth y redirigir
            if (!code) {
                const state = JSON.stringify({ doctorId });
                const authUrl = oauth_service_1.OAuthService.generateAuthUrl('apple', state);
                if (!authUrl) {
                    return res.status(500).json({
                        success: false,
                        message: 'Error al generar URL de autenticación'
                    });
                }
                return res.redirect(authUrl);
            }
            // OAuth para Apple (requiere configuración en oauth.config)
            const tokens = await oauth_service_1.OAuthService.exchangeCodeForTokens('apple', code);
            if (!(tokens === null || tokens === void 0 ? void 0 : tokens.access_token)) {
                throw new Error('No se pudieron obtener los tokens de Apple');
            }
            const expiresAt = tokens.expires_in
                ? new Date(Date.now() + tokens.expires_in * 1000)
                : new Date(Date.now() + 3600000);
            await prisma.calendarSyncConfig.upsert({
                where: {
                    doctorId_provider: {
                        doctorId,
                        provider: 'apple'
                    }
                },
                update: {
                    isConnected: true,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token || null,
                    expiresAt,
                    lastSync: new Date(),
                    error: null
                },
                create: {
                    doctorId,
                    provider: 'apple',
                    isConnected: true,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token || null,
                    expiresAt,
                    lastSync: new Date(),
                    error: null
                }
            });
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Autenticación Exitosa</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #10B981; }
            .loading { color: #6B7280; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2 class="success">✅ Autenticación Exitosa</h2>
          <p>Tu calendario de Apple ha sido conectado exitosamente.</p>
          <p class="loading">Redirigiendo a la plataforma...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'CALENDAR_AUTH_SUCCESS',
                provider: 'apple'
              }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              setTimeout(() => {
                window.location.href = '${frontendUrl}/dashboard/calendario';
              }, 1500);
            }
          </script>
        </body>
        </html>
      `);
        }
        catch (error) {
            console.error('Error in Apple auth:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error de Autenticación</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #EF4444; }
            .loading { color: #6B7280; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2 class="error">❌ Error de Autenticación</h2>
          <p>No se pudo conectar con Apple Calendar.</p>
          <p class="loading">Redirigiendo a la plataforma...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'CALENDAR_AUTH_ERROR',
                provider: 'apple',
                error: 'Error de autenticación'
              }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              setTimeout(() => {
                window.location.href = '${frontendUrl}/dashboard/calendario';
              }, 1500);
            }
          </script>
        </body>
        </html>
      `);
        }
    }
    // Desconectar calendario
    static async disconnectCalendar(req, res) {
        var _a;
        try {
            const { provider } = req.params;
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (!doctorId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de doctor requerido'
                });
            }
            // Verificar que el proveedor sea válido
            const validProviders = ['outlook', 'google', 'notion', 'apple'];
            if (!validProviders.includes(provider)) {
                return res.status(400).json({
                    success: false,
                    message: 'Proveedor no válido'
                });
            }
            // Actualizar configuración para marcar como desconectado
            await prisma.calendarSyncConfig.updateMany({
                where: {
                    doctorId,
                    provider
                },
                data: {
                    isConnected: false,
                    accessToken: null,
                    refreshToken: null,
                    expiresAt: null,
                    error: null
                }
            });
            res.json({
                success: true,
                message: `Calendario ${provider} desconectado exitosamente`
            });
        }
        catch (error) {
            console.error('Error disconnecting calendar:', error);
            res.status(500).json({
                success: false,
                message: 'Error al desconectar calendario'
            });
        }
    }
    // Sincronizar calendario manualmente
    static async syncCalendar(req, res) {
        var _a;
        try {
            const { provider } = req.params;
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (!doctorId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de doctor requerido'
                });
            }
            // Verificar que el proveedor sea válido
            const validProviders = ['outlook', 'google', 'notion', 'apple'];
            if (!validProviders.includes(provider)) {
                return res.status(400).json({
                    success: false,
                    message: 'Proveedor no válido'
                });
            }
            // Verificar que el calendario esté conectado
            const syncConfig = await prisma.calendarSyncConfig.findFirst({
                where: {
                    doctorId,
                    provider,
                    isConnected: true
                }
            });
            if (!syncConfig) {
                return res.status(400).json({
                    success: false,
                    message: 'Calendario no está conectado'
                });
            }
            let syncResult = null;
            if (provider === 'google') {
                syncResult = await CalendarSyncController.syncGoogleCalendar(doctorId, syncConfig);
            }
            else if (provider === 'outlook') {
                syncResult = await outlookCalendarSync_service_1.OutlookCalendarSyncService.syncCalendar(doctorId, syncConfig);
            }
            else if (provider === 'apple') {
                syncResult = await appleCalendarSync_service_1.AppleCalendarSyncService.syncCalendar(doctorId);
            }
            else if (provider === 'notion') {
                syncResult = await notionCalendarSync_service_1.NotionCalendarSyncService.syncCalendar(doctorId, syncConfig);
            }
            else {
                // Actualizar última sincronización aun cuando no haya lógica específica
                await prisma.calendarSyncConfig.update({
                    where: { id: syncConfig.id },
                    data: {
                        lastSync: new Date(),
                        error: null
                    }
                });
            }
            res.json({
                success: true,
                message: `Calendario ${provider} sincronizado exitosamente`,
                data: Object.assign({ lastSync: new Date() }, syncResult)
            });
        }
        catch (error) {
            console.error('Error syncing calendar:', error);
            res.status(500).json({
                success: false,
                message: 'Error al sincronizar calendario'
            });
        }
    }
    // Obtener eventos del calendario (endpoint faltante)
    static async getCalendarEvents(req, res) {
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de doctor requerido'
                });
            }
            const { startDate, endDate, start, end, provider, origenEvento } = req.query;
            const where = {
                doctorId
            };
            const providerFilter = (provider || origenEvento);
            if (providerFilter) {
                where.origenEvento = providerFilter;
            }
            const startParam = startDate || start;
            const endParam = endDate || end;
            if (startParam || endParam) {
                where.fechaHoraInicio = {};
                if (startParam) {
                    where.fechaHoraInicio.gte = new Date(startParam);
                }
                if (endParam) {
                    where.fechaHoraInicio.lte = new Date(endParam);
                }
            }
            const events = await prisma.internalCalendarEvent.findMany({
                where,
                orderBy: {
                    fechaHoraInicio: 'asc'
                },
                take: 1000,
                select: {
                    id: true,
                    titulo: true,
                    fechaHoraInicio: true,
                    fechaHoraFin: true,
                    descripcion: true,
                    origenEvento: true,
                    linkMeeting: true,
                    patientId: true,
                    externalProvider: true,
                    externalEventId: true,
                    externalUpdatedAt: true,
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true
                        }
                    },
                    doctor: {
                        select: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    }
                }
            });
            res.json({
                success: true,
                data: events
            });
        }
        catch (error) {
            console.error('Error getting calendar events:', error);
            const handled = error instanceof error_utils_1.AppError
                ? error
                : new error_utils_1.AppError('Error al obtener eventos del calendario', 500);
            res.status(handled.statusCode).json({
                success: false,
                message: handled.message
            });
        }
    }
    static createGoogleClient() {
        const config = (0, oauth_config_1.getOAuthConfig)('google');
        if (!config) {
            throw new Error('Google OAuth no está configurado');
        }
        return new googleapis_1.google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    }
    static normalizeGoogleDate(dateInfo) {
        if (!dateInfo)
            return null;
        if (dateInfo.dateTime) {
            return new Date(dateInfo.dateTime);
        }
        if (dateInfo.date) {
            // Tratar eventos de día completo en la zona horaria del calendario
            if (dateInfo.timeZone) {
                return new Date(`${dateInfo.date}T00:00:00${CalendarSyncController.timeZoneOffset(dateInfo.timeZone)}`);
            }
            return new Date(`${dateInfo.date}T00:00:00`);
        }
        return null;
    }
    static timeZoneOffset(timeZone) {
        var _a, _b, _c, _d, _e, _f;
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone,
                hour12: false,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            const parts = formatter.formatToParts(new Date());
            const datePart = `${(_a = parts.find(p => p.type === 'year')) === null || _a === void 0 ? void 0 : _a.value}-${(_b = parts.find(p => p.type === 'month')) === null || _b === void 0 ? void 0 : _b.value}-${(_c = parts.find(p => p.type === 'day')) === null || _c === void 0 ? void 0 : _c.value}`;
            const timePart = `${(_d = parts.find(p => p.type === 'hour')) === null || _d === void 0 ? void 0 : _d.value}:${(_e = parts.find(p => p.type === 'minute')) === null || _e === void 0 ? void 0 : _e.value}:${(_f = parts.find(p => p.type === 'second')) === null || _f === void 0 ? void 0 : _f.value}`;
            const targetDate = new Date(`${datePart}T${timePart}`);
            const localDate = new Date();
            const offsetMinutes = (targetDate.getTime() - localDate.getTime()) / (60 * 1000);
            const sign = offsetMinutes >= 0 ? '+' : '-';
            const absolute = Math.abs(offsetMinutes);
            const hours = Math.floor(absolute / 60).toString().padStart(2, '0');
            const minutes = Math.floor(absolute % 60).toString().padStart(2, '0');
            return `${sign}${hours}:${minutes}`;
        }
        catch (_g) {
            return '+00:00';
        }
    }
    static async withGoogleCalendar(doctorId, initialConfig, executor) {
        var _a;
        let syncConfig = initialConfig;
        if (!syncConfig) {
            syncConfig = await prisma.calendarSyncConfig.findFirst({
                where: {
                    doctorId,
                    provider: 'google',
                    isConnected: true
                }
            });
        }
        if (!syncConfig || !syncConfig.accessToken) {
            return null;
        }
        const instantiateClient = (config) => {
            const client = CalendarSyncController.createGoogleClient();
            client.setCredentials({
                access_token: config.accessToken || undefined,
                refresh_token: config.refreshToken || undefined
            });
            return googleapis_1.google.calendar({ version: 'v3', auth: client });
        };
        let calendarClient = instantiateClient(syncConfig);
        const runExecutor = async (config) => {
            calendarClient = instantiateClient(config);
            return executor(calendarClient, config);
        };
        try {
            return await executor(calendarClient, syncConfig);
        }
        catch (error) {
            const status = (error === null || error === void 0 ? void 0 : error.code) || ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status);
            if ((status === 401 || status === 403) && syncConfig.refreshToken) {
                const refreshed = await oauth_service_1.OAuthService.refreshAccessToken('google', syncConfig.refreshToken);
                if (!(refreshed === null || refreshed === void 0 ? void 0 : refreshed.access_token)) {
                    await (0, calendarAuth_utils_1.notifyCalendarReconnectNeeded)({
                        doctorId: syncConfig.doctorId,
                        provider: 'google',
                        reason: 'Conexión expirada. Vuelve a conectar Google Calendar.'
                    });
                    throw error;
                }
                const updatedConfig = await prisma.calendarSyncConfig.update({
                    where: { id: syncConfig.id },
                    data: {
                        accessToken: refreshed.access_token,
                        refreshToken: refreshed.refresh_token || syncConfig.refreshToken,
                        expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : syncConfig.expiresAt
                    }
                });
                return await runExecutor(updatedConfig);
            }
            throw error;
        }
    }
    static buildGoogleEventPayload(event) {
        var _a;
        const attendees = ((_a = event.patient) === null || _a === void 0 ? void 0 : _a.email)
            ? [{
                    email: event.patient.email,
                    displayName: [event.patient.firstName, event.patient.lastName].filter(Boolean).join(' ') || undefined
                }]
            : undefined;
        return {
            summary: event.titulo,
            description: event.descripcion || undefined,
            location: event.linkMeeting || undefined,
            start: {
                dateTime: event.fechaHoraInicio.toISOString(),
                timeZone: DEFAULT_CALENDAR_TIMEZONE
            },
            end: {
                dateTime: event.fechaHoraFin.toISOString(),
                timeZone: DEFAULT_CALENDAR_TIMEZONE
            },
            attendees,
            reminders: {
                useDefault: true
            }
        };
    }
    static async syncInternalEventToGoogle(doctorId, event) {
        try {
            if (!event || event.origenEvento !== 'interno') {
                return;
            }
            await CalendarSyncController.withGoogleCalendar(doctorId, null, async (calendarClient) => {
                var _a, _b;
                const requestBody = CalendarSyncController.buildGoogleEventPayload(event);
                let response;
                if (event.externalProvider === 'google' && event.externalEventId) {
                    try {
                        response = await calendarClient.events.patch({
                            calendarId: 'primary',
                            eventId: event.externalEventId,
                            requestBody,
                            sendUpdates: 'none'
                        });
                    }
                    catch (error) {
                        const status = (error === null || error === void 0 ? void 0 : error.code) || ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status);
                        if (status !== 404) {
                            throw error;
                        }
                        response = await calendarClient.events.insert({
                            calendarId: 'primary',
                            requestBody,
                            sendUpdates: 'none'
                        });
                    }
                }
                else {
                    response = await calendarClient.events.insert({
                        calendarId: 'primary',
                        requestBody,
                        sendUpdates: 'none'
                    });
                }
                if ((_b = response === null || response === void 0 ? void 0 : response.data) === null || _b === void 0 ? void 0 : _b.id) {
                    await prisma.internalCalendarEvent.update({
                        where: { id: event.id },
                        data: {
                            externalProvider: 'google',
                            externalEventId: response.data.id,
                            externalUpdatedAt: response.data.updated ? new Date(response.data.updated) : new Date()
                        }
                    });
                }
                return null;
            });
        }
        catch (error) {
            console.error('Error syncing event to Google Calendar:', error);
        }
    }
    static async deleteGoogleEventForInternalEvent(doctorId, event) {
        try {
            if (!event || event.externalProvider !== 'google' || !event.externalEventId) {
                return;
            }
            await CalendarSyncController.withGoogleCalendar(doctorId, null, async (calendarClient) => {
                var _a;
                try {
                    await calendarClient.events.delete({
                        calendarId: 'primary',
                        eventId: event.externalEventId,
                        sendUpdates: 'none'
                    });
                }
                catch (error) {
                    const status = (error === null || error === void 0 ? void 0 : error.code) || ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status);
                    if (status !== 404) {
                        throw error;
                    }
                }
                return null;
            });
        }
        catch (error) {
            console.error('Error deleting Google Calendar event:', error);
        }
    }
    static async syncGoogleCalendar(doctorId, syncConfig) {
        var _a, _b, _c, _d;
        const client = CalendarSyncController.createGoogleClient();
        client.setCredentials({
            access_token: syncConfig.accessToken,
            refresh_token: syncConfig.refreshToken || undefined
        });
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth: client });
        const now = new Date();
        const timeMin = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 2 semanas atrás
        const timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // Próximos 2 meses
        let items = [];
        const fetchEvents = async () => {
            const response = await calendar.events.list({
                calendarId: 'primary',
                singleEvents: true,
                orderBy: 'startTime',
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                maxResults: 2500,
                // CRÍTICO: Incluir attendees para verificar el estado de respuesta
                fields: 'items(id,summary,description,start,end,updated,hangoutLink,conferenceData,attendees(responseStatus,email))'
            });
            return response.data.items || [];
        };
        try {
            items = await fetchEvents();
        }
        catch (error) {
            const status = (error === null || error === void 0 ? void 0 : error.code) || ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status);
            if ((status === 401 || status === 403) && syncConfig.refreshToken) {
                const refreshed = await oauth_service_1.OAuthService.refreshAccessToken('google', syncConfig.refreshToken);
                if (!(refreshed === null || refreshed === void 0 ? void 0 : refreshed.access_token)) {
                    await (0, calendarAuth_utils_1.notifyCalendarReconnectNeeded)({
                        doctorId: syncConfig.doctorId,
                        provider: 'google',
                        reason: 'Conexión expirada. Vuelve a conectar Google Calendar.'
                    });
                    throw error;
                }
                await prisma.calendarSyncConfig.update({
                    where: { id: syncConfig.id },
                    data: {
                        accessToken: refreshed.access_token,
                        refreshToken: refreshed.refresh_token || syncConfig.refreshToken,
                        expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : syncConfig.expiresAt,
                        lastSync: new Date()
                    }
                });
                client.setCredentials({
                    access_token: refreshed.access_token,
                    refresh_token: refreshed.refresh_token || syncConfig.refreshToken
                });
                items = await fetchEvents();
            }
            else {
                throw error;
            }
        }
        const existingEvents = await prisma.internalCalendarEvent.findMany({
            where: {
                doctorId,
                externalProvider: 'google',
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
        for (const item of items) {
            if (!item || !item.id)
                continue;
            const startDate = CalendarSyncController.normalizeGoogleDate(item.start);
            const endDate = CalendarSyncController.normalizeGoogleDate(item.end);
            if (!startDate || !endDate)
                continue;
            seen.add(item.id);
            let matchedPatientId = null;
            if (item.attendees && Array.isArray(item.attendees) && startDate) {
                const attendeeEmails = item.attendees
                    .map((attendee) => ((attendee === null || attendee === void 0 ? void 0 : attendee.email) || '').toLowerCase().trim())
                    .filter((email) => !!email);
                if (attendeeEmails.length > 0) {
                    const patient = await prisma.patient.findFirst({
                        where: {
                            OR: [
                                { email: { in: attendeeEmails } },
                                { user: { email: { in: attendeeEmails } } }
                            ],
                            doctors: {
                                some: { doctorId }
                            }
                        },
                        select: { id: true }
                    });
                    if (patient) {
                        const searchStart = new Date(startDate);
                        searchStart.setMinutes(searchStart.getMinutes() - 30);
                        const searchEnd = new Date(startDate);
                        searchEnd.setMinutes(searchEnd.getMinutes() + 30);
                        const appointment = await prisma.appointment.findFirst({
                            where: {
                                doctorId,
                                patientId: patient.id,
                                date: {
                                    gte: searchStart,
                                    lte: searchEnd
                                }
                            },
                            select: { id: true }
                        });
                        if (appointment) {
                            matchedPatientId = patient.id;
                        }
                    }
                }
            }
            const payload = {
                titulo: item.summary || 'Sin título',
                descripcion: item.description || null,
                fechaHoraInicio: startDate,
                fechaHoraFin: endDate,
                origenEvento: 'google',
                linkMeeting: item.hangoutLink || ((_d = (_c = (_b = item.conferenceData) === null || _b === void 0 ? void 0 : _b.entryPoints) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.uri) || null,
                externalProvider: 'google',
                externalEventId: item.id,
                externalUpdatedAt: item.updated ? new Date(item.updated) : new Date(),
                creadoPor: doctorId,
                patientId: matchedPatientId || undefined
            };
            const existing = existingMap.get(item.id);
            let eventId;
            if (existing) {
                const externalStart = startDate;
                if (existing.patientId &&
                    (await (0, calendarSync_utils_1.shouldPushInternalOverExternal)(doctorId, existing, externalStart))) {
                    await (0, calendarSync_utils_1.reconcileCalendarEventWithAppointment)(doctorId, existing);
                    const refreshed = await prisma.internalCalendarEvent.findUnique({ where: { id: existing.id } });
                    if (refreshed === null || refreshed === void 0 ? void 0 : refreshed.appointmentId) {
                        // Solo alinear evento interno; no re-sincronizar calendario externo en cada import (evita bucles).
                        await (0, calendarSync_utils_1.reconcileCalendarEventWithAppointment)(doctorId, refreshed);
                    }
                    else if (refreshed === null || refreshed === void 0 ? void 0 : refreshed.patientId) {
                        await (0, calendarSync_utils_1.reconcileCalendarEventWithAppointment)(doctorId, refreshed);
                    }
                    eventId = existing.id;
                    updated += 0;
                }
                else {
                    const isPresencial = matchedPatientId &&
                        (await prisma.appointment.findFirst({
                            where: {
                                doctorId,
                                patientId: matchedPatientId,
                                appointmentType: 'presencial',
                                date: {
                                    gte: new Date(externalStart.getTime() - 30 * 60000),
                                    lte: new Date(externalStart.getTime() + 30 * 60000)
                                }
                            }
                        }));
                    await prisma.internalCalendarEvent.update({
                        where: { id: existing.id },
                        data: Object.assign(Object.assign({}, payload), { patientId: matchedPatientId || existing.patientId, linkMeeting: isPresencial ? null : payload.linkMeeting })
                    });
                    eventId = existing.id;
                    updated += 1;
                }
            }
            else {
                let linkedEvent = null;
                if (matchedPatientId) {
                    linkedEvent = await prisma.internalCalendarEvent.findFirst({
                        where: {
                            doctorId,
                            patientId: matchedPatientId,
                            fechaHoraInicio: {
                                gte: new Date(startDate.getTime() - 30 * 60000),
                                lte: new Date(startDate.getTime() + 30 * 60000)
                            },
                            OR: [
                                { externalEventId: null },
                                { externalProvider: null },
                                { origenEvento: 'interno' }
                            ]
                        },
                        orderBy: { fechaHoraInicio: 'desc' }
                    });
                }
                if (linkedEvent) {
                    await prisma.internalCalendarEvent.update({
                        where: { id: linkedEvent.id },
                        data: Object.assign(Object.assign({}, payload), { patientId: matchedPatientId || linkedEvent.patientId })
                    });
                    eventId = linkedEvent.id;
                    updated += 1;
                }
                else {
                    const newEvent = await prisma.internalCalendarEvent.create({
                        data: Object.assign({ doctorId }, payload)
                    });
                    eventId = newEvent.id;
                    created += 1;
                }
            }
            // CRÍTICO: Verificar si algún attendee (paciente) aceptó o rechazó la invitación
            // y actualizar el confirmationStatus del appointment relacionado.
            // Resolvemos la cita de forma DETERMINISTA vía el vínculo duro del evento interno
            // (InternalCalendarEvent.appointmentId) para no confirmar una cita hermana por error.
            if (item.attendees && Array.isArray(item.attendees)) {
                const linkedInternalEvent = await prisma.internalCalendarEvent.findUnique({
                    where: { id: eventId },
                    select: { appointmentId: true }
                });
                for (const attendee of item.attendees) {
                    // Verificar si el attendee aceptó o rechazó la invitación
                    if ((attendee.responseStatus === 'accepted' || attendee.responseStatus === 'declined') && attendee.email) {
                        try {
                            let appointment = null;
                            // 1) Vínculo duro: el evento externo ↔ evento interno ↔ cita
                            if (linkedInternalEvent === null || linkedInternalEvent === void 0 ? void 0 : linkedInternalEvent.appointmentId) {
                                appointment = await prisma.appointment.findUnique({
                                    where: { id: linkedInternalEvent.appointmentId },
                                    select: { id: true }
                                });
                            }
                            // 2) Fallback heredado (solo si no hay vínculo duro): por email + ventana de tiempo
                            if (!appointment) {
                                const patient = await prisma.patient.findFirst({
                                    where: {
                                        OR: [
                                            { email: attendee.email },
                                            {
                                                user: {
                                                    email: attendee.email
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
                                    const searchStart = new Date(startDate);
                                    searchStart.setMinutes(searchStart.getMinutes() - 30);
                                    const searchEnd = new Date(startDate);
                                    searchEnd.setMinutes(searchEnd.getMinutes() + 30);
                                    appointment = await prisma.appointment.findFirst({
                                        where: {
                                            patientId: patient.id,
                                            doctorId: doctorId,
                                            date: {
                                                gte: searchStart,
                                                lte: searchEnd
                                            }
                                        },
                                        select: { id: true }
                                    });
                                }
                            }
                            {
                                if (appointment) {
                                    if (attendee.responseStatus === 'accepted') {
                                        // Actualizar el appointment a CONFIRMED - SIEMPRE, incluso si estaba CANCELLED
                                        // Esto permite que citas reagendadas se actualicen correctamente
                                        await prisma.appointment.update({
                                            where: { id: appointment.id },
                                            data: {
                                                confirmationStatus: 'CONFIRMED',
                                                confirmedAt: new Date()
                                            }
                                        });
                                        console.log(`✅ Appointment ${appointment.id} actualizado a CONFIRMED - paciente aceptó en Google Calendar`);
                                    }
                                    else if (attendee.responseStatus === 'declined') {
                                        // Actualizar el appointment a CANCELLED si el paciente rechazó
                                        await prisma.appointment.update({
                                            where: { id: appointment.id },
                                            data: {
                                                confirmationStatus: 'CANCELLED',
                                                cancelledAt: new Date()
                                            }
                                        });
                                        console.log(`❌ Appointment ${appointment.id} actualizado a CANCELLED - paciente rechazó en Google Calendar`);
                                    }
                                }
                            }
                        }
                        catch (error) {
                            console.error('Error verificando attendee response:', error);
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
            where: { id: syncConfig.id },
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
    }
}
exports.CalendarSyncController = CalendarSyncController;
