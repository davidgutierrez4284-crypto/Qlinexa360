import { Router } from 'express';
import { 
  getCalendarEvents, 
  createCalendarEvent, 
  updateCalendarEvent, 
  deleteCalendarEvent, 
  getCalendarEvent,
  shareCalendarEvent,
  resendCalendarInvite,
  cancelAppointment,
  getRescheduleAvailableSlots
} from '../controllers/calendar.controller';
// Rutas para calendarios externos se manejan en '/external-calendars'
// import { ExternalCalendarController } from '../controllers/externalCalendar.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';

const router = Router();

router.get(
  '/reschedule-slots',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  getRescheduleAvailableSlots
);

// Rutas para eventos del calendario interno
router.get(
  '/events',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  getCalendarEvents
);
router.post(
  '/events',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  createCalendarEvent
);
router.get(
  '/events/:eventId',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  getCalendarEvent
);
router.put(
  '/events/:eventId',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  updateCalendarEvent
);
router.delete(
  '/events/:eventId',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  deleteCalendarEvent
);
router.post(
  '/events/:eventId/resend-calendar-invite',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  resendCalendarInvite
);
router.post(
  '/events/:eventId/share',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  shareCalendarEvent
);
router.post(
  '/events/:eventId/cancel',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  cancelAppointment
);

// Las rutas de calendarios externos están en router '/external-calendars'

export default router; 