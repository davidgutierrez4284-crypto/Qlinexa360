"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendPatientInvitation = exports.getDoctorInvitations = exports.completePatientRegistration = exports.validateInvitationToken = exports.createPatientInvitation = void 0;
const crypto_1 = require("crypto");
const database_1 = __importDefault(require("../config/database"));
const error_utils_1 = require("../utils/error.utils");
const logger_utils_1 = require("../utils/logger.utils");
const notification_service_1 = require("../services/notification.service");
// Generar token único para invitación
const generateInvitationToken = () => {
    return (0, crypto_1.randomBytes)(32).toString('hex');
};
// Crear invitación para paciente
const createPatientInvitation = async (req, res) => {
    var _a;
    try {
        const { firstName, lastName, email, phone, doctorId } = req.body;
        const doctorUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!doctorUserId) {
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        }
        // Verificar que el doctor existe y está activo
        const doctor = await database_1.default.doctor.findFirst({
            where: {
                userId: doctorUserId,
                id: doctorId
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        if (!doctor) {
            throw new error_utils_1.AppError('Doctor no encontrado o no autorizado.', 404);
        }
        // Verificar si el paciente ya existe
        const existingPatient = await database_1.default.user.findUnique({
            where: { email },
            include: { patientProfile: true }
        });
        if (existingPatient) {
            throw new error_utils_1.AppError('Ya existe un paciente con este email.', 400);
        }
        // Crear invitación
        const invitationToken = generateInvitationToken();
        const invitation = await database_1.default.patientInvitation.create({
            data: {
                token: invitationToken,
                email,
                phone,
                firstName,
                lastName,
                doctorId: doctor.id,
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
                createdAt: new Date()
            }
        });
        // Enviar notificaciones por WhatsApp y Email
        const notificationService = notification_service_1.NotificationService.getInstance();
        const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/activate/${invitationToken}`;
        const doctorName = `${doctor.user.firstName} ${doctor.user.lastName}`;
        const { whatsappSent, emailSent } = await notificationService.sendInvitation(phone || '', email, doctorName, invitationUrl);
        logger_utils_1.securityLogger.info(`Invitación creada para ${email} por doctor ${doctorName}. WhatsApp: ${whatsappSent}, Email: ${emailSent}`);
        res.status(201).json({
            message: 'Invitación creada exitosamente',
            invitationId: invitation.id,
            notificationsSent: {
                whatsapp: whatsappSent,
                email: emailSent
            }
        });
    }
    catch (error) {
        console.error('Error al crear invitación:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al crear invitación', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.createPatientInvitation = createPatientInvitation;
// Validar token de invitación
const validateInvitationToken = async (req, res) => {
    try {
        const { token } = req.params;
        const invitation = await database_1.default.patientInvitation.findFirst({
            where: {
                token,
                status: 'PENDING',
                expiresAt: { gt: new Date() }
            },
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
        });
        if (!invitation) {
            throw new error_utils_1.AppError('Invitación no válida o expirada.', 400);
        }
        res.status(200).json({
            valid: true,
            invitation: {
                email: invitation.email,
                firstName: invitation.firstName,
                lastName: invitation.lastName,
                doctorName: `${invitation.doctor.user.firstName} ${invitation.doctor.user.lastName}`,
                doctorSpecialization: invitation.doctor.specialization
            }
        });
    }
    catch (error) {
        console.error('Error al validar token:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al validar invitación', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.validateInvitationToken = validateInvitationToken;
// Completar registro con token de invitación
const completePatientRegistration = async (req, res) => {
    try {
        const { token, password, additionalData } = req.body;
        // Validar token
        const invitation = await database_1.default.patientInvitation.findFirst({
            where: {
                token,
                status: 'PENDING',
                expiresAt: { gt: new Date() }
            },
            include: {
                doctor: true
            }
        });
        if (!invitation) {
            throw new error_utils_1.AppError('Invitación no válida o expirada.', 400);
        }
        // Verificar que el email no esté en uso
        const existingUser = await database_1.default.user.findUnique({
            where: { email: invitation.email }
        });
        if (existingUser) {
            throw new error_utils_1.AppError('Ya existe un usuario con este email.', 400);
        }
        // Crear usuario y perfil de paciente
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await database_1.default.user.create({
            data: {
                email: invitation.email,
                password: hashedPassword,
                firstName: invitation.firstName,
                lastName: invitation.lastName,
                phone: invitation.phone,
                role: 'PATIENT'
            }
        });
        const patient = await database_1.default.patient.create({
            data: Object.assign(Object.assign(Object.assign({ userId: user.id, firstName: invitation.firstName, lastName: invitation.lastName, email: invitation.email, phone: invitation.phone, dateOfBirth: (additionalData === null || additionalData === void 0 ? void 0 : additionalData.birthDate) ? new Date(additionalData.birthDate) : new Date(), gender: (additionalData === null || additionalData === void 0 ? void 0 : additionalData.gender) || 'OTHER', dataConsent: true, dataConsentAt: new Date() }, ((additionalData === null || additionalData === void 0 ? void 0 : additionalData.bloodType) && { bloodType: additionalData.bloodType })), ((additionalData === null || additionalData === void 0 ? void 0 : additionalData.allergies) && { allergies: additionalData.allergies })), ((additionalData === null || additionalData === void 0 ? void 0 : additionalData.chronicDiseases) && { chronicDiseases: additionalData.chronicDiseases }))
        });
        // Crear relación doctor-paciente
        await database_1.default.doctorPatient.create({
            data: {
                doctorId: invitation.doctorId,
                patientId: patient.id,
                status: 'ACTIVE',
                context: `Registrado por invitación`,
                specialization: invitation.doctor.specialization
            }
        });
        // Marcar invitación como completada
        await database_1.default.patientInvitation.update({
            where: { id: invitation.id },
            data: {
                status: 'COMPLETED',
                completedAt: new Date()
            }
        });
        res.status(201).json({
            message: 'Registro completado exitosamente',
            patientId: patient.id,
            email: user.email
        });
    }
    catch (error) {
        console.error('Error al completar registro:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al completar registro', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.completePatientRegistration = completePatientRegistration;
// Obtener invitaciones del doctor
const getDoctorInvitations = async (req, res) => {
    var _a;
    try {
        const doctorUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!doctorUserId) {
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        }
        const doctor = await database_1.default.doctor.findUnique({
            where: { userId: doctorUserId }
        });
        if (!doctor) {
            throw new error_utils_1.AppError('Doctor no encontrado.', 404);
        }
        const invitations = await database_1.default.patientInvitation.findMany({
            where: { doctorId: doctor.id },
            orderBy: { createdAt: 'desc' },
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
        });
        res.status(200).json(invitations);
    }
    catch (error) {
        console.error('Error al obtener invitaciones:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener invitaciones', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.getDoctorInvitations = getDoctorInvitations;
// Reenviar invitación a un paciente
const resendPatientInvitation = async (req, res) => {
    var _a;
    try {
        const { email, firstName, lastName, phone } = req.body;
        const doctorUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!doctorUserId) {
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        }
        // Verificar que el doctor existe
        const doctor = await database_1.default.doctor.findFirst({
            where: { userId: doctorUserId },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        if (!doctor) {
            throw new error_utils_1.AppError('Doctor no encontrado.', 404);
        }
        // Verificar si ya existe una invitación válida para este email y doctor
        const existingInvitation = await database_1.default.patientInvitation.findFirst({
            where: {
                email: email.toLowerCase(),
                doctorId: doctor.id,
                status: 'PENDING',
                expiresAt: { gt: new Date() }
            }
        });
        if (existingInvitation) {
            throw new error_utils_1.AppError('Ya existe una invitación válida para este email.', 400);
        }
        // Verificar si el paciente ya existe
        const existingPatient = await database_1.default.user.findUnique({
            where: { email: email.toLowerCase() },
            include: { patientProfile: true }
        });
        if (existingPatient && existingPatient.patientProfile) {
            throw new error_utils_1.AppError('Ya existe un paciente registrado con este email.', 400);
        }
        // Crear nueva invitación
        const invitationToken = generateInvitationToken();
        const invitation = await database_1.default.patientInvitation.create({
            data: {
                token: invitationToken,
                email: email.toLowerCase(),
                phone: phone || null,
                firstName: firstName || '',
                lastName: lastName || '',
                doctorId: doctor.id,
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
                createdAt: new Date()
            }
        });
        // Enviar notificación por email
        const notificationService = notification_service_1.NotificationService.getInstance();
        const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?type=patient&invitation=${invitationToken}`;
        const doctorName = `${doctor.user.firstName} ${doctor.user.lastName}`;
        const { emailSent } = await notificationService.sendInvitation(phone || '', email, doctorName, invitationUrl);
        logger_utils_1.securityLogger.info(`Invitación reenviada para ${email} por doctor ${doctorName}. Email: ${emailSent}`);
        res.status(201).json({
            message: 'Invitación reenviada exitosamente',
            invitationId: invitation.id,
            emailSent
        });
    }
    catch (error) {
        console.error('Error al reenviar invitación:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al reenviar invitación', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.resendPatientInvitation = resendPatientInvitation;
