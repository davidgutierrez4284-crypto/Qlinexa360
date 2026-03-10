import { Router } from 'express';
import { CalendarSyncController } from '../controllers/calendarSync.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';

const router = Router();

// Rutas de autenticación OAuth (públicas, no requieren token)
router.get('/auth/outlook', CalendarSyncController.authOutlook);
router.get('/auth/outlook/callback', CalendarSyncController.authOutlook);
router.get('/auth/google', CalendarSyncController.authGoogle);
router.get('/auth/google/callback', CalendarSyncController.authGoogle);
router.get('/auth/notion', CalendarSyncController.authNotion);
router.get('/auth/notion/callback', CalendarSyncController.authNotion);
router.get('/auth/apple', CalendarSyncController.authApple);
router.get('/auth/apple/callback', CalendarSyncController.authApple);

// Obtener estado de sincronización (lectura para doctor/asistente)
router.get(
  '/sync-status',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  CalendarSyncController.getSyncStatus
);

// Desconectar calendario (solo doctor)
router.post('/disconnect/:provider', authMiddleware(['DOCTOR']), CalendarSyncController.disconnectCalendar);

// Sincronizar calendario manualmente (solo doctor)
router.post('/sync/:provider', authMiddleware(['DOCTOR']), CalendarSyncController.syncCalendar);

// Obtener eventos del calendario (lectura para doctor/asistente)
router.get(
  '/events',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  CalendarSyncController.getCalendarEvents
);

export default router;
