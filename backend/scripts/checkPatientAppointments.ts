/**
 * Script para verificar si un paciente tiene citas previas
 * 
 * Uso: npm run check:patient email1@example.com email2@example.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPatientAppointments(email: string): Promise<void> {
  try {
    console.log(`\n🔍 Verificando paciente con email: ${email}`);
    
    // Buscar el User por email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        patientProfile: {
          include: {
            appointments: {
              include: {
                doctor: {
                  include: {
                    user: {
                      select: {
                        firstName: true,
                        lastName: true,
                        email: true
                      }
                    }
                  }
                },
                preConsultation: {
                  select: {
                    id: true,
                    status: true,
                    token: true,
                    createdAt: true
                  }
                }
              },
              orderBy: {
                date: 'desc'
              }
            },
            medicalRecords: {
              include: {
                doctorPatient: {
                  include: {
                    doctor: {
                      include: {
                        user: {
                          select: {
                            firstName: true,
                            lastName: true,
                            email: true
                          }
                        }
                      }
                    }
                  }
                }
              },
              orderBy: {
                createdAt: 'desc'
              }
            },
            doctors: {
              include: {
                doctor: {
                  include: {
                    user: {
                      select: {
                        firstName: true,
                        lastName: true,
                        email: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      console.log(`❌ No se encontró usuario con email: ${email}`);
      return;
    }

    if (user.role !== 'PATIENT') {
      console.log(`⚠️  El usuario ${email} no es un paciente (rol: ${user.role})`);
      return;
    }

    if (!user.patientProfile) {
      console.log(`❌ El usuario ${email} no tiene perfil de paciente`);
      return;
    }

    const patient = user.patientProfile;
    console.log(`✅ Paciente encontrado:`);
    console.log(`   ID: ${patient.id}`);
    console.log(`   Nombre: ${patient.firstName} ${patient.lastName}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Teléfono: ${patient.phone || 'No registrado'}`);

    // Verificar appointments
    const appointments = patient.appointments || [];
    console.log(`\n📅 Appointments (Citas): ${appointments.length}`);
    
    if (appointments.length > 0) {
      console.log(`   ⚠️  El paciente TIENE ${appointments.length} cita(s) previa(s):`);
      appointments.forEach((apt, index) => {
        const doctorName = apt.doctor?.user 
          ? `${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`
          : 'Doctor no encontrado';
        const doctorEmail = apt.doctor?.user?.email || 'N/A';
        console.log(`\n   ${index + 1}. Cita ID: ${apt.id}`);
        console.log(`      Fecha: ${apt.date.toLocaleString('es-ES')}`);
        console.log(`      Estado: ${apt.status}`);
        console.log(`      Doctor: ${doctorName} (${doctorEmail})`);
        console.log(`      Notas: ${apt.notes || 'Sin notas'}`);
        if (apt.preConsultation) {
          console.log(`      Pre-consulta: SÍ (Status: ${apt.preConsultation.status}, Token: ${apt.preConsultation.token})`);
        } else {
          console.log(`      Pre-consulta: NO`);
        }
      });
    } else {
      console.log(`   ✅ El paciente NO tiene citas previas`);
    }

    // Verificar medicalRecords (consultas médicas)
    const medicalRecords = patient.medicalRecords || [];
    console.log(`\n🏥 Medical Records (Consultas médicas): ${medicalRecords.length}`);
    
    if (medicalRecords.length > 0) {
      console.log(`   ⚠️  El paciente TIENE ${medicalRecords.length} consulta(s) médica(s) previa(s):`);
      medicalRecords.forEach((record, index) => {
        const doctorName = record.doctorPatient?.doctor?.user
          ? `${record.doctorPatient.doctor.user.firstName} ${record.doctorPatient.doctor.user.lastName}`
          : 'Doctor no encontrado';
        const doctorEmail = record.doctorPatient?.doctor?.user?.email || 'N/A';
        console.log(`\n   ${index + 1}. Consulta ID: ${record.id}`);
        console.log(`      Fecha: ${record.createdAt.toLocaleString('es-ES')}`);
        console.log(`      Doctor: ${doctorName} (${doctorEmail})`);
        console.log(`      Motivo: ${record.reason || 'N/A'}`);
        console.log(`      Diagnóstico: ${record.diagnosis || 'N/A'}`);
      });
    } else {
      console.log(`   ✅ El paciente NO tiene consultas médicas previas`);
    }

    // Verificar doctores asociados
    const doctors = patient.doctors || [];
    console.log(`\n👨‍⚕️ Doctores asociados: ${doctors.length}`);
    if (doctors.length > 0) {
      doctors.forEach((dp, index) => {
        const doctorName = dp.doctor?.user
          ? `${dp.doctor.user.firstName} ${dp.doctor.user.lastName}`
          : 'Doctor no encontrado';
        const doctorEmail = dp.doctor?.user?.email || 'N/A';
        console.log(`   ${index + 1}. ${doctorName} (${doctorEmail})`);
      });
    }

    // Resumen final
    console.log(`\n📊 RESUMEN:`);
    console.log(`   Appointments: ${appointments.length}`);
    console.log(`   Medical Records: ${medicalRecords.length}`);
    console.log(`   Doctores asociados: ${doctors.length}`);
    
    if (appointments.length === 0 && medicalRecords.length === 0) {
      console.log(`\n✅ CONFIRMADO: El paciente ${email} NO tiene citas ni consultas previas`);
      console.log(`   Es seguro crear una pre-consulta para este paciente`);
    } else {
      console.log(`\n⚠️  ADVERTENCIA: El paciente ${email} TIENE historial previo`);
      console.log(`   No se creará pre-consulta automáticamente`);
    }

  } catch (error: any) {
    console.error(`❌ Error verificando paciente ${email}:`, error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

async function main() {
  const emails = process.argv.slice(2);
  
  if (emails.length === 0) {
    console.log('❌ Por favor proporciona al menos un email');
    console.log('Uso: npm run check:patient email1@example.com email2@example.com');
    process.exit(1);
  }

  console.log('🔍 Verificando pacientes...');
  console.log(`Emails a verificar: ${emails.join(', ')}`);

  for (const email of emails) {
    await checkPatientAppointments(email);
  }

  await prisma.$disconnect();
  console.log('\n✅ Verificación completada');
}

main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

