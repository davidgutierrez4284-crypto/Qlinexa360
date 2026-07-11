import { LabAuditAction } from '@prisma/client';

export const LAB_DISCLAIMER_ES =
  'La interpretación clínica de los resultados corresponde exclusivamente al profesional de la salud. Qlinexa360 muestra información estructurada, tendencias y alertas visuales como apoyo, sin sustituir el juicio médico.';

export const LAB_ALERT_NON_DIAGNOSTIC_PREFIX =
  'Valor fuera del rango de referencia reportado en el laboratorio. Consulte a su médico para interpretación.';

export const LAB_ERRORS = {
  NOT_ENABLED: 'Módulo de laboratorio no disponible.',
  UNAUTHORIZED: 'No autenticado.',
  FORBIDDEN: 'No tienes permiso para acceder a este recurso.',
  PATIENT_NOT_FOUND: 'Paciente no encontrado.',
  REPORT_NOT_FOUND: 'Reporte de laboratorio no encontrado.',
  RESULT_NOT_FOUND: 'Resultado no encontrado.',
  INVALID_PDF: 'El archivo no es un PDF válido o no contiene texto suficiente.',
  PDF_TOO_LARGE: 'El PDF excede el tamaño máximo permitido.',
  PATIENT_UPLOAD_DISABLED: 'La carga de laboratorios por paciente no está habilitada.',
  DUPLICATE_FILE: 'Este archivo ya fue cargado anteriormente.',
  INVALID_STATUS: 'El reporte no está en un estado válido para esta operación.',
  CATALOG_NOT_FOUND: 'Analito del catálogo no encontrado.',
  EXTERNAL_OCR_DISABLED: 'OCR externo no habilitado.',
  COMPARE_REQUIRES_TWO: 'Se requieren dos reportes confirmados para comparar.',
  COMPARE_REQUIRES_MIN: 'Se requieren al menos dos reportes confirmados para comparar.',
  COMPARE_MAX_REPORTS: 'Se permiten como máximo 6 reportes por comparación.',
  COMPARE_DUPLICATE_REPORTS: 'No se puede comparar el mismo reporte más de una vez.',
} as const;

export const MAX_COMPARE_REPORTS = 6;

export const LAB_DASHBOARD_CATEGORIES: Record<string, string> = {
  hematologia: 'Hematología',
  quimica_sanguinea: 'Química sanguínea',
  perfil_lipidico: 'Perfil lipídico',
  funcion_hepatica: 'Función hepática',
  funcion_renal: 'Función renal',
  tiroides: 'Tiroides',
  electrolitos: 'Electrolitos',
  otros: 'Otros',
};

export const LAB_CATEGORY_ALIASES: Record<string, string> = {
  hemograma: 'hematologia',
  bioquimica: 'quimica_sanguinea',
  lipidico: 'perfil_lipidico',
  hepatico: 'funcion_hepatica',
  renal: 'funcion_renal',
  thyroid: 'tiroides',
};

export type LabAuditActionType = LabAuditAction;
