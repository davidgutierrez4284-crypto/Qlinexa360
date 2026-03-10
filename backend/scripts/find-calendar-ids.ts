/**
 * Script para encontrar doctorId y eventId para diagnóstico
 * 
 * Uso:
 *   npx ts-node backend/scripts/find-calendar-ids.ts [email-del-doctor]
 * 
 * Ejemplo:
 *   npx ts-node backend/scripts/find-calendar-ids.ts doctor@email.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findCalendarIds(doctorEmail?: string) {
  try {
    console.log('🔍 Buscando IDs para diagnóstico...\n');

    // Buscar doctores
    let doctors;
    if (doctorEmail) {
      doctors = await prisma.doctor.findMany({
        where: {
          user: {
            email: doctorEmail
          }
        },
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
    } else {
      // Buscar todos los doctores (últimos 10)
      doctors = await prisma.doctor.findMany({
        take: 10,
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
    }

    if (doctors.length === 0) {
      console.log('❌ No se encontraron doctores');
      if (doctorEmail) {
        console.log(`   Con email: ${doctorEmail}`);
      }
      return;
    }

    console.log(`✅ Encontrados ${doctors.length} doctor(es):\n`);
    
    for (const doctor of doctors) {
      console.log('='.repeat(80));
      console.log(`👨‍⚕️ Doctor: ${doctor.user?.firstName} ${doctor.user?.lastName}`);
      console.log(`   Email: ${doctor.user?.email}`);
      console.log(`   Doctor ID: ${doctor.id}`);
      console.log(`   Professional Title: ${doctor.professionalTitle || 'N/A'}`);
      console.log('');

      // Verificar configuraciones de calendario
      const calendarConfigs = await prisma.calendarSyncConfig.findMany({
        where: { doctorId: doctor.id }
      });

      console.log(`   📅 Calendarios conectados (${calendarConfigs.length}):`);
      if (calendarConfigs.length === 0) {
        console.log('      ⚠️  No hay calendarios conectados');
      } else {
        calendarConfigs.forEach(config => {
          const status = config.isConnected ? '✅ Conectado' : '❌ Desconectado';
          const error = config.error ? ` (Error: ${config.error.substring(0, 50)}...)` : '';
          console.log(`      - ${config.provider}: ${status}${error}`);
        });
      }
      console.log('');

      // Buscar eventos recientes con pacientes
      const recentEvents = await prisma.internalCalendarEvent.findMany({
        where: {
          doctorId: doctor.id,
          fechaHoraInicio: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Últimos 7 días
          },
          patientId: {
            not: null
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
        take: 5
      });

      console.log(`   📋 Eventos recientes con pacientes (${recentEvents.length}):`);
      if (recentEvents.length === 0) {
        console.log('      ⚠️  No hay eventos recientes con pacientes');
      } else {
        recentEvents.forEach((event, index) => {
          const patientName = event.patient 
            ? `${event.patient.firstName} ${event.patient.lastName}` 
            : 'N/A';
          const patientEmail = event.patient?.email || 'sin email';
          const syncStatus = event.externalProvider 
            ? `✅ Sincronizado (${event.externalProvider})` 
            : '❌ NO sincronizado';
          
          console.log(`      ${index + 1}. ${event.titulo}`);
          console.log(`         Event ID: ${event.id}`);
          console.log(`         Fecha: ${event.fechaHoraInicio.toLocaleString('es-ES')}`);
          console.log(`         Paciente: ${patientName} (${patientEmail})`);
          console.log(`         Sincronización: ${syncStatus}`);
          if (event.externalEventId) {
            console.log(`         External Event ID: ${event.externalEventId}`);
          }
          console.log('');
        });
      }

      console.log('   💡 Comando para diagnóstico:');
      if (recentEvents.length > 0) {
        const firstEvent = recentEvents[0];
        console.log(`      npm run diagnose:calendar "${doctor.id}" "${firstEvent.id}"`);
      } else {
        console.log(`      npm run diagnose:calendar "${doctor.id}"`);
      }
      console.log('');
    }

    // Buscar eventos recientes sin sincronizar
    console.log('='.repeat(80));
    console.log('\n⚠️  EVENTOS CON PACIENTES PERO SIN SINCRONIZAR:');
    console.log('='.repeat(80));
    
    const unsyncedEvents = await prisma.internalCalendarEvent.findMany({
      where: {
        patientId: {
          not: null
        },
        externalEventId: null,
        fechaHoraInicio: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        patient: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        fechaHoraInicio: 'desc'
      },
      take: 10
    });

    if (unsyncedEvents.length === 0) {
      console.log('✅ No hay eventos sin sincronizar');
    } else {
      console.log(`\nEncontrados ${unsyncedEvents.length} evento(s) sin sincronizar:\n`);
      unsyncedEvents.forEach((event, index) => {
        const doctorName = event.doctor.user 
          ? `${event.doctor.user.firstName} ${event.doctor.user.lastName}` 
          : 'N/A';
        const patientName = event.patient 
          ? `${event.patient.firstName} ${event.patient.lastName}` 
          : 'N/A';
        const patientEmail = event.patient?.email || 'sin email';
        
        console.log(`${index + 1}. ${event.titulo}`);
        console.log(`   Doctor: ${doctorName} (ID: ${event.doctorId})`);
        console.log(`   Paciente: ${patientName} (${patientEmail})`);
        console.log(`   Fecha: ${event.fechaHoraInicio.toLocaleString('es-ES')}`);
        console.log(`   Event ID: ${event.id}`);
        console.log(`   💡 Comando: npm run diagnose:calendar "${event.doctorId}" "${event.id}"`);
        console.log('');
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
const args = process.argv.slice(2);
const doctorEmail = args[0];

if (doctorEmail) {
  console.log(`Buscando doctor con email: ${doctorEmail}\n`);
} else {
  console.log('Buscando todos los doctores recientes...\n');
}

findCalendarIds(doctorEmail);

