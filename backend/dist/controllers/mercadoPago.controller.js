"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeleconsultationPaymentContext = exports.MercadoPagoController = void 0;
const database_1 = __importDefault(require("../config/database"));
const mercadopago_config_1 = require("../payments/mercadopago/mercadopago.config");
const mercadopago_oauth_service_1 = require("../payments/mercadopago/mercadopago.oauth.service");
const mercadopago_preference_service_1 = require("../payments/mercadopago/mercadopago.preference.service");
const mercadopago_teleconsultation_service_1 = require("../payments/mercadopago/mercadopago.teleconsultation.service");
Object.defineProperty(exports, "getTeleconsultationPaymentContext", { enumerable: true, get: function () { return mercadopago_teleconsultation_service_1.getTeleconsultationPaymentContext; } });
const mercadopago_inperson_service_1 = require("../payments/mercadopago/mercadopago.inperson.service");
const mercadopago_webhook_service_1 = require("../payments/mercadopago/mercadopago.webhook.service");
const mercadopago_commission_utils_1 = require("../payments/mercadopago/mercadopago.commission.utils");
const mercadopago_payment_fees_service_1 = require("../payments/mercadopago/mercadopago.payment-fees.service");
const mercadopago_payment_fees_utils_1 = require("../payments/mercadopago/mercadopago.payment-fees.utils");
const mercadopago_refund_service_1 = require("../payments/mercadopago/mercadopago.refund.service");
const logger_utils_1 = require("../utils/logger.utils");
const calendarSync_utils_1 = require("../utils/calendarSync.utils");
async function resolveDoctorId(req) {
    if (!req.user)
        return null;
    if (req.user.role === 'DOCTOR') {
        if (req.user.doctorId)
            return req.user.doctorId;
        const doctor = await database_1.default.doctor.findUnique({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        return (doctor === null || doctor === void 0 ? void 0 : doctor.id) || null;
    }
    if (req.user.role === 'ASISTENTE') {
        const selectedDoctorId = req.headers['x-selected-doctor-id'];
        if (!selectedDoctorId || Array.isArray(selectedDoctorId))
            return null;
        const link = await database_1.default.asistenteDoctorVinculo.findFirst({
            where: {
                doctorId: selectedDoctorId,
                asistenteId: req.user.userId,
                activo: true,
            },
            select: { id: true },
        });
        if (!link)
            return null;
        return selectedDoctorId;
    }
    return null;
}
class MercadoPagoController {
    static async connect(req, res) {
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'Solo doctores pueden conectar Mercado Pago' });
            if (!mercadopago_config_1.mercadoPagoConfig.isConfigured()) {
                return res.status(503).json({ error: 'Mercado Pago no configurado en el servidor' });
            }
            const url = mercadopago_oauth_service_1.MercadoPagoOAuthService.getConnectUrl(doctorId);
            return res.json({ success: true, url });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('MP connect error:', error);
            return res.status(500).json({ error: 'Error al iniciar conexión con Mercado Pago' });
        }
    }
    static connectBootstrap(req, res) {
        const loginPath = `${(0, mercadopago_config_1.getFrontendBaseUrl)()}/login`;
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
    static async connectRedirect(req, res) {
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'No autorizado' });
            const url = mercadopago_oauth_service_1.MercadoPagoOAuthService.getConnectUrl(doctorId);
            return res.redirect(url);
        }
        catch (error) {
            return res.status(500).json({ error: 'Error al redirigir a Mercado Pago' });
        }
    }
    static async callback(req, res) {
        try {
            const { code, state, error: oauthError } = req.query;
            const frontend = (0, mercadopago_config_1.getFrontendBaseUrl)();
            if (oauthError) {
                return res.redirect(`${frontend}/dashboard/profile?mp=error&reason=${encodeURIComponent(String(oauthError))}`);
            }
            if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
                return res.redirect(`${frontend}/dashboard/profile?mp=error&reason=missing_code`);
            }
            await mercadopago_oauth_service_1.MercadoPagoOAuthService.handleCallback(code, state);
            return res.redirect(`${frontend}/dashboard/profile?mp=connected`);
        }
        catch (error) {
            logger_utils_1.securityLogger.error('MP callback error:', error);
            const frontend = (0, mercadopago_config_1.getFrontendBaseUrl)();
            return res.redirect(`${frontend}/dashboard/profile?mp=error`);
        }
    }
    static async disconnect(req, res) {
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'No autorizado' });
            await mercadopago_oauth_service_1.MercadoPagoOAuthService.disconnect(doctorId);
            return res.json({ success: true, message: 'Mercado Pago desconectado' });
        }
        catch (error) {
            return res.status(500).json({ error: 'Error al desconectar Mercado Pago' });
        }
    }
    static async status(req, res) {
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'No autorizado' });
            const status = await mercadopago_oauth_service_1.MercadoPagoOAuthService.getConnectionStatus(doctorId);
            const settings = await (0, mercadopago_teleconsultation_service_1.getDoctorMercadoPagoSettings)(doctorId);
            return res.json(Object.assign(Object.assign({ success: true }, status), { teleconsultationSettings: settings
                    ? {
                        enabled: settings.enabled,
                        mandatoryBeforeVirtualLink: settings.mandatoryBeforeVirtualLink,
                        amount: (0, mercadopago_commission_utils_1.decimalToNumber)(settings.amount),
                        currency: settings.currency,
                        refundPolicyText: settings.refundPolicyText,
                        autoCancelOnPaymentRejected: settings.autoCancelOnPaymentRejected,
                        inPersonEnabled: settings.inPersonEnabled,
                        inPersonDefaultAmount: (0, mercadopago_commission_utils_1.decimalToNumber)(settings.inPersonDefaultAmount),
                    }
                    : null }));
        }
        catch (error) {
            return res.status(500).json({ error: 'Error al obtener estado' });
        }
    }
    static async getTeleconsultationSettings(req, res) {
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'No autorizado' });
            const settings = await (0, mercadopago_teleconsultation_service_1.getDoctorMercadoPagoSettings)(doctorId);
            const chargePolicy = await (0, mercadopago_teleconsultation_service_1.getTeleconsultationMpFormPolicy)(doctorId);
            const inPersonPolicy = await (0, mercadopago_inperson_service_1.getInPersonMpFormPolicy)(doctorId);
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
                        amount: (0, mercadopago_commission_utils_1.decimalToNumber)(settings.amount),
                        currency: settings.currency,
                        refundPolicyText: settings.refundPolicyText,
                        autoCancelOnPaymentRejected: settings.autoCancelOnPaymentRejected,
                        inPersonEnabled: settings.inPersonEnabled,
                        inPersonDefaultAmount: (0, mercadopago_commission_utils_1.decimalToNumber)(settings.inPersonDefaultAmount),
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
        }
        catch (error) {
            return res.status(500).json({ error: 'Error al obtener configuración' });
        }
    }
    static async updateTeleconsultationSettings(req, res) {
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'No autorizado' });
            const conn = await mercadopago_oauth_service_1.MercadoPagoOAuthService.getConnectionStatus(doctorId);
            if (!conn.connected) {
                return res.status(400).json({ error: 'Conecta Mercado Pago antes de configurar cobros' });
            }
            const { enabled, mandatoryBeforeVirtualLink, amount, currency, refundPolicyText, autoCancelOnPaymentRejected, inPersonEnabled, inPersonDefaultAmount, } = req.body || {};
            const settings = await database_1.default.doctorMercadoPagoSettings.upsert({
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
                    mandatoryBeforeVirtualLink: mandatoryBeforeVirtualLink !== undefined ? !!mandatoryBeforeVirtualLink : undefined,
                    amount: amount !== undefined ? Number(amount) || 0 : undefined,
                    currency: currency || undefined,
                    refundPolicyText: refundPolicyText !== undefined ? refundPolicyText || null : undefined,
                    autoCancelOnPaymentRejected: autoCancelOnPaymentRejected !== undefined ? !!autoCancelOnPaymentRejected : undefined,
                    inPersonEnabled: inPersonEnabled !== undefined ? !!inPersonEnabled : undefined,
                    inPersonDefaultAmount: inPersonDefaultAmount !== undefined ? Number(inPersonDefaultAmount) || 0 : undefined,
                },
            });
            return res.json({
                success: true,
                settings: {
                    enabled: settings.enabled,
                    mandatoryBeforeVirtualLink: settings.mandatoryBeforeVirtualLink,
                    amount: (0, mercadopago_commission_utils_1.decimalToNumber)(settings.amount),
                    currency: settings.currency,
                    refundPolicyText: settings.refundPolicyText,
                    autoCancelOnPaymentRejected: settings.autoCancelOnPaymentRejected,
                    inPersonEnabled: settings.inPersonEnabled,
                    inPersonDefaultAmount: (0, mercadopago_commission_utils_1.decimalToNumber)(settings.inPersonDefaultAmount),
                },
            });
        }
        catch (error) {
            return res.status(500).json({ error: 'Error al guardar configuración' });
        }
    }
    static async createTeleconsultationPreference(req, res) {
        try {
            const { token } = req.body || {};
            if (!token)
                return res.status(400).json({ error: 'Token requerido' });
            const confirmationRequest = await database_1.default.appointmentConfirmationRequest.findUnique({
                where: { confirmationToken: token },
                include: { appointment: true },
            });
            if (!confirmationRequest)
                return res.status(404).json({ error: 'Enlace no válido' });
            const teleconsultation = await database_1.default.teleconsultation.findUnique({
                where: { appointmentId: confirmationRequest.appointmentId },
            });
            if (!(teleconsultation === null || teleconsultation === void 0 ? void 0 : teleconsultation.consentSigned)) {
                return res.status(400).json({ error: 'Debes firmar el consentimiento primero' });
            }
            const result = await (0, mercadopago_teleconsultation_service_1.createTeleconsultationPreferenceForAppointment)(confirmationRequest.appointmentId, token);
            return res.json({
                success: true,
                checkoutUrl: result.checkoutUrl,
                paymentStatus: result.payment.status,
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('createTeleconsultationPreference:', error);
            return res.status(500).json({ error: error.message || 'Error al crear preferencia' });
        }
    }
    static async createInPersonPreference(req, res) {
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'No autorizado' });
            const { appointmentId, patientId, amount, concept } = req.body || {};
            if (!patientId || !amount) {
                return res.status(400).json({ error: 'patientId y amount son requeridos' });
            }
            const patient = await database_1.default.patient.findUnique({ where: { id: patientId } });
            if (!patient)
                return res.status(404).json({ error: 'Paciente no encontrado' });
            let payerEmail = patient.email || undefined;
            if (!payerEmail) {
                const user = await database_1.default.user.findUnique({ where: { id: patient.userId }, select: { email: true } });
                payerEmail = (user === null || user === void 0 ? void 0 : user.email) || undefined;
            }
            const result = await mercadopago_preference_service_1.MercadoPagoPreferenceService.createPreference({
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
        }
        catch (error) {
            return res.status(500).json({ error: error.message || 'Error al crear cobro' });
        }
    }
    static async webhook(req, res) {
        return MercadoPagoController.handleWebhook(req, res, req.body || {});
    }
    /** IPN legacy de Mercado Pago (GET ?topic=&id=). */
    static async webhookGet(req, res) {
        const topic = String(req.query.topic || '');
        const id = req.query.id != null ? String(req.query.id) : '';
        let body;
        if (topic === 'merchant_order') {
            body = {
                topic,
                resource: id ? `https://api.mercadolibre.com/merchant_orders/${id}` : '',
                user_id: req.query.user_id,
            };
        }
        else if (topic === 'payment' || id) {
            body = {
                type: 'payment',
                action: 'payment.updated',
                data: { id },
                user_id: req.query.user_id,
            };
        }
        else {
            body = Object.assign({ topic }, req.query);
        }
        return MercadoPagoController.handleWebhook(req, res, body);
    }
    static async handleWebhook(req, res, body) {
        try {
            const result = await mercadopago_webhook_service_1.MercadoPagoWebhookService.processWebhook(body, {
                'x-signature': req.headers['x-signature'],
                'x-request-id': req.headers['x-request-id'],
            });
            return res.status(200).json(Object.assign({ received: true }, result));
        }
        catch (error) {
            logger_utils_1.securityLogger.error('MP webhook error:', error);
            return res.status(400).json({ error: 'Webhook rejected' });
        }
    }
    static async listTransactions(req, res) {
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'No autorizado' });
            await (0, mercadopago_payment_fees_service_1.backfillMissingMercadoPagoFees)(doctorId);
            const { from, to, status, paymentType, patientId, page = '1', limit = '50' } = req.query;
            const where = { doctorId };
            if (status)
                where.status = String(status);
            if (paymentType)
                where.paymentType = String(paymentType);
            if (patientId)
                where.patientId = String(patientId);
            if (from || to) {
                where.createdAt = Object.assign(Object.assign({}, (from ? { gte: new Date(String(from)) } : {})), (to ? { lte: new Date(String(to)) } : {}));
            }
            const take = Math.min(parseInt(String(limit), 10) || 50, 200);
            const skip = (Math.max(parseInt(String(page), 10) || 1, 1) - 1) * take;
            const [items, total, aggregates] = await Promise.all([
                database_1.default.mercadoPagoPayment.findMany({
                    where,
                    include: {
                        patient: { select: { firstName: true, lastName: true, email: true } },
                        appointment: { select: { date: true, appointmentType: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take,
                }),
                database_1.default.mercadoPagoPayment.count({ where }),
                database_1.default.mercadoPagoPayment.groupBy({
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
            const totalApproved = (0, mercadopago_commission_utils_1.decimalToNumber)(approved === null || approved === void 0 ? void 0 : approved._sum.amount);
            const totalCommission = (0, mercadopago_commission_utils_1.decimalToNumber)(approved === null || approved === void 0 ? void 0 : approved._sum.platformCommissionAmount);
            const totalMercadoPagoCommission = (0, mercadopago_commission_utils_1.decimalToNumber)(approved === null || approved === void 0 ? void 0 : approved._sum.providerProcessingFeeAmount);
            return res.json({
                success: true,
                data: items.map((p) => ({
                    id: p.id,
                    amount: (0, mercadopago_commission_utils_1.decimalToNumber)(p.amount),
                    currency: p.currency,
                    status: p.status,
                    paymentType: p.paymentType,
                    concept: p.concept,
                    externalReference: p.externalReference,
                    providerPaymentId: p.providerPaymentId,
                    platformCommissionAmount: (0, mercadopago_commission_utils_1.decimalToNumber)(p.platformCommissionAmount),
                    providerProcessingFeeAmount: (0, mercadopago_commission_utils_1.decimalToNumber)(p.providerProcessingFeeAmount),
                    netReceivedAmount: p.netReceivedAmount != null ? (0, mercadopago_commission_utils_1.decimalToNumber)(p.netReceivedAmount) : null,
                    refundedAmount: (0, mercadopago_commission_utils_1.decimalToNumber)(p.refundedAmount),
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
                    pendingCount: (pending === null || pending === void 0 ? void 0 : pending._count) || 0,
                    pendingAmount: (0, mercadopago_commission_utils_1.decimalToNumber)(pending === null || pending === void 0 ? void 0 : pending._sum.amount),
                },
            });
        }
        catch (error) {
            return res.status(500).json({ error: 'Error al listar transacciones' });
        }
    }
    static async exportTransactionsExcel(req, res) {
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'No autorizado' });
            await (0, mercadopago_payment_fees_service_1.backfillMissingMercadoPagoFees)(doctorId, 50);
            const { from, to } = req.query;
            const where = { doctorId };
            if (from || to) {
                where.createdAt = Object.assign(Object.assign({}, (from ? { gte: new Date(String(from)) } : {})), (to ? { lte: new Date(String(to)) } : {}));
            }
            const items = await database_1.default.mercadoPagoPayment.findMany({
                where,
                include: { patient: { select: { firstName: true, lastName: true } } },
                orderBy: { createdAt: 'desc' },
            });
            const formatFinanzasDateTime = (date) => {
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
            const formatMoneyMx = (value) => `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const statusLabels = {
                pending: 'Pendiente',
                approved: 'Pagado',
                rejected: 'Rechazado',
                cancelled: 'Cancelado',
                refunded: 'Reembolsado',
                charged_back: 'Contracargo',
            };
            const paymentTypeLabels = {
                teleconsultation: 'Teleconsulta',
                in_person: 'Presencial',
            };
            const ExcelJS = (await Promise.resolve().then(() => __importStar(require('exceljs')))).default;
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
                const amount = (0, mercadopago_commission_utils_1.decimalToNumber)(p.amount);
                const commission = (0, mercadopago_commission_utils_1.decimalToNumber)(p.platformCommissionAmount);
                const mpCommission = (0, mercadopago_commission_utils_1.decimalToNumber)(p.providerProcessingFeeAmount);
                const netReceived = (0, mercadopago_payment_fees_utils_1.computeNetToReceive)(amount, commission, mpCommission, p.netReceivedAmount != null ? (0, mercadopago_commission_utils_1.decimalToNumber)(p.netReceivedAmount) : null);
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
        }
        catch (error) {
            return res.status(500).json({ error: 'Error al exportar' });
        }
    }
    static async getAppointmentPaymentStatus(req, res) {
        var _a, _b, _c, _d, _e;
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'No autorizado' });
            const { appointmentId } = req.params;
            const appointment = await database_1.default.appointment.findUnique({
                where: { id: appointmentId },
                select: { doctorId: true },
            });
            if (!appointment || appointment.doctorId !== doctorId) {
                return res.status(404).json({ error: 'Cita no encontrada' });
            }
            const ctx = await (0, mercadopago_teleconsultation_service_1.getTeleconsultationPaymentContext)(appointment.doctorId, appointmentId);
            const teleconsultation = await database_1.default.teleconsultation.findUnique({
                where: { appointmentId },
                select: { meetingUrl: true, consentSigned: true },
            });
            const appointmentMeta = await database_1.default.appointment.findUnique({
                where: { id: appointmentId },
                select: { confirmationStatus: true, appointmentType: true },
            });
            let meetingUrl = (_a = teleconsultation === null || teleconsultation === void 0 ? void 0 : teleconsultation.meetingUrl) !== null && _a !== void 0 ? _a : null;
            if ((appointmentMeta === null || appointmentMeta === void 0 ? void 0 : appointmentMeta.appointmentType) === 'teleconsulta' &&
                (teleconsultation === null || teleconsultation === void 0 ? void 0 : teleconsultation.consentSigned) &&
                ctx.paymentRequired &&
                ctx.paymentStatus === 'approved' &&
                !meetingUrl) {
                try {
                    const { finalizeTeleconsultationAfterPayment } = await Promise.resolve().then(() => __importStar(require('../payments/mercadopago/mercadopago.teleconsultation.service')));
                    await finalizeTeleconsultationAfterPayment(appointmentId);
                    const refreshed = await database_1.default.teleconsultation.findUnique({
                        where: { appointmentId },
                        select: { meetingUrl: true },
                    });
                    meetingUrl = (_b = refreshed === null || refreshed === void 0 ? void 0 : refreshed.meetingUrl) !== null && _b !== void 0 ? _b : null;
                }
                catch (_f) {
                    // Mantener estado de pago aunque falle la reconciliación del enlace
                }
            }
            const paymentApproved = ctx.paymentStatus === 'approved';
            const canShowMeeting = (0, calendarSync_utils_1.shouldAllowVideoConferenceForAppointment)((_c = appointmentMeta === null || appointmentMeta === void 0 ? void 0 : appointmentMeta.appointmentType) !== null && _c !== void 0 ? _c : '', teleconsultation === null || teleconsultation === void 0 ? void 0 : teleconsultation.consentSigned, ctx.paymentRequired, paymentApproved);
            if (!canShowMeeting) {
                meetingUrl = null;
            }
            return res.json(Object.assign(Object.assign({ success: true }, ctx), { consentSigned: (_d = teleconsultation === null || teleconsultation === void 0 ? void 0 : teleconsultation.consentSigned) !== null && _d !== void 0 ? _d : false, confirmationStatus: (_e = appointmentMeta === null || appointmentMeta === void 0 ? void 0 : appointmentMeta.confirmationStatus) !== null && _e !== void 0 ? _e : null, meetingUrl }));
        }
        catch (error) {
            return res.status(500).json({ error: 'Error al obtener estado de pago' });
        }
    }
    static async getInPersonPaymentStatusByToken(req, res) {
        try {
            const { token } = req.params;
            const confirmationRequest = await database_1.default.appointmentConfirmationRequest.findUnique({
                where: { confirmationToken: token },
                include: { appointment: true },
            });
            if (!confirmationRequest)
                return res.status(404).json({ error: 'Enlace no válido' });
            const ctx = await (0, mercadopago_inperson_service_1.getInPersonPaymentContext)(confirmationRequest.appointment.doctorId, confirmationRequest.appointmentId);
            if (ctx.paymentOffered && ctx.paymentStatus === 'pending' && !ctx.checkoutUrl) {
                try {
                    const checkoutUrl = await (0, mercadopago_inperson_service_1.ensureInPersonCheckoutUrl)(confirmationRequest.appointmentId, token);
                    return res.json(Object.assign(Object.assign({ success: true }, ctx), { checkoutUrl }));
                }
                catch (_a) {
                    return res.json(Object.assign({ success: true }, ctx));
                }
            }
            if (ctx.paymentOffered && ctx.paymentStatus === 'approved') {
                try {
                    const { finalizeInPersonAfterPayment } = await Promise.resolve().then(() => __importStar(require('../payments/mercadopago/mercadopago.inperson.service')));
                    await finalizeInPersonAfterPayment(confirmationRequest.appointmentId);
                }
                catch (_b) {
                    // Mantener estado de pago aunque falle la sincronización de calendario
                }
            }
            return res.json(Object.assign({ success: true }, ctx));
        }
        catch (error) {
            return res.status(500).json({ error: 'Error al obtener estado de pago presencial' });
        }
    }
    static async listRefundRequests(req, res) {
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'No autorizado' });
            const { status, limit } = req.query;
            const data = await (0, mercadopago_refund_service_1.listRefundRequestsForDoctor)(doctorId, {
                status: status ? String(status) : undefined,
                limit: limit ? parseInt(String(limit), 10) : undefined,
            });
            const pendingCount = await database_1.default.mercadoPagoRefundRequest.count({
                where: { doctorId, status: 'pending' },
            });
            return res.json({ success: true, data, pendingCount });
        }
        catch (error) {
            return res.status(500).json({ error: 'Error al listar solicitudes de reembolso' });
        }
    }
    static async approveRefundRequest(req, res) {
        var _a;
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'No autorizado' });
            const { id } = req.params;
            const { approvedAmount, doctorNotes } = req.body || {};
            const result = await (0, mercadopago_refund_service_1.approveRefundRequest)(doctorId, id, { approvedAmount, doctorNotes }, (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId);
            return res.json({ success: true, data: result });
        }
        catch (error) {
            if (error instanceof mercadopago_refund_service_1.RefundRequestError) {
                return res.status(error.statusCode).json({ error: error.message });
            }
            logger_utils_1.securityLogger.error('approveRefundRequest failed', {
                refundRequestId: req.params.id,
                error,
            });
            const message = error instanceof Error ? error.message : 'Error al aprobar reembolso';
            return res.status(502).json({ error: message });
        }
    }
    static async rejectRefundRequest(req, res) {
        var _a;
        try {
            const doctorId = await resolveDoctorId(req);
            if (!doctorId)
                return res.status(403).json({ error: 'No autorizado' });
            const { id } = req.params;
            const { doctorNotes } = req.body || {};
            const result = await (0, mercadopago_refund_service_1.rejectRefundRequest)(doctorId, id, { doctorNotes }, (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId);
            return res.json({ success: true, data: result });
        }
        catch (error) {
            if (error instanceof mercadopago_refund_service_1.RefundRequestError) {
                return res.status(error.statusCode).json({ error: error.message });
            }
            return res.status(500).json({ error: 'Error al rechazar solicitud' });
        }
    }
}
exports.MercadoPagoController = MercadoPagoController;
