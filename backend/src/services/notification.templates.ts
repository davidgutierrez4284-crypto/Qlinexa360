export type AppointmentTemplateVars = {
  patientName: string;
  doctorName: string;
  dateStr: string; // e.g., 10/08/2025
  timeStr: string; // e.g., 10:30 a. m.
  reason: string;
  locationOrUrl: string; // place or meet/zoom link
  detailsUrl?: string; // deep link to appointment
  appointmentId?: string;
};

// WhatsApp template definitions for submission/approval in Meta
export const WhatsAppTemplateCatalog = {
  appointment_confirmation_es: {
    language: 'es',
    category: 'UTILITY',
    placeholders: ['nombre_paciente', 'nombre_doctor', 'fecha', 'hora', 'motivo', 'lugar_o_enlace', 'enlace_detalle'],
    body:
      'Hola {{1}}, tu cita ha sido confirmada.\nDoctor: {{2}}\nFecha: {{3}}\nHora: {{4}}\nMotivo: {{5}}\nLugar/Enlace: {{6}}\nGuarda este mensaje como comprobante. ¡Te esperamos!',
    footer: 'Qlinexa360 • Mensaje automático',
    buttonUrl: { label: 'Ver detalles', parameterIndex: 7 }
  },
  appointment_reminder_24h_es: {
    language: 'es',
    category: 'UTILITY',
    placeholders: ['nombre_paciente', 'nombre_doctor', 'fecha', 'hora', 'motivo', 'lugar_o_enlace', 'enlace_detalle'],
    body:
      'Hola {{1}}, te recordamos tu cita de mañana.\nDoctor: {{2}}\nFecha: {{3}}\nHora: {{4}}\nMotivo: {{5}}\nLugar/Enlace: {{6}}\nSi necesitas reprogramar, responde a este mensaje.',
    footer: 'Qlinexa360 • Recordatorio 24 h',
    buttonUrl: { label: 'Ver detalles', parameterIndex: 7 }
  },
  appointment_reminder_2h_es: {
    language: 'es',
    category: 'UTILITY',
    placeholders: ['nombre_paciente', 'nombre_doctor', 'fecha', 'hora', 'motivo', 'lugar_o_enlace', 'enlace_detalle'],
    body:
      'Hola {{1}}, tu cita es en aproximadamente 2 horas.\nDoctor: {{2}} • Hora: {{4}}\nMotivo: {{5}}\nLugar/Enlace: {{6}}\nLlega 10 minutos antes. ¡Gracias!',
    footer: 'Qlinexa360 • Recordatorio 2 h',
    buttonUrl: { label: 'Ver detalles', parameterIndex: 7 }
  },
  appointment_rescheduled_es: {
    language: 'es',
    category: 'UTILITY',
    placeholders: ['nombre_paciente', 'nombre_doctor', 'fecha', 'hora', 'motivo', 'lugar_o_enlace', 'enlace_detalle'],
    body:
      'Hola {{1}}, tu cita ha sido reprogramada.\nDoctor: {{2}}\nNueva fecha: {{3}}\nNueva hora: {{4}}\nMotivo: {{5}}\nLugar/Enlace: {{6}}\nSi no puedes asistir, responde para reprogramar.',
    footer: 'Qlinexa360',
    buttonUrl: { label: 'Ver detalles', parameterIndex: 7 }
  },
  appointment_canceled_es: {
    language: 'es',
    category: 'UTILITY',
    placeholders: ['nombre_paciente', 'nombre_doctor', 'fecha', 'hora', 'motivo', 'enlace_nueva_cita'],
    body:
      'Hola {{1}}, tu cita ha sido cancelada.\nDoctor: {{2}}\nFecha original: {{3}} • Hora: {{4}}\nMotivo: {{5}}\nSi deseas agendar otra cita, utiliza este enlace: {{6}}',
    footer: 'Qlinexa360',
    buttonUrl: { label: 'Agendar nueva', parameterIndex: 6 }
  },
  doctor_new_appointment_es: {
    language: 'es',
    category: 'UTILITY',
    placeholders: ['nombre_paciente', 'nombre_doctor', 'fecha', 'hora', 'motivo', 'enlace_detalle'],
    body:
      'Nueva cita agendada.\nPaciente: {{1}}\nFecha: {{3}} • Hora: {{4}}\nMotivo: {{5}}\nRevisa tu calendario o el detalle en el sistema.',
    footer: 'Qlinexa360',
    buttonUrl: { label: 'Ver cita', parameterIndex: 6 }
  }
} as const;

// Builders (texto libre) para usar en envíos inmediatos
export const buildWhatsAppAppointmentConfirmation = (v: AppointmentTemplateVars): string =>
  `✅ Confirmación de Cita\n\nDoctor: ${v.doctorName}\nFecha: ${v.dateStr}\nHora: ${v.timeStr}\nMotivo: ${v.reason}\nLugar/Enlace: ${v.locationOrUrl}\n\nDetalle: ${v.detailsUrl ?? ''}\n\nQlinexa360`;

export const buildWhatsAppAppointmentReminder24h = (v: AppointmentTemplateVars): string =>
  `⏰ Recordatorio (24 h)\n\nHola ${v.patientName}, te recordamos tu cita de mañana con ${v.doctorName}.\nFecha: ${v.dateStr}\nHora: ${v.timeStr}\nMotivo: ${v.reason}\nLugar/Enlace: ${v.locationOrUrl}\n\nDetalle: ${v.detailsUrl ?? ''}\n\nQlinexa360`;

export const buildWhatsAppAppointmentReminder2h = (v: AppointmentTemplateVars): string =>
  `⏰ Recordatorio (2 h)\n\nTu cita es en ~2 horas.\nDoctor: ${v.doctorName}\nHora: ${v.timeStr}\nMotivo: ${v.reason}\nLugar/Enlace: ${v.locationOrUrl}\n\nDetalle: ${v.detailsUrl ?? ''}\n\nQlinexa360`;

export const buildWhatsAppDoctorNewAppointment = (v: AppointmentTemplateVars & { patientNameOnly: string }): string =>
  `📅 Nueva Cita Agendada\n\nPaciente: ${v.patientNameOnly}\nFecha: ${v.dateStr} • Hora: ${v.timeStr}\nMotivo: ${v.reason}\n\nDetalle: ${v.detailsUrl ?? ''}\n\nQlinexa360`;

// Email builders
export const buildEmailConfirmation = (v: AppointmentTemplateVars) => ({
  subject: `Confirmación de tu cita – ${v.doctorName} (${v.dateStr} • ${v.timeStr})`,
  body: `Hola ${v.patientName},\n\nTu cita ha sido confirmada.\n\n- Doctor: ${v.doctorName}\n- Fecha: ${v.dateStr}\n- Hora: ${v.timeStr}\n- Motivo: ${v.reason}\n- Lugar/Enlace: ${v.locationOrUrl}\n\nVer detalles o reprogramar: ${v.detailsUrl ?? ''}\n\nGracias por confiar en Qlinexa360.`
});

export const buildEmailReminder24h = (v: AppointmentTemplateVars) => ({
  subject: `Recordatorio: tu cita es mañana (${v.dateStr} • ${v.timeStr})`,
  body: `Hola ${v.patientName},\n\nTe recordamos tu cita de mañana con ${v.doctorName}.\n\n- Fecha: ${v.dateStr}\n- Hora: ${v.timeStr}\n- Motivo: ${v.reason}\n- Lugar/Enlace: ${v.locationOrUrl}\n\nVer detalles: ${v.detailsUrl ?? ''}\n\nPor favor, llega 10 minutos antes.`
});

export const buildEmailReminder2h = (v: AppointmentTemplateVars) => ({
  subject: `Recordatorio: tu cita es en 2 horas (${v.timeStr})`,
  body: `Hola ${v.patientName},\n\nEn ~2 horas tienes tu cita:\n\n- Doctor: ${v.doctorName}\n- Hora: ${v.timeStr}\n- Motivo: ${v.reason}\n- Lugar/Enlace: ${v.locationOrUrl}\n\nVer detalles: ${v.detailsUrl ?? ''}`
});

export const buildEmailDoctorNewAppointment = (v: AppointmentTemplateVars & { patientNameOnly: string }) => ({
  subject: `Nueva cita agendada – ${v.patientNameOnly} (${v.dateStr} • ${v.timeStr})`,
  body: `Hola ${v.doctorName},\n\nSe agendó una nueva cita:\n\n- Paciente: ${v.patientNameOnly}\n- Fecha: ${v.dateStr} • Hora: ${v.timeStr}\n- Motivo: ${v.reason}\n\nVer en Qlinexa360: ${v.detailsUrl ?? ''}`
});

// Helpers
export const formatDateES = (date: Date) =>
  new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export const formatTimeES = (date: Date) =>
  new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(date);

