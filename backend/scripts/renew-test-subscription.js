const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function renewTestSubscription() {
  try {
    console.log('🔄 Renovando suscripción del usuario de prueba...');

    // Buscar el usuario doctor de prueba
    const testDoctor = await prisma.user.findFirst({
      where: {
        email: 'doctor@test.com', // Ajusta este email según tu usuario de prueba
        role: 'DOCTOR'
      },
      include: {
        doctor: {
          include: {
            subscription: true
          }
        }
      }
    });

    if (!testDoctor) {
      console.log('❌ No se encontró el usuario doctor de prueba');
      return;
    }

    console.log(`✅ Usuario encontrado: ${testDoctor.email}`);

    // Crear o actualizar la suscripción
    const subscriptionData = {
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año desde ahora
      paypalSubscriptionId: 'test_subscription_renewed',
      planType: 'PREMIUM',
      price: 29.99,
      currency: 'USD'
    };

    if (testDoctor.doctor.subscription) {
      // Actualizar suscripción existente
      await prisma.subscription.update({
        where: { id: testDoctor.doctor.subscription.id },
        data: subscriptionData
      });
      console.log('✅ Suscripción actualizada');
    } else {
      // Crear nueva suscripción
      await prisma.subscription.create({
        data: {
          ...subscriptionData,
          doctorId: testDoctor.doctor.id
        }
      });
      console.log('✅ Nueva suscripción creada');
    }

    console.log('🎉 Suscripción del usuario de prueba renovada exitosamente');
    console.log(`📅 Válida hasta: ${subscriptionData.endDate.toLocaleDateString()}`);

  } catch (error) {
    console.error('❌ Error al renovar la suscripción:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
renewTestSubscription();
