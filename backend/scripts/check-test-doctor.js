const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/**
 * Script para verificar el usuario de prueba test.doctor1@medilink360.com
 */

async function checkTestDoctor() {
  try {
    console.log('🔍 Verificando usuario test.doctor1@medilink360.com...\n');

    const email = 'test.doctor1@medilink360.com';
    
    // Verificar si el usuario existe
    const user = await prisma.user.findUnique({
      where: { email },
      include: { doctorProfile: true }
    });

    if (!user) {
      console.log('❌ Usuario NO encontrado');
      console.log('   El usuario no existe en la base de datos.');
      return;
    }

    console.log('✅ Usuario encontrado:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nombre: ${user.firstName} ${user.lastName}`);
    console.log(`   Rol: ${user.role}`);
    console.log(`   Contraseña (hash): ${user.password.substring(0, 20)}...`);

    // Verificar perfil de doctor
    if (user.doctorProfile) {
      console.log('\n✅ Perfil de doctor encontrado:');
      console.log(`   Doctor ID: ${user.doctorProfile.id}`);
      console.log(`   Especialidad: ${user.doctorProfile.specialization}`);
      console.log(`   Licencia: ${user.doctorProfile.licenseNumber}`);
    } else {
      console.log('\n❌ NO tiene perfil de doctor');
      console.log('   Este es el problema! El usuario existe pero no tiene perfil de doctor.');
      console.log('   Esto causará un error 500 en el login.');
    }

    // Verificar suscripción
    if (user.doctorProfile) {
      const subscription = await prisma.subscription.findFirst({
        where: { doctorId: user.doctorProfile.id }
      });

      if (subscription) {
        console.log('\n✅ Suscripción encontrada:');
        console.log(`   Status: ${subscription.status}`);
      } else {
        console.log('\n⚠️  No tiene suscripción (no crítico para login)');
      }
    }

    // Probar contraseña
    console.log('\n🔑 Verificando contraseña...');
    const testPassword = 'password123';
    const isValid = await bcrypt.compare(testPassword, user.password);
    
    if (isValid) {
      console.log('✅ Contraseña correcta');
    } else {
      console.log('❌ Contraseña incorrecta');
      console.log('   La contraseña almacenada no coincide con "password123"');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
checkTestDoctor();

