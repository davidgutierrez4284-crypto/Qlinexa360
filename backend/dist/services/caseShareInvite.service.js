"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCaseShareInvite = createCaseShareInvite;
const database_1 = __importDefault(require("../config/database"));
const logger_utils_1 = require("../utils/logger.utils");
const client_1 = require("@prisma/client");
const caseShareEmail_utils_1 = require("../utils/caseShareEmail.utils");
const caseShareInvite_utils_1 = require("../utils/caseShareInvite.utils");
/**
 * Crea invitación pendiente de consentimiento del paciente (no añade colaborador hasta la firma).
 */
async function createCaseShareInvite(params) {
    const { ownerDoctorId, patientId, clinicalCaseId, invitedDoctorId } = params;
    if (ownerDoctorId === invitedDoctorId) {
        throw new Error('No puedes invitarte a ti mismo');
    }
    const ownerLink = await database_1.default.doctorPatient.findUnique({
        where: { doctorId_patientId: { doctorId: ownerDoctorId, patientId } }
    });
    if (!ownerLink) {
        throw new Error('Solo el médico titular del paciente en la clínica puede invitar a colaborar en el caso');
    }
    const existingCollab = await database_1.default.padecimientoDoctorColaborador.findUnique({
        where: {
            patientId_padecimientoId_doctorId: {
                patientId,
                padecimientoId: clinicalCaseId,
                doctorId: invitedDoctorId
            }
        }
    });
    if (existingCollab) {
        throw new Error('Este doctor ya colabora en este caso clínico');
    }
    const pending = await database_1.default.clinicalCaseShareInvite.findFirst({
        where: {
            clinicalCaseId,
            invitedDoctorId,
            status: client_1.ClinicalCaseShareInviteStatus.PENDING_CONSENT
        }
    });
    if (pending) {
        throw new Error('Ya hay una invitación pendiente de firma del paciente para este profesional en este caso');
    }
    const caseRow = await database_1.default.clinicalCase.findFirst({
        where: { id: clinicalCaseId, patientId }
    });
    if (!caseRow) {
        throw new Error('Caso clínico no encontrado');
    }
    const token = (0, caseShareInvite_utils_1.generateCaseShareToken)();
    const expiresAt = (0, caseShareInvite_utils_1.defaultCaseShareInviteExpiry)();
    const invite = await database_1.default.clinicalCaseShareInvite.create({
        data: {
            token,
            clinicalCaseId,
            patientId,
            invitedDoctorId,
            ownerDoctorId,
            status: client_1.ClinicalCaseShareInviteStatus.PENDING_CONSENT,
            expiresAt
        }
    });
    const patient = await database_1.default.patient.findUnique({
        where: { id: patientId },
        include: { user: { select: { firstName: true, lastName: true, email: true } } }
    });
    const owner = await database_1.default.doctor.findUnique({
        where: { id: ownerDoctorId },
        include: { user: { select: { firstName: true, lastName: true, email: true } } }
    });
    const invited = await database_1.default.doctor.findUnique({
        where: { id: invitedDoctorId },
        include: { user: { select: { firstName: true, lastName: true, email: true } } }
    });
    if (!(patient === null || patient === void 0 ? void 0 : patient.user) || !(owner === null || owner === void 0 ? void 0 : owner.user) || !(invited === null || invited === void 0 ? void 0 : invited.user)) {
        throw new Error('Datos de usuario incompletos');
    }
    const ownerName = `${owner.user.firstName} ${owner.user.lastName}`.trim();
    const invitedName = `${invited.user.firstName} ${invited.user.lastName}`.trim();
    const patientEmail = patient.user.email || patient.email;
    if (patientEmail) {
        await (0, caseShareEmail_utils_1.sendCaseSharePatientConsentRequest)({
            to: patientEmail,
            patientFirstName: patient.user.firstName,
            caseLabel: caseRow.padecimiento,
            ownerDoctorName: ownerName,
            invitedDoctorName: invitedName,
            token,
            expiresAt
        });
    }
    else {
        logger_utils_1.securityLogger.warn(`case share: paciente ${patientId} sin email, no se envió correo de consentimiento`);
    }
    if (owner.user.email && invited.user.email) {
        await (0, caseShareEmail_utils_1.sendCaseShareDoctorsPendingNotice)({
            ownerEmail: owner.user.email,
            invitedEmail: invited.user.email,
            ownerDoctorName: ownerName,
            invitedDoctorName: invitedName,
            patientName: `${patient.user.firstName} ${patient.user.lastName}`.trim(),
            caseLabel: caseRow.padecimiento,
            token
        });
    }
    if (patient.userId) {
        const consentUrl = `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/compartir-caso-clinico/${token}`;
        await database_1.default.notification.create({
            data: {
                userId: patient.userId,
                type: 'SYSTEM_MESSAGE',
                title: 'Autorizar colaboración en tu caso clínico',
                message: `${ownerName} solicita que ${invitedName} colabore en "${caseRow.padecimiento}". Firma el consentimiento en el enlace enviado a tu correo o aquí: ${consentUrl}`,
                data: { clinicalCaseId, consentUrl, type: 'CASE_SHARE_CONSENT' }
            }
        });
    }
    if (invited.userId) {
        await database_1.default.notification.create({
            data: {
                userId: invited.userId,
                type: 'COLLABORATION_REQUEST',
                title: 'Solicitud de colaboración (pendiente del paciente)',
                message: `${ownerName} te invitó al caso "${caseRow.padecimiento}". Acceso activo cuando el paciente firme el consentimiento.`,
                data: { patientId, clinicalCaseId, ownerDoctorId }
            }
        });
    }
    return { id: invite.id, token, expiresAt };
}
