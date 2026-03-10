const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createDoctor() {
  try {
    // Primero, crear el usuario si no existe
    const passwordHash = await bcrypt.hash('qwerty123', 10);
    
    const userId = '0f0ef7e6-11ef-466c-b404-15914b22381e';
    
    // Crear usuario
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: 'doctor@test.com',
        password: passwordHash,
        role: 'DOCTOR',
        firstName: 'David',
        lastName: 'Gutierrez',
      },
    });
    
    console.log('Usuario creado/actualizado:', user);
    
    // Crear doctor
    const doctor = await prisma.doctor.upsert({
      where: { userId: userId },
      update: {},
      create: {
        userId: userId,
        licenseNumber: 'LIC123456',
        specialization: 'Medicina General',
        officeAddress: 'Calle Test 123',
        officePhone: '555-1234',
        professionalTitle: 'Dr.',
        taxId: 'TAX123456',
        taxName: 'David Gutierrez',
        taxAddress: 'Calle Test 123',
        taxCertificateUrl: 'https://example.com/cert.pdf',
        dataConsent: true,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
        accessType: 'FULL',
      },
    });
    
    console.log('Doctor creado/actualizado:', doctor);
    
    console.log('✅ Usuario y Doctor creados exitosamente');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDoctor(); 