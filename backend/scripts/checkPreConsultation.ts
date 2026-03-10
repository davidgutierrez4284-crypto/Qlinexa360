/**
 * Script para verificar pre-consultas asociadas a appointments
 * 
 * Uso: 
 *   npm run check:preconsultation appointmentId
 *   npm run check:preconsultation --email patient@example.com --date "2025-11-22T16:00:00"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPreConsultationByAppointmentId(appointmentId: string) {
  try {
    console.log(`\n🔍 Buscando appointment: ${appointmentId}\n`);

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: {
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
        preConsultation: true
      }
    });

    if (!appointment) {
      console.log('❌ Appointment no encontrado');
      return;
    }

    displayAppointmentInfo(appointment);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

async function checkPreConsultationByEmailAndDate(email: string, date: Date) {
  try {
    console.log(`\n🔍 Buscando appointment para paciente: ${email}`);
    console.log(`   Fecha: ${date.toISOString()}\n`);

    // Buscar el usuario por email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        patientProfile: true
      }
    });

    if (!user || !user.patientProfile) {
      console.log('❌ Paciente no encontrado');
      return;
    }

    const patient = user.patientProfile;

    // Buscar appointments del paciente cerca de la fecha especificada
    const startDate = new Date(date);
    startDate.setHours(startDate.getHours() - 1);
    const endDate = new Date(date);
    endDate.setHours(endDate.getHours() + 1);

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId: patient.id,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        patient: {
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
        preConsultation: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    if (appointments.length === 0) {
      console.log('❌ No se encontraron appointments para esta fecha');
      return;
    }

    console.log(`✅ Se encontraron ${appointments.length} appointment(s):\n`);

    appointments.forEach((appointment, index) => {
      console.log(`\n--- Appointment ${index + 1} ---`);
      displayAppointmentInfo(appointment);
    });
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

function displayAppointmentInfo(appointment: any) {
  const patientName = `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`;
  const doctorName = `${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`;

  console.log('📋 Información del Appointment:');
  console.log(`   ID: ${appointment.id}`);
  console.log(`   Paciente: ${patientName} (${appointment.patient.user.email})`);
  console.log(`   Doctor: ${doctorName} (${appointment.doctor.user.email})`);
  console.log(`   Fecha: ${new Date(appointment.date).toLocaleString('es-MX')}`);
  console.log(`   Status: ${appointment.status}`);
  console.log(`   Notas: ${appointment.notes || 'N/A'}`);

  if (appointment.preConsultation) {
    const preConsultation = appointment.preConsultation;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/pre-consulta/${preConsultation.token}`;

    console.log('\n✅ Pre-Consulta encontrada:');
    console.log(`   ID: ${preConsultation.id}`);
    console.log(`   Token: ${preConsultation.token}`);
    console.log(`   Status: ${preConsultation.status}`);
    console.log(`   Creada: ${new Date(preConsultation.createdAt).toLocaleString('es-MX')}`);
    console.log(`   Expira: ${new Date(preConsultation.expiresAt).toLocaleString('es-MX')}`);
    console.log(`   Completada: ${preConsultation.completedAt ? new Date(preConsultation.completedAt).toLocaleString('es-MX') : 'No'}`);
    console.log(`\n🔗 Link de Pre-Consulta:`);
    console.log(`   ${link}`);
    
    if (preConsultation.status === 'PENDING') {
      console.log(`\n✅ Status es PENDING - El link debería aparecer en el email`);
    } else {
      console.log(`\n⚠️  Status es ${preConsultation.status} - El link NO aparecerá en el email`);
    }
  } else {
    console.log('\n❌ No hay Pre-Consulta asociada a este appointment');
    console.log('\n   Posibles razones:');
    console.log('   - No es la primera cita del paciente con este doctor');
    console.log('   - Ya existe una consulta médica previa');
    console.log('   - Hubo un error al crear la pre-consulta');
    console.log('   - La pre-consulta fue eliminada o expirada');
  }
}

async function listAllPreConsultations() {
  try {
    console.log('\n🔍 Listando todas las pre-consultas...\n');

    const preConsultations = await prisma.preConsultation.findMany({
      include: {
        appointment: {
          include: {
            patient: {
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
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20 // Limitar a las últimas 20
    });

    if (preConsultations.length === 0) {
      console.log('❌ No se encontraron pre-consultas');
      return;
    }

    console.log(`✅ Se encontraron ${preConsultations.length} pre-consulta(s):\n`);

    preConsultations.forEach((preConsultation, index) => {
      const patientName = `${preConsultation.appointment.patient.user.firstName} ${preConsultation.appointment.patient.user.lastName}`;
      const doctorName = `${preConsultation.appointment.doctor.user.firstName} ${preConsultation.appointment.doctor.user.lastName}`;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const link = `${frontendUrl}/pre-consulta/${preConsultation.token}`;

      console.log(`\n--- Pre-Consulta ${index + 1} ---`);
      console.log(`   ID: ${preConsultation.id}`);
      console.log(`   Token: ${preConsultation.token}`);
      console.log(`   Status: ${preConsultation.status}`);
      console.log(`   Appointment ID: ${preConsultation.appointmentId}`);
      console.log(`   Paciente: ${patientName} (${preConsultation.appointment.patient.user.email})`);
      console.log(`   Doctor: ${doctorName}`);
      console.log(`   Fecha cita: ${new Date(preConsultation.appointment.date).toLocaleString('es-MX')}`);
      console.log(`   Creada: ${new Date(preConsultation.createdAt).toLocaleString('es-MX')}`);
      console.log(`   Expira: ${new Date(preConsultation.expiresAt).toLocaleString('es-MX')}`);
      console.log(`   Link: ${link}`);
    });
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('📋 Script de verificación de Pre-Consultas\n');
    console.log('Uso:');
    console.log('  npm run check:preconsultation <appointmentId>');
    console.log('  npm run check:preconsultation --email <email> --date <fecha>');
    console.log('  npm run check:preconsultation --list');
    console.log('\nEjemplos:');
    console.log('  npm run check:preconsultation abc123-def456-ghi789');
    console.log('  npm run check:preconsultation --email paciente@example.com --date "2025-11-22T16:00:00"');
    console.log('  npm run check:preconsultation --list');
    process.exit(1);
  }

  if (args[0] === '--list') {
    await listAllPreConsultations();
  } else if (args[0] === '--email') {
    const emailIndex = args.indexOf('--email');
    const dateIndex = args.indexOf('--date');
    
    if (emailIndex === -1 || dateIndex === -1 || emailIndex + 1 >= args.length || dateIndex + 1 >= args.length) {
      console.log('❌ Error: Se requiere --email y --date');
      console.log('Ejemplo: npm run check:preconsultation --email paciente@example.com --date "2025-11-22T16:00:00"');
      process.exit(1);
    }

    const email = args[emailIndex + 1];
    const dateStr = args[dateIndex + 1];
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) {
      console.log('❌ Error: Fecha inválida');
      console.log('Formato esperado: YYYY-MM-DDTHH:mm:ss');
      process.exit(1);
    }

    await checkPreConsultationByEmailAndDate(email, date);
  } else {
    // Asumir que es un appointment ID
    const appointmentId = args[0];
    await checkPreConsultationByAppointmentId(appointmentId);
  }

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });

