import app from './app';
import { env } from './config/env';
import CalendarSyncService from './services/calendarSync.service';
import AppointmentReminderCron from './services/cron/appointmentReminder.cron';
import SubscriptionResumeCron from './services/cron/subscriptionResume.cron';

const PORT = env.PORT || 3000;

// Inicializar servicio de sincronización de calendarios
const calendarSyncService = new CalendarSyncService();
calendarSyncService.startAutoSync();
// Iniciar cron de recordatorios
AppointmentReminderCron.start();
// Iniciar cron de reanudación de suscripciones (después del mes gratis)
SubscriptionResumeCron.start();

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📅 Servicio de sincronización de calendarios iniciado`);
  console.log(`⏰ Cron de recordatorios iniciado`);
  console.log(`⏰ Cron de reanudación de suscripciones iniciado`);
}); 