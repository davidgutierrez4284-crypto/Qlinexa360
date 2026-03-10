const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAssistants() {
  try {
    console.log('Creando usuarios asistentes de prueba...');

    const assistants = [
      {
        email: 'asistente1@qlinexa360.com',
        password: 'password123',
        firstName: 'María',
        lastName: 'González',
        role: 'ASISTENTE'
      },
      {
        email: 'asistente2@qlinexa360.com',
        password: 'password123',
        firstName: 'Carlos',
        lastName: 'Rodríguez',
        role: 'ASISTENTE'
      },
      {
        email: 'asistente3@qlinexa360.com',
        password: 'password123',
        firstName: 'Ana',
        lastName: 'Martínez',
        role: 'ASISTENTE'
      }
    ];

    for (const assistant of assistants) {
      // Verificar si el usuario ya existe
      const existingUser = await prisma.user.findUnique({
        where: { email: assistant.email }
      });

      if (existingUser) {
        console.log(`Usuario ${assistant.email} ya existe, saltando...`);
        continue;
      }

      // Encriptar contraseña
      const hashedPassword = await bcrypt.hash(assistant.password, 10);

      // Crear usuario
      const user = await prisma.user.create({
        data: {
          email: assistant.email,
          password: hashedPassword,
          firstName: assistant.firstName,
          lastName: assistant.lastName,
          role: assistant.role
        }
      });

      console.log(`✅ Asistente creado: ${assistant.firstName} ${assistant.lastName} (${assistant.email})`);
    }

    console.log('\n🎉 Usuarios asistentes creados exitosamente!');
    console.log('\nCredenciales de prueba:');
    console.log('Email: asistente1@qlinexa360.com | Password: password123');
    console.log('Email: asistente2@qlinexa360.com | Password: password123');
    console.log('Email: asistente3@qlinexa360.com | Password: password123');

  } catch (error) {
    console.error('Error creando asistentes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAssistants(); 