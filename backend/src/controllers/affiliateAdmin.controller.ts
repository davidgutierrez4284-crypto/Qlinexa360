import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import ExcelJS from 'exceljs';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth.middleware';
import { recordAffiliateAudit } from '../services/affiliateAudit.service';
import {
  generateUniqueAffiliateCode,
  generateUniqueCodeBatch,
  normalizeAffiliateCode
} from '../utils/affiliateCode.utils';
import {
  AFFILIATE_AUDIT_ACTIONS,
  DEFAULT_COMMISSION_MONTHS,
  DEFAULT_COMMISSION_PERCENTAGE,
  DEFAULT_VAT_RATE,
  DEFAULT_FREE_MONTHS_FOR_DOCTOR,
  DEFAULT_GRACE_DAYS_FOR_DOCTOR
} from '../constants/affiliate.constants';
import { arePaypalPayoutsEnabled, payAffiliateViaPaypal } from '../services/affiliatePayout.service';
import { NotificationService } from '../services/notification.service';

const COMMISSION_STATUSES = ['PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'CANCELLED', 'REVERSED'] as const;

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export class AffiliateAdminController {
  /** Lista de afiliados con métricas básicas. */
  static async listAffiliates(req: AuthRequest, res: Response) {
    const [affiliates, rule] = await Promise.all([
      prisma.affiliateProfile.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { referrals: true, commissions: true } },
          bankAccounts: { where: { isActive: true }, take: 1 }
        }
      }),
      prisma.affiliateCommissionRule.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } })
    ]);
    const minPayout = rule ? Number(rule.minPayoutAmountMxn) : 200;
    const data = await Promise.all(
      affiliates.map(async (a) => {
        const [pending, paid] = await Promise.all([
          prisma.affiliateCommission.aggregate({
            where: { affiliateId: a.id, status: { in: ['PENDING', 'APPROVED'] } },
            _sum: { commissionAmount: true }
          }),
          prisma.affiliateCommission.aggregate({
            where: { affiliateId: a.id, status: 'PAID' },
            _sum: { commissionAmount: true }
          })
        ]);
        const pendingAmount = Number(pending._sum.commissionAmount || 0);
        const bank = a.bankAccounts[0];
        const payoutMethod = bank?.payoutMethod || null;
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
      })
    );
    return res.json({ success: true, data, minPayoutAmountMxn: minPayout, paypalPayoutsEnabled: arePaypalPayoutsEnabled() });
  }

  /** Paga vía PayPal Payouts todas las comisiones pendientes (PENDING/APPROVED) de un afiliado. */
  static async payAffiliatePaypal(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const result = await payAffiliateViaPaypal(id, req.user?.userId);
    return res.status(result.ok ? 200 : result.status).json({
      success: result.ok,
      message: result.message,
      data: result.data
    });
  }

  /** Crea un afiliado (User rol AFFILIATE + AffiliateProfile). Devuelve contraseña temporal. */
  static async createAffiliate(req: AuthRequest, res: Response) {
    const {
      fullName,
      email,
      phone,
      country,
      code,
      commissionPercentage,
      commissionMonths,
      status
    } = req.body as Record<string, unknown>;

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
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { affiliateProfile: { select: { id: true } } }
    });
    if (existingUser?.affiliateProfile) {
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
    let affiliateCode = normalizeAffiliateCode(code);
    let poolCodeId: string | null = null;
    if (affiliateCode) {
      const [inProfile, poolCode] = await Promise.all([
        prisma.affiliateProfile.findUnique({ where: { affiliateCode }, select: { id: true } }),
        prisma.affiliateCode.findUnique({ where: { code: affiliateCode } })
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
    } else {
      // Sin código manual: consumir el siguiente código DISPONIBLE del lote (FIFO);
      // si el lote está vacío, generar uno nuevo y único.
      const nextPoolCode = await prisma.affiliateCode.findFirst({
        where: { status: 'AVAILABLE', affiliateId: null },
        orderBy: { createdAt: 'asc' }
      });
      if (nextPoolCode) {
        affiliateCode = nextPoolCode.code;
        poolCodeId = nextPoolCode.id;
      } else {
        affiliateCode = await generateUniqueAffiliateCode(prisma as any);
      }
    }

    const [firstName, ...rest] = cleanFullName.split(' ');
    const isLinkingExisting = !!existingUser;
    let tempPassword: string | null = null;

    const profile = await prisma.$transaction(async (tx) => {
      let targetUserId: string;
      if (existingUser) {
        // Vincular a la cuenta existente: conserva su rol y su contraseña actual.
        targetUserId = existingUser.id;
      } else {
        // Afiliado "puro": se crea el usuario con rol AFFILIATE y contraseña temporal.
        tempPassword = randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
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
          status: ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(String(status)) ? (status as any) : 'ACTIVE',
          defaultCommissionPercentage:
            commissionPercentage != null ? num(commissionPercentage, DEFAULT_COMMISSION_PERCENTAGE) : DEFAULT_COMMISSION_PERCENTAGE,
          defaultCommissionMonths:
            commissionMonths != null ? num(commissionMonths, DEFAULT_COMMISSION_MONTHS) : DEFAULT_COMMISSION_MONTHS
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

    void recordAffiliateAudit({
      actorUserId: req.user?.userId,
      action: AFFILIATE_AUDIT_ACTIONS.AFFILIATE_CREATED,
      targetType: 'AffiliateProfile',
      targetId: profile.id,
      metadata: { affiliateCode, email: cleanEmail, linkedToExisting: isLinkingExisting }
    });

    void NotificationService.getInstance().sendAffiliateWelcomeEmail({
      toEmail: cleanEmail,
      fullName: cleanFullName,
      affiliateCode,
      commissionPercentage: Number(profile.defaultCommissionPercentage),
      commissionMonths: profile.defaultCommissionMonths,
      linkedToExisting: isLinkingExisting,
      freeMonthsForDoctor: DEFAULT_FREE_MONTHS_FOR_DOCTOR
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
  static async updateAffiliate(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { fullName, phone, country, status, commissionPercentage, commissionMonths } =
      req.body as Record<string, unknown>;

    const existing = await prisma.affiliateProfile.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const data: Record<string, unknown> = {};
    if (fullName != null) data.fullName = String(fullName).trim();
    if (phone != null) data.phone = String(phone);
    if (country != null) data.country = String(country);
    if (status != null) {
      if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(String(status))) {
        return res.status(400).json({ success: false, message: 'Estatus inválido' });
      }
      data.status = status;
    }
    if (commissionPercentage != null) data.defaultCommissionPercentage = num(commissionPercentage, DEFAULT_COMMISSION_PERCENTAGE);
    if (commissionMonths != null) data.defaultCommissionMonths = num(commissionMonths, DEFAULT_COMMISSION_MONTHS);

    const updated = await prisma.affiliateProfile.update({ where: { id }, data });

    void recordAffiliateAudit({
      actorUserId: req.user?.userId,
      action: AFFILIATE_AUDIT_ACTIONS.AFFILIATE_UPDATED,
      targetType: 'AffiliateProfile',
      targetId: id,
      metadata: { changes: data }
    });

    return res.json({ success: true, data: { id: updated.id } });
  }

  /** Detalle de un afiliado: perfil, bancos, referidos y comisiones. */
  static async getAffiliateDetail(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const affiliate = await prisma.affiliateProfile.findUnique({
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
      data: {
        ...affiliate,
        defaultCommissionPercentage: Number(affiliate.defaultCommissionPercentage),
        commissions: affiliate.commissions.map((c) => ({
          ...c,
          paymentAmountGross: Number(c.paymentAmountGross),
          paymentAmountNet: Number(c.paymentAmountNet),
          commissionAmount: Number(c.commissionAmount),
          vatRate: Number(c.vatRate),
          commissionPercentage: Number(c.commissionPercentage)
        }))
      }
    });
  }

  /** Genera un código suelto al pool (AVAILABLE). */
  static async generateCode(req: AuthRequest, res: Response) {
    const code = await generateUniqueAffiliateCode(prisma as any);
    const created = await prisma.affiliateCode.create({ data: { code, status: 'AVAILABLE' } });
    return res.status(201).json({ success: true, data: { id: created.id, code } });
  }

  /** Genera un lote masivo de códigos (default 1000), evitando colisiones. */
  static async generateCodesBatch(req: AuthRequest, res: Response) {
    const count = Math.min(Math.max(num(req.body?.count, 1000), 1), 5000);
    const batchId = `batch_${Date.now()}_${randomBytes(4).toString('hex')}`;

    let createdTotal = 0;
    let attempts = 0;
    while (createdTotal < count && attempts < 20) {
      const remaining = count - createdTotal;
      const candidates = generateUniqueCodeBatch(remaining);
      const result = await prisma.affiliateCode.createMany({
        data: candidates.map((code) => ({ code, status: 'AVAILABLE' as const, batchId })),
        skipDuplicates: true
      });
      createdTotal += result.count;
      attempts += 1;
    }

    void recordAffiliateAudit({
      actorUserId: req.user?.userId,
      action: AFFILIATE_AUDIT_ACTIONS.CODES_BATCH_GENERATED,
      targetType: 'AffiliateCode',
      targetId: batchId,
      metadata: { count: createdTotal }
    });

    return res.status(201).json({ success: true, data: { batchId, created: createdTotal } });
  }

  /** Lista del pool de códigos (filtro por status / batch). */
  static async listCodes(req: AuthRequest, res: Response) {
    const { status, batchId } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (status && ['AVAILABLE', 'ASSIGNED'].includes(status)) where.status = status;
    if (batchId) where.batchId = batchId;
    const codes = await prisma.affiliateCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 2000,
      include: {
        affiliate: { select: { id: true, fullName: true, email: true, affiliateCode: true } }
      }
    });
    const data = codes.map((c) => ({
      id: c.id,
      code: c.code,
      status: c.status,
      batchId: c.batchId,
      affiliateId: c.affiliateId,
      createdAt: c.createdAt,
      affiliateName: c.affiliate?.fullName ?? null,
      affiliateEmail: c.affiliate?.email ?? null
    }));
    return res.json({ success: true, data });
  }

  /** Exporta el pool de códigos a Excel. */
  static async exportCodesExcel(req: AuthRequest, res: Response) {
    const { batchId, status } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (status && ['AVAILABLE', 'ASSIGNED'].includes(status)) where.status = status;
    if (batchId) where.batchId = batchId;
    const codes = await prisma.affiliateCode.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { affiliate: { select: { fullName: true, email: true } } }
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Códigos');
    ws.columns = [
      { header: 'Código', key: 'code', width: 20 },
      { header: 'Estatus', key: 'status', width: 14 },
      { header: 'Afiliado', key: 'affiliateName', width: 28 },
      { header: 'Email afiliado', key: 'affiliateEmail', width: 28 },
      { header: 'Lote', key: 'batchId', width: 28 },
      { header: 'Creado', key: 'createdAt', width: 22 }
    ];
    codes.forEach((c) =>
      ws.addRow({
        code: c.code,
        status: c.status,
        affiliateName: c.affiliate?.fullName ?? '',
        affiliateEmail: c.affiliate?.email ?? '',
        batchId: c.batchId,
        createdAt: c.createdAt
      })
    );

    void recordAffiliateAudit({
      actorUserId: req.user?.userId,
      action: AFFILIATE_AUDIT_ACTIONS.COMMISSIONS_EXPORTED,
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
  static async getCommissionRule(req: AuthRequest, res: Response) {
    let rule = await prisma.affiliateCommissionRule.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    if (!rule) {
      rule = await prisma.affiliateCommissionRule.create({
        data: {
          name: 'Regla por defecto',
          commissionPercentage: DEFAULT_COMMISSION_PERCENTAGE,
          commissionMonths: DEFAULT_COMMISSION_MONTHS,
          vatRate: DEFAULT_VAT_RATE,
          freeMonthsForDoctor: DEFAULT_FREE_MONTHS_FOR_DOCTOR,
          graceDaysForDoctor: DEFAULT_GRACE_DAYS_FOR_DOCTOR,
          isActive: true
        }
      });
    }
    return res.json({
      success: true,
      data: {
        ...rule,
        commissionPercentage: Number(rule.commissionPercentage),
        vatRate: Number(rule.vatRate),
        minPayoutAmountMxn: Number(rule.minPayoutAmountMxn)
      }
    });
  }

  /** Crea/actualiza la regla de comisión activa. */
  static async upsertCommissionRule(req: AuthRequest, res: Response) {
    const { name, commissionPercentage, commissionMonths, vatRate, freeMonthsForDoctor, graceDaysForDoctor, minPayoutAmountMxn } =
      req.body as Record<string, unknown>;

    const existing = await prisma.affiliateCommissionRule.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    const data = {
      name: name ? String(name) : 'Regla por defecto',
      commissionPercentage: num(commissionPercentage, DEFAULT_COMMISSION_PERCENTAGE),
      commissionMonths: num(commissionMonths, DEFAULT_COMMISSION_MONTHS),
      vatRate: num(vatRate, DEFAULT_VAT_RATE),
      freeMonthsForDoctor: num(freeMonthsForDoctor, DEFAULT_FREE_MONTHS_FOR_DOCTOR),
      graceDaysForDoctor: num(graceDaysForDoctor, DEFAULT_GRACE_DAYS_FOR_DOCTOR),
      minPayoutAmountMxn: Math.max(num(minPayoutAmountMxn, 200), 0),
      isActive: true
    };

    const rule = existing
      ? await prisma.affiliateCommissionRule.update({ where: { id: existing.id }, data })
      : await prisma.affiliateCommissionRule.create({ data });

    void recordAffiliateAudit({
      actorUserId: req.user?.userId,
      action: AFFILIATE_AUDIT_ACTIONS.COMMISSION_RULE_UPDATED,
      targetType: 'AffiliateCommissionRule',
      targetId: rule.id,
      metadata: { ...data }
    });

    return res.json({ success: true, data: { id: rule.id } });
  }

  /** Lista comisiones con filtros (status, affiliateId, month, year). */
  static async listCommissions(req: AuthRequest, res: Response) {
    const { status, affiliateId, month, year } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (status && (COMMISSION_STATUSES as readonly string[]).includes(status)) where.status = status;
    if (affiliateId) where.affiliateId = affiliateId;
    const y = year ? parseInt(year, 10) : null;
    const m = month ? parseInt(month, 10) : null;
    if (y && m) {
      const from = new Date(Date.UTC(y, m - 1, 1));
      const to = new Date(Date.UTC(y, m, 1));
      where.paymentDate = { gte: from, lt: to };
    } else if (y) {
      where.paymentDate = { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) };
    }

    const commissions = await prisma.affiliateCommission.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      take: 1000,
      include: { affiliate: { select: { fullName: true, affiliateCode: true } } }
    });

    const data = commissions.map((c) => ({
      id: c.id,
      affiliateId: c.affiliateId,
      affiliateName: c.affiliate?.fullName,
      affiliateCode: c.affiliate?.affiliateCode,
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
    }));

    const totals = await prisma.affiliateCommission.groupBy({
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
  static async approveCommission(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const commission = await prisma.affiliateCommission.findUnique({ where: { id } });
    if (!commission) return res.status(404).json({ success: false, message: 'Comisión no encontrada' });
    if (commission.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Solo se pueden aprobar comisiones PENDING' });
    }
    await prisma.affiliateCommission.update({ where: { id }, data: { status: 'APPROVED' } });
    void recordAffiliateAudit({
      actorUserId: req.user?.userId,
      action: AFFILIATE_AUDIT_ACTIONS.COMMISSION_APPROVED,
      targetType: 'AffiliateCommission',
      targetId: id
    });
    return res.json({ success: true });
  }

  /** Marca una comisión como pagada (paidAt + paidByAdminUserId). */
  static async markCommissionPaid(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const commission = await prisma.affiliateCommission.findUnique({ where: { id } });
    if (!commission) return res.status(404).json({ success: false, message: 'Comisión no encontrada' });
    if (!['PENDING', 'APPROVED'].includes(commission.status)) {
      return res.status(400).json({ success: false, message: 'Solo se pueden pagar comisiones PENDING o APPROVED' });
    }
    await prisma.affiliateCommission.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), paidByAdminUserId: req.user?.userId || null }
    });
    void recordAffiliateAudit({
      actorUserId: req.user?.userId,
      action: AFFILIATE_AUDIT_ACTIONS.COMMISSION_PAID,
      targetType: 'AffiliateCommission',
      targetId: id
    });
    return res.json({ success: true });
  }

  /** Exporta comisiones a Excel con todas las columnas de trazabilidad. */
  static async exportCommissionsExcel(req: AuthRequest, res: Response) {
    const { status, affiliateId, month, year } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (status && (COMMISSION_STATUSES as readonly string[]).includes(status)) where.status = status;
    if (affiliateId) where.affiliateId = affiliateId;
    const y = year ? parseInt(year, 10) : null;
    const m = month ? parseInt(month, 10) : null;
    if (y && m) {
      where.paymentDate = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
    } else if (y) {
      where.paymentDate = { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) };
    }

    const commissions = await prisma.affiliateCommission.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        affiliate: { include: { bankAccounts: { where: { isActive: true }, take: 1 } } },
        referral: true
      }
    });

    // Mapa de admin que marcó pagada (para columna trazable).
    const adminIds = [...new Set(commissions.map((c) => c.paidByAdminUserId).filter(Boolean) as string[])];
    const admins = adminIds.length
      ? await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, firstName: true, lastName: true, email: true } })
      : [];
    const adminMap = new Map(admins.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim() || a.email]));

    const wb = new ExcelJS.Workbook();
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
      const bank = c.affiliate?.bankAccounts?.[0];
      const trace = (c.calculationTraceJson as Record<string, unknown>) || {};
      const periodo = `${c.paymentDate.getUTCFullYear()}-${String(c.paymentDate.getUTCMonth() + 1).padStart(2, '0')}`;
      ws.addRow({
        periodo,
        affiliateId: c.affiliateId,
        affiliateName: c.affiliate?.fullName,
        affiliateCode: c.affiliate?.affiliateCode,
        affiliateCountry: c.affiliate?.country || '',
        payoutMethod: bank?.payoutMethod || '',
        paypalEmail: bank?.paypalEmail || '',
        bankName: bank?.bankName || '',
        clabe: bank?.clabe || '',
        swiftBic: bank?.swiftBic || '',
        iban: bank?.iban || '',
        beneficiary: bank?.beneficiaryFullName || '',
        doctorUserId: c.doctorUserId,
        doctorEmail: c.referral?.doctorEmail || '',
        doctorName: c.referral?.doctorName || '',
        registrationDate: c.referral?.registrationDate || '',
        firstPaymentDate: c.referral?.firstPaymentDate || '',
        paypalSubscriptionId: c.paypalSubscriptionId || '',
        paypalPaymentId: c.paypalPaymentId,
        paymentDate: c.paymentDate,
        gross: Number(c.paymentAmountGross),
        vat: Number(c.vatRate),
        net: Number(c.paymentAmountNet),
        pct: Number(c.commissionPercentage),
        monthNumber: c.commissionMonthNumber,
        durationMonths: (trace.commissionDurationMonths as number) ?? c.affiliate?.defaultCommissionMonths ?? '',
        commissionAmount: Number(c.commissionAmount),
        currency: c.currency,
        status: c.status,
        paidAt: c.paidAt || '',
        paidByAdmin: c.paidByAdminUserId ? adminMap.get(c.paidByAdminUserId) || c.paidByAdminUserId : '',
        trace: JSON.stringify(trace)
      });
    }

    void recordAffiliateAudit({
      actorUserId: req.user?.userId,
      action: AFFILIATE_AUDIT_ACTIONS.COMMISSIONS_EXPORTED,
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
