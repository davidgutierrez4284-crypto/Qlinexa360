"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePromoCode = void 0;
const error_utils_1 = require("../utils/error.utils");
const promo_utils_1 = require("../utils/promo.utils");
const validatePromoCode = async (req, res) => {
    var _a, _b;
    try {
        const rawCode = (((_a = req.body) === null || _a === void 0 ? void 0 : _a.code) || ((_b = req.query) === null || _b === void 0 ? void 0 : _b.code) || '').toString();
        if (!rawCode) {
            throw new error_utils_1.AppError('Código promocional requerido', 400);
        }
        const promo = await (0, promo_utils_1.getPromoCodeOrThrow)(rawCode);
        const message = (0, promo_utils_1.getPromoSuccessMessage)(promo.type);
        res.json({
            valid: true,
            code: promo.code,
            type: promo.type,
            message,
        });
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Código promocional inválido', 400);
        res.status(handled.statusCode).json({ valid: false, message: handled.message });
    }
};
exports.validatePromoCode = validatePromoCode;
