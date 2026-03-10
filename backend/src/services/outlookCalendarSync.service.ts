import axios, { AxiosError } from 'axios';
import { PrismaClient, CalendarSyncConfig } from '@prisma/client';
import { OAuthService } from './oauth.service';
import { notifyCalendarReconnectNeeded } from '../utils/calendarAuth.utils';

const prisma = new PrismaClient();

interface OutlookEventPayload {
  id: string;
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  attendees?: string[];
  location?: string | null;
  externalEventId?: string | null;
  teamsEnabled?: boolean;
  conferenceType?: 'teams' | null;
  conferenceLink?: string | null;
}

interface SyncResult {
  externalEventId: string;
  externalUpdatedAt: Date;
  conferenceLink?: string | null;
}

export class OutlookCalendarSyncService {
  private static readonly GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
  private static readonly TIMEZONE =
    process.env.CALENDAR_DEFAULT_TIMEZONE || 'America/Mexico_City';

  private static async getDoctorConfig(
    doctorId: string
  ): Promise<CalendarSyncConfig | null> {
    return prisma.calendarSyncConfig.findFirst({
      where: {
        doctorId,
        provider: 'outlook',
        isConnected: true,
        accessToken: { not: null }
      }
    });
  }

  private static needsRefresh(config: CalendarSyncConfig): boolean {
    if (!config.expiresAt) return false;
    return config.expiresAt.getTime() <= Date.now() + 60 * 1000;
  }

  private static async ensureValidCredentials(
    config: CalendarSyncConfig
  ): Promise<{ accessToken: string; config: CalendarSyncConfig }> {
    if (this.needsRefresh(config) && config.refreshToken) {
      const refreshed = await OAuthService.refreshAccessToken(
        'outlook',
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

        return {
          accessToken: refreshed.access_token,
          config: updated
        };
      } else {
        await notifyCalendarReconnectNeeded({
          doctorId: config.doctorId,
          provider: 'outlook',
          reason: 'Conexión expirada. Vuelve a conectar Outlook.'
        });
      }
    }

    return {
      accessToken: config.accessToken ?? '',
      config
    };
  }

  private static async executeWithRetry<T>(
    doctorId: string,
    initialConfig: CalendarSyncConfig | null,
    executor: (
      accessToken: string,
      activeConfig: CalendarSyncConfig
    ) => Promise<T>
  ): Promise<T | null> {
    let config = initialConfig;

    if (!config) {
      config = await OutlookCalendarSyncService.getDoctorConfig(doctorId);
    }

    if (!config || !config.accessToken) {
      return null;
    }

    try {
      const { accessToken, config: activeConfig } =
        await OutlookCalendarSyncService.ensureValidCredentials(config);
      return await executor(accessToken, activeConfig);
    } catch (error) {
      const status =
        (error as AxiosError)?.response?.status ||
        (error as AxiosError)?.status ||
        (error as any)?.code;

      if ((status === 401 || status === 403) && config.refreshToken) {
        const refreshed = await OAuthService.refreshAccessToken(
          'outlook',
          config.refreshToken
        );

        if (!refreshed?.access_token) {
          await notifyCalendarReconnectNeeded({
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

  private static buildEventBody(payload: OutlookEventPayload) {
    const wantsTeams = payload.teamsEnabled || payload.conferenceType === 'teams';
    
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
        displayName: payload.location || ''
      },
      start: {
        dateTime: payload.start.toISOString(),
        timeZone: OutlookCalendarSyncService.TIMEZONE
      },
      end: {
        dateTime: payload.end.toISOString(),
        timeZone: OutlookCalendarSyncService.TIMEZONE
      },
      attendees: payload.attendees?.map(email => ({
        emailAddress: { address: email },
        type: 'required'
      })) || [],
      isOnlineMeeting: wantsTeams,
      onlineMeetingProvider: wantsTeams ? 'teamsForBusiness' : undefined
    };
  }

  static async upsertEvent(
    doctorId: string,
    payload: OutlookEventPayload
  ): Promise<SyncResult | null> {
    return OutlookCalendarSyncService.executeWithRetry(
      doctorId,
      null,
      async (accessToken, activeConfig) => {
        const eventBody = OutlookCalendarSyncService.buildEventBody(payload);

        const headers = {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        };

        const urlBase = `${OutlookCalendarSyncService.GRAPH_BASE}/me/events`;

        let response;

        if (payload.externalEventId) {
          response = await axios.patch(
            `${urlBase}/${payload.externalEventId}`,
            eventBody,
            { headers }
          );
        } else {
          response = await axios.post(urlBase, eventBody, { headers });
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
          conferenceLink: data.onlineMeeting?.joinUrl || null
        };
      }
    );
  }

  // Obtener un evento específico de Outlook Calendar por su ID
  static async getEvent(
    doctorId: string,
    externalEventId: string
  ): Promise<any | null> {
    return OutlookCalendarSyncService.executeWithRetry(
      doctorId,
      null,
      async (accessToken, activeConfig) => {
        const headers = {
          Authorization: `Bearer ${accessToken}`
        };

        try {
          const response = await axios.get(
            `${OutlookCalendarSyncService.GRAPH_BASE}/me/events/${externalEventId}`,
            { headers }
          );

          return response.data;
        } catch (error) {
          const status =
            (error as AxiosError)?.response?.status ||
            (error as AxiosError)?.status;
          if (status === 404) {
            return null;
          }
          console.error('Error obteniendo evento de Outlook Calendar:', error);
          return null;
        }
      }
    );
  }

  static async deleteEvent(
    doctorId: string,
    externalEventId: string
  ): Promise<void> {
    await OutlookCalendarSyncService.executeWithRetry(
      doctorId,
      null,
      async (accessToken, activeConfig) => {
        const headers = {
          Authorization: `Bearer ${accessToken}`
        };

        try {
          await axios.delete(
            `${OutlookCalendarSyncService.GRAPH_BASE}/me/events/${externalEventId}`,
            { headers }
          );

          await prisma.calendarSyncConfig.update({
            where: { id: activeConfig.id },
            data: {
              lastSync: new Date(),
              error: null
            }
          });
        } catch (error) {
          const status =
            (error as AxiosError)?.response?.status ||
            (error as AxiosError)?.status;
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
      }
    );
  }

  static async syncCalendar(
    doctorId: string,
    config: CalendarSyncConfig
  ): Promise<{ created: number; updated: number; removed: number }> {
    const syncResult = await OutlookCalendarSyncService.executeWithRetry(
      doctorId,
      config,
      async (accessToken, activeConfig) => {
        const headers = {
          Authorization: `Bearer ${accessToken}`
        };

        const now = new Date();
        const timeMin = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

        const filter = `start/dateTime ge '${timeMin.toISOString()}' and end/dateTime le '${timeMax.toISOString()}'`;

        const response = await axios.get(
          `${OutlookCalendarSyncService.GRAPH_BASE}/me/events`,
          {
            headers,
            params: {
              $select:
                'id,subject,body,start,end,location,lastModifiedDateTime,isOnlineMeeting,onlineMeeting,attendees',
              $orderby: 'start/dateTime',
              $top: 1000,
              $filter: filter
            }
          }
        );

        const items: any[] = response.data?.value || [];

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

        const existingMap = new Map<string, typeof existingEvents[number]>();
        existingEvents.forEach(event => {
          if (event.externalEventId) {
            existingMap.set(event.externalEventId, event);
          }
        });

        const seen = new Set<string>();
        let created = 0;
        let updated = 0;

        const normalizeDate = (dateTime?: string): Date | null => {
          if (!dateTime) return null;
          const hasOffset =
            dateTime.endsWith('Z') || /[+-]\d\d:\d\d$/.test(dateTime);
          const iso = hasOffset ? dateTime : `${dateTime}Z`;
          return new Date(iso);
        };

        for (const item of items) {
          if (!item?.id) continue;

          const startDate = normalizeDate(item.start?.dateTime);
          const endDate = normalizeDate(item.end?.dateTime);

          if (!startDate || !endDate) continue;

          seen.add(item.id);

          const payload = {
            titulo: item.subject || 'Sin título',
            descripcion: item.body?.content || null,
            fechaHoraInicio: startDate,
            fechaHoraFin: endDate,
            origenEvento: 'outlook',
            linkMeeting: item.onlineMeeting?.joinUrl || null,
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
          } else {
            await prisma.internalCalendarEvent.create({
              data: {
                doctorId,
                ...payload
              }
            });
            created += 1;
          }

          // CRÍTICO: Verificar si algún attendee (paciente) aceptó o rechazó la invitación
          // y actualizar el confirmationStatus del appointment relacionado
          if (item.attendees && Array.isArray(item.attendees)) {
            for (const attendee of item.attendees) {
              const attendeeEmail = attendee.emailAddress?.address;
              const attendeeStatus = attendee.status?.toLowerCase();
              
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
                      } else if (attendeeStatus === 'declined') {
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
                } catch (error) {
                  console.error('Error verificando attendee response en Outlook:', error);
                  // Continuar con el siguiente attendee aunque haya error
                }
              }
            }
          }
        }

        const toRemove = existingEvents.filter(
          event => event.externalEventId && !seen.has(event.externalEventId)
        );

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
      }
    );

    return (
      syncResult || {
        created: 0,
        updated: 0,
        removed: 0
      }
    );
  }
}
