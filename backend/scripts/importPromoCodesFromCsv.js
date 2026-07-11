/**
 * Importa códigos promocionales desde promo-codes.csv (raíz del repo) a la BD conectada.
 * Uso: node backend/scripts/importPromoCodesFromCsv.js [ruta/al/archivo.csv]
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const TYPE_MAP = {
  LIFETIME: 'LIFETIME',
  TRIAL_30D: 'TRIAL_30D',
  DISCOUNT_50_3M: 'DISCOUNT_50_3M',
  REACTIVATION_30D: 'REACTIVATION_30D',
};

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseUsados(usados) {
  const m = String(usados || '').match(/^(\d+)\/(\d+)$/);
  if (!m) return { redemptionCount: 0, maxRedemptions: 1 };
  return { redemptionCount: Number(m[1]), maxRedemptions: Number(m[2]) || 1 };
}

async function importPromoCodesFromCsv(csvPath) {
  const resolved = path.resolve(csvPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Archivo no encontrado: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw new Error('CSV vacío o sin filas de datos');
  }

  let created = 0;
  let skipped = 0;
  let reactivated = 0;
  let errors = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 4) continue;

    const code = cols[0].trim().toUpperCase();
    const type = TYPE_MAP[cols[1]?.trim()];
    const isActive = String(cols[2]).toLowerCase() === 'true';
    const { redemptionCount, maxRedemptions } = parseUsados(cols[3]);
    const validFrom = cols[4] ? new Date(cols[4]) : new Date();
    const validUntil = cols[5] ? new Date(cols[5]) : null;

    if (!code || !type) {
      errors++;
      continue;
    }

    try {
      const existing = await prisma.promoCode.findUnique({ where: { code } });
      if (!existing) {
        await prisma.promoCode.create({
          data: {
            code,
            type,
            isActive,
            maxRedemptions,
            redemptionCount,
            validFrom: Number.isNaN(validFrom.getTime()) ? new Date() : validFrom,
            validUntil: validUntil && !Number.isNaN(validUntil.getTime()) ? validUntil : null,
          },
        });
        created++;
        continue;
      }

      if (!existing.isActive && isActive && existing.redemptionCount < existing.maxRedemptions) {
        await prisma.promoCode.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
        reactivated++;
      }
      skipped++;
    } catch (e) {
      console.error(`Error en código ${code}:`, e.message);
      errors++;
    }
  }

  return { created, skipped, reactivated, errors, totalRows: lines.length - 1 };
}

async function main() {
  const csvPath =
    process.argv[2] || path.join(__dirname, '..', 'data', 'promo-codes.csv');

  console.log('=== IMPORTACIÓN DE CÓDIGOS PROMOCIONALES ===');
  console.log('Archivo:', path.resolve(csvPath));
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '(configurada)' : '(NO configurada)');

  const result = await importPromoCodesFromCsv(csvPath);
  console.log('\nResultado:');
  console.log(`  Filas en CSV:     ${result.totalRows}`);
  console.log(`  Creados:          ${result.created}`);
  console.log(`  Ya existían:      ${result.skipped}`);
  console.log(`  Reactivados:      ${result.reactivated}`);
  console.log(`  Errores:          ${result.errors}`);

  const sample = await prisma.promoCode.findUnique({
    where: { code: 'QLX-3M-3PHABHTV' },
    select: { code: true, type: true, isActive: true, redemptionCount: true, maxRedemptions: true },
  });
  console.log('\nVerificación QLX-3M-3PHABHTV:', sample || 'NO ENCONTRADO EN BD');
}

main()
  .catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

module.exports = { importPromoCodesFromCsv };
