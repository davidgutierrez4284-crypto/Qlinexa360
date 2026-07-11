/**
 * Solo sandbox/dev: marca un cobro de teleconsulta como aprobado cuando MP UI muestra éxito
 * pero la API queda en payment_required (bug conocido marketplace sandbox).
 *
 * npx ts-node scripts/sandbox-approve-teleconsultation.ts --appointment-id <uuid> [--mp-payment-id 1347891981]
 */
import prisma from '../src/config/database';
import { mercadoPagoConfig } from '../src/payments/mercadopago/mercadopago.config';
import { finalizeTeleconsultationAfterPayment } from '../src/payments/mercadopago/mercadopago.teleconsultation.service';

function parseArgs(argv: string[]) {
  let appointmentId = '';
  let mpPaymentId = '';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--appointment-id') appointmentId = argv[++i] || '';
    else if (argv[i] === '--mp-payment-id') mpPaymentId = argv[++i] || '';
  }
  return { appointmentId, mpPaymentId };
}

async function main() {
  if (mercadoPagoConfig.env !== 'sandbox') {
    console.error('Este script solo puede ejecutarse con MERCADOPAGO_ENV=sandbox');
    process.exit(1);
  }

  const { appointmentId, mpPaymentId } = parseArgs(process.argv.slice(2));
  if (!appointmentId) {
    console.error('Usage: --appointment-id <uuid> [--mp-payment-id <id>]');
    process.exit(1);
  }

  const payment = await prisma.mercadoPagoPayment.findFirst({
    where: { appointmentId, paymentType: 'teleconsultation', status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });

  if (!payment) {
    console.error('No hay cobro pendiente para esta cita.');
    process.exit(1);
  }

  const updated = await prisma.mercadoPagoPayment.update({
    where: { id: payment.id },
    data: {
      status: 'approved',
      providerPaymentId: mpPaymentId || payment.providerPaymentId || `sandbox-manual-${Date.now()}`,
      paidAt: new Date(),
    },
  });

  await prisma.paymentAuditLog.create({
    data: {
      paymentId: payment.id,
      eventType: 'SANDBOX_MANUAL_APPROVE',
      rawPayloadJson: {
        appointmentId,
        mpPaymentId: mpPaymentId || null,
        reason: 'MP UI approved but API merchant_order payment_required',
      },
    },
  });

  console.log('Pago marcado approved:', {
    id: updated.id,
    providerPaymentId: updated.providerPaymentId,
  });

  const fin = await finalizeTeleconsultationAfterPayment(appointmentId);
  console.log('Finalize teleconsultation:', fin);

  const tc = await prisma.teleconsultation.findUnique({
    where: { appointmentId },
    select: { meetingUrl: true },
  });
  console.log('Meeting URL:', tc?.meetingUrl || '(none)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
