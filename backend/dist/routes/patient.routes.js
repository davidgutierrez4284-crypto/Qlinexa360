"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const patient_controller_1 = require("../controllers/patient.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// =================================================================
// RUTAS PARA PACIENTES
// =================================================================
// Registro de paciente (público)
router.post('/register', patient_controller_1.registerPatient);
// Obtener casos clínicos del paciente (solo para pacientes autenticados)
router.get('/my/clinical-cases', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patient_controller_1.getMyClinicalCases);
// Obtener consultas del paciente (solo para pacientes autenticados)
router.get('/my/consultations', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patient_controller_1.getMyConsultations);
// Obtener historial fotográfico del paciente autenticado (solo para pacientes)
router.get('/my/photo-history', (0, auth_middleware_1.authMiddleware)(['PATIENT']), patient_controller_1.getMyPhotoHistory);
// Obtener historial fotográfico (accesible por doctores y pacientes)
router.get('/:patientId/photo-history', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'PATIENT', 'ASISTENTE']), patient_controller_1.getPhotoHistory);
exports.default = router;
