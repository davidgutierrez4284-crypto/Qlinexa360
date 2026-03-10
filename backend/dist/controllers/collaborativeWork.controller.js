"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborativeWorkController = void 0;
const client_1 = require("@prisma/client");
const logger_utils_1 = require("../utils/logger.utils");
const notification_service_1 = require("../services/notification.service");
const file_utils_1 = require("../utils/file.utils");
const prisma = new client_1.PrismaClient();
class CollaborativeWorkController {
    // Agregar colaborador a un padecimiento
    static async addCollaborator(req, res) {
        var _a;
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
            // Crear la colaboración
            const colaboracion = await prisma.padecimientoDoctorColaborador.create({
                data: {
                    patientId,
                    padecimientoId,
                    doctorId,
                    rol: rol || 'colaborador'
                }
            });
            // Crear notificación para el doctor colaborador (campanita)
            if (patient && requestingDoctor && doctor.userId) {
                const notification = await prisma.notification.create({
                    data: {
                        userId: doctor.userId, // Usar el userId del doctor colaborador
                        type: 'COLLABORATION_REQUEST',
                        title: 'Solicitud de colaboración',
                        message: `El Dr. ${requestingDoctor.user.firstName} ${requestingDoctor.user.lastName} te ha invitado a colaborar en el caso clínico "${clinicalCase.padecimiento}" del paciente ${patient.user.firstName} ${patient.user.lastName}`,
                        data: {
                            patientId,
                            clinicalCaseId: padecimientoId,
                            requestingDoctorId: userId,
                            requestingDoctorName: `${requestingDoctor.user.firstName} ${requestingDoctor.user.lastName}`
                        }
                    }
                });
                logger_utils_1.securityLogger.info(`Notificación de colaboración creada: ${notification.id} para userId: ${doctor.userId}`);
                // Enviar email al doctor que recibe la invitación (incl. Aviso de Privacidad firmado por el paciente)
                const inviterName = `${requestingDoctor.user.firstName} ${requestingDoctor.user.lastName}`;
                const patientName = `${patient.user.firstName} ${patient.user.lastName}`;
                const recipientEmail = (_a = doctor.user) === null || _a === void 0 ? void 0 : _a.email;
                let avisoPdfBuffer;
                try {
                    const consentAviso = await prisma.consentHistory.findFirst({
                        where: { userId: patient.userId, type: 'PRIVACY_POLICY', pdfUrl: { not: null } },
                        orderBy: { acceptedAt: 'desc' }
                    });
                    if (consentAviso === null || consentAviso === void 0 ? void 0 : consentAviso.pdfUrl) {
                        const { buffer } = await (0, file_utils_1.fetchBufferFromUrl)(consentAviso.pdfUrl);
                        avisoPdfBuffer = buffer;
                    }
                }
                catch (_b) {
                    // Continuar sin PDF
                }
                if (recipientEmail) {
                    const { emailSent } = await notification_service_1.NotificationService.getInstance().sendInternalCollaborationInvite({
                        email: recipientEmail,
                        inviterName,
                        patientName,
                        padecimiento: clinicalCase.padecimiento,
                        avisoPdfBuffer
                    });
                    if (emailSent) {
                        logger_utils_1.securityLogger.info(`Email de colaboración enviado a ${recipientEmail}`);
                    }
                    else {
                        logger_utils_1.securityLogger.warn(`No se pudo enviar email de colaboración a ${recipientEmail}`);
                    }
                }
            }
            logger_utils_1.securityLogger.info(`Colaborador agregado: ${doctorId} al padecimiento ${padecimientoId}`);
            res.status(201).json(Object.assign(Object.assign({}, colaboracion), { message: 'Caso clínico compartido correctamente. El doctor recibirá un email y una notificación (campanita) para colaborar en este caso.' }));
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al agregar colaborador:', error);
            if ((error === null || error === void 0 ? void 0 : error.code) === 'P2002') {
                return res.status(409).json({ error: 'Este doctor ya es colaborador de este caso clínico' });
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
