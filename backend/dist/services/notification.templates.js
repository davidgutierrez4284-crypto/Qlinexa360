"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTimeES = exports.formatDateES = exports.buildEmailDoctorNewAppointment = exports.buildEmailReminder2h = exports.buildEmailReminder24h = exports.buildEmailConfirmation = exports.buildWhatsAppDoctorNewAppointment = exports.buildWhatsAppAppointmentReminder2h = exports.buildWhatsAppAppointmentReminder24h = exports.buildWhatsAppAppointmentConfirmation = exports.WhatsAppTemplateCatalog = void 0;
// WhatsApp template definitions for submission/approval in Meta
exports.WhatsAppTemplateCatalog = {
    appointment_confirmation_es: {
        language: 'es',
        category: 'UTILITY',
        placeholders: ['nombre_paciente', 'nombre_doctor', 'fecha', 'hora', 'motivo', 'lugar_o_enlace', 'enlace_detalle'],
        body: 'Hola {{1}}, tu cita ha sido confirmada.\nDoctor: {{2}}\nFecha: {{3}}\nHora: {{4}}\nMotivo: {{5}}\nLugar/Enlace: {{6}}\nGuarda este mensaje como comprobante. ¡Te esperamos!',
        footer: 'Qlinexa360 • Mensaje automático',
        buttonUrl: { label: 'Ver detalles', parameterIndex: 7 }
    },
    appointment_reminder_24h_es: {
        language: 'es',
        category: 'UTILITY',
        placeholders: ['nombre_paciente', 'nombre_doctor', 'fecha', 'hora', 'motivo', 'lugar_o_enlace', 'enlace_detalle'],
        body: 'Hola {{1}}, te recordamos tu cita de mañana.\nDoctor: {{2}}\nFecha: {{3}}\nHora: {{4}}\nMotivo: {{5}}\nLugar/Enlace: {{6}}\nSi necesitas reprogramar, responde a este mensaje.',
        footer: 'Qlinexa360 • Recordatorio 24 h',
        buttonUrl: { label: 'Ver detalles', parameterIndex: 7 }
    },
    appointment_reminder_2h_es: {
        language: 'es',
        category: 'UTILITY',
        placeholders: ['nombre_paciente', 'nombre_doctor', 'fecha', 'hora', 'motivo', 'lugar_o_enlace', 'enlace_detalle'],
        body: 'Hola {{1}}, tu cita es en aproximadamente 2 horas.\nDoctor: {{2}} • Hora: {{4}}\nMotivo: {{5}}\nLugar/Enlace: {{6}}\nLlega 10 minutos antes. ¡Gracias!',
        footer: 'Qlinexa360 • Recordatorio 2 h',
        buttonUrl: { label: 'Ver detalles', parameterIndex: 7 }
    },
    appointment_rescheduled_es: {
        language: 'es',
        category: 'UTILITY',
        placeholders: ['nombre_paciente', 'nombre_doctor', 'fecha', 'hora', 'motivo', 'lugar_o_enlace', 'enlace_detalle'],
        body: 'Hola {{1}}, tu cita ha sido reprogramada.\nDoctor: {{2}}\nNueva fecha: {{3}}\nNueva hora: {{4}}\nMotivo: {{5}}\nLugar/Enlace: {{6}}\nSi no puedes asistir, responde para reprogramar.',
        footer: 'Qlinexa360',
        buttonUrl: { label: 'Ver detalles', parameterIndex: 7 }
    },
    appointment_canceled_es: {
        language: 'es',
        category: 'UTILITY',
        placeholders: ['nombre_paciente', 'nombre_doctor', 'fecha', 'hora', 'motivo', 'enlace_nueva_cita'],
        body: 'Hola {{1}}, tu cita ha sido cancelada.\nDoctor: {{2}}\nFecha original: {{3}} • Hora: {{4}}\nMotivo: {{5}}\nSi deseas agendar otra cita, utiliza este enlace: {{6}}',
        footer: 'Qlinexa360',
        buttonUrl: { label: 'Agendar nueva', parameterIndex: 6 }
    },
    doctor_new_appointment_es: {
        language: 'es',
        category: 'UTILITY',
        placeholders: ['nombre_paciente', 'nombre_doctor', 'fecha', 'hora', 'motivo', 'enlace_detalle'],
        body: 'Nueva cita agendada.\nPaciente: {{1}}\nFecha: {{3}} • Hora: {{4}}\nMotivo: {{5}}\nRevisa tu calendario o el detalle en el sistema.',
        footer: 'Qlinexa360',
        buttonUrl: { label: 'Ver cita', parameterIndex: 6 }
    }
};
// Builders (texto libre) para usar en envíos inmediatos
const buildWhatsAppAppointmentConfirmation = (v) => { var _a; return `✅ Confirmación de Cita\n\nDoctor: ${v.doctorName}\nFecha: ${v.dateStr}\nHora: ${v.timeStr}\nMotivo: ${v.reason}\nLugar/Enlace: ${v.locationOrUrl}\n\nDetalle: ${(_a = v.detailsUrl) !== null && _a !== void 0 ? _a : ''}\n\nQlinexa360`; };
exports.buildWhatsAppAppointmentConfirmation = buildWhatsAppAppointmentConfirmation;
const buildWhatsAppAppointmentReminder24h = (v) => { var _a; return `⏰ Recordatorio (24 h)\n\nHola ${v.patientName}, te recordamos tu cita de mañana con ${v.doctorName}.\nFecha: ${v.dateStr}\nHora: ${v.timeStr}\nMotivo: ${v.reason}\nLugar/Enlace: ${v.locationOrUrl}\n\nDetalle: ${(_a = v.detailsUrl) !== null && _a !== void 0 ? _a : ''}\n\nQlinexa360`; };
exports.buildWhatsAppAppointmentReminder24h = buildWhatsAppAppointmentReminder24h;
const buildWhatsAppAppointmentReminder2h = (v) => { var _a; return `⏰ Recordatorio (2 h)\n\nTu cita es en ~2 horas.\nDoctor: ${v.doctorName}\nHora: ${v.timeStr}\nMotivo: ${v.reason}\nLugar/Enlace: ${v.locationOrUrl}\n\nDetalle: ${(_a = v.detailsUrl) !== null && _a !== void 0 ? _a : ''}\n\nQlinexa360`; };
exports.buildWhatsAppAppointmentReminder2h = buildWhatsAppAppointmentReminder2h;
const buildWhatsAppDoctorNewAppointment = (v) => { var _a; return `📅 Nueva Cita Agendada\n\nPaciente: ${v.patientNameOnly}\nFecha: ${v.dateStr} • Hora: ${v.timeStr}\nMotivo: ${v.reason}\n\nDetalle: ${(_a = v.detailsUrl) !== null && _a !== void 0 ? _a : ''}\n\nQlinexa360`; };
exports.buildWhatsAppDoctorNewAppointment = buildWhatsAppDoctorNewAppointment;
// Email builders
const buildEmailConfirmation = (v) => {
    var _a;
    return ({
        subject: `Confirmación de tu cita – ${v.doctorName} (${v.dateStr} • ${v.timeStr})`,
        body: `Hola ${v.patientName},\n\nTu cita ha sido confirmada.\n\n- Doctor: ${v.doctorName}\n- Fecha: ${v.dateStr}\n- Hora: ${v.timeStr}\n- Motivo: ${v.reason}\n- Lugar/Enlace: ${v.locationOrUrl}\n\nVer detalles o reprogramar: ${(_a = v.detailsUrl) !== null && _a !== void 0 ? _a : ''}\n\nGracias por confiar en Qlinexa360.`
    });
};
exports.buildEmailConfirmation = buildEmailConfirmation;
const buildEmailReminder24h = (v) => {
    var _a;
    return ({
        subject: `Recordatorio: tu cita es mañana (${v.dateStr} • ${v.timeStr})`,
        body: `Hola ${v.patientName},\n\nTe recordamos tu cita de mañana con ${v.doctorName}.\n\n- Fecha: ${v.dateStr}\n- Hora: ${v.timeStr}\n- Motivo: ${v.reason}\n- Lugar/Enlace: ${v.locationOrUrl}\n\nVer detalles: ${(_a = v.detailsUrl) !== null && _a !== void 0 ? _a : ''}\n\nPor favor, llega 10 minutos antes.`
    });
};
exports.buildEmailReminder24h = buildEmailReminder24h;
const buildEmailReminder2h = (v) => {
    var _a;
    return ({
        subject: `Recordatorio: tu cita es en 2 horas (${v.timeStr})`,
        body: `Hola ${v.patientName},\n\nEn ~2 horas tienes tu cita:\n\n- Doctor: ${v.doctorName}\n- Hora: ${v.timeStr}\n- Motivo: ${v.reason}\n- Lugar/Enlace: ${v.locationOrUrl}\n\nVer detalles: ${(_a = v.detailsUrl) !== null && _a !== void 0 ? _a : ''}`
    });
};
exports.buildEmailReminder2h = buildEmailReminder2h;
const buildEmailDoctorNewAppointment = (v) => {
    var _a;
    return ({
        subject: `Nueva cita agendada – ${v.patientNameOnly} (${v.dateStr} • ${v.timeStr})`,
        body: `Hola ${v.doctorName},\n\nSe agendó una nueva cita:\n\n- Paciente: ${v.patientNameOnly}\n- Fecha: ${v.dateStr} • Hora: ${v.timeStr}\n- Motivo: ${v.reason}\n\nVer en Qlinexa360: ${(_a = v.detailsUrl) !== null && _a !== void 0 ? _a : ''}`
    });
};
exports.buildEmailDoctorNewAppointment = buildEmailDoctorNewAppointment;
// Helpers
const formatDateES = (date) => new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
exports.formatDateES = formatDateES;
const formatTimeES = (date) => new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(date);
exports.formatTimeES = formatTimeES;
