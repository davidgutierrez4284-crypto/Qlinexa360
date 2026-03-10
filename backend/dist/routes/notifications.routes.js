"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const notification_controller_1 = require("../controllers/notification.controller");
const appointmentReminder_cron_1 = __importDefault(require("../services/cron/appointmentReminder.cron"));
const router = (0, express_1.Router)();
// Permitir acceso a doctores, asistentes y pacientes
// Solo admins/doctores autenticados deberían poder disparar manualmente
router.use((0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE', 'PATIENT', 'ADMIN']));
// Rutas de notificaciones
router.get('/', notification_controller_1.NotificationController.getUserNotifications);
router.put('/:notificationId/read', notification_controller_1.NotificationController.markAsRead);
router.put('/mark-all-read', notification_controller_1.NotificationController.markAllAsRead);
router.delete('/:notificationId', notification_controller_1.NotificationController.deleteNotification);
router.post('/collaboration-request', notification_controller_1.NotificationController.createCollaborationRequest);
// Iniciar cron (idempotente)
router.post('/reminders/start', (_req, res) => {
    appointmentReminder_cron_1.default.start();
    res.json({ success: true, message: 'Cron de recordatorios iniciado' });
});
// Detener cron
router.post('/reminders/stop', (_req, res) => {
    appointmentReminder_cron_1.default.stop();
    res.json({ success: true, message: 'Cron de recordatorios detenido' });
});
// Ejecutar corridas manuales (útil para pruebas)
router.post('/reminders/run/1w', async (_req, res) => {
    await appointmentReminder_cron_1.default.runManual('1w');
    res.json({ success: true, message: 'Recordatorios 1 semana ejecutados' });
});
router.post('/reminders/run/48h', async (_req, res) => {
    await appointmentReminder_cron_1.default.runManual('48h');
    res.json({ success: true, message: 'Recordatorios 48h ejecutados' });
});
router.post('/reminders/run/24h', async (_req, res) => {
    await appointmentReminder_cron_1.default.runManual('24h');
    res.json({ success: true, message: 'Recordatorios 24h ejecutados' });
});
router.post('/reminders/run/4h', async (_req, res) => {
    await appointmentReminder_cron_1.default.runManual('4h');
    res.json({ success: true, message: 'Recordatorios 4h ejecutados' });
});
// Forzar recordatorio por cita
router.post('/reminders/force/:appointmentId', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), async (req, res) => {
    const { appointmentId } = req.params;
    const result = await appointmentReminder_cron_1.default.runManualForAppointment(appointmentId);
    res.json(Object.assign({ success: result.sent }, result));
});
exports.default = router;
