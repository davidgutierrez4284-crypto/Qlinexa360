/**
 * Laboratorio Inteligente - feature flag y configuracion.
 */
function envBool(key: string, defaultValue = false): boolean {
  const raw = String(process.env[key] ?? '').trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function envInt(key: string, defaultValue: number): number {
  const raw = String(process.env[key] ?? '').trim();
  if (!raw) return defaultValue;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

/** En desarrollo el módulo se asume ON si no hay flag (el frontend ya lo muestra). En prod sigue OFF hasta ECS/env. */
export function isSmartLabEnabled(): boolean {
  const devDefault = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'development';
  return envBool('SMART_LAB_ENABLED', devDefault);
}

export function getSmartLabMaxPdfMb(): number {
  return envInt('SMART_LAB_MAX_PDF_MB', 15);
}

/** Pacientes pueden subir PDFs por diseño cuando el módulo está activo; desactivar con SMART_LAB_PATIENT_UPLOAD_ENABLED=false. */
export function isSmartLabPatientUploadEnabled(): boolean {
  return envBool('SMART_LAB_PATIENT_UPLOAD_ENABLED', true);
}

export function isSmartLabExternalOcrEnabled(): boolean {
  return envBool('SMART_LAB_EXTERNAL_OCR_ENABLED', false);
}

export function getSmartLabMissingFollowupMonths(): number {
  return envInt('SMART_LAB_MISSING_FOLLOWUP_MONTHS', 6);
}

export function getSmartLabReviewThreshold(): number {
  const raw = String(process.env.SMART_LAB_REVIEW_THRESHOLD ?? '').trim();
  if (!raw) return 0.9;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.9;
}

export function isSmartLabAiFallbackEnabled(): boolean {
  return envBool('SMART_LAB_AI_FALLBACK_ENABLED', false);
}

export function getSmartLabOpenAiModel(): string {
  return String(process.env.SMART_LAB_OPENAI_MODEL ?? 'gpt-4o-mini').trim() || 'gpt-4o-mini';
}

export function isSmartLabOcrEnabled(): boolean {
  return isSmartLabExternalOcrEnabled();
}
