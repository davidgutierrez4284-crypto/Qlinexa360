"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshMercadoPagoFeesForPayment = refreshMercadoPagoFeesForPayment;
exports.backfillMissingMercadoPagoFees = backfillMissingMercadoPagoFees;
const database_1 = __importDefault(require("../../config/database"));
const logger_utils_1 = require("../../utils/logger.utils");
const mercadopago_commission_utils_1 = require("./mercadopago.commission.utils");
const mercadopago_oauth_service_1 = require("./mercadopago.oauth.service");
const mercadopago_payment_fees_utils_1 = require("./mercadopago.payment-fees.utils");
const mercadopago_payment_resolve_service_1 = require("./mercadopago.payment-resolve.service");
/** Reconsulta MP y persiste comisión de procesamiento / neto si faltan. */
async function refreshMercadoPagoFeesForPayment(localPaymentId) {
    const payment = await database_1.default.mercadoPagoPayment.findUnique({ where: { id: localPaymentId } });
    if (!payment || payment.status !== 'approved' || !payment.providerPaymentId) {
        return payment;
    }
    try {
        const doctorAccessToken = await mercadopago_oauth_service_1.MercadoPagoOAuthService.getValidAccessToken(payment.doctorId);
        const { payment: mpPayment } = await (0, mercadopago_payment_resolve_service_1.resolveMpPaymentWithFallback)({
            paymentId: payment.providerPaymentId,
            doctorAccessToken,
            preferenceId: payment.providerPreferenceId,
            externalReference: payment.externalReference,
        });
        const financials = (0, mercadopago_payment_fees_utils_1.buildPaymentFinancialUpdate)(mpPayment, payment);
        if (financials.providerProcessingFeeAmount === (0, mercadopago_commission_utils_1.decimalToNumber)(payment.providerProcessingFeeAmount) &&
            financials.netReceivedAmount === (0, mercadopago_commission_utils_1.decimalToNumber)(payment.netReceivedAmount)) {
            return payment;
        }
        return database_1.default.mercadoPagoPayment.update({
            where: { id: payment.id },
            data: financials,
        });
    }
    catch (err) {
        logger_utils_1.securityLogger.warn('MP refresh fees failed', { localPaymentId, err });
        return payment;
    }
}
/** Actualiza hasta N cobros aprobados del doctor que aún no tienen comisión MP. */
async function backfillMissingMercadoPagoFees(doctorId, limit = 10) {
    const missing = await database_1.default.mercadoPagoPayment.findMany({
        where: {
            doctorId,
            status: 'approved',
            providerPaymentId: { not: null },
            providerProcessingFeeAmount: 0,
        },
        orderBy: { paidAt: 'desc' },
        take: limit,
    });
    for (const p of missing) {
        await refreshMercadoPagoFeesForPayment(p.id);
    }
}
