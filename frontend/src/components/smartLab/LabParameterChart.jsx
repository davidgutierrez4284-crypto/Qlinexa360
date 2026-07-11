import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';

const LabParameterChart = ({ points = [], referenceLow, referenceHigh, unit, title }) => {
  const data = useMemo(
    () =>
      points.map((p, idx) => ({
        idx,
        label: p.studyDate ? new Date(p.studyDate).toLocaleDateString('es-MX') : p.reportId?.slice(0, 6) || String(idx + 1),
        value: p.result?.resultValue ?? (p.result?.resultValueText != null ? Number(p.result.resultValueText) : null),
      })).filter((d) => d.value != null && !Number.isNaN(d.value)),
    [points]
  );

  if (!data.length) {
    return <p className="text-sm text-gray-500">No hay datos numéricos para graficar.</p>;
  }

  const yMin = Math.min(...data.map((d) => d.value), referenceLow ?? Infinity);
  const yMax = Math.max(...data.map((d) => d.value), referenceHigh ?? -Infinity);
  const pad = (yMax - yMin) * 0.1 || 1;

  return (
    <div className="w-full h-72">
      {title ? <h4 className="text-sm font-semibold text-gray-800 mb-2">{title}{unit ? ` (${unit})` : ''}</h4> : null}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={[yMin - pad, yMax + pad]} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [v, unit || 'Valor']} />
          {referenceLow != null && referenceHigh != null ? (
            <ReferenceArea y1={referenceLow} y2={referenceHigh} fill="#bbf7d0" fillOpacity={0.35} />
          ) : null}
          <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LabParameterChart;
