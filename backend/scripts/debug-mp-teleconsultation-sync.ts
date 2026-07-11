/**
 * Debug sync MP teleconsulta por token de confirmación.
 * npx ts-node scripts/debug-mp-teleconsultation-sync.ts [token]
 */
import prisma from '../src/config/database';
import { MercadoPagoApiClient } from '../src/payments/mercadopago/mercadopago.api.client';
import { MercadoPagoOAuthService } from '../src/payments/mercadopago/mercadopago.oauth.service';
import { mercadoPagoConfig } from '../src/payments/mercadopago/mercadopago.config';
import { syncPendingMercadoPagoPayment } from '../src/payments/mercadopago/mercadopago.sync.service';

const token =
  process.argv[2] || 'eacd1c4ff42084cd01fba1a146877587b4816c3aa40e1c854bedb49eb4353f87';
const appointmentIdArg = process.argv[3];

async function main() {
  let apptId: string;
  let doctorId: string;
  if (appointmentIdArg) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentIdArg },
      select: { doctorId: true },
    });
    if (!appt) {
      console.log('Appointment no encontrado');
      process.exit(1);
    }
    apptId = appointmentIdArg;
    doctorId = appt.doctorId;
  } else {
    const req = await prisma.appointmentConfirmationRequest.findUnique({
      where: { confirmationToken: token },
      include: { appointment: true },
    });
    if (!req) {
      console.log('Token no encontrado');
      process.exit(1);
    }
    apptId = req.appointmentId;
    doctorId = req.appointment.doctorId;
  }
  console.log('appointmentId:', apptId);
  console.log('doctorId:', doctorId);

  const payments = await prisma.mercadoPagoPayment.findMany({
    where: { appointmentId: apptId },
    orderBy: { createdAt: 'desc' },
  });
  console.log('\n--- Pagos locales ---');
  for (const p of payments) {
    console.log({
      id: p.id,
      status: p.status,
      externalReference: p.externalReference,
      providerPreferenceId: p.providerPreferenceId,
      providerPaymentId: p.providerPaymentId,
      checkoutUrl: p.checkoutUrl?.slice(0, 80),
      createdAt: p.createdAt,
    });
  }

  let accessToken: string;
  try {
    accessToken = await MercadoPagoOAuthService.getValidAccessToken(doctorId);
    console.log('\nOAuth doctor OK, token prefix:', accessToken.slice(0, 20));
  } catch (e) {
    console.error('OAuth doctor FAIL:', e);
    process.exit(1);
  }

  console.log('\n--- Búsqueda MP por external_reference ---');
  for (const p of payments) {
    try {
      const byRef = await MercadoPagoApiClient.searchPayments(accessToken, {
        external_reference: p.externalReference,
      });
      console.log('ref', p.externalReference, 'count:', byRef.results?.length ?? 0);
      for (const r of byRef.results || []) {
        console.log({ id: r.id, status: r.status, external_reference: r.external_reference });
      }
    } catch (e) {
      console.error('search external_reference FAIL', p.externalReference, e);
    }
  }

  const opIds = ['1347885987', '1347885981', '1347885975', '11347885987'];
  console.log('\n--- getPayment por operation id ---');
  for (const opId of opIds) {
    try {
      const pay = await MercadoPagoApiClient.getPayment(accessToken, opId);
      console.log({ id: pay.id, status: pay.status, external_reference: pay.external_reference });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('op', opId, 'FAIL', msg.slice(0, 120));
    }
  }

  console.log('\n--- merchant_orders por preference_id ---');
  const prefId = payments[0]?.providerPreferenceId;
  if (prefId) {
    try {
      const orders = await MercadoPagoApiClient.searchMerchantOrders(accessToken, { preference_id: prefId });
      console.log('orders count:', orders.elements?.length ?? 0);
      for (const o of orders.elements || []) {
        console.log({
          id: o.id,
          external_reference: o.external_reference,
          payments: o.payments,
        });
        try {
          const full = await MercadoPagoApiClient.getMerchantOrder(accessToken, String(o.id));
          console.log('  order_status:', (full as { order_status?: string }).order_status, 'status:', (full as { status?: string }).status, 'payments:', full.payments);
        } catch (e) {
          console.log('  getMerchantOrder fail', o.id);
        }
      }
    } catch (e) {
      console.error('merchant_orders FAIL:', e);
    }
  }

  console.log('\n--- search approved (platform token) ---');
  if (mercadoPagoConfig.platformAccessToken) {
    try {
      const params = new URLSearchParams({
        sort: 'date_created',
        criteria: 'desc',
        range: 'date_created',
        begin_date: 'NOW-7DAYS',
        end_date: 'NOW',
        status: 'approved',
      });
      const axios = require('axios');
      const { data } = await axios.get(`https://api.mercadopago.com/v1/payments/search?${params}`, {
        headers: { Authorization: `Bearer ${mercadoPagoConfig.platformAccessToken}` },
      });
      console.log('platform approved count:', data.results?.length ?? 0);
      for (const r of (data.results || []).slice(0, 10)) {
        console.log({ id: r.id, status: r.status, external_reference: r.external_reference, amount: r.transaction_amount });
      }
    } catch (e) {
      console.error('platform approved search FAIL', e);
    }
  }

  const conn = await prisma.paymentProviderConnection.findUnique({
    where: { doctorId_provider: { doctorId, provider: 'mercadopago' } },
  });
  console.log('\nOAuth connection providerUserId:', conn?.providerUserId, 'status:', conn?.status);

  if (conn?.providerUserId) {
    console.log('\n--- search by collector.id (seller) ---');
    try {
      const params = new URLSearchParams({
        sort: 'date_created',
        criteria: 'desc',
        range: 'date_created',
        begin_date: 'NOW-30DAYS',
        end_date: 'NOW',
        'collector.id': conn.providerUserId,
      });
      const axios = require('axios');
      const { data } = await axios.get(`https://api.mercadopago.com/v1/payments/search?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log('collector payments:', data.paging?.total ?? data.results?.length ?? 0);
      for (const r of (data.results || []).slice(0, 10)) {
        console.log({ id: r.id, status: r.status, external_reference: r.external_reference, amount: r.transaction_amount });
      }
    } catch (e) {
      console.error('collector search FAIL', e instanceof Error ? e.message : e);
    }
  }

  const webhooks = await prisma.paymentWebhookEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('\nrecent webhooks:', webhooks.map((w) => ({ eventType: w.eventType, processed: w.processed, createdAt: w.createdAt })));
  console.log('\n--- GET checkout preference ---');
  if (prefId) {
    try {
      const axios = require('axios');
      const { data: pref } = await axios.get(
        `https://api.mercadopago.com/checkout/preferences/${prefId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      console.log({
        id: pref.id,
        collector_id: pref.collector_id,
        external_reference: pref.external_reference,
        status: pref.status,
        date_created: pref.date_created,
      });
    } catch (e) {
      console.error('get preference FAIL', e instanceof Error ? e.message : e);
    }
  }

  console.log('\n--- reprocess payment.created webhooks for this external ref ---');
  const payWebhooks = await prisma.paymentWebhookEvent.findMany({
    where: { eventType: 'payment.created' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log('payment.created count:', payWebhooks.length);
  const moWebhook = webhooks.find((w) => {
    const p = w.payloadJson as { topic?: string; resource?: string };
    return p?.topic === 'merchant_order' && p?.resource;
  });
  if (moWebhook) {
    const resource = (moWebhook.payloadJson as { resource: string }).resource;
    const axios = require('axios');
    for (const [label, tok] of [
      ['seller', accessToken],
      ['platform', mercadoPagoConfig.platformAccessToken],
    ] as const) {
      if (!tok) continue;
      try {
        const { data } = await axios.get(resource, { headers: { Authorization: `Bearer ${tok}` } });
        console.log(label, 'merchant order resource OK');
        console.log(JSON.stringify(data, null, 2).slice(0, 2500));
      } catch (e) {
        const ax = e as { response?: { status?: number; data?: unknown } };
        console.log(label, 'resource FAIL', ax.response?.status, JSON.stringify(ax.response?.data)?.slice(0, 300));
      }
    }
  }

  for (const w of webhooks.slice(0, 2)) {
    console.log('payload sample:', JSON.stringify(w.payloadJson).slice(0, 400));
    const payload = w.payloadJson as { data?: { id?: string } };
    const mpPayId = payload?.data?.id;
    if (mpPayId) {
      console.log('try getPayment webhook id', mpPayId);
      for (const [label, tok] of [
        ['seller', accessToken],
        ['platform', mercadoPagoConfig.platformAccessToken],
      ] as const) {
        if (!tok) continue;
        try {
          const pay = await MercadoPagoApiClient.getPayment(tok, mpPayId);
          console.log(label, 'getPayment OK', {
            id: pay.id,
            status: pay.status,
            external_reference: pay.external_reference,
          });
        } catch (e) {
          const ax = e as { response?: { status?: number; data?: unknown } };
          console.log(label, 'getPayment FAIL', ax.response?.status, JSON.stringify(ax.response?.data)?.slice(0, 200));
        }
      }
    }
  }

  for (const p of payments.filter((x) => x.status === 'pending')) {
    console.log('\n--- Sync local payment', p.id, '---');
    const updated = await syncPendingMercadoPagoPayment(p.id);
    console.log('after sync status:', updated?.status, 'providerPaymentId:', updated?.providerPaymentId);
  }

  const tel = await prisma.teleconsultation.findUnique({ where: { appointmentId: apptId } });
  console.log('\nmeetingUrl:', tel?.meetingUrl);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
