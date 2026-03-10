/**
 * Cálculos médicos automáticos para formularios de especialidad.
 */

/**
 * Calcula el IMC (Índice de Masa Corporal).
 * @param {number} peso - Peso en kg
 * @param {number} talla - Talla en cm (si > 3 se asume cm, si <= 3 se asume metros)
 * @returns {string|null} IMC con 1 decimal o null si no se puede calcular
 */
export function imc(peso, talla) {
  if (peso == null || talla == null || peso <= 0 || talla <= 0) return null;
  const p = parseFloat(peso);
  const t = parseFloat(talla);
  if (isNaN(p) || isNaN(t)) return null;
  const tallaM = t > 3 ? t / 100 : t;
  const result = p / (tallaM * tallaM);
  return result.toFixed(1);
}

/**
 * Calcula la superficie corporal (fórmula de Mosteller).
 * @param {number} peso - Peso en kg
 * @param {number} talla - Talla en cm
 * @returns {string|null} Superficie corporal en m² con 2 decimales
 */
export function superficieCorporal(peso, talla) {
  if (peso == null || talla == null || peso <= 0 || talla <= 0) return null;
  const p = parseFloat(peso);
  const t = parseFloat(talla);
  if (isNaN(p) || isNaN(t)) return null;
  const tallaCm = t > 3 ? t : t * 100;
  const sc = 0.007184 * Math.pow(p, 0.425) * Math.pow(tallaCm, 0.725);
  return sc.toFixed(2);
}

/**
 * Calcula la presión arterial media.
 * @param {number} pas - Presión arterial sistólica (mmHg)
 * @param {number} pad - Presión arterial diastólica (mmHg)
 * @returns {string|null} PAM en mmHg
 */
export function presionArterialMedia(pas, pad) {
  if (pas == null || pad == null) return null;
  const s = parseFloat(pas);
  const d = parseFloat(pad);
  if (isNaN(s) || isNaN(d)) return null;
  return ((s + 2 * d) / 3).toFixed(0);
}

/**
 * Obtiene el valor numérico de formData para un campo por su label normalizado.
 * @param {Object} formData - Datos del formulario { fieldId: value }
 * @param {Array} fields - Array de { id, label }
 * @param {string} labelMatch - Label a buscar (ej: "Peso", "Talla")
 * @returns {number|null}
 */
export function getNumericValueByLabel(formData, fields, labelMatch) {
  const field = fields.find(f => 
    f.label && f.label.toLowerCase().trim().includes(labelMatch.toLowerCase())
  );
  if (!field) return null;
  const val = formData[field.id];
  if (val === undefined || val === '' || val === null) return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}
