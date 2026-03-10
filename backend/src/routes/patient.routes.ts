import { Router } from 'express';
import { registerPatient, getMyClinicalCases, getMyConsultations, getPhotoHistory, getMyPhotoHistory } from '../controllers/patient.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// =================================================================
// RUTAS PARA PACIENTES
// =================================================================

// Registro de paciente (público)
router.post('/register', registerPatient);

// Obtener casos clínicos del paciente (solo para pacientes autenticados)
router.get('/my/clinical-cases', authMiddleware(['PATIENT']), getMyClinicalCases);

// Obtener consultas del paciente (solo para pacientes autenticados)
router.get('/my/consultations', authMiddleware(['PATIENT']), getMyConsultations);

// Obtener historial fotográfico del paciente autenticado (solo para pacientes)
router.get('/my/photo-history', authMiddleware(['PATIENT']), getMyPhotoHistory);

// Obtener historial fotográfico (accesible por doctores y pacientes)
router.get('/:patientId/photo-history', authMiddleware(['DOCTOR', 'PATIENT', 'ASISTENTE']), getPhotoHistory);

export default router; 