import prisma from '../config/database';
import { AppError } from './error.utils';

export const normalizePromoCode = (code: string) =>
  code.trim().toUpperCase().replace(/\s+/g, '');

export const getPromoCodeOrThrow = async (rawCode: string) => {
  const code = normalizePromoCode(rawCode);
  if (!code) {
    throw new AppError('Código promocional requerido', 400);
  }

  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo) {
    throw new AppError(
      'Código promocional no registrado en el sistema. Verifica que esté escrito exactamente como te lo entregaron (ej. QLX-3M-XXXX).',
      400
    );
  }
  if (!promo.isActive) {
    throw new AppError('Código promocional desactivado', 400);
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
