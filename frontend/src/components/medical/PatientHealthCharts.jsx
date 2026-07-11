import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell
} from 'recharts';
import { getMedicalRecords } from '../../services/medicalService';
import { getFormTemplates, getPatientDetails } from '../../services/doctorService';
import { getMyConsultations, getMyProfile } from '../../services/patientService';
import { getNormalRange, getAlertColor, getPersonalizedNormalRange, calculateAge } from '../../utils/normalRanges';
import { calculateAge as formatAgeDisplay, getAgeInYearsFromFieldValue, formatAgeFieldValue } from '../../utils/ageUtils';
import { getWeightPercentiles, getHeightPercentiles, getBMIPercentiles, getPercentileForValue, getPercentileZoneColor } from '../../utils/omsPercentiles';
import { toast } from 'react-toastify';

function isAgeLikeField(fieldIdToLabel, fieldId) {
  const label = fieldIdToLabel[fieldId];
  if (!label) return false;
  const n = label
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '');
  return n.includes('edad');
}

const MULTI_LINE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

const PatientHealthCharts = ({ patientId, isPatientView = false }) => {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedParameters, setSelectedParameters] = useState([]);
  const [alertData, setAlertData] = useState([]);
  const [fieldIdToLabel, setFieldIdToLabel] = useState({});
  const [patientInfo, setPatientInfo] = useState(null); // Información del paciente para rangos personalizados
  const [formTemplates, setFormTemplates] = useState([]); // Plantillas de formulario

  // Detectar si hay un template de "Esquema de vacunación"
  const isVaccinationTemplate = React.useMemo(() => {
    return formTemplates.some(template => 
      template.name === 'Esquema de vacunación' || template.specialty === 'VACUNACION'
    );
  }, [formTemplates]);

  // Detectar si el parámetro seleccionado es "Esquema de vacunación"
  const isVaccinationSchedule = selectedParameters.includes('VACCINATION_SCHEDULE');

  // Cargar plantillas de formulario para mapear IDs a labels
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const templates = await getFormTemplates();
        const idToLabel = {};

        templates.forEach(template => {
          template.fields.forEach(field => {
            idToLabel[field.id] = field.label;
          });
        });

        setFieldIdToLabel(idToLabel);
        setFormTemplates(templates);
      } catch (error) {
        console.error('Error cargando plantillas:', error);
      }
    };

    fetchTemplates();
  }, []);

  // Cargar información del paciente para rangos personalizados
  // Debe ejecutarse después de cargar consultas y templates
  useEffect(() => {
    if ((!patientId && !isPatientView) || !fieldIdToLabel || Object.keys(fieldIdToLabel).length === 0) return;
    
    const fetchPatientInfo = async () => {
      try {
        const patient = isPatientView
          ? await getMyProfile()
          : await getPatientDetails(patientId);
        // Buscar la altura, peso, sexo biológico, edad y embarazo más recientes en las consultas
        let latestHeight = null;
        let latestWeight = null;
        let latestBiologicalSex = null;
        let latestAge = null;
        let latestIsPregnant = false;
        
        if (consultations.length > 0) {
          // Buscar en orden inverso (más reciente primero)
          for (const consultation of [...consultations].reverse()) {
            if (consultation.formData) {
              // Buscar campos de altura/talla
              Object.keys(consultation.formData).forEach(key => {
                const label = fieldIdToLabel[key];
                if (label && (label.toLowerCase().includes('talla') || label.toLowerCase().includes('altura'))) {
                  const value = parseFloat(consultation.formData[key]);
                  if (!isNaN(value) && !latestHeight) {
                    latestHeight = value;
                  }
                }
                // Buscar campos de peso
                if (label && label.toLowerCase().includes('peso') && !label.toLowerCase().includes('peso_ideal')) {
                  const value = parseFloat(consultation.formData[key]);
                  if (!isNaN(value) && !latestWeight) {
                    latestWeight = value;
                  }
                }
                // Buscar sexo biológico
                const labelLower = label.toLowerCase();
                if (label && ((labelLower.includes('sexo') && labelLower.includes('biológico')) || labelLower.includes('sexo_biologico'))) {
                  if (!latestBiologicalSex && consultation.formData[key]) {
                    latestBiologicalSex = consultation.formData[key];
                  }
                }
                // Buscar edad (convertir a años para percentiles y gráficas)
                if (label && label.toLowerCase().includes('edad')) {
                  const years = getAgeInYearsFromFieldValue(consultation.formData[key]);
                  if (years != null && latestAge == null) {
                    latestAge = years;
                  }
                }
                // Buscar embarazo
                if (label && label.toLowerCase().includes('embarazo')) {
                  const value = String(consultation.formData[key]).toLowerCase();
                  if (!latestIsPregnant && (value.includes('sí') || value.includes('si') || value === 'yes' || value === 'true')) {
                    latestIsPregnant = true;
                  }
                }
              });
            }
          }
        }
        
        setPatientInfo({
          dateOfBirth: patient?.dateOfBirth ?? null,
          gender: patient?.gender ?? null,
          biologicalSex: latestBiologicalSex || patient?.gender || null,
          height: latestHeight,
          weight: latestWeight,
          age: latestAge,
          isPregnant: latestIsPregnant
        });
      } catch (error) {
        console.error('Error cargando información del paciente:', error);
        // Continuar sin información personalizada
        setPatientInfo({
          dateOfBirth: null,
          gender: null,
          biologicalSex: null,
          height: null,
          weight: null,
          age: null,
          isPregnant: false
        });
      }
    };

    fetchPatientInfo();
  }, [patientId, isPatientView, consultations, fieldIdToLabel]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (isPatientView) {
          const records = await getMyConsultations();
          setConsultations(Array.isArray(records) ? records : []);
        } else if (patientId) {
          const records = await getMedicalRecords(patientId);
          setConsultations(records);
        } else {
          setConsultations([]);
        }
      } catch (error) {
        console.error('Error cargando consultas:', error);
        toast.error('Error al cargar datos del paciente');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patientId, isPatientView]);

  // Función para obtener la fecha de aplicación de una vacuna
  // Para vacunas, busca el campo de fecha correspondiente en el formData
  const getVaccinationDate = React.useCallback((fieldId, consultation) => {
    if (!fieldId || !consultation || !consultation.formData || !fieldIdToLabel || Object.keys(fieldIdToLabel).length === 0) return null;
    
    const label = fieldIdToLabel[fieldId];
    if (!label) return null;
    
    const labelLower = label.toLowerCase();
    
    // Caso 1: Si el campo seleccionado es directamente un campo de fecha de vacuna
    // (por ejemplo, "Fecha BCG", "Fecha Hepatitis B (1ra dosis)")
    if (labelLower.startsWith('fecha')) {
      // Verificar si es una fecha de vacuna (contiene palabras clave de vacunas)
      const isVaccinationDateField = (
        labelLower.includes('bcg') ||
        labelLower.includes('hepatitis') ||
        labelLower.includes('pentavalente') ||
        labelLower.includes('rotavirus') ||
        labelLower.includes('neumococo') ||
        labelLower.includes('influenza') ||
        labelLower.includes('gripe') ||
        labelLower.includes('srp') ||
        labelLower.includes('sarampión') ||
        labelLower.includes('rubeola') ||
        labelLower.includes('paperas') ||
        labelLower.includes('varicela') ||
        labelLower.includes('vph') ||
        labelLower.includes('papiloma') ||
        labelLower.includes('tdap') ||
        labelLower.includes('tétanos') ||
        labelLower.includes('covid') ||
        labelLower.includes('vacuna')
      );
      
      if (isVaccinationDateField) {
        // El campo seleccionado es directamente la fecha, usar su valor
        const dateValue = consultation.formData[fieldId];
        if (dateValue) {
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      return null;
    }
    
    // Caso 2: Si el campo seleccionado es un checkbox de vacuna
    // (por ejemplo, "BCG", "Hepatitis B (1ra dosis)")
    const isVaccinationField = (
      labelLower.includes('bcg') ||
      labelLower.includes('hepatitis') ||
      labelLower.includes('pentavalente') ||
      labelLower.includes('rotavirus') ||
      labelLower.includes('neumococo') ||
      labelLower.includes('influenza') ||
      labelLower.includes('gripe') ||
      labelLower.includes('srp') ||
      labelLower.includes('sarampión') ||
      labelLower.includes('rubeola') ||
      labelLower.includes('paperas') ||
      labelLower.includes('varicela') ||
      labelLower.includes('vph') ||
      labelLower.includes('papiloma') ||
      labelLower.includes('tdap') ||
      labelLower.includes('tétanos') ||
      labelLower.includes('covid') ||
      labelLower.includes('vacuna')
    );
    
    if (!isVaccinationField) return null;
    
    // Buscar el campo de fecha correspondiente
    // El patrón es: "Fecha " + nombre de la vacuna
    const dateFieldLabel = `Fecha ${label}`;
    
    // Buscar en todos los campos del formData
    let dateFieldId = null;
    Object.keys(fieldIdToLabel).forEach(key => {
      if (fieldIdToLabel[key] === dateFieldLabel) {
        dateFieldId = key;
      }
    });
    
    // Si no se encuentra con el patrón exacto, intentar buscar con variaciones
    if (!dateFieldId) {
      // Buscar campos que empiecen con "Fecha" y contengan palabras clave de la vacuna
      const vaccineKeywords = labelLower
        .replace(/\([^)]*\)/g, '') // Remover paréntesis y su contenido
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(word => word.length > 2); // Filtrar palabras muy cortas
      
      Object.keys(fieldIdToLabel).forEach(key => {
        const fieldLabel = fieldIdToLabel[key].toLowerCase();
        if (fieldLabel.startsWith('fecha') && 
            vaccineKeywords.some(keyword => fieldLabel.includes(keyword.toLowerCase()))) {
          dateFieldId = key;
        }
      });
    }
    
    // Si se encuentra el campo de fecha, obtener su valor
    if (dateFieldId && consultation.formData[dateFieldId]) {
      const dateValue = consultation.formData[dateFieldId];
      if (dateValue) {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    return null;
  }, [fieldIdToLabel]);

  // Función para obtener la fecha a usar en el gráfico
  // Para vacunas, usa la fecha de aplicación; para otros campos, usa la fecha de consulta
  const getChartDate = React.useCallback((fieldId, consultation) => {
    // Intentar obtener la fecha de aplicación de la vacuna
    const vaccinationDate = getVaccinationDate(fieldId, consultation);
    if (vaccinationDate) {
      return vaccinationDate;
    }
    
    // Para campos que no son vacunas, usar la fecha de consulta
    let consultationDate = consultation.date || consultation.createdAt;
    if (consultationDate && typeof consultationDate === 'string') {
      consultationDate = new Date(consultationDate);
    }
    return consultationDate;
  }, [getVaccinationDate]);

  // Determinar alertas fuera de rango (todos los parámetros numéricos seleccionados)
  useEffect(() => {
    const numericSelected = selectedParameters.filter((id) => id !== 'VACCINATION_SCHEDULE');
    if (numericSelected.length === 0) {
      setAlertData([]);
      return;
    }

    const alerts = [];
    numericSelected.forEach((fieldId) => {
      if (isAgeLikeField(fieldIdToLabel, fieldId)) return;

      const batch = consultations
        .filter((consultation) => {
          if (!consultation.formData || !consultation.formData[fieldId]) return false;
          const value = parseFloat(consultation.formData[fieldId]);
          if (isNaN(value)) return false;
          const label = fieldIdToLabel[fieldId];
          if (!label) return false;
          const normalizedLabel = label
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '')
            .replace(/\(/g, '')
            .replace(/\)/g, '');
          const personalizedRange = patientInfo
            ? getPersonalizedNormalRange(normalizedLabel, patientInfo, consultation.formData)
            : null;
          const range = personalizedRange || getNormalRange(normalizedLabel);
          if (!range || isNaN(value)) return false;
          return value < range.min || value > range.max;
        })
        .map((consultation) => {
          const value = parseFloat(consultation.formData[fieldId]);
          const label = fieldIdToLabel[fieldId];
          const normalizedLabel = label
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '')
            .replace(/\(/g, '')
            .replace(/\)/g, '');
          const personalizedRange = patientInfo
            ? getPersonalizedNormalRange(normalizedLabel, patientInfo, consultation.formData)
            : null;
          const range = personalizedRange || getNormalRange(normalizedLabel);
          let alertLevel = 0;
          if (range && !isNaN(value)) {
            const isOutOfRangeValue = value < range.min || value > range.max;
            if (isOutOfRangeValue) {
              const mean = (range.min + range.max) / 2;
              if (mean !== 0) {
                const deviation = Math.abs(value - mean) / mean;
                alertLevel = deviation > 0.3 ? 2 : 1;
              } else {
                alertLevel = 1;
              }
            }
          }
          const chartDate = getChartDate(fieldId, consultation);
          let alertDate = chartDate;
          if (alertDate && typeof alertDate === 'string') {
            alertDate = new Date(alertDate);
          }
          return {
            date: alertDate,
            value,
            alertLevel,
            consultationId: consultation.id,
            fieldId
          };
        });
      alerts.push(...batch);
    });

    setAlertData(alerts);
  }, [consultations, selectedParameters, fieldIdToLabel, patientInfo, getChartDate]);

  // Lista de parámetros disponibles basados en los datos (calculado dentro de un useMemo)
  // Solo incluir parámetros que tengan un label válido (no UUID)
  const availableParameters = React.useMemo(() => {
    const params = [];
    
    // Si hay un template de vacunación, agregar "Esquema de vacunación" como primera opción
    if (isVaccinationTemplate) {
      params.push('VACCINATION_SCHEDULE');
    }
    
    consultations.forEach(consultation => {
      if (consultation.formData) {
        Object.keys(consultation.formData).forEach(key => {
          // Verificar que el valor sea numérico
          if (!isNaN(parseFloat(consultation.formData[key]))) {
            // Verificar que tenga un label válido (no es solo UUID)
            const label = fieldIdToLabel[key];
            // Solo incluir si tiene label y el label no es igual al UUID
            if (label && label !== key && !params.includes(key)) {
              params.push(key);
            }
          }
        });
      }
    });
    return params;
  }, [consultations, fieldIdToLabel, isVaccinationTemplate]);

  useEffect(() => {
    if (availableParameters.length === 0) return;
    setSelectedParameters((prev) => {
      const kept = prev.filter((id) => availableParameters.includes(id));
      if (kept.length > 0) return kept;
      return [availableParameters[0]];
    });
  }, [availableParameters]);

  // Obtener el nombre legible del parámetro
  const getParameterName = (fieldId) => {
    return fieldIdToLabel[fieldId] || fieldId;
  };

  // Obtener la unidad de medida para un parámetro (siempre devuelve una unidad)
  const getParameterUnit = (fieldId) => {
    if (!fieldId) return '';
    
    const label = fieldIdToLabel[fieldId];
    if (!label) return '';
    
    const normalizedLabel = label.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/\(/g, '')
      .replace(/\)/g, '');
    
    // Buscar en normalRanges primero
    const range = getNormalRange(normalizedLabel);
    if (range && range.unit) {
      return range.unit;
    }
    
    // Si no se encuentra en normalRanges, usar mapeo directo basado en palabras clave
    if (normalizedLabel.includes('talla') || normalizedLabel.includes('altura') || normalizedLabel.includes('height')) {
      return 'cm';
    }
    if (normalizedLabel.includes('peso') || normalizedLabel.includes('weight')) {
      return 'kg';
    }
    if (normalizedLabel.includes('imc') || normalizedLabel.includes('indice_de_masa_corporal') || normalizedLabel.includes('bmi')) {
      return 'kg/m²';
    }
    if (normalizedLabel.includes('presion') || normalizedLabel.includes('pressure')) {
      if (normalizedLabel.includes('sistolica') || normalizedLabel.includes('systolic')) {
        return 'mmHg';
      }
      if (normalizedLabel.includes('diastolica') || normalizedLabel.includes('diastolic')) {
        return 'mmHg';
      }
      return 'mmHg';
    }
    if (normalizedLabel.includes('frecuencia_cardiaca') || normalizedLabel.includes('heart_rate') || normalizedLabel.includes('pulso')) {
      return 'lpm';
    }
    if (normalizedLabel.includes('frecuencia_respiratoria') || normalizedLabel.includes('respiratory_rate')) {
      return 'rpm';
    }
    if (normalizedLabel.includes('temperatura') || normalizedLabel.includes('temperature')) {
      return '°C';
    }
    if (normalizedLabel.includes('saturacion') || normalizedLabel.includes('saturation') || normalizedLabel.includes('spo2')) {
      return '%';
    }
    if (normalizedLabel.includes('circunferencia') || normalizedLabel.includes('perimetro') || normalizedLabel.includes('circumference') || normalizedLabel.includes('perimeter')) {
      return 'cm';
    }
    if (normalizedLabel.includes('glucosa') || normalizedLabel.includes('glucose') || normalizedLabel.includes('glicemia')) {
      return 'mg/dL';
    }
    if (normalizedLabel.includes('colesterol') || normalizedLabel.includes('cholesterol')) {
      return 'mg/dL';
    }
    if (normalizedLabel.includes('trigliceridos') || normalizedLabel.includes('triglycerides')) {
      return 'mg/dL';
    }
    if (normalizedLabel.includes('hemoglobina') || normalizedLabel.includes('hemoglobin') || normalizedLabel.includes('hb')) {
      return 'g/dL';
    }
    if (normalizedLabel.includes('hematocrito') || normalizedLabel.includes('hematocrit') || normalizedLabel.includes('hct')) {
      return '%';
    }
    if (normalizedLabel.includes('edad')) {
      if (
        normalizedLabel.includes('mes') ||
        normalizedLabel.includes('años_y_meses') ||
        normalizedLabel.includes('anos_y_meses')
      ) {
        return 'años y meses';
      }
      if (normalizedLabel.includes('año') && !normalizedLabel.includes('mes')) {
        return 'años';
      }
      return 'años y meses';
    }

    // Si no se encuentra ninguna coincidencia, retornar string vacío
    return '';
  };

  // Obtener rango normal basado en el label normalizado (con personalización)
  const getNormalRangeForField = React.useCallback(
    (fieldId) => {
      if (!fieldId) return null;
      const label = fieldIdToLabel[fieldId];
      if (!label) return null;

      const normalizedLabel = label
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/\(/g, '')
        .replace(/\)/g, '');

      const personalizedRange = getPersonalizedNormalRange(
        normalizedLabel,
        patientInfo,
        null,
        consultations
      );

      if (personalizedRange) return personalizedRange;

      if (
        normalizedLabel.includes('peso') ||
        normalizedLabel === 'peso' ||
        normalizedLabel.includes('talla') ||
        normalizedLabel.includes('altura')
      ) {
        return null;
      }

      return getNormalRange(normalizedLabel);
    },
    [fieldIdToLabel, patientInfo, consultations]
  );

  const shouldShowPercentilesForField = React.useCallback(
    (fieldId) => {
      if (!fieldId || !patientInfo) return false;
      const label = fieldIdToLabel[fieldId];
      if (!label) return false;
      const normalizedLabel = label
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      const isWeight = normalizedLabel.includes('peso') && !normalizedLabel.includes('peso_ideal');
      const isHeight = normalizedLabel.includes('talla') || normalizedLabel.includes('altura');
      const isBMI =
        normalizedLabel.includes('imc') || normalizedLabel.includes('indice_de_masa_corporal');
      if (!isWeight && !isHeight && !isBMI) return false;
      let age = null;
      if (patientInfo.dateOfBirth) age = calculateAge(patientInfo.dateOfBirth);
      else if (patientInfo.age != null) age = patientInfo.age;
      return age !== null && age !== undefined && age < 19;
    },
    [patientInfo, fieldIdToLabel]
  );

  const chartBundleByField = React.useMemo(() => {
    const bundles = {};
    selectedParameters.forEach((fieldId) => {
      if (fieldId === 'VACCINATION_SCHEDULE') return;
      const normalRange = getNormalRangeForField(fieldId);
      const showP = shouldShowPercentilesForField(fieldId);

      const chartData = consultations
        .filter((consultation) => consultation.formData && consultation.formData[fieldId])
        .map((consultation) => {
          const value = parseFloat(consultation.formData[fieldId]);
          if (isNaN(value)) return null;
          const chartDate = getChartDate(fieldId, consultation);
          let consultationDate = chartDate;
          if (consultationDate && typeof consultationDate === 'string') {
            consultationDate = new Date(consultationDate);
          }
          let ageAtConsultation = null;
          if (patientInfo && patientInfo.dateOfBirth) {
            const birthDate = new Date(patientInfo.dateOfBirth);
            const consultationDateObj = new Date(consultationDate);
            const ageInYears =
              (consultationDateObj - birthDate) / (1000 * 60 * 60 * 24 * 365.25);
            ageAtConsultation = Math.max(0, Math.min(ageInYears, 19));
          } else if (patientInfo && patientInfo.age) {
            ageAtConsultation = patientInfo.age;
          }
          const label = fieldIdToLabel[fieldId];
          if (!label) return null;
          const normalizedLabel = label
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
          const ageField = isAgeLikeField(fieldIdToLabel, fieldId);
          const isOut =
            !ageField &&
            normalRange &&
            (value < normalRange.min || value > normalRange.max);
          let percentile = null;
          if (showP && ageAtConsultation !== null && patientInfo) {
            const gender = patientInfo.biologicalSex || patientInfo.gender || '';
            let percentiles = null;
            if (normalizedLabel.includes('peso') && !normalizedLabel.includes('peso_ideal')) {
              percentiles = getWeightPercentiles(ageAtConsultation, gender);
            } else if (normalizedLabel.includes('talla') || normalizedLabel.includes('altura')) {
              percentiles = getHeightPercentiles(ageAtConsultation, gender);
            } else if (
              normalizedLabel.includes('imc') ||
              normalizedLabel.includes('indice_de_masa_corporal')
            ) {
              percentiles = getBMIPercentiles(ageAtConsultation, gender);
            }
            if (percentiles) percentile = getPercentileForValue(value, percentiles);
          }
          return {
            date: consultationDate,
            value,
            consultationId: consultation.id,
            isOutOfRange: isOut || false,
            age: ageAtConsultation,
            percentile
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      let chartDataWithPercentiles = [];
      if (showP && chartData.length > 0) {
        const label = fieldIdToLabel[fieldId];
        const normalizedLabel = label
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');
        const gender = patientInfo?.biologicalSex || patientInfo?.gender || '';
        chartDataWithPercentiles = chartData.map((dataPoint) => {
          if (dataPoint.age === null) {
            return {
              ...dataPoint,
              p3: null,
              p10: null,
              p25: null,
              p50: null,
              p75: null,
              p90: null,
              p97: null
            };
          }
          let percentiles = null;
          if (normalizedLabel.includes('peso') && !normalizedLabel.includes('peso_ideal')) {
            percentiles = getWeightPercentiles(dataPoint.age, gender);
          } else if (normalizedLabel.includes('talla') || normalizedLabel.includes('altura')) {
            percentiles = getHeightPercentiles(dataPoint.age, gender);
          } else if (
            normalizedLabel.includes('imc') ||
            normalizedLabel.includes('indice_de_masa_corporal')
          ) {
            percentiles = getBMIPercentiles(dataPoint.age, gender);
          }
          return {
            ...dataPoint,
            p3: percentiles?.p3 ?? null,
            p10: percentiles?.p10 ?? null,
            p25: percentiles?.p25 ?? null,
            p50: percentiles?.p50 ?? null,
            p75: percentiles?.p75 ?? null,
            p90: percentiles?.p90 ?? null,
            p97: percentiles?.p97 ?? null
          };
        });
      }

      bundles[fieldId] = {
        normalRange,
        shouldShowPercentiles: showP,
        chartData,
        chartDataWithPercentiles
      };
    });
    return bundles;
  }, [
    selectedParameters,
    consultations,
    patientInfo,
    fieldIdToLabel,
    getChartDate,
    shouldShowPercentilesForField,
    getNormalRangeForField
  ]);

  const toggleParameter = (id) => {
    setSelectedParameters((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        return next.length > 0 ? next : prev;
      }
      return [...prev, id];
    });
  };

  const getCheckboxLabel = (param) => {
    if (param === 'VACCINATION_SCHEDULE') return 'Esquema de vacunación';
    const name = getParameterName(param);
    if (!name || name === param) return param;
    const u = getParameterUnit(param);
    return u ? `${name} (${u})` : name;
  };

  /** Una sola gráfica con 1 o 2 ejes Y según unidades; no aplica con percentiles OMS ni con >2 unidades distintas. */
  const multiSeriesEvolutionModel = React.useMemo(() => {
    const numericIds = selectedParameters.filter((id) => id !== 'VACCINATION_SCHEDULE');
    const withData = numericIds.filter((id) => {
      const b = chartBundleByField[id];
      return b && b.chartData.length > 0;
    });
    if (withData.length < 2) return null;

    const anyPercentiles = withData.some((id) => chartBundleByField[id]?.shouldShowPercentiles);
    if (anyPercentiles) return null;

    const unitKeyFor = (fieldId) => {
      const b = chartBundleByField[fieldId];
      const u = getParameterUnit(fieldId) || (b?.normalRange?.unit ?? '') || '';
      return u.trim() || '__sin_unidad';
    };

    const distinctUnits = [...new Set(withData.map(unitKeyFor))];
    if (distinctUnits.length > 2) return null;

    const rowByTime = new Map();
    withData.forEach((fieldId) => {
      chartBundleByField[fieldId].chartData.forEach((pt) => {
        const t = new Date(pt.date).getTime();
        if (!rowByTime.has(t)) {
          rowByTime.set(t, { date: pt.date });
        }
        const row = rowByTime.get(t);
        row[`val_${fieldId}`] = pt.value;
        row[`oor_${fieldId}`] = pt.isOutOfRange;
      });
    });

    const mergedData = Array.from(rowByTime.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, row]) => row);

    const unitOrder = distinctUnits;
    const unitToAxisId =
      unitOrder.length === 1
        ? Object.fromEntries(unitOrder.map((u) => [u, 'left']))
        : { [unitOrder[0]]: 'left', [unitOrder[1]]: 'right' };

    const series = withData.map((fieldId, i) => ({
      fieldId,
      dataKey: `val_${fieldId}`,
      name: getParameterName(fieldId),
      unitKey: unitKeyFor(fieldId),
      yAxisId: unitToAxisId[unitKeyFor(fieldId)],
      ageLike: isAgeLikeField(fieldIdToLabel, fieldId),
      color: MULTI_LINE_COLORS[i % MULTI_LINE_COLORS.length]
    }));

    return {
      mergedData,
      series,
      distinctUnits,
      unitToAxisId,
      fieldIds: withData
    };
    // getParameterName / getParameterUnit dependen solo de fieldIdToLabel (ya en deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evitar re-memo por identidad de funciones
  }, [selectedParameters, chartBundleByField, fieldIdToLabel]);

  const formatYTickWithUnit = (value, unitKey, ageLike) => {
    if (value == null || Number.isNaN(value)) return '';
    if (unitKey === '__sin_unidad') return String(value);
    if (ageLike) return formatAgeFieldValue(value);
    return `${value} ${unitKey}`;
  };

  // Función para formatear fecha al formato "D-Mon-YY"
  const formatDateShort = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  };

  // Función para extraer todas las vacunas aplicadas de todas las consultas
  const vaccinationData = React.useMemo(() => {
    if (!isVaccinationSchedule || !consultations || consultations.length === 0 || !fieldIdToLabel || Object.keys(fieldIdToLabel).length === 0) {
      return { chartData: [], vaccineNames: [], vaccinations: [] };
    }

    const vaccinations = [];
    const vaccineNamesMap = new Map(); // Para mapear nombres de vacunas a índices en el eje Y

    consultations.forEach(consultation => {
      if (!consultation.formData) return;

      // Buscar todos los campos de fecha de vacunas en el formData
      Object.keys(consultation.formData).forEach(fieldId => {
        const label = fieldIdToLabel[fieldId];
        if (!label) return;

        const labelLower = label.toLowerCase();
        
        // Verificar si es un campo de fecha de vacuna
        if (labelLower.startsWith('fecha') && (
          labelLower.includes('bcg') ||
          labelLower.includes('hepatitis') ||
          labelLower.includes('pentavalente') ||
          labelLower.includes('rotavirus') ||
          labelLower.includes('neumococo') ||
          labelLower.includes('influenza') ||
          labelLower.includes('gripe') ||
          labelLower.includes('srp') ||
          labelLower.includes('sarampión') ||
          labelLower.includes('rubeola') ||
          labelLower.includes('paperas') ||
          labelLower.includes('varicela') ||
          labelLower.includes('vph') ||
          labelLower.includes('papiloma') ||
          labelLower.includes('tdap') ||
          labelLower.includes('tétanos') ||
          labelLower.includes('covid') ||
          labelLower.includes('vacuna')
        )) {
          const dateValue = consultation.formData[fieldId];
          if (dateValue) {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              // Extraer el nombre de la vacuna del label (remover "Fecha " del inicio)
              // También manejar casos como "Fecha Influenza" donde el checkbox es "Influenza (Gripe) - Dosis anual"
              let vaccineName = label.replace(/^Fecha\s+/i, '').trim();
              
              // Normalizar nombres de vacunas para mejor comparación
              // Por ejemplo: "Fecha Influenza" debería mapear a "Influenza (Gripe) - Dosis anual" si existe
              const normalizedName = vaccineName.toLowerCase();
              
              // Buscar el checkbox correspondiente en el mismo formData
              // El patrón es: si el label es "Fecha X", buscar "X" como checkbox
              let matchingCheckboxName = null;
              Object.keys(consultation.formData).forEach(checkFieldId => {
                const checkLabel = fieldIdToLabel[checkFieldId];
                if (checkLabel && !checkLabel.toLowerCase().startsWith('fecha')) {
                  const checkLabelLower = checkLabel.toLowerCase();
                  // Verificar si el checkbox corresponde a esta fecha
                  if (checkLabelLower.includes(normalizedName.replace(/\s*\(.*?\)\s*/g, '').trim()) ||
                      normalizedName.includes(checkLabelLower.replace(/\s*\(.*?\)\s*/g, '').trim())) {
                    // Verificar si el checkbox está marcado
                    const checkboxValue = consultation.formData[checkFieldId];
                    if (checkboxValue === true || checkboxValue === 1 || checkboxValue === '1' || checkboxValue === 'true') {
                      matchingCheckboxName = checkLabel;
                    }
                  }
                }
              });
              
              // Si se encuentra un checkbox correspondiente y está marcado, usar ese nombre
              if (matchingCheckboxName) {
                vaccineName = matchingCheckboxName;
              }
              
              // Agregar el nombre de la vacuna al mapa si no existe
              if (!vaccineNamesMap.has(vaccineName)) {
                vaccineNamesMap.set(vaccineName, vaccineNamesMap.size);
              }
              
              vaccinations.push({
                vaccineName,
                date,
                dateString: date.toISOString(),
                fieldId,
                consultationId: consultation.id
              });
            }
          }
        }
      });
    });

    // Ordenar vacunas por fecha
    vaccinations.sort((a, b) => a.date - b.date);

    // Crear un array de nombres de vacunas ordenados
    const vaccineNames = Array.from(vaccineNamesMap.keys()).sort();
    
    // Actualizar los índices en el mapa
    vaccineNames.forEach((name, index) => {
      vaccineNamesMap.set(name, index);
    });

    // Crear datos para el gráfico con índices Y
    const chartData = vaccinations.map(vaccination => ({
      x: vaccination.date.getTime(), // Fecha en milisegundos para el eje X
      y: vaccineNamesMap.get(vaccination.vaccineName), // Índice en el eje Y
      vaccineName: vaccination.vaccineName,
      date: vaccination.date,
      dateString: vaccination.dateString,
      consultationId: vaccination.consultationId
    }));

    return {
      chartData,
      vaccineNames,
      vaccinations
    };
  }, [isVaccinationSchedule, consultations, fieldIdToLabel]);

  // Función para determinar vacunas pendientes y refuerzos necesarios
  const vaccinationRecommendations = React.useMemo(() => {
    if (!isVaccinationSchedule || !vaccinationData) {
      return { pending: [], boosters: [] };
    }
    
    // Asegurar que vaccinations sea un array (usar una copia si es necesario)
    const vaccinations = Array.isArray(vaccinationData.vaccinations) ? vaccinationData.vaccinations : [];

    const pending = [];
    const boosters = [];
    const now = new Date();
    const patientAge = patientInfo && patientInfo.dateOfBirth ? 
      (now - new Date(patientInfo.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25) : null;

    // Definir vacunas recomendadas según la edad (basado en recomendaciones OMS)
    const recommendedVaccines = [
      { name: 'BCG', age: 0, required: true },
      { name: 'Hepatitis B (1ra dosis)', age: 0, required: true },
      { name: 'Hepatitis B (2da dosis)', age: 1/12, required: true }, // 1 mes
      { name: 'Hepatitis B (3ra dosis)', age: 6/12, required: true }, // 6 meses
      { name: 'Pentavalente (1ra dosis)', age: 2/12, required: true }, // 2 meses
      { name: 'Pentavalente (2da dosis)', age: 4/12, required: true }, // 4 meses
      { name: 'Pentavalente (3ra dosis)', age: 6/12, required: true }, // 6 meses
      { name: 'Rotavirus (1ra dosis)', age: 2/12, required: true },
      { name: 'Rotavirus (2da dosis)', age: 4/12, required: true },
      { name: 'Neumococo (1ra dosis)', age: 2/12, required: true },
      { name: 'Neumococo (2da dosis)', age: 4/12, required: true },
      { name: 'Neumococo (3ra dosis)', age: 6/12, required: true },
      { name: 'SRP (1ra dosis)', age: 1, required: true }, // 12 meses
      { name: 'SRP (2da dosis)', age: 6, required: true }, // 6 años
      { name: 'Varicela', age: 1, required: true },
      { name: 'VPH (1ra dosis)', age: 9, required: true }, // 9 años (niñas)
      { name: 'VPH (2da dosis)', age: 9.5, required: true }, // 9.5 años
      { name: 'Tdap', age: 11, required: true }, // 11 años
      { name: 'Tétanos (Refuerzo)', age: 16, required: true, interval: 10 }, // Refuerzo cada 10 años
      { name: 'Influenza (Gripe) - Dosis anual', age: 0.5, required: false, annual: true }, // Anual
      { name: 'COVID-19 (1ra dosis)', age: 0, required: false },
      { name: 'COVID-19 (2da dosis)', age: 1/12, required: false }, // 1 mes
      { name: 'COVID-19 (Refuerzo)', age: 1, required: false, interval: 6 } // Refuerzo cada 6 meses
    ];

    // Función auxiliar para normalizar nombres de vacunas para comparación
    const normalizeVaccineName = (name) => {
      return name.toLowerCase()
        .replace(/\s*\(.*?\)\s*/g, '') // Remover paréntesis y su contenido
        .replace(/\s*-\s*/g, ' ') // Reemplazar guiones con espacios
        .replace(/\s+/g, ' ') // Normalizar espacios
        .trim();
    };

    // Verificar vacunas aplicadas
    const appliedVaccines = new Map();
    vaccinations.forEach(vaccination => {
      const normalizedKey = normalizeVaccineName(vaccination.vaccineName);
      if (!appliedVaccines.has(normalizedKey)) {
        appliedVaccines.set(normalizedKey, []);
      }
      appliedVaccines.get(normalizedKey).push(vaccination.date);
    });

    // Verificar vacunas pendientes y refuerzos
    recommendedVaccines.forEach(vaccine => {
      const normalizedKey = normalizeVaccineName(vaccine.name);
      const applied = appliedVaccines.get(normalizedKey) || [];
      
      // También buscar variaciones del nombre (por ejemplo, "Influenza" vs "Influenza (Gripe) - Dosis anual")
      if (applied.length === 0) {
        // Buscar vacunas aplicadas que coincidan con palabras clave
        const vaccineKeywords = normalizedKey.split(' ').filter(word => word.length > 2);
        appliedVaccines.forEach((dates, appliedKey) => {
          if (vaccineKeywords.some(keyword => appliedKey.includes(keyword)) ||
              appliedKey.split(' ').some(keyword => normalizedKey.includes(keyword))) {
            applied.push(...dates);
          }
        });
      }
      
      if (patientAge !== null && patientAge >= vaccine.age) {
        if (vaccine.annual) {
          // Para vacunas anuales como influenza, verificar si se aplicó en el último año
          const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          const appliedInLastYear = applied.some(date => date >= lastYear);
          if (!appliedInLastYear) {
            boosters.push({
              name: vaccine.name,
              reason: 'Refuerzo anual recomendado',
              lastApplied: applied.length > 0 ? applied[applied.length - 1] : null
            });
          }
        } else if (vaccine.interval) {
          // Para vacunas con intervalo de refuerzo
          if (applied.length > 0) {
            const lastApplied = applied[applied.length - 1];
            const yearsSinceLastApplied = (now - lastApplied) / (1000 * 60 * 60 * 24 * 365.25);
            if (yearsSinceLastApplied >= vaccine.interval) {
              boosters.push({
                name: vaccine.name,
                reason: `Refuerzo recomendado (última dosis hace ${Math.floor(yearsSinceLastApplied)} años)`,
                lastApplied
              });
            }
          } else if (vaccine.required) {
            pending.push({
              name: vaccine.name,
              reason: 'Vacuna requerida según calendario OMS',
              recommendedAge: `${Math.floor(vaccine.age * 12)} meses`
            });
          }
        } else {
          // Para vacunas que solo se aplican una vez o en serie
          if (applied.length === 0 && vaccine.required) {
            pending.push({
              name: vaccine.name,
              reason: 'Vacuna requerida según calendario OMS',
              recommendedAge: `${Math.floor(vaccine.age * 12)} meses`
            });
          }
        }
      } else if (patientAge === null && vaccine.required) {
        // Si no conocemos la edad del paciente, mostrar todas las vacunas recomendadas
        pending.push({
          name: vaccine.name,
          reason: 'Vacuna recomendada según calendario OMS',
          recommendedAge: `${Math.floor(vaccine.age * 12)} meses`
        });
      }
    });

    return { pending, boosters };
  }, [isVaccinationSchedule, vaccinationData, patientInfo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (availableParameters.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        No hay datos numéricos disponibles para graficar
      </div>
    );
  }

  const numericSelectedIds = selectedParameters.filter((id) => id !== 'VACCINATION_SCHEDULE');

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Seleccionar parámetros a visualizar
        </label>
        <p className="text-sm text-gray-600 mb-3">
          Puedes elegir uno o más parámetros para comparar su evolución. Las opciones son los campos numéricos
          capturados en consultas anteriores.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {availableParameters.map((param) => (
            <label
              key={param}
              className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-800"
            >
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={selectedParameters.includes(param)}
                onChange={() => toggleParameter(param)}
              />
              <span>{getCheckboxLabel(param)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Resumen con alertas */}
      {alertData.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Alertas detectadas ({alertData.length})
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Se han detectado valores fuera del rango normal en uno o más de los parámetros seleccionados.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isVaccinationSchedule && vaccinationData && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-900 mb-4 text-xl">Esquema de vacunación</h3>
          {vaccinationData.chartData && vaccinationData.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(600, Math.min(800, vaccinationData.vaccineNames.length * 55))}>
              <ScatterChart 
                data={vaccinationData.chartData}
                margin={{ top: 20, right: 30, bottom: 40, left: 200 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number"
                  dataKey="x"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(value) => {
                    const d = new Date(value);
                    return formatDateShort(d);
                  }}
                  label={{ value: 'Fecha de aplicación', position: 'insideBottom', offset: -5 }}
                  tick={{ fontSize: 13 }}
                />
                <YAxis 
                  type="number"
                  dataKey="y"
                  domain={vaccinationData.vaccineNames.length > 0 ? [-0.5, vaccinationData.vaccineNames.length - 0.5] : [-0.5, 0.5]}
                  ticks={vaccinationData.vaccineNames.length > 0 ? vaccinationData.vaccineNames.map((_, index) => index) : [0]}
                  tickFormatter={(value) => {
                    return vaccinationData.vaccineNames[value] || '';
                  }}
                  width={190}
                  tick={{ fontSize: 13, dy: 4 }}
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
                          <p className="font-semibold text-gray-900">{data.vaccineName}</p>
                          <p className="text-sm text-gray-600">
                            Fecha: {new Date(data.date).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter 
                  name="Vacunas aplicadas" 
                  data={vaccinationData.chartData} 
                  fill="#3b82f6"
                  shape={(props) => {
                    const { cx, cy } = props;
                    return <circle cx={cx} cy={cy} r={8} fill="#3b82f6" stroke="#2563eb" strokeWidth={2} />;
                  }}
                >
                  {vaccinationData.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#3b82f6" />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center p-8 text-gray-500">
              <p className="mb-2">No hay vacunas aplicadas registradas.</p>
              <p className="text-sm">Las vacunas aplicadas aparecerán como puntos en el gráfico cuando se registren.</p>
            </div>
          )}
        </div>
      )}

      {multiSeriesEvolutionModel && (() => {
        const {
          mergedData,
          series: multiSeries,
          distinctUnits,
          fieldIds: multiFieldIds
        } = multiSeriesEvolutionModel;
        const repLeft = multiSeries.find((s) => s.yAxisId === 'left');
        const repRight = multiSeries.find((s) => s.yAxisId === 'right');
        const leftLabel =
          repLeft && repLeft.unitKey !== '__sin_unidad' ? repLeft.unitKey : '';
        const rightLabel =
          repRight && repRight.unitKey !== '__sin_unidad' ? repRight.unitKey : '';

        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 text-lg">
              Evolución: {multiSeries.map((s) => s.name).join(', ')}
            </h3>
            <ResponsiveContainer
              width="100%"
              height={400}
            >
              <LineChart
                data={mergedData}
                margin={{
                  top: 30,
                  right: distinctUnits.length > 1 ? 56 : 28,
                  bottom: 30,
                  left: 16
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => formatDateShort(date)}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  label={
                    leftLabel
                      ? {
                          value: leftLabel,
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontWeight: 'bold' }
                        }
                      : undefined
                  }
                  tickFormatter={(v) =>
                    repLeft
                      ? formatYTickWithUnit(v, repLeft.unitKey, repLeft.ageLike)
                      : v
                  }
                />
                {distinctUnits.length > 1 && repRight && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    label={
                      rightLabel
                        ? {
                            value: rightLabel,
                            angle: 90,
                            position: 'insideRight',
                            style: { fontWeight: 'bold' }
                          }
                        : undefined
                    }
                    tickFormatter={(v) =>
                      formatYTickWithUnit(v, repRight.unitKey, repRight.ageLike)
                    }
                  />
                )}
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const row = payload[0].payload;
                    const d = row.date;
                    return (
                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                        <p className="font-semibold text-gray-900 mb-1">
                          Fecha: {new Date(d).toLocaleDateString('es-ES')}
                        </p>
                        {multiSeries.map((s) => {
                          const v = row[s.dataKey];
                          if (v == null || Number.isNaN(v)) return null;
                          const display = s.ageLike
                            ? formatAgeFieldValue(v)
                            : `${v}${
                                s.unitKey && s.unitKey !== '__sin_unidad' ? ` ${s.unitKey}` : ''
                              }`;
                          return (
                            <p key={s.fieldId} className="text-sm" style={{ color: s.color }}>
                              {s.name}: {display}
                            </p>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                <Legend />
                {multiSeries.map((s) => (
                  <Line
                    key={s.fieldId}
                    yAxisId={s.yAxisId}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={2}
                    connectNulls
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      const isOut = payload[`oor_${s.fieldId}`];
                      const raw = payload[s.dataKey];
                      const isNearTop = cy < 100;
                      return (
                        <g>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isOut ? 8 : 6}
                            fill={isOut ? '#ef4444' : s.color}
                            stroke={isOut ? '#dc2626' : s.color}
                            strokeWidth={isOut ? 2 : 1}
                          />
                          {isOut && raw != null && (
                            <text
                              x={cx}
                              y={isNearTop ? cy + 28 : cy - 15}
                              textAnchor="middle"
                              fill="#dc2626"
                              fontSize="11"
                              fontWeight="bold"
                              style={{ pointerEvents: 'none' }}
                            >
                              {s.ageLike ? formatAgeFieldValue(raw) : raw}
                            </text>
                          )}
                        </g>
                      );
                    }}
                    activeDot={{ r: 8 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-4 space-y-3">
              {multiFieldIds.map((fid) => {
                const bundle = chartBundleByField[fid];
                if (!bundle?.normalRange) return null;
                const ageLike = isAgeLikeField(fieldIdToLabel, fid);
                const u =
                  getParameterUnit(fid) || bundle.normalRange.unit || '';
                if (ageLike) {
                  return (
                    <div key={fid} className="text-sm text-gray-600">
                      <span className="font-semibold">{getParameterName(fid)}:</span> unidad en gráfico{' '}
                      <span className="font-medium">{u || 'años y meses'}</span>.
                    </div>
                  );
                }
                return (
                  <div key={fid} className="text-sm text-gray-600">
                    <span className="font-semibold">{getParameterName(fid)} — Rango normal:</span>{' '}
                    {bundle.normalRange.min} - {bundle.normalRange.max}{' '}
                    {bundle.normalRange.unit || u}
                  </div>
                );
              })}
              {patientInfo &&
                (patientInfo.dateOfBirth ||
                  patientInfo.age ||
                  patientInfo.biologicalSex) && (
                  <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                    <p className="font-medium text-blue-800 mb-1">Rango personalizado según OMS</p>
                    <p>
                      {patientInfo.biologicalSex &&
                        `Sexo biológico: ${patientInfo.biologicalSex}`}
                      {(patientInfo.age != null ||
                        (patientInfo.dateOfBirth &&
                          formatAgeDisplay(patientInfo.dateOfBirth))) &&
                        ` • Edad: ${
                          patientInfo.dateOfBirth
                            ? formatAgeDisplay(patientInfo.dateOfBirth)
                            : formatAgeFieldValue(Math.round(patientInfo.age * 12))
                        }`}
                      {patientInfo.height && ` • Altura: ${patientInfo.height} cm`}
                      {patientInfo.isPregnant && ' • Embarazo: Sí'}
                    </p>
                  </div>
                )}
            </div>
          </div>
        );
      })()}

      {!multiSeriesEvolutionModel &&
        numericSelectedIds.map((fieldId) => {
        const bundle = chartBundleByField[fieldId];
        if (!bundle) return null;
        const { normalRange, shouldShowPercentiles, chartData, chartDataWithPercentiles } = bundle;
        const ageLike = isAgeLikeField(fieldIdToLabel, fieldId);
        const unitLabel = getParameterUnit(fieldId) || (normalRange ? normalRange.unit : '') || '';
        const lineData =
          shouldShowPercentiles && chartDataWithPercentiles && chartDataWithPercentiles.length > 0
            ? chartDataWithPercentiles
            : chartData;

        return (
          <div key={fieldId} className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 text-lg">
              Evolución: {getCheckboxLabel(fieldId)}
            </h3>
            {chartData.length === 0 ? (
              <div className="text-center p-8 text-gray-500 text-sm">
                No hay puntos registrados para este parámetro en el historial de consultas.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={lineData} margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => formatDateShort(date)}
              />
              <YAxis 
                label={{ 
                  value: unitLabel, 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontWeight: 'bold' }
                }}
                tickFormatter={(v) => (ageLike ? formatAgeFieldValue(v) : v)}
              />
              <Tooltip 
                labelFormatter={(date) => {
                  const d = new Date(date);
                  return `Fecha: ${d.toLocaleDateString('es-ES')}`;
                }}
                formatter={(value) => {
                  const display = ageLike
                    ? formatAgeFieldValue(value)
                    : `${value}${unitLabel ? ` ${unitLabel}` : ''}`;
                  return [display, getParameterName(fieldId)];
                }}
              />
              <Legend />
            
            {/* Curvas de percentiles OMS - mostrar primero para que queden debajo */}
            {shouldShowPercentiles && chartDataWithPercentiles && chartDataWithPercentiles.length > 0 && (() => {
              // Calcular valores promedio para zonas
              const percentileValues = chartDataWithPercentiles
                .filter(d => d.p3 !== null)
                .flatMap(d => [d.p3, d.p10, d.p25, d.p50, d.p75, d.p90, d.p97]);
              
              if (percentileValues.length === 0) return null;
              
              const minPercentile = Math.min(...percentileValues);
              const maxPercentile = Math.max(...percentileValues);
              
              const avgP3 = chartDataWithPercentiles
                .filter(d => d.p3 !== null)
                .reduce((sum, d) => sum + d.p3, 0) / chartDataWithPercentiles.filter(d => d.p3 !== null).length;
              const avgP10 = chartDataWithPercentiles
                .filter(d => d.p10 !== null)
                .reduce((sum, d) => sum + d.p10, 0) / chartDataWithPercentiles.filter(d => d.p10 !== null).length;
              const avgP90 = chartDataWithPercentiles
                .filter(d => d.p90 !== null)
                .reduce((sum, d) => sum + d.p90, 0) / chartDataWithPercentiles.filter(d => d.p90 !== null).length;
              const avgP97 = chartDataWithPercentiles
                .filter(d => d.p97 !== null)
                .reduce((sum, d) => sum + d.p97, 0) / chartDataWithPercentiles.filter(d => d.p97 !== null).length;
              
              return (
                <>
                  {/* Zonas de percentiles con colores */}
                  {/* Zona muy baja (debajo de P3) */}
                  <ReferenceArea 
                    y1={minPercentile * 0.9} 
                    y2={avgP3} 
                    stroke="none" 
                    fill={getPercentileZoneColor('very-low')}
                  />
                  
                  {/* Zona baja (P3-P10) */}
                  <ReferenceArea 
                    y1={avgP3} 
                    y2={avgP10} 
                    stroke="none" 
                    fill={getPercentileZoneColor('low')}
                  />
                  
                  {/* Zona normal (P10-P90) */}
                  <ReferenceArea 
                    y1={avgP10} 
                    y2={avgP90} 
                    stroke="none" 
                    fill={getPercentileZoneColor('normal')}
                  />
                  
                  {/* Zona alta (P90-P97) */}
                  <ReferenceArea 
                    y1={avgP90} 
                    y2={avgP97} 
                    stroke="none" 
                    fill={getPercentileZoneColor('high')}
                  />
                  
                  {/* Zona muy alta (arriba de P97) */}
                  <ReferenceArea 
                    y1={avgP97} 
                    y2={maxPercentile * 1.1} 
                    stroke="none" 
                    fill={getPercentileZoneColor('very-high')}
                  />
                  
                  {/* Líneas de percentiles principales - usando datos combinados con fechas */}
                  <Line 
                    type="monotone" 
                    dataKey="p3" 
                    data={chartDataWithPercentiles}
                    stroke="#ef4444" 
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.7}
                    dot={false}
                    connectNulls={true}
                    name="P3"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="p97" 
                    data={chartDataWithPercentiles}
                    stroke="#ef4444" 
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.7}
                    dot={false}
                    connectNulls={true}
                    name="P97"
                  />
                  
                  <Line 
                    type="monotone" 
                    dataKey="p10" 
                    data={chartDataWithPercentiles}
                    stroke="#f59e0b" 
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                    dot={false}
                    connectNulls={true}
                    name="P10"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="p90" 
                    data={chartDataWithPercentiles}
                    stroke="#f59e0b" 
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                    dot={false}
                    connectNulls={true}
                    name="P90"
                  />
                  
                  <Line 
                    type="monotone" 
                    dataKey="p25" 
                    data={chartDataWithPercentiles}
                    stroke="#eab308" 
                    strokeWidth={0.8}
                    strokeDasharray="2 2"
                    strokeOpacity={0.5}
                    dot={false}
                    connectNulls={true}
                    name="P25"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="p75" 
                    data={chartDataWithPercentiles}
                    stroke="#eab308" 
                    strokeWidth={0.8}
                    strokeDasharray="2 2"
                    strokeOpacity={0.5}
                    dot={false}
                    connectNulls={true}
                    name="P75"
                  />
                  
                  {/* P50 (mediana) - línea más visible */}
                  <Line 
                    type="monotone" 
                    dataKey="p50" 
                    data={chartDataWithPercentiles}
                    stroke="#10b981" 
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    strokeOpacity={0.8}
                    dot={false}
                    connectNulls={true}
                    name="P50 (Mediana)"
                  />
                </>
              );
            })()}
            
            {/* Zonas de rango: verde para normal, rojo para fuera de rango (solo si no hay percentiles). Edad: datos en meses, no mezclar con rangos en años. */}
            {normalRange && !shouldShowPercentiles && !ageLike && (() => {
              // Calcular el rango de valores en los datos
              const dataValues = chartData.map(d => d.value);
              const minDataValue = dataValues.length > 0 ? Math.min(...dataValues) : normalRange.min;
              const maxDataValue = dataValues.length > 0 ? Math.max(...dataValues) : normalRange.max;
              
              // Calcular el rango visible del eje Y con margen
              // Usar un valor base más bajo para asegurar que siempre haya espacio para zonas rojas
              const yMinBase = Math.min(minDataValue, normalRange.min);
              const yMaxBase = Math.max(maxDataValue, normalRange.max);
              
              const yMin = Math.max(0, yMinBase * 0.95); // 5% de margen inferior, mínimo 0
              const yMax = yMaxBase * 1.1; // 10% de margen superior
              
              // Determinar si mostrar zonas rojas basado en los datos reales
              const hasValuesBelowNormal = minDataValue < normalRange.min;
              const hasValuesAboveNormal = maxDataValue > normalRange.max;
              
              return (
                <>
                  {/* IMPORTANTE: Renderizar zonas rojas PRIMERO para que queden debajo */}
                  {/* Zona ROJA: valores por debajo del mínimo - siempre mostrar si hay valores por debajo o si el mínimo visible es menor */}
                  {(hasValuesBelowNormal || yMin < normalRange.min) && (
                    <ReferenceArea 
                      y1={yMin} 
                      y2={normalRange.min} 
                      stroke="none" 
                      fill="#ef4444" 
                      fillOpacity={0.2}
                    />
                  )}
                  
                  {/* Zona VERDE: rango normal (dentro del rango) - renderizar después para que quede encima */}
                  <ReferenceArea 
                    y1={normalRange.min} 
                    y2={normalRange.max} 
                    stroke="none" 
                    fill="#10b981" 
                    fillOpacity={0.25}
                  />
                  
                  {/* Zona ROJA: valores por encima del máximo - siempre mostrar si hay valores por encima o si el máximo visible es mayor */}
                  {(hasValuesAboveNormal || yMax > normalRange.max) && (
                    <ReferenceArea 
                      y1={normalRange.max} 
                      y2={yMax} 
                      stroke="none" 
                      fill="#ef4444" 
                      fillOpacity={0.2}
                    />
                  )}
                  
                  {/* Líneas de referencia del rango normal - sin etiquetas para evitar texto "Nor" */}
                  <ReferenceLine 
                    y={normalRange.min} 
                    stroke="#10b981" 
                    strokeDasharray="3 3" 
                    strokeOpacity={0.7}
                    strokeWidth={2}
                  />
                  <ReferenceLine 
                    y={normalRange.max} 
                    stroke="#10b981" 
                    strokeDasharray="3 3" 
                    strokeOpacity={0.7}
                    strokeWidth={2}
                  />
                </>
              );
            })()}
            
            {/* Línea de datos con puntos personalizados */}
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const isOutOfRange = payload.isOutOfRange;
                
                // Calcular posición del texto para evitar que se corte
                // Si el punto está en la parte superior del gráfico (cy < 100px desde arriba), 
                // poner el texto abajo del punto en lugar de arriba
                const isNearTop = cy < 100;
                
                return (
                  <g>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isOutOfRange ? 8 : 6}
                      fill={isOutOfRange ? "#ef4444" : "#3b82f6"}
                      stroke={isOutOfRange ? "#dc2626" : "#2563eb"}
                      strokeWidth={isOutOfRange ? 2 : 1}
                    />
                    {isOutOfRange && (
                      <text
                        x={cx}
                        y={isNearTop ? cy + 28 : cy - 15}
                        textAnchor="middle"
                        fill="#dc2626"
                        fontSize="12"
                        fontWeight="bold"
                        style={{ pointerEvents: 'none' }}
                      >
                        {ageLike ? formatAgeFieldValue(payload.value) : payload.value}
                      </text>
                    )}
                  </g>
                );
              }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
            )}

            {normalRange && (
              <div className="mt-4 space-y-2">
                <div className="text-sm text-gray-600">
                  {ageLike ? (
                    <p>
                      <span className="font-semibold">Unidad en gráfico:</span> {unitLabel}. El eje Y y las etiquetas
                      muestran la edad como en consulta (años y meses), aunque el valor guardado sea meses totales.
                    </p>
                  ) : (
                    <p>
                      <span className="font-semibold">Rango normal:</span>{' '}
                      {normalRange.min} - {normalRange.max} {normalRange.unit || unitLabel}
                    </p>
                  )}
                </div>
                {patientInfo && (patientInfo.dateOfBirth || patientInfo.age || patientInfo.biologicalSex) && (
                  <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                    <p className="font-medium text-blue-800 mb-1">Rango personalizado según OMS</p>
                    <p>
                      {patientInfo.biologicalSex && `Sexo biológico: ${patientInfo.biologicalSex}`}
                      {(patientInfo.age != null || (patientInfo.dateOfBirth && formatAgeDisplay(patientInfo.dateOfBirth))) && 
                        ` • Edad: ${patientInfo.dateOfBirth ? formatAgeDisplay(patientInfo.dateOfBirth) : formatAgeFieldValue(Math.round(patientInfo.age * 12))}`}
                      {patientInfo.height && ` • Altura: ${patientInfo.height} cm`}
                      {patientInfo.isPregnant && ' • Embarazo: Sí'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Lista de vacunas pendientes y refuerzos */}
      {isVaccinationSchedule && vaccinationRecommendations && (
        <div className="space-y-4">
          {/* Vacunas pendientes */}
          {vaccinationRecommendations.pending && vaccinationRecommendations.pending.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 shadow">
              <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Vacunas Pendientes ({vaccinationRecommendations.pending.length})
              </h3>
              <ul className="space-y-2">
                {vaccinationRecommendations.pending.map((vaccine, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-yellow-600 mr-2">•</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{vaccine.name}</p>
                      <p className="text-sm text-gray-600">{vaccine.reason}</p>
                      {vaccine.recommendedAge && (
                        <p className="text-xs text-gray-500">Edad recomendada: {vaccine.recommendedAge}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Refuerzos necesarios */}
          {vaccinationRecommendations.boosters && vaccinationRecommendations.boosters.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow">
              <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Refuerzos Recomendados ({vaccinationRecommendations.boosters.length})
              </h3>
              <ul className="space-y-2">
                {vaccinationRecommendations.boosters.map((booster, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{booster.name}</p>
                      <p className="text-sm text-gray-600">{booster.reason}</p>
                      {booster.lastApplied && (
                        <p className="text-xs text-gray-500">
                          Última dosis: {new Date(booster.lastApplied).toLocaleDateString('es-ES')}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mensaje si no hay vacunas pendientes ni refuerzos */}
          {vaccinationRecommendations.pending.length === 0 && vaccinationRecommendations.boosters.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 shadow">
              <h3 className="text-lg font-semibold text-green-800 mb-2 flex items-center">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Esquema de Vacunación al Día
              </h3>
              <p className="text-green-700">
                Todas las vacunas recomendadas según el calendario de la OMS están al día. No se requieren vacunas pendientes ni refuerzos en este momento.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Lista de consultas con alertas */}
      {alertData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Consultas con valores anormales
          </h3>
          <div className="space-y-2">
            {alertData.map((alert, index) => {
              // Usar date explícito si existe, sino createdAt, y formatear correctamente
              let alertDate = alert.date;
              if (alertDate && typeof alertDate === 'string') {
                alertDate = new Date(alertDate);
              }
              // Asegurar que la fecha se muestre correctamente (usar la fecha del día, no hora)
              const dateObj = new Date(alertDate);
              // Usar toLocaleDateString para obtener la fecha correcta sin problemas de zona horaria
              const formattedDate = dateObj.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
              
              return (
                <div key={index} className={`border-l-4 ${getAlertColor(alert.alertLevel)} bg-gray-50 p-3 rounded-r`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formattedDate}
                      </p>
                      <p className="text-sm text-gray-600">
                        {getParameterName(alert.fieldId)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Valor:{' '}
                        {alert.fieldId && isAgeLikeField(fieldIdToLabel, alert.fieldId)
                          ? formatAgeFieldValue(alert.value)
                          : `${alert.value} ${getNormalRangeForField(alert.fieldId)?.unit || getParameterUnit(alert.fieldId) || ''}`.trim()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      alert.alertLevel === 2 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {alert.alertLevel === 2 ? 'Alerta Alta' : 'Precaución'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientHealthCharts;
