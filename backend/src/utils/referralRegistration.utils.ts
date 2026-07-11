import { getPromoDurationDays } from './promo.utils';

/** Días 1–15 de uso gratuito de la plataforma; primer cargo recurrente desde el día 16 (no suma en LIFETIME). */
export const PLATFORM_GRACE_DAYS = 15;

/**
 * Días hasta el fin del primer ciclo de suscripción al registrar doctor con PayPal.
 * Con código de referido (no LIFETIME): 1 mes extra + {@link PLATFORM_GRACE_DAYS} días de gracia plataforma,
 * acumulable con días de un código promocional (ver script verify-referral-registration-days).
 * Sin referido: solo gracia salvo promo.
 */
export function computePayPalFirstCycleDays(
  promo: { type: string } | null | undefined,
  referrerDoctorId: string | undefined,
  options?: { affiliateGrantsFreeMonth?: boolean },
): {
  baseDays: number;
  referralBonusDays: number;
  platformGraceDays: number;
  totalDays: number;
} {
  const isLifetimePromo = promo?.type === 'LIFETIME';
  const isTrialPromo = !!promo && !isLifetimePromo;
  let baseDays: number;
  if (isTrialPromo) {
    baseDays = getPromoDurationDays(promo!.type);
  } else {
    baseDays = isLifetimePromo ? 30 : 0;
  }
  // El código de afiliado otorga el mismo mes gratis que un referido-doctor (1 mes = 30 días).
  // Afiliado y referido son mutuamente excluyentes, por lo que nunca suman ambos.
  const grantsFreeMonth = !!referrerDoctorId || !!options?.affiliateGrantsFreeMonth;
  const referralBonusDays =
    grantsFreeMonth && !isLifetimePromo ? 30 : 0;
  const platformGraceDays = isLifetimePromo ? 0 : PLATFORM_GRACE_DAYS;
  const promotionalDays = baseDays + referralBonusDays;
  const totalDays = promotionalDays + platformGraceDays;
  return {
    baseDays,
    referralBonusDays,
    platformGraceDays,
    totalDays,
  };
}
