import { Router } from 'express';
import { getFormTemplates } from '../controllers/formTemplate.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Ruta para obtener las plantillas de formulario para el doctor autenticado
router.get(
  '/', 
  authMiddleware(['DOCTOR', 'ASISTENTE', 'PATIENT']), // Permitir acceso a todos los roles autenticados
  getFormTemplates
);

export default router; 