const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const email = process.argv[2] || 'doctor@test.com';
    console.log('=== CHECK SUBSCRIPTION ===');
    console.log('Email:', email);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { doctorProfile: true }
    });

    if (!user || !user.doctorProfile) {
      console.log('Usuario o perfil de doctor no encontrado para ese email.');
      return;
    }

    const doctorId = user.doctorProfile.id;
    console.log('Doctor ID:', doctorId);

    const subscription = await prisma.subscription.findUnique({ where: { doctorId } });
    if (!subscription) {
      console.log('No hay registro de suscripción para este doctor.');
    } else {
      console.log('Suscripción encontrada:');
      console.log({
        id: subscription.id,
        status: subscription.status,
        paypalSubscriptionId: subscription.paypalSubscriptionId,
        paypalPlanId: subscription.paypalPlanId,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        updatedAt: subscription.updatedAt,
        cancelledAt: subscription.cancelledAt,
        cancellationReason: subscription.cancellationReason
      });

      const now = new Date();
      const isActiveByDates = subscription.startDate && subscription.endDate
        ? (now >= subscription.startDate && now <= subscription.endDate)
        : null;
      console.log('Heurística por fechas (start/end):', isActiveByDates);
    }
  } catch (err) {
    console.error('Error verificando suscripción:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
