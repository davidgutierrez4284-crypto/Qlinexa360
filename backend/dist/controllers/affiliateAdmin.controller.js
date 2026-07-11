"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AffiliateAdminController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const exceljs_1 = __importDefault(require("exceljs"));
const database_1 = __importDefault(require("../config/database"));
const affiliateAudit_service_1 = require("../services/affiliateAudit.service");
const affiliateCode_utils_1 = require("../utils/affiliateCode.utils");
const affiliate_constants_1 = require("../constants/affiliate.constants");
const affiliatePayout_service_1 = require("../services/affiliatePayout.service");
const notification_service_1 = require("../services/notification.service");
const COMMISSION_STATUSES = ['PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'CANCELLED', 'REVERSED'];
function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
class AffiliateAdminController {
    /** Lista de afiliados con métricas básicas. */
    static async listAffiliates(req, res) {
        const [affiliates, rule] = await Promise.all([
            database_1.default.affiliateProfile.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: { select: { referrals: true, commissions: true } },
                    bankAccounts: { where: { isActive: true }, take: 1 }
                }
            }),
            database_1.default.affiliateCommissionRule.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } })
        ]);
        const minPayout = rule ? Number(rule.minPayoutAmountMxn) : 200;
        const data = await Promise.all(affiliates.map(async (a) => {
            const [pending, paid] = await Promise.all([
                database_1.default.affiliateCommission.aggregate({
                    where: { affiliateId: a.id, status: { in: ['PENDING', 'APPROVED'] } },
                    _sum: { commissionAmount: true }
                }),
                database_1.default.affiliateCommission.aggregate({
                    where: { affiliateId: a.id, status: 'PAID' },
                    _sum: { commissionAmount: true }
                })
            ]);
            const pendingAmount = Number(pending._sum.commissionAmount || 0);
            const bank = a.bankAccounts[0];
            const payoutMethod = (bank === null || bank === void 0 ? void 0 : bank.payoutMethod) || null;
            const payoutTarget = bank
                ? bank.payoutMethod === 'PAYPAL'
                    ? bank.paypalEmail || null
                    : bank.clabe || null
                : null;
            return {
                id: a.id,
                fullName: a.fullName,
                email: a.email,
                phone: a.phone,
                country: a.country,
                affiliateCode: a.affiliateCode,
                status: a.status,
                defaultCommissionPercentage: Number(a.defaultCommissionPercentage),
                defaultCommissionMonths: a.defaultCommissionMonths,
                referralsCount: a._count.referrals,
                commissionsCount: a._count.commissions,
                pendingCommissionAmount: pendingAmount,
                paidCommissionAmount: Number(paid._sum.commissionAmount || 0),
                payoutMethod,
                payoutTarget,
                hasPayoutData: !!payoutTarget,
                readyToPay: pendingAmount >= minPayout && pendingAmount > 0,
                minPayoutAmountMxn: minPayout,
                createdAt: a.createdAt
            };
        }));
        return res.json({ success: true, data, minPayoutAmountMxn: minPayout, paypalPayoutsEnabled: (0, affiliatePayout_service_1.arePaypalPayoutsEnabled)() });
    }
    /** Paga vía PayPal Payouts todas las comisiones pendientes (PENDING/APPROVED) de un afiliado. */
    static async payAffiliatePaypal(req, res) {
        var _a;
        const { id } = req.params;
        const result = await (0, affiliatePayout_service_1.payAffiliateViaPaypal)(id, (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId);
        return res.status(result.ok ? 200 : result.status).json({
            success: result.ok,
            message: result.message,
            data: result.data
        });
    }
    /** Crea un afiliado (User rol AFFILIATE + AffiliateProfile). Devuelve contraseña temporal. */
    static async createAffiliate(req, res) {
        var _a;
        const { fullName, email, phone, country, code, commissionPercentage, commissionMonths, status } = req.body;
        const cleanFullName = String(fullName || '').trim();
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (cleanFullName.length < 3) {
            return res.status(400).json({ success: false, message: 'Nombre completo requerido' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ success: false, message: 'Email inválido' });
        }
        // "Afiliado" es una capacidad, no un rol exclusivo: si el email ya pertenece a un
        // usuario (p. ej. un paciente), se le vincula un AffiliateProfile sin cambiar su rol
        // ni su contraseña. Así un paciente/usuario puede ser además afiliado.
        const existingUser = await database_1.default.user.findUnique({
            where: { email: cleanEmail },
            include: { affiliateProfile: { select: { id: true } } }
        });
        if (existingUser === null || existingUser === void 0 ? void 0 : existingUser.affiliateProfile) {
            return res.status(400).json({ success: false, message: 'Este usuario ya es afiliado' });
        }
        if (existingUser && existingUser.role === 'DOCTOR') {
            // Caso "doctor afiliado": decisión diferida. Reversible quitando este bloqueo.
            return res.status(400).json({
                success: false,
                message: 'Por ahora un doctor no puede registrarse como afiliado (pendiente de definir).'
            });
        }
        // Resolver el código: manual (validado) o automático (único).
        let affiliateCode = (0, affiliateCode_utils_1.normalizeAffiliateCode)(code);
        let poolCodeId = null;
        if (affiliateCode) {
            const [inProfile, poolCode] = await Promise.all([
                database_1.default.affiliateProfile.findUnique({ where: { affiliateCode }, select: { id: true } }),
                database_1.default.affiliateCode.findUnique({ where: { code: affiliateCode } })
            ]);
            if (inProfile) {
                return res.status(400).json({ success: false, message: 'Ese código ya está en uso' });
            }
            if (poolCode) {
                if (poolCode.status === 'ASSIGNED') {
                    return res.status(400).json({ success: false, message: 'Ese código ya fue asignado' });
                }
                poolCodeId = poolCode.id;
            }
        }
        else {
            // Sin código manual: consumir el siguiente código DISPONIBLE del lote (FIFO);
            // si el lote está vacío, generar uno nuevo y único.
            const nextPoolCode = await database_1.default.affiliateCode.findFirst({
                where: { status: 'AVAILABLE', affiliateId: null },
                orderBy: { createdAt: 'asc' }
            });
            if (nextPoolCode) {
                affiliateCode = nextPoolCode.code;
                poolCodeId = nextPoolCode.id;
            }
            else {
                affiliateCode = await (0, affiliateCode_utils_1.generateUniqueAffiliateCode)(database_1.default);
            }
        }
        const [firstName, ...rest] = cleanFullName.split(' ');
        const isLinkingExisting = !!existingUser;
        let tempPassword = null;
        const profile = await database_1.default.$transaction(async (tx) => {
            let targetUserId;
            if (existingUser) {
                // Vincular a la cuenta existente: conserva su rol y su contraseña actual.
                targetUserId = existingUser.id;
            }
            else {
                // Afiliado "puro": se crea el usuario con rol AFFILIATE y contraseña temporal.
                tempPassword = (0, crypto_1.randomBytes)(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
                const hashedPassword = await bcryptjs_1.default.hash(tempPassword, 10);
                const user = await tx.user.create({
                    data: {
                        email: cleanEmail,
                        password: hashedPassword,
                        firstName: firstName || cleanFullName,
                        lastName: rest.join(' ') || '',
                        role: 'AFFILIATE',
                        phone: phone ? String(phone) : null
                    }
                });
                targetUserId = user.id;
            }
            const created = await tx.affiliateProfile.create({
                data: {
                    userId: targetUserId,
                    affiliateCode,
                    fullName: cleanFullName,
                    email: cleanEmail,
                    phone: phone ? String(phone) : null,
                    country: country ? String(country) : null,
                    status: ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(String(status)) ? status : 'ACTIVE',
                    defaultCommissionPercentage: commissionPercentage != null ? num(commissionPercentage, affiliate_constants_1.DEFAULT_COMMISSION_PERCENTAGE) : affiliate_constants_1.DEFAULT_COMMISSION_PERCENTAGE,
                    defaultCommissionMonths: commissionMonths != null ? num(commissionMonths, affiliate_constants_1.DEFAULT_COMMISSION_MONTHS) : affiliate_constants_1.DEFAULT_COMMISSION_MONTHS
                }
            });
            if (poolCodeId) {
                await tx.affiliateCode.update({
                    where: { id: poolCodeId },
                    data: { status: 'ASSIGNED', affiliateId: created.id }
                });
            }
            return created;
        });
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            actorUserId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId,
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.AFFILIATE_CREATED,
            targetType: 'AffiliateProfile',
            targetId: profile.id,
            metadata: { affiliateCode, email: cleanEmail, linkedToExisting: isLinkingExisting }
        });
        void notification_service_1.NotificationService.getInstance().sendAffiliateWelcomeEmail({
            toEmail: cleanEmail,
            fullName: cleanFullName,
            affiliateCode,
            commissionPercentage: Number(profile.defaultCommissionPercentage),
            commissionMonths: profile.defaultCommissionMonths,
            linkedToExisting: isLinkingExisting,
            freeMonthsForDoctor: affiliate_constants_1.DEFAULT_FREE_MONTHS_FOR_DOCTOR
        });
        return res.status(201).json({
            success: true,
            data: {
                id: profile.id,
                affiliateCode,
                email: cleanEmail,
                tempPassword,
                linkedToExisting: isLinkingExisting
            }
        });
    }
    /** Actualiza estatus / porcentaje / meses / datos de contacto del afiliado. */
    static async updateAffiliate(req, res) {
        var _a;
        const { id } = req.params;
        const { fullName, phone, country, status, commissionPercentage, commissionMonths } = req.body;
        const existing = await database_1.default.affiliateProfile.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
        }
        const data = {};
        if (fullName != null)
            data.fullName = String(fullName).trim();
        if (phone != null)
            data.phone = String(phone);
        if (country != null)
            data.country = String(country);
        if (status != null) {
            if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(String(status))) {
                return res.status(400).json({ success: false, message: 'Estatus inválido' });
            }
            data.status = status;
        }
        if (commissionPercentage != null)
            data.defaultCommissionPercentage = num(commissionPercentage, affiliate_constants_1.DEFAULT_COMMISSION_PERCENTAGE);
        if (commissionMonths != null)
            data.defaultCommissionMonths = num(commissionMonths, affiliate_constants_1.DEFAULT_COMMISSION_MONTHS);
        const updated = await database_1.default.affiliateProfile.update({ where: { id }, data });
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            actorUserId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId,
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.AFFILIATE_UPDATED,
            targetType: 'AffiliateProfile',
            targetId: id,
            metadata: { changes: data }
        });
        return res.json({ success: true, data: { id: updated.id } });
    }
    /** Detalle de un afiliado: perfil, bancos, referidos y comisiones. */
    static async getAffiliateDetail(req, res) {
        const { id } = req.params;
        const affiliate = await database_1.default.affiliateProfile.findUnique({
            where: { id },
            include: {
                bankAccounts: { orderBy: { createdAt: 'desc' } },
                referrals: { orderBy: { registrationDate: 'desc' } },
                commissions: { orderBy: { paymentDate: 'desc' } }
            }
        });
        if (!affiliate) {
            return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
        }
        return res.json({
            success: true,
            data: Object.assign(Object.assign({}, affiliate), { defaultCommissionPercentage: Number(affiliate.defaultCommissionPercentage), commissions: affiliate.commissions.map((c) => (Object.assign(Object.assign({}, c), { paymentAmountGross: Number(c.paymentAmountGross), paymentAmountNet: Number(c.paymentAmountNet), commissionAmount: Number(c.commissionAmount), vatRate: Number(c.vatRate), commissionPercentage: Number(c.commissionPercentage) }))) })
        });
    }
    /** Genera un código suelto al pool (AVAILABLE). */
    static async generateCode(req, res) {
        const code = await (0, affiliateCode_utils_1.generateUniqueAffiliateCode)(database_1.default);
        const created = await database_1.default.affiliateCode.create({ data: { code, status: 'AVAILABLE' } });
        return res.status(201).json({ success: true, data: { id: created.id, code } });
    }
    /** Genera un lote masivo de códigos (default 1000), evitando colisiones. */
    static async generateCodesBatch(req, res) {
        var _a, _b;
        const count = Math.min(Math.max(num((_a = req.body) === null || _a === void 0 ? void 0 : _a.count, 1000), 1), 5000);
        const batchId = `batch_${Date.now()}_${(0, crypto_1.randomBytes)(4).toString('hex')}`;
        let createdTotal = 0;
        let attempts = 0;
        while (createdTotal < count && attempts < 20) {
            const remaining = count - createdTotal;
            const candidates = (0, affiliateCode_utils_1.generateUniqueCodeBatch)(remaining);
            const result = await database_1.default.affiliateCode.createMany({
                data: candidates.map((code) => ({ code, status: 'AVAILABLE', batchId })),
                skipDuplicates: true
            });
            createdTotal += result.count;
            attempts += 1;
        }
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            actorUserId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.userId,
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.CODES_BATCH_GENERATED,
            targetType: 'AffiliateCode',
            targetId: batchId,
            metadata: { count: createdTotal }
        });
        return res.status(201).json({ success: true, data: { batchId, created: createdTotal } });
    }
    /** Lista del pool de códigos (filtro por status / batch). */
    static async listCodes(req, res) {
        const { status, batchId } = req.query;
        const where = {};
        if (status && ['AVAILABLE', 'ASSIGNED'].includes(status))
            where.status = status;
        if (batchId)
            where.batchId = batchId;
        const codes = await database_1.default.affiliateCode.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 2000,
            include: {
                affiliate: { select: { id: true, fullName: true, email: true, affiliateCode: true } }
            }
        });
        const data = codes.map((c) => {
            var _a, _b, _c, _d;
            return ({
                id: c.id,
                code: c.code,
                status: c.status,
                batchId: c.batchId,
                affiliateId: c.affiliateId,
                createdAt: c.createdAt,
                affiliateName: (_b = (_a = c.affiliate) === null || _a === void 0 ? void 0 : _a.fullName) !== null && _b !== void 0 ? _b : null,
                affiliateEmail: (_d = (_c = c.affiliate) === null || _c === void 0 ? void 0 : _c.email) !== null && _d !== void 0 ? _d : null
            });
        });
        return res.json({ success: true, data });
    }
    /** Exporta el pool de códigos a Excel. */
    static async exportCodesExcel(req, res) {
        var _a;
        const { batchId, status } = req.query;
        const where = {};
        if (status && ['AVAILABLE', 'ASSIGNED'].includes(status))
            where.status = status;
        if (batchId)
            where.batchId = batchId;
        const codes = await database_1.default.affiliateCode.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            include: { affiliate: { select: { fullName: true, email: true } } }
        });
        const wb = new exceljs_1.default.Workbook();
        const ws = wb.addWorksheet('Códigos');
        ws.columns = [
            { header: 'Código', key: 'code', width: 20 },
            { header: 'Estatus', key: 'status', width: 14 },
            { header: 'Afiliado', key: 'affiliateName', width: 28 },
            { header: 'Email afiliado', key: 'affiliateEmail', width: 28 },
            { header: 'Lote', key: 'batchId', width: 28 },
            { header: 'Creado', key: 'createdAt', width: 22 }
        ];
        codes.forEach((c) => {
            var _a, _b, _c, _d;
            return ws.addRow({
                code: c.code,
                status: c.status,
                affiliateName: (_b = (_a = c.affiliate) === null || _a === void 0 ? void 0 : _a.fullName) !== null && _b !== void 0 ? _b : '',
                affiliateEmail: (_d = (_c = c.affiliate) === null || _c === void 0 ? void 0 : _c.email) !== null && _d !== void 0 ? _d : '',
                batchId: c.batchId,
                createdAt: c.createdAt
            });
        });
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            actorUserId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId,
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.COMMISSIONS_EXPORTED,
            targetType: 'AffiliateCode',
            targetId: batchId || 'all',
            metadata: { count: codes.length, kind: 'codes' }
        });
        const buffer = await wb.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="codigos-afiliados.xlsx"`);
        return res.send(Buffer.from(buffer));
    }
    /** Obtiene la regla de comisión activa (crea una por defecto si no existe). */
    static async getCommissionRule(req, res) {
        let rule = await database_1.default.affiliateCommissionRule.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        if (!rule) {
            rule = await database_1.default.affiliateCommissionRule.create({
                data: {
                    name: 'Regla por defecto',
                    commissionPercentage: affiliate_constants_1.DEFAULT_COMMISSION_PERCENTAGE,
                    commissionMonths: affiliate_constants_1.DEFAULT_COMMISSION_MONTHS,
                    vatRate: affiliate_constants_1.DEFAULT_VAT_RATE,
                    freeMonthsForDoctor: affiliate_constants_1.DEFAULT_FREE_MONTHS_FOR_DOCTOR,
                    graceDaysForDoctor: affiliate_constants_1.DEFAULT_GRACE_DAYS_FOR_DOCTOR,
                    isActive: true
                }
            });
        }
        return res.json({
            success: true,
            data: Object.assign(Object.assign({}, rule), { commissionPercentage: Number(rule.commissionPercentage), vatRate: Number(rule.vatRate), minPayoutAmountMxn: Number(rule.minPayoutAmountMxn) })
        });
    }
    /** Crea/actualiza la regla de comisión activa. */
    static async upsertCommissionRule(req, res) {
        var _a;
        const { name, commissionPercentage, commissionMonths, vatRate, freeMonthsForDoctor, graceDaysForDoctor, minPayoutAmountMxn } = req.body;
        const existing = await database_1.default.affiliateCommissionRule.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        const data = {
            name: name ? String(name) : 'Regla por defecto',
            commissionPercentage: num(commissionPercentage, affiliate_constants_1.DEFAULT_COMMISSION_PERCENTAGE),
            commissionMonths: num(commissionMonths, affiliate_constants_1.DEFAULT_COMMISSION_MONTHS),
            vatRate: num(vatRate, affiliate_constants_1.DEFAULT_VAT_RATE),
            freeMonthsForDoctor: num(freeMonthsForDoctor, affiliate_constants_1.DEFAULT_FREE_MONTHS_FOR_DOCTOR),
            graceDaysForDoctor: num(graceDaysForDoctor, affiliate_constants_1.DEFAULT_GRACE_DAYS_FOR_DOCTOR),
            minPayoutAmountMxn: Math.max(num(minPayoutAmountMxn, 200), 0),
            isActive: true
        };
        const rule = existing
            ? await database_1.default.affiliateCommissionRule.update({ where: { id: existing.id }, data })
            : await database_1.default.affiliateCommissionRule.create({ data });
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            actorUserId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId,
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.COMMISSION_RULE_UPDATED,
            targetType: 'AffiliateCommissionRule',
            targetId: rule.id,
            metadata: Object.assign({}, data)
        });
        return res.json({ success: true, data: { id: rule.id } });
    }
    /** Lista comisiones con filtros (status, affiliateId, month, year). */
    static async listCommissions(req, res) {
        const { status, affiliateId, month, year } = req.query;
        const where = {};
        if (status && COMMISSION_STATUSES.includes(status))
            where.status = status;
        if (affiliateId)
            where.affiliateId = affiliateId;
        const y = year ? parseInt(year, 10) : null;
        const m = month ? parseInt(month, 10) : null;
        if (y && m) {
            const from = new Date(Date.UTC(y, m - 1, 1));
            const to = new Date(Date.UTC(y, m, 1));
            where.paymentDate = { gte: from, lt: to };
        }
        else if (y) {
            where.paymentDate = { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) };
        }
        const commissions = await database_1.default.affiliateCommission.findMany({
            where,
            orderBy: { paymentDate: 'desc' },
            take: 1000,
            include: { affiliate: { select: { fullName: true, affiliateCode: true } } }
        });
        const data = commissions.map((c) => {
            var _a, _b;
            return ({
                id: c.id,
                affiliateId: c.affiliateId,
                affiliateName: (_a = c.affiliate) === null || _a === void 0 ? void 0 : _a.fullName,
                affiliateCode: (_b = c.affiliate) === null || _b === void 0 ? void 0 : _b.affiliateCode,
                doctorUserId: c.doctorUserId,
                paypalPaymentId: c.paypalPaymentId,
                paymentDate: c.paymentDate,
                commissionMonthNumber: c.commissionMonthNumber,
                paymentAmountGross: Number(c.paymentAmountGross),
                vatRate: Number(c.vatRate),
                paymentAmountNet: Number(c.paymentAmountNet),
                commissionPercentage: Number(c.commissionPercentage),
                commissionAmount: Number(c.commissionAmount),
                currency: c.currency,
                status: c.status,
                paidAt: c.paidAt
            });
        });
        const totals = await database_1.default.affiliateCommission.groupBy({
            by: ['status'],
            where: affiliateId ? { affiliateId } : {},
            _sum: { commissionAmount: true }
        });
        return res.json({
            success: true,
            data,
            totals: totals.map((t) => ({ status: t.status, amount: Number(t._sum.commissionAmount || 0) }))
        });
    }
    /** Aprueba una comisión PENDING. */
    static async approveCommission(req, res) {
        var _a;
        const { id } = req.params;
        const commission = await database_1.default.affiliateCommission.findUnique({ where: { id } });
        if (!commission)
            return res.status(404).json({ success: false, message: 'Comisión no encontrada' });
        if (commission.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Solo se pueden aprobar comisiones PENDING' });
        }
        await database_1.default.affiliateCommission.update({ where: { id }, data: { status: 'APPROVED' } });
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            actorUserId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId,
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.COMMISSION_APPROVED,
            targetType: 'AffiliateCommission',
            targetId: id
        });
        return res.json({ success: true });
    }
    /** Marca una comisión como pagada (paidAt + paidByAdminUserId). */
    static async markCommissionPaid(req, res) {
        var _a, _b;
        const { id } = req.params;
        const commission = await database_1.default.affiliateCommission.findUnique({ where: { id } });
        if (!commission)
            return res.status(404).json({ success: false, message: 'Comisión no encontrada' });
        if (!['PENDING', 'APPROVED'].includes(commission.status)) {
            return res.status(400).json({ success: false, message: 'Solo se pueden pagar comisiones PENDING o APPROVED' });
        }
        await database_1.default.affiliateCommission.update({
            where: { id },
            data: { status: 'PAID', paidAt: new Date(), paidByAdminUserId: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || null }
        });
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            actorUserId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.userId,
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.COMMISSION_PAID,
            targetType: 'AffiliateCommission',
            targetId: id
        });
        return res.json({ success: true });
    }
    /** Exporta comisiones a Excel con todas las columnas de trazabilidad. */
    static async exportCommissionsExcel(req, res) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const { status, affiliateId, month, year } = req.query;
        const where = {};
        if (status && COMMISSION_STATUSES.includes(status))
            where.status = status;
        if (affiliateId)
            where.affiliateId = affiliateId;
        const y = year ? parseInt(year, 10) : null;
        const m = month ? parseInt(month, 10) : null;
        if (y && m) {
            where.paymentDate = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
        }
        else if (y) {
            where.paymentDate = { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) };
        }
        const commissions = await database_1.default.affiliateCommission.findMany({
            where,
            orderBy: { paymentDate: 'desc' },
            include: {
                affiliate: { include: { bankAccounts: { where: { isActive: true }, take: 1 } } },
                referral: true
            }
        });
        // Mapa de admin que marcó pagada (para columna trazable).
        const adminIds = [...new Set(commissions.map((c) => c.paidByAdminUserId).filter(Boolean))];
        const admins = adminIds.length
            ? await database_1.default.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, firstName: true, lastName: true, email: true } })
            : [];
        const adminMap = new Map(admins.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim() || a.email]));
        const wb = new exceljs_1.default.Workbook();
        const ws = wb.addWorksheet('Comisiones');
        ws.columns = [
            { header: 'Periodo', key: 'periodo', width: 12 },
            { header: 'Affiliate ID', key: 'affiliateId', width: 26 },
            { header: 'Nombre afiliado', key: 'affiliateName', width: 24 },
            { header: 'Código afiliado', key: 'affiliateCode', width: 18 },
            { header: 'País afiliado', key: 'affiliateCountry', width: 14 },
            { header: 'Método de pago', key: 'payoutMethod', width: 16 },
            { header: 'Correo PayPal', key: 'paypalEmail', width: 26 },
            { header: 'Banco', key: 'bankName', width: 20 },
            { header: 'CLABE', key: 'clabe', width: 22 },
            { header: 'SWIFT/BIC', key: 'swiftBic', width: 14 },
            { header: 'IBAN', key: 'iban', width: 24 },
            { header: 'Beneficiario', key: 'beneficiary', width: 24 },
            { header: 'Doctor User ID', key: 'doctorUserId', width: 26 },
            { header: 'Doctor email', key: 'doctorEmail', width: 24 },
            { header: 'Doctor name', key: 'doctorName', width: 22 },
            { header: 'Fecha registro doctor', key: 'registrationDate', width: 20 },
            { header: 'Fecha primer pago', key: 'firstPaymentDate', width: 20 },
            { header: 'PayPal Subscription ID', key: 'paypalSubscriptionId', width: 26 },
            { header: 'PayPal Payment ID', key: 'paypalPaymentId', width: 26 },
            { header: 'Fecha pago PayPal', key: 'paymentDate', width: 20 },
            { header: 'Importe bruto', key: 'gross', width: 14 },
            { header: 'IVA %', key: 'vat', width: 10 },
            { header: 'Base sin IVA', key: 'net', width: 14 },
            { header: 'Comisión %', key: 'pct', width: 12 },
            { header: 'Mes de comisión', key: 'monthNumber', width: 14 },
            { header: 'Duración total comisión', key: 'durationMonths', width: 18 },
            { header: 'Importe comisión', key: 'commissionAmount', width: 16 },
            { header: 'Moneda', key: 'currency', width: 10 },
            { header: 'Estatus comisión', key: 'status', width: 14 },
            { header: 'Fecha marcada pagada', key: 'paidAt', width: 20 },
            { header: 'Usuario admin que marcó pagada', key: 'paidByAdmin', width: 28 },
            { header: 'Calculation trace', key: 'trace', width: 60 }
        ];
        for (const c of commissions) {
            const bank = (_b = (_a = c.affiliate) === null || _a === void 0 ? void 0 : _a.bankAccounts) === null || _b === void 0 ? void 0 : _b[0];
            const trace = c.calculationTraceJson || {};
            const periodo = `${c.paymentDate.getUTCFullYear()}-${String(c.paymentDate.getUTCMonth() + 1).padStart(2, '0')}`;
            ws.addRow({
                periodo,
                affiliateId: c.affiliateId,
                affiliateName: (_c = c.affiliate) === null || _c === void 0 ? void 0 : _c.fullName,
                affiliateCode: (_d = c.affiliate) === null || _d === void 0 ? void 0 : _d.affiliateCode,
                affiliateCountry: ((_e = c.affiliate) === null || _e === void 0 ? void 0 : _e.country) || '',
                payoutMethod: (bank === null || bank === void 0 ? void 0 : bank.payoutMethod) || '',
                paypalEmail: (bank === null || bank === void 0 ? void 0 : bank.paypalEmail) || '',
                bankName: (bank === null || bank === void 0 ? void 0 : bank.bankName) || '',
                clabe: (bank === null || bank === void 0 ? void 0 : bank.clabe) || '',
                swiftBic: (bank === null || bank === void 0 ? void 0 : bank.swiftBic) || '',
                iban: (bank === null || bank === void 0 ? void 0 : bank.iban) || '',
                beneficiary: (bank === null || bank === void 0 ? void 0 : bank.beneficiaryFullName) || '',
                doctorUserId: c.doctorUserId,
                doctorEmail: ((_f = c.referral) === null || _f === void 0 ? void 0 : _f.doctorEmail) || '',
                doctorName: ((_g = c.referral) === null || _g === void 0 ? void 0 : _g.doctorName) || '',
                registrationDate: ((_h = c.referral) === null || _h === void 0 ? void 0 : _h.registrationDate) || '',
                firstPaymentDate: ((_j = c.referral) === null || _j === void 0 ? void 0 : _j.firstPaymentDate) || '',
                paypalSubscriptionId: c.paypalSubscriptionId || '',
                paypalPaymentId: c.paypalPaymentId,
                paymentDate: c.paymentDate,
                gross: Number(c.paymentAmountGross),
                vat: Number(c.vatRate),
                net: Number(c.paymentAmountNet),
                pct: Number(c.commissionPercentage),
                monthNumber: c.commissionMonthNumber,
                durationMonths: (_m = (_k = trace.commissionDurationMonths) !== null && _k !== void 0 ? _k : (_l = c.affiliate) === null || _l === void 0 ? void 0 : _l.defaultCommissionMonths) !== null && _m !== void 0 ? _m : '',
                commissionAmount: Number(c.commissionAmount),
                currency: c.currency,
                status: c.status,
                paidAt: c.paidAt || '',
                paidByAdmin: c.paidByAdminUserId ? adminMap.get(c.paidByAdminUserId) || c.paidByAdminUserId : '',
                trace: JSON.stringify(trace)
            });
        }
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            actorUserId: (_o = req.user) === null || _o === void 0 ? void 0 : _o.userId,
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.COMMISSIONS_EXPORTED,
            targetType: 'AffiliateCommission',
            targetId: affiliateId || 'all',
            metadata: { count: commissions.length, filters: { status, affiliateId, month, year } }
        });
        const buffer = await wb.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="comisiones-afiliados.xlsx"`);
        return res.send(Buffer.from(buffer));
    }
}
exports.AffiliateAdminController = AffiliateAdminController;
