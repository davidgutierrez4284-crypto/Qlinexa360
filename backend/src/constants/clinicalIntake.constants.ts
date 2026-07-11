/** Motivos de consulta para pre-registro (medicina general primero). */
export const INTAKE_REASONS = [
  { value: 'GENERAL_MEDICINE', label: 'Medicina general' },
  { value: 'FOLLOW_UP', label: 'Seguimiento' },
  { value: 'CARDIOLOGY', label: 'Cardiología' },
  { value: 'DERMATOLOGY', label: 'Dermatología' },
  { value: 'GYNECOLOGY', label: 'Ginecología' },
  { value: 'PEDIATRICS', label: 'Pediatría' },
  { value: 'MENTAL_HEALTH', label: 'Salud mental' },
  { value: 'TELEMEDICINE', label: 'Teleconsulta' },
  { value: 'URGENCY', label: 'Urgencia' }
] as const;

export const INTAKE_FILE_CATEGORIES = [
  { code: 'PREREG_VACCINATION_CARD', label: 'Cartilla de vacunación' },
  { code: 'PREREG_PRIOR_STUDIES', label: 'Estudios previos (laboratorio o imagen)' },
  { code: 'PREREG_PRIOR_PRESCRIPTION', label: 'Recetas o tratamientos actuales' },
  { code: 'PREREG_LESION_PHOTO', label: 'Fotos de síntomas o lesiones' },
  { code: 'PREREG_OWNER_ID', label: 'Identificación oficial' },
  { code: 'PREREG_INSURANCE', label: 'Póliza o credencial de seguro' }
] as const;

export const INTAKE_LINK_EXPIRY_DAYS = 14;
