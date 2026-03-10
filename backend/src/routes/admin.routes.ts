import { Router, Request, Response, NextFunction } from 'express';
import { execSync } from 'child_process';
import path from 'path';
import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { Prisma } from '@prisma/client';
import { syncFreeMonthToPayPal, fixResumeDateForFreeMonth } from '../controllers/subscription.controller';
import { unlinkPatientFromDoctor, listDoctorPatientsAdmin } from '../controllers/doctor.controller';

const router = Router();

// Middleware: token de admin O token de seed (ambos válidos para todas las rutas)
const requireAdminOrSeedToken = (req: Request, res: Response, next: NextFunction) => {
  const token = (req.headers['x-admin-report-token'] || req.headers['x-seed-token']) as string | undefined;

  if (token && env.ADMIN_REPORT_TOKEN && token === env.ADMIN_REPORT_TOKEN) return next();
  if (token && env.SEED_TOKEN && token === env.SEED_TOKEN) return next();

  const expected = env.ADMIN_REPORT_TOKEN || env.SEED_TOKEN;
  if (!expected || expected.length < 16) {
    return res.status(503).json({
      error: 'No configurado',
      message: 'Configura ADMIN_REPORT_TOKEN o SEED_TOKEN en Secrets Manager.',
    });
  }
  return res.status(401).json({
    error: 'No autorizado',
    message: 'Header X-Admin-Report-Token o X-Seed-Token inválido.',
  });
};

router.use(requireAdminOrSeedToken);

/**
 * Seed PROD: crear admin + códigos promocionales
 * POST /api/admin/seed-prod
 * Body opcional: { adminPassword?: string } - si no se envía, usa "AdminQlinexa3602024!"
 */
router.post('/seed-prod', async (req: Request, res: Response) => {
  try {
    const adminPassword = (req.body?.adminPassword as string) || 'AdminQlinexa3602024!';
    const results: { admin?: string; promos?: { created: number; skipped: number } } = {};

    // a) Crear usuario ADMIN admin@qlinexa360.com
    const adminEmail = 'admin@qlinexa360.com';
    let existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
      include: { adminProfile: true },
    });

    if (existingUser) {
      if (existingUser.role !== 'ADMIN') {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role: 'ADMIN' },
        });
      }
      if (!existingUser.adminProfile) {
        await prisma.admin.create({ data: { userId: existingUser.id } });
      }
      results.admin = 'Ya existía o fue actualizado';
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const user = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          firstName: 'Administrador',
          lastName: 'Qlinexa360',
          role: 'ADMIN',
        },
      });
      await prisma.admin.create({ data: { userId: user.id } });
      results.admin = 'Creado (cambia la contraseña tras el primer login)';
    }

    // b) Crear códigos promocionales
    const toCreate: { prefix: string; type: 'LIFETIME' | 'TRIAL_30D' | 'DISCOUNT_50_3M'; count: number }[] = [
      { prefix: 'QLX-LIFE-', type: 'LIFETIME', count: 100 },
      { prefix: 'QLX-3M-', type: 'DISCOUNT_50_3M', count: 100 },
      { prefix: 'QLX-1M-', type: 'TRIAL_30D', count: 200 },
    ];

    let created = 0;
    let skipped = 0;

    for (const { prefix, type, count } of toCreate) {
      for (let i = 0; i < count; i++) {
        const code = `${prefix}${randomSuffix(8)}`;
        try {
          await prisma.promoCode.create({
            data: {
              code,
              type,
              maxRedemptions: 1,
              isActive: true,
            },
          });
          created++;
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            skipped++;
          } else {
            throw e;
          }
        }
      }
    }

    results.promos = { created, skipped };

    res.json({
      success: true,
      message: 'Seed completado',
      results,
    });
  } catch (e) {
    res.status(500).json({
      error: 'Error en seed',
      message: (e as Error).message,
    });
  }
});

function randomSuffix(len: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/**
 * Seed plantillas de formularios especiales (Formulario por Especialidad en Nueva Consulta)
 * POST /api/admin/reports/seed-form-templates
 * Ejecuta el script desde el contenedor ECS (tiene acceso a la BD de producción).
 */
router.post('/seed-form-templates', async (_req: Request, res: Response) => {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'seed-form-templates-only.js');
    execSync(`node "${scriptPath}"`, {
      stdio: 'inherit',
      env: process.env,
    });
    res.json({
      success: true,
      message: 'Plantillas de formularios creadas correctamente. Refresca la página de Nueva Consulta.',
    });
  } catch (e) {
    const err = e as Error & { stdout?: string; stderr?: string };
    console.error('Error en seed-form-templates:', err);
    res.status(500).json({
      error: 'Error al crear plantillas',
      message: err.message || 'Error desconocido',
    });
  }
});

/**
 * a) Usuarios que podrían ser de desarrollo (emails típicos de prueba)
 * GET /api/admin/reports/users-dev-check
 */
router.get('/users-dev-check', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
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

    // Patrones típicos de emails de desarrollo/prueba
    const devPatterns = [
      /@test\./i,
      /@example\.com$/i,
      /test@/i,
      /prueba@/i,
      /dev@/i,
      /demo@/i,
      /fake@/i,
      /@mailinator\.com$/i,
      /@tempmail\./i,
      /@yopmail\./i,
    ];

    const flagged = users.filter((u) =>
      devPatterns.some((p) => p.test(u.email))
    );

    res.json({
      total: users.length,
      possibleDevUsers: flagged.length,
      possibleDevUsersList: flagged.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        name: `${u.firstName} ${u.lastName}`,
        createdAt: u.createdAt,
      })),
      allUsersSample: users.slice(0, 50).map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        name: `${u.firstName} ${u.lastName}`,
        createdAt: u.createdAt,
      })),
    });
  } catch (e) {
    res.status(500).json({
      error: 'Error al consultar usuarios',
      message: (e as Error).message,
    });
  }
});

/**
 * b) Códigos promocionales migrados
 * GET /api/admin/reports/promo-codes
 */
router.get('/promo-codes', async (_req: Request, res: Response) => {
  try {
    const promos = await prisma.promoCode.findMany({
      select: {
        id: true,
        code: true,
        type: true,
        isActive: true,
        maxRedemptions: true,
        redemptionCount: true,
        validFrom: true,
        validUntil: true,
        createdAt: true,
      },
      orderBy: { code: 'asc' },
    });

    res.json({
      total: promos.length,
      promoCodes: promos.map((p) => ({
        code: p.code,
        type: p.type,
        isActive: p.isActive,
        usados: `${p.redemptionCount}/${p.maxRedemptions}`,
        validFrom: p.validFrom,
        validUntil: p.validUntil,
      })),
    });
  } catch (e) {
    res.status(500).json({
      error: 'Error al consultar códigos promocionales',
      message: (e as Error).message,
    });
  }
});

/**
 * c) Reporte mensual de clientes que pagan (profesionales con suscripción activa)
 * Datos fiscales y correo para facturación Qlinexa360
 * GET /api/admin/reports/billing-monthly?month=2025-02
 */
router.get('/billing-monthly', async (req: Request, res: Response) => {
  try {
    const monthParam = req.query.month as string | undefined;
    const month = monthParam || new Date().toISOString().slice(0, 7); // YYYY-MM

    const [startOfMonth, endOfMonth] = [
      new Date(`${month}-01T00:00:00.000Z`),
      new Date(month),
    ];
    endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);
    endOfMonth.setUTCDate(0);
    endOfMonth.setUTCHours(23, 59, 59, 999);

    // Doctores con suscripción ACTIVE cuyo periodo incluye el mes solicitado
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: endOfMonth },
        endDate: { gte: startOfMonth },
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    const report = subscriptions.map((s) => ({
      doctorId: s.doctorId,
      email: s.doctor.user.email,
      nombre: `${s.doctor.user.firstName} ${s.doctor.user.lastName}`,
      razonSocial: s.doctor.taxName,
      rfc: s.doctor.taxId,
      domicilioFiscal: s.doctor.taxAddress,
      especialidad: s.doctor.specialization,
      cedula: s.doctor.licenseNumber,
      suscripcionInicio: s.startDate,
      suscripcionFin: s.endDate,
    }));

    res.json({
      month,
      total: report.length,
      clients: report,
    });
  } catch (e) {
    res.status(500).json({
      error: 'Error al generar reporte de facturación',
      message: (e as Error).message,
    });
  }
});

/**
 * Sincronizar mes gratis de retención con PayPal (reparación).
 * Para casos donde freeMonthUsed=true pero PayPal no se suspendió.
 * POST /api/admin/reports/subscriptions/sync-free-month-paypal
 * Body: { doctorId?: string } - si se envía, solo repara ese doctor; si no, repara todos.
 * Header: X-Admin-Report-Token o X-Seed-Token
 */
router.post('/subscriptions/sync-free-month-paypal', syncFreeMonthToPayPal);

/**
 * Corregir resumeDate (primer cargo = fin del mes gratis, no +30 días).
 * POST /api/admin/reports/subscriptions/fix-resume-date
 * Body: { email: string }
 */
router.post('/subscriptions/fix-resume-date', fixResumeDateForFreeMonth);

/**
 * Listar pacientes de un doctor (para obtener patientId).
 * GET /api/admin/reports/doctor-patients?doctorEmail=xxx
 * Header: X-Admin-Report-Token o X-Seed-Token
 */
router.get('/doctor-patients', listDoctorPatientsAdmin);

/**
 * Desvincular paciente incorrectamente vinculado a un doctor.
 * Para corregir el bug de email vacío que vinculaba pacientes de otros doctores.
 * POST /api/admin/reports/unlink-incorrect-patient
 * Body: { doctorEmail: string, patientId?: string, patientFirstName?: string, patientLastName?: string }
 * Header: X-Admin-Report-Token o X-Seed-Token
 */
router.post('/unlink-incorrect-patient', unlinkPatientFromDoctor);

export default router;
