"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatientDisplayFromIntake = getPatientDisplayFromIntake;
/** Extrae nombre y correo del paciente desde intake (registro o formData). */
function getPatientDisplayFromIntake(intake) {
    const p = intake.patient;
    if ((p === null || p === void 0 ? void 0 : p.firstName) && String(p.firstName).trim() && p.firstName !== 'Paciente') {
        const displayName = `${p.firstName} ${p.lastName || ''}`.trim();
        return {
            displayName,
            firstName: p.firstName,
            lastName: p.lastName || '',
            email: p.email || ''
        };
    }
    const fd = (intake.formData && typeof intake.formData === 'object' ? intake.formData : {});
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
