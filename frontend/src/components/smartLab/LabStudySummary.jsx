import { formatLabReportListTitle } from '../../utils/labReportDisplay';
import React from 'react';
import LabProcessingStatus from './LabProcessingStatus';

const formatDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

const LabStudySummary = ({ report }) => {
  if (!report) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{formatLabReportListTitle(report)}</h3>
          <p className="text-sm text-gray-600">{report.laboratoryName || 'Laboratorio no identificado'}</p>
        </div>
        <LabProcessingStatus status={report.extractionStatus} confidence={report.extractionConfidence} />
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-gray-500">Fecha del estudio</dt>
          <dd className="font-medium text-gray-900">{formatDate(report.studyDate)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Confirmado</dt>
          <dd className="font-medium text-gray-900">{formatDate(report.confirmedAt)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Resultados</dt>
          <dd className="font-medium text-gray-900">{report.results?.length ?? 0}</dd>
        </div>
      </dl>
    </div>
  );
};

export default LabStudySummary;

