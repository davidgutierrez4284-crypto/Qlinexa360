const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('=== CREACIÓN DE USUARIO ADMINISTRADOR ===\n');

    const adminEmail = 'admin@qlinexa360.com';
    const adminPassword = 'AdminQlinexa3602024!'; // Contraseña segura por defecto
    const adminFirstName = 'Administrador';
    const adminLastName = 'Qlinexa360';

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
      include: { adminProfile: true }
    });

    if (existingUser) {
      console.log(`⚠️  Usuario ${adminEmail} ya existe.`);
      
      // Verificar si ya es ADMIN
      if (existingUser.role === UserRole.ADMIN) {
        console.log('✅ El usuario ya tiene rol ADMIN.');
        
        // Verificar si tiene perfil Admin
        if (existingUser.adminProfile) {
          console.log('✅ El usuario ya tiene perfil Admin.');
          console.log('\n🎉 Usuario administrador ya está configurado correctamente!');
          return;
        } else {
          // Crear perfil Admin si no existe
          console.log('📝 Creando perfil Admin...');
          await prisma.admin.create({
            data: {
              userId: existingUser.id
            }
          });
          console.log('✅ Perfil Admin creado exitosamente.');
          console.log('\n🎉 Usuario administrador actualizado correctamente!');
          return;
        }
      } else {
        // Actualizar rol a ADMIN
        console.log(`📝 Actualizando rol de ${existingUser.role} a ADMIN...`);
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            role: UserRole.ADMIN
          }
        });
        console.log('✅ Rol actualizado a ADMIN.');

        // Crear perfil Admin si no existe
        if (!existingUser.adminProfile) {
          console.log('📝 Creando perfil Admin...');
          await prisma.admin.create({
            data: {
              userId: existingUser.id
            }
          });
          console.log('✅ Perfil Admin creado exitosamente.');
        }

        console.log('\n🎉 Usuario actualizado a administrador correctamente!');
        console.log(`\n📧 Email: ${adminEmail}`);
        console.log('🔑 La contraseña no ha sido modificada. Si necesitas cambiarla, usa el endpoint de reset de contraseña.');
        return;
      }
    }

    // Crear nuevo usuario ADMIN
    console.log('📝 Creando nuevo usuario administrador...');

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: UserRole.ADMIN
      }
    });

    console.log('✅ Usuario creado exitosamente.');

    // Crear perfil Admin
    console.log('📝 Creando perfil Admin...');
    await prisma.admin.create({
      data: {
        userId: user.id
      }
    });

    console.log('✅ Perfil Admin creado exitosamente.');

    console.log('\n🎉 Usuario administrador creado exitosamente!');
    console.log('\n📋 Credenciales:');
    console.log(`   📧 Email: ${adminEmail}`);
    console.log(`   🔑 Password: ${adminPassword}`);
    console.log('\n⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión.');
    console.log('   Esta contraseña es la misma para todos los ambientes (desarrollo, producción, etc.).');

  } catch (error) {
    console.error('❌ Error al crear usuario administrador:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
createAdmin()
  .then(() => {
    console.log('\n✅ Script completado exitosamente.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  });

