"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoAdminController = void 0;
const database_1 = __importDefault(require("../config/database"));
const mercadopago_commission_utils_1 = require("../payments/mercadopago/mercadopago.commission.utils");
function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
class MercadoPagoAdminController {
    static async listCommissionRules(_req, res) {
        const rules = await database_1.default.platformMercadoPagoCommissionRule.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return res.json({
            success: true,
            data: rules.map((r) => ({
                id: r.id,
                name: r.name,
                commissionPercentage: (0, mercadopago_commission_utils_1.decimalToNumber)(r.commissionPercentage),
                commissionFixedAmount: (0, mercadopago_commission_utils_1.decimalToNumber)(r.commissionFixedAmount),
                minCommissionAmount: (0, mercadopago_commission_utils_1.decimalToNumber)(r.minCommissionAmount),
                maxCommissionAmount: r.maxCommissionAmount != null ? (0, mercadopago_commission_utils_1.decimalToNumber)(r.maxCommissionAmount) : null,
                applyCommissionToTeleconsultation: r.applyCommissionToTeleconsultation,
                applyCommissionToInPersonConsultation: r.applyCommissionToInPersonConsultation,
                isActive: r.isActive,
                createdAt: r.createdAt,
            })),
        });
    }
    static async upsertCommissionRule(req, res) {
        const { id, name, commissionPercentage, commissionFixedAmount, minCommissionAmount, maxCommissionAmount, applyCommissionToTeleconsultation, applyCommissionToInPersonConsultation, isActive, } = req.body || {};
        if (isActive) {
            await database_1.default.platformMercadoPagoCommissionRule.updateMany({
                where: Object.assign({ isActive: true }, (id ? { id: { not: id } } : {})),
                data: { isActive: false },
            });
        }
        const data = {
            name: name || 'Default',
            commissionPercentage: num(commissionPercentage, 1),
            commissionFixedAmount: num(commissionFixedAmount, 0),
            minCommissionAmount: num(minCommissionAmount, 0),
            maxCommissionAmount: maxCommissionAmount != null ? num(maxCommissionAmount, 0) : null,
            applyCommissionToTeleconsultation: applyCommissionToTeleconsultation !== false,
            applyCommissionToInPersonConsultation: applyCommissionToInPersonConsultation !== false,
            isActive: isActive !== false,
        };
        const rule = id
            ? await database_1.default.platformMercadoPagoCommissionRule.update({ where: { id }, data })
            : await database_1.default.platformMercadoPagoCommissionRule.create({ data });
        return res.json({ success: true, rule: Object.assign({ id: rule.id }, data) });
    }
    static async commissionReport(req, res) {
        const { from, to } = req.query;
        const where = { status: 'approved' };
        if (from || to) {
            where.paidAt = Object.assign(Object.assign({}, (from ? { gte: new Date(String(from)) } : {})), (to ? { lte: new Date(String(to)) } : {}));
        }
        const [agg, byType] = await Promise.all([
            database_1.default.mercadoPagoPayment.aggregate({
                where,
                _sum: { amount: true, platformCommissionAmount: true },
                _count: true,
            }),
            database_1.default.mercadoPagoPayment.groupBy({
                by: ['paymentType'],
                where,
                _sum: { amount: true, platformCommissionAmount: true },
                _count: true,
            }),
        ]);
        return res.json({
            success: true,
            totalPayments: agg._count,
            totalVolume: (0, mercadopago_commission_utils_1.decimalToNumber)(agg._sum.amount),
            totalCommission: (0, mercadopago_commission_utils_1.decimalToNumber)(agg._sum.platformCommissionAmount),
            byType: byType.map((b) => ({
                paymentType: b.paymentType,
                count: b._count,
                volume: (0, mercadopago_commission_utils_1.decimalToNumber)(b._sum.amount),
                commission: (0, mercadopago_commission_utils_1.decimalToNumber)(b._sum.platformCommissionAmount),
            })),
        });
    }
}
exports.MercadoPagoAdminController = MercadoPagoAdminController;
