/**
 * QA sandbox Mercado Pago teleconsulta (sin HTTP; requiere BD dev y credenciales MP opcionales).
 * Ejecutar: npx ts-node scripts/qa-mercadopago-teleconsultation.ts
 */
import prisma from '../src/config/database';
import {
  requiresTeleconsultationPayment,
  getTeleconsultationPaymentContext,
  finalizeTeleconsultationAfterPayment,
} from '../src/payments/mercadopago/mercadopago.teleconsultation.service';
import { MercadoPagoPreferenceService } from '../src/payments/mercadopago/mercadopago.preference.service';

let pass = 0;
let fail = 0;
const failed: string[] = [];

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

async function main() {
  console.log('\n=== QA Mercado Pago Teleconsulta ===\n');

  const rule = await prisma.platformMercadoPagoCommissionRule.findFirst({ where: { isActive: true } });
  check('Regla comisión activa existe', !!rule);

  const teleAppt = await prisma.appointment.findFirst({
    where: { appointmentType: 'teleconsulta' },
    include: { teleconsultation: true, doctor: true, patient: true },
  });

  if (!teleAppt) {
    console.log('  SKIP  No hay cita teleconsulta en BD para pruebas end-to-end');
  } else {
    const req = await requiresTeleconsultationPayment(teleAppt.doctorId);
    check('requiresTeleconsultationPayment responde objeto', typeof req.required === 'boolean');

    const ctx = await getTeleconsultationPaymentContext(teleAppt.doctorId, teleAppt.id);
    check('getTeleconsultationPaymentContext responde paymentStatus', !!ctx.paymentStatus);

    if (teleAppt.teleconsultation?.consentSigned) {
      const fin = await finalizeTeleconsultationAfterPayment(teleAppt.id);
      check('finalizeTeleconsultationAfterPayment ejecuta sin throw', fin != null);
    }
  }

  check('mapMpStatus approved', MercadoPagoPreferenceService.mapMpStatus('approved') === 'approved');
  check('mapMpStatus pending', MercadoPagoPreferenceService.mapMpStatus('in_process') === 'pending');

  console.log(`\nResultado: ${pass} pass, ${fail} fail`);
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
