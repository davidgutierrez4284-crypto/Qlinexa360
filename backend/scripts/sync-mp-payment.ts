/**
 * Manual Mercado Pago payment sync (webhook miss or doctor-token 404 in marketplace).
 *
 * Usage:
 *   npx ts-node scripts/sync-mp-payment.ts --payment-id 1347891981
 *   npx ts-node scripts/sync-mp-payment.ts --appointment-id 7eb7ca15-8bd7-433b-8e6d-ee8c92cc4f96
 */
import prisma from '../src/config/database';
import { syncPendingMercadoPagoPayment } from '../src/payments/mercadopago/mercadopago.sync.service';
import { MercadoPagoOAuthService } from '../src/payments/mercadopago/mercadopago.oauth.service';
import { resolveMpPaymentWithFallback } from '../src/payments/mercadopago/mercadopago.payment-resolve.service';
import { MercadoPagoPreferenceService } from '../src/payments/mercadopago/mercadopago.preference.service';
import { finalizeTeleconsultationAfterPayment } from '../src/payments/mercadopago/mercadopago.teleconsultation.service';

function parseArgs(argv: string[]) {
  let paymentId = '';
  let appointmentId = '';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--payment-id') paymentId = argv[++i] || '';
    else if (argv[i] === '--appointment-id') appointmentId = argv[++i] || '';
  }
  return { paymentId, appointmentId };
}

async function applyDirectResolve(
  localPayment: NonNullable<Awaited<ReturnType<typeof prisma.mercadoPagoPayment.findFirst>>>,
  mpPaymentId: string
) {
  const doctorAccessToken = await MercadoPagoOAuthService.getValidAccessToken(localPayment.doctorId);
  const { payment: mpPayment, source } = await resolveMpPaymentWithFallback({
    paymentId: mpPaymentId,
    doctorAccessToken,
    preferenceId: localPayment.providerPreferenceId,
    externalReference: localPayment.externalReference,
  });

  console.log('Resolved from MP:', {
    source,
    mpId: mpPayment.id,
    status: mpPayment.status,
    external_reference: mpPayment.external_reference,
  });

  const mappedStatus = MercadoPagoPreferenceService.mapMpStatus(mpPayment.status);
  const updated = await prisma.mercadoPagoPayment.update({
    where: { id: localPayment.id },
    data: {
      status: mappedStatus,
      providerPaymentId: String(mpPayment.id),
      paidAt: mpPayment.date_approved ? new Date(mpPayment.date_approved) : localPayment.paidAt,
    },
  });

  await prisma.paymentAuditLog.create({
    data: {
      paymentId: localPayment.id,
      eventType: 'PAYMENT_SYNC_MANUAL',
      rawPayloadJson: { ...mpPayment, resolveSource: source } as object,
    },
  });

  if (
    mappedStatus === 'approved' &&
    localPayment.paymentType === 'teleconsultation' &&
    localPayment.appointmentId
  ) {
    const fin = await finalizeTeleconsultationAfterPayment(localPayment.appointmentId);
    console.log('Teleconsultation finalize:', fin);
  }

  return updated;
}

async function main() {
  const { paymentId, appointmentId } = parseArgs(process.argv.slice(2));
  if (!paymentId && !appointmentId) {
    console.error(
      'Usage: npx ts-node scripts/sync-mp-payment.ts --payment-id <id> | --appointment-id <uuid>'
    );
    process.exit(1);
  }

  console.log('=== Mercado Pago manual sync ===');
  console.log({ paymentId: paymentId || '(none)', appointmentId: appointmentId || '(none)' });

  const localPayments = await prisma.mercadoPagoPayment.findMany({
    where: appointmentId ? { appointmentId } : { providerPaymentId: paymentId },
    orderBy: { createdAt: 'desc' },
  });

  if (!localPayments.length) {
    console.error('No local MercadoPagoPayment records found.');
    process.exit(1);
  }

  for (const lp of localPayments) {
    console.log('\n--- Local payment ---', {
      id: lp.id,
      status: lp.status,
      providerPreferenceId: lp.providerPreferenceId,
      providerPaymentId: lp.providerPaymentId,
    });

    if (lp.status !== 'pending') {
      console.log('Skip: already', lp.status);
      continue;
    }

    if (paymentId) {
      const updated = await applyDirectResolve(lp, paymentId);
      console.log('After direct resolve:', updated.status, updated.providerPaymentId);
      continue;
    }

    const updated = await syncPendingMercadoPagoPayment(lp.id);
    console.log('After sync:', updated?.status, updated?.providerPaymentId);
  }

  if (appointmentId) {
    const tc = await prisma.teleconsultation.findUnique({
      where: { appointmentId },
      select: { meetingUrl: true },
    });
    console.log('\nMeeting URL:', tc?.meetingUrl || '(none yet)');
  }

  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
