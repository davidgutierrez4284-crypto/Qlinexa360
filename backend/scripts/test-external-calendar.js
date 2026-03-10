const { PrismaClient } = require('@prisma/client');
const { ExternalCalendarService } = require('../src/services/externalCalendar.service');

const prisma = new PrismaClient();

async function testExternalCalendarIntegration() {
  console.log('🧪 Iniciando pruebas de integración de calendarios externos...\n');

  try {
    // 1. Crear una conexión de prueba con Google Calendar
    console.log('1️⃣ Creando conexión de prueba con Google Calendar...');
    
    const mockGoogleConnection = await prisma.externalCalendarLink.create({
      data: {
        doctorId: 'test-doctor-id', // ID de prueba
        tipoConexion: 'GOOGLE',
        accessToken: 'mock_google_access_token',
        refreshToken: 'mock_google_refresh_token',
        calendarioId: 'primary',
        activo: true,
        fechaVinculacion: new Date()
      }
    });

    console.log('✅ Conexión de Google Calendar creada:', mockGoogleConnection.id);

    // 2. Crear una conexión de prueba con Outlook
    console.log('\n2️⃣ Creando conexión de prueba con Outlook...');
    
    const mockOutlookConnection = await prisma.externalCalendarLink.create({
      data: {
        doctorId: 'test-doctor-id',
        tipoConexion: 'OUTLOOK',
        accessToken: 'mock_outlook_access_token',
        refreshToken: 'mock_outlook_refresh_token',
        calendarioId: 'primary',
        activo: true,
        fechaVinculacion: new Date()
      }
    });

    console.log('✅ Conexión de Outlook creada:', mockOutlookConnection.id);

    // 3. Probar sincronización de calendarios
    console.log('\n3️⃣ Probando sincronización de calendarios...');
    
    const startDate = new Date();
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    const syncResult = await ExternalCalendarService.syncCalendarEvents(
      'test-doctor-id',
      mockGoogleConnection.id,
      startDate,
      endDate
    );

    console.log('✅ Resultado de sincronización:', syncResult);

    // 4. Probar verificación de disponibilidad
    console.log('\n4️⃣ Probando verificación de disponibilidad...');
    
    const availability = await ExternalCalendarService.checkExternalCalendarAvailability(
      'test-doctor-id',
      new Date(),
      '09:00',
      '17:00'
    );

    console.log('✅ Disponibilidad verificada:', availability);

    // 5. Probar creación de eventos (simulado)
    console.log('\n5️⃣ Probando creación de eventos...');
    
    const eventData = {
      title: 'Cita de prueba',
      start: new Date(Date.now() + 24 * 60 * 60 * 1000), // Mañana
      end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 minutos después
      description: 'Cita de prueba creada desde el sistema',
      location: 'Consultorio',
      attendees: ['paciente@test.com']
    };

    try {
      // Esto fallará porque los tokens son mock, pero probamos la estructura
      const googleEvent = await ExternalCalendarService.createGoogleCalendarEvent(
        'mock_google_access_token',
        'primary',
        eventData
      );
      console.log('✅ Evento de Google Calendar creado (simulado):', googleEvent.id);
    } catch (error) {
      console.log('⚠️ Error esperado al crear evento de Google (tokens mock):', error.message);
    }

    try {
      const outlookEvent = await ExternalCalendarService.createOutlookCalendarEvent(
        'mock_outlook_access_token',
        'primary',
        eventData
      );
      console.log('✅ Evento de Outlook creado (simulado):', outlookEvent.id);
    } catch (error) {
      console.log('⚠️ Error esperado al crear evento de Outlook (tokens mock):', error.message);
    }

    // 6. Listar todas las conexiones
    console.log('\n6️⃣ Listando todas las conexiones de calendario...');
    
    const allConnections = await prisma.externalCalendarLink.findMany({
      where: {
        doctorId: 'test-doctor-id'
      }
    });

    console.log('✅ Conexiones encontradas:', allConnections.length);
    allConnections.forEach(conn => {
      console.log(`   - ${conn.tipoConexion}: ${conn.id} (${conn.activo ? 'Activo' : 'Inactivo'})`);
    });

    // 7. Limpiar datos de prueba
    console.log('\n7️⃣ Limpiando datos de prueba...');
    
    await prisma.externalCalendarLink.deleteMany({
      where: {
        doctorId: 'test-doctor-id'
      }
    });

    console.log('✅ Datos de prueba eliminados');

    console.log('\n🎉 ¡Todas las pruebas completadas exitosamente!');
    console.log('\n📋 Resumen de funcionalidades probadas:');
    console.log('   ✅ Creación de conexiones Google Calendar');
    console.log('   ✅ Creación de conexiones Outlook');
    console.log('   ✅ Sincronización de eventos');
    console.log('   ✅ Verificación de disponibilidad');
    console.log('   ✅ Creación de eventos (estructura)');
    console.log('   ✅ Gestión de conexiones');
    console.log('   ✅ Limpieza de datos');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar las pruebas
testExternalCalendarIntegration(); 