import { google } from 'googleapis';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import CryptoJS from 'crypto-js';

const prisma = new PrismaClient();

// Configuración de encriptación
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-key-32-chars-long';

// Función para encriptar tokens
const encryptToken = (token: string): string => {
  return CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();
};

// Función para desencriptar tokens
const decryptToken = (encryptedToken: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Servicio de Google Calendar
class GoogleCalendarService {
  private oauth2Client: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  // Generar URL de autorización
  generateAuthUrl(): string {
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
  async getTokensFromCode(code: string): Promise<any> {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  // Obtener eventos de Google Calendar
  async getEvents(accessToken: string, calendarId: string = 'primary', timeMin?: Date, timeMax?: Date): Promise<any[]> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin?.toISOString(),
      timeMax: timeMax?.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    return response.data.items || [];
  }

  // Refrescar token
  async refreshToken(refreshToken: string): Promise<any> {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    return credentials;
  }
}

// Servicio de Microsoft Outlook
class OutlookCalendarService {
  private msalConfig: any;

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
  async generateAuthUrl(): Promise<string> {
    if (!this.msalConfig) {
      throw new Error('Microsoft Calendar: Credenciales no configuradas');
    }

    const msalInstance = new ConfidentialClientApplication(this.msalConfig);
    
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
  async getTokensFromCode(code: string): Promise<any> {
    if (!this.msalConfig) {
      throw new Error('Microsoft Calendar: Credenciales no configuradas');
    }

    const msalInstance = new ConfidentialClientApplication(this.msalConfig);
    
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
  async getEvents(accessToken: string, calendarId: string = 'default', timeMin?: Date, timeMax?: Date): Promise<any[]> {
    const baseUrl = 'https://graph.microsoft.com/v1.0';
    const endpoint = calendarId === 'default' 
      ? `${baseUrl}/me/calendarView`
      : `${baseUrl}/me/calendars/${calendarId}/calendarView`;

    const params = new URLSearchParams();
    if (timeMin) params.append('startDateTime', timeMin.toISOString());
    if (timeMax) params.append('endDateTime', timeMax.toISOString());

    const response = await fetch(`${endpoint}?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json() as any;
    return data.value || [];
  }
}

// Servicio principal de sincronización
class CalendarSyncService {
  private googleService: GoogleCalendarService;
  private outlookService: OutlookCalendarService;

  constructor() {
    this.googleService = new GoogleCalendarService();
    this.outlookService = new OutlookCalendarService();
  }

  // Iniciar sincronización automática (cada hora)
  startAutoSync(): void {
    cron.schedule('0 * * * *', () => {
      console.log('Iniciando sincronización automática de calendarios...');
      this.syncAllCalendars();
    });
  }

  // Sincronizar todos los calendarios vinculados
  async syncAllCalendars(): Promise<void> {
    try {
      const activeLinks = await prisma.externalCalendarLink.findMany({
        where: { activo: true }
      });

      for (const link of activeLinks) {
        await this.syncCalendar(link);
      }
    } catch (error: any) {
      console.error('Error en sincronización automática:', error);
    }
  }

  // Sincronizar un calendario específico
  async syncCalendar(link: any): Promise<void> {
    try {
      const decryptedAccessToken = decryptToken(link.accessToken);
      const timeMin = new Date();
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 30); // Sincronizar próximos 30 días

      let events: any[] = [];

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
    } catch (error: any) {
      console.error(`Error sincronizando calendario ${link.tipoConexion}:`, error);
      
      // Si el token expiró, intentar refrescar
      if (error.message?.includes('token') || error.message?.includes('unauthorized')) {
        await this.refreshToken(link);
      }
    }
  }

  // Procesar eventos externos y evitar duplicados
  async processExternalEvents(events: any[], link: any): Promise<void> {
    for (const event of events) {
      // Crear un hash único para evitar duplicados
      const eventHash = this.createEventHash(event, link);
      
      // Verificar si ya existe
      const existingEvent = await prisma.internalCalendarEvent.findFirst({
        where: {
          doctorId: link.doctorId,
          origenEvento: link.tipoConexion,
          titulo: event.summary || event.subject || 'Sin título',
          fechaHoraInicio: new Date(event.start?.dateTime || event.start?.date),
          fechaHoraFin: new Date(event.end?.dateTime || event.end?.date)
        }
      });

      if (!existingEvent) {
        // Insertar evento como "sombra" (solo lectura)
        await prisma.internalCalendarEvent.create({
          data: {
            doctorId: link.doctorId,
            titulo: event.summary || event.subject || 'Sin título',
            descripcion: event.description || event.body?.content || '',
            fechaHoraInicio: new Date(event.start?.dateTime || event.start?.date),
            fechaHoraFin: new Date(event.end?.dateTime || event.end?.date),
            origenEvento: link.tipoConexion,
            linkMeeting: event.hangoutLink || event.onlineMeeting?.joinUrl || '',
            creadoPor: link.doctorId
          }
        });
      }
    }
  }

  // Crear hash único para evento
  createEventHash(event: any, link: any): string {
    const eventData = {
      doctorId: link.doctorId,
      origenEvento: link.tipoConexion,
      titulo: event.summary || event.subject,
      fechaInicio: event.start?.dateTime || event.start?.date,
      fechaFin: event.end?.dateTime || event.end?.date
    };
    
    return CryptoJS.SHA256(JSON.stringify(eventData)).toString();
  }

  // Refrescar token expirado
  async refreshToken(link: any): Promise<void> {
    try {
      if (!link.refreshToken) return;

      const decryptedRefreshToken = decryptToken(link.refreshToken);
      let newTokens: any;

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
    } catch (error: any) {
      console.error('Error refrescando token:', error);
      // Desactivar el enlace si no se puede refrescar
      await prisma.externalCalendarLink.update({
        where: { id: link.id },
        data: { activo: false }
      });
    }
  }

  // Vincular calendario externo
  async linkExternalCalendar(doctorId: string, tipoConexion: string, tokens: any, calendarioId: string): Promise<any> {
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
  async unlinkExternalCalendar(linkId: string, doctorId: string): Promise<void> {
    await prisma.externalCalendarLink.deleteMany({
      where: {
        id: linkId,
        doctorId
      }
    });
  }

  // Obtener enlaces de calendario de un doctor
  async getDoctorCalendarLinks(doctorId: string): Promise<any[]> {
    return await prisma.externalCalendarLink.findMany({
      where: { doctorId },
      orderBy: { fechaVinculacion: 'desc' }
    });
  }

  // Activar/desactivar sincronización
  async toggleSync(linkId: string, doctorId: string, activo: boolean): Promise<void> {
    await prisma.externalCalendarLink.updateMany({
      where: {
        id: linkId,
        doctorId
      },
      data: { activo }
    });
  }

  // Generar URL de autorización según el tipo
  async generateAuthUrl(tipoConexion: string): Promise<string> {
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
  async getTokensFromCode(tipoConexion: string, code: string): Promise<any> {
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

export default CalendarSyncService; 