import { Router } from 'express';
import { AssistantController } from '../controllers/assistant.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';
import multer from 'multer';

const router = Router();

// Configurar multer para manejar archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
});

// Ruta pública para registro de asistentes (sin autenticación)
router.post('/register', upload.single('profilePhoto'), AssistantController.registerAssistant);

// Ruta para que los asistentes obtengan sus doctores vinculados (requiere autenticación pero permite ASISTENTE)
router.get('/my-doctors', authMiddleware(['ASISTENTE']), AssistantController.getMyLinkedDoctors);

// Aplicar middleware de autenticación a las rutas protegidas (solo doctores)
router.use(authMiddleware(['DOCTOR']));

// Buscar asistentes por nombre o correo
router.get('/search', AssistantController.searchAssistants);

// Obtener asistentes vinculados al doctor
router.get('/linked', AssistantController.getLinkedAssistants);

// Vincular asistente al doctor
router.post('/link', AssistantController.linkAssistant);

// Revocar acceso del asistente
router.delete('/revoke/:assistantId', AssistantController.revokeAssistantAccess);

// Verificar permisos del asistente para un módulo específico
router.post('/check-permissions', AssistantController.checkAssistantPermissions);

// Obtener información del asistente vinculado
router.get('/info/:assistantId', AssistantController.getAssistantInfo);

export default router; 