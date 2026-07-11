import React, { useEffect, useState } from 'react';
import LabTrafficLight from './LabTrafficLight';

const REVIEW_THRESHOLD = Number(import.meta.env.VITE_SMART_LAB_REVIEW_THRESHOLD ?? 0.9);

const flagLabel = (flag) => {
  const map = {
    normal: 'Normal',
    low: 'Bajo',
    high: 'Alto',
    critical_low: 'Crítico bajo',
    critical_high: 'Crítico alto',
    unknown: 'Sin referencia',
  };
  return map[flag] || flag || '—';
};

const parseValidationErrors = (row) => {
  if (Array.isArray(row.validationErrorsJson)) return row.validationErrorsJson;
  return [];
};

const isRowDoubtful = (row) => {
  const conf = typeof row.extractionConfidence === 'number' ? row.extractionConfidence : 1;
  return conf < REVIEW_THRESHOLD || parseValidationErrors(row).length > 0;
};

const LabReviewTable = ({ results = [], editable = false, onChange, reviewThreshold = REVIEW_THRESHOLD }) => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    setRows(results.map((r) => ({ ...r })));
  }, [results]);

  const updateRow = (id, field, value) => {
    setRows((prev) => {
      const next = prev.map((row) => (row.id === id ? { ...row, [field]: value } : row));
      onChange?.(next);
      return next;
    });
  };

  if (!rows.length) {
    return <p className="text-sm text-gray-500">No hay resultados extraídos.</p>;
  }

  const threshold = reviewThreshold ?? REVIEW_THRESHOLD;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Indicador</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Valor</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Unidad</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Ref. baja</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Ref. alta</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Confianza</th>
            <th className="px-3 py-2 text-left font-medium text-gray-700">Bandera</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((row) => {
            const doubtful = isRowDoubtful(row);
            const errors = parseValidationErrors(row);
            const conf = typeof row.extractionConfidence === 'number' ? Math.round(row.extractionConfidence * 100) : null;
            return (
              <tr key={row.id} className={doubtful ? 'bg-amber-50/70' : undefined}>
                <td className="px-3 py-2">
                  {editable ? (
                    <input
                      className="w-full rounded border-gray-300 text-sm"
                      value={row.analyteNameNormalized || row.analyteNameRaw || ''}
                      onChange={(e) => updateRow(row.id, 'analyteNameNormalized', e.target.value)}
                    />
                  ) : (
                    <div>
                      <div>{row.analyteNameNormalized || row.analyteNameRaw}</div>
                      {errors.length > 0 ? (
                        <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                          {errors.map((err) => (
                            <li key={err}>{err}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <input
                      className="w-24 rounded border-gray-300 text-sm"
                      value={row.resultValueText ?? row.resultValue ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === '' ? null : Number(v);
                        updateRow(row.id, 'resultValueText', v);
                        if (!Number.isNaN(num)) updateRow(row.id, 'resultValue', num);
                      }}
                    />
                  ) : (
                    row.resultValueText ?? row.resultValue ?? '—'
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <input
                      className="w-20 rounded border-gray-300 text-sm"
                      value={row.resultUnit || ''}
                      onChange={(e) => updateRow(row.id, 'resultUnit', e.target.value)}
                    />
                  ) : (
                    row.resultUnit || '—'
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <input
                      type="number"
                      className="w-20 rounded border-gray-300 text-sm"
                      value={row.referenceRangeLow ?? ''}
                      onChange={(e) => updateRow(row.id, 'referenceRangeLow', e.target.value === '' ? null : Number(e.target.value))}
                    />
                  ) : (
                    row.referenceRangeLow ?? '—'
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <input
                      type="number"
                      className="w-20 rounded border-gray-300 text-sm"
                      value={row.referenceRangeHigh ?? ''}
                      onChange={(e) => updateRow(row.id, 'referenceRangeHigh', e.target.value === '' ? null : Number(e.target.value))}
                    />
                  ) : (
                    row.referenceRangeHigh ?? '—'
                  )}
                </td>
                <td className="px-3 py-2">
                  {conf != null ? (
                    <span className={conf < threshold * 100 ? 'text-amber-700 font-medium' : 'text-gray-700'}>
                      {conf}%
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2">
                  <LabTrafficLight
                    status={['low', 'high'].includes(row.abnormalFlag) ? 'yellow' : ['critical_low', 'critical_high'].includes(row.abnormalFlag) ? 'red' : row.abnormalFlag === 'normal' ? 'green' : 'gray'}
                    label={flagLabel(row.abnormalFlag)}
                    size="sm"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LabReviewTable;

export function mapRowsToCorrections(rows) {
  return rows.map((r) => ({
    id: r.id,
    resultValue: r.resultValue,
    resultValueText: r.resultValueText != null ? String(r.resultValueText) : null,
    resultUnit: r.resultUnit,
    referenceRangeLow: r.referenceRangeLow,
    referenceRangeHigh: r.referenceRangeHigh,
    analyteCatalogId: r.analyteCatalogId,
    analyteNameNormalized: r.analyteNameNormalized,
  }));
}

export function hasDoubtfulRows(rows, threshold = REVIEW_THRESHOLD) {
  return rows.some((row) => {
    const conf = typeof row.extractionConfidence === 'number' ? row.extractionConfidence : 1;
    return conf < threshold || parseValidationErrors(row).length > 0;
  });
}
