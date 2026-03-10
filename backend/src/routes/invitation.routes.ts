import { Router } from 'express';
import {
  createPatientInvitation,
  validateInvitationToken,
  completePatientRegistration,
  getDoctorInvitations,
  resendPatientInvitation
} from '../controllers/invitation.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Rutas protegidas (requieren autenticación)
router.post('/create', authMiddleware, createPatientInvitation);
router.post('/resend', authMiddleware, resendPatientInvitation);
router.get('/doctor', authMiddleware, getDoctorInvitations);

// Rutas públicas (no requieren autenticación)
router.get('/validate/:token', validateInvitationToken);
router.post('/complete', completePatientRegistration);

export default router;
