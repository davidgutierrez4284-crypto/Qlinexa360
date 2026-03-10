const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDoctors() {
  try {
    console.log('=== VERIFICANDO DOCTORES EN LA BASE DE DATOS ===');
    
    const doctors = await prisma.doctor.findMany({
      include: {
        user: true
      }
    });
    
    console.log(`Total de doctores encontrados: ${doctors.length}`);
    
    doctors.forEach((doctor, index) => {
      console.log(`\nDoctor ${index + 1}:`);
      console.log(`  ID: ${doctor.id}`);
      console.log(`  User ID: ${doctor.userId}`);
      console.log(`  Nombre: ${doctor.user.firstName} ${doctor.user.lastName}`);
      console.log(`  Email: ${doctor.user.email}`);
      console.log(`  Role: ${doctor.user.role}`);
      console.log(`  Especialización: ${doctor.specialization || 'No especificada'}`);
    });
    
    // Verificar específicamente el doctor que está causando problemas
    const specificDoctorId = '776207d3-0578-4635-a13f-16adecf7c404';
    console.log(`\n=== BUSCANDO DOCTOR ESPECÍFICO ===`);
    console.log(`Buscando doctor con ID: ${specificDoctorId}`);
    
    const specificDoctor = await prisma.doctor.findUnique({
      where: { id: specificDoctorId },
      include: { user: true }
    });
    
    if (specificDoctor) {
      console.log('✅ Doctor encontrado:');
      console.log(`  ID: ${specificDoctor.id}`);
      console.log(`  Nombre: ${specificDoctor.user.firstName} ${specificDoctor.user.lastName}`);
      console.log(`  Email: ${specificDoctor.user.email}`);
    } else {
      console.log('❌ Doctor NO encontrado');
    }
    
  } catch (error) {
    console.error('Error al verificar doctores:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDoctors();
