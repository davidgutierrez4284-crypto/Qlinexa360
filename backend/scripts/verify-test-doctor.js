const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function verifyTestDoctor() {
  try {
    const email = 'test.doctor1@medilink360.com';
    const password = 'password123';
    
    console.log('🔍 Verificando usuario:', email);
    
    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email },
      include: { doctorProfile: true }
    });

    if (!user) {
      console.log('❌ Usuario NO existe en la base de datos');
      console.log('   Solución: Ejecuta el script create-test-users-safe.js para crearlo');
      return;
    }

    console.log('✅ Usuario encontrado:');
    console.log('   ID:', user.id);
    console.log('   Nombre:', `${user.firstName} ${user.lastName}`);
    console.log('   Rol:', user.role);

    // Verificar perfil de doctor
    if (!user.doctorProfile) {
      console.log('\n❌ PROBLEMA: Usuario NO tiene perfil de doctor');
      console.log('   Esto causará problemas en el login');
      console.log('   Solución: El usuario debe tener un perfil de doctor asociado');
    } else {
      console.log('\n✅ Perfil de doctor encontrado:');
      console.log('   Doctor ID:', user.doctorProfile.id);
      console.log('   Especialidad:', user.doctorProfile.specialization);
    }

    // Verificar contraseña
    const isValid = await bcrypt.compare(password, user.password);
    if (isValid) {
      console.log('\n✅ Contraseña correcta');
    } else {
      console.log('\n❌ PROBLEMA: La contraseña no coincide');
      console.log('   La contraseña almacenada no es "password123"');
    }

    console.log('\n📋 Resumen:');
    console.log('   Usuario existe:', '✅');
    console.log('   Tiene perfil de doctor:', user.doctorProfile ? '✅' : '❌');
    console.log('   Contraseña correcta:', isValid ? '✅' : '❌');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTestDoctor();

