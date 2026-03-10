const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPatientDataSimple() {
  try {
    console.log('=== VERIFICANDO DATOS DEL PACIENTE (SIMPLIFICADO) ===\n');

    const email = 'new.test.patient@example.com';

    // Buscar al usuario paciente
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        patientProfile: true
      }
    });

    if (!user) {
      console.log(`❌ No se encontró usuario con email: ${email}`);
      return;
    }

    console.log(`✅ Usuario encontrado:`);
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Nombre: ${user.firstName} ${user.lastName}`);
    console.log(`Rol: ${user.role}`);
    console.log(`Tiene perfil de paciente: ${user.patientProfile ? 'SÍ' : 'NO'}`);

    if (user.patientProfile) {
      console.log(`\n📋 Perfil de Paciente:`);
      console.log(`ID: ${user.patientProfile.id}`);
      console.log(`Creado: ${user.patientProfile.createdAt}`);
    }

    // Verificar doctores vinculados
    console.log('\n👨‍⚕️ DOCTORES VINCULADOS:');
    const doctorPatients = await prisma.doctorPatient.findMany({
      where: {
        patientId: user.patientProfile.id
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

    console.log(`Total de doctores vinculados: ${doctorPatients.length}`);
    doctorPatients.forEach((dp, index) => {
      console.log(`\n--- Doctor ${index + 1} ---`);
      console.log(`Doctor: ${dp.doctor.user.firstName} ${dp.doctor.user.lastName}`);
      console.log(`Email: ${dp.doctor.user.email}`);
      console.log(`Especialidad: ${dp.specialization || 'No especificada'}`);
      console.log(`Estado: ${dp.status}`);
      console.log(`Contexto: ${dp.context}`);
      console.log(`Fecha de vínculo: ${dp.createdAt}`);
    });

    // Verificar casos clínicos (sin includes complejos)
    console.log('\n📋 CASOS CLÍNICOS:');
    const clinicalCases = await prisma.clinicalCase.findMany({
      where: {
        patientId: user.patientProfile.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Total de casos clínicos: ${clinicalCases.length}`);
    clinicalCases.forEach((case_, index) => {
      console.log(`\n--- Caso ${index + 1} ---`);
      console.log(`ID: ${case_.id}`);
      console.log(`Padecimiento: ${case_.padecimiento}`);
      console.log(`Estado: ${case_.status}`);
      console.log(`Creado: ${case_.createdAt}`);
    });

    // Verificar consultas (sin includes complejos)
    console.log('\n🏥 CONSULTAS:');
    const consultations = await prisma.consultation.findMany({
      where: {
        patientId: user.patientProfile.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Total de consultas: ${consultations.length}`);
    consultations.forEach((consultation, index) => {
      console.log(`\n--- Consulta ${index + 1} ---`);
      console.log(`ID: ${consultation.id}`);
      console.log(`Nota pública: ${consultation.isPublicNote ? 'SÍ' : 'NO'}`);
      console.log(`Creada: ${consultation.createdAt}`);
    });

  } catch (error) {
    console.error('Error verificando datos del paciente:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPatientDataSimple();
