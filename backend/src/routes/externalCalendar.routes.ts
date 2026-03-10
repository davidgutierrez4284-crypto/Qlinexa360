import { Router } from 'express';
import { ExternalCalendarController } from '../controllers/externalCalendar.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Callbacks de autorización (sin autenticación)
router.get('/google/callback', ExternalCalendarController.handleGoogleCallback);
router.get('/outlook/callback', ExternalCalendarController.handleOutlookCallback);
router.get('/apple/callback', ExternalCalendarController.handleAppleCallback);
router.get('/notion/callback', ExternalCalendarController.handleNotionCallback);

// Todas las demás rutas requieren autenticación
router.use(authMiddleware);

// Obtener calendarios externos del doctor
router.get('/', ExternalCalendarController.getExternalCalendars);

// Conectar calendarios
router.post('/google', ExternalCalendarController.connectGoogleCalendar);
router.post('/outlook', ExternalCalendarController.connectOutlookCalendar);
router.post('/apple', ExternalCalendarController.connectAppleCalendar);
router.post('/notion', ExternalCalendarController.connectNotionCalendar);

// Desconectar calendario
router.delete('/:calendarId', ExternalCalendarController.disconnectCalendar);

// Sincronizar calendario
router.post('/:calendarId/sync', ExternalCalendarController.syncExternalCalendar);

// Obtener eventos de calendario externo
router.get('/:calendarId/events', ExternalCalendarController.getExternalCalendarEvents);

export default router; 