"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLATFORM_GRACE_DAYS = void 0;
exports.computePayPalFirstCycleDays = computePayPalFirstCycleDays;
const promo_utils_1 = require("./promo.utils");
/** Días 1–15 de uso gratuito de la plataforma; primer cargo recurrente desde el día 16 (no suma en LIFETIME). */
exports.PLATFORM_GRACE_DAYS = 15;
/**
 * Días hasta el fin del primer ciclo de suscripción al registrar doctor con PayPal.
 * Con código de referido (no LIFETIME): 1 mes extra + {@link PLATFORM_GRACE_DAYS} días de gracia plataforma,
 * acumulable con días de un código promocional (ver script verify-referral-registration-days).
 * Sin referido: solo gracia salvo promo.
 */
function computePayPalFirstCycleDays(promo, referrerDoctorId, options) {
    const isLifetimePromo = (promo === null || promo === void 0 ? void 0 : promo.type) === 'LIFETIME';
    const isTrialPromo = !!promo && !isLifetimePromo;
    let baseDays;
    if (isTrialPromo) {
        baseDays = (0, promo_utils_1.getPromoDurationDays)(promo.type);
    }
    else {
        baseDays = isLifetimePromo ? 30 : 0;
    }
    // El código de afiliado otorga el mismo mes gratis que un referido-doctor (1 mes = 30 días).
    // Afiliado y referido son mutuamente excluyentes, por lo que nunca suman ambos.
    const grantsFreeMonth = !!referrerDoctorId || !!(options === null || options === void 0 ? void 0 : options.affiliateGrantsFreeMonth);
    const referralBonusDays = grantsFreeMonth && !isLifetimePromo ? 30 : 0;
    const platformGraceDays = isLifetimePromo ? 0 : exports.PLATFORM_GRACE_DAYS;
    const promotionalDays = baseDays + referralBonusDays;
    const totalDays = promotionalDays + platformGraceDays;
    return {
        baseDays,
        referralBonusDays,
        platformGraceDays,
        totalDays,
    };
}
