"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborativeWorkController = void 0;
const client_1 = require("@prisma/client");
const logger_utils_1 = require("../utils/logger.utils");
const caseShareInvite_service_1 = require("../services/caseShareInvite.service");
const prisma = new client_1.PrismaClient();
class CollaborativeWorkController {
    // Agregar colaborador a un padecimiento
    static async addCollaborator(req, res) {
        try {
            const { patientId, padecimientoId, doctorId, rol } = req.body;
            const { userId } = req.user;
            // Verificar que el usuario es un doctor
            const currentDoctor = await prisma.doctor.findUnique({
                where: { userId }
            });
            if (!currentDoctor) {
                return res.status(403).json({ error: 'Solo los doctores pueden agregar colaboradores' });
            }
            // Verificar que el usuario actual es el doctor titular
            const clinicalCase = await prisma.clinicalCase.findFirst({
                where: {
                    id: padecimientoId,
                    patientId: patientId
                }
            });
            if (!clinicalCase) {
                return res.status(404).json({ error: 'Caso clínico no encontrado' });
            }
            const doctor = await prisma.doctor.findUnique({
                where: { id: doctorId },
                include: { user: true }
            });
            if (!doctor) {
                return res.status(404).json({ error: 'Doctor no encontrado' });
            }
            if (!doctor.userId) {
                return res.status(500).json({ error: 'El doctor no tiene un usuario asociado' });
            }
            // Obtener información del paciente y del doctor que solicita
            const patient = await prisma.patient.findUnique({
                where: { id: patientId },
                include: { user: true }
            });
            const requestingDoctor = await prisma.doctor.findUnique({
                where: { userId },
                include: { user: true }
            });
            // Invitación con consentimiento del paciente (no se crea el vínculo colaborador hasta la firma)
            const { expiresAt } = await (0, caseShareInvite_service_1.createCaseShareInvite)({
                ownerDoctorId: currentDoctor.id,
                patientId,
                clinicalCaseId: padecimientoId,
                invitedDoctorId: doctorId
            });
            logger_utils_1.securityLogger.info(`Invitación de colaboración creada (pendiente consentimiento paciente): caso ${padecimientoId} → doctor ${doctorId}`);
            res.status(201).json({
                id: padecimientoId,
                status: 'PENDING_PATIENT_CONSENT',
                expiresAt: expiresAt.toISOString(),
                message: 'Se envió al paciente (y a los profesionales) un enlace para que el paciente firme el consentimiento. El colaborador no tendrá acceso hasta entonces. Si el paciente no tiene correo, comparte con él el enlace desde su cuenta o contacto.'
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al agregar colaborador:', error);
            if ((error === null || error === void 0 ? void 0 : error.code) === 'P2002') {
                return res.status(409).json({ error: 'Este doctor ya es colaborador de este caso clínico' });
            }
            if (error instanceof Error && error.message && !error.code) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Obtener colaboradores de un padecimiento
    static async getCollaborators(req, res) {
        try {
            const { padecimientoId } = req.params;
            const { userId } = req.user;
            // Verificar que el usuario es un doctor
            const doctor = await prisma.doctor.findUnique({
                where: { userId }
            });
            if (!doctor) {
                return res.status(403).json({ error: 'Solo los doctores pueden ver colaboradores' });
            }
            const colaboradores = await prisma.padecimientoDoctorColaborador.findMany({
                where: {
                    padecimientoId
                },
                include: {
                    doctor: {
                        include: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    email: true
                                }
                            }
                        }
                    }
                }
            });
            res.json(colaboradores);
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener colaboradores:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Verificar permisos de edición
    static async checkEditPermissions(req, res) {
        try {
            const { medicalRecordId } = req.params;
            const { userId } = req.user;
            // Verificar que el usuario es un doctor
            const doctor = await prisma.doctor.findUnique({
                where: { userId }
            });
            if (!doctor) {
                return res.status(403).json({ error: 'Solo los doctores pueden verificar permisos de edición' });
            }
            const medicalRecord = await prisma.medicalRecord.findUnique({
                where: { id: medicalRecordId },
                include: {
                    clinicalCase: true,
                    doctorPatient: {
                        include: {
                            doctor: true
                        }
                    }
                }
            });
            if (!medicalRecord) {
                return res.status(404).json({ error: 'Registro médico no encontrado' });
            }
            // Verificar si el usuario es el autor de la consulta
            const isAuthor = medicalRecord.autorConsultaId === userId;
            // Verificar si es colaborador del padecimiento
            const isCollaborator = await prisma.padecimientoDoctorColaborador.findFirst({
                where: {
                    padecimientoId: medicalRecord.clinicalCaseId,
                    doctorId: medicalRecord.doctorPatient.doctorId
                }
            });
            const canEdit = isAuthor || (isCollaborator && medicalRecord.isEditable);
            res.json({
                canEdit,
                isAuthor,
                isCollaborator: !!isCollaborator,
                isEditable: medicalRecord.isEditable
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al verificar permisos:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Bloquear edición colaborativa al crear nueva consulta
    static async blockCollaborativeEditing(req, res) {
        try {
            const { clinicalCaseId } = req.body;
            const { userId } = req.user;
            // Verificar que el usuario es un doctor
            const doctor = await prisma.doctor.findUnique({
                where: { userId }
            });
            if (!doctor) {
                return res.status(403).json({ error: 'Solo los doctores pueden bloquear edición colaborativa' });
            }
            // Bloquear todas las consultas anteriores del mismo padecimiento
            await prisma.medicalRecord.updateMany({
                where: {
                    clinicalCaseId,
                    autorConsultaId: { not: userId }
                },
                data: {
                    isEditable: false
                }
            });
            logger_utils_1.securityLogger.info(`Edición colaborativa bloqueada para caso clínico: ${clinicalCaseId}`);
            res.json({ message: 'Edición colaborativa bloqueada' });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al bloquear edición colaborativa:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Obtener consultas colaborativas
    static async getCollaborativeConsultations(req, res) {
        try {
            const { patientId, padecimientoId } = req.params;
            const { userId } = req.user;
            // Verificar que el usuario es un doctor
            const doctor = await prisma.doctor.findUnique({
                where: { userId }
            });
            if (!doctor) {
                return res.status(403).json({ error: 'Solo los doctores pueden obtener consultas colaborativas' });
            }
            // Obtener todas las consultas del padecimiento
            const consultations = await prisma.medicalRecord.findMany({
                where: {
                    clinicalCaseId: padecimientoId,
                    patientId
                },
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true
                        }
                    },
                    doctorPatient: {
                        include: {
                            doctor: {
                                include: {
                                    user: {
                                        select: {
                                            firstName: true,
                                            lastName: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    files: true,
                    prescriptions: true
                },
                orderBy: [
                    { date: 'desc' },
                    { createdAt: 'desc' }
                ]
            });
            // Marcar cuáles puede editar el usuario actual
            const consultationsWithPermissions = await Promise.all(consultations.map(async (consultation) => (Object.assign(Object.assign({}, consultation), { canEdit: consultation.autorConsultaId === userId ||
                    (consultation.isEditable && await this.isCollaborator(userId, padecimientoId)), isAuthor: consultation.autorConsultaId === userId }))));
            res.json(consultationsWithPermissions);
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener consultas colaborativas:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Método auxiliar para verificar si es colaborador
    static async isCollaborator(userId, padecimientoId) {
        const collaboration = await prisma.padecimientoDoctorColaborador.findFirst({
            where: {
                padecimientoId,
                doctor: {
                    userId
                }
            }
        });
        return !!collaboration;
    }
}
exports.CollaborativeWorkController = CollaborativeWorkController;
