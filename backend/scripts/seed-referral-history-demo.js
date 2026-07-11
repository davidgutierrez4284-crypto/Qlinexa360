/**
 * Crea ~10 doctores “ficticios” referidos por un doctor existente para probar el historial de referidos en UI.
 *
 * Solo desarrollo y pruebas: aborta si NODE_ENV=production. Si NODE_ENV no es development|test,
 * o si DATABASE_URL no parece local, exige ALLOW_REFERRAL_SEED_DEMO=true (BD de QA controlada, Docker, etc.).
 *
 * Uso (desde carpeta backend, con DB local apuntando a tu .env):
 *   node scripts/seed-referral-history-demo.js doctor@email.com
 *
 * O:
 *   set REFERRER_EMAIL=doctor@email.com && node scripts/seed-referral-history-demo.js
 *
 * Idempotencia: borra usuarios previos creados por este script (email @qlinexa360-seed.test y cédula SEEDREF-DEMO-*).
 *
 * Windows — EPERM al ejecutar `prisma generate` (DLL en uso): detén el backend y Cursor tasks que usen Node,
 *   luego `npm run db:prisma:clean` y `npm run db:generate`. El script npm `seed:referral-demo` no vuelve a
 *   generar Prisma en cada ejecución para evitar ese bloqueo; si cambió el schema: `npm run db:generate` y luego el seed.
 *
 * P2022 (columna `existe`, etc.): cliente Prisma desincronizado con la BD; tras `prisma generate` OK debería resolverse.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function assertReferralSeedEnvironment() {
  const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv === 'production') {
    console.error(
      '[seed-referral-demo] Abortado: NODE_ENV=production. Este script solo puede usarse en desarrollo o entornos de prueba explícitos.'
    );
    process.exit(1);
  }

  const allowRemote = process.env.ALLOW_REFERRAL_SEED_DEMO === 'true';
  const devLike = !nodeEnv || nodeEnv === 'development' || nodeEnv === 'test';

  if (!devLike && !allowRemote) {
    console.error(
      '[seed-referral-demo] Establece NODE_ENV=development (o test), o define ALLOW_REFERRAL_SEED_DEMO=true en un entorno de pruebas controlado.'
    );
    process.exit(1);
  }

  const dbUrl = (process.env.DATABASE_URL || '').toLowerCase();
  const looksLocal =
    dbUrl === '' ||
    /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(dbUrl) ||
    /postgres(ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1)/.test(dbUrl);

  if (!looksLocal && !allowRemote) {
    console.error(
      '[seed-referral-demo] DATABASE_URL no parece apuntar a una base local. Para ejecutar contra una BD remota de pruebas, define ALLOW_REFERRAL_SEED_DEMO=true de forma consciente.'
    );
    process.exit(1);
  }
}

const SEED_EMAIL_DOMAIN = 'qlinexa360-seed.test';
const LICENSE_PREFIX = 'SEEDREF-DEMO-';

const REFERRER_EMAIL = (process.env.REFERRER_EMAIL || process.argv[2] || '').trim().toLowerCase();

const baseDoctor = (licenseSuffix) => ({
  licenseNumber: `${LICENSE_PREFIX}${licenseSuffix}`,
  specialization: 'Medicina general',
  officeAddress: 'Demo seed — no usar en producción',
  officePhone: '+52 55 0000 0000',
  professionalTitle: 'Médico general',
  taxId: `SEED${licenseSuffix}`.slice(0, 12),
  taxName: `Seed Ref ${licenseSuffix}`,
  taxAddress: 'Demo',
  taxCertificateUrl: 'https://example.com/seed.pdf',
  dataConsent: true,
  termsAccepted: true,
  termsAcceptedAt: new Date(),
  accessType: 'subscription',
});

/**
 * @typedef {{ id: string; month: string; first: string; last?: string; credited: boolean; sub?: { status: string; paypal?: string } | null }} Case
 */

/** @type {Case[]} */
const CASES = [
  { id: '01', month: '2025-08', first: 'Laura', credited: true, sub: { status: 'ACTIVE', paypal: 'test_sub_seed_01' } },
  { id: '02', month: '2025-08', first: 'Miguel', credited: true, sub: { status: 'ACTIVE', paypal: 'test_sub_seed_02' } },
  { id: '03', month: '2025-09', first: 'Carmen', credited: true, sub: { status: 'ACTIVE', paypal: 'test_sub_seed_03' } },
  { id: '04', month: '2025-09', first: 'Jorge', credited: true, sub: { status: 'ACTIVE', paypal: 'test_sub_seed_04' } },
  { id: '05', month: '2025-10', first: 'Rosa', credited: true, sub: { status: 'ACTIVE', paypal: 'test_sub_seed_05' } },
  { id: '06', month: '2025-10', first: 'Pedro', credited: false, sub: { status: 'CANCELLED', paypal: 'test_sub_seed_06' } },
  { id: '07', month: '2025-11', first: 'Lucía', credited: false, sub: null },
  { id: '08', month: '2025-11', first: 'Andrés', credited: false, sub: { status: 'ACTIVE', paypal: '' } },
  { id: '09', month: '2025-12', first: 'Elena', credited: true, sub: { status: 'ACTIVE', paypal: 'test_sub_seed_09' } },
  { id: '10', month: '2026-01', first: 'Fernando', credited: false, sub: { status: 'SUSPENDED', paypal: 'test_sub_seed_10' } },
];

async function removePreviousSeed() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;

  const doctors = await prisma.doctor.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const doctorIds = doctors.map((d) => d.id);

  await prisma.referralConversion.deleteMany({ where: { referredDoctorId: { in: doctorIds } } });
  await prisma.subscription.deleteMany({ where: { doctorId: { in: doctorIds } } });
  await prisma.doctor.deleteMany({ where: { id: { in: doctorIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function main() {
  assertReferralSeedEnvironment();

  if (!REFERRER_EMAIL) {
    console.error('Indica el email del doctor referidor, ej:');
    console.error('  node scripts/seed-referral-history-demo.js dr.garcia@test.com');
    process.exit(1);
  }

  const referrerUser = await prisma.user.findUnique({
    where: { email: REFERRER_EMAIL },
    include: { doctorProfile: true },
  });

  if (!referrerUser?.doctorProfile) {
    console.error(`No se encontró doctor con email: ${REFERRER_EMAIL}`);
    process.exit(1);
  }

  const referrerId = referrerUser.doctorProfile.id;
  const passwordHash = await bcrypt.hash('SeedRefDemo!01', 10);

  await removePreviousSeed();

  let creditedCount = 0;

  for (const c of CASES) {
    const email = `seed-ref-${c.id}@${SEED_EMAIL_DOMAIN}`;
    const registeredAt = new Date(`${c.month}-12T15:30:00.000Z`);

    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        firstName: c.first,
        lastName: c.last || 'Seed',
        role: 'DOCTOR',
        createdAt: registeredAt,
      },
    });

    const doctor = await prisma.doctor.create({
      data: {
        userId: user.id,
        referrerDoctorId: referrerId,
        ...baseDoctor(c.id),
      },
    });

    if (c.sub) {
      const paypalId = c.sub.paypal === undefined ? `test_sub_seed_${c.id}` : c.sub.paypal;
      const start = new Date(registeredAt);
      const end = new Date(start);
      end.setDate(end.getDate() + 45);
      await prisma.subscription.create({
        data: {
          doctorId: doctor.id,
          paypalSubscriptionId: paypalId,
          paypalPlanId: 'plan_seed_demo',
          status: c.sub.status,
          startDate: start,
          endDate: end,
        },
      });
    }

    if (c.credited) {
      const convAt = new Date(`${c.month}-18T11:00:00.000Z`);
      await prisma.referralConversion.create({
        data: {
          referrerDoctorId: referrerId,
          referredDoctorId: doctor.id,
          percentGranted: 20,
          createdAt: convAt,
        },
      });
      creditedCount += 1;
    }
  }

  /** 6 acreditados × 20% = 120%; un canje de 100% deja 20% de saldo y 1 mes otorgado (simulado). */
  const referralCodePatch = referrerUser.doctorProfile.referralCode?.trim()
    ? {}
    : { referralCode: `SEED${referrerId.replace(/-/g, '').slice(0, 8).toUpperCase()}` };

  await prisma.doctor.update({
    where: { id: referrerId },
    data: {
      referralCreditPercent: 20,
      referralFreeMonthsGranted: 1,
      ...referralCodePatch,
    },
  });

  console.log('OK seed referidos demo');
  console.log(`  Referidor: ${REFERRER_EMAIL} (${referrerId})`);
  console.log(`  Referidos creados: ${CASES.length} (${creditedCount} con conversión acreditada, ${CASES.length - creditedCount} pendientes)`);
  console.log(`  Saldo referidor simulado: 20% · Meses gratis aplicados (contador): 1`);
  console.log(`  Inicia sesión como ${REFERRER_EMAIL} y abre Perfil → Historial de referidos.`);
}

main()
  .catch((e) => {
    console.error(e);
    if (e && e.code === 'P2022') {
      console.error('\n--- Prisma P2022 (columna en BD distinta al cliente) ---');
      console.error('El cliente Prisma y la base de datos no coinciden (p. ej. columna', e.meta?.column, ').');
      console.error('En la carpeta backend ejecuta:');
      console.error('  npx prisma migrate deploy');
      console.error('  npx prisma generate');
      console.error('Luego vuelve a lanzar: npm run seed:referral-demo -- tu@email.com');
      console.error('Si el schema local tiene campos que no existen en la BD, alinéalos o aplica migraciones pendientes.\n');
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
