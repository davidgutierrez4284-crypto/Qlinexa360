"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDoctorMercadoPagoSettings = getDoctorMercadoPagoSettings;
exports.isMercadoPagoConnected = isMercadoPagoConnected;
exports.parseTeleconsultationAmountInput = parseTeleconsultationAmountInput;
exports.getTeleconsultationMpFormPolicy = getTeleconsultationMpFormPolicy;
exports.validateTeleconsultationAmountForVirtualAppointment = validateTeleconsultationAmountForVirtualAppointment;
exports.requiresTeleconsultationPayment = requiresTeleconsultationPayment;
exports.getTeleconsultationPaymentContext = getTeleconsultationPaymentContext;
exports.createTeleconsultationPreferenceForAppointment = createTeleconsultationPreferenceForAppointment;
exports.finalizeTeleconsultationAfterPayment = finalizeTeleconsultationAfterPayment;
exports.isTeleconsultationPaymentApproved = isTeleconsultationPaymentApproved;
exports.ensureTeleconsultationCheckoutUrl = ensureTeleconsultationCheckoutUrl;
exports.tryFinalizeTeleconsultationAfterConsent = tryFinalizeTeleconsultationAfterConsent;
const database_1 = __importDefault(require("../../config/database"));
const appointmentConfirmation_controller_1 = require("../../controllers/appointmentConfirmation.controller");
const logger_utils_1 = require("../../utils/logger.utils");
const mercadopago_commission_utils_1 = require("./mercadopago.commission.utils");
const mercadopago_preference_service_1 = require("./mercadopago.preference.service");
const mercadopago_oauth_service_1 = require("./mercadopago.oauth.service");
const mercadopago_sync_service_1 = require("./mercadopago.sync.service");
const mercadopago_refund_service_1 = require("./mercadopago.refund.service");
async function getDoctorMercadoPagoSettings(doctorId) {
    return database_1.default.doctorMercadoPagoSettings.findUnique({ where: { doctorId } });
}
async function isMercadoPagoConnected(doctorId) {
    const status = await mercadopago_oauth_service_1.MercadoPagoOAuthService.getConnectionStatus(doctorId);
    return status.connected;
}
function parseTeleconsultationAmountInput(value) {
    if (value === null || value === undefined || value === "")
        return null;
    const n = typeof value === "number" ? value : parseFloat(String(value));
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return Math.round(n * 100) / 100;
}
async function getTeleconsultationMpFormPolicy(doctorId) {
    const connected = await isMercadoPagoConnected(doctorId);
    const settings = await getDoctorMercadoPagoSettings(doctorId);
    const enabled = connected && !!(settings === null || settings === void 0 ? void 0 : settings.enabled);
    const mandatory = enabled && !!(settings === null || settings === void 0 ? void 0 : settings.mandatoryBeforeVirtualLink);
    return {
        mercadoPagoConnected: connected,
        showAmountField: mandatory,
        amountRequired: mandatory,
        defaultAmount: settings ? (0, mercadopago_commission_utils_1.decimalToNumber)(settings.amount) : 0,
        currency: (settings === null || settings === void 0 ? void 0 : settings.currency) || "MXN",
    };
}
async function validateTeleconsultationAmountForVirtualAppointment(doctorId, modalidadConsulta, teleconsultationAmount, patientId) {
    if (modalidadConsulta !== "virtual")
        return { ok: true, amount: null };
    const policy = await getTeleconsultationMpFormPolicy(doctorId);
    if (!policy.amountRequired)
        return { ok: true, amount: null };
    if (!patientId) {
        return {
            ok: false,
            message: "Las teleconsultas con cobro obligatorio requieren seleccionar un paciente e indicar el monto.",
        };
    }
    const amount = parseTeleconsultationAmountInput(teleconsultationAmount);
    if (amount === null)
        return { ok: false, message: "Indica el monto de teleconsulta (MXN)." };
    return { ok: true, amount };
}
async function resolveTeleconsultationChargeAmount(doctorId, settings, appointmentId) {
    let amount = (0, mercadopago_commission_utils_1.decimalToNumber)(settings.amount);
    if (appointmentId) {
        const appointment = await database_1.default.appointment.findFirst({
            where: { id: appointmentId, doctorId },
            select: { teleconsultationAmount: true, appointmentType: true },
        });
        if ((appointment === null || appointment === void 0 ? void 0 : appointment.appointmentType) === "teleconsulta" && appointment.teleconsultationAmount != null) {
            amount = (0, mercadopago_commission_utils_1.decimalToNumber)(appointment.teleconsultationAmount);
        }
    }
    return amount;
}
async function withRefundContext(doctorId, appointmentId, base) {
    if (!base.paymentRequired || base.paymentStatus === "not_required")
        return base;
    const refundCtx = await (0, mercadopago_refund_service_1.getRefundContextForAppointment)(appointmentId);
    return Object.assign(Object.assign({}, base), { paymentId: refundCtx.paymentId, canRequestRefund: refundCtx.canRequestRefund, refundableAmount: refundCtx.refundableAmount, refundRequest: refundCtx.refundRequest });
}
async function getApprovedTeleconsultationPayment(appointmentId) {
    return database_1.default.mercadoPagoPayment.findFirst({
        where: { appointmentId, paymentType: "teleconsultation", status: "approved" },
        orderBy: { paidAt: "desc" },
    });
}
async function syncAllPendingTeleconsultationPayments(appointmentId) {
    const pending = await database_1.default.mercadoPagoPayment.findMany({
        where: { appointmentId, paymentType: "teleconsultation", status: "pending" },
        orderBy: { createdAt: "desc" },
    });
    for (const row of pending) {
        await (0, mercadopago_sync_service_1.syncPendingMercadoPagoPayment)(row.id);
    }
}
async function requiresTeleconsultationPayment(doctorId, appointmentId) {
    const connected = await isMercadoPagoConnected(doctorId);
    if (!connected) {
        return { required: false, amount: 0, currency: 'MXN', refundPolicyText: null };
    }
    const settings = await getDoctorMercadoPagoSettings(doctorId);
    if (!(settings === null || settings === void 0 ? void 0 : settings.enabled) || !settings.mandatoryBeforeVirtualLink) {
        return {
            required: false,
            amount: 0,
            currency: 'MXN',
            refundPolicyText: (settings === null || settings === void 0 ? void 0 : settings.refundPolicyText) || null,
        };
    }
    const amount = await resolveTeleconsultationChargeAmount(doctorId, settings, appointmentId);
    if (amount <= 0) {
        return {
            required: false,
            amount: 0,
            currency: settings.currency,
            refundPolicyText: settings.refundPolicyText,
        };
    }
    return {
        required: true,
        amount,
        currency: settings.currency,
        refundPolicyText: settings.refundPolicyText,
    };
}
function mapLocalPaymentStatus(status) {
    if (!status || status === 'pending')
        return 'pending';
    if (status === 'approved')
        return 'approved';
    if (status === 'rejected' || status === 'cancelled')
        return 'rejected';
    if (status === 'refunded' || status === 'charged_back')
        return 'refunded';
    return 'pending';
}
async function getTeleconsultationPaymentContext(doctorId, appointmentId) {
    var _a;
    const req = await requiresTeleconsultationPayment(doctorId, appointmentId);
    if (!req.required) {
        return {
            paymentRequired: false,
            paymentStatus: 'not_required',
            checkoutUrl: null,
            amount: 0,
            currency: req.currency,
            refundPolicyText: req.refundPolicyText,
        };
    }
    const approvedBase = {
        paymentRequired: true,
        paymentStatus: 'approved',
        checkoutUrl: null,
        amount: req.amount,
        currency: req.currency,
        refundPolicyText: req.refundPolicyText,
    };
    if (await getApprovedTeleconsultationPayment(appointmentId)) {
        return withRefundContext(doctorId, appointmentId, approvedBase);
    }
    await syncAllPendingTeleconsultationPayments(appointmentId);
    if (await getApprovedTeleconsultationPayment(appointmentId)) {
        return withRefundContext(doctorId, appointmentId, approvedBase);
    }
    const teleconsultation = await database_1.default.teleconsultation.findUnique({
        where: { appointmentId },
        select: { consentSigned: true },
    });
    const consentSigned = (_a = teleconsultation === null || teleconsultation === void 0 ? void 0 : teleconsultation.consentSigned) !== null && _a !== void 0 ? _a : false;
    let payment = await (0, mercadopago_preference_service_1.getLatestTeleconsultationPayment)(appointmentId);
    if ((payment === null || payment === void 0 ? void 0 : payment.status) === 'pending') {
        try {
            const synced = await (0, mercadopago_sync_service_1.syncPendingMercadoPagoPayment)(payment.id);
            if (synced)
                payment = synced;
        }
        catch (err) {
            logger_utils_1.securityLogger.warn('MP teleconsultation: sync on page load failed', {
                appointmentId,
                localPaymentId: payment.id,
                err,
            });
        }
    }
    const mapped = mapLocalPaymentStatus(payment === null || payment === void 0 ? void 0 : payment.status);
    if (mapped === 'pending' && (await getApprovedTeleconsultationPayment(appointmentId))) {
        return withRefundContext(doctorId, appointmentId, approvedBase);
    }
    return withRefundContext(doctorId, appointmentId, {
        paymentRequired: true,
        paymentStatus: mapped,
        checkoutUrl: mapped === 'pending' && consentSigned ? (payment === null || payment === void 0 ? void 0 : payment.checkoutUrl) || null : null,
        amount: req.amount,
        currency: req.currency,
        refundPolicyText: req.refundPolicyText,
    });
}
async function createTeleconsultationPreferenceForAppointment(appointmentId, confirmationToken) {
    var _a, _b, _c;
    const appointment = await database_1.default.appointment.findUnique({
        where: { id: appointmentId },
        include: {
            patient: { include: { user: true } },
            doctor: { include: { user: true } },
        },
    });
    if (!appointment)
        throw new Error('Cita no encontrada');
    const teleconsultation = await database_1.default.teleconsultation.findUnique({
        where: { appointmentId },
        select: { consentSigned: true },
    });
    if (!(teleconsultation === null || teleconsultation === void 0 ? void 0 : teleconsultation.consentSigned)) {
        throw new Error('Debes firmar el consentimiento informado antes de pagar');
    }
    const paymentReq = await requiresTeleconsultationPayment(appointment.doctorId, appointmentId);
    if (!paymentReq.required) {
        throw new Error('Cobro de teleconsulta no requerido');
    }
    const existing = await (0, mercadopago_preference_service_1.getLatestTeleconsultationPayment)(appointmentId);
    if ((existing === null || existing === void 0 ? void 0 : existing.status) === 'pending' && existing.checkoutUrl) {
        return { payment: existing, checkoutUrl: existing.checkoutUrl };
    }
    if ((existing === null || existing === void 0 ? void 0 : existing.status) === 'approved') {
        return { payment: existing, checkoutUrl: null };
    }
    const patientEmail = appointment.patient.email || ((_a = appointment.patient.user) === null || _a === void 0 ? void 0 : _a.email) || undefined;
    const doctorName = `${((_b = appointment.doctor.user) === null || _b === void 0 ? void 0 : _b.firstName) || ''} ${((_c = appointment.doctor.user) === null || _c === void 0 ? void 0 : _c.lastName) || ''}`.trim();
    return mercadopago_preference_service_1.MercadoPagoPreferenceService.createPreference({
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        appointmentId,
        amount: paymentReq.amount,
        currency: paymentReq.currency,
        paymentType: 'teleconsultation',
        concept: `Teleconsulta - ${doctorName || 'Consulta médica'}`,
        payerEmail: patientEmail,
        confirmationToken,
    });
}
async function markTeleconsultationAppointmentConfirmed(appointmentId) {
    await database_1.default.appointment.update({
        where: { id: appointmentId },
        data: {
            status: 'SCHEDULED',
            confirmationStatus: 'CONFIRMED',
            confirmedAt: new Date(),
            cancelledAt: null,
            cancellationReason: null,
        },
    });
    await database_1.default.appointmentConfirmationRequest.updateMany({
        where: { appointmentId, status: 'PENDING' },
        data: { status: 'RESPONDED' },
    });
}
/**
 * Tras pago aprobado: sincroniza calendarios (paciente + doctor).
 * Confirma la cita solo si el consentimiento ya está firmado.
 * La videollamada se habilita vía shouldAllowVideoConferenceForAppointment en sync.
 */
async function finalizeTeleconsultationAfterPayment(appointmentId) {
    var _a;
    const teleconsultation = await database_1.default.teleconsultation.findUnique({ where: { appointmentId } });
    const consentSigned = (_a = teleconsultation === null || teleconsultation === void 0 ? void 0 : teleconsultation.consentSigned) !== null && _a !== void 0 ? _a : false;
    const appointment = await database_1.default.appointment.findUnique({
        where: { id: appointmentId },
        select: { doctorId: true },
    });
    if (!appointment) {
        return { finalized: false, reason: 'appointment_not_found' };
    }
    const req = await requiresTeleconsultationPayment(appointment.doctorId, appointmentId);
    const approvedPayment = req.required ? await getApprovedTeleconsultationPayment(appointmentId) : null;
    if (req.required && !approvedPayment) {
        return { finalized: false, reason: 'payment_not_approved' };
    }
    if (approvedPayment) {
        const alreadyFinalized = await database_1.default.paymentAuditLog.findFirst({
            where: { paymentId: approvedPayment.id, eventType: 'TELECONSULTATION_FINALIZED' },
        });
        if (alreadyFinalized) {
            await appointmentConfirmation_controller_1.AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
                responseStatus: 'accepted',
                notifyAttendees: false,
            });
            return { finalized: true, consentSigned, alreadyDone: true };
        }
    }
    else if (teleconsultation === null || teleconsultation === void 0 ? void 0 : teleconsultation.meetingUrl) {
        await appointmentConfirmation_controller_1.AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
            responseStatus: 'accepted',
            notifyAttendees: false,
        });
        return { finalized: true, consentSigned, alreadyDone: true };
    }
    if (consentSigned) {
        await markTeleconsultationAppointmentConfirmed(appointmentId);
    }
    await appointmentConfirmation_controller_1.AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
        responseStatus: 'accepted',
        notifyAttendees: true,
    });
    await appointmentConfirmation_controller_1.AppointmentConfirmationController.sendPatientTeleconsultationCalendarEmail(appointmentId);
    if (approvedPayment) {
        await database_1.default.paymentAuditLog.create({
            data: {
                paymentId: approvedPayment.id,
                eventType: 'TELECONSULTATION_FINALIZED',
                rawPayloadJson: { appointmentId, consentSigned },
            },
        });
    }
    return { finalized: true, consentSigned };
}
async function isTeleconsultationPaymentApproved(appointmentId) {
    const payment = await database_1.default.mercadoPagoPayment.findFirst({
        where: { appointmentId, paymentType: 'teleconsultation', status: 'approved' },
    });
    return !!payment;
}
/** Crea o reutiliza checkout MP solo tras consentimiento firmado. */
async function ensureTeleconsultationCheckoutUrl(appointmentId, confirmationToken, options) {
    var _a;
    const appointment = await database_1.default.appointment.findUnique({
        where: { id: appointmentId },
        select: { doctorId: true, appointmentType: true },
    });
    if (!appointment || appointment.appointmentType !== 'teleconsulta') {
        return null;
    }
    const teleconsultation = await database_1.default.teleconsultation.findUnique({
        where: { appointmentId },
        select: { consentSigned: true },
    });
    if (!(teleconsultation === null || teleconsultation === void 0 ? void 0 : teleconsultation.consentSigned)) {
        return null;
    }
    const paymentReq = await requiresTeleconsultationPayment(appointment.doctorId, appointmentId);
    if (!paymentReq.required) {
        return null;
    }
    const existing = await (0, mercadopago_preference_service_1.getLatestTeleconsultationPayment)(appointmentId);
    if ((existing === null || existing === void 0 ? void 0 : existing.status) === 'approved') {
        return null;
    }
    if ((existing === null || existing === void 0 ? void 0 : existing.status) === 'pending' && existing.checkoutUrl) {
        if (!(options === null || options === void 0 ? void 0 : options.forceNew)) {
            return existing.checkoutUrl;
        }
        await database_1.default.mercadoPagoPayment.updateMany({
            where: { appointmentId, paymentType: 'teleconsultation', status: 'pending' },
            data: { status: 'cancelled' },
        });
    }
    const pref = await createTeleconsultationPreferenceForAppointment(appointmentId, confirmationToken);
    return (_a = pref.checkoutUrl) !== null && _a !== void 0 ? _a : null;
}
/** Tras firmar consentimiento: finaliza si el pago ya está aprobado o no es obligatorio. */
async function tryFinalizeTeleconsultationAfterConsent(appointmentId) {
    const appointment = await database_1.default.appointment.findUnique({
        where: { id: appointmentId },
        select: { doctorId: true },
    });
    if (!appointment) {
        return { finalized: false, reason: 'appointment_not_found' };
    }
    const req = await requiresTeleconsultationPayment(appointment.doctorId, appointmentId);
    const approvedPayment = await getApprovedTeleconsultationPayment(appointmentId);
    if (approvedPayment) {
        return finalizeTeleconsultationAfterPayment(appointmentId);
    }
    if (!req.required) {
        await markTeleconsultationAppointmentConfirmed(appointmentId);
        await appointmentConfirmation_controller_1.AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
            responseStatus: 'accepted',
            notifyAttendees: true,
        });
        await appointmentConfirmation_controller_1.AppointmentConfirmationController.sendPatientTeleconsultationCalendarEmail(appointmentId);
        return { finalized: true, paymentNotRequired: true };
    }
    await markTeleconsultationAppointmentConfirmed(appointmentId);
    await appointmentConfirmation_controller_1.AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
        responseStatus: 'accepted',
        notifyAttendees: true,
    });
    // Hold en calendario (sin videollamada); enlace Meet/Teams y correo .ics definitivo tras el pago.
    return { finalized: false, reason: 'payment_pending', calendarSynced: true };
}
