"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const patient_controller_1 = require("../controllers/patient.controller");
const patientCaseShare_controller_1 = require("../controllers/patientCaseShare.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// =================================================================
// RUTAS PARA PACIENTES
// =================================================================
// NOTA: El auto-registro público de pacientes está deshabilitado por política de producto.
// Los pacientes solo ingresan por invitación del profesional (POST /api/invitations/complete)
// o quedan registrados vía pre-registro/pre-consulta. No exponer POST /api/patients/register.
// Obtener perfil básico del paciente (solo para pacientes autenticados)
router.get('/my/profile', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patient_controller_1.getMyProfile);
// Obtener casos clínicos del paciente (solo para pacientes autenticados)
router.get('/my/clinical-cases', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patient_controller_1.getMyClinicalCases);
// Obtener consultas del paciente (solo para pacientes autenticados)
router.get('/my/consultations', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patient_controller_1.getMyConsultations);
// Citas próximas del paciente (agenda)
router.get('/my/appointments', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patient_controller_1.getMyAppointments);
// Obtener historial fotográfico del paciente autenticado (solo para pacientes)
router.get('/my/photo-history', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patient_controller_1.getMyPhotoHistory);
// Recetas del paciente autenticado (solo lectura, solo las propias)
router.get('/my/recipes', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patient_controller_1.getMyRecipes);
router.get('/my/recipes/:id', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patient_controller_1.getMyRecipeById);
router.get('/my/recipes/:id/pdf-view-url', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patient_controller_1.getMyRecipePdfViewUrl);
// Colaboración en casos: accesos y revocación (solo paciente)
router.get('/my/case-share-access', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patientCaseShare_controller_1.getMyCaseShareAccess);
router.delete('/my/case-share-access/:clinicalCaseId/collaborators/:doctorId', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patientCaseShare_controller_1.revokeMyCaseCollaborator);
// Segunda opinión / colaboración iniciada por el paciente
router.post('/my/invite-collaborator-registered', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patientCaseShare_controller_1.patientInviteRegisteredCollaborator);
router.post('/my/invite-collaborator-external', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patientCaseShare_controller_1.patientInviteExternalCollaborator);
// Obtener historial fotográfico (accesible por doctores y pacientes)
router.get('/:patientId/photo-history', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'PATIENT', 'ASISTENTE']), patient_controller_1.getPhotoHistory);
exports.default = router;
