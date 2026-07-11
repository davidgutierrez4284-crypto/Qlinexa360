/**
 * Constantes del módulo de Afiliados Comerciales (comisionistas).
 *
 * Regla crítica de negocio: la comisión NO se calcula sobre el precio con IVA ($499 MXN),
 * sino sobre la base sin IVA (gross / (1 + vatRate)).
 */

/** Porcentaje de comisión por defecto (sobre la base sin IVA). */
export const DEFAULT_COMMISSION_PERCENTAGE = 30;

/** Número de meses durante los cuales se genera comisión por cada doctor referido. */
export const DEFAULT_COMMISSION_MONTHS = 6;

/** IVA por defecto (16%). Configurable desde Admin vía AffiliateCommissionRule. */
export const DEFAULT_VAT_RATE = 0.16;

/** Meses gratis que otorga el código de afiliado al doctor referido. */
export const DEFAULT_FREE_MONTHS_FOR_DOCTOR = 1;

/** Días de gracia adicionales para el doctor referido (además del mes gratis). */
export const DEFAULT_GRACE_DAYS_FOR_DOCTOR = 15;

/** Días de prueba totales que otorga el código de afiliado (1 mes + 15 días = 45). */
export const DEFAULT_AFFILIATE_TRIAL_DAYS = 45;

/** Moneda por defecto de la plataforma. */
export const DEFAULT_COMMISSION_CURRENCY = 'MXN';

/** Prefijo del formato de código de afiliado: QLX-AF-XXXXXX. */
export const AFFILIATE_CODE_PREFIX = 'QLX-AF-';

/** Longitud de la parte aleatoria del código de afiliado. */
export const AFFILIATE_CODE_RANDOM_LENGTH = 6;

/** Alfabeto sin caracteres ambiguos (sin 0/O/1/I) para códigos legibles. */
export const AFFILIATE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Acciones registradas en el audit trail del módulo de afiliados. */
export const AFFILIATE_AUDIT_ACTIONS = {
  AFFILIATE_CREATED: 'AFFILIATE_CREATED',
  AFFILIATE_UPDATED: 'AFFILIATE_UPDATED',
  COMMISSION_RULE_UPDATED: 'COMMISSION_RULE_UPDATED',
  BANK_ACCOUNT_UPDATED: 'BANK_ACCOUNT_UPDATED',
  COMMISSION_GENERATED: 'COMMISSION_GENERATED',
  COMMISSION_APPROVED: 'COMMISSION_APPROVED',
  COMMISSION_PAID: 'COMMISSION_PAID',
  COMMISSION_REVERSED: 'COMMISSION_REVERSED',
  COMMISSIONS_EXPORTED: 'COMMISSIONS_EXPORTED',
  CODES_BATCH_GENERATED: 'CODES_BATCH_GENERATED',
  PAYOUT_INITIATED: 'PAYOUT_INITIATED',
  PAYOUT_SUCCEEDED: 'PAYOUT_SUCCEEDED',
  PAYOUT_FAILED: 'PAYOUT_FAILED'
} as const;

export type AffiliateAuditAction =
  (typeof AFFILIATE_AUDIT_ACTIONS)[keyof typeof AFFILIATE_AUDIT_ACTIONS];
