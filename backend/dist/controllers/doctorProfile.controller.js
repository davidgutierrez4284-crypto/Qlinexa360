"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorProfileController = void 0;
const client_1 = require("@prisma/client");
const logger_utils_1 = require("../utils/logger.utils");
const file_utils_1 = require("../utils/file.utils");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma = new client_1.PrismaClient();
class DoctorProfileController {
    /**
     * Obtener configuración del perfil del doctor
     */
    static async getProfileConfig(req, res) {
        var _a, _b, _c, _d, _e;
        try {
            let doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === 'DOCTOR') {
                if (!doctorId && ((_c = req.user) === null || _c === void 0 ? void 0 : _c.userId)) {
                    const doctor = await prisma.doctor.findUnique({
                        where: { userId: req.user.userId },
                        select: { id: true }
                    });
                    doctorId = (_d = doctor === null || doctor === void 0 ? void 0 : doctor.id) !== null && _d !== void 0 ? _d : undefined;
                }
            }
            else if (((_e = req.user) === null || _e === void 0 ? void 0 : _e.role) === 'ASISTENTE') {
                const selectedDoctorId = req.headers['x-selected-doctor-id'];
                if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
                    return res.status(400).json({ success: false, message: 'Doctor seleccionado requerido' });
                }
                const link = await prisma.asistenteDoctorVinculo.findFirst({
                    where: {
                        doctorId: selectedDoctorId,
                        asistenteId: req.user.userId,
                        activo: true,
                        permisosRecetas: true
                    }
                });
                if (!link) {
                    return res.status(403).json({ success: false, message: 'No tienes permisos para acceder a esta configuración' });
                }
                doctorId = selectedDoctorId;
            }
            if (!doctorId) {
                return res.status(401).json({
                    success: false,
                    message: 'No autorizado'
                });
            }
            const doctor = await prisma.doctor.findUnique({
                where: { id: doctorId },
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });
            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor no encontrado'
                });
            }
            res.status(200).json({
                success: true,
                data: {
                    id: doctor.id,
                    firstName: doctor.user.firstName,
                    lastName: doctor.user.lastName,
                    email: doctor.user.email,
                    professionalTitle: doctor.professionalTitle,
                    specialization: doctor.specialization,
                    licenseNumber: doctor.licenseNumber,
                    officeAddress: doctor.officeAddress,
                    officePhone: doctor.officePhone,
                    // Campos de personalización de recetas
                    consultorioDireccion: doctor.consultorioDireccion,
                    consultorioTelefono: doctor.consultorioTelefono,
                    certificadoProfesional: doctor.certificadoProfesional,
                    certificadoEspecialidad: doctor.certificadoEspecialidad,
                    certificadoMaestria: doctor.certificadoMaestria,
                    logoUrl: doctor.logoUrl,
                    primaryColor: doctor.primaryColor,
                    secondaryColor: doctor.secondaryColor,
                    timezone: doctor.timezone
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener configuración del perfil:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Actualizar configuración del perfil del doctor
     */
    static async updateProfileConfig(req, res) {
        var _a, _b, _c, _d, _e;
        try {
            let doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === 'DOCTOR') {
                if (!doctorId && ((_c = req.user) === null || _c === void 0 ? void 0 : _c.userId)) {
                    const doctor = await prisma.doctor.findUnique({
                        where: { userId: req.user.userId },
                        select: { id: true }
                    });
                    doctorId = (_d = doctor === null || doctor === void 0 ? void 0 : doctor.id) !== null && _d !== void 0 ? _d : undefined;
                }
            }
            else if (((_e = req.user) === null || _e === void 0 ? void 0 : _e.role) === 'ASISTENTE') {
                const selectedDoctorId = req.headers['x-selected-doctor-id'];
                if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
                    return res.status(400).json({ success: false, message: 'Doctor seleccionado requerido' });
                }
                const link = await prisma.asistenteDoctorVinculo.findFirst({
                    where: {
                        doctorId: selectedDoctorId,
                        asistenteId: req.user.userId,
                        activo: true,
                        permisosRecetas: true
                    }
                });
                if (!link) {
                    return res.status(403).json({ success: false, message: 'No tienes permisos para actualizar esta configuración' });
                }
                doctorId = selectedDoctorId;
            }
            if (!doctorId) {
                return res.status(401).json({
                    success: false,
                    message: 'No autorizado. Inicia sesión nuevamente.'
                });
            }
            const { consultorioDireccion, consultorioTelefono, certificadoProfesional, certificadoEspecialidad, certificadoMaestria, primaryColor, secondaryColor, timezone } = req.body;
            // Validar colores si se proporcionan
            if (primaryColor && !DoctorProfileController.isValidColor(primaryColor)) {
                return res.status(400).json({
                    success: false,
                    message: 'Color primario inválido'
                });
            }
            if (secondaryColor && !DoctorProfileController.isValidColor(secondaryColor)) {
                return res.status(400).json({
                    success: false,
                    message: 'Color secundario inválido'
                });
            }
            const updateData = {
                consultorioDireccion,
                consultorioTelefono,
                certificadoProfesional,
                certificadoEspecialidad,
                certificadoMaestria,
                primaryColor,
                secondaryColor
            };
            if (timezone !== undefined)
                updateData.timezone = timezone;
            const updatedDoctor = await prisma.doctor.update({
                where: { id: doctorId },
                data: updateData,
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });
            logger_utils_1.securityLogger.info(`Configuración de perfil actualizada para doctor: ${doctorId}`);
            res.status(200).json({
                success: true,
                message: 'Configuración actualizada exitosamente',
                data: {
                    id: updatedDoctor.id,
                    firstName: updatedDoctor.user.firstName,
                    lastName: updatedDoctor.user.lastName,
                    email: updatedDoctor.user.email,
                    professionalTitle: updatedDoctor.professionalTitle,
                    specialization: updatedDoctor.specialization,
                    licenseNumber: updatedDoctor.licenseNumber,
                    officeAddress: updatedDoctor.officeAddress,
                    officePhone: updatedDoctor.officePhone,
                    consultorioDireccion: updatedDoctor.consultorioDireccion,
                    consultorioTelefono: updatedDoctor.consultorioTelefono,
                    certificadoProfesional: updatedDoctor.certificadoProfesional,
                    certificadoEspecialidad: updatedDoctor.certificadoEspecialidad,
                    certificadoMaestria: updatedDoctor.certificadoMaestria,
                    logoUrl: updatedDoctor.logoUrl,
                    primaryColor: updatedDoctor.primaryColor,
                    secondaryColor: updatedDoctor.secondaryColor,
                    timezone: updatedDoctor.timezone
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al actualizar configuración del perfil:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                details: error.message
            });
        }
    }
    /**
     * Subir logo del consultorio
     */
    static async uploadLogo(req, res) {
        var _a, _b, _c, _d, _e;
        try {
            let doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === 'DOCTOR') {
                if (!doctorId && ((_c = req.user) === null || _c === void 0 ? void 0 : _c.userId)) {
                    const doctor = await prisma.doctor.findUnique({
                        where: { userId: req.user.userId },
                        select: { id: true }
                    });
                    doctorId = (_d = doctor === null || doctor === void 0 ? void 0 : doctor.id) !== null && _d !== void 0 ? _d : undefined;
                }
            }
            else if (((_e = req.user) === null || _e === void 0 ? void 0 : _e.role) === 'ASISTENTE') {
                const selectedDoctorId = req.headers['x-selected-doctor-id'];
                if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
                    return res.status(400).json({ success: false, message: 'Doctor seleccionado requerido' });
                }
                const link = await prisma.asistenteDoctorVinculo.findFirst({
                    where: {
                        doctorId: selectedDoctorId,
                        asistenteId: req.user.userId,
                        activo: true,
                        permisosRecetas: true
                    }
                });
                if (!link) {
                    return res.status(403).json({ success: false, message: 'No tienes permisos para subir el logo' });
                }
                doctorId = selectedDoctorId;
            }
            if (!doctorId) {
                return res.status(401).json({
                    success: false,
                    message: 'No autorizado'
                });
            }
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No se proporcionó archivo'
                });
            }
            // Validar tipo de archivo
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
            if (!allowedTypes.includes(req.file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de archivo no permitido. Solo se permiten JPG, PNG y GIF'
                });
            }
            // Validar tamaño (máximo 2MB)
            const maxSize = 2 * 1024 * 1024; // 2MB
            if (req.file.size > maxSize) {
                return res.status(400).json({
                    success: false,
                    message: 'El archivo es demasiado grande. Máximo 2MB'
                });
            }
            // Subir logo: S3 en producción (persiste); disco local en dev sin S3
            let logoUrl;
            const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '';
            if (bucketName) {
                const result = await (0, file_utils_1.uploadToS3)(req.file, 'doctor-logos', doctorId);
                logoUrl = result.url;
            }
            else {
                const uploadsDir = path_1.default.join(__dirname, '../../uploads/logos');
                if (!fs_1.default.existsSync(uploadsDir))
                    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
                const ext = path_1.default.extname(req.file.originalname) || '.png';
                const filename = `logo-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
                const filePath = path_1.default.join(uploadsDir, filename);
                fs_1.default.writeFileSync(filePath, req.file.buffer);
                logoUrl = `uploads/logos/${filename}`;
            }
            await prisma.doctor.update({
                where: { id: doctorId },
                data: { logoUrl }
            });
            logger_utils_1.securityLogger.info(`Logo subido para doctor: ${doctorId}`);
            res.status(200).json({
                success: true,
                message: 'Logo subido exitosamente',
                data: { logoUrl }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al subir logo:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Eliminar logo del consultorio
     */
    static async deleteLogo(req, res) {
        var _a, _b, _c, _d, _e;
        try {
            let doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === 'DOCTOR') {
                if (!doctorId && ((_c = req.user) === null || _c === void 0 ? void 0 : _c.userId)) {
                    const doctor = await prisma.doctor.findUnique({
                        where: { userId: req.user.userId },
                        select: { id: true }
                    });
                    doctorId = (_d = doctor === null || doctor === void 0 ? void 0 : doctor.id) !== null && _d !== void 0 ? _d : undefined;
                }
            }
            else if (((_e = req.user) === null || _e === void 0 ? void 0 : _e.role) === 'ASISTENTE') {
                const selectedDoctorId = req.headers['x-selected-doctor-id'];
                if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
                    return res.status(400).json({ success: false, message: 'Doctor seleccionado requerido' });
                }
                const link = await prisma.asistenteDoctorVinculo.findFirst({
                    where: {
                        doctorId: selectedDoctorId,
                        asistenteId: req.user.userId,
                        activo: true,
                        permisosRecetas: true
                    }
                });
                if (!link) {
                    return res.status(403).json({ success: false, message: 'No tienes permisos para eliminar el logo' });
                }
                doctorId = selectedDoctorId;
            }
            if (!doctorId) {
                return res.status(401).json({
                    success: false,
                    message: 'No autorizado'
                });
            }
            // Obtener el doctor actual para verificar si tiene logo
            const doctor = await prisma.doctor.findUnique({
                where: { id: doctorId },
                select: { logoUrl: true }
            });
            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor no encontrado'
                });
            }
            if (!doctor.logoUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'No hay logo para eliminar'
                });
            }
            // Eliminar de S3 si es URL; si es ruta local (legacy), eliminar de disco
            if (doctor.logoUrl.startsWith('http://') || doctor.logoUrl.startsWith('https://')) {
                try {
                    await (0, file_utils_1.deleteFromS3)(doctor.logoUrl);
                }
                catch (s3Err) {
                    logger_utils_1.securityLogger.warn(`No se pudo eliminar logo de S3 (puede no existir): ${s3Err.message}`);
                }
            }
            else {
                const logoPath = path_1.default.join(__dirname, '../../', doctor.logoUrl);
                if (fs_1.default.existsSync(logoPath)) {
                    fs_1.default.unlinkSync(logoPath);
                }
            }
            // Actualizar el doctor eliminando la referencia al logo
            await prisma.doctor.update({
                where: { id: doctorId },
                data: { logoUrl: null }
            });
            logger_utils_1.securityLogger.info(`Logo eliminado para doctor: ${doctorId}`);
            res.status(200).json({
                success: true,
                message: 'Logo eliminado exitosamente'
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al eliminar logo:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Obtener vista previa del template de receta
     */
    static async getRecipePreview(req, res) {
        var _a, _b, _c, _d, _e;
        try {
            let doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
            if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === 'DOCTOR') {
                if (!doctorId && ((_c = req.user) === null || _c === void 0 ? void 0 : _c.userId)) {
                    const doctor = await prisma.doctor.findUnique({
                        where: { userId: req.user.userId },
                        select: { id: true }
                    });
                    doctorId = (_d = doctor === null || doctor === void 0 ? void 0 : doctor.id) !== null && _d !== void 0 ? _d : undefined;
                }
            }
            else if (((_e = req.user) === null || _e === void 0 ? void 0 : _e.role) === 'ASISTENTE') {
                const selectedDoctorId = req.headers['x-selected-doctor-id'];
                if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
                    return res.status(400).json({ success: false, message: 'Doctor seleccionado requerido' });
                }
                const link = await prisma.asistenteDoctorVinculo.findFirst({
                    where: {
                        doctorId: selectedDoctorId,
                        asistenteId: req.user.userId,
                        activo: true,
                        permisosRecetas: true
                    }
                });
                if (!link) {
                    return res.status(403).json({ success: false, message: 'No tienes permisos para ver la vista previa' });
                }
                doctorId = selectedDoctorId;
            }
            if (!doctorId) {
                return res.status(401).json({
                    success: false,
                    message: 'No autorizado'
                });
            }
            const doctor = await prisma.doctor.findUnique({
                where: { id: doctorId },
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
                return res.status(404).json({
                    success: false,
                    message: 'Doctor no encontrado'
                });
            }
            // Datos de ejemplo para la vista previa
            const previewData = {
                doctor: {
                    firstName: doctor.user.firstName,
                    lastName: doctor.user.lastName,
                    professionalTitle: doctor.professionalTitle,
                    specialization: doctor.specialization,
                    consultorioDireccion: doctor.consultorioDireccion || doctor.officeAddress,
                    consultorioTelefono: doctor.consultorioTelefono || doctor.officePhone,
                    certificadoProfesional: doctor.certificadoProfesional || doctor.licenseNumber,
                    certificadoEspecialidad: doctor.certificadoEspecialidad || 'No especificado',
                    certificadoMaestria: doctor.certificadoMaestria || 'No especificado',
                    logoUrl: doctor.logoUrl,
                    primaryColor: doctor.primaryColor || '#2563eb',
                    secondaryColor: doctor.secondaryColor || '#1e40af'
                },
                patient: {
                    firstName: 'Juan',
                    lastName: 'Pérez',
                    fechaNacimiento: '15/03/1985',
                    id: 'ejemplo-123'
                },
                recipe: {
                    id: 'ejemplo-receta-456',
                    fechaEmision: new Date().toLocaleDateString('es-ES'),
                    timestamp: new Date().toISOString(),
                    observaciones: 'Ejemplo de observaciones médicas para la vista previa',
                    esRecetaMedicamento: true,
                    esSolicitudEstudios: true,
                    detalleMedicamentos: [
                        {
                            medicamento: 'Paracetamol',
                            dosis: '500mg',
                            frecuencia: 'Cada 8 horas',
                            duracion: '5 días'
                        }
                    ],
                    estudiosSolicitados: [
                        {
                            nombreEstudio: 'Análisis de sangre',
                            indicaciones: 'En ayunas'
                        }
                    ]
                },
                qrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' // QR de ejemplo
            };
            res.status(200).json({
                success: true,
                data: previewData
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener vista previa:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Validar si un color es válido (formato hexadecimal)
     */
    static isValidColor(color) {
        const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        return hexColorRegex.test(color);
    }
}
exports.DoctorProfileController = DoctorProfileController;
