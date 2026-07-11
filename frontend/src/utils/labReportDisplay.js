export function formatLabReportStudyDate(studyDate) {
  if (!studyDate) return null;
  try {
    return new Date(studyDate).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/** Mes abreviado + año, p. ej. "nov 2015" */
export function formatLabReportStudyMonthYear(studyDate) {
  if (!studyDate) return null;
  try {
    return new Date(studyDate).toLocaleDateString('es-MX', {
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

function isMostlyUppercase(text) {
  const letters = text.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g);
  if (!letters || letters.length < 4) return false;
  const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  return upper / letters.length > 0.8;
}

export function toLabReportDisplayCase(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed || !isMostlyUppercase(trimmed)) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

const LONG_LAB_REPORT_TITLE_LENGTH = 55;

export function labReportListTitleClassName(title) {
  const long = String(title || '').length > LONG_LAB_REPORT_TITLE_LENGTH;
  return [
    'font-medium text-gray-900 line-clamp-2 break-words min-w-0',
    long ? 'text-sm leading-snug' : 'text-base',
  ].join(' ');
}

export function formatLabReportListTitle(report) {
  if (!report) return 'Estudio de laboratorio';
  const parts = [];
  if (report.laboratoryName) parts.push(toLabReportDisplayCase(String(report.laboratoryName).trim()));
  const dateStr = formatLabReportStudyDate(report.studyDate);
  if (dateStr) parts.push(dateStr);
  if (report.studyType) parts.push(toLabReportDisplayCase(String(report.studyType).trim()));
  if (parts.length) return parts.join(' · ');
  return 'Estudio de laboratorio';
}

export function labReportStatusNote(report) {
  if (!report) return null;
  if (report.extractionStatus === 'pending_review' && (!report.results || report.results.length === 0)) {
    return 'No se detectaron parámetros automáticamente';
  }
  return null;
}
