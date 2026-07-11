"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMercadoPagoProcessingFee = extractMercadoPagoProcessingFee;
exports.extractNetReceivedAmount = extractNetReceivedAmount;
exports.buildPaymentFinancialUpdate = buildPaymentFinancialUpdate;
exports.computeNetToReceive = computeNetToReceive;
const mercadopago_commission_utils_1 = require("./mercadopago.commission.utils");
function extractMercadoPagoProcessingFee(mpPayment, grossAmount, platformCommission) {
    var _a;
    const fees = mpPayment.fee_details || [];
    let fromDetails = 0;
    for (const fee of fees) {
        const type = (fee.type || '').toLowerCase();
        if (type.includes('application') || type === 'marketplace_fee')
            continue;
        if (type.includes('mercadopago') || type.includes('financing') || fee.fee_payer === 'collector') {
            fromDetails += Number(fee.amount || 0);
        }
    }
    if (fromDetails > 0) {
        return Math.round(fromDetails * 100) / 100;
    }
    const net = (_a = mpPayment.transaction_details) === null || _a === void 0 ? void 0 : _a.net_received_amount;
    if (net != null && Number.isFinite(Number(net))) {
        const derived = grossAmount - platformCommission - Number(net);
        if (derived > 0) {
            return Math.round(derived * 100) / 100;
        }
    }
    return 0;
}
function extractNetReceivedAmount(mpPayment, grossAmount, platformCommission, mpProcessingFee) {
    var _a;
    const net = (_a = mpPayment.transaction_details) === null || _a === void 0 ? void 0 : _a.net_received_amount;
    if (net != null && Number.isFinite(Number(net))) {
        return Math.round(Number(net) * 100) / 100;
    }
    return Math.max(0, Math.round((grossAmount - platformCommission - mpProcessingFee) * 100) / 100);
}
function buildPaymentFinancialUpdate(mpPayment, localPayment) {
    const grossAmount = (0, mercadopago_commission_utils_1.decimalToNumber)(localPayment.amount);
    const platformCommission = (0, mercadopago_commission_utils_1.decimalToNumber)(localPayment.platformCommissionAmount);
    const providerProcessingFeeAmount = extractMercadoPagoProcessingFee(mpPayment, grossAmount, platformCommission);
    const netReceivedAmount = extractNetReceivedAmount(mpPayment, grossAmount, platformCommission, providerProcessingFeeAmount);
    return { providerProcessingFeeAmount, netReceivedAmount };
}
function computeNetToReceive(amount, platformCommission, mpProcessingFee, netReceivedAmount) {
    if (netReceivedAmount != null && netReceivedAmount > 0) {
        return Math.round(netReceivedAmount * 100) / 100;
    }
    return Math.max(0, Math.round((amount - platformCommission - mpProcessingFee) * 100) / 100);
}
