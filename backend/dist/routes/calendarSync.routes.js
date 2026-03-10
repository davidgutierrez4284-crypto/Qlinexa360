"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const calendarSync_controller_1 = require("../controllers/calendarSync.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const router = (0, express_1.Router)();
// Rutas de autenticación OAuth (públicas, no requieren token)
router.get('/auth/outlook', calendarSync_controller_1.CalendarSyncController.authOutlook);
router.get('/auth/outlook/callback', calendarSync_controller_1.CalendarSyncController.authOutlook);
router.get('/auth/google', calendarSync_controller_1.CalendarSyncController.authGoogle);
router.get('/auth/google/callback', calendarSync_controller_1.CalendarSyncController.authGoogle);
router.get('/auth/notion', calendarSync_controller_1.CalendarSyncController.authNotion);
router.get('/auth/notion/callback', calendarSync_controller_1.CalendarSyncController.authNotion);
router.get('/auth/apple', calendarSync_controller_1.CalendarSyncController.authApple);
router.get('/auth/apple/callback', calendarSync_controller_1.CalendarSyncController.authApple);
// Obtener estado de sincronización (lectura para doctor/asistente)
router.get('/sync-status', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), calendarSync_controller_1.CalendarSyncController.getSyncStatus);
// Desconectar calendario (solo doctor)
router.post('/disconnect/:provider', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), calendarSync_controller_1.CalendarSyncController.disconnectCalendar);
// Sincronizar calendario manualmente (solo doctor)
router.post('/sync/:provider', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), calendarSync_controller_1.CalendarSyncController.syncCalendar);
// Obtener eventos del calendario (lectura para doctor/asistente)
router.get('/events', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), calendarSync_controller_1.CalendarSyncController.getCalendarEvents);
exports.default = router;
