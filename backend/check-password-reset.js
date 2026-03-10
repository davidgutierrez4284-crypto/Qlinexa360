const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPasswordReset() {
  try {
    console.log('=== VERIFICANDO TOKENS DE RESTABLECIMIENTO ===\n');

    const email = 'new.test.patient@example.com';

    // Buscar al usuario
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user) {
      console.log(`❌ No se encontró usuario con email: ${email}`);
      return;
    }

    console.log(`✅ Usuario encontrado: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`ID: ${user.id}\n`);

    // Buscar tokens de restablecimiento de contraseña
    const resetTokens = await prisma.passwordResetToken.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Total de tokens de restablecimiento: ${resetTokens.length}\n`);

    if (resetTokens.length === 0) {
      console.log('❌ No se encontraron tokens de restablecimiento de contraseña');
      console.log('El usuario NO ha solicitado restablecer su contraseña\n');
      
      console.log('💡 Para generar un token de restablecimiento:');
      console.log('1. Ve a la página de "Olvidé mi contraseña"');
      console.log('2. Ingresa el email: new.test.patient@example.com');
      console.log('3. Se enviará un enlace por email (pero apuntará a producción)');
      console.log('4. Necesitaremos generar la URL de desarrollo manualmente');
      
      return;
    }

    resetTokens.forEach((token, index) => {
      console.log(`--- Token ${index + 1} ---`);
      console.log(`ID: ${token.id}`);
      console.log(`Token: ${token.token.substring(0, 20)}...`);
      console.log(`Creado: ${token.createdAt}`);
      console.log(`Expira: ${token.expiresAt}`);
      console.log(`¿Expirado?: ${new Date() > token.expiresAt ? 'SÍ' : 'NO'}`);
      console.log('');
    });

    // Mostrar URL de desarrollo (si el token no ha expirado)
    const validToken = resetTokens.find(token => new Date() < token.expiresAt);
    
    if (validToken) {
      console.log('🔗 URL de restablecimiento para DESARROLLO:');
      console.log(`http://localhost:5173/reset-password?token=${validToken.token}&email=${encodeURIComponent(email)}`);
    } else {
      console.log('❌ Todos los tokens han expirado');
      console.log('Necesitas solicitar un nuevo restablecimiento de contraseña');
    }

  } catch (error) {
    console.error('Error verificando tokens de restablecimiento:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPasswordReset();
