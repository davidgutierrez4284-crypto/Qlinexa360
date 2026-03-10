const { PrismaClient, PromoCodeType } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const LIFETIME_COUNT = 50;
const TRIAL_COUNT = 100;
const DISCOUNT_50_3M_COUNT = 100;
const REACTIVATION_30D_COUNT = 100;

const generateCode = (prefix) => {
  const random = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${prefix}-${random}`;
};

const generateUniqueCodes = (prefix, count, existing) => {
  const codes = [];
  while (codes.length < count) {
    const code = generateCode(prefix);
    if (!existing.has(code)) {
      existing.add(code);
      codes.push(code);
    }
  }
  return codes;
};

async function generatePromoCodes() {
  try {
    console.log('=== GENERACIÓN DE CÓDIGOS PROMOCIONALES ===\n');

    const existingCodes = await prisma.promoCode.findMany({
      select: { code: true }
    });
    const existingSet = new Set(existingCodes.map((c) => c.code));

    const lifetimeCodes = generateUniqueCodes('QLX-LIFE', LIFETIME_COUNT, existingSet);
    const trialCodes = generateUniqueCodes('QLX-TRIAL', TRIAL_COUNT, existingSet);
    const discountCodes = generateUniqueCodes('QLX-50-3M', DISCOUNT_50_3M_COUNT, existingSet);
    const reactivationCodes = generateUniqueCodes('QLX-REACT-30D', REACTIVATION_30D_COUNT, existingSet);

    const now = new Date();
    const data = [
      ...lifetimeCodes.map((code) => ({
        code,
        type: PromoCodeType.LIFETIME,
        maxRedemptions: 1,
        redemptionCount: 0,
        isActive: true,
        validFrom: now
      })),
      ...trialCodes.map((code) => ({
        code,
        type: PromoCodeType.TRIAL_30D,
        maxRedemptions: 1,
        redemptionCount: 0,
        isActive: true,
        validFrom: now
      })),
      ...discountCodes.map((code) => ({
        code,
        type: PromoCodeType.DISCOUNT_50_3M,
        maxRedemptions: 1,
        redemptionCount: 0,
        isActive: true,
        validFrom: now
      })),
      ...reactivationCodes.map((code) => ({
        code,
        type: PromoCodeType.REACTIVATION_30D,
        maxRedemptions: 1,
        redemptionCount: 0,
        isActive: true,
        validFrom: now
      }))
    ];

    await prisma.promoCode.createMany({
      data,
      skipDuplicates: true
    });

    console.log(`✅ Códigos de por vida creados: ${lifetimeCodes.length}`);
    console.log(`✅ Códigos de prueba 30 días creados: ${trialCodes.length}\n`);
    console.log(`✅ Códigos promoción 50% 3 meses creados: ${discountCodes.length}`);
    console.log(`✅ Códigos reactivación 30 días creados: ${reactivationCodes.length}\n`);

    console.log('--- CÓDIGOS DE POR VIDA ---');
    lifetimeCodes.forEach((code) => console.log(code));

    console.log('\n--- CÓDIGOS DE PRUEBA 30 DÍAS ---');
    trialCodes.forEach((code) => console.log(code));

    console.log('\n--- CÓDIGOS PROMOCIÓN 50% 3 MESES ---');
    discountCodes.forEach((code) => console.log(code));

    console.log('\n--- CÓDIGOS REACTIVACIÓN 30 DÍAS ---');
    reactivationCodes.forEach((code) => console.log(code));
  } catch (error) {
    console.error('❌ Error generando códigos promocionales:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

generatePromoCodes()
  .then(() => {
    console.log('\n✅ Script completado exitosamente.');
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
