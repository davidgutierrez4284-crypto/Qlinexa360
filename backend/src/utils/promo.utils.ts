import prisma from '../config/database';
import { AppError } from './error.utils';

export const normalizePromoCode = (code: string) => code.trim().toUpperCase();

export const getPromoCodeOrThrow = async (rawCode: string) => {
  const code = normalizePromoCode(rawCode);
  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.isActive) {
    throw new AppError('Código promocional inválido', 400);
  }

  const now = new Date();
  if (promo.validUntil && promo.validUntil < now) {
    throw new AppError('Código promocional expirado', 400);
  }

  if (promo.redemptionCount >= promo.maxRedemptions) {
    throw new AppError('Código promocional agotado', 400);
  }

  return promo;
};

export const getPromoSuccessMessage = (promoType: string) => {
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

export const getPromoDurationDays = (promoType: string) => {
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
