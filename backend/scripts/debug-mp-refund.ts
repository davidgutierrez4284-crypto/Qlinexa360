import prisma from '../src/config/database';
import { mercadoPagoConfig } from '../src/payments/mercadopago/mercadopago.config';
import { MercadoPagoOAuthService } from '../src/payments/mercadopago/mercadopago.oauth.service';
import { resolveMpPaymentWithFallback } from '../src/payments/mercadopago/mercadopago.payment-resolve.service';
import { MercadoPagoApiClient } from '../src/payments/mercadopago/mercadopago.api.client';
import { buildRefundTokenOrder } from '../src/payments/mercadopago/mercadopago.refund.service';

const mpPaymentIdArg = process.argv[2] || '1347891981';

async function main() {
  const p = await prisma.mercadoPagoPayment.findFirst({
    where: { providerPaymentId: mpPaymentIdArg },
    include: {
      auditLogs: { where: { eventType: 'SANDBOX_MANUAL_APPROVE' }, take: 1 },
    },
  });
  if (!p) {
    console.log('Payment not found locally for providerPaymentId', mpPaymentIdArg);
    return;
  }
  console.log('local', {
    id: p.id,
    externalReference: p.externalReference,
    preferenceId: p.providerPreferenceId,
    sandboxManual: p.auditLogs.length > 0,
    env: mercadoPagoConfig.env,
  });
  console.log('platformTokenConfigured', !!mercadoPagoConfig.platformAccessToken);

  const doctorToken = await MercadoPagoOAuthService.getValidAccessToken(p.doctorId);
  let preferredToken: string | null = null;
  try {
    const r = await resolveMpPaymentWithFallback({
      paymentId: p.providerPaymentId,
      doctorAccessToken: doctorToken,
      preferenceId: p.providerPreferenceId,
      externalReference: p.externalReference,
    });
    preferredToken = r.accessToken;
    console.log('resolve OK', r.source, r.payment.id, r.payment.status);
  } catch (e) {
    console.log('resolve FAIL', e instanceof Error ? e.message : e);
  }

  const tokenOrder = buildRefundTokenOrder({
    env: mercadoPagoConfig.env,
    platformToken: mercadoPagoConfig.platformAccessToken || null,
    preferredAccessToken: preferredToken,
    doctorAccessToken: doctorToken,
  });
  console.log(
    'refundTokenOrder',
    tokenOrder.map((token, index) => ({
      index,
      label:
        token === mercadoPagoConfig.platformAccessToken
          ? 'platform'
          : token === doctorToken
            ? 'doctor'
            : token === preferredToken
              ? 'preferred'
              : 'other',
    }))
  );

  for (const [index, token] of tokenOrder.entries()) {
    const label =
      token === mercadoPagoConfig.platformAccessToken
        ? 'platform'
        : token === doctorToken
          ? 'doctor'
          : token === preferredToken
            ? 'preferred'
            : `token-${index}`;
    try {
      const pay = await MercadoPagoApiClient.getPayment(token, mpPaymentIdArg);
      console.log(`${label} getPayment OK`, pay.id, pay.status);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`${label} getPayment FAIL`, msg.slice(0, 160));
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
