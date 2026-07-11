import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea
} from 'recharts';
import { getMedicalRecords } from '../../services/medicalService';
import { getFormTemplates, getPatientDetails } from '../../services/doctorService';
import { getMyConsultations, getMyProfile } from '../../services/patientService';
import { calculateAge, getPersonalizedNormalRange, getNormalRange } from '../../utils/normalRanges';
import { getAgeInYearsFromFieldValue } from '../../utils/ageUtils';
import {
  getWeightPercentiles,
  getHeightPercentiles,
  getBMIPercentiles,
  getPercentileForValue,
  getPercentileZoneColor
} from '../../utils/omsPercentiles';
import { toast } from 'react-toastify';

const OMS_MAX_AGE = 19;

function normalizeLabel(label) {
  return label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function findGrowthFieldIds(fieldIdToLabel) {
  let weightId;
  let heightId;
  let bmiId;
  Object.entries(fieldIdToLabel).forEach(([id, label]) => {
    if (!label || label === id) return;
    const n = normalizeLabel(label);
    if (n.includes('peso') && !n.includes('peso_ideal')) weightId = weightId || id;
    if ((n.includes('talla') || n.includes('altura')) && !n.includes('peso')) heightId = heightId || id;
    if (
      n.includes('imc') ||
      n.includes('indice_de_masa_corporal') ||
      n.includes('indice_de_masa') ||
      n === 'bmi'
    ) {
      bmiId = bmiId || id;
    }
  });
  return { weightId, heightId, bmiId };
}

function normalRangeForField(fieldId, fieldIdToLabel, patientInfo, consultations) {
  if (!fieldId || !patientInfo) return null;
  const label = fieldIdToLabel[fieldId];
  if (!label) return null;
  const nk = normalizeLabel(label);
  return getPersonalizedNormalRange(nk, patientInfo, null, consultations) || getNormalRange(nk);
}

function getConsultationDate(consultation) {
  let d = consultation.date || consultation.createdAt;
  if (d && typeof d === 'string') d = new Date(d);
  return d instanceof Date && !isNaN(d.getTime()) ? d : null;
}

function buildGrowthRows(consultations, fieldId, patientInfo, metricType) {
  if (!fieldId || !consultations?.length || !patientInfo) return [];

  const gender = patientInfo.biologicalSex || patientInfo.gender || '';

  return consultations
    .map((consultation) => {
      if (!consultation.formData || consultation.formData[fieldId] === undefined) return null;
      const value = parseFloat(consultation.formData[fieldId]);
      if (Number.isNaN(value)) return null;

      const consultationDate = getConsultationDate(consultation);
      if (!consultationDate) return null;

      let ageAtConsultation = null;
      if (patientInfo.dateOfBirth) {
        const birthDate = new Date(patientInfo.dateOfBirth);
        const ageInYears = (consultationDate - birthDate) / (1000 * 60 * 60 * 24 * 365.25);
        ageAtConsultation = Math.max(0, ageInYears);
      } else if (patientInfo.age != null) {
        ageAtConsultation = Math.max(0, patientInfo.age);
      }

      // Bandas P3–P97 OMS solo para menores de 19 años en la fecha de esa consulta
      let percentiles = null;
      if (ageAtConsultation != null && ageAtConsultation < OMS_MAX_AGE) {
        if (metricType === 'weight') percentiles = getWeightPercentiles(ageAtConsultation, gender);
        else if (metricType === 'height') percentiles = getHeightPercentiles(ageAtConsultation, gender);
        else percentiles = getBMIPercentiles(ageAtConsultation, gender);
      }

      const percentile =
        percentiles && ageAtConsultation != null ? getPercentileForValue(value, percentiles) : null;

      return {
        date: consultationDate,
        value,
        age: ageAtConsultation,
        percentile,
        isOutOfRange: false,
        p3: percentiles?.p3 ?? null,
        p10: percentiles?.p10 ?? null,
        p25: percentiles?.p25 ?? null,
        p50: percentiles?.p50 ?? null,
        p75: percentiles?.p75 ?? null,
        p90: percentiles?.p90 ?? null,
        p97: percentiles?.p97 ?? null
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function formatDateShort(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${d.getDate()}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

function AdultTrendLineChart({ title, unit, rows, normalRange }) {
  const vals = rows.map((r) => r.value);
  const minData = Math.min(...vals);
  const maxData = Math.max(...vals);
  let yMin = minData;
  let yMax = maxData;
  if (normalRange?.min != null && normalRange?.max != null) {
    yMin = Math.min(minData, normalRange.min);
    yMax = Math.max(maxData, normalRange.max);
  }
  const pad = (yMax - yMin) * 0.08 || Math.abs(yMin) * 0.05 || 1;
  yMin = Math.max(0, yMin - pad);
  yMax = yMax + pad;

  const hasRange =
    normalRange &&
    typeof normalRange.min === 'number' &&
    typeof normalRange.max === 'number' &&
    !Number.isNaN(normalRange.min) &&
    !Number.isNaN(normalRange.max);

  return (
    <div className="mb-8 pb-8 border-b border-gray-100 last:border-0 last:pb-0">
      <h4 className="text-md font-semibold text-gray-800 mb-1">{title}</h4>
      <p className="text-xs text-gray-500 mb-3">
        Evolución en consultas (adultos o edad ≥ {OMS_MAX_AGE} años en la fecha de medición). Las bandas P3–P97 OMS
        solo aplican a menores de {OMS_MAX_AGE} años. Unidad: {unit}.
        {hasRange && (
          <>
            {' '}
            Zona verde: rango orientativo según perfil (
            {normalRange.min}–{normalRange.max} {normalRange.unit || unit}).
          </>
        )}
      </p>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={rows} margin={{ top: 24, right: 24, bottom: 24, left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={(d) => formatDateShort(d)} />
          <YAxis domain={[yMin, yMax]} label={{ value: unit, angle: -90, position: 'insideLeft', style: { fontWeight: 'bold' } }} />
          <Tooltip
            labelFormatter={(d) => `Fecha: ${new Date(d).toLocaleDateString('es-ES')}`}
            formatter={(value) => [`${value} ${unit}`, 'Valor']}
          />
          <Legend />

          {hasRange && (
            <>
              {minData < normalRange.min && (
                <ReferenceArea
                  y1={yMin}
                  y2={normalRange.min}
                  stroke="none"
                  fill="#ef4444"
                  fillOpacity={0.18}
                />
              )}
              <ReferenceArea
                y1={normalRange.min}
                y2={normalRange.max}
                stroke="none"
                fill="#10b981"
                fillOpacity={0.22}
              />
              {maxData > normalRange.max && (
                <ReferenceArea
                  y1={normalRange.max}
                  y2={yMax}
                  stroke="none"
                  fill="#ef4444"
                  fillOpacity={0.18}
                />
              )}
            </>
          )}

          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#1d4ed8' }}
            activeDot={{ r: 7 }}
            name="Valor"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function OmsPercentileLineChart({ title, unit, rows, chartStyle, normalRange }) {
  if (!rows || rows.length === 0) return null;

  if (chartStyle === 'adult') {
    return <AdultTrendLineChart title={title} unit={unit} rows={rows} normalRange={normalRange} />;
  }

  const withBands = rows.filter((d) => d.p3 != null && d.p97 != null);
  if (withBands.length === 0) {
    return <AdultTrendLineChart title={title} unit={unit} rows={rows} normalRange={normalRange} />;
  }

  const percentileValues = withBands.flatMap((d) => [
    d.p3,
    d.p10,
    d.p25,
    d.p50,
    d.p75,
    d.p90,
    d.p97
  ]);
  const minPercentile = Math.min(...percentileValues);
  const maxPercentile = Math.max(...percentileValues);

  const avg = (key) => {
    const arr = withBands.filter((d) => d[key] != null);
    if (!arr.length) return null;
    return arr.reduce((s, d) => s + d[key], 0) / arr.length;
  };
  const avgP3 = avg('p3');
  const avgP10 = avg('p10');
  const avgP90 = avg('p90');
  const avgP97 = avg('p97');

  return (
    <div className="mb-8 pb-8 border-b border-gray-100 last:border-0 last:pb-0">
      <h4 className="text-md font-semibold text-gray-800 mb-1">{title}</h4>
      <p className="text-xs text-gray-500 mb-3">
        Curvas de referencia OMS (P3–P97) para mediciones con edad &lt; {OMS_MAX_AGE} años en esa fecha, más la línea
        del valor medido. Unidad: {unit}.
      </p>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={rows} margin={{ top: 24, right: 24, bottom: 24, left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={(d) => formatDateShort(d)} />
          <YAxis
            label={{
              value: unit,
              angle: -90,
              position: 'insideLeft',
              style: { fontWeight: 'bold' }
            }}
          />
          <Tooltip
            labelFormatter={(d) => `Fecha: ${new Date(d).toLocaleDateString('es-ES')}`}
            formatter={(value, name) => {
              if (name === 'Valor') return [`${value} ${unit}`, name];
              return [value, name];
            }}
          />
          <Legend />

          {avgP3 != null && avgP10 != null && avgP90 != null && avgP97 != null && (
            <>
              <ReferenceArea
                y1={minPercentile * 0.9}
                y2={avgP3}
                stroke="none"
                fill={getPercentileZoneColor('very-low')}
              />
              <ReferenceArea
                y1={avgP3}
                y2={avgP10}
                stroke="none"
                fill={getPercentileZoneColor('low')}
              />
              <ReferenceArea
                y1={avgP10}
                y2={avgP90}
                stroke="none"
                fill={getPercentileZoneColor('normal')}
              />
              <ReferenceArea
                y1={avgP90}
                y2={avgP97}
                stroke="none"
                fill={getPercentileZoneColor('high')}
              />
              <ReferenceArea
                y1={avgP97}
                y2={maxPercentile * 1.1}
                stroke="none"
                fill={getPercentileZoneColor('very-high')}
              />
            </>
          )}

          <Line
            type="monotone"
            dataKey="p3"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            strokeOpacity={0.7}
            dot={false}
            connectNulls
            name="P3"
          />
          <Line
            type="monotone"
            dataKey="p97"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            strokeOpacity={0.7}
            dot={false}
            connectNulls
            name="P97"
          />
          <Line
            type="monotone"
            dataKey="p10"
            stroke="#f59e0b"
            strokeWidth={1}
            strokeDasharray="3 3"
            strokeOpacity={0.6}
            dot={false}
            connectNulls
            name="P10"
          />
          <Line
            type="monotone"
            dataKey="p90"
            stroke="#f59e0b"
            strokeWidth={1}
            strokeDasharray="3 3"
            strokeOpacity={0.6}
            dot={false}
            connectNulls
            name="P90"
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="4 4"
            strokeOpacity={0.8}
            dot={false}
            connectNulls
            name="P50 (mediana)"
          />

          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#1d4ed8' }}
            activeDot={{ r: 7 }}
            name="Valor"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Bloque adicional del Dashboard: gráficas OMS (peso, talla, IMC) sin sustituir el selector manual de PatientHealthCharts.
 */
const PatientOmsDashboardCharts = ({ patientId, isPatientView = false }) => {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fieldIdToLabel, setFieldIdToLabel] = useState({});
  const [patientInfo, setPatientInfo] = useState(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const templates = await getFormTemplates();
        const idToLabel = {};
        templates.forEach((template) => {
          template.fields.forEach((field) => {
            idToLabel[field.id] = field.label;
          });
        });
        setFieldIdToLabel(idToLabel);
      } catch (e) {
        console.error('PatientOmsDashboardCharts: plantillas', e);
      }
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (isPatientView) {
          const records = await getMyConsultations();
          setConsultations(Array.isArray(records) ? records : []);
        } else if (patientId) {
          const records = await getMedicalRecords(patientId);
          setConsultations(Array.isArray(records) ? records : []);
        } else {
          setConsultations([]);
        }
      } catch (e) {
        console.error('PatientOmsDashboardCharts: consultas', e);
        toast.error('Error al cargar datos para gráficas OMS');
        setConsultations([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [patientId, isPatientView]);

  useEffect(() => {
    if ((!patientId && !isPatientView) || !Object.keys(fieldIdToLabel).length) return;

    const run = async () => {
      try {
        const patient = isPatientView ? await getMyProfile() : await getPatientDetails(patientId);
        let latestBiologicalSex = null;
        let latestAge = null;

        if (consultations.length > 0) {
          for (const consultation of [...consultations].reverse()) {
            if (!consultation.formData) continue;
            Object.keys(consultation.formData).forEach((key) => {
              const label = fieldIdToLabel[key];
              if (!label) return;
              const labelLower = label.toLowerCase();
              if (
                (labelLower.includes('sexo') && labelLower.includes('biológico')) ||
                labelLower.includes('sexo_biologico')
              ) {
                if (!latestBiologicalSex && consultation.formData[key]) {
                  latestBiologicalSex = consultation.formData[key];
                }
              }
              if (labelLower.includes('edad')) {
                const years = getAgeInYearsFromFieldValue(consultation.formData[key]);
                if (years != null && latestAge == null) latestAge = years;
              }
            });
          }
        }

        setPatientInfo({
          dateOfBirth: patient?.dateOfBirth ?? null,
          gender: patient?.gender ?? null,
          biologicalSex: latestBiologicalSex || patient?.gender || null,
          age: latestAge
        });
      } catch (e) {
        console.error('PatientOmsDashboardCharts: paciente', e);
        setPatientInfo({
          dateOfBirth: null,
          gender: null,
          biologicalSex: null,
          age: null
        });
      }
    };
    run();
  }, [patientId, isPatientView, consultations, fieldIdToLabel]);

  const omsFieldIds = useMemo(() => findGrowthFieldIds(fieldIdToLabel), [fieldIdToLabel]);

  const ageYears = useMemo(() => {
    if (patientInfo?.dateOfBirth) return calculateAge(patientInfo.dateOfBirth);
    if (patientInfo?.age != null) return patientInfo.age;
    return null;
  }, [patientInfo]);

  const chartStyle = useMemo(
    () => (ageYears !== null && ageYears < OMS_MAX_AGE ? 'oms' : 'adult'),
    [ageYears]
  );

  const weightRows = useMemo(
    () =>
      patientInfo ? buildGrowthRows(consultations, omsFieldIds.weightId, patientInfo, 'weight') : [],
    [consultations, omsFieldIds.weightId, patientInfo]
  );
  const heightRows = useMemo(
    () =>
      patientInfo ? buildGrowthRows(consultations, omsFieldIds.heightId, patientInfo, 'height') : [],
    [consultations, omsFieldIds.heightId, patientInfo]
  );
  const bmiRows = useMemo(
    () =>
      patientInfo ? buildGrowthRows(consultations, omsFieldIds.bmiId, patientInfo, 'bmi') : [],
    [consultations, omsFieldIds.bmiId, patientInfo]
  );

  const rangeWeight = useMemo(
    () => normalRangeForField(omsFieldIds.weightId, fieldIdToLabel, patientInfo, consultations),
    [omsFieldIds.weightId, fieldIdToLabel, patientInfo, consultations]
  );
  const rangeHeight = useMemo(
    () => normalRangeForField(omsFieldIds.heightId, fieldIdToLabel, patientInfo, consultations),
    [omsFieldIds.heightId, fieldIdToLabel, patientInfo, consultations]
  );
  const rangeBmi = useMemo(
    () => normalRangeForField(omsFieldIds.bmiId, fieldIdToLabel, patientInfo, consultations),
    [omsFieldIds.bmiId, fieldIdToLabel, patientInfo, consultations]
  );

  const hasAnyGrowthField =
    omsFieldIds.weightId || omsFieldIds.heightId || omsFieldIds.bmiId;
  const hasAnyData = weightRows.length > 0 || heightRows.length > 0 || bmiRows.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!hasAnyGrowthField) {
    return (
      <p className="text-sm text-gray-500 text-center py-6">
        No hay campos de peso, talla o IMC reconocidos en las plantillas para mostrar referencias OMS.
      </p>
    );
  }

  if (!hasAnyData) {
    return (
      <p className="text-sm text-gray-500 text-center py-6">
        Aún no hay mediciones de peso, talla o IMC en el historial para graficar.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-4">
        {chartStyle === 'oms' ? (
          <>
            Menores de {OMS_MAX_AGE} años: bandas y curvas percentil OMS (referencia aproximada). En puntos con edad ≥
            {OMS_MAX_AGE} en la fecha de la consulta se muestra la tendencia sin bandas pediátricas.
          </>
        ) : (
          <>
            Adultos: evolución del peso, talla e IMC en el tiempo; zona verde cuando hay rango orientativo según perfil
            (OMS / criterios generales). Las curvas P3–P97 OMS son solo para menores de {OMS_MAX_AGE} años.
          </>
        )}{' '}
        Criterio clínico del profesional prevalece.
      </p>
      <OmsPercentileLineChart
        title="Peso"
        unit="kg"
        rows={weightRows}
        chartStyle={chartStyle}
        normalRange={rangeWeight}
      />
      <OmsPercentileLineChart
        title="Talla / altura"
        unit="cm"
        rows={heightRows}
        chartStyle={chartStyle}
        normalRange={rangeHeight}
      />
      <OmsPercentileLineChart
        title="IMC"
        unit="kg/m²"
        rows={bmiRows}
        chartStyle={chartStyle}
        normalRange={rangeBmi}
      />

      <p
        className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-600 leading-relaxed"
        role="note"
      >
        <span className="font-semibold text-gray-700">Nota al pie: </span>
        Los rangos y curvas mostrados tienen carácter meramente referencial. Es fundamental que el profesional de la
        salud realice la valoración clínica pertinente considerando el historial y el contexto personalizado de cada
        paciente. La gráfica refleja un rango general basado en parámetros de referencia de la OMS (u orientativos
        asociados) y no sustituye el juicio clínico individualizado.
      </p>
    </div>
  );
};

export default PatientOmsDashboardCharts;
