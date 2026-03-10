/**
 * Valida datos en la base de datos de PRODUCCIÓN
 * Uso: DATABASE_URL="postgresql://..." npx ts-node scripts/validate-prod-data.ts
 * Obtén DATABASE_URL de AWS Secrets Manager: qlinexa360-prod-database-url
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no está definida.');
    console.log('\nObtén la URL de AWS Secrets Manager:');
    console.log('  aws secretsmanager get-secret-value --secret-id qlinexa360-prod-database-url --query SecretString --output text --region us-east-2');
    console.log('\nLuego ejecuta:');
    console.log('  $env:DATABASE_URL="postgresql://..." ; npx ts-node scripts/validate-prod-data.ts');
    process.exit(1);
  }

  const dbHost = process.env.DATABASE_URL.includes('localhost') ? 'desarrollo' : 'producción';
  console.log(`\n🔍 Conectando a base de datos (${dbHost})...\n`);

  try {
    // a) Usuarios
    const userCount = await prisma.user.count();
    const users = await prisma.user.findMany({
      take: 10,
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('═══════════════════════════════════════════');
    console.log('a) USUARIOS');
    console.log('═══════════════════════════════════════════');
    console.log(`Total de usuarios: ${userCount}`);
    console.log('\nÚltimos 10 usuarios (muestra):');
    users.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.email} | ${u.role} | ${u.firstName} ${u.lastName} | ${u.createdAt.toISOString().split('T')[0]}`);
    });

    // b) Códigos promocionales
    const promoCount = await prisma.promoCode.count();
    const promos = await prisma.promoCode.findMany({
      select: {
        code: true,
        type: true,
        isActive: true,
        maxRedemptions: true,
        redemptionCount: true,
        validFrom: true,
        validUntil: true,
      },
    });

    console.log('\n═══════════════════════════════════════════');
    console.log('b) CÓDIGOS PROMOCIONALES');
    console.log('═══════════════════════════════════════════');
    console.log(`Total de códigos: ${promoCount}`);
    if (promos.length > 0) {
      console.log('\nCódigos promocionales:');
      promos.forEach((p, i) => {
        const validUntil = p.validUntil ? p.validUntil.toISOString().split('T')[0] : 'sin límite';
        console.log(`  ${i + 1}. ${p.code} | ${p.type} | activo: ${p.isActive} | usados: ${p.redemptionCount}/${p.maxRedemptions} | vence: ${validUntil}`);
      });
    }

    console.log('\n✅ Validación completada.\n');
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
