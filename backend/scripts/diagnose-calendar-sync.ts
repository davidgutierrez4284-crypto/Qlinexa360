/**
 * Script de diagnóstico para verificar la sincronización de calendarios
 * 
 * Uso:
 *   npx ts-node backend/scripts/diagnose-calendar-sync.ts <doctorId> [eventId]
 * 
 * Ejemplo:
 *   npx ts-node backend/scripts/diagnose-calendar-sync.ts "doctor-uuid" "event-uuid"
 */

import { PrismaClient } from '@prisma/client';
import { GoogleCalendarSyncService } from '../src/services/googleCalendarSync.service';
import { OutlookCalendarSyncService } from '../src/services/outlookCalendarSync.service';
import { AppleCalendarSyncService } from '../src/services/appleCalendarSync.service';

const prisma = new PrismaClient();

interface DiagnosticResult {
  timestamp: string;
  doctorId: string;
  doctorInfo?: any;
  calendarSyncConfigs: any[];
  recentEvents: any[];
  specificEvent?: any;
  recommendations: string[];
  errors: string[];
}

async function diagnoseCalendarSync(doctorId: string, eventId?: string): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    timestamp: new Date().toISOString(),
    doctorId,
    calendarSyncConfigs: [],
    recentEvents: [],
    recommendations: [],
    errors: []
  };

  try {
    // 1. Obtener información del doctor
    console.log('🔍 Obteniendo información del doctor...');
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!doctor) {
      result.errors.push(`Doctor con ID ${doctorId} no encontrado`);
      return result;
    }

    result.doctorInfo = {
      id: doctor.id,
      email: doctor.user?.email,
      name: `${doctor.user?.firstName} ${doctor.user?.lastName}`,
      professionalTitle: doctor.professionalTitle
    };

    console.log(`✅ Doctor encontrado: ${result.doctorInfo.name} (${result.doctorInfo.email})`);

    // 2. Verificar configuraciones de sincronización
    console.log('\n📅 Verificando configuraciones de sincronización...');
    const syncConfigs = await prisma.calendarSyncConfig.findMany({
      where: { doctorId }
    });

    result.calendarSyncConfigs = syncConfigs.map(config => ({
      id: config.id,
      provider: config.provider,
      isConnected: config.isConnected,
      lastSync: config.lastSync,
      error: config.error,
      createdAt: config.createdAt
    }));

    console.log(`   Configuraciones encontradas: ${syncConfigs.length}`);
    syncConfigs.forEach(config => {
      console.log(`   - ${config.provider}: ${config.isConnected ? '✅ Conectado' : '❌ Desconectado'}${config.error ? ` (Error: ${config.error})` : ''}`);
    });

    // 3. Verificar eventos recientes
    console.log('\n📋 Verificando eventos recientes...');
    const recentEvents = await prisma.internalCalendarEvent.findMany({
      where: {
        doctorId,
        fechaHoraInicio: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Últimos 7 días
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userId: true
          }
        }
      },
      orderBy: {
        fechaHoraInicio: 'desc'
      },
      take: 10
    });

    result.recentEvents = recentEvents.map(event => ({
      id: event.id,
      titulo: event.titulo,
      fechaHoraInicio: event.fechaHoraInicio,
      fechaHoraFin: event.fechaHoraFin,
      patientId: event.patientId,
      patientName: event.patient ? `${event.patient.firstName} ${event.patient.lastName}` : null,
      patientEmail: event.patient?.email || null,
      externalProvider: event.externalProvider,
      externalEventId: event.externalEventId,
      linkMeeting: event.linkMeeting
    }));

    console.log(`   Eventos recientes encontrados: ${recentEvents.length}`);
    recentEvents.forEach(event => {
      console.log(`   - ${event.titulo} (${event.fechaHoraInicio.toISOString()})`);
      console.log(`     Paciente: ${event.patient ? `${event.patient.firstName} ${event.patient.lastName} (${event.patient.email || 'sin email'})` : 'Ninguno'}`);
      console.log(`     Sincronizado: ${event.externalProvider || 'NO'} ${event.externalEventId ? `(${event.externalEventId})` : ''}`);
    });

    // 4. Verificar evento específico si se proporciona
    if (eventId) {
      console.log(`\n🔍 Verificando evento específico: ${eventId}...`);
      const event = await prisma.internalCalendarEvent.findUnique({
        where: { id: eventId },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              userId: true
            }
          }
        }
      });

      if (event) {
        result.specificEvent = {
          id: event.id,
          titulo: event.titulo,
          fechaHoraInicio: event.fechaHoraInicio,
          fechaHoraFin: event.fechaHoraFin,
          patientId: event.patientId,
          patientName: event.patient ? `${event.patient.firstName} ${event.patient.lastName}` : null,
          patientEmail: event.patient?.email || null,
          patientUserId: event.patient?.userId || null,
          externalProvider: event.externalProvider,
          externalEventId: event.externalEventId,
          linkMeeting: event.linkMeeting,
          descripcion: event.descripcion?.substring(0, 100)
        };

        // Obtener email del paciente desde User si no está en Patient
        if (event.patient && !event.patient.email && event.patient.userId) {
          const patientUser = await prisma.user.findUnique({
            where: { id: event.patient.userId },
            select: { email: true }
          });
          if (patientUser) {
            result.specificEvent.patientEmail = patientUser.email;
          }
        }

        console.log(`   ✅ Evento encontrado: ${event.titulo}`);
        console.log(`   Paciente: ${result.specificEvent.patientName} (${result.specificEvent.patientEmail || 'sin email'})`);
        console.log(`   Sincronizado: ${event.externalProvider || 'NO'} ${event.externalEventId ? `(${event.externalEventId})` : ''}`);
      } else {
        result.errors.push(`Evento con ID ${eventId} no encontrado`);
      }
    }

    // 5. Generar recomendaciones
    console.log('\n💡 Generando recomendaciones...');
    const connectedCalendars = syncConfigs.filter(c => c.isConnected);
    
    if (connectedCalendars.length === 0) {
      result.recommendations.push('⚠️  No hay calendarios externos conectados. El doctor debe conectar al menos un calendario (Google, Outlook o Apple) para que los pacientes reciban invitaciones.');
    } else {
      result.recommendations.push(`✅ Hay ${connectedCalendars.length} calendario(s) conectado(s): ${connectedCalendars.map(c => c.provider).join(', ')}`);
      
      // Verificar eventos con pacientes pero sin sincronización
      const eventsWithoutSync = recentEvents.filter(e => 
        e.patientId && !e.externalEventId && connectedCalendars.length > 0
      );
      
      if (eventsWithoutSync.length > 0) {
        result.recommendations.push(`⚠️  Hay ${eventsWithoutSync.length} evento(s) con pacientes que NO están sincronizados con calendarios externos.`);
        result.recommendations.push('   Esto puede deberse a:');
        result.recommendations.push('   - Errores durante la sincronización');
        result.recommendations.push('   - Falta de email del paciente');
        result.recommendations.push('   - Problemas con las credenciales del calendario');
      }
    }

    // Verificar eventos con pacientes pero sin email
    const eventsWithoutEmail = recentEvents.filter(e => 
      e.patientId && !e.patient?.email && (!e.patient?.userId)
    );
    
    if (eventsWithoutEmail.length > 0) {
      result.recommendations.push(`⚠️  Hay ${eventsWithoutEmail.length} evento(s) con pacientes que NO tienen email registrado.`);
      result.recommendations.push('   Los pacientes deben tener email para recibir invitaciones de calendario.');
    }

  } catch (error: any) {
    console.error('❌ Error durante el diagnóstico:', error);
    result.errors.push(`Error: ${error.message || 'Error desconocido'}`);
    if (error.stack) {
      result.errors.push(`Stack: ${error.stack}`);
    }
  }

  return result;
}

// Ejecutar diagnóstico
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Uso: npx ts-node backend/scripts/diagnose-calendar-sync.ts <doctorId> [eventId]');
    console.error('Ejemplo: npx ts-node backend/scripts/diagnose-calendar-sync.ts "doctor-uuid" "event-uuid"');
    process.exit(1);
  }

  const doctorId = args[0];
  const eventId = args[1];

  console.log('🔍 Iniciando diagnóstico de sincronización de calendarios...');
  console.log(`   Doctor ID: ${doctorId}`);
  if (eventId) {
    console.log(`   Event ID: ${eventId}`);
  }
  console.log('');

  const result = await diagnoseCalendarSync(doctorId, eventId);

  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTADO DEL DIAGNÓSTICO');
  console.log('='.repeat(80));
  console.log(JSON.stringify(result, null, 2));
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

main().catch(console.error);

