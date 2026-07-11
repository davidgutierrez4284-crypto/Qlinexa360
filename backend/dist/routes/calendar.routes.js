"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const calendar_controller_1 = require("../controllers/calendar.controller");
// Rutas para calendarios externos se manejan en '/external-calendars'
// import { ExternalCalendarController } from '../controllers/externalCalendar.controller';
const auth_middleware_1 = require("../middlewares/auth.middleware");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const router = (0, express_1.Router)();
router.get('/reschedule-slots', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), calendar_controller_1.getRescheduleAvailableSlots);
// Rutas para eventos del calendario interno
router.get('/events', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), calendar_controller_1.getCalendarEvents);
router.post('/events', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), calendar_controller_1.createCalendarEvent);
router.get('/events/:eventId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), calendar_controller_1.getCalendarEvent);
router.put('/events/:eventId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), calendar_controller_1.updateCalendarEvent);
router.delete('/events/:eventId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), calendar_controller_1.deleteCalendarEvent);
router.post('/events/:eventId/resend-calendar-invite', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), calendar_controller_1.resendCalendarInvite);
router.post('/events/:eventId/share', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), calendar_controller_1.shareCalendarEvent);
router.post('/events/:eventId/cancel', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), calendar_controller_1.cancelAppointment);
// Las rutas de calendarios externos están en router '/external-calendars'
exports.default = router;
