"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantController = void 0;
const client_1 = require("@prisma/client");
const error_utils_1 = require("../utils/error.utils");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const logger_utils_1 = require("../utils/logger.utils");
const notification_service_1 = require("../services/notification.service");
const prisma = new client_1.PrismaClient();
function assistantErrorResponse(res, error, logLabel, fallbackMessage) {
    console.error(logLabel, error);
    if (error instanceof error_utils_1.AppError) {
        return res.status(error.statusCode).json({ message: error.message });
    }
    const prismaCode = error && typeof error === 'object' && 'code' in error ? error.code : '';
    if (prismaCode === 'P1001') {
        return res.status(503).json({
            message: 'No hay conexión con la base de datos. Comprueba que PostgreSQL esté en marcha y que DATABASE_URL apunte al puerto correcto.',
        });
    }
    return res.status(500).json({ message: fallbackMessage });
}
class AssistantController {
    // Buscar asistentes por nombre o correo
    static async searchAssistants(req, res) {
        var _a;
        try {
            // Verificar que solo doctores puedan buscar asistentes
            if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== 'DOCTOR') {
                throw new error_utils_1.AppError('Solo los doctores pueden buscar asistentes', 403);
            }
            const { q } = req.query;
            console.log('=== BÚSQUEDA DE ASISTENTES ===');
            console.log('Query recibido:', q);
            console.log('Tipo de query:', typeof q);
            if (!q || typeof q !== 'string' || q.length < 2) {
                console.log('Query muy corto o inválido, retornando array vacío');
                return res.json([]);
            }
            // Primero verificar cuántos asistentes hay en total
            const totalAssistants = await prisma.user.count({
                where: {
                    role: 'ASISTENTE'
                }
            });
            console.log('Total de asistentes en la BD:', totalAssistants);
            // Buscar asistentes
            const assistants = await prisma.user.findMany({
                where: {
                    role: 'ASISTENTE',
                    OR: [
                        { firstName: { contains: q, mode: 'insensitive' } },
                        { lastName: { contains: q, mode: 'insensitive' } },
                        { email: { contains: q, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                },
                take: 10
            });
            console.log('Asistentes encontrados:', assistants.length);
            console.log('Resultados:', assistants);
            res.json(assistants);
        }
        catch (error) {
            console.error('Error buscando asistentes:', error);
            logger_utils_1.securityLogger.error('Error buscando asistentes:', error);
            const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al buscar asistentes', 500);
            res.status(handled.statusCode).json({ message: handled.message });
        }
    }
    // Obtener asistentes vinculados al doctor
    static async getLinkedAssistants(req, res) {
        var _a;
        try {
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (!doctorId) {
                throw new error_utils_1.AppError('Doctor no encontrado', 404);
            }
            const linkedAssistants = await prisma.asistenteDoctorVinculo.findMany({
                where: {
                    doctorId,
                    activo: true
                },
                include: {
                    asistente: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });
            const formattedAssistants = linkedAssistants.map(link => ({
                id: link.asistente.id,
                name: link.asistente.firstName,
                lastName: link.asistente.lastName,
                email: link.asistente.email,
                assignmentDate: link.fechaAsignacion,
                permissions: [
                    link.permisosCitas && 'Citas',
                    link.permisosHistorial && 'Historial Clínico',
                    link.permisosRecetas && 'Recetas',
                    link.permisosNotas && 'Notas',
                    link.permisosEstudios && 'Estudios',
                    link.permisosEvolucion && 'Evolución Visual',
                    link.permisosFacturacion && 'Facturación'
                ].filter(Boolean)
            }));
            res.json(formattedAssistants);
        }
        catch (error) {
            assistantErrorResponse(res, error, 'Error obteniendo asistentes vinculados:', 'Error al obtener asistentes vinculados');
        }
    }
    // Vincular asistente al doctor
    static async linkAssistant(req, res) {
        var _a;
        try {
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            const { assistantId, permissions } = req.body;
            if (!doctorId) {
                throw new error_utils_1.AppError('Doctor no encontrado', 404);
            }
            if (!assistantId) {
                throw new error_utils_1.AppError('ID de asistente requerido', 400);
            }
            // Verificar que el asistente existe y es de rol ASISTENTE
            const assistant = await prisma.user.findFirst({
                where: {
                    id: assistantId,
                    role: 'ASISTENTE'
                }
            });
            if (!assistant) {
                throw new error_utils_1.AppError('Asistente no encontrado', 404);
            }
            // Verificar si existe algún vínculo previo
            const existingLink = await prisma.asistenteDoctorVinculo.findFirst({
                where: {
                    doctorId,
                    asistenteId: assistantId
                }
            });
            if (existingLink && existingLink.activo) {
                throw new error_utils_1.AppError('El asistente ya está vinculado a este doctor', 400);
            }
            // Obtener información del doctor para la notificación
            const doctor = await prisma.doctor.findUnique({
                where: { id: doctorId },
                include: { user: { select: { firstName: true, lastName: true } } }
            });
            // Crear o reactivar el vínculo
            const link = existingLink
                ? await prisma.asistenteDoctorVinculo.update({
                    where: { id: existingLink.id },
                    data: {
                        activo: true,
                        permisosCitas: permissions.appointments || false,
                        permisosHistorial: permissions.clinicalHistory || false,
                        permisosRecetas: permissions.prescriptions || false,
                        permisosNotas: permissions.notes || false,
                        permisosEstudios: permissions.studies || false,
                        permisosEvolucion: permissions.visualEvolution || false,
                        permisosFacturacion: permissions.billing || false
                    }
                })
                : await prisma.asistenteDoctorVinculo.create({
                    data: {
                        doctorId,
                        asistenteId: assistantId,
                        permisosCitas: permissions.appointments || false,
                        permisosHistorial: permissions.clinicalHistory || false,
                        permisosRecetas: permissions.prescriptions || false,
                        permisosNotas: permissions.notes || false,
                        permisosEstudios: permissions.studies || false,
                        permisosEvolucion: permissions.visualEvolution || false,
                        permisosFacturacion: permissions.billing || false
                    }
                });
            // Crear notificación para el asistente
            if (doctor) {
                const permissionModules = [];
                if (permissions.appointments)
                    permissionModules.push('Citas');
                if (permissions.clinicalHistory)
                    permissionModules.push('Historial Clínico');
                if (permissions.prescriptions)
                    permissionModules.push('Recetas');
                if (permissions.notes)
                    permissionModules.push('Notas');
                if (permissions.studies)
                    permissionModules.push('Estudios');
                if (permissions.visualEvolution)
                    permissionModules.push('Evolución Visual');
                if (permissions.billing)
                    permissionModules.push('Facturación');
                const permissionText = permissionModules.length > 0
                    ? ` con acceso a: ${permissionModules.join(', ')}`
                    : '';
                await prisma.notification.create({
                    data: {
                        userId: assistantId,
                        type: 'SYSTEM_MESSAGE',
                        title: 'Vinculación con profesional de la salud',
                        message: `El Prof. ${doctor.user.firstName} ${doctor.user.lastName} te ha vinculado como asistente${permissionText}. Ya puedes acceder a las secciones habilitadas desde tu panel.`,
                        data: {
                            doctorId,
                            doctorName: `${doctor.user.firstName} ${doctor.user.lastName}`,
                            permissions: permissions,
                            linkId: link.id
                        }
                    }
                });
            }
            res.status(201).json({
                message: 'Asistente vinculado correctamente',
                link
            });
        }
        catch (error) {
            assistantErrorResponse(res, error, 'Error vinculando asistente:', 'Error al vincular asistente');
        }
    }
    // Revocar acceso del asistente
    static async revokeAssistantAccess(req, res) {
        var _a;
        try {
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            const { assistantId } = req.params;
            if (!doctorId) {
                throw new error_utils_1.AppError('Doctor no encontrado', 404);
            }
            // Obtener información del doctor y del asistente antes de revocar
            const doctor = await prisma.doctor.findUnique({
                where: { id: doctorId },
                include: { user: { select: { firstName: true, lastName: true } } }
            });
            const assistant = await prisma.user.findUnique({
                where: { id: assistantId },
                select: { id: true, firstName: true, lastName: true }
            });
            // Buscar el vínculo
            const link = await prisma.asistenteDoctorVinculo.findFirst({
                where: {
                    doctorId,
                    asistenteId: assistantId,
                    activo: true
                }
            });
            if (!link) {
                throw new error_utils_1.AppError('Vínculo no encontrado', 404);
            }
            // Revocar el acceso (marcar como inactivo)
            await prisma.asistenteDoctorVinculo.update({
                where: { id: link.id },
                data: { activo: false }
            });
            // Crear notificación para el asistente
            if (doctor && assistant) {
                await prisma.notification.create({
                    data: {
                        userId: assistantId,
                        type: 'SYSTEM_MESSAGE',
                        title: 'Acceso revocado',
                        message: `El Prof. ${doctor.user.firstName} ${doctor.user.lastName} ha revocado tu acceso como asistente. Ya no podrás acceder a las secciones de este profesional.`,
                        data: {
                            doctorId,
                            doctorName: `${doctor.user.firstName} ${doctor.user.lastName}`,
                            linkId: link.id
                        }
                    }
                });
            }
            res.json({ message: 'Acceso del asistente revocado correctamente' });
        }
        catch (error) {
            assistantErrorResponse(res, error, 'Error revocando acceso del asistente:', 'Error al revocar acceso del asistente');
        }
    }
    // Verificar permisos del asistente para un módulo específico
    static async checkAssistantPermissions(req, res) {
        try {
            const { doctorId, assistantId, module } = req.body;
            if (!doctorId || !assistantId || !module) {
                throw new error_utils_1.AppError('Parámetros requeridos: doctorId, assistantId, module', 400);
            }
            const link = await prisma.asistenteDoctorVinculo.findFirst({
                where: {
                    doctorId,
                    asistenteId: assistantId,
                    activo: true
                }
            });
            if (!link) {
                return res.json({ hasPermission: false });
            }
            let hasPermission = false;
            switch (module) {
                case 'appointments':
                    hasPermission = link.permisosCitas;
                    break;
                case 'clinicalHistory':
                    hasPermission = link.permisosHistorial;
                    break;
                case 'prescriptions':
                    hasPermission = link.permisosRecetas;
                    break;
                case 'notes':
                    hasPermission = link.permisosNotas;
                    break;
                case 'studies':
                    hasPermission = link.permisosEstudios;
                    break;
                case 'visualEvolution':
                    hasPermission = link.permisosEvolucion;
                    break;
                case 'billing':
                    hasPermission = link.permisosFacturacion;
                    break;
                default:
                    hasPermission = false;
            }
            res.json({ hasPermission });
        }
        catch (error) {
            assistantErrorResponse(res, error, 'Error verificando permisos del asistente:', 'Error al verificar permisos del asistente');
        }
    }
    // Obtener información del asistente vinculado
    static async getAssistantInfo(req, res) {
        var _a;
        try {
            const { assistantId } = req.params;
            const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (!doctorId) {
                throw new error_utils_1.AppError('Doctor no encontrado', 404);
            }
            const link = await prisma.asistenteDoctorVinculo.findFirst({
                where: {
                    doctorId,
                    asistenteId: assistantId,
                    activo: true
                },
                include: {
                    asistente: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });
            if (!link) {
                throw new error_utils_1.AppError('Asistente no vinculado', 404);
            }
            res.json({
                assistant: link.asistente,
                permissions: {
                    appointments: link.permisosCitas,
                    clinicalHistory: link.permisosHistorial,
                    prescriptions: link.permisosRecetas,
                    notes: link.permisosNotas,
                    studies: link.permisosEstudios,
                    visualEvolution: link.permisosEvolucion,
                    billing: link.permisosFacturacion
                },
                assignmentDate: link.fechaAsignacion
            });
        }
        catch (error) {
            assistantErrorResponse(res, error, 'Error obteniendo información del asistente:', 'Error al obtener información del asistente');
        }
    }
    // Obtener doctores vinculados al asistente (para que el asistente vea sus doctores)
    static async getMyLinkedDoctors(req, res) {
        try {
            if (!req.user) {
                throw new error_utils_1.AppError('Usuario no autenticado', 401);
            }
            // Solo asistentes pueden acceder a este endpoint
            if (req.user.role !== 'ASISTENTE') {
                throw new error_utils_1.AppError('Solo los asistentes pueden acceder a este endpoint', 403);
            }
            const assistantId = req.user.userId;
            // Buscar todos los vínculos activos del asistente
            const links = await prisma.asistenteDoctorVinculo.findMany({
                where: {
                    asistenteId: assistantId,
                    activo: true
                },
                include: {
                    doctor: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    email: true
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    fechaAsignacion: 'desc'
                }
            });
            // Formatear la respuesta
            const doctors = links.map(link => ({
                doctorId: link.doctorId,
                doctorName: `${link.doctor.user.firstName} ${link.doctor.user.lastName}`,
                doctorEmail: link.doctor.user.email,
                permissions: {
                    appointments: link.permisosCitas,
                    clinicalHistory: link.permisosHistorial,
                    prescriptions: link.permisosRecetas,
                    notes: link.permisosNotas,
                    studies: link.permisosEstudios,
                    visualEvolution: link.permisosEvolucion,
                    billing: link.permisosFacturacion
                },
                assignmentDate: link.fechaAsignacion
            }));
            res.json(doctors);
        }
        catch (error) {
            console.error('Error obteniendo doctores vinculados:', error);
            const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener doctores vinculados', 500);
            res.status(handled.statusCode).json({ message: handled.message });
        }
    }
    // Registrar asistente directamente (sin invitación)
    static async registerAssistant(req, res) {
        try {
            const { firstName, lastName, email, password, phone, doctorId, profilePhoto, acceptPrivacy, acceptTerms, signature } = req.body;
            // Validaciones básicas
            if (!firstName || !lastName || !email || !password || !phone || !doctorId) {
                throw new error_utils_1.AppError('Todos los campos obligatorios son requeridos', 400);
            }
            // Validar consentimientos legales
            if (!acceptPrivacy || !acceptTerms || !signature) {
                throw new error_utils_1.AppError('Debes aceptar todos los consentimientos legales y firmar digitalmente', 400);
            }
            // Verificar que el doctor existe
            const doctor = await prisma.doctor.findUnique({
                where: { id: doctorId },
                include: { user: { select: { firstName: true, lastName: true } } }
            });
            if (!doctor) {
                throw new error_utils_1.AppError('Doctor no encontrado', 404);
            }
            // Verificar que no existe un usuario con ese email
            const existingUser = await prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });
            if (existingUser) {
                throw new error_utils_1.AppError('Ya existe un usuario con ese email', 400);
            }
            // Encriptar contraseña
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
            // Crear el usuario asistente
            const user = await prisma.user.create({
                data: {
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    firstName,
                    lastName,
                    phone,
                    role: 'ASISTENTE'
                }
            });
            // Crear el vínculo con el doctor
            await prisma.asistenteDoctorVinculo.create({
                data: {
                    doctorId,
                    asistenteId: user.id,
                    activo: true,
                    fechaAsignacion: new Date()
                }
            });
            // Registrar consentimientos legales
            const consentDate = new Date();
            await Promise.all([
                prisma.consentHistory.create({
                    data: {
                        userId: user.id,
                        type: 'PRIVACY_POLICY',
                        version: '1.0',
                        content: 'Aviso de Privacidad de Qlinexa360',
                        acceptedAt: consentDate
                    }
                }),
                prisma.consentHistory.create({
                    data: {
                        userId: user.id,
                        type: 'TERMS_OF_SERVICE',
                        version: '1.0',
                        content: 'Términos de Uso de Qlinexa360',
                        acceptedAt: consentDate
                    }
                }),
                prisma.consentHistory.create({
                    data: {
                        userId: user.id,
                        type: 'DIGITAL_SIGNATURE',
                        version: '1.0',
                        content: `Firma digital: ${signature}`,
                        acceptedAt: consentDate
                    }
                })
            ]);
            logger_utils_1.securityLogger.info(`Asistente registrado directamente: ${user.id} para doctor ${doctorId} con consentimientos legales`);
            // Enviar correo de bienvenida
            try {
                await notification_service_1.NotificationService.sendWelcomeEmail(user.email, user.firstName, user.lastName, 'ASISTENTE');
            }
            catch (emailError) {
                console.error('Error enviando correo de bienvenida:', emailError);
                // No fallar el registro si el correo falla
            }
            res.status(201).json({
                message: 'Asistente registrado exitosamente',
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role
                }
            });
        }
        catch (error) {
            console.error('Error registrando asistente:', error);
            if (error instanceof error_utils_1.AppError) {
                res.status(error.statusCode).json({ error: error.message });
            }
            else {
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        }
    }
}
exports.AssistantController = AssistantController;
