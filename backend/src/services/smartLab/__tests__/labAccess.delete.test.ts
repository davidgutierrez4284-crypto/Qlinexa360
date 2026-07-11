import { assertLabRole } from '../labAccess.service';
import { AppError } from '../../../utils/error.utils';

describe('labAccess roles for lab report delete', () => {
  it('allows DOCTOR, ASISTENTE and PATIENT', () => {
    expect(() => assertLabRole('DOCTOR')).not.toThrow();
    expect(() => assertLabRole('ASISTENTE')).not.toThrow();
    expect(() => assertLabRole('PATIENT')).not.toThrow();
  });

  it('rejects roles without lab module access', () => {
    expect(() => assertLabRole('GUEST')).toThrow(AppError);
  });
});
