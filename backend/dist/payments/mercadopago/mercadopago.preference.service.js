"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoPreferenceService = void 0;
exports.getLatestTeleconsultationPayment = getLatestTeleconsultationPayment;
exports.isTeleconsultationPaymentApproved = isTeleconsultationPaymentApproved;
const crypto_1 = require("crypto");
const database_1 = __importDefault(require("../../config/database"));
const env_1 = require("../../config/env");
const mercadopago_api_client_1 = require("./mercadopago.api.client");
const mercadopago_commission_utils_1 = require("./mercadopago.commission.utils");
const mercadopago_config_1 = require("./mercadopago.config");
const mercadopago_oauth_service_1 = require("./mercadopago.oauth.service");
function mapMpStatus(status) {
    switch (status) {
        case 'approved':
            return 'approved';
        case 'rejected':
            return 'rejected';
        case 'cancelled':
            return 'cancelled';
        case 'refunded':
            return 'refunded';
        case 'charged_back':
            return 'charged_back';
        default:
            return 'pending';
    }
}
class MercadoPagoPreferenceService {
    static async createPreference(params) {
        const accessToken = await mercadopago_oauth_service_1.MercadoPagoOAuthService.getValidAccessToken(params.doctorId);
        const externalReference = (0, crypto_1.randomUUID)();
        const { feeAmount, feePercent } = await (0, mercadopago_commission_utils_1.calculateMarketplaceFee)({
            amount: params.amount,
            paymentType: params.paymentType,
        });
        const returnBase = (0, mercadopago_config_1.getMercadoPagoReturnBaseUrl)();
        const webhookUrl = `${env_1.env.BASE_URL || 'http://localhost:3000'}/api/payments/mercadopago/webhook`;
        const preferencePayload = {
            items: [
                {
                    id: externalReference,
                    title: params.concept.slice(0, 256),
                    quantity: 1,
                    unit_price: params.amount,
                    currency_id: params.currency,
                },
            ],
            payer: params.payerEmail ? { email: params.payerEmail } : undefined,
            external_reference: externalReference,
            notification_url: webhookUrl,
            metadata: {
                appointment_id: params.appointmentId || '',
                doctor_id: params.doctorId,
                patient_id: params.patientId,
                payment_type: params.paymentType,
            },
        };
        if (returnBase) {
            if (params.confirmationToken) {
                if (params.paymentType === 'teleconsultation') {
                    preferencePayload.back_urls = {
                        success: `${returnBase}/teleconsulta/${params.confirmationToken}?payment=success`,
                        failure: `${returnBase}/teleconsulta/${params.confirmationToken}?payment=failure`,
                        pending: `${returnBase}/teleconsulta/${params.confirmationToken}?payment=pending`,
                    };
                }
                else {
                    preferencePayload.back_urls = {
                        success: `${returnBase}/confirm-appointment/${params.confirmationToken}?payment=success`,
                        failure: `${returnBase}/confirm-appointment/${params.confirmationToken}?payment=failure`,
                        pending: `${returnBase}/confirm-appointment/${params.confirmationToken}?payment=pending`,
                    };
                }
            }
            else {
                preferencePayload.back_urls = {
                    success: `${returnBase}/dashboard/mis-citas?payment=success`,
                    failure: `${returnBase}/dashboard/mis-citas?payment=failure`,
                    pending: `${returnBase}/dashboard/mis-citas?payment=pending`,
                };
            }
            preferencePayload.auto_return = 'approved';
        }
        // En sandbox la comisión marketplace suele dejar la orden en payment_required aunque la UI muestre éxito.
        if (feeAmount > 0 && mercadopago_config_1.mercadoPagoConfig.env !== 'sandbox') {
            preferencePayload.marketplace_fee = feeAmount;
        }
        const preference = await mercadopago_api_client_1.MercadoPagoApiClient.createPreference(accessToken, preferencePayload);
        const checkoutUrl = mercadopago_config_1.mercadoPagoConfig.env === 'sandbox' && preference.sandbox_init_point
            ? preference.sandbox_init_point
            : preference.init_point || preference.sandbox_init_point || null;
        const payment = await database_1.default.mercadoPagoPayment.create({
            data: {
                doctorId: params.doctorId,
                patientId: params.patientId,
                appointmentId: params.appointmentId || null,
                amount: params.amount,
                currency: params.currency,
                platformCommissionAmount: feeAmount,
                platformCommissionPercent: feePercent,
                status: 'pending',
                paymentType: params.paymentType,
                externalReference,
                providerPreferenceId: preference.id,
                checkoutUrl,
                concept: params.concept,
                metadataJson: {
                    confirmationToken: params.confirmationToken || null,
                },
            },
        });
        await database_1.default.paymentAuditLog.create({
            data: {
                paymentId: payment.id,
                eventType: 'PREFERENCE_CREATED',
                rawPayloadJson: { preferenceId: preference.id, externalReference },
            },
        });
        return { payment, checkoutUrl, externalReference };
    }
}
exports.MercadoPagoPreferenceService = MercadoPagoPreferenceService;
MercadoPagoPreferenceService.mapMpStatus = mapMpStatus;
async function getLatestTeleconsultationPayment(appointmentId) {
    return database_1.default.mercadoPagoPayment.findFirst({
        where: {
            appointmentId,
            paymentType: 'teleconsultation',
            status: { notIn: ['cancelled'] },
        },
        orderBy: { createdAt: 'desc' },
    });
}
async function isTeleconsultationPaymentApproved(appointmentId) {
    const payment = await database_1.default.mercadoPagoPayment.findFirst({
        where: { appointmentId, paymentType: 'teleconsultation', status: 'approved' },
    });
    return !!payment;
}
