import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  generatePreConsultationLink,
  getPreConsultationByToken,
  savePreConsultationData,
  completePreConsultation,
  getPreConsultationByAppointment,
  validatePreConsultationToken,
  uploadFileForPreConsultation
} from '../controllers/preConsultation.controller';
import { upload, handleUploadError } from '../middlewares/upload.middleware';

const router = Router();

// Rutas públicas (sin autenticación) - para que el paciente acceda con el token
router.get('/token/:token', getPreConsultationByToken);
router.put('/token/:token/save', savePreConsultationData);
router.post('/token/:token/complete', completePreConsultation);

// Subida de archivos en pre-consulta (usa token, no requiere JWT)
router.post(
  '/token/:token/upload',
  validatePreConsultationToken,
  upload.single('file'),
  handleUploadError,
  uploadFileForPreConsultation
);

// Rutas protegidas - para doctores y asistentes
router.post('/generate-link/:appointmentId', authMiddleware(['DOCTOR', 'ASISTENTE']), generatePreConsultationLink);
router.get('/appointment/:appointmentId', authMiddleware(['DOCTOR', 'ASISTENTE']), getPreConsultationByAppointment);

export default router;

