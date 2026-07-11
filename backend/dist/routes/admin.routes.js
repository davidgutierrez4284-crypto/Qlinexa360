"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("../config/database"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const env_1 = require("../config/env");
const client_1 = require("@prisma/client");
const subscription_controller_1 = require("../controllers/subscription.controller");
const doctor_controller_1 = require("../controllers/doctor.controller");
const router = (0, express_1.Router)();
// Middleware: token de admin O token de seed (ambos válidos para todas las rutas)
const requireAdminOrSeedToken = (req, res, next) => {
    const token = (req.headers['x-admin-report-token'] || req.headers['x-seed-token']);
    if (token && env_1.env.ADMIN_REPORT_TOKEN && token === env_1.env.ADMIN_REPORT_TOKEN)
        return next();
    if (token && env_1.env.SEED_TOKEN && token === env_1.env.SEED_TOKEN)
        return next();
    const expected = env_1.env.ADMIN_REPORT_TOKEN || env_1.env.SEED_TOKEN;
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
router.post('/seed-prod', async (req, res) => {
    var _a;
    try {
        const adminPassword = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.adminPassword) || 'AdminQlinexa3602024!';
        const results = {};
        // a) Crear usuario ADMIN admin@qlinexa360.com
        const adminEmail = 'admin@qlinexa360.com';
        let existingUser = await database_1.default.user.findUnique({
            where: { email: adminEmail },
            include: { adminProfile: true },
        });
        if (existingUser) {
            if (existingUser.role !== 'ADMIN') {
                await database_1.default.user.update({
                    where: { id: existingUser.id },
                    data: { role: 'ADMIN' },
                });
            }
            if (!existingUser.adminProfile) {
                await database_1.default.admin.create({ data: { userId: existingUser.id } });
            }
            results.admin = 'Ya existía o fue actualizado';
        }
        else {
            const hashedPassword = await bcryptjs_1.default.hash(adminPassword, 10);
            const user = await database_1.default.user.create({
                data: {
                    email: adminEmail,
                    password: hashedPassword,
                    firstName: 'Administrador',
                    lastName: 'Qlinexa360',
                    role: 'ADMIN',
                },
            });
            await database_1.default.admin.create({ data: { userId: user.id } });
            results.admin = 'Creado (cambia la contraseña tras el primer login)';
        }
        // b) Crear códigos promocionales
        const toCreate = [
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
                    await database_1.default.promoCode.create({
                        data: {
                            code,
                            type,
                            maxRedemptions: 1,
                            isActive: true,
                        },
                    });
                    created++;
                }
                catch (e) {
                    if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                        skipped++;
                    }
                    else {
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
    }
    catch (e) {
        res.status(500).json({
            error: 'Error en seed',
            message: e.message,
        });
    }
});
function randomSuffix(len) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < len; i++)
        s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}
/**
 * Seed plantillas de formularios especiales (Formulario por Especialidad en Nueva Consulta)
 * POST /api/admin/reports/seed-form-templates
 * Ejecuta el script desde el contenedor ECS (tiene acceso a la BD de producción).
 */
router.post('/seed-form-templates', async (_req, res) => {
    try {
        const scriptPath = path_1.default.join(process.cwd(), 'scripts', 'seed-form-templates-only.js');
        (0, child_process_1.execSync)(`node "${scriptPath}"`, {
            stdio: 'inherit',
            env: process.env,
        });
        res.json({
            success: true,
            message: 'Plantillas de formularios creadas correctamente. Refresca la página de Nueva Consulta.',
        });
    }
    catch (e) {
        const err = e;
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
router.get('/users-dev-check', async (_req, res) => {
    try {
        const users = await database_1.default.user.findMany({
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
        const flagged = users.filter((u) => devPatterns.some((p) => p.test(u.email)));
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
    }
    catch (e) {
        res.status(500).json({
            error: 'Error al consultar usuarios',
            message: e.message,
        });
    }
});
/**
 * Buscar un código concreto (soporte / diagnóstico)
 * GET /api/admin/reports/promo-codes/lookup?code=QLX-3M-3PHABHTV
 */
router.get('/promo-codes/lookup', async (req, res) => {
    try {
        const code = String(req.query.code || '').trim().toUpperCase();
        if (!code) {
            return res.status(400).json({ error: 'Parámetro code requerido' });
        }
        const promo = await database_1.default.promoCode.findUnique({
            where: { code },
            include: {
                redemptions: {
                    select: { doctorId: true, redeemedAt: true },
                },
            },
        });
        if (!promo) {
            return res.json({ found: false, code, message: 'No existe en la base de datos' });
        }
        res.json({
            found: true,
            code: promo.code,
            type: promo.type,
            isActive: promo.isActive,
            usados: `${promo.redemptionCount}/${promo.maxRedemptions}`,
            validFrom: promo.validFrom,
            validUntil: promo.validUntil,
            redemptions: promo.redemptions,
        });
    }
    catch (e) {
        res.status(500).json({
            error: 'Error al buscar código',
            message: e.message,
        });
    }
});
/**
 * Importar códigos desde promo-codes.csv (deben existir en BD PROD para que funcionen).
 * POST /api/admin/reports/promo-codes/import-csv
 */
router.post('/promo-codes/import-csv', async (req, res) => {
    var _a;
    try {
        const { importPromoCodesFromCsv } = require('../../scripts/importPromoCodesFromCsv');
        const csvPath = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.csvPath) ||
            path_1.default.join(process.cwd(), 'data', 'promo-codes.csv');
        const result = await importPromoCodesFromCsv(csvPath);
        res.json({
            success: true,
            message: 'Importación completada',
            csvPath: path_1.default.resolve(csvPath),
            result,
        });
    }
    catch (e) {
        res.status(500).json({
            error: 'Error importando códigos',
            message: e.message,
        });
    }
});
/** Listado de códigos promocionales — GET /api/admin/reports/promo-codes */
router.get('/promo-codes', async (_req, res) => {
    try {
        const promos = await database_1.default.promoCode.findMany({
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
    }
    catch (e) {
        res.status(500).json({
            error: 'Error al consultar códigos promocionales',
            message: e.message,
        });
    }
});
/**
 * c) Reporte mensual de clientes que pagan (profesionales con suscripción activa)
 * Datos fiscales y correo para facturación Qlinexa360
 * GET /api/admin/reports/billing-monthly?month=2025-02
 */
router.get('/billing-monthly', async (req, res) => {
    try {
        const monthParam = req.query.month;
        const month = monthParam || new Date().toISOString().slice(0, 7); // YYYY-MM
        const [startOfMonth, endOfMonth] = [
            new Date(`${month}-01T00:00:00.000Z`),
            new Date(month),
        ];
        endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);
        endOfMonth.setUTCDate(0);
        endOfMonth.setUTCHours(23, 59, 59, 999);
        // Doctores con suscripción ACTIVE cuyo periodo incluye el mes solicitado
        const subscriptions = await database_1.default.subscription.findMany({
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
    }
    catch (e) {
        res.status(500).json({
            error: 'Error al generar reporte de facturación',
            message: e.message,
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
router.post('/subscriptions/sync-free-month-paypal', subscription_controller_1.syncFreeMonthToPayPal);
/**
 * Corregir resumeDate (primer cargo = fin del mes gratis, no +30 días).
 * POST /api/admin/reports/subscriptions/fix-resume-date
 * Body: { email: string }
 */
router.post('/subscriptions/fix-resume-date', subscription_controller_1.fixResumeDateForFreeMonth);
/**
 * Listar pacientes de un doctor (para obtener patientId).
 * GET /api/admin/reports/doctor-patients?doctorEmail=xxx
 * Header: X-Admin-Report-Token o X-Seed-Token
 */
router.get('/doctor-patients', doctor_controller_1.listDoctorPatientsAdmin);
/**
 * Desvincular paciente incorrectamente vinculado a un doctor.
 * Para corregir el bug de email vacío que vinculaba pacientes de otros doctores.
 * POST /api/admin/reports/unlink-incorrect-patient
 * Body: { doctorEmail: string, patientId?: string, patientFirstName?: string, patientLastName?: string }
 * Header: X-Admin-Report-Token o X-Seed-Token
 */
router.post('/unlink-incorrect-patient', doctor_controller_1.unlinkPatientFromDoctor);
/**
 * Buscar pacientes/usuarios por email (para verificar datos en PROD).
 * GET /api/admin/reports/check-patients?emails=dava42@hotmail.com,ext_dgutierrez@qmctelecom.com
 * Header: X-Admin-Report-Token o X-Seed-Token
 */
router.get('/check-patients', async (req, res) => {
    try {
        const emailsParam = req.query.emails;
        if (!emailsParam) {
            return res.status(400).json({ error: 'Falta query param: emails (separados por coma)' });
        }
        const emails = emailsParam.split(',').map((e) => e.trim()).filter(Boolean);
        const users = await database_1.default.user.findMany({
            where: { email: { in: emails } },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                createdAt: true,
                patientProfile: { select: { id: true, dateOfBirth: true, createdAt: true } },
                doctorProfile: { select: { id: true } },
            },
        });
        const patientsByEmail = await database_1.default.patient.findMany({
            where: { email: { in: emails } },
            include: { user: { select: { email: true, firstName: true, lastName: true } } },
        });
        res.json({
            byUser: users,
            byPatientEmail: patientsByEmail.map((p) => ({
                patientId: p.id,
                email: p.email,
                user: p.user,
            })),
        });
    }
    catch (e) {
        res.status(500).json({ error: 'Error', message: e.message });
    }
});
exports.default = router;
