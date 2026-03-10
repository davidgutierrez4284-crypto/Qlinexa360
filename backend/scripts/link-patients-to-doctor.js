const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Script para vincular pacientes de prueba con un doctor específico
 * 
 * Uso: node backend/scripts/link-patients-to-doctor.js [doctorEmail]
 * Si no se proporciona doctorEmail, vinculará todos los pacientes con el primer doctor encontrado
 */

async function linkPatientsToDoctor(doctorEmail = null) {
  try {
    console.log('🔗 Vinculando pacientes con doctor...\n');

    // Buscar el doctor
    let doctor;
    let doctorUser;
    
    if (doctorEmail) {
      const user = await prisma.user.findUnique({
        where: { email: doctorEmail },
        include: { doctorProfile: true }
      });

      if (!user || !user.doctorProfile) {
        throw new Error(`No se encontró un doctor con el email: ${doctorEmail}`);
      }

      doctor = user.doctorProfile;
      doctorUser = user;
    } else {
      // Buscar el primer doctor disponible
      doctor = await prisma.doctor.findFirst({
        include: { user: true }
      });

      if (!doctor) {
        throw new Error('No se encontró ningún doctor en la base de datos');
      }

      doctorUser = doctor.user;
    }

    console.log(`✅ Doctor encontrado: ${doctorUser.firstName} ${doctorUser.lastName} (${doctorUser.email})`);
    console.log(`   Especialidad: ${doctor.specialization}\n`);

    // Buscar todos los pacientes de prueba (emails que empiezan con test.paciente)
    // Primero obtenemos los usuarios con ese patrón de email
    const patientUsers = await prisma.user.findMany({
      where: {
        email: {
          startsWith: 'test.paciente'
        },
        role: 'PATIENT'
      }
    });

    // Obtener los perfiles de paciente y verificar sus vínculos
    const patients = [];
    for (const user of patientUsers) {
      // Buscar el perfil de paciente asociado
      const patientProfile = await prisma.patient.findUnique({
        where: { userId: user.id }
      });

      if (patientProfile) {
        // Verificar si ya está vinculado con este doctor
        const existingLink = await prisma.doctorPatient.findUnique({
          where: {
            doctorId_patientId: {
              doctorId: doctor.id,
              patientId: patientProfile.id
            }
          }
        });

        patients.push({
          ...patientProfile,
          user: user,
          isLinked: !!existingLink
        });
      }
    }

    if (patients.length === 0) {
      console.log('⚠️  No se encontraron pacientes de prueba para vincular');
      console.log('   Buscando pacientes con email que empiece con "test.paciente"');
      return;
    }

    console.log(`📋 Encontrados ${patients.length} pacientes de prueba:\n`);

    let linkedCount = 0;
    let skippedCount = 0;

    for (const patient of patients) {
      // Verificar si ya está vinculado
      if (patient.isLinked) {
        console.log(`⚠️  ${patient.user.firstName} ${patient.user.lastName} (${patient.user.email}) - Ya está vinculado`);
        skippedCount++;
        continue;
      }

      // Crear vínculo
      try {
        await prisma.doctorPatient.create({
          data: {
            doctorId: doctor.id,
            patientId: patient.id,
            status: 'ACTIVE',
            specialization: doctor.specialization || 'Medicina General',
            context: 'Paciente de prueba - Vinculado automáticamente',
            startDate: new Date()
          }
        });

        console.log(`✅ ${patient.user.firstName} ${patient.user.lastName} (${patient.user.email}) - Vinculado`);
        linkedCount++;
      } catch (error) {
        console.error(`❌ Error al vincular ${patient.user.firstName} ${patient.user.lastName}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN:');
    console.log(`   Pacientes vinculados: ${linkedCount}`);
    console.log(`   Pacientes omitidos (ya vinculados): ${skippedCount}`);
    console.log(`   Total procesados: ${patients.length}`);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Obtener el email del doctor desde los argumentos de la línea de comandos
const doctorEmail = process.argv[2] || null;

// Ejecutar el script
linkPatientsToDoctor(doctorEmail)
  .then(() => {
    console.log('✅ Proceso completado exitosamente!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  });

