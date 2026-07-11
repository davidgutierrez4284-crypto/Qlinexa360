/** Consulta generada desde pre-consulta del paciente (tag o formData). */
export function isPreConsultaConsultation(consultation) {
  if (!consultation) return false;
  const tags = consultation.tags || [];
  if (tags.includes('pre-consulta')) return true;
  const fd = consultation.formData;
  if (fd && typeof fd === 'object') {
    const etiquetas = fd.etiquetas;
    if (Array.isArray(etiquetas) && etiquetas.includes('pre-consulta')) return true;
    if (fd.origenConsulta === 'pre-consulta' || fd.registradoPor === 'PACIENTE_PRE_CONSULTA') return true;
  }
  return false;
}

/** Etiqueta para quién registró la consulta en el historial. */
export function getConsultationAttendedByLabel(consultation) {
  if (isPreConsultaConsultation(consultation)) {
    return 'Pre-consulta (llenada por el paciente)';
  }
  if (consultation?.user?.firstName) {
    return `${consultation.user.firstName} ${consultation.user.lastName || ''}`.trim();
  }
  return '—';
}
