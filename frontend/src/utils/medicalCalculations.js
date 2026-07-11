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

/**
 * Aplica campos calculados (IMC, PAM) sobre datos de plantilla de especialidad.
 * Misma lógica que SmartForm en consultas.
 */
export function applySpecialtyFormComputations(formData, fields = []) {
  if (!formData || !Array.isArray(fields) || fields.length === 0) return formData || {};
  let newData = { ...formData };

  const pesoVal = getNumericValueByLabel(newData, fields, 'peso');
  const tallaVal = getNumericValueByLabel(newData, fields, 'talla');
  const imcField = fields.find((f) => f.label && /imc|índice de masa corporal/i.test(f.label));
  if (pesoVal && tallaVal && imcField) {
    const calculated = imc(pesoVal, tallaVal);
    if (calculated) newData = { ...newData, [imcField.id]: calculated };
  }

  const pasVal = getNumericValueByLabel(newData, fields, 'sistólica');
  const padVal = getNumericValueByLabel(newData, fields, 'diastólica');
  const pamField = fields.find((f) => f.label && /presión arterial media|pam/i.test(f.label));
  if (pasVal != null && padVal != null && pamField) {
    const calculated = presionArterialMedia(pasVal, padVal);
    if (calculated) newData = { ...newData, [pamField.id]: calculated };
  }

  return newData;
}

/**
 * Props de solo lectura / valor calculado para un campo de plantilla.
 */
export function getSpecialtyComputedFieldProps(formData, fields, field) {
  if (!field?.label || !Array.isArray(fields)) return {};
  const isImc = /imc|índice de masa corporal/i.test(field.label);
  const isPam = /presión arterial media|pam/i.test(field.label);
  if (isImc) {
    const pesoVal = getNumericValueByLabel(formData, fields, 'peso');
    const tallaVal = getNumericValueByLabel(formData, fields, 'talla');
    if (pesoVal && tallaVal) {
      const calculated = imc(pesoVal, tallaVal);
      return { readOnly: true, value: calculated };
    }
  }
  if (isPam) {
    const pasVal = getNumericValueByLabel(formData, fields, 'sistólica');
    const padVal = getNumericValueByLabel(formData, fields, 'diastólica');
    if (pasVal != null && padVal != null) {
      const calculated = presionArterialMedia(pasVal, padVal);
      return { readOnly: true, value: calculated };
    }
  }
  return {};
}
