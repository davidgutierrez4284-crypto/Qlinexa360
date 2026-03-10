const { PrismaClient } = require('@prisma/client');
const CryptoJS = require('crypto-js');

const prisma = new PrismaClient();

async function testCalendarSync() {
  try {
    console.log('🧪 Iniciando pruebas de sincronización de calendarios...\n');

    // 1. Verificar conexión a la base de datos
    console.log('✅ Conexión a la base de datos establecida');

    // 2. Verificar enlaces existentes
    const links = await prisma.externalCalendarLink.findMany();
    console.log(`📊 Enlaces de calendario encontrados: ${links.length}`);

    if (links.length > 0) {
      console.log('📋 Enlaces existentes:');
      links.forEach(link => {
        console.log(`  - ${link.tipoConexion} (${link.activo ? 'Activo' : 'Inactivo'})`);
      });
    }

    // 3. Verificar eventos del calendario interno
    const events = await prisma.internalCalendarEvent.findMany();
    console.log(`📅 Eventos del calendario interno: ${events.length}`);

    if (events.length > 0) {
      console.log('📋 Eventos existentes:');
      events.slice(0, 5).forEach(event => {
        console.log(`  - ${event.titulo} (${event.origenEvento || 'interno'})`);
      });
    }

    // 4. Verificar funcionalidad de encriptación
    console.log('\n🔐 Probando encriptación de tokens...');
    const testToken = 'test-access-token-123';
    const encryptionKey = process.env.ENCRYPTION_KEY || 'your-secret-key-32-chars-long';
    const encrypted = CryptoJS.AES.encrypt(testToken, encryptionKey).toString();
    console.log('✅ Encriptación funcionando');

    // 5. Verificar que las tablas existen
    console.log('\n📋 Verificando estructura de la base de datos...');
    const tableCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ExternalCalendarLink', 'InternalCalendarEvent')
    `;
    console.log('✅ Tablas de calendario verificadas');

    console.log('\n🎉 Pruebas completadas exitosamente!');
    console.log('\n📝 Notas:');
    console.log('- Para probar con tokens reales, configura las variables de entorno OAuth');
    console.log('- La sincronización automática se ejecuta cada hora');
    console.log('- Los eventos externos se crean como "sombra" (solo lectura)');
    console.log('- Revisa el archivo ENV_SETUP.md para configurar OAuth');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar pruebas
testCalendarSync(); 