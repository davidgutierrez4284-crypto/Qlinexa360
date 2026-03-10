import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';
import { upload } from '../middlewares/upload.middleware';
import {
  createStudyDocument,
  getStudyDocuments,
  deleteStudyDocument
} from '../controllers/studyDocument.controller';

const router = Router();

const assistantStudiesOnly = (req: any, res: any, next: any) => {
  if (req.user?.role === 'ASISTENTE') {
    return AssistantMiddleware.checkAssistantModulePermission('studies')(req, res, next);
  }
  return next();
};

// Rutas protegidas que requieren autenticación
router.use(authenticateToken);

// Obtener documentos de estudio
router.get('/', assistantStudiesOnly, getStudyDocuments);

// Crear documento de estudio
router.post('/', assistantStudiesOnly, upload.single('file'), createStudyDocument);

// Eliminar documento de estudio
router.delete('/:id', assistantStudiesOnly, deleteStudyDocument);

export default router; 