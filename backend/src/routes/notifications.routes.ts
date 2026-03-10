import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { NotificationController } from '../controllers/notification.controller';
import AppointmentReminderCron from '../services/cron/appointmentReminder.cron';

const router = Router();

// Permitir acceso a doctores, asistentes y pacientes
// Solo admins/doctores autenticados deberían poder disparar manualmente
router.use(authMiddleware(['DOCTOR', 'ASISTENTE', 'PATIENT', 'ADMIN']));

// Rutas de notificaciones
router.get('/', NotificationController.getUserNotifications);
router.put('/:notificationId/read', NotificationController.markAsRead);
router.put('/mark-all-read', NotificationController.markAllAsRead);
router.delete('/:notificationId', NotificationController.deleteNotification);
router.post('/collaboration-request', NotificationController.createCollaborationRequest);

// Iniciar cron (idempotente)
router.post('/reminders/start', (_req, res) => {
  AppointmentReminderCron.start();
  res.json({ success: true, message: 'Cron de recordatorios iniciado' });
});

// Detener cron
router.post('/reminders/stop', (_req, res) => {
  AppointmentReminderCron.stop();
  res.json({ success: true, message: 'Cron de recordatorios detenido' });
});

// Ejecutar corridas manuales (útil para pruebas)
router.post('/reminders/run/1w', async (_req, res) => {
  await AppointmentReminderCron.runManual('1w');
  res.json({ success: true, message: 'Recordatorios 1 semana ejecutados' });
});

router.post('/reminders/run/48h', async (_req, res) => {
  await AppointmentReminderCron.runManual('48h');
  res.json({ success: true, message: 'Recordatorios 48h ejecutados' });
});

router.post('/reminders/run/24h', async (_req, res) => {
  await AppointmentReminderCron.runManual('24h');
  res.json({ success: true, message: 'Recordatorios 24h ejecutados' });
});

router.post('/reminders/run/4h', async (_req, res) => {
  await AppointmentReminderCron.runManual('4h');
  res.json({ success: true, message: 'Recordatorios 4h ejecutados' });
});

// Forzar recordatorio por cita
router.post('/reminders/force/:appointmentId', authMiddleware(['DOCTOR']), async (req, res) => {
  const { appointmentId } = req.params;
  const result = await AppointmentReminderCron.runManualForAppointment(appointmentId);
  res.json({ success: result.sent, ...result });
});

export default router;

