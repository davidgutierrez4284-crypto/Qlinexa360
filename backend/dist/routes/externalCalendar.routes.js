"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const externalCalendar_controller_1 = require("../controllers/externalCalendar.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Callbacks de autorización (sin autenticación)
router.get('/google/callback', externalCalendar_controller_1.ExternalCalendarController.handleGoogleCallback);
router.get('/outlook/callback', externalCalendar_controller_1.ExternalCalendarController.handleOutlookCallback);
router.get('/apple/callback', externalCalendar_controller_1.ExternalCalendarController.handleAppleCallback);
router.get('/notion/callback', externalCalendar_controller_1.ExternalCalendarController.handleNotionCallback);
// Todas las demás rutas requieren autenticación
router.use(auth_middleware_1.authMiddleware);
// Obtener calendarios externos del doctor
router.get('/', externalCalendar_controller_1.ExternalCalendarController.getExternalCalendars);
// Conectar calendarios
router.post('/google', externalCalendar_controller_1.ExternalCalendarController.connectGoogleCalendar);
router.post('/outlook', externalCalendar_controller_1.ExternalCalendarController.connectOutlookCalendar);
router.post('/apple', externalCalendar_controller_1.ExternalCalendarController.connectAppleCalendar);
router.post('/notion', externalCalendar_controller_1.ExternalCalendarController.connectNotionCalendar);
// Desconectar calendario
router.delete('/:calendarId', externalCalendar_controller_1.ExternalCalendarController.disconnectCalendar);
// Sincronizar calendario
router.post('/:calendarId/sync', externalCalendar_controller_1.ExternalCalendarController.syncExternalCalendar);
// Obtener eventos de calendario externo
router.get('/:calendarId/events', externalCalendar_controller_1.ExternalCalendarController.getExternalCalendarEvents);
exports.default = router;
