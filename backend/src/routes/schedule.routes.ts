import { Router } from 'express';
import { ScheduleController } from '../controllers/schedule.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';

const router = Router();

// Rutas para configuración de horarios
router.get(
  '/config',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  ScheduleController.getScheduleConfig
);
router.put(
  '/config',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  ScheduleController.updateScheduleConfig
);

export default router;

