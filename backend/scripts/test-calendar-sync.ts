/**
 * Script de pruebas para validar la sincronización de calendarios
 * 
 * Uso: npx ts-node scripts/test-calendar-sync.ts <provider> <doctorId>
 * 
 * Ejemplo:
 *   npx ts-node scripts/test-calendar-sync.ts google doctor-id-123
 *   npx ts-node scripts/test-calendar-sync.ts outlook doctor-id-123
 *   npx ts-node scripts/test-calendar-sync.ts apple doctor-id-123
 *   npx ts-node scripts/test-calendar-sync.ts notion doctor-id-123
 */

import { PrismaClient } from '@prisma/client';
import { GoogleCalendarSyncService } from '../src/services/googleCalendarSync.service';
import { OutlookCalendarSyncService } from '../src/services/outlookCalendarSync.service';
import { AppleCalendarSyncService } from '../src/services/appleCalendarSync.service';
import { NotionCalendarSyncService } from '../src/services/notionCalendarSync.service';
import { CalendarSyncController } from '../src/controllers/calendarSync.controller';

const prisma = new PrismaClient();

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  error?: any;
}

async function testGoogleCalendar(doctorId: string): Promise<TestResult[]> {
  const results: TestResult[] = [];

  try {
    // Test 1: Verificar conexión
    const config = await prisma.calendarSyncConfig.findFirst({
      where: { doctorId, provider: 'google', isConnected: true }
    });

    if (!config) {
      results.push({
        test: 'Verificar conexión',
        success: false,
        message: 'Google Calendar no está conectado'
      });
      return results;
    }

    results.push({
      test: 'Verificar conexión',
      success: true,
      message: 'Google Calendar está conectado'
    });

    // Test 2: Crear evento de prueba
    const testEvent = {
      id: `test-${Date.now()}`,
      title: `Test Event - ${new Date().toISOString()}`,
      description: 'Evento de prueba para validar sincronización',
      start: new Date(Date.now() + 60 * 60 * 1000), // 1 hora desde ahora
      end: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas desde ahora
      attendees: []
    };

    const createResult = await GoogleCalendarSyncService.upsertEvent(doctorId, testEvent);

    if (createResult) {
      results.push({
        test: 'Crear evento',
        success: true,
        message: `Evento creado con ID: ${createResult.externalEventId}`
      });

      // Test 3: Actualizar evento
      const updateResult = await GoogleCalendarSyncService.upsertEvent(doctorId, {
        ...testEvent,
        title: `Test Event Updated - ${new Date().toISOString()}`,
        externalEventId: createResult.externalEventId
      });

      if (updateResult) {
        results.push({
          test: 'Actualizar evento',
          success: true,
          message: 'Evento actualizado correctamente'
        });
      }

      // Test 4: Eliminar evento
      await GoogleCalendarSyncService.deleteEvent(doctorId, createResult.externalEventId);
      results.push({
        test: 'Eliminar evento',
        success: true,
        message: 'Evento eliminado correctamente'
      });
    } else {
      results.push({
        test: 'Crear evento',
        success: false,
        message: 'No se pudo crear el evento'
      });
    }

    // Test 5: Sincronización completa
    // Usar el método del controlador que es el que realmente se usa
    const syncResult = await (CalendarSyncController as any).syncGoogleCalendar(doctorId, config);
    results.push({
      test: 'Sincronización completa',
      success: true,
      message: `Sincronizado: ${syncResult.created} creados, ${syncResult.updated} actualizados, ${syncResult.removed} eliminados`
    });

  } catch (error) {
    results.push({
      test: 'Error general',
      success: false,
      message: 'Error durante las pruebas',
      error
    });
  }

  return results;
}

async function testOutlookCalendar(doctorId: string): Promise<TestResult[]> {
  const results: TestResult[] = [];

  try {
    const config = await prisma.calendarSyncConfig.findFirst({
      where: { doctorId, provider: 'outlook', isConnected: true }
    });

    if (!config) {
      results.push({
        test: 'Verificar conexión',
        success: false,
        message: 'Outlook Calendar no está conectado'
      });
      return results;
    }

    results.push({
      test: 'Verificar conexión',
      success: true,
      message: 'Outlook Calendar está conectado'
    });

    const testEvent = {
      id: `test-${Date.now()}`,
      title: `Test Event - ${new Date().toISOString()}`,
      description: 'Evento de prueba',
      start: new Date(Date.now() + 60 * 60 * 1000),
      end: new Date(Date.now() + 2 * 60 * 60 * 1000),
      attendees: [],
      teamsEnabled: false
    };

    const createResult = await OutlookCalendarSyncService.upsertEvent(doctorId, testEvent);

    if (createResult) {
      results.push({
        test: 'Crear evento',
        success: true,
        message: `Evento creado con ID: ${createResult.externalEventId}`
      });

      await OutlookCalendarSyncService.deleteEvent(doctorId, createResult.externalEventId);
      results.push({
        test: 'Eliminar evento',
        success: true,
        message: 'Evento eliminado correctamente'
      });
    }

    const syncResult = await OutlookCalendarSyncService.syncCalendar(doctorId, config);
    results.push({
      test: 'Sincronización completa',
      success: true,
      message: `Sincronizado: ${syncResult.created} creados, ${syncResult.updated} actualizados, ${syncResult.removed} eliminados`
    });

  } catch (error) {
    results.push({
      test: 'Error general',
      success: false,
      message: 'Error durante las pruebas',
      error
    });
  }

  return results;
}

async function testAppleCalendar(doctorId: string): Promise<TestResult[]> {
  const results: TestResult[] = [];

  try {
    const config = await prisma.calendarSyncConfig.findFirst({
      where: { doctorId, provider: 'apple', isConnected: true }
    });

    if (!config) {
      results.push({
        test: 'Verificar conexión',
        success: false,
        message: 'Apple Calendar no está conectado'
      });
      return results;
    }

    results.push({
      test: 'Verificar conexión',
      success: true,
      message: 'Apple Calendar está conectado'
    });

    const testEvent = {
      id: `test-${Date.now()}`,
      title: `Test Event - ${new Date().toISOString()}`,
      description: 'Evento de prueba',
      start: new Date(Date.now() + 60 * 60 * 1000),
      end: new Date(Date.now() + 2 * 60 * 60 * 1000),
      attendees: []
    };

    const createResult = await AppleCalendarSyncService.upsertEvent(doctorId, testEvent);

    if (createResult) {
      results.push({
        test: 'Crear evento',
        success: true,
        message: `Evento creado con ID: ${createResult.externalEventId}`
      });

      await AppleCalendarSyncService.deleteEvent(doctorId, createResult.externalEventId);
      results.push({
        test: 'Eliminar evento',
        success: true,
        message: 'Evento eliminado correctamente'
      });
    }

    const syncResult = await AppleCalendarSyncService.syncCalendar(doctorId);
    results.push({
      test: 'Sincronización completa',
      success: true,
      message: `Sincronizado: ${syncResult.created} creados, ${syncResult.updated} actualizados, ${syncResult.removed} eliminados`
    });

  } catch (error) {
    results.push({
      test: 'Error general',
      success: false,
      message: 'Error durante las pruebas',
      error
    });
  }

  return results;
}

async function testNotionCalendar(doctorId: string): Promise<TestResult[]> {
  const results: TestResult[] = [];

  try {
    const config = await prisma.calendarSyncConfig.findFirst({
      where: { doctorId, provider: 'notion', isConnected: true }
    });

    if (!config) {
      results.push({
        test: 'Verificar conexión',
        success: false,
        message: 'Notion Calendar no está conectado'
      });
      return results;
    }

    results.push({
      test: 'Verificar conexión',
      success: true,
      message: 'Notion Calendar está conectado'
    });

    const testEvent = {
      id: `test-${Date.now()}`,
      title: `Test Event - ${new Date().toISOString()}`,
      description: 'Evento de prueba',
      start: new Date(Date.now() + 60 * 60 * 1000),
      end: new Date(Date.now() + 2 * 60 * 60 * 1000),
      attendees: []
    };

    const createResult = await NotionCalendarSyncService.upsertEvent(doctorId, testEvent);

    if (createResult) {
      results.push({
        test: 'Crear evento',
        success: true,
        message: `Evento creado con ID: ${createResult.externalEventId}`
      });

      await NotionCalendarSyncService.deleteEvent(doctorId, createResult.externalEventId);
      results.push({
        test: 'Eliminar evento',
        success: true,
        message: 'Evento eliminado correctamente'
      });
    }

    const syncResult = await NotionCalendarSyncService.syncCalendar(doctorId, config);
    results.push({
      test: 'Sincronización completa',
      success: true,
      message: `Sincronizado: ${syncResult.created} creados, ${syncResult.updated} actualizados, ${syncResult.removed} eliminados`
    });

  } catch (error) {
    results.push({
      test: 'Error general',
      success: false,
      message: 'Error durante las pruebas',
      error
    });
  }

  return results;
}

async function main() {
  const provider = process.argv[2];
  const doctorId = process.argv[3];

  if (!provider || !doctorId) {
    console.error('Uso: npx ts-node scripts/test-calendar-sync.ts <provider> <doctorId>');
    console.error('Providers: google, outlook, apple, notion');
    process.exit(1);
  }

  console.log(`\n🧪 Ejecutando pruebas para ${provider.toUpperCase()}...\n`);

  let results: TestResult[] = [];

  switch (provider.toLowerCase()) {
    case 'google':
      results = await testGoogleCalendar(doctorId);
      break;
    case 'outlook':
      results = await testOutlookCalendar(doctorId);
      break;
    case 'apple':
      results = await testAppleCalendar(doctorId);
      break;
    case 'notion':
      results = await testNotionCalendar(doctorId);
      break;
    default:
      console.error(`Provider desconocido: ${provider}`);
      process.exit(1);
  }

  console.log('\n📊 Resultados de las Pruebas:\n');
  console.log('─'.repeat(60));

  let passed = 0;
  let failed = 0;

  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const status = result.success ? 'PASS' : 'FAIL';
    console.log(`${icon} [${status}] ${result.test}`);
    console.log(`   ${result.message}`);
    if (result.error) {
      console.log(`   Error: ${result.error.message || result.error}`);
    }
    console.log('');

    if (result.success) {
      passed++;
    } else {
      failed++;
    }
  });

  console.log('─'.repeat(60));
  console.log(`\nTotal: ${results.length} pruebas`);
  console.log(`✅ Pasadas: ${passed}`);
  console.log(`❌ Fallidas: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 ¡Todas las pruebas pasaron!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Algunas pruebas fallaron. Revisa los errores arriba.\n');
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

