import { Router } from 'express';
import { ConsultationController } from '../controllers/consultation.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';
import { subscriptionAccess } from '../middlewares/subscription.middleware';

const router = Router();

// ===== CONSULTAS DIVIDIDAS =====

/**
 * @route POST /api/consultations/basic
 * @desc Crear la parte básica de una consulta (Parte 1)
 * @access Private (Doctor/Asistente)
 */
router.post(
  '/basic',
  authMiddleware(['DOCTOR']),
  subscriptionAccess('edit'),
  ConsultationController.createBasicConsultation
);

/**
 * @route POST /api/consultations/:consultationId/attachments
 * @desc Agregar archivos y documentos a una consulta existente (Parte 2)
 * @access Private (Doctor/Asistente/Patient)
 */
router.post(
  '/:consultationId/attachments',
  authMiddleware(['DOCTOR', 'PATIENT']),
  subscriptionAccess('edit'),
  ConsultationController.addAttachmentsToConsultation
);

/**
 * @route PUT /api/consultations/:consultationId
 * @desc Actualizar consulta (guardado parcial) - notas, formData, etc. Solo si está editable
 * @access Private (Doctor/Asistente)
 */
router.put(
  '/:consultationId',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'),
  subscriptionAccess('edit'),
  ConsultationController.updateConsultation
);

/**
 * @route PUT /api/consultations/:consultationId/complete
 * @desc Marcar consulta como completa
 * @access Private (Doctor/Asistente)
 */
router.put(
  '/:consultationId/complete',
  authMiddleware(['DOCTOR']),
  subscriptionAccess('edit'),
  ConsultationController.markConsultationComplete
);

/**
 * @route GET /api/consultations/pending/:patientId
 * @desc Obtener consultas pendientes de completar (sin archivos)
 * @access Private (Doctor/Asistente/Paciente - Paciente usa patientId='self')
 */
router.get(
  '/pending/:patientId',
  authMiddleware(['DOCTOR', 'ASISTENTE', 'PATIENT']),
  AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'),
  subscriptionAccess('read'),
  ConsultationController.getPendingConsultations
);

/**
 * @route GET /api/consultations/stats/:patientId
 * @desc Obtener estadísticas de consultas
 * @access Private (Doctor/Asistente/Paciente - Paciente usa patientId='self')
 */
router.get(
  '/stats/:patientId',
  authMiddleware(['DOCTOR', 'ASISTENTE', 'PATIENT']),
  AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'),
  subscriptionAccess('read'),
  ConsultationController.getConsultationStats
);

/**
 * @route GET /api/consultations/:consultationId/files
 * @desc Obtener archivos de una consulta por categoría
 * @access Private (Doctor/Asistente)
 */
router.get(
  '/:consultationId/files',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'),
  subscriptionAccess('read'),
  ConsultationController.getFilesByCategory
);

/**
 * @route GET /api/consultations/:consultationId/lock-status
 * @desc Verificar si una consulta está bloqueada
 * @access Private (Doctor/Asistente)
 */
router.get(
  '/:consultationId/lock-status',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'),
  subscriptionAccess('read'),
  ConsultationController.checkConsultationLock
);

// Obtener consultas médicas de un paciente
router.get(
  '/patient/:patientId',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'),
  ConsultationController.getPatientConsultations
);

export default router; 