const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportPromoCodes() {
  try {
    console.log('=== EXPORTACIÓN DE CÓDIGOS PROMOCIONALES ===\n');

    const codes = await prisma.promoCode.findMany({
      where: {
        type: {
          in: ['LIFETIME', 'TRIAL_30D', 'DISCOUNT_50_3M', 'REACTIVATION_30D'],
        },
      },
      orderBy: [
        { type: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const header = [
      'type',
      'code',
      'isActive',
      'redemptionCount',
      'maxRedemptions',
      'validFrom',
      'validUntil',
      'createdAt',
    ].join(',');

    const rows = codes.map((c) => {
      const values = [
        c.type,
        c.code,
        c.isActive,
        c.redemptionCount,
        c.maxRedemptions,
        c.validFrom.toISOString(),
        c.validUntil ? c.validUntil.toISOString() : '',
        c.createdAt.toISOString(),
      ];
      return values.join(',');
    });

    const csv = [header, ...rows].join('\n');
    const outPath = path.join(__dirname, 'promo_codes_export.csv');
    fs.writeFileSync(outPath, csv, 'utf8');

    console.log(`✅ CSV generado en: ${outPath}`);
    console.log(`✅ Total códigos exportados: ${codes.length}`);
  } catch (error) {
    console.error('❌ Error exportando códigos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportPromoCodes()
  .then(() => {
    console.log('\n✅ Script completado exitosamente.');
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
