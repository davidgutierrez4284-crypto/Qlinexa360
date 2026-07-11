// @ts-nocheck
/**
 * Revisión visual de UI (Admin afiliados + Panel de afiliado).
 * Siembra datos demo, inyecta sesión por localStorage y captura screenshots con Puppeteer.
 *
 * Requiere: backend dev en :3000 y frontend dev (vite) en :5173.
 * Ejecutar:  npx ts-node scripts/qa-affiliates-ui.ts
 */
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import puppeteer from 'puppeteer';
import prisma from '../src/config/database';
import { generateToken } from '../src/utils/jwt.utils';
import { computeCommission } from '../src/utils/affiliateCommission.utils';
import { generateUniqueCodeBatch } from '../src/utils/affiliateCode.utils';

const RUN = Date.now();
const FRONTEND = 'http://localhost:5173';
const OUT = path.resolve(__dirname, '..', 'qa-screens');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();

async function seed() {
  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  let createdAdmin = false;
  if (!admin) {
    admin = await prisma.user.create({ data: { email: `qa-uiadmin-${RUN}@qa.test`, password: await bcrypt.hash('Admin123', 10), role: 'ADMIN', firstName: 'QA', lastName: 'Admin' } });
    createdAdmin = true;
  }

  let rule = await prisma.affiliateCommissionRule.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
  if (!rule) {
    rule = await prisma.affiliateCommissionRule.create({ data: { name: 'Regla por defecto', commissionPercentage: 30, commissionMonths: 6, vatRate: 0.16, freeMonthsForDoctor: 1, graceDaysForDoctor: 15, isActive: true } });
  }

  const affUser = await prisma.user.create({ data: { email: `qa-uiaff-${RUN}@qa.test`, password: await bcrypt.hash('Afiliado123', 10), role: 'AFFILIATE', firstName: 'María', lastName: 'Comisionista', phone: '5512345678' } });
  const code = `QLX-AF-DEMO${String(RUN).slice(-2)}`;
  const profile = await prisma.affiliateProfile.create({ data: { userId: affUser.id, affiliateCode: code, fullName: 'María Comisionista', email: affUser.email, phone: '5512345678', country: 'MX', status: 'ACTIVE', defaultCommissionPercentage: 30, defaultCommissionMonths: 6 } });
  await prisma.affiliateBankAccount.create({ data: { affiliateId: profile.id, beneficiaryFullName: 'María Comisionista', country: 'MX', bankName: 'BBVA México', clabe: '012180001234567895', preferredCurrency: 'MXN', isActive: true } });

  // Un segundo afiliado para que la lista del admin tenga más de una fila
  const aff2User = await prisma.user.create({ data: { email: `qa-uiaff2-${RUN}@qa.test`, password: await bcrypt.hash('Afiliado123', 10), role: 'AFFILIATE', firstName: 'Carlos', lastName: 'Promotor' } });
  const profile2 = await prisma.affiliateProfile.create({ data: { userId: aff2User.id, affiliateCode: `QLX-AF-DEMOX${String(RUN).slice(-1)}`, fullName: 'Carlos Promotor', email: aff2User.email, country: 'MX', status: 'ACTIVE', defaultCommissionPercentage: 30, defaultCommissionMonths: 6 } });
  void profile2;

  const ref = await prisma.affiliateReferral.create({ data: { affiliateId: profile.id, doctorUserId: `demo-doc-${RUN}`, doctorEmail: 'dra.ramirez@clinica.test', doctorName: 'Dra. Patricia Ramírez', affiliateCodeUsed: code, trialDaysGranted: 45, firstPaymentDate: new Date(), status: 'ACTIVE_PAID' } });
  const ref2 = await prisma.affiliateReferral.create({ data: { affiliateId: profile.id, doctorUserId: `demo-doc2-${RUN}`, doctorEmail: 'dr.lopez@clinica.test', doctorName: 'Dr. Jorge López', affiliateCodeUsed: code, trialDaysGranted: 45, status: 'REGISTERED' } });
  void ref2;

  const mk = async (i: number, status: string, paid = false) => {
    const { netBase, commissionAmount, trace } = computeCommission({ grossAmount: 499, vatRate: 0.16, commissionPercentage: 30, commissionMonthNumber: i, commissionDurationMonths: 6, paypalPaymentId: `DEMO-PAY-${RUN}-${i}`, doctorUserId: ref.doctorUserId, affiliateCode: code, currency: 'MXN' });
    await prisma.affiliateCommission.create({ data: { affiliateId: profile.id, doctorUserId: ref.doctorUserId, affiliateReferralId: ref.id, paypalPaymentId: `DEMO-PAY-${RUN}-${i}`, paypalSubscriptionId: `DEMO-SUB-${RUN}`, paymentDate: new Date(Date.now() - (4 - i) * 86400000), commissionMonthNumber: i, paymentAmountGross: 499, vatRate: 0.16, paymentAmountNet: netBase, commissionPercentage: 30, commissionAmount, currency: 'MXN', status: status as any, calculationTraceJson: trace as any, ...(paid ? { paidAt: new Date(), paidByAdminUserId: admin!.id } : {}) } });
  };
  await mk(1, 'PAID', true);
  await mk(2, 'PENDING');
  await mk(3, 'PENDING');

  const poolCodes = generateUniqueCodeBatch(8);
  await prisma.affiliateCode.createMany({ data: poolCodes.map((c) => ({ code: c, status: 'AVAILABLE' as const, batchId: `uidemo_${RUN}` })), skipDuplicates: true });

  return { admin: admin!, affUser, createdAdmin };
}

async function clickByText(page: any, text: string) {
  await page.evaluate((t: string) => {
    const btns = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
    const b = btns.find((x) => (x.textContent || '').trim() === t);
    if (b) b.click();
  }, text);
}

// Hace clic en el botón "Detalle" de la fila que contiene el nombre dado.
async function clickDetailFor(page: any, name: string) {
  await page.evaluate((n: string) => {
    const rows = Array.from(document.querySelectorAll('tr'));
    const row = rows.find((r) => (r.textContent || '').includes(n));
    if (row) {
      const btn = Array.from(row.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Detalle');
      if (btn) (btn as HTMLButtonElement).click();
    }
  }, name);
}

async function capture() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const { admin, affUser } = await seed();

  const personas = [
    {
      name: 'admin',
      token: generateToken({ userId: admin.id, role: 'ADMIN' } as any),
      user: { id: admin.id, email: admin.email, role: 'ADMIN', firstName: admin.firstName, lastName: admin.lastName },
      route: '/dashboard/admin/afiliados',
      tabs: ['Afiliados', 'Códigos', 'Comisiones', 'Configuración']
    },
    {
      name: 'afiliado',
      token: generateToken({ userId: affUser.id, role: 'AFFILIATE' } as any),
      user: { id: affUser.id, email: affUser.email, role: 'AFFILIATE', firstName: affUser.firstName, lastName: affUser.lastName },
      route: '/dashboard/affiliate',
      tabs: ['Resumen', 'Comisiones', 'Médicos referidos', 'Datos bancarios']
    }
  ];

  const browser = await puppeteer.launch({ headless: 'new' as any, args: ['--no-sandbox', '--disable-setuid-sandbox'], defaultViewport: { width: 1440, height: 900 } });
  const files: string[] = [];
  try {
    for (const p of personas) {
      const page = await browser.newPage();
      await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle2' });
      await page.evaluate((t: string, u: string) => { localStorage.setItem('token', t); localStorage.setItem('user', u); }, p.token, JSON.stringify(p.user));
      await page.goto(`${FRONTEND}${p.route}`, { waitUntil: 'networkidle2' });
      await sleep(1800);
      for (const tab of p.tabs) {
        await clickByText(page, tab);
        await sleep(1100);
        const file = path.join(OUT, `${p.name}-${slug(tab)}.png`);
        await page.screenshot({ path: file, fullPage: true });
        files.push(file);
        console.log('  screenshot:', file);
      }
      // Admin: abrir el modal de Detalle del afiliado con referidos para validar badges (Registrado/Pagando).
      if (p.name === 'admin') {
        await clickByText(page, 'Afiliados');
        await sleep(900);
        await clickDetailFor(page, 'María Comisionista');
        await sleep(1300);
        const file = path.join(OUT, `${p.name}-detalle-referidos.png`);
        await page.screenshot({ path: file, fullPage: true });
        files.push(file);
        console.log('  screenshot:', file);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return files;
}

async function cleanup() {
  try {
    const qaUsers = await prisma.user.findMany({ where: { email: { startsWith: 'qa-ui', endsWith: '@qa.test' } }, select: { id: true } });
    const ids = qaUsers.map((u) => u.id);
    const profs = await prisma.affiliateProfile.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    const profIds = profs.map((p) => p.id);
    await prisma.affiliateCommission.deleteMany({ where: { affiliateId: { in: profIds } } });
    await prisma.affiliateReferral.deleteMany({ where: { affiliateId: { in: profIds } } });
    await prisma.affiliateBankAccount.deleteMany({ where: { affiliateId: { in: profIds } } });
    await prisma.affiliateProfile.deleteMany({ where: { id: { in: profIds } } });
    await prisma.affiliateCode.deleteMany({ where: { batchId: { startsWith: 'uidemo_' } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  } catch (e) {
    console.log('cleanup parcial:', (e as Error).message);
  }
}

async function main() {
  console.log('### UI REVIEW AFILIADOS ###');
  await cleanup(); // limpiar corridas previas
  const files = await capture();
  await cleanup();
  console.log(`\nListo. ${files.length} capturas en: ${OUT}`);
  files.forEach((f) => console.log(' -', f));
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('ERROR UI REVIEW:', e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
