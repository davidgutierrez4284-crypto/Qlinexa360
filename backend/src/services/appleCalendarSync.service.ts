import { PrismaClient, CalendarSyncConfig } from '@prisma/client';
import { createDAVClient, DAVCalendar } from 'tsdav';
import { parseICS, VEvent } from 'node-ical';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface AppleCredentials {
  username: string;
  password: string;
  principalUrl?: string;
  calendarUrl?: string;
}

interface AppleEventPayload {
  id: string;
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  attendees?: string[];
  externalEventId?: string | null;
}

interface SyncResult {
  externalEventId: string;
  externalUpdatedAt: Date;
}

const APPLE_SERVER_URL = process.env.APPLE_CALDAV_URL || 'https://caldav.icloud.com';

export class AppleCalendarSyncService {
  private static parseCredentials(config: CalendarSyncConfig): AppleCredentials | null {
    if (!config.accessToken) {
      return null;
    }

    try {
      // Guardamos las credenciales en base64(JSON)
      const decoded = Buffer.from(config.accessToken, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);

      if (parsed?.username && parsed?.password) {
        return {
          username: parsed.username,
          password: parsed.password,
          principalUrl: parsed.principalUrl,
          calendarUrl: parsed.calendarUrl
        };
      }
    } catch (error) {
      console.warn('No se pudieron parsear credenciales de Apple Calendar:', error);
    }

    return null;
  }

  private static async ensureValidConfig(
    doctorId: string
  ): Promise<{ config: CalendarSyncConfig; credentials: AppleCredentials; calendar: DAVCalendar } | null> {
    const config = await prisma.calendarSyncConfig.findFirst({
      where: {
        doctorId,
        provider: 'apple',
        isConnected: true
      }
    });

    if (!config) {
      return null;
    }

    const credentials = AppleCalendarSyncService.parseCredentials(config);
    if (!credentials) {
      await prisma.calendarSyncConfig.update({
        where: { id: config.id },
        data: {
          error: 'Credenciales de Apple Calendar inválidas o incompletas'
        }
      });
      return null;
    }

    try {
      const client = await createDAVClient({
        serverUrl: APPLE_SERVER_URL,
        credentials: {
          username: credentials.username,
          password: credentials.password
        },
        authMethod: 'Basic',
        defaultAccountType: 'caldav'
      });

      const calendars = await client.fetchCalendars({
        props: {
          displayname: true,
          resourcetype: true
        }
      });

      if (!calendars || calendars.length === 0) {
        throw new Error('No se encontraron calendarios en la cuenta de Apple');
      }

      const calendar =
        calendars.find(cal => cal.url === credentials.calendarUrl) ?? calendars[0];

      return { config, credentials, calendar };
    } catch (error) {
      await prisma.calendarSyncConfig.update({
        where: { id: config.id },
        data: {
          error:
            error instanceof Error
              ? error.message
              : 'Error desconocido al conectarse a Apple Calendar'
        }
      });

      console.error('Error creando cliente CalDAV:', error);
      return null;
    }
  }

  private static buildICalString(payload: AppleEventPayload, filename: string): string {
    const formatDate = (date: Date) => {
      const iso = date.toISOString();
      return iso.replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const escapeText = (text?: string | null) => {
      if (!text) return '';
      return text
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,');
    };

    // Si hay attendees (pacientes), agregar emoji de Qlinexa360 y "consulta" al título para que se destaque en el calendario del paciente
    // Primero limpiar TODOS los emojis 🏥 y la palabra "consulta" que puedan existir
    let cleanTitle = payload.title.replace(/🏥\s*/g, '').trim();
    cleanTitle = cleanTitle.replace(/\s+consulta$/i, '').trim();
    
    const titleForExternal = payload.attendees && payload.attendees.length > 0
      ? `🏥 ${cleanTitle} consulta`
      : cleanTitle;

    const uid = `${filename}@medilink360`;

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MediLink360//Apple Sync//ES',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(payload.start)}`,
      `DTEND:${formatDate(payload.end)}`,
      `SUMMARY:${escapeText(titleForExternal)}`,
      payload.description ? `DESCRIPTION:${escapeText(payload.description)}` : undefined,
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean) as string[];

    return lines.join('\r\n');
  }

  private static extractEvent(icsData: string): {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
  } | null {
    const parsed = parseICS(icsData);
    const event = Object.values(parsed).find(
      value => (value as VEvent).type === 'VEVENT'
    ) as VEvent | undefined;

    if (!event || !event.start || !event.end) {
      return null;
    }

    return {
      summary: event.summary || 'Sin título',
      description: event.description || undefined,
      start: event.start as Date,
      end: event.end as Date
    };
  }

  static async upsertEvent(
    doctorId: string,
    payload: AppleEventPayload
  ): Promise<SyncResult | null> {
    const context = await AppleCalendarSyncService.ensureValidConfig(doctorId);
    if (!context) {
      return null;
    }

    const { config, calendar } = context;

    try {
      const filename = payload.externalEventId
        ? payload.externalEventId.split('/').pop() || `${payload.id}.ics`
        : `${payload.id || crypto.randomUUID()}.ics`;

      const client = await createDAVClient({
        serverUrl: APPLE_SERVER_URL,
        credentials: {
          username: context.credentials.username,
          password: context.credentials.password
        },
        authMethod: 'Basic',
        defaultAccountType: 'caldav'
      });

      if (payload.externalEventId) {
        try {
          await client.deleteCalendarObject({
            calendarObject: {
              url: payload.externalEventId
            }
          });
        } catch (error: any) {
          const status = error?.response?.status;
          if (status && status !== 404) {
            throw error;
          }
        }
      }

      const iCalString = AppleCalendarSyncService.buildICalString(payload, filename);

      await client.createCalendarObject({
        calendar,
        filename,
        iCalString
      });

      const externalEventId = `${calendar.url}${filename}`;

      await prisma.calendarSyncConfig.update({
        where: { id: config.id },
        data: {
          lastSync: new Date(),
          error: null
        }
      });

      return {
        externalEventId,
        externalUpdatedAt: new Date()
      };
    } catch (error) {
      await prisma.calendarSyncConfig.update({
        where: { id: config.id },
        data: {
          error:
            error instanceof Error
              ? error.message
              : 'Error desconocido al sincronizar evento con Apple Calendar'
        }
      });
      console.error('Error al sincronizar evento con Apple Calendar:', error);
      throw error;
    }
  }

  // Obtener un evento específico de Apple Calendar por su URL
  static async getEvent(
    doctorId: string,
    externalEventId: string
  ): Promise<any | null> {
    const context = await AppleCalendarSyncService.ensureValidConfig(doctorId);
    if (!context) {
      return null;
    }

    const { config, credentials, calendar } = context;

    try {
      const client = await createDAVClient({
        serverUrl: APPLE_SERVER_URL,
        credentials: {
          username: credentials.username,
          password: credentials.password
        },
        authMethod: 'Basic',
        defaultAccountType: 'caldav'
      });

      const calendarObjects = await client.fetchCalendarObjects({
        calendar,
        objectUrls: [externalEventId]
      });

      if (!calendarObjects || calendarObjects.length === 0) {
        return null;
      }

      const object = calendarObjects[0];
      if (!object?.data) {
        return null;
      }

      // Parsear el iCal para obtener información del evento y attendees
      const parsed = parseICS(object.data);
      const event = Object.values(parsed).find(
        value => (value as VEvent).type === 'VEVENT'
      ) as VEvent | undefined;

      if (!event) {
        return null;
      }

      // Extraer información de attendees si está disponible
      // En iCal, los attendees pueden tener PARTSTAT (ACCEPTED, DECLINED, TENTATIVE, NEEDS-ACTION)
      const attendees: any[] = [];
      if ((event as any).attendee) {
        const attendeeList = Array.isArray((event as any).attendee) 
          ? (event as any).attendee 
          : [(event as any).attendee];
        
        for (const att of attendeeList) {
          if (typeof att === 'string') {
            // Si es un string, intentar parsear
            const emailMatch = att.match(/mailto:([^\s,]+)/);
            if (emailMatch) {
              attendees.push({
                email: emailMatch[1],
                responseStatus: att.includes('PARTSTAT=ACCEPTED') ? 'accepted' :
                               att.includes('PARTSTAT=DECLINED') ? 'declined' :
                               att.includes('PARTSTAT=TENTATIVE') ? 'tentative' : 'needsAction'
              });
            }
          } else if (att && att.val) {
            // Si es un objeto con val
            const emailMatch = att.val.match(/mailto:([^\s,]+)/);
            if (emailMatch) {
              attendees.push({
                email: emailMatch[1],
                responseStatus: att.partstat === 'ACCEPTED' ? 'accepted' :
                               att.partstat === 'DECLINED' ? 'declined' :
                               att.partstat === 'TENTATIVE' ? 'tentative' : 'needsAction'
              });
            }
          }
        }
      }

      return {
        id: (event as any).uid,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        attendees
      };
    } catch (error) {
      console.error('Error obteniendo evento de Apple Calendar:', error);
      return null;
    }
  }

  static async deleteEvent(doctorId: string, externalEventId: string): Promise<void> {
    const context = await AppleCalendarSyncService.ensureValidConfig(doctorId);
    if (!context) {
      return;
    }

    const { config, credentials } = context;

    try {
      const client = await createDAVClient({
        serverUrl: APPLE_SERVER_URL,
        credentials: {
          username: credentials.username,
          password: credentials.password
        },
        authMethod: 'Basic',
        defaultAccountType: 'caldav'
      });

      await client.deleteCalendarObject({
        calendarObject: { url: externalEventId }
      });

      await prisma.calendarSyncConfig.update({
        where: { id: config.id },
        data: {
          lastSync: new Date(),
          error: null
        }
      });
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404) {
        await prisma.calendarSyncConfig.update({
          where: { id: config.id },
          data: {
            lastSync: new Date(),
            error: null
          }
        });
        return;
      }

      await prisma.calendarSyncConfig.update({
        where: { id: config.id },
        data: {
          error:
            error instanceof Error
              ? error.message
              : 'Error desconocido al eliminar evento en Apple Calendar'
        }
      });

      console.error('Error eliminando evento de Apple Calendar:', error);
      throw error;
    }
  }

  static async syncCalendar(
    doctorId: string
  ): Promise<{ created: number; updated: number; removed: number }> {
    const context = await AppleCalendarSyncService.ensureValidConfig(doctorId);
    if (!context) {
      return { created: 0, updated: 0, removed: 0 };
    }

    const { config, credentials, calendar } = context;

    try {
      const client = await createDAVClient({
        serverUrl: APPLE_SERVER_URL,
        credentials: {
          username: credentials.username,
          password: credentials.password
        },
        authMethod: 'Basic',
        defaultAccountType: 'caldav'
      });

      const now = new Date();
      const timeMin = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      const objects = await client.fetchCalendarObjects({
        calendar,
        timeRange: {
          start: timeMin.toISOString(),
          end: timeMax.toISOString()
        }
      });

      const existingEvents = await prisma.internalCalendarEvent.findMany({
        where: {
          doctorId,
          externalProvider: 'apple',
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

      let created = 0;
      let updated = 0;
      const seen = new Set<string>();

      for (const object of objects) {
        if (!object || !object.url || !object.data) {
          continue;
        }

        const extracted = AppleCalendarSyncService.extractEvent(object.data);
        if (!extracted) continue;

        seen.add(object.url);

        const payload = {
          titulo: extracted.summary,
          descripcion: extracted.description || null,
          fechaHoraInicio: extracted.start,
          fechaHoraFin: extracted.end,
          origenEvento: 'apple' as const,
          linkMeeting: null,
          externalProvider: 'apple' as const,
          externalEventId: object.url,
          externalUpdatedAt: new Date()
        };

        const existing = existingMap.get(object.url);

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
              creadoPor: doctorId,
              ...payload
            }
          });
          created += 1;
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
        where: { id: config.id },
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
    } catch (error) {
      await prisma.calendarSyncConfig.update({
        where: { id: config.id },
        data: {
          error:
            error instanceof Error
              ? error.message
              : 'Error desconocido al sincronizar Apple Calendar'
        }
      });
      console.error('Error durante sincronización con Apple Calendar:', error);
      return { created: 0, updated: 0, removed: 0 };
    }
  }
}

