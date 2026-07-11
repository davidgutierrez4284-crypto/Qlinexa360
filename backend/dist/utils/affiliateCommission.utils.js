"use strict";
/**
 * Cálculo de comisiones de afiliados.
 *
 * Base de comisión = pago SIN IVA. Fórmula:
 *   paymentAmountNet = round(gross / (1 + vatRate), 2)
 *   commissionAmount = round(net * (commissionPercentage / 100), 2)
 *
 * Ejemplo Qlinexa360: 499 / 1.16 = 430.17 ; 430.17 * 0.30 = 129.05
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundMoney = roundMoney;
exports.computeCommission = computeCommission;
/** Redondeo monetario a 2 decimales, estable ante errores de punto flotante. */
function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
/**
 * Calcula la base sin IVA y el importe de comisión, y construye el trace de auditoría.
 */
function computeCommission(input) {
    var _a, _b, _c, _d, _e, _f;
    const gross = Number(input.grossAmount);
    const vatRate = Number(input.vatRate);
    const pct = Number(input.commissionPercentage);
    if (!Number.isFinite(gross) || gross < 0) {
        throw new Error(`grossAmount inválido: ${input.grossAmount}`);
    }
    if (!Number.isFinite(vatRate) || vatRate < 0) {
        throw new Error(`vatRate inválido: ${input.vatRate}`);
    }
    if (!Number.isFinite(pct) || pct < 0) {
        throw new Error(`commissionPercentage inválido: ${input.commissionPercentage}`);
    }
    const netBase = roundMoney(gross / (1 + vatRate));
    const commissionAmount = roundMoney(netBase * (pct / 100));
    const trace = {
        grossAmount: roundMoney(gross),
        vatRate,
        netBase,
        commissionPercentage: pct,
        commissionAmount,
        commissionMonthNumber: (_a = input.commissionMonthNumber) !== null && _a !== void 0 ? _a : null,
        commissionDurationMonths: (_b = input.commissionDurationMonths) !== null && _b !== void 0 ? _b : null,
        paypalPaymentId: (_c = input.paypalPaymentId) !== null && _c !== void 0 ? _c : null,
        doctorUserId: (_d = input.doctorUserId) !== null && _d !== void 0 ? _d : null,
        affiliateCode: (_e = input.affiliateCode) !== null && _e !== void 0 ? _e : null,
        currency: (_f = input.currency) !== null && _f !== void 0 ? _f : null,
        calculatedAt: new Date().toISOString()
    };
    return { netBase, commissionAmount, trace };
}
