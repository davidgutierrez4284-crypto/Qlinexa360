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

// Rutas protegidas (requieren autenticación). authMiddleware es una fábrica
// (allowedRoles) => middleware; debe invocarse con los roles. El controlador
// resuelve al doctor por req.user.userId, por lo que el rol válido es DOCTOR.
router.post('/create', authMiddleware(['DOCTOR']), createPatientInvitation);
router.post('/resend', authMiddleware(['DOCTOR']), resendPatientInvitation);
router.get('/doctor', authMiddleware(['DOCTOR']), getDoctorInvitations);

// Rutas públicas (no requieren autenticación)
router.get('/validate/:token', validateInvitationToken);
router.post('/complete', completePatientRegistration);

export default router;
