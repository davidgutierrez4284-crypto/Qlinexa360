import './config/env';
import app from './app';
import { env } from './config/env';
import { validateProductionSecrets } from './config/startupValidation';
import CalendarSyncService from './services/calendarSync.service';
import AppointmentReminderCron from './services/cron/appointmentReminder.cron';
import SubscriptionResumeCron from './services/cron/subscriptionResume.cron';
import { MercadoPagoPendingSyncCron } from './services/cron/mercadopagoPendingSync.cron';

validateProductionSecrets();

process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err);
  if (err && (err as Error).stack) console.error((err as Error).stack);
  // En development no matar el proceso: nodemon tiene exitcrash=true y el backend
  // quedaría abajo (upload/confirm fallan con "No se pudo confirmar").
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'development') {
    console.error('[FATAL] Continuando en development (sin process.exit).');
    return;
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ERROR] unhandledRejection:', reason);
  if (reason instanceof Error && reason.stack) console.error(reason.stack);
});

const PORT = env.PORT || 3000;

// Inicializar servicio de sincronización de calendarios
const calendarSyncService = new CalendarSyncService();
calendarSyncService.startAutoSync();
// Iniciar cron de recordatorios
AppointmentReminderCron.start();
// Iniciar cron de reanudación de suscripciones (después del mes gratis)
SubscriptionResumeCron.start();
MercadoPagoPendingSyncCron.start();

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📅 Servicio de sincronización de calendarios iniciado`);
  console.log(`⏰ Cron de recordatorios iniciado`);
  console.log(`⏰ Cron de reanudación de suscripciones iniciado`);
  console.log(`⏰ Cron de sincronización MP (pagos pending) iniciado`);
}); 