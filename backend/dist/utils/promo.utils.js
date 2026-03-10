"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPromoDurationDays = exports.getPromoSuccessMessage = exports.getPromoCodeOrThrow = exports.normalizePromoCode = void 0;
const database_1 = __importDefault(require("../config/database"));
const error_utils_1 = require("./error.utils");
const normalizePromoCode = (code) => code.trim().toUpperCase();
exports.normalizePromoCode = normalizePromoCode;
const getPromoCodeOrThrow = async (rawCode) => {
    const code = (0, exports.normalizePromoCode)(rawCode);
    const promo = await database_1.default.promoCode.findUnique({ where: { code } });
    if (!promo || !promo.isActive) {
        throw new error_utils_1.AppError('Código promocional inválido', 400);
    }
    const now = new Date();
    if (promo.validUntil && promo.validUntil < now) {
        throw new error_utils_1.AppError('Código promocional expirado', 400);
    }
    if (promo.redemptionCount >= promo.maxRedemptions) {
        throw new error_utils_1.AppError('Código promocional agotado', 400);
    }
    return promo;
};
exports.getPromoCodeOrThrow = getPromoCodeOrThrow;
const getPromoSuccessMessage = (promoType) => {
    switch (promoType) {
        case 'LIFETIME':
            return '¡Código válido! Acceso de por vida activado.';
        case 'DISCOUNT_50_3M':
            return '¡Código válido! Promoción de 3 meses activada.';
        case 'REACTIVATION_30D':
            return '¡Código válido! Reactivación de 30 días activada.';
        default:
            return '¡Código válido! Prueba gratuita de 30 días activada.';
    }
};
exports.getPromoSuccessMessage = getPromoSuccessMessage;
const getPromoDurationDays = (promoType) => {
    switch (promoType) {
        case 'TRIAL_30D':
            return 30;
        case 'DISCOUNT_50_3M':
            return 90;
        case 'REACTIVATION_30D':
            return 30;
        default:
            return 30;
    }
};
exports.getPromoDurationDays = getPromoDurationDays;
