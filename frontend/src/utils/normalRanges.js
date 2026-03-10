// Rangos normales basados en estándares internacionales (OMS, CDC)
// Aplicables para población mexicana y latinoamericana

export const normalRanges = {
  // Datos médicos generales - Valores basados en OMS y normativas médicas internacionales
  edad: { min: 0, max: 120, unit: 'años' },
  peso: { min: 2.5, max: 100, unit: 'kg' }, // Variable por edad y género
  talla: { min: 30, max: 220, unit: 'cm' }, // Variable por edad y género
  imc: { min: 18.5, max: 24.9, unit: 'kg/m²' },
  'imc_indice_de_masa_corporal': { min: 18.5, max: 24.9, unit: 'kg/m²' },
  presion_arterial_sistolica: { min: 90, max: 120, unit: 'mmHg' }, // Normal: <120 (OMS/AHA)
  'presion_arterial_sistolica': { min: 90, max: 120, unit: 'mmHg' },
  presion_arterial_diastolica: { min: 60, max: 80, unit: 'mmHg' }, // Normal: <80 (OMS/AHA)
  'presion_arterial_diastolica': { min: 60, max: 80, unit: 'mmHg' },
  frecuencia_cardiaca: { min: 60, max: 100, unit: 'lpm' }, // Reposo adulto
  'frecuencia_cardiaca': { min: 60, max: 100, unit: 'lpm' },
  'frecuencia_cardiac': { min: 60, max: 100, unit: 'lpm' },
  frecuencia_respiratoria: { min: 12, max: 20, unit: 'rpm' }, // Adulto reposo (OMS)
  'frecuencia_respiratoria': { min: 12, max: 20, unit: 'rpm' },
  temperatura: { min: 36.1, max: 37.2, unit: '°C' }, // Oral normal (OMS)
  'temperatura': { min: 36.1, max: 37.2, unit: '°C' },
  saturacion_de_oxigeno_spo2: { min: 95, max: 100, unit: '%' }, // Normal: >95% (OMS)
  'saturacion_de_oxigeno_spo2': { min: 95, max: 100, unit: '%' },
  saturacion_oxigeno_spo2: { min: 95, max: 100, unit: '%' },
  circunferencia_abdominal: { min: 70, max: 80, unit: 'cm' }, // Mujer (OMS: riesgo <80cm)
  'circunferencia_abdominal': { min: 70, max: 80, unit: 'cm' },
  circunferencia_cadera: { min: 80, max: 100, unit: 'cm' }, // Varia por género
  'circunferencia_de_cadera': { min: 80, max: 100, unit: 'cm' },
  perimetro_cefalico: { min: 30, max: 60, unit: 'cm' }, // Principalmente pediatría
  'perimetro_cefalico': { min: 30, max: 60, unit: 'cm' },
  glucemia_capilar: { min: 70, max: 100, unit: 'mg/dL' }, // Ayunas (OMS: normal <100)
  'glucemia_capilar': { min: 70, max: 100, unit: 'mg/dL' },
  
  // Campos adicionales de datos médicos generales
  dolor_escala_0_10: { min: 0, max: 3, unit: '0-10' }, // Escala de dolor: normal <3
  'dolor_escala_0_10': { min: 0, max: 3, unit: '0-10' },
  escala_de_dolor_0_10: { min: 0, max: 3, unit: '0-10' }, // Traumatología
  
  // Radiología (labels: Índice BIRADS, T-score densidad ósea → normalización quita acentos)
  indice_birads_mamografia: { min: 0, max: 2, unit: '0-6' }, // BIRADS 0-2 suele ser benigno
  ndice_birads_mamografa: { min: 0, max: 2, unit: '0-6' }, // Í→sin acento
  tscore_densidad_osea: { min: -1, max: 1, unit: 'T-score' }, // Normal: >-1
  tscore_densidad_sea: { min: -1, max: 1, unit: 'T-score' }, // ósea→sea
  
  // Traumatología
  rango_de_movilidad_grados: { min: 0, max: 180, unit: 'grados' },
  escala_de_dolor_010: { min: 0, max: 3, unit: '0-10' }, // Escala de dolor (0-10)
  
  // Odontología (labels: Índice de placa, Índice gingival → Í→sin acento)
  indice_de_placa: { min: 0, max: 20, unit: '%' }, // Óptimo <20%
  ndice_de_placa: { min: 0, max: 20, unit: '%' },
  indice_gingival: { min: 0, max: 1, unit: '0-3' }, // 0=sano, 1=leve
  ndice_gingival: { min: 0, max: 1, unit: '0-3' },
  piezas_cariadas: { min: 0, max: 0, unit: 'número' }, // Ideal 0
  piezas_perdidas: { min: 0, max: 0, unit: 'número' }, // Ideal 0
  piezas_obturadas: { min: 0, max: 32, unit: 'número' },
  cpod: { min: 0, max: 2.6, unit: 'índice' }, // CPOD bajo 0-2.6 (OMS)
  
  // Examen general de orina
  densidad: { min: 1.005, max: 1.030, unit: '' },
  ph: { min: 4.5, max: 8.0, unit: '' },
  urobilinogeno: { min: 0.1, max: 1.0, unit: 'mg/dL' },
  glucosa: { min: 0, max: 0, unit: '' }, // Negativo
  proteinas: { min: 0, max: 0, unit: '' }, // Negativo
  cetonas: { min: 0, max: 0, unit: '' }, // Negativo
  sangre: { min: 0, max: 0, unit: '' }, // Negativo
  bilirrubina: { min: 0, max: 0, unit: '' }, // Negativo
  nitritos: { min: 0, max: 0, unit: '' }, // Negativo
  'leucocitos_esterasa': { min: 0, max: 0, unit: '' }, // Negativo
  'leucocitos_por_campo': { min: 0, max: 3, unit: 'por campo' },
  'eritrocitos_por_campo': { min: 0, max: 3, unit: 'por campo' },
  'celulas_epiteliales': { min: 0, max: 3, unit: '' }, // Escasas
  cilindros: { min: 0, max: 0, unit: '' },
  bacterias: { min: 0, max: 1, unit: '' },
  cristales: { min: 0, max: 0, unit: '' },
  mucus: { min: 0, max: 0, unit: '' },
  
  // Biometría hemática
  globulos_blancos: { min: 4500, max: 11000, unit: 'cel/μL' },
  'globulos_blancos_leucocitos': { min: 4500, max: 11000, unit: 'cel/μL' },
  globulos_rojos: { min: 4.5, max: 5.9, unit: 'millones/μL' }, // Mujer
  'globulos_rojos_eritrocitos': { min: 4.5, max: 5.9, unit: 'millones/μL' },
  hemoglobina: { min: 12, max: 16, unit: 'g/dL' }, // Mujer
  hematocrito: { min: 37, max: 48, unit: '%' }, // Mujer
  vcm: { min: 80, max: 100, unit: 'fL' },
  'vcm_volumen_corpuscular_medio': { min: 80, max: 100, unit: 'fL' },
  hcm: { min: 26, max: 34, unit: 'pg' },
  'hcm_hemoglobina_corpuscular_media': { min: 26, max: 34, unit: 'pg' },
  chcm: { min: 31, max: 37, unit: 'g/dL' },
  'chcm_concentracion_de_hemoglobina_corpuscular_media': { min: 31, max: 37, unit: 'g/dL' },
  plaquetas: { min: 150000, max: 450000, unit: 'mil/μL' },
  neutrofilos: { min: 50, max: 70, unit: '%' },
  'neutrofilos_': { min: 50, max: 70, unit: '%' },
  linfocitos: { min: 20, max: 40, unit: '%' },
  'linfocitos_': { min: 20, max: 40, unit: '%' },
  monocitos: { min: 2, max: 8, unit: '%' },
  'monocitos_': { min: 2, max: 8, unit: '%' },
  eosinofilos: { min: 0, max: 5, unit: '%' },
  'eosinofilos_': { min: 0, max: 5, unit: '%' },
  basofilos: { min: 0, max: 2, unit: '%' },
  'basofilos_': { min: 0, max: 2, unit: '%' },
  
  // Química sanguínea
  'glucosa_en_ayunas': { min: 70, max: 100, unit: 'mg/dL' },
  glucosa_ayunas: { min: 70, max: 100, unit: 'mg/dL' },
  glucosa: { min: 70, max: 100, unit: 'mg/dL' },
  urea: { min: 15, max: 50, unit: 'mg/dL' },
  creatinina: { min: 0.6, max: 1.2, unit: 'mg/dL' }, // Mujer
  acido_urico: { min: 2.4, max: 6.0, unit: 'mg/dL' }, // Mujer
  colesterol_total: { min: 0, max: 200, unit: 'mg/dL' }, // Deseable: <200
  'hdl_colesterol_bueno': { min: 40, max: 200, unit: 'mg/dL' }, // Deseable: >40
  hdl: { min: 40, max: 200, unit: 'mg/dL' },
  'ldl_colesterol_malo': { min: 0, max: 100, unit: 'mg/dL' }, // Optimo: <100
  ldl: { min: 0, max: 100, unit: 'mg/dL' },
  vldl: { min: 0, max: 40, unit: 'mg/dL' },
  trigliceridos: { min: 0, max: 150, unit: 'mg/dL' }, // Normal: <150
  'proteinas_totales': { min: 6.0, max: 8.3, unit: 'g/dL' },
  proteinas_totales: { min: 6.0, max: 8.3, unit: 'g/dL' },
  albumina: { min: 3.5, max: 5.0, unit: 'g/dL' },
  globulinas: { min: 2.3, max: 3.5, unit: 'g/dL' },
  'bilirrubina_total': { min: 0.3, max: 1.2, unit: 'mg/dL' },
  bilirrubina_total: { min: 0.3, max: 1.2, unit: 'mg/dL' },
  bilirrubina_directa: { min: 0.0, max: 0.3, unit: 'mg/dL' },
  bilirrubina_indirecta: { min: 0.2, max: 1.0, unit: 'mg/dL' },
  tgo: { min: 10, max: 40, unit: 'U/L' }, // Mujer
  tgo_ast: { min: 10, max: 40, unit: 'U/L' },
  'tgo_ast': { min: 10, max: 40, unit: 'U/L' },
  tgp: { min: 7, max: 35, unit: 'U/L' }, // Mujer
  tgp_alt: { min: 7, max: 35, unit: 'U/L' },
  'tgp_alt': { min: 7, max: 35, unit: 'U/L' },
  fosfatasa_alcalina: { min: 44, max: 147, unit: 'U/L' }, // Mujer
  ldh: { min: 140, max: 280, unit: 'U/L' },
  'ldh_lactato_deshidrogenasa': { min: 140, max: 280, unit: 'U/L' },
  
  // Perfil tiroideo
  tsh: { min: 0.4, max: 4.0, unit: 'mUI/L' },
  'tsh_hormona_estimulante_de_tiroides': { min: 0.4, max: 4.0, unit: 'mUI/L' },
  't4_libre': { min: 0.7, max: 1.9, unit: 'ng/dL' },
  t4_libre: { min: 0.7, max: 1.9, unit: 'ng/dL' },
  't3_libre': { min: 2.3, max: 4.2, unit: 'pg/mL' },
  t3_libre: { min: 2.3, max: 4.2, unit: 'pg/mL' },
  't4_total': { min: 4.5, max: 12.0, unit: 'μg/dL' },
  t4_total: { min: 4.5, max: 12.0, unit: 'μg/dL' },
  't3_total': { min: 80, max: 200, unit: 'ng/dL' },
  t3_total: { min: 80, max: 200, unit: 'ng/dL' },
  'anticuerpos_anti_tpo': { min: 0, max: 60, unit: 'UI/mL' },
  'anticuerpos_anti_tiroglobulina': { min: 0, max: 40, unit: 'UI/mL' },
  
  // Perfil lipídico
  trigliceridos: { min: 0, max: 150, unit: 'mg/dL' }, // Ya incluido arriba
  'relacion_colesterol_total_hdl': { min: 0, max: 5, unit: 'ratio' }, // Optimo: <5
  'apolipoproteina_a1': { min: 100, max: 200, unit: 'mg/dL' },
  'apolipoproteina_b': { min: 60, max: 130, unit: 'mg/dL' },
  
  // HbA1c
  hba1c: { min: 4.0, max: 5.6, unit: '%' }, // Normal: <5.7%
  'hba1c': { min: 4.0, max: 5.6, unit: '%' },
  glucosa_promedio_estimada: { min: 70, max: 117, unit: 'mg/dL' },
  
  // Función renal
  'tasa_de_filtracion_glomerular_estimada_tfg': { min: 90, max: 120, unit: 'mL/min/1.73m²' },
  tfg: { min: 90, max: 120, unit: 'mL/min/1.73m²' },
  'sodio_na': { min: 136, max: 145, unit: 'mEq/L' },
  sodio_na: { min: 136, max: 145, unit: 'mEq/L' },
  sodio: { min: 136, max: 145, unit: 'mEq/L' },
  'potasio_k': { min: 3.5, max: 5.0, unit: 'mEq/L' },
  potasio_k: { min: 3.5, max: 5.0, unit: 'mEq/L' },
  potasio: { min: 3.5, max: 5.0, unit: 'mEq/L' },
  'cloro_cl': { min: 98, max: 107, unit: 'mEq/L' },
  cloro_cl: { min: 98, max: 107, unit: 'mEq/L' },
  cloro: { min: 98, max: 107, unit: 'mEq/L' },
  fosforo: { min: 2.5, max: 4.5, unit: 'mg/dL' },
  calcio: { min: 8.5, max: 10.5, unit: 'mg/dL' },
  magnesio: { min: 1.8, max: 2.4, unit: 'mg/dL' },
  
  // Función hepática
  'ggt_gamma_glutamil_transferasa': { min: 0, max: 40, unit: 'U/L' },
  ggt: { min: 0, max: 40, unit: 'U/L' },
  'tiempo_de_protrombina_tp': { min: 11, max: 13.5, unit: 'segundos' },
  tiempo_protrombina_tp: { min: 11, max: 13.5, unit: 'segundos' },
  'tiempo_de_protrombina': { min: 11, max: 13.5, unit: 'segundos' },
  inr: { min: 0.9, max: 1.1, unit: 'ratio' },
  'inr_razon_normalizada_internacional': { min: 0.9, max: 1.1, unit: 'ratio' },
  
  // Coagulación
  'tpt_tiempo_de_tromboplastina_parcial': { min: 25, max: 35, unit: 'segundos' },
  tpt: { min: 25, max: 35, unit: 'segundos' },
  fibrinogeno: { min: 200, max: 400, unit: 'mg/dL' },
  tiempo_sangrado: { min: 1, max: 3, unit: 'minutos' },
  tiempo_coagulacion: { min: 5, max: 10, unit: 'minutos' },
  
  // Perfil de anemias
  hierro_serico: { min: 50, max: 170, unit: 'μg/dL' }, // Mujer
  ferritina: { min: 15, max: 150, unit: 'ng/mL' }, // Mujer
  transferrina: { min: 200, max: 400, unit: 'mg/dL' },
  'saturacion_de_transferrina': { min: 15, max: 50, unit: '%' },
  saturacion_transferrina: { min: 15, max: 50, unit: '%' },
  'tibc_capacidad_total_de_union_del_hierro': { min: 250, max: 400, unit: 'μg/dL' },
  tibc: { min: 250, max: 400, unit: 'μg/dL' },
  acido_folico: { min: 3.0, max: 17.0, unit: 'ng/mL' },
  vitamina_b12: { min: 200, max: 900, unit: 'pg/mL' },
  
  // Marcadores tumorales (agregados de vuelta)
  psa_antigeno_prostatico_especifico: { min: 0, max: 4, unit: 'ng/mL' },
  'cea_antigeno_carcinoembrionario': { min: 0, max: 3, unit: 'ng/mL' },
  'ca_199': { min: 0, max: 37, unit: 'U/mL' },
  'ca_125': { min: 0, max: 35, unit: 'U/mL' },
  'ca_153': { min: 0, max: 30, unit: 'U/mL' },
  'afp_alfa_fetoproteina': { min: 0, max: 7, unit: 'ng/mL' },
  'beta_hcg': { min: 0, max: 5, unit: 'mUI/mL' },
};

// Función para obtener el rango normal de un parámetro
export const getNormalRange = (parameterKey) => {
  return normalRanges[parameterKey] || null;
};

// Función para verificar si un valor está fuera de rango
export const isOutOfRange = (parameterKey, value) => {
  const range = getNormalRange(parameterKey);
  if (!range || value === null || value === undefined || value === '') {
    return false;
  }
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return false;
  
  return numValue < range.min || numValue > range.max;
};

// Función para obtener el nivel de alerta (0: normal, 1: precaución, 2: alerta)
export const getAlertLevel = (parameterKey, value) => {
  if (!isOutOfRange(parameterKey, value)) return 0;
  
  const range = getNormalRange(parameterKey);
  if (!range) return 0;
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 0;
  
  // Calcular desviación porcentual
  const mean = (range.min + range.max) / 2;
  if (mean === 0) return 1; // Evitar división por cero
  
  const deviation = Math.abs(numValue - mean) / mean;
  
  if (deviation > 0.3) return 2; // Alerta alta (>30% desviación)
  return 1; // Precaución
};

// Función para obtener el color según el nivel de alerta
export const getAlertColor = (alertLevel) => {
  switch (alertLevel) {
    case 0:
      return 'text-green-600';
    case 1:
      return 'text-yellow-600';
    case 2:
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

// =================================================================
// FUNCIONES PARA RANGOS PERSONALIZADOS BASADOS EN OMS
// =================================================================

/**
 * Calcula la edad en años desde la fecha de nacimiento
 */
export const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

/**
 * Calcula el rango normal de peso según OMS basado en altura y sexo
 * Fórmula: IMC normal * altura^2 (en metros)
 * Considera embarazo si aplica
 */
export const getNormalWeightRange = (heightCm, gender, isPregnant = false) => {
  if (!heightCm || heightCm <= 0) return null;
  
  const heightM = heightCm / 100;
  
  // IMC normal según OMS: 18.5 - 24.9 kg/m²
  // Durante embarazo: se acepta aumento adicional de peso según trimestre
  let minIMC = 18.5;
  let maxIMC = 24.9;
  
  if (isPregnant) {
    // Durante embarazo, el aumento de peso es esperado y saludable
    // OMS: aumento normal 11.5-16 kg para IMC normal pre-embarazo
    // Para rangos, ampliamos ligeramente el máximo
    maxIMC = 27.0; // Permite ganancia de peso gestacional
  }
  
  const minWeight = minIMC * (heightM * heightM);
  const maxWeight = maxIMC * (heightM * heightM);
  
  return {
    min: Math.round(minWeight * 10) / 10,
    max: Math.round(maxWeight * 10) / 10,
    unit: 'kg'
  };
};

/**
 * Calcula el rango normal de presión arterial según edad y sexo (OMS/AHA)
 * Considera embarazo si aplica
 */
export const getNormalBloodPressureRange = (age, gender, isPregnant = false) => {
  if (!age || age < 0) return null;
  
  // Presión arterial normal según AHA 2017 y OMS
  // Para adultos: <120/80 es normal
  // Para adolescentes (13-19): ligeramente más bajo
  // Para niños: varía según edad
  // Durante embarazo: presión puede ser ligeramente más baja en segundo trimestre
  
  if (age < 13) {
    // Niños: fórmula simplificada (90 + edad en años) / (50 + edad en años)
    const systolicMin = Math.max(70, 90 + age);
    const systolicMax = 90 + (age * 2);
    const diastolicMin = Math.max(40, 50 + age);
    const diastolicMax = 70 + age;
    return {
      systolic: { min: systolicMin, max: systolicMax, unit: 'mmHg' },
      diastolic: { min: diastolicMin, max: diastolicMax, unit: 'mmHg' }
    };
  } else if (age < 18) {
    // Adolescentes
    return {
      systolic: { min: 90, max: 120, unit: 'mmHg' },
      diastolic: { min: 50, max: 80, unit: 'mmHg' }
    };
  } else {
    // Adultos (OMS: normal <120/80)
    // Durante embarazo: presión sistólica puede ser ligeramente más baja (85-115)
    if (isPregnant) {
      return {
        systolic: { min: 85, max: 115, unit: 'mmHg' },
        diastolic: { min: 55, max: 75, unit: 'mmHg' }
      };
    }
    return {
      systolic: { min: 90, max: 120, unit: 'mmHg' },
      diastolic: { min: 60, max: 80, unit: 'mmHg' }
    };
  }
};

/**
 * Calcula el rango normal de talla/altura según edad y género según OMS
 * Basado en tablas de crecimiento OMS y percentiles normales
 */
export const getNormalHeightRange = (age, gender) => {
  if (age === null || age < 0) return null;
  
  const isMale = gender && (gender.includes('masculino') || gender.includes('m') || gender.includes('hombre'));
  const isFemale = gender && (gender.includes('femenino') || gender.includes('f') || gender.includes('mujer'));
  
  // Rangos según OMS basados en percentiles 3-97 (rango normal)
  // Para adultos (18+ años), la altura es relativamente estable
  if (age >= 18) {
    // Adultos: rangos basados en poblaciones adultas según OMS
    // Varía ligeramente por región, pero para población mexicana/latinoamericana:
    if (isMale) {
      // Hombres adultos: percentil 3-97 aproximado
      return { min: 155, max: 185, unit: 'cm' };
    } else if (isFemale) {
      // Mujeres adultas: percentil 3-97 aproximado
      return { min: 145, max: 175, unit: 'cm' };
    } else {
      // Sin género: rango más amplio
      return { min: 145, max: 185, unit: 'cm' };
    }
  } else if (age >= 16) {
    // Adolescentes mayores (16-17 años) - casi adultos
    if (isMale) {
      return { min: 155, max: 185, unit: 'cm' };
    } else if (isFemale) {
      return { min: 150, max: 175, unit: 'cm' };
    } else {
      return { min: 150, max: 185, unit: 'cm' };
    }
  } else if (age >= 13) {
    // Adolescentes (13-15 años)
    if (isMale) {
      return { min: 145, max: 180, unit: 'cm' };
    } else if (isFemale) {
      return { min: 145, max: 170, unit: 'cm' };
    } else {
      return { min: 145, max: 180, unit: 'cm' };
    }
  } else if (age >= 10) {
    // Pre-adolescentes (10-12 años)
    if (isMale) {
      return { min: 130, max: 165, unit: 'cm' };
    } else if (isFemale) {
      return { min: 130, max: 165, unit: 'cm' };
    } else {
      return { min: 130, max: 165, unit: 'cm' };
    }
  } else if (age >= 5) {
    // Niños (5-9 años)
    if (isMale) {
      return { min: 105, max: 140, unit: 'cm' };
    } else if (isFemale) {
      return { min: 105, max: 140, unit: 'cm' };
    } else {
      return { min: 105, max: 140, unit: 'cm' };
    }
  } else if (age >= 2) {
    // Niños pequeños (2-4 años)
    if (isMale) {
      return { min: 80, max: 110, unit: 'cm' };
    } else if (isFemale) {
      return { min: 78, max: 108, unit: 'cm' };
    } else {
      return { min: 78, max: 110, unit: 'cm' };
    }
  } else {
    // Bebés (0-2 años) - varía mucho mes a mes
    if (isMale) {
      return { min: 45, max: 95, unit: 'cm' };
    } else if (isFemale) {
      return { min: 45, max: 93, unit: 'cm' };
    } else {
      return { min: 45, max: 95, unit: 'cm' };
    }
  }
};

/**
 * Calcula el rango normal de frecuencia cardíaca según edad
 */
export const getNormalHeartRateRange = (age) => {
  if (!age || age < 0) return null;
  
  if (age < 1) {
    return { min: 100, max: 160, unit: 'lpm' }; // Lactantes
  } else if (age < 3) {
    return { min: 90, max: 150, unit: 'lpm' }; // Bebés
  } else if (age < 10) {
    return { min: 70, max: 120, unit: 'lpm' }; // Niños
  } else if (age < 18) {
    return { min: 60, max: 100, unit: 'lpm' }; // Adolescentes
  } else {
    return { min: 60, max: 100, unit: 'lpm' }; // Adultos
  }
};

/**
 * Calcula el rango normal de circunferencia abdominal según sexo (OMS)
 */
export const getNormalWaistCircumferenceRange = (gender) => {
  if (!gender) return null;
  
  const genderLower = gender.toLowerCase();
  if (genderLower.includes('mujer') || genderLower.includes('femenino') || genderLower.includes('f')) {
    // Mujer: riesgo moderado <80cm, riesgo alto >88cm
    return { min: 70, max: 80, unit: 'cm' };
  } else {
    // Hombre: riesgo moderado <94cm, riesgo alto >102cm
    return { min: 80, max: 94, unit: 'cm' };
  }
};

/**
 * Busca un valor en múltiples consultas (formData array), retornando el más reciente
 */
const findValueInMultipleConsultations = (consultations, searchKeys, parseAsNumber = false) => {
  if (!consultations || !Array.isArray(consultations)) return null;
  
  // Buscar en orden inverso (más reciente primero)
  for (const consultation of [...consultations].reverse()) {
    if (!consultation.formData) continue;
    
    for (const key of Object.keys(consultation.formData)) {
      const lowerKey = key.toLowerCase();
      const matches = searchKeys.some(searchKey => {
        if (Array.isArray(searchKey)) {
          return searchKey.every(sk => lowerKey.includes(sk));
        }
        return lowerKey.includes(searchKey);
      });
      
      if (matches) {
        const value = consultation.formData[key];
        if (parseAsNumber) {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) return parsed;
        } else if (value) {
          return value;
        }
      }
    }
  }
  return null;
};

/**
 * Obtiene el rango normal personalizado según características del paciente
 * Busca en TODO el historial clínico para usar múltiples variables y acotar mejor los rangos según OMS
 * @param {string} parameterKey - Clave normalizada del parámetro
 * @param {Object} patientInfo - Información del paciente { dateOfBirth, gender, height, weight, biologicalSex, age, isPregnant }
 * @param {Object} formData - Datos del formulario de la consulta actual (opcional, para compatibilidad)
 * @param {Array} allConsultations - Array de todas las consultas del paciente para buscar en todo el historial
 * @returns {Object|null} - Rango normal personalizado o null
 */
export const getPersonalizedNormalRange = (parameterKey, patientInfo, formData = null, allConsultations = null) => {
  // Estrategia: buscar en TODAS las consultas disponibles para obtener el valor más reciente de cada variable
  // Esto permite usar múltiples variables para acotar mejor los rangos según OMS
  
  let biologicalSex = null;
  let age = null;
  let height = null;
  let weight = null;
  let waistCircumference = null;
  let saturation = null;
  let isPregnant = false;
  
  // Si hay múltiples consultas, buscar en todas ellas
  if (allConsultations && Array.isArray(allConsultations) && allConsultations.length > 0) {
    biologicalSex = findValueInMultipleConsultations(
      allConsultations,
      [['sexo', 'biológico'], 'sexo_biologico', 'sexo']
    );
    age = findValueInMultipleConsultations(
      allConsultations,
      ['edad'],
      true
    );
    height = findValueInMultipleConsultations(
      allConsultations,
      ['talla', 'altura'],
      true
    );
    weight = findValueInMultipleConsultations(
      allConsultations,
      [['peso'], ['peso', 'ideal']],
      true
    );
    waistCircumference = findValueInMultipleConsultations(
      allConsultations,
      ['circunferencia', 'abdominal', 'cintura'],
      true
    );
    saturation = findValueInMultipleConsultations(
      allConsultations,
      ['saturación', 'oxigeno', 'spo2', 'saturacion'],
      true
    );
    const pregnancyValue = findValueInMultipleConsultations(
      allConsultations,
      ['embarazo']
    );
    if (pregnancyValue) {
      const value = String(pregnancyValue).toLowerCase();
      isPregnant = value.includes('sí') || value.includes('si') || value === 'yes' || value === 'true';
    }
  }
  
  // Si no hay datos en consultas múltiples, intentar con formData individual
  if (!biologicalSex && formData) {
    Object.keys(formData).forEach(key => {
      const lowerKey = key.toLowerCase();
      if ((lowerKey.includes('sexo') && lowerKey.includes('biológico')) || lowerKey.includes('sexo_biologico')) {
        biologicalSex = formData[key];
      }
      if (lowerKey === 'edad' || lowerKey.includes('edad')) {
        const value = parseFloat(formData[key]);
        if (!isNaN(value)) age = value;
      }
      if (lowerKey === 'talla' || lowerKey.includes('talla') || lowerKey.includes('altura')) {
        const value = parseFloat(formData[key]);
        if (!isNaN(value)) height = value;
      }
      if (lowerKey === 'peso' && !lowerKey.includes('ideal')) {
        const value = parseFloat(formData[key]);
        if (!isNaN(value)) weight = value;
      }
      if (lowerKey.includes('circunferencia') || lowerKey.includes('abdominal') || lowerKey.includes('cintura')) {
        const value = parseFloat(formData[key]);
        if (!isNaN(value)) waistCircumference = value;
      }
      if (lowerKey.includes('saturación') || lowerKey.includes('oxigeno') || lowerKey.includes('spo2') || lowerKey.includes('saturacion')) {
        const value = parseFloat(formData[key]);
        if (!isNaN(value)) saturation = value;
      }
      if (lowerKey.includes('embarazo')) {
        const value = String(formData[key]).toLowerCase();
        isPregnant = value.includes('sí') || value.includes('si') || value === 'yes' || value === 'true';
      }
    });
  }
  
  // Si aún no hay datos, usar patientInfo como respaldo
  if (!biologicalSex && patientInfo) {
    biologicalSex = patientInfo.biologicalSex || patientInfo.gender || '';
  }
  if (age === null && patientInfo && patientInfo.dateOfBirth) {
    age = calculateAge(patientInfo.dateOfBirth);
  }
  if (!height && patientInfo) {
    height = patientInfo.height;
  }
  if (!weight && patientInfo) {
    weight = patientInfo.weight;
  }
  
  // Para algunos parámetros, no necesitamos género ni edad (ej: saturación)
  // Pero para la mayoría sí, así que mantenemos esta validación
  const needsBasicInfo = !parameterKey.includes('saturacion') && !parameterKey.includes('temperatura');
  if (needsBasicInfo && !biologicalSex && age === null) return null;
  
  // Normalizar sexo biológico
  const gender = biologicalSex ? String(biologicalSex).toLowerCase() : '';
  const isMale = gender.includes('masculino') || gender.includes('m') || gender.includes('hombre');
  const isFemale = gender.includes('femenino') || gender.includes('f') || gender.includes('mujer');
  
  // Normalizar el parámetro
  const normalizedKey = parameterKey.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '');
  
  // Rangos personalizados según OMS - usando múltiples variables cuando están disponibles
  
  // TALLA/ALTURA: usar edad y género según tablas OMS
  if (normalizedKey.includes('talla') || normalizedKey.includes('altura')) {
    if (age !== null) {
      return getNormalHeightRange(age, gender);
    }
    // Si no hay edad, no retornar rango genérico muy amplio
    return null;
  }
  
  // PESO: usar altura (IMC) y considerar género/embarazo
  if (normalizedKey.includes('peso') || normalizedKey === 'peso') {
    if (height) {
      return getNormalWeightRange(height, gender, isPregnant);
    }
    // Si no hay altura, no usar rango genérico erróneo
    return null;
  }
  
  if (normalizedKey.includes('presion_arterial_sistolica') || normalizedKey.includes('presion_sistolica')) {
    if (age !== null) {
      const bpRange = getNormalBloodPressureRange(age, gender, isPregnant);
      return bpRange ? bpRange.systolic : null;
    }
  }
  
  if (normalizedKey.includes('presion_arterial_diastolica') || normalizedKey.includes('presion_diastolica')) {
    if (age !== null) {
      const bpRange = getNormalBloodPressureRange(age, gender, isPregnant);
      return bpRange ? bpRange.diastolic : null;
    }
  }
  
  if (normalizedKey.includes('frecuencia_cardiaca') || normalizedKey.includes('frecuencia_cardiac')) {
    if (age !== null) {
      const range = getNormalHeartRateRange(age);
      // Durante embarazo, frecuencia cardíaca puede ser ligeramente más alta
      if (range && isPregnant) {
        return {
          min: range.min,
          max: Math.min(range.max + 10, 110), // Aumento normal durante embarazo
          unit: range.unit
        };
      }
      return range;
    }
  }
  
  if (normalizedKey.includes('circunferencia_abdominal') || normalizedKey.includes('cintura')) {
    if (gender) {
      // Durante embarazo, circunferencia abdominal aumenta normalmente
      if (isPregnant) {
        return { min: 70, max: 120, unit: 'cm' }; // Rango amplio durante embarazo
      }
      return getNormalWaistCircumferenceRange(gender);
    }
  }
  
  // Si no hay rango personalizado, usar el genérico
  return getNormalRange(normalizedKey);
};