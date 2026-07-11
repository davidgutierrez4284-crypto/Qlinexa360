"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPendingMercadoPagoPayment = syncPendingMercadoPagoPayment;
const database_1 = __importDefault(require("../../config/database"));
const logger_utils_1 = require("../../utils/logger.utils");
const mercadopago_oauth_service_1 = require("./mercadopago.oauth.service");
const mercadopago_preference_service_1 = require("./mercadopago.preference.service");
const mercadopago_commission_utils_1 = require("./mercadopago.commission.utils");
const mercadopago_inperson_service_1 = require("./mercadopago.inperson.service");
const mercadopago_teleconsultation_service_1 = require("./mercadopago.teleconsultation.service");
const mercadopago_payment_resolve_service_1 = require("./mercadopago.payment-resolve.service");
const mercadopago_payment_fees_utils_1 = require("./mercadopago.payment-fees.utils");
/**
 * Consulta Mercado Pago cuando el webhook aún no llegó o getPayment con token del doctor devuelve 404.
 */
async function syncPendingMercadoPagoPayment(localPaymentId) {
    const payment = await database_1.default.mercadoPagoPayment.findUnique({ where: { id: localPaymentId } });
    if (!payment || payment.status !== 'pending')
        return payment;
    try {
        const doctorAccessToken = await mercadopago_oauth_service_1.MercadoPagoOAuthService.getValidAccessToken(payment.doctorId);
        const { payment: mpPayment, source } = await (0, mercadopago_payment_resolve_service_1.resolveMpPaymentWithFallback)({
            paymentId: payment.providerPaymentId || undefined,
            doctorAccessToken,
            preferenceId: payment.providerPreferenceId,
            externalReference: payment.externalReference,
        });
        logger_utils_1.securityLogger.info('MP sync: resolved payment', {
            localPaymentId,
            source,
            mpPaymentId: mpPayment.id,
        });
        const mappedStatus = mercadopago_preference_service_1.MercadoPagoPreferenceService.mapMpStatus(mpPayment.status);
        const financials = mappedStatus === 'approved' ? (0, mercadopago_payment_fees_utils_1.buildPaymentFinancialUpdate)(mpPayment, payment) : undefined;
        const feesUnchanged = !financials ||
            ((0, mercadopago_commission_utils_1.decimalToNumber)(payment.providerProcessingFeeAmount) === financials.providerProcessingFeeAmount &&
                (0, mercadopago_commission_utils_1.decimalToNumber)(payment.netReceivedAmount) === financials.netReceivedAmount);
        if (mappedStatus === payment.status &&
            payment.providerPaymentId === String(mpPayment.id) &&
            feesUnchanged) {
            return payment;
        }
        const updated = await database_1.default.mercadoPagoPayment.update({
            where: { id: payment.id },
            data: Object.assign({ status: mappedStatus, providerPaymentId: String(mpPayment.id), paidAt: mpPayment.date_approved ? new Date(mpPayment.date_approved) : payment.paidAt }, (financials !== null && financials !== void 0 ? financials : {})),
        });
        await database_1.default.paymentAuditLog.create({
            data: {
                paymentId: payment.id,
                eventType: 'PAYMENT_SYNC_FROM_MP',
                rawPayloadJson: Object.assign(Object.assign({}, mpPayment), { resolveSource: source }),
            },
        });
        if (mappedStatus === 'approved' && payment.appointmentId) {
            if (payment.paymentType === 'teleconsultation') {
                await (0, mercadopago_teleconsultation_service_1.finalizeTeleconsultationAfterPayment)(payment.appointmentId);
            }
            else if (payment.paymentType === 'in_person') {
                await (0, mercadopago_inperson_service_1.finalizeInPersonAfterPayment)(payment.appointmentId);
            }
        }
        return updated;
    }
    catch (err) {
        logger_utils_1.securityLogger.warn('MP sync pending payment failed', { localPaymentId, err });
        return payment;
    }
}
