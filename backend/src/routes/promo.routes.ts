import { Router } from 'express';
import { validatePromoCode } from '../controllers/promo.controller';

const router = Router();

// Validación pública para códigos promocionales
router.post('/validate', validatePromoCode);

export default router;
