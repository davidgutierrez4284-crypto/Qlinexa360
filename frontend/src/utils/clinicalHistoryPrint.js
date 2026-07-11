/**
 * Imprimir / guardar PDF del historial clínico (caso seleccionado) — Qlinexa360.
 * Genera HTML, abre ventana y llama a print() (sin PDF server-side).
 */

import { formatDateOfBirthDisplay, getAgeInYears } from './ageUtils';
import { getConsultationAttendedByLabel } from './consultationDisplay';

const BRAND_SITE_NAME = 'Qlinexa360';
const PLATFORM_SITE_HREF = 'https://www.qlinexa360.com';
const PLATFORM_SITE_LABEL = 'www.qlinexa360.com';

const CLINICAL_EVOLUTION_LABELS = {
  INITIAL_EVALUATION: 'Evaluación inicial',
  CONFIRMED_DIAGNOSIS: 'Diagnóstico confirmado',
  TREATMENT_PLAN: 'Plan de tratamiento',
  FOLLOW_UP: 'Seguimiento',
  STABILIZATION: 'Estabilización',
  MEDICAL_DISCHARGE: 'Alta médica',
  READMISSION: 'Reingreso'
};

const FILE_CATEGORY_LABELS = {
  PRESCRIPTION_REQUEST: 'Recetas o solicitudes de estudio',
  DOCTOR_PHOTO: 'Fotografías clínicas',
  STUDY_RESULT: 'Estudios de laboratorio o imagen',
  PATIENT_PHOTO: 'Fotografías del paciente'
};

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(d) {
  if (!d) return '—';
  try {
    const x = d instanceof Date ? d : new Date(d);
    return x.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return String(d);
  }
}

function patientAge(patient) {
  if (!patient?.dateOfBirth) return null;
  const b = new Date(patient.dateOfBirth);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}

function maskEmail(e) {
  if (!e || String(e).includes('patient-no-email')) return '—';
  return e;
}

function countAttachmentsByCategory(files) {
  const counts = {};
  if (!Array.isArray(files)) return counts;
  for (const f of files) {
    const c = f.category || 'OTHER';
    counts[c] = (counts[c] || 0) + 1;
  }
  return counts;
}

function legalDisclaimerHtml() {
  return `<div class="print-footer-legal">
    <p><strong>Sitio web de la plataforma:</strong> <a href="${PLATFORM_SITE_HREF}">${PLATFORM_SITE_LABEL}</a></p>
    <p><strong>Aviso legal:</strong> ${BRAND_SITE_NAME} es una plataforma tecnológica de gestión de información clínica. La responsabilidad del contenido clínico recae en el profesional de la salud que documenta. La plataforma no presta servicios médicos ni valida el contenido clínico.</p>
    <p><strong>Restricción:</strong> esta exportación no sustituye recetarios especiales ni autorizaciones regulatorias aplicables a medicamentos sujetos a control.</p>
  </div>`;
}

/**
 * @param {object} options
 * @param {object} options.patient
 * @param {object} options.selectedCase { id, padecimiento, ... }
 * @param {Array} options.consultations  ordenadas cronológicamente (asc) por fecha
 * @param {Array} options.formTemplates
 */
export function buildPrintDocumentHtml({ patient, selectedCase, consultations, formTemplates = [] }) {
  const caseTitle = selectedCase?.padecimiento || 'Caso clínico';
  const now = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
  const sorted = [...(consultations || [])].sort((a, b) => {
    const da = new Date(a.date || a.createdAt).getTime();
    const dbb = new Date(b.date || b.createdAt).getTime();
    return da - dbb;
  });
  const n = sorted.length;
  const age = patient?.dateOfBirth != null ? getAgeInYears(patient.dateOfBirth) : null;

  let consultBlocks = '';
  sorted.forEach((c, i) => {
    const ev = c.clinicalEvolution
      ? CLINICAL_EVOLUTION_LABELS[c.clinicalEvolution] || c.clinicalEvolution
      : '—';
    const attended = getConsultationAttendedByLabel(c);
    const fileCounts = countAttachmentsByCategory(c.files);
    const fileLines = Object.entries(fileCounts)
      .map(([cat, count]) => {
        const label = FILE_CATEGORY_LABELS[cat] || 'Otros documentos';
        return `<li>${escapeHtml(label)}: <strong>${count}</strong> archivo(s)</li>`;
      })
      .join('');

    let formSection = '';
    const fd = c.formData && typeof c.formData === 'object' ? c.formData : null;
    if (fd && formTemplates.length) {
      const rows = [];
      for (const t of formTemplates) {
        const tFields = (t.fields || [])
          .map((f) => {
            const v = fd[f.id];
            if (v == null || v === '') return null;
            return `<tr><td>${escapeHtml(f.label || f.id)}</td><td>${escapeHtml(String(v))}</td></tr>`;
          })
          .filter(Boolean)
          .join('');
        if (tFields) {
          rows.push(
            `<h4 style="margin:8px 0 4px;">${escapeHtml(t.name || 'Formulario')}</h4><table class="tbl">${tFields}</table>`
          );
        }
      }
      if (rows.length) formSection = `<div class="form-block">${rows.join('')}</div>`;
    }

    const links = Array.isArray(c.links)
      ? c.links
          .map((l) => `<li><a href="${escapeHtml(l.url)}">${escapeHtml(l.url)}</a>${l.description ? ` — ${escapeHtml(l.description)}` : ''}</li>`)
          .join('')
      : '';

    consultBlocks += `
      <section class="consultation-block" style="page-break-inside:avoid;">
        <h3>Consulta ${i + 1} de ${n}</h3>
        <p class="meta"><strong>Fecha:</strong> ${formatDateTime(c.date || c.createdAt)} · <strong>Evolución clínica:</strong> ${escapeHtml(ev)} · <strong>Atendido por:</strong> ${escapeHtml(attended)}</p>
        <p><strong>Diagnóstico / motivo (extracto):</strong></p>
        <pre class="pre">${escapeHtml(c.diagnosis || c.reason || '—')}</pre>
        <p><strong>Tratamiento / notas:</strong></p>
        <pre class="pre">${escapeHtml(c.treatment || c.notes || '—')}</pre>
        ${formSection}
        ${
          fileLines
            ? `<p><strong>Archivos por tipo:</strong></p><ul>${fileLines}</ul>`
            : '<p class="muted">Sin archivos adjuntos en esta consulta.</p>'
        }
        ${links ? `<p><strong>Enlaces:</strong></p><ul>${links}</ul>` : ''}
      </section>`;
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Historial — ${escapeHtml(caseTitle)} — ${BRAND_SITE_NAME}</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #222; line-height: 1.35; }
    h1 { font-size: 16pt; color: #1e3a5f; }
    h2 { font-size: 13pt; margin-top: 1em; }
    h3 { font-size: 12pt; color: #2563eb; margin: 0.6em 0 0.3em; }
    .meta { font-size: 10pt; color: #555; }
    .pre { white-space: pre-wrap; font-family: inherit; background: #f8fafc; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb; }
    .tbl { width: 100%; border-collapse: collapse; font-size: 10pt; }
    .tbl td { border: 1px solid #e5e7eb; padding: 4px 6px; vertical-align: top; }
    .tbl td:first-child { width: 40%; color: #374151; }
    .muted { color: #6b7280; font-size: 10pt; }
    @media print {
      .print-footer-legal { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { padding-bottom: 32mm; }
    }
    .print-footer-legal { font-size: 7.5pt; color: #4b5563; border: 1px solid #e5e7eb; background: #f9fafb; padding: 10px; margin-top: 16px; }
    .print-footer-legal a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Historial clínico</h1>
  <p class="meta"><strong>Fecha de impresión:</strong> ${escapeHtml(now)}</p>
  <h2>Caso clínico: ${escapeHtml(caseTitle)}</h2>
  <h2>Datos del paciente</h2>
  <table class="tbl">
    <tr><td>Nombre</td><td>${escapeHtml(`${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || '—')}</td></tr>
    <tr><td>Correo</td><td>${escapeHtml(maskEmail(patient?.email))}</td></tr>
    <tr><td>Teléfono</td><td>${escapeHtml(patient?.phone || '—')}</td></tr>
    <tr><td>Fecha de nacimiento</td><td>${patient?.dateOfBirth ? formatDateOfBirthDisplay(patient.dateOfBirth) : '—'}${age != null ? ` (edad: ${age} años)` : ''}</td></tr>
    <tr><td>Expediente (ID interno)</td><td>${escapeHtml(patient?.id || '—')}</td></tr>
  </table>
  <h2>Consultas del caso</h2>
  ${consultBlocks || '<p class="muted">No hay consultas en este caso.</p>'}
  ${legalDisclaimerHtml()}
</body>
</html>`;
}

/**
 * Abre una ventana con el HTML y dispara el diálogo de impresión.
 * - Evitamos URL `blob:` + `load` (condición de carrera: `print()` a veces nunca se ejecutaba).
 * - `document.write` + un único `setTimeout` es estable en Chrome / Edge / Firefox.
 * - No usamos `noopener` en features: en algunos navegadores la referencia a la ventana falla y no se puede imprimir.
 */
export function openClinicalHistoryPrintWindow(html, options = {}) {
  const documentTitle = options.documentTitle ?? options.title ?? null;
  const printUrlPath = options.printUrlPath ?? options.printPath ?? '/print';

  const w = window.open('', '_blank', 'width=900,height=1200');
  if (!w) {
    return false;
  }
  try {
    w.document.open();
    w.document.write(html);
    w.document.close();
    if (documentTitle) {
      w.document.title = documentTitle;
    }
    try {
      w.history.replaceState(null, documentTitle || '', printUrlPath);
    } catch {
      // ignore — algunos navegadores restringen replaceState en ventanas emergentes
    }
  } catch (e) {
    console.error('clinicalHistoryPrint: error al escribir documento', e);
    try {
      w.close();
    } catch {
      // ignore
    }
    return false;
  }

  const runPrint = () => {
    try {
      w.focus();
      w.print();
    } catch (e) {
      console.error('clinicalHistoryPrint: print()', e);
    }
  };

  // Un solo disparo: tiempo suficiente para que el documento se renderice antes de print()
  window.setTimeout(runPrint, 400);

  w.addEventListener(
    'afterprint',
    () => {
      try {
        w.close();
      } catch {
        // ignore
      }
    },
    { once: true }
  );

  return true;
}
