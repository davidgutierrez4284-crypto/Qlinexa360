import React, { useState, useEffect } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const CASE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

/**
 * Gráficas de Dashboard para un paciente:
 * A) Casos clínicos por fecha (eje X = fecha de creación)
 * B) Frecuencia de citas por caso clínico (colores distintos por caso)
 *
 * @param {string} patientId - ID del paciente (para vista doctor). Si es null y isPatientView=true, usa datos del paciente autenticado.
 * @param {boolean} isPatientView - Si true, usa getMyClinicalCases y getMyConsultations (paciente autenticado).
 */
const PatientDashboardCharts = ({ patientId, isPatientView = false }) => {
  const [clinicalCases, setClinicalCases] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (isPatientView) {
          const [getMyClinicalCases, getMyConsultations] = await Promise.all([
            import('../../services/patientService').then(m => m.getMyClinicalCases),
            import('../../services/patientService').then(m => m.getMyConsultations)
          ]);
          const [casesData, consultationsData] = await Promise.all([
            getMyClinicalCases(),
            getMyConsultations()
          ]);
          setClinicalCases(Array.isArray(casesData) ? casesData : []);
          setConsultations(Array.isArray(consultationsData) ? consultationsData : []);
        } else if (patientId) {
          const [getPatientDetails, getMedicalRecords] = await Promise.all([
            import('../../services/doctorService').then(m => m.getPatientDetails),
            import('../../services/medicalService').then(m => m.getMedicalRecords)
          ]);
          const [patientData, recordsData] = await Promise.all([
            getPatientDetails(patientId),
            getMedicalRecords(patientId)
          ]);
          const cases = patientData?.clinicalCases || [];
          setClinicalCases(cases);
          setConsultations(Array.isArray(recordsData) ? recordsData : []);
        } else {
          setClinicalCases([]);
          setConsultations([]);
        }
      } catch (error) {
        console.error('Error cargando datos para gráficas:', error);
        setClinicalCases([]);
        setConsultations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patientId, isPatientView]);

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear().toString().slice(-2)}`;
  };

  // Gráfica A: Casos clínicos por fecha (eje X = fecha de creación)
  const chartAData = React.useMemo(() => {
    return clinicalCases
      .filter(c => c.createdAt)
      .map((c, idx) => ({
        x: new Date(c.createdAt).getTime(),
        y: idx,
        name: c.padecimiento || `Caso ${idx + 1}`,
        date: c.createdAt
      }))
      .sort((a, b) => a.x - b.x);
  }, [clinicalCases]);

  // Gráfica B: orden de carriles (mismo orden que leyenda / PROD: un renglón por caso, colores alineados)
  const caseIdToName = React.useMemo(() => {
    const map = {};
    clinicalCases.forEach((c) => {
      map[c.id] = c.padecimiento || 'Sin caso';
    });
    consultations.forEach((c) => {
      const id = c.clinicalCaseId ?? '__none__';
      if (map[id] == null) {
        map[id] = c.clinicalCase?.padecimiento || (id === '__none__' ? 'Sin caso' : 'Sin caso');
      }
    });
    return map;
  }, [clinicalCases, consultations]);

  const caseOrderIds = React.useMemo(() => {
    const ordered = [];
    const seen = new Set();
    clinicalCases.forEach((c) => {
      if (c.id && !seen.has(c.id)) {
        seen.add(c.id);
        ordered.push(c.id);
      }
    });
    consultations.forEach((c) => {
      const id = c.clinicalCaseId ?? '__none__';
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    });
    const withConsultation = new Set(
      consultations.filter((c) => c.date).map((c) => c.clinicalCaseId ?? '__none__')
    );
    return ordered.filter((id) => withConsultation.has(id));
  }, [clinicalCases, consultations]);

  const caseIdToColor = React.useMemo(() => {
    const map = {};
    caseOrderIds.forEach((id, i) => {
      map[id] = CASE_COLORS[i % CASE_COLORS.length];
    });
    return map;
  }, [caseOrderIds]);

  const chartBData = React.useMemo(() => {
    const idToRow = {};
    caseOrderIds.forEach((id, idx) => {
      idToRow[id] = idx;
    });
    return consultations
      .filter((c) => c.date)
      .map((c) => {
        const date = typeof c.date === 'string' ? new Date(c.date) : c.date;
        const key = c.clinicalCaseId ?? '__none__';
        const row = idToRow[key] ?? 0;
        const caseName = caseIdToName[key] || c.clinicalCase?.padecimiento || 'Sin caso';
        return {
          x: date.getTime(),
          y: row,
          caseName,
          caseId: c.clinicalCaseId,
          date: c.date,
          color: caseIdToColor[key] || '#6b7280'
        };
      })
      .sort((a, b) => a.x - b.x);
  }, [consultations, caseOrderIds, caseIdToName, caseIdToColor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const hasChartA = chartAData.length > 0;
  const hasChartB = chartBData.length > 0;
  const chartBRowCount = caseOrderIds.length;
  const chartBLongestName = caseOrderIds.reduce(
    (max, id) => Math.max(max, (caseIdToName[id] || '').length),
    0
  );
  const chartBYAxisWidth = Math.min(132, Math.max(52, chartBLongestName * 6.2));
  const chartBPlotHeight = Math.max(240, chartBRowCount * 50 + 80);

  if (!hasChartA && !hasChartB) {
    return (
      <div className="text-center p-8 text-gray-500">
        No hay datos de casos clínicos ni consultas para mostrar en las gráficas.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Gráfica A: Casos clínicos por fecha */}
      {hasChartA && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Casos clínicos por fecha de creación
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 16, right: 12, bottom: 40, left: 6 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                domain={['dataMin - 86400000', 'dataMax + 86400000']}
                tickFormatter={(v) => formatDateShort(new Date(v))}
                label={{ value: 'Fecha del caso clínico', position: 'insideBottom', offset: -8 }}
              />
              <YAxis type="number" dataKey="y" hide />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload?.[0]?.payload) {
                    const p = payload[0].payload;
                    return (
                      <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
                        <p className="font-semibold text-gray-900">{p.name}</p>
                        <p className="text-sm text-gray-600">
                          Fecha: {formatDateShort(p.date)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter name="Casos clínicos" data={chartAData} fill="#3b82f6">
                {chartAData.map((entry, i) => (
                  <Cell key={i} fill="#3b82f6" />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráfica B: Frecuencia de citas por caso clínico */}
      {hasChartB && (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Frecuencia de consultas por caso clínico
          </h3>
          <div className="mb-3 flex flex-wrap gap-2">
            {caseOrderIds.map((cid) => {
              const name = caseIdToName[cid] || 'Sin caso';
              const color = caseIdToColor[cid] || '#6b7280';
              return (
                <span
                  key={cid}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                  style={{ backgroundColor: `${color}20`, color: '#374151' }}
                >
                  <span className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  {name}
                </span>
              );
            })}
          </div>
          <ResponsiveContainer width="100%" height={chartBPlotHeight}>
            <ScatterChart margin={{ top: 8, right: 8, bottom: 40, left: 2 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                domain={['dataMin - 86400000', 'dataMax + 86400000']}
                tickFormatter={(v) => formatDateShort(new Date(v))}
                label={{ value: 'Fecha de consulta', position: 'insideBottom', offset: -8 }}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                reversed
                domain={
                  chartBRowCount > 0 ? [-0.5, chartBRowCount - 0.5] : [-0.5, 0.5]
                }
                ticks={
                  chartBRowCount > 0
                    ? caseOrderIds.map((_, i) => i)
                    : [0]
                }
                tickFormatter={(value) => caseIdToName[caseOrderIds[value]] || ''}
                width={chartBYAxisWidth}
                tick={{ fontSize: 11, dy: 3 }}
                interval={0}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload?.[0]?.payload) {
                    const p = payload[0].payload;
                    return (
                      <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
                        <p className="font-semibold text-gray-900">{p.caseName}</p>
                        <p className="text-sm text-gray-600">
                          Fecha: {formatDateShort(p.date)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter
                name="Consultas"
                data={chartBData}
                shape={(props) => {
                  const { cx, cy, fill } = props;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={7}
                      fill={fill}
                      stroke={fill}
                      strokeWidth={1.5}
                      opacity={0.95}
                    />
                  );
                }}
              >
                {chartBData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default PatientDashboardCharts;
