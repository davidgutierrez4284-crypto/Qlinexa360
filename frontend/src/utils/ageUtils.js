/**
 * Utilidades para cálculo y formato de edad.
 * Soporta DD/MM/YYYY, YYYY-MM-DD (ISO) y objetos Date.
 */

function parseDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  const str = String(dateInput).trim();
  if (!str) return null;

  // ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return isNaN(date.getTime()) ? null : date;
  }

  // DD/MM/YYYY
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Calcula la edad en años y meses desde la fecha de nacimiento hasta hoy.
 * @param {string|Date} dateOfBirth - Fecha de nacimiento
 * @returns {string} "X años y Y meses", "X años", "Y meses" o "1 mes" / "1 año"
 */
export function calculateAge(dateOfBirth) {
  const dob = parseDate(dateOfBirth);
  if (!dob) return '';

  const today = new Date();
  if (dob > today) return '';

  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();

  if (months < 0) {
    years--;
    months += 12;
  }
  if (today.getDate() < dob.getDate()) {
    months--;
    if (months < 0) {
      years--;
      months += 12;
    }
  }

  if (years === 0) {
    return months === 1 ? '1 mes' : `${months} meses`;
  }
  if (months === 0) {
    return years === 1 ? '1 año' : `${years} años`;
  }
  const yearsStr = years === 1 ? '1 año' : `${years} años`;
  const monthsStr = months === 1 ? '1 mes' : `${months} meses`;
  return `${yearsStr} y ${monthsStr}`;
}

/**
 * Formatea la edad para mostrar entre paréntesis.
 * @param {string|Date} dateOfBirth - Fecha de nacimiento
 * @returns {string} "(X años y Y meses)" o ""
 */
export function formatAgeForDisplay(dateOfBirth) {
  const age = calculateAge(dateOfBirth);
  return age ? `(${age})` : '';
}

/**
 * Fecha de nacimiento solo para lectura (día civil), sin desfase por zona horaria.
 * Evita mostrar un día menos cuando el backend envía ISO a medianoche UTC (p. ej. 1982-12-29T00:00:00.000Z en México → 28/12).
 */
export function formatDateOfBirthDisplay(dateInput) {
  if (dateInput == null || dateInput === '') return '';
  const str = String(dateInput).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, mo, d] = isoMatch;
    return `${d}/${mo}/${y}`;
  }
  const parsed = parseDate(dateInput);
  if (!parsed) return str;
  const day = parsed.getDate().toString().padStart(2, '0');
  const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}/${parsed.getFullYear()}`;
}

/**
 * Devuelve la edad en años (número) para cálculos médicos.
 * @param {string|Date} dateOfBirth - Fecha de nacimiento
 * @returns {number|null}
 */
export function getAgeInYears(dateOfBirth) {
  const dob = parseDate(dateOfBirth);
  if (!dob) return null;
  const today = new Date();
  if (dob > today) return null;
  let years = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) years--;
  return years;
}

/**
 * Formatea un valor de edad almacenado (meses o años) como "X años y Y meses".
 * Compatible con datos antiguos: si el valor es entero 1-25, se interpreta como años.
 * Si el valor es > 25, se interpreta como meses totales.
 * @param {string|number} value - Valor almacenado (meses o años en formato legacy)
 * @returns {string} "X años y Y meses", "X años", "Y meses" o ""
 */
export function formatAgeFieldValue(value) {
  if (value == null || value === '') return '';
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return '';
  const intVal = parseInt(value, 10);
  // Datos legacy: entero 1-25 se interpretó como años
  const totalMonths = (intVal === num && num >= 1 && num <= 25) ? num * 12 : num;
  const months = Math.round(totalMonths);
  const years = Math.floor(months / 12);
  const monthsPart = months % 12;
  if (years === 0) {
    return monthsPart === 1 ? '1 mes' : `${monthsPart} meses`;
  }
  if (monthsPart === 0) {
    return years === 1 ? '1 año' : `${years} años`;
  }
  const yearsStr = years === 1 ? '1 año' : `${years} años`;
  const monthsStr = monthsPart === 1 ? '1 mes' : `${monthsPart} meses`;
  return `${yearsStr} y ${monthsStr}`;
}

/** Convierte años y meses a meses totales para almacenar */
export function ageToMonths(years, months) {
  const y = parseInt(years, 10) || 0;
  const m = parseInt(months, 10) || 0;
  return y * 12 + m;
}

/** Parsea valor almacenado (meses o años legacy) a { years, months } */
export function parseAgeFieldValue(value) {
  if (value == null || value === '') return { years: '', months: '' };
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return { years: '', months: '' };
  const intVal = parseInt(value, 10);
  const totalMonths = (intVal === num && num >= 1 && num <= 25) ? num * 12 : num;
  const months = Math.round(totalMonths);
  return { years: Math.floor(months / 12), months: months % 12 };
}

/** Devuelve la edad en años (decimal) para cálculos médicos (percentiles, etc.) */
export function getAgeInYearsFromFieldValue(value) {
  if (value == null || value === '') return null;
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return null;
  const intVal = parseInt(value, 10);
  const totalMonths = (intVal === num && num >= 1 && num <= 25) ? num * 12 : num;
  return Math.round(totalMonths) / 12;
}
