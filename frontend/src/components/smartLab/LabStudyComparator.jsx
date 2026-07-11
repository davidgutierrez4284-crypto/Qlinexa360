import React from 'react';
import { formatLabReportStudyMonthYear } from '../../utils/labReportDisplay';

const REPORT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const fmt = (r) => {
  if (!r) return '—';
  return [r.resultValueText ?? r.resultValue, r.resultUnit].filter(Boolean).join(' ');
};

const LabStudyComparator = ({ comparison, loading }) => {
  if (loading) return <p className="text-sm text-gray-500">Comparando estudios...</p>;
  if (!comparison) return null;

  if (comparison.diffs && comparison.reports?.length) {
    const reports = comparison.reports;
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left sticky left-0 bg-gray-50 z-10">Indicador</th>
              {reports.map((report, i) => (
                <th key={report.id} className="px-3 py-2 text-left whitespace-nowrap">
                  <div className="font-medium">Reporte {REPORT_LABELS[i] || i + 1}</div>
                  <div className="text-xs font-normal text-gray-500">
                    {formatLabReportStudyMonthYear(report.studyDate) || '—'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {comparison.diffs.map((d, i) => (
              <tr key={i}>
                <td className="px-3 py-2 font-medium sticky left-0 bg-white z-10">{d.analyte}</td>
                {(d.values || []).map((val, j) => (
                  <td key={j} className="px-3 py-2 whitespace-nowrap">
                    {fmt(val)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (comparison.diffs) {
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Indicador</th>
              <th className="px-3 py-2 text-left">Reporte A</th>
              <th className="px-3 py-2 text-left">Reporte B</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {comparison.diffs.map((d, i) => (
              <tr key={i}>
                <td className="px-3 py-2 font-medium">{d.analyte}</td>
                <td className="px-3 py-2">{fmt(d.reportA)}</td>
                <td className="px-3 py-2">{fmt(d.reportB)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (comparison.points) {
    return (
      <ul className="space-y-2 text-sm">
        {comparison.points.map((p) => (
          <li key={p.reportId} className="flex justify-between border-b border-gray-100 py-2">
            <span>{p.studyDate ? new Date(p.studyDate).toLocaleDateString('es-MX') : p.reportId}</span>
            <span className="font-medium">{fmt(p.result)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return null;
};

export default LabStudyComparator;
