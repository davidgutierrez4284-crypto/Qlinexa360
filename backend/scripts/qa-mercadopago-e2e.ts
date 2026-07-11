/**
 * QA E2E Mercado Pago — cobros teleconsulta, Finanzas y reembolsos.
 *
 * Uso:
 *   npx ts-node scripts/qa-mercadopago-e2e.ts
 *   QA_API_BASE=http://localhost:3000 QA_DOCTOR_TOKEN=... npx ts-node scripts/qa-mercadopago-e2e.ts
 *
 * Variables opcionales (HTTP):
 *   QA_API_BASE          — default http://localhost:3000
 *   QA_DOCTOR_TOKEN      — JWT doctor (status MP, transacciones)
 *   QA_ASSISTANT_TOKEN   — JWT asistente
 *   QA_SELECTED_DOCTOR_ID — doctorId para asistente (header x-selected-doctor-id)
 *   QA_TELECONSULT_TOKEN — token público /teleconsulta/:token
 */
import axios from 'axios';
import prisma from '../src/config/database';
import { env } from '../src/config/env';
import { mercadoPagoConfig } from '../src/payments/mercadopago/mercadopago.config';
import {
  requiresTeleconsultationPayment,
  getTeleconsultationPaymentContext,
} from '../src/payments/mercadopago/mercadopago.teleconsultation.service';
import { MercadoPagoPreferenceService } from '../src/payments/mercadopago/mercadopago.preference.service';
import {
  buildWebhookProviderEventId,
  claimMercadoPagoWebhookEvent,
  markMercadoPagoWebhookProcessed,
} from '../src/payments/mercadopago/mercadopago.webhook-events.utils';
import { getRefundableAmount } from '../src/payments/mercadopago/mercadopago.refund.service';
import { DEFAULT_DATA_ENCRYPTION_KEY } from '../src/config/startupValidation';

const API_BASE = (process.env.QA_API_BASE || 'http://localhost:3000').replace(/\/$/, '');

let pass = 0;
let fail = 0;
let skip = 0;
const failed: string[] = [];
const warnings: string[] = [];

function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    failed.push(label);
    console.log(`  FAIL  ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`);
  }
}

function warn(label: string) {
  warnings.push(label);
  console.log(`  WARN  ${label}`);
}

function skipCheck(label: string, reason: string) {
  skip += 1;
  console.log(`  SKIP  ${label} (${reason})`);
}

async function section(title: string, fn: () => Promise<void>) {
  console.log(`\n--- ${title} ---`);
  await fn();
}

async function httpGet(path: string, headers: Record<string, string> = {}) {
  return axios.get(`${API_BASE}${path}`, {
    headers,
    validateStatus: () => true,
    timeout: 15000,
  });
}

async function runConfigChecks() {
  check('MERCADOPAGO clientId configurado', !!mercadoPagoConfig.clientId);
  check('MERCADOPAGO clientSecret configurado', !!mercadoPagoConfig.clientSecret);
  check('MERCADOPAGO_ENV definido', mercadoPagoConfig.env === 'sandbox' || mercadoPagoConfig.env === 'production');

  if (env.NODE_ENV === 'production') {
    check(
      'DATA_ENCRYPTION_KEY no es default en prod',
      env.DATA_ENCRYPTION_KEY !== DEFAULT_DATA_ENCRYPTION_KEY
    );
    check('MERCADOPAGO_WEBHOOK_SECRET en prod', !!mercadoPagoConfig.webhookSecret);
  } else if (env.DATA_ENCRYPTION_KEY === DEFAULT_DATA_ENCRYPTION_KEY) {
    warn('DATA_ENCRYPTION_KEY usa valor dev (OK en local, no en prod)');
  }

  if (mercadoPagoConfig.env === 'production' && !mercadoPagoConfig.webhookSecret) {
    warn('MERCADOPAGO_WEBHOOK_SECRET vacío con env=production');
  }
}

async function runHealthCheck() {
  try {
    const res = await httpGet('/health');
    check('GET /health responde 200', res.status === 200, res.status);
  } catch (err) {
    check('GET /health alcanzable', false, (err as Error).message);
  }
}

async function runDbServiceChecks() {
  const rule = await prisma.platformMercadoPagoCommissionRule.findFirst({ where: { isActive: true } });
  check('Regla comisión MP activa en BD', !!rule);

  const teleAppt = await prisma.appointment.findFirst({
    where: { appointmentType: 'teleconsulta' },
    include: { teleconsultation: true, doctor: true, patient: true },
  });

  if (!teleAppt) {
    skipCheck('Contexto teleconsulta en BD', 'no hay cita teleconsulta');
  } else {
    const req = await requiresTeleconsultationPayment(teleAppt.doctorId);
    check('requiresTeleconsultationPayment responde', typeof req.required === 'boolean');

    const ctx = await getTeleconsultationPaymentContext(teleAppt.doctorId, teleAppt.id);
    check('getTeleconsultationPaymentContext responde paymentStatus', !!ctx.paymentStatus);

    const approvedPayment = await prisma.mercadoPagoPayment.findFirst({
      where: { appointmentId: teleAppt.id, status: 'approved' },
    });
    if (approvedPayment) {
      check(
        'getRefundableAmount coherente',
        getRefundableAmount(approvedPayment) >= 0
      );
    }
  }

  check('mapMpStatus approved', MercadoPagoPreferenceService.mapMpStatus('approved') === 'approved');
  check('mapMpStatus pending', MercadoPagoPreferenceService.mapMpStatus('in_process') === 'pending');
}

async function runWebhookIdempotencyChecks() {
  const testId = `qa-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const providerEventId = buildWebhookProviderEventId('qa_test', testId, 'req-1');
  check('buildWebhookProviderEventId con request-id', !!providerEventId);

  if (!providerEventId) return;

  const first = await claimMercadoPagoWebhookEvent({
    providerEventId,
    eventType: 'qa_test',
    payloadJson: { test: true },
  });
  check('webhook claim primera vez = claim', first === 'claim', first);

  const second = await claimMercadoPagoWebhookEvent({
    providerEventId,
    eventType: 'qa_test',
    payloadJson: { test: true },
  });
  check('webhook claim segunda vez = busy o duplicate', second === 'busy' || second === 'duplicate', second);

  await markMercadoPagoWebhookProcessed(providerEventId);

  const third = await claimMercadoPagoWebhookEvent({
    providerEventId,
    eventType: 'qa_test',
    payloadJson: { test: true },
  });
  check('webhook tras processed = duplicate', third === 'duplicate', third);

  await prisma.paymentWebhookEvent.deleteMany({ where: { providerEventId } });
}

async function runHttpDoctorChecks() {
  const token = process.env.QA_DOCTOR_TOKEN;
  if (!token) {
    skipCheck('API doctor MP status', 'QA_DOCTOR_TOKEN no definido');
    skipCheck('API doctor transacciones', 'QA_DOCTOR_TOKEN no definido');
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  const statusRes = await httpGet('/api/payments/mercadopago/status', headers);
  check('GET /mercadopago/status doctor', statusRes.status === 200, statusRes.status);
  if (statusRes.status === 200) {
    check('status.success', statusRes.data?.success === true);
  }

  const txRes = await httpGet('/api/payments/mercadopago/transactions?limit=5', headers);
  check('GET /mercadopago/transactions doctor', txRes.status === 200, txRes.status);

  const refundsRes = await httpGet('/api/payments/mercadopago/refund-requests?status=pending', headers);
  check('GET /mercadopago/refund-requests doctor', refundsRes.status === 200, refundsRes.status);
}

async function runHttpAssistantChecks() {
  const token = process.env.QA_ASSISTANT_TOKEN;
  const doctorId = process.env.QA_SELECTED_DOCTOR_ID;
  if (!token || !doctorId) {
    skipCheck('API asistente transacciones', 'QA_ASSISTANT_TOKEN o QA_SELECTED_DOCTOR_ID');
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'x-selected-doctor-id': doctorId,
  };

  const txRes = await httpGet('/api/payments/mercadopago/transactions?limit=5', headers);
  check('GET /mercadopago/transactions asistente (fix P1)', txRes.status === 200, {
    status: txRes.status,
    error: txRes.data?.error,
  });
}

async function runHttpTeleconsultChecks() {
  const token = process.env.QA_TELECONSULT_TOKEN;
  if (!token) {
    skipCheck('API teleconsulta info', 'QA_TELECONSULT_TOKEN no definido');
    return;
  }

  const res = await httpGet(`/api/teleconsultation/info/${token}`);
  check('GET /teleconsultation/info/:token', res.status === 200, res.status);
  if (res.status === 200) {
    check('teleconsulta success', res.data?.success === true);
    check('teleconsulta paymentStatus presente', typeof res.data?.paymentStatus === 'string');
  }
}

async function runWebhookRouteChecks() {
  try {
    const postRes = await axios.post(
      `${API_BASE}/api/payments/mercadopago/webhook`,
      { type: 'unknown', action: 'ping' },
      { validateStatus: () => true, timeout: 10000 }
    );
    check('POST /webhook responde (no 5xx)', postRes.status < 500, postRes.status);

    const getRes = await axios.get(`${API_BASE}/api/payments/mercadopago/webhook`, {
      params: { topic: 'payment', id: '12345' },
      validateStatus: () => true,
      timeout: 10000,
    });
    check('GET /webhook IPN legacy responde (no 5xx)', getRes.status < 500, getRes.status);
  } catch (err) {
    check('Rutas webhook alcanzables', false, (err as Error).message);
  }
}

function printManualChecklist() {
  console.log('\n=== Checklist manual UI (obligatorio pre-PROD) ===');
  const steps = [
    'Doctor: Mi Perfil → Conectar Mercado Pago → activar cobros teleconsulta → guardar',
    'Doctor: Calendario → crear teleconsulta con monto → paciente recibe enlace',
    'Paciente: /teleconsulta/:token → firmar → Pagar con Mercado Pago (sandbox: titular APRO)',
    'Paciente: ver badge Pagado y enlace videollamada',
    'Doctor: modal cita = Pagado; Finanzas = transacción approved + KPIs',
    'Paciente: Solicitar reembolso (motivo ≥10 chars)',
    'Doctor: Finanzas → aprobar reembolso → estado Reembolsado en paciente y Finanzas',
    'Verificar webhook MP en logs ECS tras pago real en staging/prod',
  ];
  steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
}

async function main() {
  console.log('\n========================================');
  console.log('  QA E2E Mercado Pago — Qlinexa360');
  console.log(`  API: ${API_BASE}  |  MP env: ${mercadoPagoConfig.env}`);
  console.log('========================================');

  await section('Configuración y secretos', runConfigChecks);
  await section('Health HTTP', runHealthCheck);
  await section('Servicios BD', runDbServiceChecks);
  await section('Idempotencia webhooks', runWebhookIdempotencyChecks);
  await section('Rutas webhook HTTP', runWebhookRouteChecks);
  await section('API doctor (token opcional)', runHttpDoctorChecks);
  await section('API asistente (token opcional)', runHttpAssistantChecks);
  await section('API teleconsulta pública', runHttpTeleconsultChecks);

  printManualChecklist();

  console.log(`\nResultado: ${pass} pass, ${fail} fail, ${skip} skip`);
  if (warnings.length) {
    console.log('Advertencias:', warnings.join(' | '));
  }
  if (failed.length) {
    console.log('Fallos:', failed.join(', '));
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
