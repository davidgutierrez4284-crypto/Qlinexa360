import { Router } from 'express';
import {
  getTeleconsultationInfoByToken,
  signTeleconsultationConsent,
  getTeleconsultationRefundContext,
  createTeleconsultationRefundRequest,
} from '../controllers/teleconsultation.controller';

const router = Router();

// Rutas públicas (sin autenticación) - el token en la URL actúa como autenticación
router.get('/info/:token', getTeleconsultationInfoByToken);
router.post('/sign-consent/:token', signTeleconsultationConsent);
router.get('/refund-request/:token', getTeleconsultationRefundContext);
router.post('/refund-request/:token', createTeleconsultationRefundRequest);

export default router;
