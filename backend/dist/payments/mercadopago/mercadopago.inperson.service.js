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
exports.getInPersonMpFormPolicy = getInPersonMpFormPolicy;
exports.validateInPersonMercadoPagoForPresencialAppointment = validateInPersonMercadoPagoForPresencialAppointment;
exports.getInPersonPaymentContext = getInPersonPaymentContext;
exports.createInPersonPreferenceForAppointment = createInPersonPreferenceForAppointment;
exports.ensureInPersonCheckoutUrl = ensureInPersonCheckoutUrl;
exports.finalizeInPersonAfterPayment = finalizeInPersonAfterPayment;
const database_1 = __importDefault(require("../../config/database"));
const mercadopago_commission_utils_1 = require("./mercadopago.commission.utils");
const mercadopago_preference_service_1 = require("./mercadopago.preference.service");
const mercadopago_teleconsultation_service_1 = require("./mercadopago.teleconsultation.service");
const mercadopago_sync_service_1 = require("./mercadopago.sync.service");
async function getInPersonMpFormPolicy(doctorId) {
    const connected = await (0, mercadopago_teleconsultation_service_1.isMercadoPagoConnected)(doctorId);
    const settings = await (0, mercadopago_teleconsultation_service_1.getDoctorMercadoPagoSettings)(doctorId);
    const enabled = connected && !!(settings === null || settings === void 0 ? void 0 : settings.inPersonEnabled);
    return {
        mercadoPagoConnected: connected,
        showOfferCheckbox: enabled,
        defaultAmount: settings ? (0, mercadopago_commission_utils_1.decimalToNumber)(settings.inPersonDefaultAmount) : 0,
        currency: (settings === null || settings === void 0 ? void 0 : settings.currency) || 'MXN',
    };
}
async function validateInPersonMercadoPagoForPresencialAppointment(doctorId, modalidadConsulta, offerInPersonMercadoPago, inPersonPaymentAmount, patientId) {
    if (modalidadConsulta !== 'presencial') {
        return { ok: true, offer: false, amount: null };
    }
    if (!offerInPersonMercadoPago) {
        return { ok: true, offer: false, amount: null };
    }
    const policy = await getInPersonMpFormPolicy(doctorId);
    if (!policy.showOfferCheckbox) {
        return {
            ok: false,
            message: 'Activa el cobro opcional con Mercado Pago en consultas presenciales desde Mi Perfil antes de ofrecerlo en la cita.',
        };
    }
    if (!patientId) {
        return {
            ok: false,
            message: 'Selecciona un paciente para ofrecer pago con Mercado Pago en consulta presencial.',
        };
    }
    const amount = (0, mercadopago_teleconsultation_service_1.parseTeleconsultationAmountInput)(inPersonPaymentAmount);
    if (amount === null) {
        return { ok: false, message: 'Indica el monto de la consulta presencial (MXN).' };
    }
    return { ok: true, offer: true, amount };
}
async function resolveInPersonChargeAmount(doctorId, appointmentId) {
    const appointment = await database_1.default.appointment.findFirst({
        where: { id: appointmentId, doctorId },
        select: {
            inPersonPaymentAmount: true,
            offerInPersonMercadoPago: true,
            appointmentType: true,
        },
    });
    if (!appointment ||
        appointment.appointmentType !== 'presencial' ||
        !appointment.offerInPersonMercadoPago) {
        return 0;
    }
    if (appointment.inPersonPaymentAmount == null)
        return 0;
    return (0, mercadopago_commission_utils_1.decimalToNumber)(appointment.inPersonPaymentAmount);
}
async function getLatestInPersonPayment(appointmentId) {
    return database_1.default.mercadoPagoPayment.findFirst({
        where: {
            appointmentId,
            paymentType: 'in_person',
            status: { notIn: ['cancelled'] },
        },
        orderBy: { createdAt: 'desc' },
    });
}
async function getInPersonPaymentContext(doctorId, appointmentId) {
    const empty = {
        paymentOffered: false,
        paymentStatus: 'not_required',
        checkoutUrl: null,
        amount: 0,
        currency: 'MXN',
    };
    const appointment = await database_1.default.appointment.findFirst({
        where: { id: appointmentId, doctorId },
        select: {
            appointmentType: true,
            offerInPersonMercadoPago: true,
        },
    });
    if (!appointment ||
        appointment.appointmentType !== 'presencial' ||
        !appointment.offerInPersonMercadoPago) {
        return empty;
    }
    const settings = await (0, mercadopago_teleconsultation_service_1.getDoctorMercadoPagoSettings)(doctorId);
    if (!(settings === null || settings === void 0 ? void 0 : settings.inPersonEnabled) || !(await (0, mercadopago_teleconsultation_service_1.isMercadoPagoConnected)(doctorId))) {
        return empty;
    }
    const amount = await resolveInPersonChargeAmount(doctorId, appointmentId);
    if (amount <= 0)
        return empty;
    const approved = await database_1.default.mercadoPagoPayment.findFirst({
        where: { appointmentId, paymentType: 'in_person', status: 'approved' },
    });
    if (approved) {
        return {
            paymentOffered: true,
            paymentStatus: 'approved',
            checkoutUrl: null,
            amount,
            currency: settings.currency,
        };
    }
    const pending = await getLatestInPersonPayment(appointmentId);
    if ((pending === null || pending === void 0 ? void 0 : pending.status) === 'pending') {
        await (0, mercadopago_sync_service_1.syncPendingMercadoPagoPayment)(pending.id);
        const refreshed = await getLatestInPersonPayment(appointmentId);
        if ((refreshed === null || refreshed === void 0 ? void 0 : refreshed.status) === 'approved') {
            return {
                paymentOffered: true,
                paymentStatus: 'approved',
                checkoutUrl: null,
                amount,
                currency: settings.currency,
            };
        }
        return {
            paymentOffered: true,
            paymentStatus: 'pending',
            checkoutUrl: (refreshed === null || refreshed === void 0 ? void 0 : refreshed.checkoutUrl) || pending.checkoutUrl,
            amount,
            currency: settings.currency,
        };
    }
    return {
        paymentOffered: true,
        paymentStatus: 'pending',
        checkoutUrl: null,
        amount,
        currency: settings.currency,
    };
}
async function createInPersonPreferenceForAppointment(appointmentId, confirmationToken) {
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
    if (appointment.appointmentType !== 'presencial' || !appointment.offerInPersonMercadoPago) {
        throw new Error('Esta cita no ofrece cobro presencial con Mercado Pago');
    }
    const settings = await (0, mercadopago_teleconsultation_service_1.getDoctorMercadoPagoSettings)(appointment.doctorId);
    if (!(settings === null || settings === void 0 ? void 0 : settings.inPersonEnabled) || !(await (0, mercadopago_teleconsultation_service_1.isMercadoPagoConnected)(appointment.doctorId))) {
        throw new Error('Cobro presencial con Mercado Pago no habilitado');
    }
    const amount = await resolveInPersonChargeAmount(appointment.doctorId, appointmentId);
    if (amount <= 0)
        throw new Error('Monto de consulta presencial inválido');
    const existing = await getLatestInPersonPayment(appointmentId);
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
        amount,
        currency: settings.currency,
        paymentType: 'in_person',
        concept: `Consulta presencial - ${doctorName || 'Consulta médica'}`,
        payerEmail: patientEmail,
        confirmationToken,
    });
}
async function ensureInPersonCheckoutUrl(appointmentId, confirmationToken, options) {
    var _a;
    const appointment = await database_1.default.appointment.findUnique({
        where: { id: appointmentId },
        select: { doctorId: true, appointmentType: true, offerInPersonMercadoPago: true },
    });
    if (!appointment ||
        appointment.appointmentType !== 'presencial' ||
        !appointment.offerInPersonMercadoPago) {
        return null;
    }
    const ctx = await getInPersonPaymentContext(appointment.doctorId, appointmentId);
    if (!ctx.paymentOffered || ctx.paymentStatus === 'approved') {
        return null;
    }
    const existing = await getLatestInPersonPayment(appointmentId);
    if ((existing === null || existing === void 0 ? void 0 : existing.status) === 'pending' && existing.checkoutUrl && !(options === null || options === void 0 ? void 0 : options.forceNew)) {
        return existing.checkoutUrl;
    }
    if (options === null || options === void 0 ? void 0 : options.forceNew) {
        await database_1.default.mercadoPagoPayment.updateMany({
            where: { appointmentId, paymentType: 'in_person', status: 'pending' },
            data: { status: 'cancelled' },
        });
    }
    const pref = await createInPersonPreferenceForAppointment(appointmentId, confirmationToken);
    return (_a = pref.checkoutUrl) !== null && _a !== void 0 ? _a : null;
}
/**
 * Tras pago presencial aprobado: sincroniza calendarios y envía invitación Google al paciente.
 */
async function finalizeInPersonAfterPayment(appointmentId) {
    const appointment = await database_1.default.appointment.findUnique({
        where: { id: appointmentId },
        select: {
            doctorId: true,
            appointmentType: true,
            offerInPersonMercadoPago: true,
        },
    });
    if (!appointment ||
        appointment.appointmentType !== 'presencial' ||
        !appointment.offerInPersonMercadoPago) {
        return { finalized: false, reason: 'not_in_person_mp' };
    }
    const approved = await database_1.default.mercadoPagoPayment.findFirst({
        where: { appointmentId, paymentType: 'in_person', status: 'approved' },
        orderBy: { createdAt: 'desc' },
    });
    if (!approved) {
        return { finalized: false, reason: 'payment_not_approved' };
    }
    const alreadyFinalized = await database_1.default.paymentAuditLog.findFirst({
        where: { paymentId: approved.id, eventType: 'IN_PERSON_FINALIZED' },
    });
    if (alreadyFinalized) {
        return { finalized: true, alreadyDone: true };
    }
    const { AppointmentConfirmationController } = await Promise.resolve().then(() => __importStar(require('../../controllers/appointmentConfirmation.controller')));
    await AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
        responseStatus: 'accepted',
        notifyAttendees: true,
    });
    await database_1.default.paymentAuditLog.create({
        data: {
            paymentId: approved.id,
            eventType: 'IN_PERSON_FINALIZED',
            rawPayloadJson: { appointmentId },
        },
    });
    return { finalized: true };
}
