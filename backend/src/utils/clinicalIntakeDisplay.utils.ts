/** Extrae nombre y correo del paciente desde intake (registro o formData). */
export function getPatientDisplayFromIntake(intake: {
  patient?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null;
  formData?: unknown;
  consentSignerName?: string | null;
}) {
  const p = intake.patient;
  if (p?.firstName && String(p.firstName).trim() && p.firstName !== 'Paciente') {
    const displayName = `${p.firstName} ${p.lastName || ''}`.trim();
    return {
      displayName,
      firstName: p.firstName,
      lastName: p.lastName || '',
      email: p.email || ''
    };
  }

  const fd = (intake.formData && typeof intake.formData === 'object' ? intake.formData : {}) as {
    patient?: { firstName?: string; lastName?: string; email?: string };
  };
  const patient = fd.patient || {};
  const firstName = String(patient.firstName || '').trim();
  const lastName = String(patient.lastName || '').trim();
  const signer = String(intake.consentSignerName || '').trim();
  const fromForm = [firstName, lastName].filter(Boolean).join(' ').trim();
  const displayName = fromForm || signer || 'Paciente sin nombre';

  return {
    displayName,
    firstName: firstName || displayName.split(/\s+/)[0] || 'Paciente',
    lastName: lastName || displayName.split(/\s+/).slice(1).join(' ') || '',
    email: String(patient.email || '').trim()
  };
}
