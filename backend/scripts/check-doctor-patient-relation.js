const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDoctorPatientRelation() {
  try {
    console.log('=== VERIFICANDO RELACIÓN DOCTOR-PACIENTE ===\n');

    // Buscar doctor3@test.com
    const doctor3 = await prisma.user.findUnique({
      where: { email: 'doctor3@test.com' },
      include: {
        doctorProfile: true
      }
    });

    if (!doctor3) {
      console.log('❌ doctor3@test.com no encontrado');
      return;
    }

    console.log('👨‍⚕️ Doctor3:', `${doctor3.firstName} ${doctor3.lastName} (ID: ${doctor3.doctorProfile.id})`);

    // Buscar paciente@test.com
    const paciente = await prisma.user.findUnique({
      where: { email: 'paciente@test.com' },
      include: {
        patientProfile: true
      }
    });

    if (!paciente) {
      console.log('❌ paciente@test.com no encontrado');
      return;
    }

    console.log('👤 Paciente:', `${paciente.firstName} ${paciente.lastName} (ID: ${paciente.patientProfile.id})`);

    // Verificar si existe una relación DoctorPatient entre doctor3 y paciente@test.com
    const doctorPatientRelation = await prisma.doctorPatient.findUnique({
      where: {
        doctorId_patientId: {
          doctorId: doctor3.doctorProfile.id,
          patientId: paciente.patientProfile.id
        }
      }
    });

    console.log('\n🔍 RELACIÓN DOCTOR-PACIENTE:');
    if (doctorPatientRelation) {
      console.log('❌ PROBLEMA ENCONTRADO:');
      console.log('   Existe una relación DoctorPatient entre doctor3 y paciente@test.com');
      console.log('   Esta relación hace que el paciente aparezca como "titular"');
      console.log('   Relación:', doctorPatientRelation);
      
      // Verificar todas las relaciones DoctorPatient del paciente
      const allPatientRelations = await prisma.doctorPatient.findMany({
        where: {
          patientId: paciente.patientProfile.id
        },
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
      });

      console.log('\n📋 TODAS LAS RELACIONES DEL PACIENTE:');
      allPatientRelations.forEach((relation, index) => {
        console.log(`   ${index + 1}: Doctor ${relation.doctor.user.firstName} ${relation.doctor.user.lastName} (${relation.doctor.user.email})`);
        console.log(`      ID: ${relation.doctorId}`);
        console.log(`      Status: ${relation.status}`);
        console.log(`      Start Date: ${relation.startDate}`);
      });

    } else {
      console.log('✅ No existe relación DoctorPatient entre doctor3 y paciente@test.com');
    }

    // Verificar colaboraciones
    const collaborations = await prisma.padecimientoDoctorColaborador.findMany({
      where: {
        doctorId: doctor3.doctorProfile.id,
        patientId: paciente.patientProfile.id
      },
      include: {
        clinicalCase: true
      }
    });

    console.log('\n🔍 COLABORACIONES:');
    if (collaborations.length > 0) {
      console.log('✅ Colaboraciones encontradas:');
      collaborations.forEach((collab, index) => {
        console.log(`   ${index + 1}: Caso clínico "${collab.clinicalCase.padecimiento}"`);
        console.log(`      Clinical Case ID: ${collab.clinicalCaseId}`);
      });
    } else {
      console.log('❌ No se encontraron colaboraciones');
    }

    console.log('\n✅ VERIFICACIÓN COMPLETADA');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDoctorPatientRelation();
