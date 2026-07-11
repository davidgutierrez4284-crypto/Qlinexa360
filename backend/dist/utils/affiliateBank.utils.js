"use strict";
/**
 * Validación de datos de pago de afiliados.
 *
 * Métodos soportados:
 *  - SPEI   (México): beneficiario + banco + CLABE (18 dígitos).
 *  - PAYPAL (cualquier país, recomendado internacional): beneficiario + correo PayPal.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidClabe = isValidClabe;
exports.isValidEmail = isValidEmail;
exports.validateBankAccount = validateBankAccount;
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const orNull = (v) => {
    const s = str(v);
    return s.length ? s : null;
};
const normalizeMethod = (v) => {
    return str(v).toUpperCase() === 'PAYPAL' ? 'PAYPAL' : 'SPEI';
};
/** Valida CLABE mexicana: exactamente 18 dígitos numéricos. */
function isValidClabe(clabe) {
    return /^\d{18}$/.test(clabe.replace(/\s/g, ''));
}
/** Validación básica de correo electrónico. */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function validateBankAccount(input) {
    const errors = [];
    const payoutMethod = normalizeMethod(input.payoutMethod);
    const beneficiaryFullName = str(input.beneficiaryFullName);
    const country = str(input.country);
    const bankName = str(input.bankName);
    const preferredCurrency = str(input.preferredCurrency);
    const clabeRaw = str(input.clabe).replace(/\s/g, '');
    const paypalEmail = str(input.paypalEmail);
    if (beneficiaryFullName.length < 3)
        errors.push('El nombre del beneficiario es obligatorio');
    if (!country)
        errors.push('El país es obligatorio');
    if (payoutMethod === 'PAYPAL') {
        if (!paypalEmail) {
            errors.push('El correo de PayPal es obligatorio');
        }
        else if (!isValidEmail(paypalEmail)) {
            errors.push('El correo de PayPal no es válido');
        }
    }
    else {
        // SPEI (México)
        if (!bankName)
            errors.push('El banco es obligatorio');
        if (!clabeRaw) {
            errors.push('La CLABE es obligatoria para pagos por SPEI');
        }
        else if (!isValidClabe(clabeRaw)) {
            errors.push('La CLABE debe tener exactamente 18 dígitos');
        }
    }
    if (errors.length)
        return { valid: false, errors };
    const isPaypal = payoutMethod === 'PAYPAL';
    const data = {
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
