/**
 * Validación de datos de pago de afiliados.
 *
 * Métodos soportados:
 *  - SPEI   (México): beneficiario + banco + CLABE (18 dígitos).
 *  - PAYPAL (cualquier país, recomendado internacional): beneficiario + correo PayPal.
 */

export type PayoutMethod = 'SPEI' | 'PAYPAL';

export interface BankAccountInput {
  payoutMethod?: unknown;
  paypalEmail?: unknown;
  beneficiaryFullName?: unknown;
  country?: unknown;
  bankName?: unknown;
  clabe?: unknown;
  accountNumber?: unknown;
  swiftBic?: unknown;
  iban?: unknown;
  localBankCode?: unknown;
  bankAddress?: unknown;
  beneficiaryAddress?: unknown;
  preferredCurrency?: unknown;
  additionalInstructions?: unknown;
}

export interface NormalizedBankAccount {
  payoutMethod: PayoutMethod;
  paypalEmail: string | null;
  beneficiaryFullName: string;
  country: string;
  bankName: string | null;
  clabe: string | null;
  accountNumber: string | null;
  swiftBic: string | null;
  iban: string | null;
  localBankCode: string | null;
  bankAddress: string | null;
  beneficiaryAddress: string | null;
  preferredCurrency: string;
  additionalInstructions: string | null;
}

export interface BankValidationResult {
  valid: boolean;
  errors: string[];
  data?: NormalizedBankAccount;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const orNull = (v: unknown): string | null => {
  const s = str(v);
  return s.length ? s : null;
};

const normalizeMethod = (v: unknown): PayoutMethod => {
  return str(v).toUpperCase() === 'PAYPAL' ? 'PAYPAL' : 'SPEI';
};

/** Valida CLABE mexicana: exactamente 18 dígitos numéricos. */
export function isValidClabe(clabe: string): boolean {
  return /^\d{18}$/.test(clabe.replace(/\s/g, ''));
}

/** Validación básica de correo electrónico. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateBankAccount(input: BankAccountInput): BankValidationResult {
  const errors: string[] = [];

  const payoutMethod = normalizeMethod(input.payoutMethod);
  const beneficiaryFullName = str(input.beneficiaryFullName);
  const country = str(input.country);
  const bankName = str(input.bankName);
  const preferredCurrency = str(input.preferredCurrency);
  const clabeRaw = str(input.clabe).replace(/\s/g, '');
  const paypalEmail = str(input.paypalEmail);

  if (beneficiaryFullName.length < 3) errors.push('El nombre del beneficiario es obligatorio');
  if (!country) errors.push('El país es obligatorio');

  if (payoutMethod === 'PAYPAL') {
    if (!paypalEmail) {
      errors.push('El correo de PayPal es obligatorio');
    } else if (!isValidEmail(paypalEmail)) {
      errors.push('El correo de PayPal no es válido');
    }
  } else {
    // SPEI (México)
    if (!bankName) errors.push('El banco es obligatorio');
    if (!clabeRaw) {
      errors.push('La CLABE es obligatoria para pagos por SPEI');
    } else if (!isValidClabe(clabeRaw)) {
      errors.push('La CLABE debe tener exactamente 18 dígitos');
    }
  }

  if (errors.length) return { valid: false, errors };

  const isPaypal = payoutMethod === 'PAYPAL';
  const data: NormalizedBankAccount = {
    payoutMethod,
    paypalEmail: isPaypal ? paypalEmail.toLowerCase() : null,
    beneficiaryFullName,
    country,
    bankName: isPaypal ? null : bankName,
    clabe: isPaypal ? null : clabeRaw,
    accountNumber: isPaypal ? null : orNull(input.accountNumber),
    swiftBic: isPaypal ? null : orNull(input.swiftBic),
    iban: isPaypal ? null : orNull(input.iban),
    localBankCode: isPaypal ? null : orNull(input.localBankCode),
    bankAddress: isPaypal ? null : orNull(input.bankAddress),
    beneficiaryAddress: orNull(input.beneficiaryAddress),
    preferredCurrency: preferredCurrency || (isPaypal ? '' : 'MXN'),
    additionalInstructions: orNull(input.additionalInstructions)
  };

  return { valid: true, errors: [], data };
}
