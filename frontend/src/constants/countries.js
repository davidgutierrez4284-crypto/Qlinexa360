/**
 * Países de habla hispana para selector de teléfono.
 * Formato E.164 para compatibilidad con WhatsApp y SMS internacional.
 */

export const SPANISH_SPEAKING_COUNTRIES = [
  { code: 'mx', name: 'México', dialCode: '52' },
  { code: 'es', name: 'España', dialCode: '34' },
  { code: 'ar', name: 'Argentina', dialCode: '54' },
  { code: 'bo', name: 'Bolivia', dialCode: '591' },
  { code: 'cl', name: 'Chile', dialCode: '56' },
  { code: 'co', name: 'Colombia', dialCode: '57' },
  { code: 'cr', name: 'Costa Rica', dialCode: '506' },
  { code: 'cu', name: 'Cuba', dialCode: '53' },
  { code: 'do', name: 'Rep. Dominicana', dialCode: '1809' },
  { code: 'ec', name: 'Ecuador', dialCode: '593' },
  { code: 'sv', name: 'El Salvador', dialCode: '503' },
  { code: 'gt', name: 'Guatemala', dialCode: '502' },
  { code: 'hn', name: 'Honduras', dialCode: '504' },
  { code: 'ni', name: 'Nicaragua', dialCode: '505' },
  { code: 'pa', name: 'Panamá', dialCode: '507' },
  { code: 'py', name: 'Paraguay', dialCode: '595' },
  { code: 'pe', name: 'Perú', dialCode: '51' },
  { code: 'pr', name: 'Puerto Rico', dialCode: '1787' },
  { code: 'uy', name: 'Uruguay', dialCode: '598' },
  { code: 've', name: 'Venezuela', dialCode: '58' },
];

export const DEFAULT_COUNTRY = SPANISH_SPEAKING_COUNTRIES[0];

export const getFlagUrl = (code) => {
  if (!code) return '';
  const c = String(code).toLowerCase().slice(0, 2);
  return `https://flagcdn.com/w40/${c}.png`;
};

/**
 * Parsea un número E.164 a { country, localNumber }
 * @param {string} phone - Número en formato +5215512345678 o similar
 * @returns {{ country: object, localNumber: string }}
 */
export const parseE164 = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { country: DEFAULT_COUNTRY, localNumber: '' };
  }
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return { country: DEFAULT_COUNTRY, localNumber: '' };

  // Ordenar por dialCode de más largo a más corto para evitar falsos positivos (1809 vs 1)
  const sorted = [...SPANISH_SPEAKING_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

  for (const country of sorted) {
    if (cleaned.startsWith(country.dialCode)) {
      const localNumber = cleaned.slice(country.dialCode.length);
      return { country, localNumber };
    }
  }

  // Si no coincide, asumir país por defecto
  const localNumber = cleaned.startsWith(DEFAULT_COUNTRY.dialCode)
    ? cleaned.slice(DEFAULT_COUNTRY.dialCode.length)
    : cleaned;
  return { country: DEFAULT_COUNTRY, localNumber };
};

/**
 * Convierte país + número local a E.164
 * @param {object} country - { code, name, dialCode }
 * @param {string} localNumber - Solo dígitos
 * @returns {string} "+5215512345678"
 */
export const toE164 = (country, localNumber) => {
  const digits = String(localNumber || '').replace(/\D/g, '');
  if (!digits) return '';
  const dialCode = country?.dialCode || DEFAULT_COUNTRY.dialCode;
  return `+${dialCode}${digits}`;
};

/** Valida formato E.164 (7-15 dígitos después del +) */
export const isValidE164 = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  return /^\+[1-9]\d{6,14}$/.test(phone.replace(/\s/g, ''));
};
