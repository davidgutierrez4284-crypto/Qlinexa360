"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveCommissionRule = getActiveCommissionRule;
exports.calculateMarketplaceFee = calculateMarketplaceFee;
exports.decimalToNumber = decimalToNumber;
const database_1 = __importDefault(require("../../config/database"));
const mercadopago_config_1 = require("./mercadopago.config");
async function getActiveCommissionRule() {
    return database_1.default.platformMercadoPagoCommissionRule.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
    });
}
async function calculateMarketplaceFee(input) {
    const rule = await getActiveCommissionRule();
    const percent = rule
        ? Number(rule.commissionPercentage)
        : mercadopago_config_1.mercadoPagoConfig.marketplaceFeePercentage;
    const fixed = rule ? Number(rule.commissionFixedAmount) : 0;
    const min = rule ? Number(rule.minCommissionAmount) : 0;
    const max = (rule === null || rule === void 0 ? void 0 : rule.maxCommissionAmount) != null ? Number(rule.maxCommissionAmount) : null;
    if (rule) {
        if (input.paymentType === 'teleconsultation' && !rule.applyCommissionToTeleconsultation) {
            return { feeAmount: 0, feePercent: 0 };
        }
        if (input.paymentType === 'in_person' && !rule.applyCommissionToInPersonConsultation) {
            return { feeAmount: 0, feePercent: 0 };
        }
    }
    let fee = (input.amount * percent) / 100 + fixed;
    if (fee < min)
        fee = min;
    if (max != null && fee > max)
        fee = max;
    fee = Math.round(fee * 100) / 100;
    return { feeAmount: fee, feePercent: percent };
}
function decimalToNumber(value) {
    if (value == null)
        return 0;
    return typeof value === 'number' ? value : Number(value);
}
