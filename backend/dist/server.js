"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const calendarSync_service_1 = __importDefault(require("./services/calendarSync.service"));
const appointmentReminder_cron_1 = __importDefault(require("./services/cron/appointmentReminder.cron"));
const subscriptionResume_cron_1 = __importDefault(require("./services/cron/subscriptionResume.cron"));
const PORT = env_1.env.PORT || 3000;
// Inicializar servicio de sincronización de calendarios
const calendarSyncService = new calendarSync_service_1.default();
calendarSyncService.startAutoSync();
// Iniciar cron de recordatorios
appointmentReminder_cron_1.default.start();
// Iniciar cron de reanudación de suscripciones (después del mes gratis)
subscriptionResume_cron_1.default.start();
app_1.default.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📅 Servicio de sincronización de calendarios iniciado`);
    console.log(`⏰ Cron de recordatorios iniciado`);
    console.log(`⏰ Cron de reanudación de suscripciones iniciado`);
});
