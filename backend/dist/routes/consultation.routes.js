"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const consultation_controller_1 = require("../controllers/consultation.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const subscription_middleware_1 = require("../middlewares/subscription.middleware");
const router = (0, express_1.Router)();
// ===== CONSULTAS DIVIDIDAS =====
/**
 * @route POST /api/consultations/basic
 * @desc Crear la parte básica de una consulta (Parte 1)
 * @access Private (Doctor/Asistente)
 */
router.post('/basic', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), (0, subscription_middleware_1.subscriptionAccess)('edit'), consultation_controller_1.ConsultationController.createBasicConsultation);
/**
 * @route POST /api/consultations/:consultationId/attachments
 * @desc Agregar archivos y documentos a una consulta existente (Parte 2)
 * @access Private (Doctor/Asistente/Patient)
 */
router.post('/:consultationId/attachments', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'PATIENT']), (0, subscription_middleware_1.subscriptionAccess)('edit'), consultation_controller_1.ConsultationController.addAttachmentsToConsultation);
/**
 * @route PUT /api/consultations/:consultationId
 * @desc Actualizar consulta (guardado parcial) - notas, formData, etc. Solo si está editable
 * @access Private (Doctor/Asistente)
 */
router.put('/:consultationId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), (0, subscription_middleware_1.subscriptionAccess)('edit'), consultation_controller_1.ConsultationController.updateConsultation);
/**
 * @route PUT /api/consultations/:consultationId/complete
 * @desc Marcar consulta como completa
 * @access Private (Doctor/Asistente)
 */
router.put('/:consultationId/complete', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), (0, subscription_middleware_1.subscriptionAccess)('edit'), consultation_controller_1.ConsultationController.markConsultationComplete);
/**
 * @route GET /api/consultations/pending/:patientId
 * @desc Obtener consultas pendientes de completar (sin archivos)
 * @access Private (Doctor/Asistente/Paciente - Paciente usa patientId='self')
 */
router.get('/pending/:patientId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE', 'PATIENT']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), (0, subscription_middleware_1.subscriptionAccess)('read'), consultation_controller_1.ConsultationController.getPendingConsultations);
/**
 * @route GET /api/consultations/stats/:patientId
 * @desc Obtener estadísticas de consultas
 * @access Private (Doctor/Asistente/Paciente - Paciente usa patientId='self')
 */
router.get('/stats/:patientId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE', 'PATIENT']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), (0, subscription_middleware_1.subscriptionAccess)('read'), consultation_controller_1.ConsultationController.getConsultationStats);
/**
 * @route GET /api/consultations/:consultationId/files
 * @desc Obtener archivos de una consulta por categoría
 * @access Private (Doctor/Asistente)
 */
router.get('/:consultationId/files', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), (0, subscription_middleware_1.subscriptionAccess)('read'), consultation_controller_1.ConsultationController.getFilesByCategory);
/**
 * @route GET /api/consultations/:consultationId/lock-status
 * @desc Verificar si una consulta está bloqueada
 * @access Private (Doctor/Asistente)
 */
router.get('/:consultationId/lock-status', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), (0, subscription_middleware_1.subscriptionAccess)('read'), consultation_controller_1.ConsultationController.checkConsultationLock);
// Obtener consultas médicas de un paciente
router.get('/patient/:patientId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), consultation_controller_1.ConsultationController.getPatientConsultations);
exports.default = router;
