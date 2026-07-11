/** QA rápido de validateBankAccount (métodos SPEI vs PAYPAL). */
import { validateBankAccount } from '../src/utils/affiliateBank.utils';

let pass = 0, fail = 0;
const failed: string[] = [];
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) { pass += 1; console.log(`  PASS  ${label}`); }
  else { fail += 1; failed.push(label); console.log(`  FAIL  ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`); }
}

const base = { beneficiaryFullName: 'Juan Pérez' };

// SPEI (México) — default cuando no se especifica payoutMethod
let r = validateBankAccount({ ...base, country: 'MX', bankName: 'Banco X', clabe: '012345678901234567' });
check('SPEI con banco + CLABE válida -> válido', r.valid, r.errors);
check('SPEI default payoutMethod = SPEI', r.data?.payoutMethod === 'SPEI', r.data?.payoutMethod);

r = validateBankAccount({ payoutMethod: 'SPEI', ...base, country: 'MX', bankName: 'Banco X' });
check('SPEI sin CLABE -> inválido', !r.valid && r.errors.some((e) => /CLABE/i.test(e)), r.errors);

r = validateBankAccount({ payoutMethod: 'SPEI', ...base, country: 'MX', bankName: 'Banco X', clabe: '123' });
check('SPEI con CLABE corta -> inválido', !r.valid && r.errors.some((e) => /18 dígitos/i.test(e)), r.errors);

r = validateBankAccount({ payoutMethod: 'SPEI', ...base, country: 'MX', clabe: '012345678901234567' });
check('SPEI sin banco -> inválido', !r.valid && r.errors.some((e) => /banco/i.test(e)), r.errors);

r = validateBankAccount({ payoutMethod: 'SPEI', ...base, country: 'MX', bankName: 'Banco X', clabe: '0123 4567 8901 2345 67' });
check('SPEI normaliza CLABE (sin espacios)', r.valid && r.data?.clabe === '012345678901234567', r.data);

// PAYPAL (cualquier país)
r = validateBankAccount({ payoutMethod: 'PAYPAL', ...base, country: 'ES', paypalEmail: 'Afiliado@Ejemplo.com' });
check('PayPal con correo válido -> válido', r.valid, r.errors);
check('PayPal normaliza correo a minúsculas', r.data?.paypalEmail === 'afiliado@ejemplo.com', r.data?.paypalEmail);
check('PayPal no exige banco ni CLABE', r.valid && r.data?.bankName === null && r.data?.clabe === null, r.data);

r = validateBankAccount({ payoutMethod: 'PAYPAL', ...base, country: 'AR' });
check('PayPal sin correo -> inválido', !r.valid && r.errors.some((e) => /PayPal/i.test(e)), r.errors);

r = validateBankAccount({ payoutMethod: 'PAYPAL', ...base, country: 'AR', paypalEmail: 'no-es-correo' });
check('PayPal con correo mal formado -> inválido', !r.valid && r.errors.some((e) => /no es válido/i.test(e)), r.errors);

// Beneficiario y país obligatorios en ambos métodos
r = validateBankAccount({ payoutMethod: 'PAYPAL', country: 'MX', paypalEmail: 'a@b.com' });
check('Sin beneficiario -> inválido', !r.valid && r.errors.some((e) => /beneficiario/i.test(e)), r.errors);

r = validateBankAccount({ payoutMethod: 'PAYPAL', beneficiaryFullName: 'Juan Pérez', paypalEmail: 'a@b.com' });
check('Sin país -> inválido', !r.valid && r.errors.some((e) => /país/i.test(e)), r.errors);

console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) { failed.forEach((f) => console.log(' -', f)); process.exit(1); }
process.exit(0);
