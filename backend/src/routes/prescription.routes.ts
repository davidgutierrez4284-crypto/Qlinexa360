import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  getPrescriptionTemplates,
  createPrescriptionTemplate,
  updatePrescriptionTemplate,
  deletePrescriptionTemplate,
  createPrescription,
  getPrescriptionsByMedicalRecord,
  generatePdfFromTemplate
} from '../controllers/prescription.controller';

const router = Router();

// Plantillas de recetas
router.get('/templates', authMiddleware(['DOCTOR']), getPrescriptionTemplates);
router.post('/templates', authMiddleware(['DOCTOR']), createPrescriptionTemplate);
router.put('/templates/:id', authMiddleware(['DOCTOR']), updatePrescriptionTemplate);
router.delete('/templates/:id', authMiddleware(['DOCTOR']), deletePrescriptionTemplate);

// Recetas asociadas a consulta
router.post('/medical-records/:medicalRecordId/prescriptions', authMiddleware(['DOCTOR']), createPrescription);
router.get('/medical-records/:medicalRecordId/prescriptions', authMiddleware(['DOCTOR', 'PATIENT']), getPrescriptionsByMedicalRecord);
router.post('/medical-records/:medicalRecordId/prescriptions/generate', authMiddleware(['DOCTOR']), generatePdfFromTemplate);

export default router; 