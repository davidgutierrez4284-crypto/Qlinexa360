import { PrismaClient, CalendarSyncConfig } from '@prisma/client';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import { OAuthService } from './oauth.service';
import { notifyCalendarReconnectNeeded } from '../utils/calendarAuth.utils';
import { getOAuthConfig } from '../config/oauth.config';
import { formatDateTimeForExternalCalendar } from '../utils/date.utils';
import {
  ExternalCalendarEventComparable,
  externalCalendarEventNeedsUpdate,
} from '../utils/calendarSync.utils';

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
  /** Si true, quita Google Meet de un evento externo existente (p. ej. cita presencial). */
  disableConference?: boolean;
  attendeesResponseStatus?: 'accepted' | 'declined';
  sendUpdates?: 'all' | 'externalOnly' | 'none';
  timezone?: string | null;
}

interface SyncResult {
  externalEventId: string;
  externalUpdatedAt: Date;
  conferenceLink?: string | null;
}

export class GoogleCalendarNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleCalendarNotReadyError';
  }
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
    const tokenExpired =
      !!config.expiresAt && config.expiresAt.getTime() <= Date.now() + 60 * 1000;

    if (tokenExpired && config.refreshToken) {
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
        const reason =
          'Conexión con Google Calendar expirada. Vuelve a enlazar tu calendario en Configuración → Calendario.';
        await notifyCalendarReconnectNeeded({
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
    } else if (tokenExpired && !config.refreshToken) {
      const reason =
        'Google Calendar requiere volver a autorizarse (sin refresh token). Enlázalo de nuevo en Configuración → Calendario.';
      await prisma.calendarSyncConfig.update({
        where: { id: config.id },
        data: { error: reason }
      });
      throw new GoogleCalendarNotReadyError(reason);
    }

    authClient.setCredentials({
      access_token: config.accessToken ?? undefined,
      refresh_token: config.refreshToken ?? undefined
    });

    return config;
  }

  private static buildEventBody(
    payload: GoogleEventPayload,
    timezone: string
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
        dateTime: formatDateTimeForExternalCalendar(payload.start, timezone),
        timeZone: timezone
      },
      end: {
        dateTime: formatDateTimeForExternalCalendar(payload.end, timezone),
        timeZone: timezone
      },
      // La liga de videollamada vive en conferenceData (Google Meet nativo), nunca en "location".
      // Forzamos limpiar "location" para que el invitado (p. ej. en Outlook) no vea dos ligas:
      // la de conferenceData y una vieja que hubiera quedado en location tras una reprogramación.
      location: /meet\.google\.com|teams\.microsoft\.com|zoom\.us/i.test(payload.location ?? '')
        ? ''
        : (payload.location ?? '')
    };

    if (payload.attendees && payload.attendees.length > 0) {
      event.attendees = payload.attendees.map(email => ({
        email,
        responseStatus: payload.attendeesResponseStatus
      }));
    }

    return event;
  }

  private static eventDateTimeToMs(
    dt: calendar_v3.Schema$EventDateTime | null | undefined
  ): number | null {
    if (!dt) return null;
    if (dt.dateTime) return new Date(dt.dateTime).getTime();
    if (dt.date) return new Date(dt.date).getTime();
    return null;
  }

  private static eventHasVideoConference(event: calendar_v3.Schema$Event): boolean {
    if (event.hangoutLink) return true;
    return (
      event.conferenceData?.entryPoints?.some(entry => entry.entryPointType === 'video') ?? false
    );
  }

  private static extractAttendeeResponseStatus(
    event: calendar_v3.Schema$Event,
    attendeeEmails: string[]
  ): 'accepted' | 'declined' | undefined {
    if (!event.attendees?.length || !attendeeEmails.length) return undefined;
    const targets = new Set(attendeeEmails.map(email => email.toLowerCase().trim()));
    const match = event.attendees.find(
      attendee =>
        attendee.email && targets.has(attendee.email.toLowerCase().trim())
    );
    if (match?.responseStatus === 'accepted') return 'accepted';
    if (match?.responseStatus === 'declined') return 'declined';
    return undefined;
  }

  private static toComparableFromGoogleEvent(
    event: calendar_v3.Schema$Event,
    attendeeEmails: string[]
  ): ExternalCalendarEventComparable {
    return {
      summary: event.summary,
      description: event.description,
      startMs: GoogleCalendarSyncService.eventDateTimeToMs(event.start),
      endMs: GoogleCalendarSyncService.eventDateTimeToMs(event.end),
      attendeeEmails,
      attendeeResponseStatus: GoogleCalendarSyncService.extractAttendeeResponseStatus(
        event,
        attendeeEmails
      ),
      hasVideoConference: GoogleCalendarSyncService.eventHasVideoConference(event),
      location: event.location,
    };
  }

  private static toComparableFromRequestBody(
    requestBody: calendar_v3.Schema$Event,
    payload: GoogleEventPayload,
    options: { shouldCreateConference: boolean; shouldStripConference: boolean }
  ): ExternalCalendarEventComparable {
    const hasVideoConference =
      !options.shouldStripConference &&
      (options.shouldCreateConference ||
        !!payload.conferenceLink?.includes('meet.google.com') ||
        GoogleCalendarSyncService.eventHasVideoConference(requestBody));

    return {
      summary: requestBody.summary,
      description: requestBody.description,
      startMs: GoogleCalendarSyncService.eventDateTimeToMs(requestBody.start),
      endMs: GoogleCalendarSyncService.eventDateTimeToMs(requestBody.end),
      attendeeEmails: payload.attendees ?? [],
      attendeeResponseStatus: payload.attendeesResponseStatus,
      hasVideoConference,
      location: typeof requestBody.location === 'string' ? requestBody.location : null,
    };
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
      const msg =
        'Google OAuth no está configurado en el servidor (faltan GOOGLE_CLIENT_ID/SECRET).';
      await prisma.calendarSyncConfig.updateMany({
        where: { doctorId, provider: 'google', isConnected: true },
        data: { error: msg }
      });
      throw new GoogleCalendarNotReadyError(msg);
    }

    const { calendar, authClient } = client;

    const config = await GoogleCalendarSyncService.getDoctorConfig(doctorId);
    if (!config) {
      const msg =
        'Google Calendar aparece conectado pero no hay token de acceso válido. Vuelve a enlazarlo en Configuración → Calendario.';
      await prisma.calendarSyncConfig.updateMany({
        where: { doctorId, provider: 'google' },
        data: { error: msg }
      });
      throw new GoogleCalendarNotReadyError(msg);
    }

    let workingConfig = await GoogleCalendarSyncService.ensureValidCredentials(
      authClient,
      config
    );

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { timezone: true }
    });
    const eventTimezone =
      payload.timezone ||
      doctor?.timezone ||
      process.env.PRACTICE_TIMEZONE ||
      GoogleCalendarSyncService.TIMEZONE;

    const requestBody = GoogleCalendarSyncService.buildEventBody(payload, eventTimezone);
    const wantsConference = payload.conferenceType === 'google-meet';
    const existingConferenceLink = payload.conferenceLink ?? null;
    const hasExistingGoogleMeet =
      !!existingConferenceLink && existingConferenceLink.includes('meet.google.com');
    const shouldCreateConference =
      (wantsConference || payload.googleMeetEnabled) && !hasExistingGoogleMeet;
    const shouldStripConference = payload.disableConference === true;

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
      const hasAttendees = (payload.attendees?.length ?? 0) > 0;
      const resolvedSendUpdatesOnInsert = payload.sendUpdates ?? (hasAttendees ? 'all' : 'none');
      const resolvedSendUpdatesOnUpdate = payload.sendUpdates ?? 'none';

      console.log('🔧 GoogleCalendarSyncService.upsertEvent:');
      console.log('   Event ID:', payload.id);
      console.log('   External Event ID:', payload.externalEventId || 'NUEVO');
      console.log('   Attendees:', payload.attendees?.join(', ') || 'NINGUNO');
      console.log('   Request Body attendees:', requestBody.attendees?.map(a => a.email).join(', ') || 'NINGUNO');
      console.log(
        '   sendUpdates (update/create):',
        payload.externalEventId ? resolvedSendUpdatesOnUpdate : resolvedSendUpdatesOnInsert
      );

      const { result } = await GoogleCalendarSyncService.executeWithRetry(
        calendar,
        authClient,
        workingConfig,
        async cal => {
          if (payload.externalEventId) {
            try {
              console.log('   📝 Actualizando evento existente en Google Calendar...');

              if (shouldStripConference) {
                const existing = await cal.events.get({
                  calendarId: GoogleCalendarSyncService.CALENDAR_ID,
                  eventId: payload.externalEventId
                });
                const merged: calendar_v3.Schema$Event = {
                  ...existing.data,
                  ...requestBody,
                  conferenceData: undefined,
                  hangoutLink: undefined
                };
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
                  console.log(
                    '   📧 Google enviará actualización de invitación a:',
                    merged.attendees?.map(a => a.email).join(', ') || 'NINGUNO'
                  );
                } else {
                  console.log('   📧 sendUpdates=none — no se reenvían invitaciones por correo');
                }
                return result;
              }

              const existing = await cal.events.get({
                calendarId: GoogleCalendarSyncService.CALENDAR_ID,
                eventId: payload.externalEventId
              });
              const mergedForUpdate: calendar_v3.Schema$Event = {
                ...existing.data,
                ...requestBody
              };

              const desiredComparable = GoogleCalendarSyncService.toComparableFromRequestBody(
                mergedForUpdate,
                payload,
                {
                  shouldCreateConference: !!shouldCreateConference,
                  shouldStripConference: !!shouldStripConference,
                }
              );
              const existingComparable = GoogleCalendarSyncService.toComparableFromGoogleEvent(
                existing.data,
                payload.attendees ?? []
              );

              if (
                !externalCalendarEventNeedsUpdate(existingComparable, desiredComparable) &&
                !shouldCreateConference &&
                !shouldStripConference
              ) {
                console.log('   ⏭️ Sin cambios significativos — omitiendo update en Google Calendar');
                return { data: existing.data };
              }

              const sendUpdates = resolvedSendUpdatesOnUpdate;
              const updateParams: calendar_v3.Params$Resource$Events$Update = {
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
                console.log(
                  '   📧 Google enviará actualización de invitación a:',
                  requestBody.attendees?.map(a => a.email).join(', ') || 'NINGUNO'
                );
              } else {
                console.log('   📧 sendUpdates=none — no se reenvían invitaciones por correo');
              }
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
            // Primera creación: enviar invitación al paciente
            sendUpdates: resolvedSendUpdatesOnInsert
          };

          if (shouldCreateConference) {
            insertParams.conferenceDataVersion = 1;
          }

          const result = await cal.events.insert(insertParams);
          console.log('   ✅ Evento creado en Google Calendar con ID:', result.data.id);
          if (resolvedSendUpdatesOnInsert === 'all') {
            console.log(
              '   📧 Google enviará invitación a:',
              requestBody.attendees?.map(a => a.email).join(', ') || 'NINGUNO'
            );
          } else {
            console.log('   📧 sendUpdates=none — no se envían invitaciones por correo');
          }
          return result;
        }
      );

      const updatedEvent = result.data;
      if (!updatedEvent?.id) {
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
          updatedEvent.conferenceData?.entryPoints?.find(entry => entry.entryPointType === 'video')
            ?.uri ||
          updatedEvent.conferenceData?.entryPoints?.[0]?.uri ||
          null
        : null;

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

