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
exports.getAppointmentMercadoPagoDisplayStatus = getAppointmentMercadoPagoDisplayStatus;
exports.cancelAppointmentAfterRefundRequest = cancelAppointmentAfterRefundRequest;
const database_1 = __importDefault(require("../../config/database"));
const mercadopago_refund_service_1 = require("./mercadopago.refund.service");
const mercadopago_inperson_service_1 = require("./mercadopago.inperson.service");
const mercadopago_teleconsultation_service_1 = require("./mercadopago.teleconsultation.service");
async function getAppointmentMercadoPagoDisplayStatus(doctorId, appointmentId, appointmentType, confirmationStatus) {
    var _a, _b;
    const empty = {
        mpPaymentStatus: 'none',
        refundRequestStatus: null,
        paymentLabel: null,
        calendarHighlight: confirmationStatus === 'CANCELLED' ? 'cancelled' : 'normal',
    };
    const refundCtx = await (0, mercadopago_refund_service_1.getRefundContextForAppointment)(appointmentId);
    const rawRefundStatus = (_b = (_a = refundCtx.refundRequest) === null || _a === void 0 ? void 0 : _a.status) !== null && _b !== void 0 ? _b : null;
    const refundStatus = rawRefundStatus === 'pending' ||
        rawRefundStatus === 'completed' ||
        rawRefundStatus === 'rejected' ||
        rawRefundStatus === 'failed'
        ? rawRefundStatus
        : null;
    let paymentStatus = 'none';
    if (appointmentType === 'teleconsulta') {
        const ctx = await (0, mercadopago_teleconsultation_service_1.getTeleconsultationPaymentContext)(doctorId, appointmentId);
        if (ctx.paymentRequired) {
            paymentStatus =
                ctx.paymentStatus === 'approved'
                    ? 'approved'
                    : ctx.paymentStatus === 'refunded'
                        ? 'refunded'
                        : ctx.paymentStatus === 'rejected'
                            ? 'rejected'
                            : 'pending';
        }
    }
    else if (appointmentType === 'presencial') {
        const ctx = await (0, mercadopago_inperson_service_1.getInPersonPaymentContext)(doctorId, appointmentId);
        if (ctx.paymentOffered) {
            paymentStatus =
                ctx.paymentStatus === 'approved'
                    ? 'approved'
                    : ctx.paymentStatus === 'refunded'
                        ? 'refunded'
                        : ctx.paymentStatus === 'rejected'
                            ? 'rejected'
                            : 'pending';
        }
    }
    if (paymentStatus === 'none' && !refundStatus) {
        return empty;
    }
    let paymentLabel = null;
    if (paymentStatus === 'approved')
        paymentLabel = 'Pagado';
    else if (paymentStatus === 'pending')
        paymentLabel = 'Pago pendiente';
    else if (paymentStatus === 'refunded')
        paymentLabel = 'Reembolsado';
    else if (paymentStatus === 'rejected')
        paymentLabel = 'Pago rechazado';
    if (refundStatus === 'pending') {
        paymentLabel = paymentLabel ? `${paymentLabel} · Reembolso solicitado` : 'Reembolso solicitado';
    }
    else if (refundStatus === 'completed') {
        paymentLabel = 'Reembolsado';
    }
    else if (refundStatus === 'failed') {
        paymentLabel = paymentLabel ? `${paymentLabel} · Reembolso fallido` : 'Reembolso fallido';
    }
    let calendarHighlight = 'normal';
    if (confirmationStatus === 'CANCELLED' ||
        refundStatus === 'pending' ||
        refundStatus === 'completed') {
        calendarHighlight =
            refundStatus === 'pending'
                ? 'refund_pending'
                : refundStatus === 'completed' || paymentStatus === 'refunded'
                    ? 'refunded'
                    : 'cancelled';
    }
    return {
        mpPaymentStatus: paymentStatus,
        refundRequestStatus: refundStatus,
        paymentLabel,
        calendarHighlight,
    };
}
async function cancelAppointmentAfterRefundRequest(appointmentId, reason) {
    const appointment = await database_1.default.appointment.findUnique({
        where: { id: appointmentId },
        select: { confirmationStatus: true },
    });
    if (!appointment || appointment.confirmationStatus === 'CANCELLED') {
        return;
    }
    const cancellationReason = `Reembolso solicitado: ${reason}`.slice(0, 500);
    await database_1.default.appointment.update({
        where: { id: appointmentId },
        data: {
            confirmationStatus: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason,
        },
    });
    const confirmationRequest = await database_1.default.appointmentConfirmationRequest.findFirst({
        where: { appointmentId },
        orderBy: { createdAt: 'desc' },
    });
    if (confirmationRequest) {
        await database_1.default.appointmentConfirmationRequest.update({
            where: { id: confirmationRequest.id },
            data: {
                status: 'RESPONDED',
                patientResponse: 'CANCELLED',
                respondedAt: new Date(),
            },
        });
    }
    const { AppointmentConfirmationController } = await Promise.resolve().then(() => __importStar(require('../../controllers/appointmentConfirmation.controller')));
    await AppointmentConfirmationController.syncAppointmentCalendars(appointmentId, {
        cancelExternal: true,
        responseStatus: 'declined',
    });
}
