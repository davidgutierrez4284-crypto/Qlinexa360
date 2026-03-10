const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPatientView() {
  try {
    // Buscar el paciente
    const patient = await prisma.patient.findFirst({
      where: { user: { email: 'new.test.patient@example.com' } },
      include: { 
        user: true,
        clinicalCases: {
          include: {
            medicalRecords: {
              orderBy: { createdAt: 'desc' }
            },
            colaboradores: {
              include: {
                doctor: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        },
        doctors: {
          include: {
            doctor: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });
    
    if (!patient) {
      console.log('❌ Paciente no encontrado');
      return;
    }
    
    console.log('✅ Paciente encontrado:', patient.user.firstName, patient.user.lastName);
    console.log('📧 Email:', patient.user.email);
    console.log('🆔 Patient ID:', patient.id);
    console.log('🆔 User ID:', patient.userId);
    
    console.log('\n👥 Doctores asociados:', patient.doctors.length);
    patient.doctors.forEach((doctorLink, index) => {
      console.log(`  ${index + 1}. Dr. ${doctorLink.doctor.user.firstName} ${doctorLink.doctor.user.lastName}`);
      console.log(`     ID: ${doctorLink.doctor.id}`);
      console.log(`     Especialidad: ${doctorLink.doctor.specialization}`);
    });
    
    console.log('\n🏥 Casos clínicos:', patient.clinicalCases.length);
    patient.clinicalCases.forEach((clinicalCase, index) => {
      console.log(`\n  --- Caso Clínico ${index + 1} ---`);
      console.log(`  ID: ${clinicalCase.id}`);
      console.log(`  Padecimiento: ${clinicalCase.padecimiento}`);
      console.log(`  Fecha de inicio: ${clinicalCase.createdAt.toLocaleDateString('es-ES')}`);
      
      console.log(`  👨‍⚕️ Colaboradores: ${clinicalCase.colaboradores.length}`);
      clinicalCase.colaboradores.forEach((colab, colabIndex) => {
        console.log(`    ${colabIndex + 1}. Dr. ${colab.doctor.user.firstName} ${colab.doctor.user.lastName} (${colab.rol})`);
      });
      
      console.log(`  📋 Consultas: ${clinicalCase.medicalRecords.length}`);
      clinicalCase.medicalRecords.forEach((consultation, consultIndex) => {
        console.log(`    ${consultIndex + 1}. Consulta ${consultation.id}`);
        console.log(`       Fecha: ${consultation.createdAt.toLocaleDateString('es-ES')}`);
        console.log(`       ¿Es pública? ${consultation.isPublic ? '✅ SÍ' : '❌ NO'}`);
        console.log(`       Diagnóstico: ${consultation.diagnosis?.substring(0, 50)}...`);
        console.log(`       Notas: ${consultation.notes?.substring(0, 50)}...`);
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPatientView();
