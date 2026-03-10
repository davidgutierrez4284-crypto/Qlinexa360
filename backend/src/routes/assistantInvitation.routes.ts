import { Router } from 'express';
import {
  createAssistantInvitation,
  validateAssistantInvitationToken,
  completeAssistantRegistration,
  getDoctorAssistantInvitations
} from '../controllers/assistantInvitation.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Rutas protegidas (requieren autenticación)
router.post('/create', authMiddleware(['DOCTOR']), createAssistantInvitation);
router.get('/doctor', authMiddleware(['DOCTOR']), getDoctorAssistantInvitations);

// Rutas públicas (no requieren autenticación)
router.get('/validate/:token', validateAssistantInvitationToken);
router.post('/complete', completeAssistantRegistration);

export default router;
