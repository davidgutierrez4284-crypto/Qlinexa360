/**
 * Utilidades para formatear fechas/horas en la zona horaria correcta.
 * Soporta zona por doctor (Colombia, Argentina, Tijuana, etc.) o fallback global.
 *
 * Jerarquía:
 * 1. timezone pasado como parámetro (del doctor)
 * 2. PRACTICE_TIMEZONE en .env (fallback global)
 * 3. America/Mexico_City (default)
 */
const DEFAULT_TIMEZONE = process.env.PRACTICE_TIMEZONE || 'America/Mexico_City';

function resolveTimezone(timezone?: string | null): string {
  return (timezone && timezone.trim()) || DEFAULT_TIMEZONE;
}

/**
 * Formatea la hora de una cita (emails, confirmaciones).
 * @param date - Fecha/hora de la cita
 * @param timezone - Zona horaria del consultorio (ej: America/Bogota, America/Tijuana)
 */
export function formatAppointmentTime(
  date: Date,
  timezone?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const tz = resolveTimezone(timezone);
  return new Date(date).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
    ...options
  });
}

/**
 * Formatea la fecha de una cita (ej: "martes, 24 de febrero de 2026").
 */
export function formatAppointmentDate(
  date: Date,
  timezone?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const tz = resolveTimezone(timezone);
  return new Date(date).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: tz,
    ...options
  });
}

/**
 * Formatea fecha corta (sin día de la semana).
 */
export function formatAppointmentDateShort(date: Date, timezone?: string | null): string {
  const tz = resolveTimezone(timezone);
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: tz
  });
}

/**
 * Obtiene el offset en minutos de una zona horaria para una fecha dada.
 * Positivo = la zona está adelante de UTC (ej: UTC+5 → 300).
 * Negativo = la zona está detrás de UTC (ej: America/Mexico_City UTC-6 → -360).
 */
function getTimezoneOffsetMinutes(timeZone: string, date: Date): number {
  try {
    const format = new Intl.DateTimeFormat('en', {
      timeZone,
      timeZoneName: 'longOffset'
    });
    const parts = format.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value;
    if (!tzPart || !tzPart.includes('GMT')) return 0;
    const match = tzPart.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
    if (!match) return 0;
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3] || '0', 10);
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

/**
 * Obtiene year, month (0-11), day de una fecha en la zona horaria indicada.
 */
export function getDatePartsInTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  return {
    year: get('year'),
    month: get('month') - 1,
    day: get('day')
  };
}

/**
 * Crea un Date que representa year-month-day hour:minute en la zona horaria indicada.
 * Necesario para que los slots de agenda se generen en la zona del doctor, no del servidor.
 */
export function createDateInTimezone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const refDate = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  const offsetMin = getTimezoneOffsetMinutes(timezone, refDate);
  const totalLocalMinutes = hour * 60 + minute;
  const totalUtcMinutes = totalLocalMinutes - offsetMin;
  const utcHours = Math.floor(totalUtcMinutes / 60);
  const utcMinutes = Math.round(totalUtcMinutes % 60);
  return new Date(Date.UTC(year, month, day, utcHours, utcMinutes, 0, 0));
}

/**
 * Formatea la hora con am/pm para mayor claridad (ej: "9:00 a.m.", "3:00 p.m.").
 */
/**
 * Formato local sin sufijo Z para APIs de calendario (Google/Outlook).
 * Ej: "2026-05-29T11:15:00" en la zona del profesional.
 */
export function formatDateTimeForExternalCalendar(
  date: Date,
  timezone?: string | null
): string {
  const tz = resolveTimezone(timezone);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

export function formatAppointmentTimeWithAmPm(
  date: Date,
  timezone?: string | null
): string {
  const tz = resolveTimezone(timezone);
  return new Date(date).toLocaleTimeString('es-ES', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz
  });
}

/** Zonas horarias comunes para Latinoamérica (para UI de selección) */
export const COMMON_TIMEZONES = [
  { value: 'America/Mexico_City', label: 'México - Centro (CDMX, Monterrey, Guadalajara)' },
  { value: 'America/Tijuana', label: 'México - Noroeste (Tijuana, Mexicali)' },
  { value: 'America/Hermosillo', label: 'México - Pacífico (Hermosillo, Mazatlán)' },
  { value: 'America/Cancun', label: 'México - Sureste (Cancún, Mérida)' },
  { value: 'America/Matamoros', label: 'México - Frontera noreste (Matamoros, Reynosa)' },
  { value: 'America/Ojinaga', label: 'México - Chihuahua (Ojinaga)' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Lima', label: 'Perú (Lima)' },
  { value: 'America/Guayaquil', label: 'Ecuador (Guayaquil, Quito)' },
  { value: 'America/Caracas', label: 'Venezuela (Caracas)' },
  { value: 'America/Guatemala', label: 'Guatemala' },
  { value: 'America/Costa_Rica', label: 'Costa Rica' },
  { value: 'America/Panama', label: 'Panamá' },
  { value: 'America/La_Paz', label: 'Bolivia (La Paz)' },
  { value: 'America/Asuncion', label: 'Paraguay (Asunción)' },
  { value: 'America/Montevideo', label: 'Uruguay (Montevideo)' }
] as const;
