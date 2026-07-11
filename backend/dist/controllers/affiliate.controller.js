"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AffiliateController = void 0;
const database_1 = __importDefault(require("../config/database"));
const affiliateAudit_service_1 = require("../services/affiliateAudit.service");
const affiliateBank_utils_1 = require("../utils/affiliateBank.utils");
const affiliateCode_utils_1 = require("../utils/affiliateCode.utils");
const affiliate_constants_1 = require("../constants/affiliate.constants");
/** Resuelve el perfil de afiliado del usuario autenticado. */
async function getOwnProfileOr404(req, res) {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return null;
    }
    const profile = await database_1.default.affiliateProfile.findUnique({ where: { userId } });
    if (!profile) {
        res.status(404).json({ success: false, message: 'Perfil de afiliado no encontrado' });
        return null;
    }
    return profile;
}
async function getActiveVatRate() {
    const rule = await database_1.default.affiliateCommissionRule.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
    });
    return rule ? Number(rule.vatRate) : affiliate_constants_1.DEFAULT_VAT_RATE;
}
class AffiliateController {
    /** Perfil + configuración de comisión del afiliado. */
    static async getMyProfile(req, res) {
        const profile = await getOwnProfileOr404(req, res);
        if (!profile)
            return;
        return res.json({
            success: true,
            data: {
                id: profile.id,
                fullName: profile.fullName,
                email: profile.email,
                phone: profile.phone,
                country: profile.country,
                affiliateCode: profile.affiliateCode,
                status: profile.status,
                commissionPercentage: Number(profile.defaultCommissionPercentage),
                commissionMonths: profile.defaultCommissionMonths
            }
        });
    }
    /** Dashboard: código, %, meses, base sin IVA, médicos registrados/pagando, totales por estado. */
    static async getMyDashboard(req, res) {
        const profile = await getOwnProfileOr404(req, res);
        if (!profile)
            return;
        const vatRate = await getActiveVatRate();
        const exampleGross = 499;
        const exampleNet = Math.round((exampleGross / (1 + vatRate)) * 100) / 100;
        const exampleCommission = Math.round(exampleNet * (Number(profile.defaultCommissionPercentage) / 100) * 100) / 100;
        const [totalReferrals, payingReferrals, byStatus] = await Promise.all([
            database_1.default.affiliateReferral.count({ where: { affiliateId: profile.id } }),
            database_1.default.affiliateReferral.count({
                where: { affiliateId: profile.id, status: 'ACTIVE_PAID' }
            }),
            database_1.default.affiliateCommission.groupBy({
                by: ['status'],
                where: { affiliateId: profile.id },
                _sum: { commissionAmount: true },
                _count: { _all: true }
            })
        ]);
        const commissionsByStatus = byStatus.map((s) => ({
            status: s.status,
            count: s._count._all,
            amount: Number(s._sum.commissionAmount || 0)
        }));
        return res.json({
            success: true,
            data: {
                affiliateCode: profile.affiliateCode,
                status: profile.status,
                commissionPercentage: Number(profile.defaultCommissionPercentage),
                commissionMonths: profile.defaultCommissionMonths,
                vatRate,
                baseExplanation: {
                    gross: exampleGross,
                    vatRatePercent: Math.round(vatRate * 10000) / 100,
                    net: exampleNet,
                    commissionPercentage: Number(profile.defaultCommissionPercentage),
                    commission: exampleCommission,
                    text: `El precio al doctor es $${exampleGross} MXN IVA incluido. La comisión se calcula sobre la base sin IVA ($${exampleNet}), no sobre los $${exampleGross}.`
                },
                totalReferrals,
                payingReferrals,
                commissionsByStatus
            }
        });
    }
    /** Médicos referidos por el afiliado. */
    static async getMyReferrals(req, res) {
        const profile = await getOwnProfileOr404(req, res);
        if (!profile)
            return;
        const referrals = await database_1.default.affiliateReferral.findMany({
            where: { affiliateId: profile.id },
            orderBy: { registrationDate: 'desc' }
        });
        return res.json({
            success: true,
            data: referrals.map((r) => ({
                id: r.id,
                doctorName: r.doctorName,
                doctorEmail: r.doctorEmail,
                status: r.status,
                registrationDate: r.registrationDate,
                firstPaymentDate: r.firstPaymentDate
            }))
        });
    }
    /** Comisiones del afiliado (filtro por status). */
    static async getMyCommissions(req, res) {
        const profile = await getOwnProfileOr404(req, res);
        if (!profile)
            return;
        const { status } = req.query;
        const where = { affiliateId: profile.id };
        if (status && ['PENDING', 'APPROVED', 'PAID', 'CANCELLED', 'REVERSED'].includes(status)) {
            where.status = status;
        }
        const commissions = await database_1.default.affiliateCommission.findMany({
            where,
            orderBy: { paymentDate: 'desc' },
            take: 1000,
            include: { referral: { select: { doctorName: true, doctorEmail: true } } }
        });
        return res.json({
            success: true,
            data: commissions.map((c) => {
                var _a, _b;
                return ({
                    id: c.id,
                    doctorName: (_a = c.referral) === null || _a === void 0 ? void 0 : _a.doctorName,
                    doctorEmail: (_b = c.referral) === null || _b === void 0 ? void 0 : _b.doctorEmail,
                    paymentDate: c.paymentDate,
                    commissionMonthNumber: c.commissionMonthNumber,
                    paymentAmountGross: Number(c.paymentAmountGross),
                    paymentAmountNet: Number(c.paymentAmountNet),
                    commissionPercentage: Number(c.commissionPercentage),
                    commissionAmount: Number(c.commissionAmount),
                    currency: c.currency,
                    status: c.status,
                    paidAt: c.paidAt
                });
            })
        });
    }
    /** Cuenta bancaria activa del afiliado (datos sensibles, solo el propio afiliado y admin). */
    static async getMyBankAccount(req, res) {
        const profile = await getOwnProfileOr404(req, res);
        if (!profile)
            return;
        const [account, rule] = await Promise.all([
            database_1.default.affiliateBankAccount.findFirst({
                where: { affiliateId: profile.id, isActive: true },
                orderBy: { createdAt: 'desc' }
            }),
            database_1.default.affiliateCommissionRule.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } })
        ]);
        return res.json({
            success: true,
            data: account || null,
            minPayoutAmountMxn: rule ? Number(rule.minPayoutAmountMxn) : 200
        });
    }
    /** Crea/actualiza la cuenta bancaria del afiliado (valida MX/LATAM). */
    static async upsertBankAccount(req, res) {
        var _a;
        const profile = await getOwnProfileOr404(req, res);
        if (!profile)
            return;
        const validation = (0, affiliateBank_utils_1.validateBankAccount)(req.body || {});
        if (!validation.valid || !validation.data) {
            return res.status(400).json({ success: false, message: 'Datos bancarios inválidos', errors: validation.errors });
        }
        const account = await database_1.default.$transaction(async (tx) => {
            await tx.affiliateBankAccount.updateMany({
                where: { affiliateId: profile.id, isActive: true },
                data: { isActive: false }
            });
            return tx.affiliateBankAccount.create({
                data: Object.assign({ affiliateId: profile.id, isActive: true }, validation.data)
            });
        });
        void (0, affiliateAudit_service_1.recordAffiliateAudit)({
            actorUserId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId,
            action: affiliate_constants_1.AFFILIATE_AUDIT_ACTIONS.BANK_ACCOUNT_UPDATED,
            targetType: 'AffiliateBankAccount',
            targetId: account.id,
            metadata: { affiliateId: profile.id, country: validation.data.country }
        });
        return res.status(201).json({ success: true, data: { id: account.id } });
    }
    /** GET /api/affiliate/validate?code= — público (registro de doctores). */
    static async validateAffiliateCode(req, res) {
        try {
            const code = (0, affiliateCode_utils_1.normalizeAffiliateCode)(req.query.code);
            if (!code || code.length < 8) {
                return res.status(400).json({ valid: false, message: 'Código inválido' });
            }
            const affiliate = await database_1.default.affiliateProfile.findUnique({
                where: { affiliateCode: code },
                select: { fullName: true, status: true },
            });
            if (!affiliate) {
                return res.json({ valid: false, message: 'Código no encontrado' });
            }
            if (affiliate.status !== 'ACTIVE') {
                return res.json({ valid: false, message: 'Este código de afiliado no está activo' });
            }
            const parts = (affiliate.fullName || '').trim().split(/\s+/).filter(Boolean);
            const displayHint = parts.length >= 2
                ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`
                : parts[0] || 'Afiliado Qlinexa360';
            return res.json({
                valid: true,
                message: 'Código válido',
                displayHint,
                trialDaysGranted: affiliate_constants_1.DEFAULT_AFFILIATE_TRIAL_DAYS,
            });
        }
        catch (e) {
            console.error('validateAffiliateCode:', e);
            return res.status(500).json({ valid: false, message: 'Error al validar' });
        }
    }
}
exports.AffiliateController = AffiliateController;
