const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixDoctorSubscription() {
  try {
    console.log('=== REVISANDO SUSCRIPCIÓN DEL DOCTOR ===');
    
    const doctorId = '3835a2ba-1055-4ed8-b212-60662bc85214';
    
    // Buscar el doctor
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: true,
        subscription: true
      }
    });
    
    console.log('Doctor encontrado:', {
      id: doctor.id,
      userId: doctor.userId,
      email: doctor.user.email,
      nombre: `${doctor.user.firstName} ${doctor.user.lastName}`,
      accessType: doctor.accessType,
      trialStart: doctor.trialStart,
      trialEnd: doctor.trialEnd
    });
    
    if (doctor.subscription) {
      console.log('Suscripción existente:', {
        id: doctor.subscription.id,
        status: doctor.subscription.status,
        startDate: doctor.subscription.startDate,
        endDate: doctor.subscription.endDate
      });
    } else {
      console.log('❌ No hay suscripción activa');
    }
    
    // Crear o actualizar suscripción
    const subscription = await prisma.subscription.upsert({
      where: { doctorId: doctorId },
      update: {
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
        paypalSubscriptionId: 'TEST_SUBSCRIPTION',
        paypalPlanId: 'TEST_PLAN'
      },
      create: {
        doctorId: doctorId,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
        paypalSubscriptionId: 'TEST_SUBSCRIPTION',
        paypalPlanId: 'TEST_PLAN'
      }
    });
    
    console.log('✅ Suscripción creada/actualizada:', {
      id: subscription.id,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate
    });
    
    // Actualizar el doctor para que tenga acceso completo
    const updatedDoctor = await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        accessType: 'FULL',
        trialStart: new Date(),
        trialEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 año
      }
    });
    
    console.log('✅ Doctor actualizado con acceso completo');
    console.log('Access Type:', updatedDoctor.accessType);
    console.log('Trial End:', updatedDoctor.trialEnd);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDoctorSubscription(); 