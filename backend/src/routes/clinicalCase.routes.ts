import { Router } from 'express';
import {
  listClinicalCases,
  createClinicalCase,
  getClinicalCase,
  updateClinicalCase,
  deleteClinicalCase,
  listCaseMedicalRecords,
  createCaseMedicalRecord
} from '../controllers/clinicalCase.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';

const router = Router();

// Casos clínicos de un paciente
router.get(
  '/patients/:patientId/cases',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'),
  listClinicalCases
);
router.post('/patients/:patientId/cases', authMiddleware(['DOCTOR']), createClinicalCase);

// Operaciones sobre un caso clínico específico
router.get(
  '/cases/:caseId',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'),
  getClinicalCase
);
router.put('/cases/:caseId', authMiddleware(['DOCTOR']), updateClinicalCase);
router.delete('/cases/:caseId', authMiddleware(['DOCTOR']), deleteClinicalCase);

// Notas clínicas dentro de un caso
router.get(
  '/cases/:caseId/medical-records',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'),
  listCaseMedicalRecords
);
router.post('/cases/:caseId/medical-records', authMiddleware(['DOCTOR']), createCaseMedicalRecord);

export default router; 