"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyCaseShareAccess = getMyCaseShareAccess;
exports.revokeMyCaseCollaborator = revokeMyCaseCollaborator;
exports.patientInviteRegisteredCollaborator = patientInviteRegisteredCollaborator;
exports.patientInviteExternalCollaborator = patientInviteExternalCollaborator;
const database_1 = __importDefault(require("../config/database"));
const client_1 = require("@prisma/client");
const logger_utils_1 = require("../utils/logger.utils");
const caseShareInvite_service_1 = require("../services/caseShareInvite.service");
const notification_service_1 = require("../services/notification.service");
const file_utils_1 = require("../utils/file.utils");
const notificationService = notification_service_1.NotificationService.getInstance();
/** Primer vínculo doctor–paciente (titular) para reglas de colaboración / consentimientos. */
async function getPrimaryOwnerDoctorId(patientId) {
    var _a;
    const link = await database_1.default.doctorPatient.findFirst({
        where: { patientId },
        orderBy: { startDate: 'asc' }
    });
    return (_a = link === null || link === void 0 ? void 0 : link.doctorId) !== null && _a !== void 0 ? _a : null;
}
/** Paciente: quién tiene acceso al caso y revocación de colaboradores (no al titular) */
async function getMyCaseShareAccess(req, res) {
    try {
        const patient = await database_1.default.patient.findUnique({ where: { userId: req.user.userId } });
        if (!patient)
            return res.status(403).json({ success: false, message: 'Solo para pacientes' });
        const clinicalCaseId = req.query.clinicalCaseId;
        if (!clinicalCaseId) {
            return res.status(400).json({ success: false, message: 'clinicalCaseId requerido' });
        }
        const c = await database_1.default.clinicalCase.findFirst({
            where: { id: clinicalCaseId, patientId: patient.id }
        });
        if (!c)
            return res.status(404).json({ success: false, message: 'Caso no encontrado' });
        const doctorPatient = await database_1.default.doctorPatient.findFirst({
            where: { patientId: patient.id },
            include: { doctor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } }
        });
        const colabs = await database_1.default.padecimientoDoctorColaborador.findMany({
            where: { patientId: patient.id, padecimientoId: clinicalCaseId },
            include: { doctor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } }
        });
        const primaryDoctorId = doctorPatient === null || doctorPatient === void 0 ? void 0 : doctorPatient.doctorId;
        const collaborators = colabs.map((row) => {
            const isPrimaryDoctor = primaryDoctorId && row.doctorId === primaryDoctorId;
            const isRolTitular = ['titular', 'TITULAR', 'Titular'].includes(String(row.rol || '').trim());
            return {
                doctorId: row.doctorId,
                name: `${row.doctor.user.firstName} ${row.doctor.user.lastName}`.trim(),
                rol: row.rol,
                puedesRevocar: !isPrimaryDoctor && !isRolTitular
            };
        });
        const pending = await database_1.default.clinicalCaseShareInvite.findMany({
            where: {
                clinicalCaseId,
                patientId: patient.id,
                status: client_1.ClinicalCaseShareInviteStatus.PENDING_CONSENT
            },
            include: { invitedDoctor: { include: { user: { select: { firstName: true, lastName: true } } } } }
        });
        return res.json({
            success: true,
            caseLabel: c.padecimiento,
            primaryDoctor: doctorPatient
                ? {
                    doctorId: doctorPatient.doctorId,
                    name: `${doctorPatient.doctor.user.firstName} ${doctorPatient.doctor.user.lastName}`.trim()
                }
                : null,
            collaborators,
            pendingInvites: pending.map((p) => ({
                id: p.id,
                invitedDoctorId: p.invitedDoctorId,
                invitedDoctorName: `${p.invitedDoctor.user.firstName} ${p.invitedDoctor.user.lastName}`.trim(),
                expiresAt: p.expiresAt.toISOString()
            }))
        });
    }
    catch (e) {
        logger_utils_1.securityLogger.error('getMyCaseShareAccess', e);
        return res.status(500).json({ success: false, message: 'Error del servidor' });
    }
}
async function revokeMyCaseCollaborator(req, res) {
    try {
        const patient = await database_1.default.patient.findUnique({ where: { userId: req.user.userId } });
        if (!patient)
            return res.status(403).json({ success: false, message: 'Solo para pacientes' });
        const { clinicalCaseId, doctorId } = req.params;
        const c = await database_1.default.clinicalCase.findFirst({
            where: { id: clinicalCaseId, patientId: patient.id }
        });
        if (!c)
            return res.status(404).json({ success: false, message: 'Caso no encontrado' });
        const primary = await database_1.default.doctorPatient.findFirst({ where: { patientId: patient.id } });
        if (doctorId === (primary === null || primary === void 0 ? void 0 : primary.doctorId)) {
            return res.status(400).json({ success: false, message: 'No se puede revocar al médico titular de tu expediente' });
        }
        const row = await database_1.default.padecimientoDoctorColaborador.findUnique({
            where: {
                patientId_padecimientoId_doctorId: {
                    patientId: patient.id,
                    padecimientoId: clinicalCaseId,
                    doctorId
                }
            },
            include: { doctor: { include: { user: true } } }
        });
        if (row) {
            await database_1.default.padecimientoDoctorColaborador.delete({
                where: {
                    patientId_padecimientoId_doctorId: {
                        patientId: patient.id,
                        padecimientoId: clinicalCaseId,
                        doctorId
                    }
                }
            });
            if (row.doctor.userId) {
                await database_1.default.notification.create({
                    data: {
                        userId: row.doctor.userId,
                        type: 'SYSTEM_MESSAGE',
                        title: 'Acceso al caso clínico revocado',
                        message: `El paciente revocó tu acceso al caso clínico "${c.padecimiento}".`,
                        data: { clinicalCaseId, patientId: patient.id }
                    }
                });
            }
        }
        await database_1.default.clinicalCaseShareInvite.updateMany({
            where: {
                clinicalCaseId,
                patientId: patient.id,
                invitedDoctorId: doctorId,
                status: client_1.ClinicalCaseShareInviteStatus.PENDING_CONSENT
            },
            data: { status: client_1.ClinicalCaseShareInviteStatus.CANCELLED }
        });
        return res.json({ success: true, message: 'Acceso actualizado' });
    }
    catch (e) {
        logger_utils_1.securityLogger.error('revokeMyCaseCollaborator', e);
        return res.status(500).json({ success: false, message: 'Error del servidor' });
    }
}
/**
 * Paciente: invitar a un profesional ya registrado (misma lógica de consentimiento por correo que cuando lo inicia el médico titular).
 */
async function patientInviteRegisteredCollaborator(req, res) {
    var _a;
    try {
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== 'PATIENT') {
            return res.status(403).json({ success: false, message: 'Solo para pacientes' });
        }
        const { clinicalCaseId, doctorId: invitedDoctorId } = req.body;
        if (!clinicalCaseId || !invitedDoctorId) {
            return res.status(400).json({ success: false, message: 'clinicalCaseId y doctorId son requeridos' });
        }
        const patient = await database_1.default.patient.findUnique({ where: { userId: req.user.userId } });
        if (!patient)
            return res.status(404).json({ success: false, message: 'Paciente no encontrado' });
        const caseRow = await database_1.default.clinicalCase.findFirst({
            where: { id: clinicalCaseId, patientId: patient.id }
        });
        if (!caseRow)
            return res.status(404).json({ success: false, message: 'Caso clínico no encontrado' });
        const ownerDoctorId = await getPrimaryOwnerDoctorId(patient.id);
        if (!ownerDoctorId) {
            return res.status(400).json({
                success: false,
                message: 'No hay un profesional vinculado a tu expediente. No se puede enviar la invitación.'
            });
        }
        if (ownerDoctorId === invitedDoctorId) {
            return res.status(400).json({
                success: false,
                message: 'Ese profesional ya es quien atiende tu expediente en la plataforma. Elige a otro para una segunda opinión.'
            });
        }
        const { expiresAt } = await (0, caseShareInvite_service_1.createCaseShareInvite)({
            ownerDoctorId,
            patientId: patient.id,
            clinicalCaseId,
            invitedDoctorId
        });
        return res.status(201).json({
            success: true,
            expiresAt: expiresAt.toISOString(),
            message: 'Solicitud registrada. Revisa tu correo para firmar el consentimiento. El invitado no tendrá acceso a este caso hasta entonces.'
        });
    }
    catch (e) {
        const err = e;
        logger_utils_1.securityLogger.error('patientInviteRegisteredCollaborator', e);
        if ((err === null || err === void 0 ? void 0 : err.code) === 'P2002') {
            return res.status(409).json({ success: false, message: 'Esa colaboración ya estaba registrada' });
        }
        if (err === null || err === void 0 ? void 0 : err.message) {
            return res.status(400).json({ success: false, message: err.message });
        }
        return res.status(500).json({ success: false, message: 'Error al enviar la solicitud' });
    }
}
/**
 * Paciente: invitar por correo a un profesional aún no registrado (mismo envío de correo que el médico titular, con texto de invitación del paciente).
 */
async function patientInviteExternalCollaborator(req, res) {
    var _a;
    try {
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== 'PATIENT') {
            return res.status(403).json({ message: 'Solo para pacientes' });
        }
        const { email, clinicalCaseId } = req.body;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'Email inválido' });
        }
        if (!clinicalCaseId)
            return res.status(400).json({ message: 'clinicalCaseId es requerido' });
        const patient = await database_1.default.patient.findUnique({
            where: { userId: req.user.userId },
            include: { user: true }
        });
        if (!(patient === null || patient === void 0 ? void 0 : patient.user))
            return res.status(404).json({ message: 'Paciente no encontrado' });
        const clinicalCase = await database_1.default.clinicalCase.findFirst({
            where: { id: clinicalCaseId, patientId: patient.id },
            include: { patient: { include: { user: true } } }
        });
        if (!clinicalCase)
            return res.status(404).json({ message: 'Caso clínico no encontrado' });
        const inviterName = `${patient.user.firstName} ${patient.user.lastName}`.trim();
        const inviterDisplay = `${inviterName} (solicitud de segunda opinión — paciente)`;
        const patientName = inviterName;
        const padecimiento = clinicalCase.padecimiento;
        const websiteUrl = (process.env.FRONTEND_URL || 'https://www.qlinexa360.com').replace(/\/$/, '');
        let avisoPdfBuffer;
        try {
            const consentAviso = await database_1.default.consentHistory.findFirst({
                where: { userId: patient.userId, type: 'PRIVACY_POLICY', pdfUrl: { not: null } },
                orderBy: { acceptedAt: 'desc' }
            });
            if (consentAviso === null || consentAviso === void 0 ? void 0 : consentAviso.pdfUrl) {
                const { buffer } = await (0, file_utils_1.fetchBufferFromUrl)(consentAviso.pdfUrl);
                avisoPdfBuffer = buffer;
            }
        }
        catch (consentErr) {
            logger_utils_1.securityLogger.warn('patientInviteExternal: aviso PDF', consentErr);
        }
        const emailResult = await notificationService.sendExternalCollaborationInvite({
            email: email.trim(),
            inviterName: inviterDisplay,
            patientName,
            padecimiento,
            websiteUrl,
            inviterEmail: patient.user.email || undefined,
            avisoPdfBuffer
        });
        return res.json({
            success: true,
            message: emailResult.emailSent
                ? 'Invitación enviada por correo electrónico'
                : 'No se pudo enviar el correo. Comprueba la configuración de correo del servidor o intenta más tarde.'
        });
    }
    catch (e) {
        logger_utils_1.securityLogger.error('patientInviteExternalCollaborator', e);
        return res.status(500).json({ message: 'Error al enviar la invitación' });
    }
}
