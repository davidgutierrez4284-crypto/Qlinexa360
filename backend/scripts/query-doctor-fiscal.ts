/**
 * Consulta datos fiscales de un doctor en BD (prod o local).
 *
 * Uso (PowerShell, con acceso a RDS prod):
 *   $env:DATABASE_URL = (aws secretsmanager get-secret-value --secret-id qlinexa360-prod-database-url --region us-east-2 --query SecretString --output text)
 *   npx ts-node scripts/query-doctor-fiscal.ts draterevillanueva@gmail.com
 *
 * O por RFC:
 *   npx ts-node scripts/query-doctor-fiscal.ts --rfc VIGT820901590
 */
import prisma from '../src/config/database';

const emailArg = process.argv.find((a) => a.includes('@'));
const rfcArg = process.argv.includes('--rfc')
  ? process.argv[process.argv.indexOf('--rfc') + 1]
  : null;

async function main() {
  if (!emailArg && !rfcArg) {
    console.error('Uso: npx ts-node scripts/query-doctor-fiscal.ts <email>  |  --rfc <RFC>');
    process.exit(1);
  }

  const doctor = await prisma.doctor.findFirst({
    where: rfcArg
      ? { taxId: { equals: rfcArg, mode: 'insensitive' } }
      : { user: { email: { equals: emailArg!, mode: 'insensitive' } } },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          createdAt: true,
        },
      },
      files: {
        where: { category: null },
        select: { id: true, fileName: true, url: true, fileType: true, createdAt: true },
        take: 20,
      },
    },
  });

  if (!doctor) {
    console.log('No se encontró doctor con esos criterios.');
    return;
  }

  const u = doctor.user;
  console.log('\n=== Datos fiscales (tabla Doctor) ===\n');
  console.log('Doctor ID:', doctor.id);
  console.log('Nombre usuario:', `${u.firstName} ${u.lastName}`.trim());
  console.log('Email:', u.email);
  console.log('Teléfono usuario:', u.phone || '(no registrado)');
  console.log('---');
  console.log('Razón social (taxName):', doctor.taxName || '(vacío)');
  console.log('RFC (taxId):', doctor.taxId || '(vacío)');
  console.log('Domicilio fiscal (taxAddress):', doctor.taxAddress || '(vacío)');
  console.log('Código postal (taxPostalCode):', doctor.taxPostalCode || '(vacío)');
  console.log('Régimen fiscal (taxRegime):', doctor.taxRegime || '(vacío)');
  console.log('Constancia CSF (taxCertificateUrl):', doctor.taxCertificateUrl || '(vacío / no adjuntó en registro)');
  console.log('---');
  console.log('Consultorio (officeAddress):', doctor.officeAddress || '(vacío)');
  console.log('Tel. consultorio:', doctor.officePhone || '(vacío)');
  console.log('Cédula:', doctor.licenseNumber);
  console.log('Registro:', u.createdAt.toISOString());

  if (doctor.files.length > 0) {
    console.log('\n=== Archivos del doctor (revisar si hay CSF) ===\n');
    for (const f of doctor.files) {
      console.log(`- ${f.fileName} (${f.fileType}) → ${f.url}`);
    }
  }

  console.log('\nNota: en el registro actual, la constancia fiscal suele quedar vacía (taxCertificateUrl="").');
  console.log('Si taxCertificateUrl tiene URL S3, descárgala desde consola AWS o con URL firmada.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
