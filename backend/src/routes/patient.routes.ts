import { Router } from 'express';
import { getMyProfile, getMyClinicalCases, getMyConsultations, getMyAppointments, getPhotoHistory, getMyPhotoHistory, getMyRecipes, getMyRecipeById, getMyRecipePdfViewUrl } from '../controllers/patient.controller';
import {
  getMyCaseShareAccess,
  revokeMyCaseCollaborator,
  patientInviteRegisteredCollaborator,
  patientInviteExternalCollaborator
} from '../controllers/patientCaseShare.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// =================================================================
// RUTAS PARA PACIENTES
// =================================================================

// NOTA: El auto-registro público de pacientes está deshabilitado por política de producto.
// Los pacientes solo ingresan por invitación del profesional (POST /api/invitations/complete)
// o quedan registrados vía pre-registro/pre-consulta. No exponer POST /api/patients/register.

// Obtener perfil básico del paciente (solo para pacientes autenticados)
router.get('/my/profile', authMiddleware(['PATIENT']), getMyProfile);

// Obtener casos clínicos del paciente (solo para pacientes autenticados)
router.get('/my/clinical-cases', authMiddleware(['PATIENT']), getMyClinicalCases);

// Obtener consultas del paciente (solo para pacientes autenticados)
router.get('/my/consultations', authMiddleware(['PATIENT']), getMyConsultations);

// Citas próximas del paciente (agenda)
router.get('/my/appointments', authMiddleware(['PATIENT']), getMyAppointments);

// Obtener historial fotográfico del paciente autenticado (solo para pacientes)
router.get('/my/photo-history', authMiddleware(['PATIENT']), getMyPhotoHistory);

// Recetas del paciente autenticado (solo lectura, solo las propias)
router.get('/my/recipes', authMiddleware(['PATIENT']), getMyRecipes);
router.get('/my/recipes/:id', authMiddleware(['PATIENT']), getMyRecipeById);
router.get('/my/recipes/:id/pdf-view-url', authMiddleware(['PATIENT']), getMyRecipePdfViewUrl);

// Colaboración en casos: accesos y revocación (solo paciente)
router.get('/my/case-share-access', authMiddleware(['PATIENT']), getMyCaseShareAccess);
router.delete(
  '/my/case-share-access/:clinicalCaseId/collaborators/:doctorId',
  authMiddleware(['PATIENT']),
  revokeMyCaseCollaborator
);

// Segunda opinión / colaboración iniciada por el paciente
router.post(
  '/my/invite-collaborator-registered',
  authMiddleware(['PATIENT']),
  patientInviteRegisteredCollaborator
);
router.post(
  '/my/invite-collaborator-external',
  authMiddleware(['PATIENT']),
  patientInviteExternalCollaborator
);

// Obtener historial fotográfico (accesible por doctores y pacientes)
router.get('/:patientId/photo-history', authMiddleware(['DOCTOR', 'PATIENT', 'ASISTENTE']), getPhotoHistory);

export default router; 