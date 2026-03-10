import { Router } from 'express';
import {
  submitConsentAfterPatientSetup,
  submitConsentAssistant,
  getConsentsByUserId,
  getPatientAvisoPrivacidad
} from '../controllers/consent.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/submit-after-setup', submitConsentAfterPatientSetup);
router.post('/submit-assistant', submitConsentAssistant);

router.get('/admin/:userId', authMiddleware(['ADMIN']), getConsentsByUserId);
router.get('/doctor/patient/:patientId/aviso-privacidad', authMiddleware(['DOCTOR']), getPatientAvisoPrivacidad);

export default router;
