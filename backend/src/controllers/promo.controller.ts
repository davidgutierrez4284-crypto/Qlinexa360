import { Request, Response } from 'express';
import { AppError } from '../utils/error.utils';
import { getPromoCodeOrThrow, getPromoSuccessMessage } from '../utils/promo.utils';

export const validatePromoCode = async (req: Request, res: Response) => {
  try {
    const rawCode = (req.body?.code || req.query?.code || '').toString();
    if (!rawCode) {
      throw new AppError('Código promocional requerido', 400);
    }

    const promo = await getPromoCodeOrThrow(rawCode);
    const message = getPromoSuccessMessage(promo.type);

    res.json({
      valid: true,
      code: promo.code,
      type: promo.type,
      message,
    });
  } catch (error: any) {
    const handled = error instanceof AppError ? error : new AppError('Código promocional inválido', 400);
    res.status(handled.statusCode).json({ valid: false, message: handled.message });
  }
};
