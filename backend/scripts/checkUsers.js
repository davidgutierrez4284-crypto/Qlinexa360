const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('=== VERIFICANDO USUARIOS EN LA BASE DE DATOS ===');
    
    // Verificar usuarios en tabla User
    const users = await prisma.user.findMany();
    console.log('\n📋 Usuarios en tabla User:');
    users.forEach(user => {
      console.log(`- ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Nombre: ${user.firstName} ${user.lastName}`);
      console.log('---');
    });
    
    // Verificar doctores en tabla Doctor
    const doctors = await prisma.doctor.findMany({
      include: {
        user: true
      }
    });
    console.log('\n👨‍⚕️ Doctores en tabla Doctor:');
    doctors.forEach(doctor => {
      console.log(`- ID: ${doctor.id}`);
      console.log(`  User ID: ${doctor.userId}`);
      console.log(`  Email: ${doctor.user.email}`);
      console.log(`  Nombre: ${doctor.user.firstName} ${doctor.user.lastName}`);
      console.log(`  Especialización: ${doctor.specialization}`);
      console.log('---');
    });
    
    // Buscar específicamente el usuario que está intentando autenticarse
    const targetUserId = '0f0ef7e6-11ef-466c-b404-15914b22381e';
    console.log(`\n🔍 Buscando usuario específico: ${targetUserId}`);
    
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });
    
    if (targetUser) {
      console.log('✅ Usuario encontrado en tabla User:');
      console.log(`- Email: ${targetUser.email}`);
      console.log(`- Role: ${targetUser.role}`);
      console.log(`- Nombre: ${targetUser.firstName} ${targetUser.lastName}`);
    } else {
      console.log('❌ Usuario NO encontrado en tabla User');
    }
    
    const targetDoctor = await prisma.doctor.findUnique({
      where: { userId: targetUserId },
      include: { user: true }
    });
    
    if (targetDoctor) {
      console.log('✅ Doctor encontrado en tabla Doctor:');
      console.log(`- ID: ${targetDoctor.id}`);
      console.log(`- Especialización: ${targetDoctor.specialization}`);
    } else {
      console.log('❌ Doctor NO encontrado en tabla Doctor');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers(); 