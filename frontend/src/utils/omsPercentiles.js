/**
 * Cálculo de percentiles OMS para gráficas de crecimiento
 * Basado en estándares de crecimiento OMS (WHO Growth Standards)
 * 
 * Nota: Estos son valores aproximados basados en tablas OMS públicas.
 * Para uso clínico real, se recomienda usar las tablas oficiales OMS.
 */

/**
 * Calcula percentiles de peso según edad y género (OMS)
 * @param {number} age - Edad en años
 * @param {string} gender - Género ('masculino'/'femenino' o 'm'/'f')
 * @returns {Object} - Objeto con percentiles 3, 10, 25, 50, 75, 90, 97
 */
export const getWeightPercentiles = (age, gender) => {
  if (age < 0 || age > 19) return null;
  
  const isMale = gender && (gender.includes('masculino') || gender.includes('m') || gender.includes('hombre'));
  
  // Valores aproximados basados en tablas OMS
  // Para uso real, se deberían usar tablas completas de la OMS
  const percentiles = {
    p3: null,
    p10: null,
    p25: null,
    p50: null,
    p75: null,
    p90: null,
    p97: null
  };
  
  // Aproximación basada en fórmulas OMS simplificadas
  // Para edades 0-5 años: uso de estándares OMS directos
  // Para edades 5-19: uso de referencias OMS extendidas
  
  if (age <= 5) {
    // Niños pequeños (0-5 años) - OMS Growth Standards
    if (isMale) {
      // Fórmulas aproximadas para niños
      const base = 7 + (age * 2.5);
      percentiles.p3 = base * 0.75;
      percentiles.p10 = base * 0.85;
      percentiles.p25 = base * 0.92;
      percentiles.p50 = base;
      percentiles.p75 = base * 1.08;
      percentiles.p90 = base * 1.15;
      percentiles.p97 = base * 1.25;
    } else {
      // Fórmulas aproximadas para niñas
      const base = 6.5 + (age * 2.3);
      percentiles.p3 = base * 0.75;
      percentiles.p10 = base * 0.85;
      percentiles.p25 = base * 0.92;
      percentiles.p50 = base;
      percentiles.p75 = base * 1.08;
      percentiles.p90 = base * 1.15;
      percentiles.p97 = base * 1.25;
    }
  } else if (age <= 19) {
    // Niños mayores y adolescentes (5-19 años) - OMS Growth References
    if (isMale) {
      const base = 20 + (age - 5) * 3.5;
      percentiles.p3 = base * 0.75;
      percentiles.p10 = base * 0.85;
      percentiles.p25 = base * 0.92;
      percentiles.p50 = base;
      percentiles.p75 = base * 1.08;
      percentiles.p90 = base * 1.15;
      percentiles.p97 = base * 1.25;
    } else {
      const base = 19 + (age - 5) * 3.2;
      percentiles.p3 = base * 0.75;
      percentiles.p10 = base * 0.85;
      percentiles.p25 = base * 0.92;
      percentiles.p50 = base;
      percentiles.p75 = base * 1.08;
      percentiles.p90 = base * 1.15;
      percentiles.p97 = base * 1.25;
    }
  }
  
  return percentiles;
};

/**
 * Calcula percentiles de talla/altura según edad y género (OMS)
 * @param {number} age - Edad en años
 * @param {string} gender - Género ('masculino'/'femenino' o 'm'/'f')
 * @returns {Object} - Objeto con percentiles 3, 10, 25, 50, 75, 90, 97 en cm
 */
export const getHeightPercentiles = (age, gender) => {
  if (age < 0 || age > 19) return null;
  
  const isMale = gender && (gender.includes('masculino') || gender.includes('m') || gender.includes('hombre'));
  
  const percentiles = {
    p3: null,
    p10: null,
    p25: null,
    p50: null,
    p75: null,
    p90: null,
    p97: null
  };
  
  if (age <= 5) {
    // Niños pequeños (0-5 años)
    if (isMale) {
      const base = 50 + (age * 12);
      percentiles.p3 = base * 0.92;
      percentiles.p10 = base * 0.94;
      percentiles.p25 = base * 0.96;
      percentiles.p50 = base;
      percentiles.p75 = base * 1.04;
      percentiles.p90 = base * 1.06;
      percentiles.p97 = base * 1.08;
    } else {
      const base = 49 + (age * 11.5);
      percentiles.p3 = base * 0.92;
      percentiles.p10 = base * 0.94;
      percentiles.p25 = base * 0.96;
      percentiles.p50 = base;
      percentiles.p75 = base * 1.04;
      percentiles.p90 = base * 1.06;
      percentiles.p97 = base * 1.08;
    }
  } else if (age <= 19) {
    // Niños mayores y adolescentes (5-19 años)
    if (isMale) {
      const base = 110 + (age - 5) * 6;
      percentiles.p3 = base * 0.92;
      percentiles.p10 = base * 0.94;
      percentiles.p25 = base * 0.96;
      percentiles.p50 = base;
      percentiles.p75 = base * 1.04;
      percentiles.p90 = base * 1.06;
      percentiles.p97 = base * 1.08;
    } else {
      const base = 108 + (age - 5) * 5.5;
      percentiles.p3 = base * 0.92;
      percentiles.p10 = base * 0.94;
      percentiles.p25 = base * 0.96;
      percentiles.p50 = base;
      percentiles.p75 = base * 1.04;
      percentiles.p90 = base * 1.06;
      percentiles.p97 = base * 1.08;
    }
  }
  
  return percentiles;
};

/**
 * Calcula percentiles de IMC según edad y género (OMS)
 * @param {number} age - Edad en años
 * @param {string} gender - Género ('masculino'/'femenino' o 'm'/'f')
 * @returns {Object} - Objeto con percentiles 3, 10, 25, 50, 75, 90, 97
 */
export const getBMIPercentiles = (age, gender) => {
  if (age < 0 || age > 19) return null;
  
  const isMale = gender && (gender.includes('masculino') || gender.includes('m') || gender.includes('hombre'));
  
  const percentiles = {
    p3: null,
    p10: null,
    p25: null,
    p50: null,
    p75: null,
    p90: null,
    p97: null
  };
  
  // IMC varía menos con la edad pero tiene patrones específicos
  if (age <= 5) {
    if (isMale) {
      percentiles.p3 = 13.5;
      percentiles.p10 = 14.0;
      percentiles.p25 = 14.5;
      percentiles.p50 = 15.5;
      percentiles.p75 = 16.5;
      percentiles.p90 = 17.5;
      percentiles.p97 = 18.5;
    } else {
      percentiles.p3 = 13.2;
      percentiles.p10 = 13.8;
      percentiles.p25 = 14.3;
      percentiles.p50 = 15.3;
      percentiles.p75 = 16.3;
      percentiles.p90 = 17.3;
      percentiles.p97 = 18.2;
    }
  } else if (age <= 19) {
    // IMC aumenta gradualmente con la edad
    const baseAge = age - 5;
    if (isMale) {
      const base = 15.5 + (baseAge * 0.3);
      percentiles.p3 = base - 2;
      percentiles.p10 = base - 1.5;
      percentiles.p25 = base - 1;
      percentiles.p50 = base;
      percentiles.p75 = base + 1;
      percentiles.p90 = base + 2;
      percentiles.p97 = base + 3.5;
    } else {
      const base = 15.3 + (baseAge * 0.25);
      percentiles.p3 = base - 2;
      percentiles.p10 = base - 1.5;
      percentiles.p25 = base - 1;
      percentiles.p50 = base;
      percentiles.p75 = base + 1;
      percentiles.p90 = base + 2;
      percentiles.p97 = base + 3.5;
    }
  }
  
  return percentiles;
};

/**
 * Determina el percentil aproximado en el que se encuentra un valor
 * @param {number} value - Valor a evaluar
 * @param {Object} percentiles - Objeto con percentiles
 * @returns {number} - Percentil aproximado (3, 10, 25, 50, 75, 90, 97)
 */
export const getPercentileForValue = (value, percentiles) => {
  if (!percentiles || value === null || value === undefined) return null;
  
  if (value <= percentiles.p3) return 3;
  if (value <= percentiles.p10) return 10;
  if (value <= percentiles.p25) return 25;
  if (value <= percentiles.p50) return 50;
  if (value <= percentiles.p75) return 75;
  if (value <= percentiles.p90) return 90;
  if (value <= percentiles.p97) return 97;
  return 97; // Por encima del percentil 97
};

/**
 * Obtiene el color según el percentil (para visualización)
 * @param {number} percentile - Percentil (3-97)
 * @returns {string} - Color en formato hex
 */
export const getPercentileColor = (percentile) => {
  if (percentile <= 3) return '#ef4444'; // Rojo - muy bajo
  if (percentile <= 10) return '#f59e0b'; // Naranja - bajo
  if (percentile <= 25) return '#eab308'; // Amarillo - bajo-normal
  if (percentile <= 75) return '#10b981'; // Verde - normal
  if (percentile <= 90) return '#eab308'; // Amarillo - alto-normal
  if (percentile <= 97) return '#f59e0b'; // Naranja - alto
  return '#ef4444'; // Rojo - muy alto
};

/**
 * Obtiene el color de zona según percentiles (para áreas sombreadas)
 * @param {string} zone - Zona ('very-low', 'low', 'normal', 'high', 'very-high')
 * @returns {string} - Color con opacidad
 */
export const getPercentileZoneColor = (zone) => {
  const colors = {
    'very-low': 'rgba(239, 68, 68, 0.15)', // Rojo claro
    'low': 'rgba(245, 158, 11, 0.15)', // Naranja claro
    'normal': 'rgba(16, 185, 129, 0.2)', // Verde claro
    'high': 'rgba(245, 158, 11, 0.15)', // Naranja claro
    'very-high': 'rgba(239, 68, 68, 0.15)' // Rojo claro
  };
  return colors[zone] || colors.normal;
};

