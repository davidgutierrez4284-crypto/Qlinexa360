/**
 * Imprimir comparación de estudios de laboratorio — Qlinexa360.
 * Genera HTML con @media print (cenefa y pie de página).
 */

import { LAB_DISCLAIMER_TEXT } from '../components/smartLab/LabDisclaimer';
import { formatLabReportStudyMonthYear } from './labReportDisplay';
import { openClinicalHistoryPrintWindow } from './clinicalHistoryPrint';

const REPORT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const BENEFITS_URL = 'https://www.qlinexa360.com/benefits';
const PRINT_DOCUMENT_TITLE = 'Comparación de estudios · Qlinexa360';

const SPANISH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatPrintSheetDateTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = SPANISH_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours %= 12;
  if (hours === 0) hours = 12;
  return `${day}-${month}-${year}, ${hours}:${minutes} ${ampm}`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtResult(r) {
  if (!r) return '—';
  return [r.resultValueText ?? r.resultValue, r.resultUnit].filter(Boolean).join(' ');
}

function buildTableHtml(comparison) {
  if (!comparison?.diffs?.length) {
    return '<p class="muted">No hay datos para imprimir.</p>';
  }

  if (comparison.reports?.length) {
    const reports = comparison.reports;
    const headerCells = reports
      .map(
        (report, i) => `<th>
          <div class="col-label">Reporte ${REPORT_LABELS[i] || i + 1}</div>
          <div class="col-date">${escapeHtml(formatLabReportStudyMonthYear(report.studyDate) || '—')}</div>
        </th>`
      )
      .join('');

    const bodyRows = comparison.diffs
      .map((d) => {
        const valueCells = (d.values || [])
          .map((val) => `<td>${escapeHtml(fmtResult(val))}</td>`)
          .join('');
        return `<tr><td class="analyte">${escapeHtml(d.analyte)}</td>${valueCells}</tr>`;
      })
      .join('');

    return `<table class="compare-table">
      <thead><tr><th>Indicador</th>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
  }

  const bodyRows = comparison.diffs
    .map(
      (d) => `<tr>
        <td class="analyte">${escapeHtml(d.analyte)}</td>
        <td>${escapeHtml(fmtResult(d.reportA))}</td>
        <td>${escapeHtml(fmtResult(d.reportB))}</td>
      </tr>`
    )
    .join('');

  return `<table class="compare-table">
    <thead><tr><th>Indicador</th><th>Reporte A</th><th>Reporte B</th></tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>`;
}

/**
 * @param {{ patientName: string, comparison: object }} options
 */
export function buildLabComparePrintHtml({ patientName, comparison }) {
  const printDate = formatPrintSheetDateTime();
  const safeName = escapeHtml(patientName || '—');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${PRINT_DOCUMENT_TITLE}</title>
  <style>
    @page {
      margin: 28mm 12mm 22mm 12mm;
    }

    * { box-sizing: border-box; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      color: #1f2937;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }

    .print-disclaimer {
      display: none;
    }

    .print-footer {
      display: none;
    }

    .sheet-header {
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
    }

    .sheet-header h1 {
      font-size: 16pt;
      margin: 0 0 8px;
      color: #111827;
    }

    .sheet-meta {
      font-size: 10pt;
      color: #374151;
      margin: 0;
    }

    .sheet-meta + .sheet-meta {
      margin-top: 4px;
    }

    .compare-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }

    .compare-table th,
    .compare-table td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }

    .compare-table thead th {
      background: #f3f4f6;
      font-weight: 600;
    }

    .compare-table .analyte {
      font-weight: 600;
      background: #fafafa;
    }

    .col-label {
      font-weight: 600;
    }

    .col-date {
      font-size: 8.5pt;
      font-weight: 400;
      color: #6b7280;
      margin-top: 2px;
    }

    .muted {
      color: #6b7280;
    }

    @media print {
      .print-disclaimer {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        margin: 0;
        padding: 8px 12px;
        background: #fffbeb;
        border-bottom: 2px solid #f59e0b;
        color: #78350f;
        font-size: 8pt;
        line-height: 1.35;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .print-disclaimer-icon {
        flex-shrink: 0;
        width: 14px;
        height: 14px;
        margin-top: 1px;
      }

      .print-footer {
        display: block;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        padding: 6px 12px;
        border-top: 1px solid #d1d5db;
        background: #fff;
        font-size: 8.5pt;
        color: #4b5563;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .print-footer-url {
        color: #2563eb;
        word-break: break-all;
      }

      .print-content {
        padding-top: 52px;
        padding-bottom: 36px;
      }

      .compare-table thead {
        display: table-header-group;
      }

      .compare-table tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="print-disclaimer" role="note">
    <svg class="print-disclaimer-icon" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
    <p style="margin:0;">${escapeHtml(LAB_DISCLAIMER_TEXT)}</p>
  </div>

  <div class="print-footer">
    <div class="print-footer-url">${BENEFITS_URL}</div>
  </div>

  <div class="print-content">
    <header class="sheet-header">
      <h1>Comparación de estudios de laboratorio</h1>
      <p class="sheet-meta"><strong>Paciente:</strong> ${safeName}</p>
      <p class="sheet-meta"><strong>Fecha de impresión:</strong> ${escapeHtml(printDate)}</p>
    </header>
    ${buildTableHtml(comparison)}
  </div>
</body>
</html>`;
}

export function hasPrintableLabComparison(comparison) {
  return Boolean(comparison?.diffs?.length);
}

export function printLabCompareStudy({ patientName, comparison }) {
  const html = buildLabComparePrintHtml({ patientName, comparison });
  return openClinicalHistoryPrintWindow(html, {
    documentTitle: PRINT_DOCUMENT_TITLE,
    printUrlPath: '/print/comparacion-estudios',
  });
}
