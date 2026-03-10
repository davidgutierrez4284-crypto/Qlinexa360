import { Router } from 'express';
import { CollaborativeWorkController } from '../controllers/collaborativeWork.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Rutas para trabajo colaborativo
router.use(authMiddleware(['DOCTOR']));

// Agregar colaborador a un padecimiento
router.post('/collaborators', CollaborativeWorkController.addCollaborator);

// Obtener colaboradores de un padecimiento
router.get('/collaborators/:padecimientoId', CollaborativeWorkController.getCollaborators);

// Verificar permisos de edición
router.get('/permissions/:medicalRecordId', CollaborativeWorkController.checkEditPermissions);

// Bloquear edición colaborativa
router.post('/block-editing', CollaborativeWorkController.blockCollaborativeEditing);

// Obtener consultas colaborativas
router.get('/consultations/:patientId/:padecimientoId', CollaborativeWorkController.getCollaborativeConsultations);

export default router; 