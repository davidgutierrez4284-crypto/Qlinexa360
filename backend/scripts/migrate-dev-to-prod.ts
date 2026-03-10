/**
 * Migración DEV → PROD: usuarios específicos y códigos promocionales
 *
 * Requiere acceso a ambas bases de datos. PROD (RDS) está en subred privada;
 * necesitas VPN, bastion o ejecutar desde una instancia en la VPC.
 *
 * Uso:
 *   $env:DATABASE_URL_DEV = "postgresql://...@localhost:5432/medilink360"
 *   $env:DATABASE_URL_PROD = (aws secretsmanager get-secret-value --secret-id qlinexa360-prod-database-url --region us-east-2 --query SecretString --output text)
 *   npx ts-node scripts/migrate-dev-to-prod.ts
 */

import { PrismaClient } from '@prisma/client';

const USERS_TO_MIGRATE = ['test.doctor1@medilink360.com', 'admin@qlinexa360.com'];

async function main() {
  const urlDev = process.env.DATABASE_URL_DEV;
  const urlProd = process.env.DATABASE_URL_PROD;

  if (!urlDev || !urlProd) {
    console.error('❌ Define DATABASE_URL_DEV y DATABASE_URL_PROD');
    console.log('\nEjemplo:');
    console.log('  $env:DATABASE_URL_DEV = "postgresql://postgres:xxx@localhost:5432/medilink360"');
    console.log('  $env:DATABASE_URL_PROD = (aws secretsmanager get-secret-value --secret-id qlinexa360-prod-database-url --region us-east-2 --query SecretString --output text)');
    process.exit(1);
  }

  const prismaDev = new PrismaClient({ datasources: { db: { url: urlDev } } });
  const prismaProd = new PrismaClient({ datasources: { db: { url: urlProd } } });

  console.log('\n=== Migración DEV → PROD ===\n');

  try {
    // 1. Migrar usuarios
    for (const email of USERS_TO_MIGRATE) {
      const user = await prismaDev.user.findUnique({
        where: { email },
        include: { doctorProfile: true, adminProfile: true },
      });
      if (!user) {
        console.log(`⚠ Usuario no encontrado en DEV: ${email}`);
        continue;
      }

      const exists = await prismaProd.user.findUnique({ where: { email } });
      if (exists) {
        console.log(`⏭ Usuario ya existe en PROD: ${email}`);
        continue;
      }

      await prismaProd.user.create({
        data: {
          id: user.id,
          email: user.email,
          password: user.password,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          profilePictureUrl: user.profilePictureUrl,
          twoFactorEnabled: user.twoFactorEnabled,
          twoFactorSecret: user.twoFactorSecret,
          twoFactorVerifiedAt: user.twoFactorVerifiedAt,
          twoFactorRecoveryToken: user.twoFactorRecoveryToken,
          twoFactorRecoveryExpiresAt: user.twoFactorRecoveryExpiresAt,
        },
      });
      console.log(`✅ Usuario migrado: ${email}`);

      if (user.adminProfile) {
        await prismaProd.admin.upsert({
          where: { userId: user.id },
          create: { id: user.adminProfile.id, userId: user.id },
          update: {},
        });
        console.log(`   + Admin profile`);
      }

      if (user.doctorProfile) {
        const doc = user.doctorProfile;
        await prismaProd.doctor.create({
          data: {
            id: doc.id,
            userId: doc.userId,
            licenseNumber: doc.licenseNumber,
            specialization: doc.specialization,
            officeAddress: doc.officeAddress,
            officePhone: doc.officePhone,
            professionalTitle: doc.professionalTitle,
            taxId: doc.taxId,
            taxName: doc.taxName,
            taxAddress: doc.taxAddress,
            taxCertificateUrl: doc.taxCertificateUrl,
            dataConsent: doc.dataConsent,
            termsAccepted: doc.termsAccepted,
            termsAcceptedAt: doc.termsAcceptedAt,
            accessType: doc.accessType,
            trialStart: doc.trialStart,
            trialEnd: doc.trialEnd,
            profilePictureUrl: doc.profilePictureUrl,
            certificadoEspecialidad: doc.certificadoEspecialidad,
            certificadoMaestria: doc.certificadoMaestria,
            certificadoProfesional: doc.certificadoProfesional,
            consultorioDireccion: doc.consultorioDireccion,
            consultorioTelefono: doc.consultorioTelefono,
            logoUrl: doc.logoUrl,
            primaryColor: doc.primaryColor,
            secondaryColor: doc.secondaryColor,
          },
        });
        console.log(`   + Doctor profile`);
      }
    }

    // 2. Migrar códigos promocionales
    const promos = await prismaDev.promoCode.findMany();
    for (const p of promos) {
      const exists = await prismaProd.promoCode.findUnique({ where: { code: p.code } });
      if (exists) {
        console.log(`⏭ Código ya existe en PROD: ${p.code}`);
        continue;
      }
      await prismaProd.promoCode.create({
        data: {
          id: p.id,
          code: p.code,
          type: p.type,
          maxRedemptions: p.maxRedemptions,
          redemptionCount: p.redemptionCount,
          isActive: p.isActive,
          validFrom: p.validFrom,
          validUntil: p.validUntil,
        },
      });
      console.log(`✅ Código migrado: ${p.code}`);
    }

    console.log('\n✅ Migración completada.\n');
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  } finally {
    await prismaDev.$disconnect();
    await prismaProd.$disconnect();
  }
}

main();
