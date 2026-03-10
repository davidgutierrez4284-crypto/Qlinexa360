import { PrismaClient, CalendarSyncConfig } from '@prisma/client';
import { Client } from '@notionhq/client';
import { OAuthService } from './oauth.service';
import { notifyCalendarReconnectNeeded } from '../utils/calendarAuth.utils';

const prisma = new PrismaClient();

interface NotionEventPayload {
  id: string;
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  attendees?: string[];
  location?: string | null;
  externalEventId?: string | null;
  linkMeeting?: string | null;
}

interface SyncResult {
  externalEventId: string;
  externalUpdatedAt: Date;
}

interface NotionCredentials {
  accessToken: string;
  databaseId?: string;
}

export class NotionCalendarSyncService {
  private static parseCredentials(config: CalendarSyncConfig): NotionCredentials | null {
    if (!config.accessToken) {
      return null;
    }

    try {
      // Si el accessToken contiene un JSON con databaseId, parsearlo
      try {
        const decoded = Buffer.from(config.accessToken, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (parsed?.accessToken && parsed?.databaseId) {
          return {
            accessToken: parsed.accessToken,
            databaseId: parsed.databaseId
          };
        }
      } catch {
        // Si no es JSON, usar directamente como accessToken
      }

      return {
        accessToken: config.accessToken
      };
    } catch (error) {
      console.warn('No se pudieron parsear credenciales de Notion:', error);
      return null;
    }
  }

  private static createClient(accessToken: string): Client {
    return new Client({
      auth: accessToken
    });
  }

  private static async getDoctorConfig(
    doctorId: string
  ): Promise<CalendarSyncConfig | null> {
    return prisma.calendarSyncConfig.findFirst({
      where: {
        doctorId,
        provider: 'notion',
        isConnected: true,
        accessToken: { not: null }
      }
    });
  }

  private static async ensureValidCredentials(
    config: CalendarSyncConfig
  ): Promise<CalendarSyncConfig> {
    // Notion tokens no expiran típicamente, pero verificamos si hay refresh token
    if (
      config.expiresAt &&
      config.expiresAt.getTime() <= Date.now() + 60 * 1000 &&
      config.refreshToken
    ) {
      const refreshed = await OAuthService.refreshAccessToken(
        'notion',
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

        return updated;
      } else {
        await notifyCalendarReconnectNeeded({
          doctorId: config.doctorId,
          provider: 'notion',
          reason: 'Conexión expirada. Vuelve a conectar Notion.'
        });
      }
    }

    return config;
  }

  private static buildNotionPageProperties(
    payload: NotionEventPayload,
    databaseId: string
  ): any {
    const properties: any = {
      Name: {
        title: [
          {
            text: {
              content: payload.title
            }
          }
        ]
      },
      'Fecha Inicio': {
        date: {
          start: payload.start.toISOString()
        }
      },
      'Fecha Fin': {
        date: {
          start: payload.end.toISOString()
        }
      }
    };

    // Agregar descripción si existe
    if (payload.description) {
      properties.Descripción = {
        rich_text: [
          {
            text: {
              content: payload.description
            }
          }
        ]
      };
    }

    // Agregar ubicación si existe
    if (payload.location) {
      properties.Ubicación = {
        rich_text: [
          {
            text: {
              content: payload.location
            }
          }
        ]
      };
    }

    // Agregar link de reunión si existe
    if (payload.linkMeeting) {
      properties['Link Reunión'] = {
        url: payload.linkMeeting
      };
    }

    // Agregar asistentes si existen
    if (payload.attendees && payload.attendees.length > 0) {
      properties.Asistentes = {
        rich_text: [
          {
            text: {
              content: payload.attendees.join(', ')
            }
          }
        ]
      };
    }

    return properties;
  }

  static async upsertEvent(
    doctorId: string,
    payload: NotionEventPayload
  ): Promise<SyncResult | null> {
    let config = await NotionCalendarSyncService.getDoctorConfig(doctorId);
    if (!config) {
      return null;
    }

    config = await NotionCalendarSyncService.ensureValidCredentials(config);

    const credentials = NotionCalendarSyncService.parseCredentials(config);
    if (!credentials) {
      return null;
    }

    const client = NotionCalendarSyncService.createClient(credentials.accessToken);

    // Si no hay databaseId, intentar obtenerlo o usar uno por defecto
    let databaseId = credentials.databaseId;
    if (!databaseId) {
      // Intentar buscar una base de datos de calendario
      try {
        const searchResponse = await client.search({});

        // Filtrar manualmente las bases de datos
        const databases = searchResponse.results.filter(
          (item: any) => item.object === 'database'
        ) as any[];

        const calendarDatabase = databases.find((db: any) =>
          db.title?.[0]?.plain_text?.toLowerCase().includes('calendario') ||
          db.title?.[0]?.plain_text?.toLowerCase().includes('calendar')
        );

        if (calendarDatabase) {
          databaseId = calendarDatabase.id;
        } else if (databases.length > 0) {
          // Usar la primera base de datos encontrada
          databaseId = databases[0].id;
        } else {
          throw new Error('No se encontró ninguna base de datos en Notion');
        }
      } catch (error) {
        await prisma.calendarSyncConfig.update({
          where: { id: config.id },
          data: {
            error: error instanceof Error ? error.message : 'Error al buscar base de datos en Notion'
          }
        });
        return null;
      }
    }

    if (!databaseId) {
      await prisma.calendarSyncConfig.update({
        where: { id: config.id },
        data: {
          error: 'No se pudo determinar la base de datos de Notion'
        }
      });
      return null;
    }

    try {
      const properties = NotionCalendarSyncService.buildNotionPageProperties(
        payload,
        databaseId
      );

      let pageId: string;

      if (payload.externalEventId) {
        // Actualizar página existente
        try {
          await client.pages.update({
            page_id: payload.externalEventId,
            properties
          });
          pageId = payload.externalEventId;
        } catch (error: any) {
          if (error?.code === 'object_not_found') {
            // La página no existe, crear una nueva
            const newPage = await client.pages.create({
              parent: {
                database_id: databaseId
              },
              properties
            });
            pageId = newPage.id;
          } else {
            throw error;
          }
        }
      } else {
        // Crear nueva página
        const newPage = await client.pages.create({
          parent: {
            database_id: databaseId
          },
          properties
        });
        pageId = newPage.id;
      }

      await prisma.calendarSyncConfig.update({
        where: { id: config.id },
        data: {
          lastSync: new Date(),
          error: null
        }
      });

      return {
        externalEventId: pageId,
        externalUpdatedAt: new Date()
      };
    } catch (error) {
      await prisma.calendarSyncConfig.update({
        where: { id: config.id },
        data: {
          error:
            error instanceof Error
              ? error.message
              : 'Error desconocido al sincronizar evento con Notion'
        }
      });
      console.error('Error al sincronizar evento con Notion:', error);
      throw error;
    }
  }

  static async deleteEvent(
    doctorId: string,
    externalEventId: string
  ): Promise<void> {
    const config = await NotionCalendarSyncService.getDoctorConfig(doctorId);
    if (!config) {
      return;
    }

    const credentials = NotionCalendarSyncService.parseCredentials(config);
    if (!credentials) {
      return;
    }

    const client = NotionCalendarSyncService.createClient(credentials.accessToken);

    try {
      await client.pages.update({
        page_id: externalEventId,
        archived: true
      });

      await prisma.calendarSyncConfig.update({
        where: { id: config.id },
        data: {
          lastSync: new Date(),
          error: null
        }
      });
    } catch (error: any) {
      const status = error?.code;
      if (status === 'object_not_found') {
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
              : 'Error desconocido al eliminar evento en Notion'
        }
      });

      console.error('Error eliminando evento de Notion:', error);
      throw error;
    }
  }

  static async syncCalendar(
    doctorId: string,
    config: CalendarSyncConfig
  ): Promise<{ created: number; updated: number; removed: number }> {
    const workingConfig = await NotionCalendarSyncService.ensureValidCredentials(config);

    if (!workingConfig.accessToken) {
      return { created: 0, updated: 0, removed: 0 };
    }

    const credentials = NotionCalendarSyncService.parseCredentials(workingConfig);
    if (!credentials) {
      return { created: 0, updated: 0, removed: 0 };
    }

    const client = NotionCalendarSyncService.createClient(credentials.accessToken);

    try {
      let databaseId = credentials.databaseId;

      // Si no hay databaseId, buscar una base de datos
      if (!databaseId) {
        const searchResponse = await client.search({});

        // Filtrar manualmente las bases de datos
        const databases = searchResponse.results.filter(
          (item: any) => item.object === 'database'
        ) as any[];

        const calendarDatabase = databases.find((db: any) =>
          db.title?.[0]?.plain_text?.toLowerCase().includes('calendario') ||
          db.title?.[0]?.plain_text?.toLowerCase().includes('calendar')
        );

        if (calendarDatabase) {
          databaseId = calendarDatabase.id;
        } else if (databases.length > 0) {
          databaseId = databases[0].id;
        } else {
          throw new Error('No se encontró ninguna base de datos en Notion');
        }
      }

      if (!databaseId) {
        throw new Error('No se pudo determinar la base de datos de Notion');
      }

      const now = new Date();
      const timeMin = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      // Consultar páginas en el rango de fechas
      // Usar 'as any' porque los tipos de @notionhq/client pueden no estar actualizados
      const response = await (client.databases as any).query({
        database_id: databaseId,
        filter: {
          and: [
            {
              property: 'Fecha Inicio',
              date: {
                on_or_after: timeMin.toISOString()
              }
            },
            {
              property: 'Fecha Inicio',
              date: {
                on_or_before: timeMax.toISOString()
              }
            }
          ]
        }
      });

      const pages = response.results as any[];

      const existingEvents = await prisma.internalCalendarEvent.findMany({
        where: {
          doctorId,
          externalProvider: 'notion',
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

      for (const page of pages) {
        if (!page || !page.id || page.archived) continue;

        const properties = page.properties || {};

        const nameProp = properties.Name || properties['Título'] || properties.Title;
        const startProp = properties['Fecha Inicio'] || properties['Start'] || properties['Inicio'];
        const endProp = properties['Fecha Fin'] || properties['End'] || properties['Fin'];
        const descProp = properties.Descripción || properties.Description || properties['Descripción'];
        const locationProp = properties.Ubicación || properties.Location || properties['Location'];
        const linkProp = properties['Link Reunión'] || properties['Meeting Link'] || properties['Link'];

        const title = nameProp?.title?.[0]?.plain_text || 'Sin título';
        const startDate = startProp?.date?.start
          ? new Date(startProp.date.start)
          : null;
        const endDate = endProp?.date?.start
          ? new Date(endProp.date.start)
          : null;
        const description = descProp?.rich_text?.[0]?.plain_text || null;
        const location = locationProp?.rich_text?.[0]?.plain_text || null;
        const linkMeeting = linkProp?.url || null;

        if (!startDate || !endDate) continue;

        seen.add(page.id);

        const payload = {
          titulo: title,
          descripcion: description,
          fechaHoraInicio: startDate,
          fechaHoraFin: endDate,
          origenEvento: 'notion' as const,
          linkMeeting,
          externalProvider: 'notion' as const,
          externalEventId: page.id,
          externalUpdatedAt: page.last_edited_time
            ? new Date(page.last_edited_time)
            : new Date(),
          creadoPor: doctorId
        };

        const existing = existingMap.get(page.id);

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
        where: { id: workingConfig.id },
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
        where: { id: workingConfig.id },
        data: {
          error:
            error instanceof Error
              ? error.message
              : 'Error desconocido al sincronizar Notion Calendar'
        }
      });
      console.error('Error durante sincronización con Notion Calendar:', error);
      return { created: 0, updated: 0, removed: 0 };
    }
  }
}

