import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getFrontendBaseUrl, mercadoPagoConfig } from '../payments/mercadopago/mercadopago.config';
import { MercadoPagoOAuthService } from '../payments/mercadopago/mercadopago.oauth.service';
import { MercadoPagoPreferenceService } from '../payments/mercadopago/mercadopago.preference.service';
import {
  createTeleconsultationPreferenceForAppointment,
  getDoctorMercadoPagoSettings,
  getTeleconsultationMpFormPolicy,
  getTeleconsultationPaymentContext,
  requiresTeleconsultationPayment,
} from '../payments/mercadopago/mercadopago.teleconsultation.service';
import {
  getInPersonMpFormPolicy,
  getInPersonPaymentContext,
  ensureInPersonCheckoutUrl,
} from '../payments/mercadopago/mercadopago.inperson.service';
import { MercadoPagoWebhookService } from '../payments/mercadopago/mercadopago.webhook.service';
import { decimalToNumber } from '../payments/mercadopago/mercadopago.commission.utils';
import { backfillMissingMercadoPagoFees } from '../payments/mercadopago/mercadopago.payment-fees.service';
import { computeNetToReceive } from '../payments/mercadopago/mercadopago.payment-fees.utils';
import {
  approveRefundRequest as executeApproveRefundRequest,
  listRefundRequestsForDoctor,
  RefundRequestError,
  rejectRefundRequest as executeRejectRefundRequest,
} from '../payments/mercadopago/mercadopago.refund.service';
import { securityLogger } from '../utils/logger.utils';
import { shouldAllowVideoConferenceForAppointment } from '../utils/calendarSync.utils';

async function resolveDoctorId(req: AuthRequest): Promise<string | null> {
  if (!req.user) return null;

  if (req.user.role === 'DOCTOR') {
    if (req.user.doctorId) return req.user.doctorId;
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.userId },
      select: { id: true },
    });
    return doctor?.id || null;
  }

  if (req.user.role === 'ASISTENTE') {
    const selectedDoctorId = req.headers['x-selected-doctor-id'];
    if (!selectedDoctorId || Array.isArray(selectedDoctorId)) return null;

    const link = await prisma.asistenteDoctorVinculo.findFirst({
      where: {
        doctorId: selectedDoctorId,
        asistenteId: req.user.userId,
        activo: true,
      },
      select: { id: true },
    });

    if (!link) return null;
    return selectedDoctorId;
  }

  return null;
}

export class MercadoPagoController {
  static async connect(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'Solo doctores pueden conectar Mercado Pago' });
      if (!mercadoPagoConfig.isConfigured()) {
        return res.status(503).json({ error: 'Mercado Pago no configurado en el servidor' });
      }
      const url = MercadoPagoOAuthService.getConnectUrl(doctorId);
      return res.json({ success: true, url });
    } catch (error) {
      securityLogger.error('MP connect error:', error);
      return res.status(500).json({ error: 'Error al iniciar conexión con Mercado Pago' });
    }
  }

  static connectBootstrap(req: Request, res: Response) {
    const loginPath = `${getFrontendBaseUrl()}/login`;
    res.type('html').send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Conectar Mercado Pago</title></head>
<body><p>Redirigiendo a Mercado Pago…</p>
<script>
(function () {
  var token = localStorage.getItem('token');
  if (!token) { window.location.replace(${JSON.stringify(loginPath)}); return; }
  var base = window.location.pathname;
  window.location.replace(base + '?token=' + encodeURIComponent(token));
})();
</script></body></html>`);
  }

  static async connectRedirect(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'No autorizado' });
      const url = MercadoPagoOAuthService.getConnectUrl(doctorId);
      return res.redirect(url);
    } catch (error) {
      return res.status(500).json({ error: 'Error al redirigir a Mercado Pago' });
    }
  }

  static async callback(req: Request, res: Response) {
    try {
      const { code, state, error: oauthError } = req.query;
      const frontend = getFrontendBaseUrl();
      if (oauthError) {
        return res.redirect(`${frontend}/dashboard/profile?mp=error&reason=${encodeURIComponent(String(oauthError))}`);
      }
      if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
        return res.redirect(`${frontend}/dashboard/profile?mp=error&reason=missing_code`);
      }
      await MercadoPagoOAuthService.handleCallback(code, state);
      return res.redirect(`${frontend}/dashboard/profile?mp=connected`);
    } catch (error) {
      securityLogger.error('MP callback error:', error);
      const frontend = getFrontendBaseUrl();
      return res.redirect(`${frontend}/dashboard/profile?mp=error`);
    }
  }

  static async disconnect(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'No autorizado' });
      await MercadoPagoOAuthService.disconnect(doctorId);
      return res.json({ success: true, message: 'Mercado Pago desconectado' });
    } catch (error) {
      return res.status(500).json({ error: 'Error al desconectar Mercado Pago' });
    }
  }

  static async status(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'No autorizado' });
      const status = await MercadoPagoOAuthService.getConnectionStatus(doctorId);
      const settings = await getDoctorMercadoPagoSettings(doctorId);
      return res.json({
        success: true,
        ...status,
        teleconsultationSettings: settings
          ? {
              enabled: settings.enabled,
              mandatoryBeforeVirtualLink: settings.mandatoryBeforeVirtualLink,
              amount: decimalToNumber(settings.amount),
              currency: settings.currency,
              refundPolicyText: settings.refundPolicyText,
              autoCancelOnPaymentRejected: settings.autoCancelOnPaymentRejected,
              inPersonEnabled: settings.inPersonEnabled,
              inPersonDefaultAmount: decimalToNumber(settings.inPersonDefaultAmount),
            }
          : null,
      });
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener estado' });
    }
  }

  static async getTeleconsultationSettings(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'No autorizado' });
      const settings = await getDoctorMercadoPagoSettings(doctorId);
      const chargePolicy = await getTeleconsultationMpFormPolicy(doctorId);
      const inPersonPolicy = await getInPersonMpFormPolicy(doctorId);
      return res.json({
        success: true,
        mercadoPagoConnected: chargePolicy.mercadoPagoConnected,
        chargePolicy: {
          showAmountField: chargePolicy.showAmountField,
          amountRequired: chargePolicy.amountRequired,
          defaultAmount: chargePolicy.defaultAmount,
          currency: chargePolicy.currency,
          inPersonShowOfferCheckbox: inPersonPolicy.showOfferCheckbox,
          inPersonDefaultAmount: inPersonPolicy.defaultAmount,
        },
        settings: settings
          ? {
              enabled: settings.enabled,
              mandatoryBeforeVirtualLink: settings.mandatoryBeforeVirtualLink,
              amount: decimalToNumber(settings.amount),
              currency: settings.currency,
              refundPolicyText: settings.refundPolicyText,
              autoCancelOnPaymentRejected: settings.autoCancelOnPaymentRejected,
              inPersonEnabled: settings.inPersonEnabled,
              inPersonDefaultAmount: decimalToNumber(settings.inPersonDefaultAmount),
            }
          : {
              enabled: false,
              mandatoryBeforeVirtualLink: false,
              amount: 0,
              currency: 'MXN',
              refundPolicyText: null,
              autoCancelOnPaymentRejected: false,
              inPersonEnabled: false,
              inPersonDefaultAmount: 0,
            },
      });
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener configuración' });
    }
  }

  static async updateTeleconsultationSettings(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'No autorizado' });

      const conn = await MercadoPagoOAuthService.getConnectionStatus(doctorId);
      if (!conn.connected) {
        return res.status(400).json({ error: 'Conecta Mercado Pago antes de configurar cobros' });
      }

      const {
        enabled,
        mandatoryBeforeVirtualLink,
        amount,
        currency,
        refundPolicyText,
        autoCancelOnPaymentRejected,
        inPersonEnabled,
        inPersonDefaultAmount,
      } = req.body || {};

      const settings = await prisma.doctorMercadoPagoSettings.upsert({
        where: { doctorId },
        create: {
          doctorId,
          enabled: !!enabled,
          mandatoryBeforeVirtualLink: !!mandatoryBeforeVirtualLink,
          amount: Number(amount) || 0,
          currency: currency || 'MXN',
          refundPolicyText: refundPolicyText || null,
          autoCancelOnPaymentRejected: !!autoCancelOnPaymentRejected,
          inPersonEnabled: !!inPersonEnabled,
          inPersonDefaultAmount: Number(inPersonDefaultAmount) || 0,
        },
        update: {
          enabled: enabled !== undefined ? !!enabled : undefined,
          mandatoryBeforeVirtualLink:
            mandatoryBeforeVirtualLink !== undefined ? !!mandatoryBeforeVirtualLink : undefined,
          amount: amount !== undefined ? Number(amount) || 0 : undefined,
          currency: currency || undefined,
          refundPolicyText: refundPolicyText !== undefined ? refundPolicyText || null : undefined,
          autoCancelOnPaymentRejected:
            autoCancelOnPaymentRejected !== undefined ? !!autoCancelOnPaymentRejected : undefined,
          inPersonEnabled: inPersonEnabled !== undefined ? !!inPersonEnabled : undefined,
          inPersonDefaultAmount:
            inPersonDefaultAmount !== undefined ? Number(inPersonDefaultAmount) || 0 : undefined,
        },
      });

      return res.json({
        success: true,
        settings: {
          enabled: settings.enabled,
          mandatoryBeforeVirtualLink: settings.mandatoryBeforeVirtualLink,
          amount: decimalToNumber(settings.amount),
          currency: settings.currency,
          refundPolicyText: settings.refundPolicyText,
          autoCancelOnPaymentRejected: settings.autoCancelOnPaymentRejected,
          inPersonEnabled: settings.inPersonEnabled,
          inPersonDefaultAmount: decimalToNumber(settings.inPersonDefaultAmount),
        },
      });
    } catch (error) {
      return res.status(500).json({ error: 'Error al guardar configuración' });
    }
  }

  static async createTeleconsultationPreference(req: Request, res: Response) {
    try {
      const { token } = req.body || {};
      if (!token) return res.status(400).json({ error: 'Token requerido' });

      const confirmationRequest = await prisma.appointmentConfirmationRequest.findUnique({
        where: { confirmationToken: token },
        include: { appointment: true },
      });
      if (!confirmationRequest) return res.status(404).json({ error: 'Enlace no válido' });

      const teleconsultation = await prisma.teleconsultation.findUnique({
        where: { appointmentId: confirmationRequest.appointmentId },
      });
      if (!teleconsultation?.consentSigned) {
        return res.status(400).json({ error: 'Debes firmar el consentimiento primero' });
      }

      const result = await createTeleconsultationPreferenceForAppointment(
        confirmationRequest.appointmentId,
        token
      );
      return res.json({
        success: true,
        checkoutUrl: result.checkoutUrl,
        paymentStatus: result.payment.status,
      });
    } catch (error) {
      securityLogger.error('createTeleconsultationPreference:', error);
      return res.status(500).json({ error: (error as Error).message || 'Error al crear preferencia' });
    }
  }

  static async createInPersonPreference(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'No autorizado' });

      const { appointmentId, patientId, amount, concept } = req.body || {};
      if (!patientId || !amount) {
        return res.status(400).json({ error: 'patientId y amount son requeridos' });
      }

      const patient = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

      let payerEmail = patient.email || undefined;
      if (!payerEmail) {
        const user = await prisma.user.findUnique({ where: { id: patient.userId }, select: { email: true } });
        payerEmail = user?.email || undefined;
      }

      const result = await MercadoPagoPreferenceService.createPreference({
        doctorId,
        patientId,
        appointmentId: appointmentId || null,
        amount: Number(amount),
        currency: 'MXN',
        paymentType: 'in_person',
        concept: concept || 'Consulta presencial',
        payerEmail,
      });

      return res.json({
        success: true,
        checkoutUrl: result.checkoutUrl,
        paymentId: result.payment.id,
        externalReference: result.externalReference,
      });
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message || 'Error al crear cobro' });
    }
  }

  static async webhook(req: Request, res: Response) {
    return MercadoPagoController.handleWebhook(req, res, req.body || {});
  }

  /** IPN legacy de Mercado Pago (GET ?topic=&id=). */
  static async webhookGet(req: Request, res: Response) {
    const topic = String(req.query.topic || '');
    const id = req.query.id != null ? String(req.query.id) : '';

    let body: Record<string, unknown>;
    if (topic === 'merchant_order') {
      body = {
        topic,
        resource: id ? `https://api.mercadolibre.com/merchant_orders/${id}` : '',
        user_id: req.query.user_id,
      };
    } else if (topic === 'payment' || id) {
      body = {
        type: 'payment',
        action: 'payment.updated',
        data: { id },
        user_id: req.query.user_id,
      };
    } else {
      body = { topic, ...(req.query as Record<string, unknown>) };
    }

    return MercadoPagoController.handleWebhook(req, res, body);
  }

  private static async handleWebhook(
    req: Request,
    res: Response,
    body: Record<string, unknown>
  ) {
    try {
      const result = await MercadoPagoWebhookService.processWebhook(body, {
        'x-signature': req.headers['x-signature'] as string | undefined,
        'x-request-id': req.headers['x-request-id'] as string | undefined,
      });
      return res.status(200).json({ received: true, ...result });
    } catch (error) {
      securityLogger.error('MP webhook error:', error);
      return res.status(400).json({ error: 'Webhook rejected' });
    }
  }

  static async listTransactions(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'No autorizado' });

      await backfillMissingMercadoPagoFees(doctorId);

      const { from, to, status, paymentType, patientId, page = '1', limit = '50' } = req.query;
      const where: Record<string, unknown> = { doctorId };
      if (status) where.status = String(status);
      if (paymentType) where.paymentType = String(paymentType);
      if (patientId) where.patientId = String(patientId);
      if (from || to) {
        where.createdAt = {
          ...(from ? { gte: new Date(String(from)) } : {}),
          ...(to ? { lte: new Date(String(to)) } : {}),
        };
      }

      const take = Math.min(parseInt(String(limit), 10) || 50, 200);
      const skip = (Math.max(parseInt(String(page), 10) || 1, 1) - 1) * take;

      const [items, total, aggregates] = await Promise.all([
        prisma.mercadoPagoPayment.findMany({
          where,
          include: {
            patient: { select: { firstName: true, lastName: true, email: true } },
            appointment: { select: { date: true, appointmentType: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.mercadoPagoPayment.count({ where }),
        prisma.mercadoPagoPayment.groupBy({
          by: ['status'],
          where: { doctorId },
          _sum: {
            amount: true,
            platformCommissionAmount: true,
            providerProcessingFeeAmount: true,
          },
          _count: true,
        }),
      ]);

      const approved = aggregates.find((a) => a.status === 'approved');
      const pending = aggregates.find((a) => a.status === 'pending');
      const totalApproved = decimalToNumber(approved?._sum.amount);
      const totalCommission = decimalToNumber(approved?._sum.platformCommissionAmount);
      const totalMercadoPagoCommission = decimalToNumber(approved?._sum.providerProcessingFeeAmount);

      return res.json({
        success: true,
        data: items.map((p) => ({
          id: p.id,
          amount: decimalToNumber(p.amount),
          currency: p.currency,
          status: p.status,
          paymentType: p.paymentType,
          concept: p.concept,
          externalReference: p.externalReference,
          providerPaymentId: p.providerPaymentId,
          platformCommissionAmount: decimalToNumber(p.platformCommissionAmount),
          providerProcessingFeeAmount: decimalToNumber(p.providerProcessingFeeAmount),
          netReceivedAmount: p.netReceivedAmount != null ? decimalToNumber(p.netReceivedAmount) : null,
          refundedAmount: decimalToNumber(p.refundedAmount),
          paidAt: p.paidAt,
          createdAt: p.createdAt,
          patient: p.patient,
          appointment: p.appointment,
          checkoutUrl: p.checkoutUrl,
        })),
        pagination: { total, page: Number(page), limit: take },
        kpis: {
          totalApproved,
          totalCommission,
          totalMercadoPagoCommission,
          pendingCount: pending?._count || 0,
          pendingAmount: decimalToNumber(pending?._sum.amount),
        },
      });
    } catch (error) {
      return res.status(500).json({ error: 'Error al listar transacciones' });
    }
  }

  static async exportTransactionsExcel(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'No autorizado' });

      await backfillMissingMercadoPagoFees(doctorId, 50);

      const { from, to } = req.query;
      const where: Record<string, unknown> = { doctorId };
      if (from || to) {
        where.createdAt = {
          ...(from ? { gte: new Date(String(from)) } : {}),
          ...(to ? { lte: new Date(String(to)) } : {}),
        };
      }

      const items = await prisma.mercadoPagoPayment.findMany({
        where,
        include: { patient: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      });

      const formatFinanzasDateTime = (date: Date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = String(date.getDate()).padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        const time = date.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        return `${day}-${month}-${year} ${time}`;
      };

      const formatMoneyMx = (value: number) =>
        `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const statusLabels: Record<string, string> = {
        pending: 'Pendiente',
        approved: 'Pagado',
        rejected: 'Rechazado',
        cancelled: 'Cancelado',
        refunded: 'Reembolsado',
        charged_back: 'Contracargo',
      };

      const paymentTypeLabels: Record<string, string> = {
        teleconsultation: 'Teleconsulta',
        in_person: 'Presencial',
      };

      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Cobros MP');
      sheet.columns = [
        { header: 'Fecha', key: 'createdAt', width: 24 },
        { header: 'Paciente', key: 'patient', width: 30 },
        { header: 'Tipo', key: 'paymentType', width: 16 },
        { header: 'Concepto', key: 'concept', width: 30 },
        { header: 'Cobrado', key: 'amount', width: 16 },
        { header: 'Comisión Qlinexa360', key: 'commission', width: 20 },
        { header: 'Comisión Mercado Pago', key: 'mpCommission', width: 22 },
        { header: 'Neto a recibir', key: 'netReceived', width: 16 },
        { header: 'Estado', key: 'status', width: 14 },
        { header: 'Referencia externa', key: 'externalReference', width: 36 },
        { header: 'ID MP', key: 'providerPaymentId', width: 20 },
      ];

      let totalAmount = 0;
      let totalCommission = 0;
      let totalMpCommission = 0;
      let totalNetReceived = 0;

      for (const p of items) {
        const amount = decimalToNumber(p.amount);
        const commission = decimalToNumber(p.platformCommissionAmount);
        const mpCommission = decimalToNumber(p.providerProcessingFeeAmount);
        const netReceived = computeNetToReceive(
          amount,
          commission,
          mpCommission,
          p.netReceivedAmount != null ? decimalToNumber(p.netReceivedAmount) : null
        );
        if (p.status === 'approved') {
          totalAmount += amount;
          totalCommission += commission;
          totalMpCommission += mpCommission;
          totalNetReceived += netReceived;
        }
        sheet.addRow({
          createdAt: formatFinanzasDateTime(p.createdAt),
          patient: `${p.patient.firstName} ${p.patient.lastName}`.trim(),
          paymentType: paymentTypeLabels[p.paymentType] || p.paymentType,
          concept: p.concept,
          amount: formatMoneyMx(amount),
          commission: formatMoneyMx(commission),
          mpCommission: formatMoneyMx(mpCommission),
          netReceived: formatMoneyMx(netReceived),
          status: statusLabels[p.status] || p.status,
          externalReference: p.externalReference,
          providerPaymentId: p.providerPaymentId,
        });
      }

      sheet.addRow({});
      const totalsRow = sheet.addRow({
        createdAt: 'Totales (pagados)',
        patient: '',
        paymentType: '',
        concept: '',
        amount: formatMoneyMx(totalAmount),
        commission: formatMoneyMx(totalCommission),
        mpCommission: formatMoneyMx(totalMpCommission),
        netReceived: formatMoneyMx(totalNetReceived),
        status: '',
        externalReference: '',
        providerPaymentId: '',
      });
      totalsRow.font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=cobros-mercadopago.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      return res.status(500).json({ error: 'Error al exportar' });
    }
  }

  static async getAppointmentPaymentStatus(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'No autorizado' });
      const { appointmentId } = req.params;
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { doctorId: true },
      });
      if (!appointment || appointment.doctorId !== doctorId) {
        return res.status(404).json({ error: 'Cita no encontrada' });
      }
      const ctx = await getTeleconsultationPaymentContext(appointment.doctorId, appointmentId);
      const teleconsultation = await prisma.teleconsultation.findUnique({
        where: { appointmentId },
        select: { meetingUrl: true, consentSigned: true },
      });
      const appointmentMeta = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { confirmationStatus: true, appointmentType: true },
      });
      let meetingUrl = teleconsultation?.meetingUrl ?? null;
      if (
        appointmentMeta?.appointmentType === 'teleconsulta' &&
        teleconsultation?.consentSigned &&
        ctx.paymentRequired &&
        ctx.paymentStatus === 'approved' &&
        !meetingUrl
      ) {
        try {
          const { finalizeTeleconsultationAfterPayment } = await import(
            '../payments/mercadopago/mercadopago.teleconsultation.service'
          );
          await finalizeTeleconsultationAfterPayment(appointmentId);
          const refreshed = await prisma.teleconsultation.findUnique({
            where: { appointmentId },
            select: { meetingUrl: true },
          });
          meetingUrl = refreshed?.meetingUrl ?? null;
        } catch {
          // Mantener estado de pago aunque falle la reconciliación del enlace
        }
      }

      const paymentApproved = ctx.paymentStatus === 'approved';
      const canShowMeeting = shouldAllowVideoConferenceForAppointment(
        appointmentMeta?.appointmentType ?? '',
        teleconsultation?.consentSigned,
        ctx.paymentRequired,
        paymentApproved
      );
      if (!canShowMeeting) {
        meetingUrl = null;
      }

      return res.json({
        success: true,
        ...ctx,
        consentSigned: teleconsultation?.consentSigned ?? false,
        confirmationStatus: appointmentMeta?.confirmationStatus ?? null,
        meetingUrl,
      });
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener estado de pago' });
    }
  }

  static async getInPersonPaymentStatusByToken(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const confirmationRequest = await prisma.appointmentConfirmationRequest.findUnique({
        where: { confirmationToken: token },
        include: { appointment: true },
      });
      if (!confirmationRequest) return res.status(404).json({ error: 'Enlace no válido' });

      const ctx = await getInPersonPaymentContext(
        confirmationRequest.appointment.doctorId,
        confirmationRequest.appointmentId
      );
      if (ctx.paymentOffered && ctx.paymentStatus === 'pending' && !ctx.checkoutUrl) {
        try {
          const checkoutUrl = await ensureInPersonCheckoutUrl(
            confirmationRequest.appointmentId,
            token
          );
          return res.json({ success: true, ...ctx, checkoutUrl });
        } catch {
          return res.json({ success: true, ...ctx });
        }
      }
      if (ctx.paymentOffered && ctx.paymentStatus === 'approved') {
        try {
          const { finalizeInPersonAfterPayment } = await import(
            '../payments/mercadopago/mercadopago.inperson.service'
          );
          await finalizeInPersonAfterPayment(confirmationRequest.appointmentId);
        } catch {
          // Mantener estado de pago aunque falle la sincronización de calendario
        }
      }
      return res.json({ success: true, ...ctx });
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener estado de pago presencial' });
    }
  }

  static async listRefundRequests(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'No autorizado' });

      const { status, limit } = req.query;
      const data = await listRefundRequestsForDoctor(doctorId, {
        status: status ? String(status) : undefined,
        limit: limit ? parseInt(String(limit), 10) : undefined,
      });

      const pendingCount = await prisma.mercadoPagoRefundRequest.count({
        where: { doctorId, status: 'pending' },
      });

      return res.json({ success: true, data, pendingCount });
    } catch (error) {
      return res.status(500).json({ error: 'Error al listar solicitudes de reembolso' });
    }
  }

  static async approveRefundRequest(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'No autorizado' });

      const { id } = req.params;
      const { approvedAmount, doctorNotes } = req.body || {};
      const result = await executeApproveRefundRequest(
        doctorId,
        id,
        { approvedAmount, doctorNotes },
        req.user?.userId
      );
      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof RefundRequestError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      securityLogger.error('approveRefundRequest failed', {
        refundRequestId: req.params.id,
        error,
      });
      const message =
        error instanceof Error ? error.message : 'Error al aprobar reembolso';
      return res.status(502).json({ error: message });
    }
  }

  static async rejectRefundRequest(req: AuthRequest, res: Response) {
    try {
      const doctorId = await resolveDoctorId(req);
      if (!doctorId) return res.status(403).json({ error: 'No autorizado' });

      const { id } = req.params;
      const { doctorNotes } = req.body || {};
      const result = await executeRejectRefundRequest(
        doctorId,
        id,
        { doctorNotes },
        req.user?.userId
      );
      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof RefundRequestError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Error al rechazar solicitud' });
    }
  }
}

export { getTeleconsultationPaymentContext };
