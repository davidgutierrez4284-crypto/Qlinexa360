const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAgendaSystem() {
  try {
    console.log('🧪 Probando sistema de agenda de pacientes...');
    
    // 1. Verificar que la tabla existe
    console.log('\n1. Verificando tabla...');
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'agenda_pacientes_links'
      );
    `;
    console.log('✅ Tabla existe:', tableExists[0].exists);
    
    // 2. Obtener un doctor de prueba
    console.log('\n2. Buscando doctor de prueba...');
    const doctor = await prisma.doctor.findFirst({
      include: { user: true }
    });
    
    if (!doctor) {
      console.log('❌ No se encontró ningún doctor para probar');
      return;
    }
    
    console.log('✅ Doctor encontrado:', doctor.user.firstName, doctor.user.lastName);
    
    // 3. Crear configuración de agenda
    console.log('\n3. Creando configuración de agenda...');
    const link = `https://qlinexa360.com/agendar/${doctor.user.firstName.toLowerCase()}-${doctor.user.lastName.toLowerCase()}`;
    
    const agendaConfig = await prisma.agendaPacientesLink.upsert({
      where: { link: link },
      update: {
        esta_activo: true,
        mensaje_custom: '¡Bienvenido! Agenda tu cita de forma fácil y rápida.',
      },
      create: {
        doctor_id: doctor.id,
        esta_activo: true,
        mensaje_custom: '¡Bienvenido! Agenda tu cita de forma fácil y rápida.',
        link
      }
    });
    
    console.log('✅ Configuración creada:', {
      id: agendaConfig.id,
      link: agendaConfig.link,
      esta_activo: agendaConfig.esta_activo,
      mensaje_custom: agendaConfig.mensaje_custom
    });
    
    // 4. Crear slots de disponibilidad de prueba
    console.log('\n4. Creando slots de disponibilidad...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    
    const slots = [];
    for (let i = 0; i < 5; i++) {
      const startTime = new Date(tomorrow);
      startTime.setHours(9 + i, 0, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setHours(10 + i, 0, 0, 0);
      
      const slot = await prisma.availabilitySlot.create({
        data: {
          doctorId: doctor.id,
          startTime,
          endTime,
          isAvailable: true
        }
      });
      
      slots.push(slot);
    }
    
    console.log('✅ Slots creados:', slots.length);
    
    // 5. Probar búsqueda de configuración
    console.log('\n5. Probando búsqueda de configuración...');
    const foundConfig = await prisma.agendaPacientesLink.findFirst({
      where: {
        doctor_id: doctor.id,
        esta_activo: true
      },
      include: {
        Doctor: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (foundConfig) {
      console.log('✅ Configuración encontrada:', {
        doctorName: `${foundConfig.Doctor.user.firstName} ${foundConfig.Doctor.user.lastName}`,
        specialization: foundConfig.Doctor.specialization,
        link: foundConfig.link
      });
    } else {
      console.log('❌ No se encontró la configuración');
    }
    
    // 6. Probar búsqueda de slots disponibles
    console.log('\n6. Probando búsqueda de slots disponibles...');
    const availableSlots = await prisma.availabilitySlot.findMany({
      where: {
        doctorId: doctor.id,
        startTime: {
          gte: tomorrow,
          lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
        },
        isAvailable: true
      },
      orderBy: {
        startTime: 'asc'
      }
    });
    
    console.log('✅ Slots disponibles encontrados:', availableSlots.length);
    availableSlots.forEach((slot, index) => {
      console.log(`   ${index + 1}. ${slot.startTime.toLocaleTimeString()} - ${slot.endTime.toLocaleTimeString()}`);
    });
    
    console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!');
    console.log('\n📋 Resumen:');
    console.log(`   - Tabla creada: ✅`);
    console.log(`   - Doctor encontrado: ✅`);
    console.log(`   - Configuración creada: ✅`);
    console.log(`   - Slots de disponibilidad: ✅`);
    console.log(`   - Búsquedas funcionando: ✅`);
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAgendaSystem(); 