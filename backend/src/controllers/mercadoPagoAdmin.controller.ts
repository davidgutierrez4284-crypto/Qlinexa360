import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth.middleware';
import { decimalToNumber } from '../payments/mercadopago/mercadopago.commission.utils';

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export class MercadoPagoAdminController {
  static async listCommissionRules(_req: AuthRequest, res: Response) {
    const rules = await prisma.platformMercadoPagoCommissionRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json({
      success: true,
      data: rules.map((r) => ({
        id: r.id,
        name: r.name,
        commissionPercentage: decimalToNumber(r.commissionPercentage),
        commissionFixedAmount: decimalToNumber(r.commissionFixedAmount),
        minCommissionAmount: decimalToNumber(r.minCommissionAmount),
        maxCommissionAmount: r.maxCommissionAmount != null ? decimalToNumber(r.maxCommissionAmount) : null,
        applyCommissionToTeleconsultation: r.applyCommissionToTeleconsultation,
        applyCommissionToInPersonConsultation: r.applyCommissionToInPersonConsultation,
        isActive: r.isActive,
        createdAt: r.createdAt,
      })),
    });
  }

  static async upsertCommissionRule(req: AuthRequest, res: Response) {
    const {
      id,
      name,
      commissionPercentage,
      commissionFixedAmount,
      minCommissionAmount,
      maxCommissionAmount,
      applyCommissionToTeleconsultation,
      applyCommissionToInPersonConsultation,
      isActive,
    } = req.body || {};

    if (isActive) {
      await prisma.platformMercadoPagoCommissionRule.updateMany({
        where: { isActive: true, ...(id ? { id: { not: id } } : {}) },
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
      ? await prisma.platformMercadoPagoCommissionRule.update({ where: { id }, data })
      : await prisma.platformMercadoPagoCommissionRule.create({ data });

    return res.json({ success: true, rule: { id: rule.id, ...data } });
  }

  static async commissionReport(req: AuthRequest, res: Response) {
    const { from, to } = req.query;
    const where: Record<string, unknown> = { status: 'approved' };
    if (from || to) {
      where.paidAt = {
        ...(from ? { gte: new Date(String(from)) } : {}),
        ...(to ? { lte: new Date(String(to)) } : {}),
      };
    }

    const [agg, byType] = await Promise.all([
      prisma.mercadoPagoPayment.aggregate({
        where,
        _sum: { amount: true, platformCommissionAmount: true },
        _count: true,
      }),
      prisma.mercadoPagoPayment.groupBy({
        by: ['paymentType'],
        where,
        _sum: { amount: true, platformCommissionAmount: true },
        _count: true,
      }),
    ]);

    return res.json({
      success: true,
      totalPayments: agg._count,
      totalVolume: decimalToNumber(agg._sum.amount),
      totalCommission: decimalToNumber(agg._sum.platformCommissionAmount),
      byType: byType.map((b) => ({
        paymentType: b.paymentType,
        count: b._count,
        volume: decimalToNumber(b._sum.amount),
        commission: decimalToNumber(b._sum.platformCommissionAmount),
      })),
    });
  }
}
