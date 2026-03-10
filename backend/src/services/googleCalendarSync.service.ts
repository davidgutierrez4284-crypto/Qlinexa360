import { PrismaClient, CalendarSyncConfig } from '@prisma/client';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import { OAuthService } from './oauth.service';
import { notifyCalendarReconnectNeeded } from '../utils/calendarAuth.utils';
import { getOAuthConfig } from '../config/oauth.config';

const prisma = new PrismaClient();

interface GoogleEventPayload {
  id: string;
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  attendees?: string[];
  location?: string | null;
  externalEventId?: string | null;
  conferenceType?: 'google-meet' | null;
  conferenceLink?: string | null;
  googleMeetEnabled?: boolean;
  attendeesResponseStatus?: 'accepted' | 'declined';
}

interface SyncResult {
  externalEventId: string;
  externalUpdatedAt: Date;
  conferenceLink?: string | null;
}

export class GoogleCalendarSyncService {
  private static readonly CALENDAR_ID = 'primary';
  private static readonly TIMEZONE =
    process.env.GOOGLE_CALENDAR_TIMEZONE || 'UTC';

  private static createClient():
    | { calendar: calendar_v3.Calendar; authClient: OAuth2Client }
    | null {
    const config = getOAuthConfig('google');
    if (!config) {
      return null;
    }

    const authClient = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    const calendar = google.calendar({ version: 'v3', auth: authClient });

    return { calendar, authClient };
  }

  private static async getDoctorConfig(
    doctorId: string
  ): Promise<CalendarSyncConfig | null> {
    return prisma.calendarSyncConfig.findFirst({
      where: {
        doctorId,
        provider: 'google',
        isConnected: true,
        accessToken: { not: null }
      }
    });
  }

  private static async ensureValidCredentials(
    authClient: OAuth2Client,
    config: CalendarSyncConfig
  ): Promise<CalendarSyncConfig> {
    if (
      config.expiresAt &&
      config.expiresAt.getTime() <= Date.now() + 60 * 1000 &&
      config.refreshToken
    ) {
      const refreshed = await OAuthService.refreshAccessToken(
        'google',
        config.refreshToken
      );

      if (refreshed?.access_token) {
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
      } else {
        await notifyCalendarReconnectNeeded({
          doctorId: config.doctorId,
          provider: 'google',
          reason: 'Conexión expirada. Vuelve a conectar Google Calendar.'
        });
      }
    }

    authClient.setCredentials({
      access_token: config.accessToken ?? undefined,
      refresh_token: config.refreshToken ?? undefined
    });

    return config;
  }

  private static buildEventBody(
    payload: GoogleEventPayload
  ): calendar_v3.Schema$Event {
    // Si hay attendees (pacientes), agregar emoji de Qlinexa360 y "consulta" al título para que se destaque en el calendario del paciente
    // Primero limpiar TODOS los emojis 🏥 y la palabra "consulta" que puedan existir
    let cleanTitle = payload.title.replace(/🏥\s*/g, '').trim();
    cleanTitle = cleanTitle.replace(/\s+consulta$/i, '').trim();
    
    const titleForExternal = payload.attendees && payload.attendees.length > 0
      ? `🏥 ${cleanTitle} consulta`
      : cleanTitle;
    
    const event: calendar_v3.Schema$Event = {
      summary: titleForExternal,
      description: payload.description ?? undefined,
      start: {
        dateTime: payload.start.toISOString(),
        timeZone: GoogleCalendarSyncService.TIMEZONE
      },
      end: {
        dateTime: payload.end.toISOString(),
        timeZone: GoogleCalendarSyncService.TIMEZONE
      },
      location: payload.location ?? undefined
    };

    if (payload.attendees && payload.attendees.length > 0) {
      event.attendees = payload.attendees.map(email => ({
        email,
        responseStatus: payload.attendeesResponseStatus
      }));
    }

    return event;
  }

  private static async executeWithRetry<T>(
    calendar: calendar_v3.Calendar,
    authClient: OAuth2Client,
    config: CalendarSyncConfig,
    fn: (calendar: calendar_v3.Calendar) => Promise<T>
  ): Promise<{ result: T; updatedConfig: CalendarSyncConfig }> {
    try {
      const result = await fn(calendar);
      return { result, updatedConfig: config };
    } catch (error: any) {
      const status = error?.code || error?.response?.status;

      if ((status === 401 || status === 403) && config.refreshToken) {
        const refreshed = await OAuthService.refreshAccessToken(
          'google',
          config.refreshToken
        );

        if (!refreshed?.access_token) {
          await notifyCalendarReconnectNeeded({
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
          access_token: updatedConfig.accessToken ?? undefined,
          refresh_token: updatedConfig.refreshToken ?? undefined
        });

        const result = await fn(calendar);
        return { result, updatedConfig };
      }

      throw error;
    }
  }

  static async upsertEvent(
    doctorId: string,
    payload: GoogleEventPayload
  ): Promise<SyncResult | null> {
    const client = GoogleCalendarSyncService.createClient();
    if (!client) {
      return null;
    }

    const { calendar, authClient } = client;

    const config = await GoogleCalendarSyncService.getDoctorConfig(doctorId);
    if (!config) {
      return null;
    }

    let workingConfig = await GoogleCalendarSyncService.ensureValidCredentials(
      authClient,
      config
    );

    const requestBody = GoogleCalendarSyncService.buildEventBody(payload);
    const wantsConference = payload.conferenceType === 'google-meet';
    const existingConferenceLink = payload.conferenceLink ?? null;
    const hasExistingGoogleMeet =
      !!existingConferenceLink && existingConferenceLink.includes('meet.google.com');
    const shouldCreateConference =
      (wantsConference || payload.googleMeetEnabled) && !hasExistingGoogleMeet;

    if (shouldCreateConference) {
      requestBody.conferenceData = {
        createRequest: {
          requestId: randomUUID(),
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
      console.log('   Attendees:', payload.attendees?.join(', ') || 'NINGUNO');
      console.log('   Request Body attendees:', requestBody.attendees?.map(a => a.email).join(', ') || 'NINGUNO');
      
      const { result } = await GoogleCalendarSyncService.executeWithRetry(
        calendar,
        authClient,
        workingConfig,
        async cal => {
          if (payload.externalEventId) {
            try {
              console.log('   📝 Actualizando evento existente en Google Calendar...');
              const updateParams: calendar_v3.Params$Resource$Events$Patch = {
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
              console.log('   📧 Invitaciones enviadas a:', requestBody.attendees?.map(a => a.email).join(', ') || 'NINGUNO');
              return result;
            } catch (error: any) {
              const status = error?.code || error?.response?.status;
              if (status !== 404) {
                throw error;
              }
            }
          }

          console.log('   📝 Creando nuevo evento en Google Calendar...');
          const insertParams: calendar_v3.Params$Resource$Events$Insert = {
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
          console.log('   📧 Invitaciones enviadas a:', requestBody.attendees?.map(a => a.email).join(', ') || 'NINGUNO');
          return result;
        }
      );

      const updatedEvent = result.data;
      if (!updatedEvent?.id) {
        return null;
      }

      await prisma.calendarSyncConfig.update({
        where: { id: workingConfig.id },
        data: {
          lastSync: new Date(),
          error: null
        }
      });

      const conferenceLink =
        updatedEvent.hangoutLink ||
        updatedEvent.conferenceData?.entryPoints?.find(entry => entry.entryPointType === 'video')
          ?.uri ||
        updatedEvent.conferenceData?.entryPoints?.[0]?.uri ||
        null;

      return {
        externalEventId: updatedEvent.id,
        externalUpdatedAt: updatedEvent.updated
          ? new Date(updatedEvent.updated)
          : new Date(),
        conferenceLink
      };
    } catch (error: any) {
      await prisma.calendarSyncConfig.update({
        where: { id: workingConfig.id },
        data: {
          error:
            error?.message ||
            'Error desconocido al sincronizar evento con Google Calendar'
        }
      });

      throw error;
    }
  }

  static async deleteEvent(
    doctorId: string,
    externalEventId: string
  ): Promise<void> {
    const client = GoogleCalendarSyncService.createClient();
    if (!client) {
      return;
    }

    const { calendar, authClient } = client;

    const config = await GoogleCalendarSyncService.getDoctorConfig(doctorId);
    if (!config) {
      return;
    }

    const workingConfig = await GoogleCalendarSyncService.ensureValidCredentials(
      authClient,
      config
    );

    try {
      await GoogleCalendarSyncService.executeWithRetry(
        calendar,
        authClient,
        workingConfig,
        cal =>
          cal.events.delete({
            calendarId: GoogleCalendarSyncService.CALENDAR_ID,
            eventId: externalEventId
          })
      );

      await prisma.calendarSyncConfig.update({
        where: { id: workingConfig.id },
        data: {
          lastSync: new Date(),
          error: null
        }
      });
    } catch (error: any) {
      const status = error?.code || error?.response?.status;
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
          error:
            error?.message ||
            'Error desconocido al eliminar evento en Google Calendar'
        }
      });

      throw error;
    }
  }

  // Obtener un evento específico de Google Calendar por su ID
  static async getEvent(
    doctorId: string,
    externalEventId: string
  ): Promise<calendar_v3.Schema$Event | null> {
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
    } catch (error: any) {
      const status = error?.code || error?.response?.status;
      if ((status === 401 || status === 403) && syncConfig.refreshToken) {
        const refreshed = await OAuthService.refreshAccessToken('google', syncConfig.refreshToken);
        if (refreshed?.access_token) {
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
        } else {
          await notifyCalendarReconnectNeeded({
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

