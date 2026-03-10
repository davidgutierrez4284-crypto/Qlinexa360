const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/**
 * Script para verificar y recrear el usuario Dr. María García
 * si fue eliminado durante alguna migración
 */

async function checkAndRecreateDrGarcia() {
  try {
    console.log('🔍 Verificando usuario Dr. María García...\n');

    const email = 'dr.garcia@test.com';
    
    // Verificar si el usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { doctorProfile: true }
    });

    if (existingUser) {
      console.log('✅ Usuario encontrado:');
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Nombre: ${existingUser.firstName} ${existingUser.lastName}`);
      console.log(`   Rol: ${existingUser.role}`);
      
      if (existingUser.doctorProfile) {
        console.log(`   ✅ Perfil de doctor: ${existingUser.doctorProfile.specialization}`);
        console.log(`   Doctor ID: ${existingUser.doctorProfile.id}`);
      } else {
        console.log('   ⚠️  Usuario existe pero NO tiene perfil de doctor');
        console.log('   Esto puede causar errores en el login.');
      }
      
      // Verificar contraseña
      console.log('\n🔑 Para verificar la contraseña, intenta hacer login con:');
      console.log('   - password123 (si se usó seed-test-users.js)');
      console.log('   - Test123! (si se usó migrate-test-users.js)');
      
    } else {
      console.log('❌ Usuario NO encontrado. Creando usuario...\n');
      
      // Crear usuario con contraseña password123 (estándar de seed-test-users.js)
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const newUser = await prisma.user.create({
        data: {
          email: email,
          password: hashedPassword,
          firstName: 'Dr. María',
          lastName: 'García',
          role: 'DOCTOR'
        }
      });

      console.log(`✅ Usuario creado: ${newUser.email} (ID: ${newUser.id})`);

      // Crear perfil de doctor
      const doctor = await prisma.doctor.create({
        data: {
          userId: newUser.id,
          specialization: 'Cardiología',
          licenseNumber: 'CARD-001-2024',
          officeAddress: 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX',
          officePhone: '+52 55 1234 5678',
          professionalTitle: 'Cardiólogo',
          taxId: 'CARD001001',
          taxName: 'Dr. María García',
          taxAddress: 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX',
          taxCertificateUrl: 'https://example.com/cert.pdf',
          dataConsent: true,
          termsAccepted: true,
          termsAcceptedAt: new Date(),
          accessType: 'PREMIUM'
        }
      });

      console.log(`✅ Perfil de doctor creado: ${doctor.id}`);
      console.log(`   Especialidad: ${doctor.specialization}`);

      // Crear suscripción activa
      const subscription = await prisma.subscription.create({
        data: {
          doctorId: doctor.id,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          paypalSubscriptionId: 'test_sub_001',
          paypalPlanId: 'plan_premium_001'
        }
      });

      console.log(`✅ Suscripción activa creada: ${subscription.id}`);

      console.log('\n🎉 Usuario recreado exitosamente!');
      console.log('\n📋 Credenciales de acceso:');
      console.log(`   Email: ${email}`);
      console.log(`   Contraseña: password123`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
checkAndRecreateDrGarcia();

