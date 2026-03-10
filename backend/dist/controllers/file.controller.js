"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = exports.getSignedUrlForS3 = exports.getFileSecure = void 0;
const database_1 = __importDefault(require("../config/database"));
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const client_s3_1 = require("@aws-sdk/client-s3");
const file_utils_1 = require("../utils/file.utils");
const error_utils_1 = require("../utils/error.utils");
const client_1 = require("@prisma/client");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const logger_utils_1 = require("../utils/logger.utils");
// Usar credenciales explícitas solo si existen; si no, el SDK usa la cadena por defecto (task role en ECS)
const s3ClientConfig = {
    region: process.env.AWS_REGION || 'us-east-1',
};
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3ClientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
}
const s3Client = new client_s3_1.S3Client(s3ClientConfig);
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '';
const resolveAssistantDoctorId = async (req) => {
    var _a;
    const selectedDoctorId = req.headers['x-selected-doctor-id'];
    if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
        throw new error_utils_1.AppError('Doctor seleccionado requerido', 400);
    }
    const link = await database_1.default.asistenteDoctorVinculo.findFirst({
        where: {
            doctorId: selectedDoctorId,
            asistenteId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId,
            activo: true
        },
        select: { permisosHistorial: true }
    });
    if (!link) {
        throw new error_utils_1.AppError('Asistente no vinculado a este doctor', 403);
    }
    if (!link.permisosHistorial) {
        throw new error_utils_1.AppError('No tienes permisos para acceder a historial clínico', 403);
    }
    return selectedDoctorId;
};
const assistantCanAccessFile = async (req, file) => {
    var _a;
    const doctorId = await resolveAssistantDoctorId(req);
    if (file.doctorId && file.doctorId === doctorId) {
        return true;
    }
    if (file.medicalRecordId) {
        const record = await database_1.default.medicalRecord.findUnique({
            where: { id: file.medicalRecordId },
            select: { vinculadoADoctor: true, doctorPatient: { select: { doctorId: true } }, clinicalCaseId: true }
        });
        if ((record === null || record === void 0 ? void 0 : record.vinculadoADoctor) && record.vinculadoADoctor === doctorId) {
            return true;
        }
        if (((_a = record === null || record === void 0 ? void 0 : record.doctorPatient) === null || _a === void 0 ? void 0 : _a.doctorId) === doctorId) {
            return true;
        }
        // Si el doctor es colaborador del caso clínico
        if (record === null || record === void 0 ? void 0 : record.clinicalCaseId) {
            const isCollaborator = await database_1.default.padecimientoDoctorColaborador.findFirst({
                where: {
                    padecimientoId: record.clinicalCaseId,
                    doctorId
                }
            });
            if (isCollaborator)
                return true;
        }
    }
    return false;
};
/** Verifica si un doctor (por userId) puede acceder a un archivo como colaborador del caso clínico */
const doctorCanAccessFileAsCollaborator = async (userId, file) => {
    var _a;
    const doctor = await database_1.default.doctor.findUnique({
        where: { userId },
        select: { id: true }
    });
    if (!doctor)
        return false;
    if (file.doctorId && file.doctorId === doctor.id)
        return true;
    if (file.doctorPatientId) {
        const dp = await database_1.default.doctorPatient.findUnique({
            where: { id: file.doctorPatientId },
            select: { doctorId: true }
        });
        if ((dp === null || dp === void 0 ? void 0 : dp.doctorId) === doctor.id)
            return true;
    }
    if (file.medicalRecordId) {
        const record = await database_1.default.medicalRecord.findUnique({
            where: { id: file.medicalRecordId },
            select: {
                clinicalCaseId: true,
                doctorPatient: { select: { doctorId: true } },
                vinculadoADoctor: true
            }
        });
        if (!record)
            return false;
        // Doctor titular del caso (doctorPatient) o vinculado a la consulta
        if (((_a = record.doctorPatient) === null || _a === void 0 ? void 0 : _a.doctorId) === doctor.id || record.vinculadoADoctor === doctor.id) {
            return true;
        }
        // Doctor colaborador del caso clínico
        if (record.clinicalCaseId) {
            const isCollaborator = await database_1.default.padecimientoDoctorColaborador.findFirst({
                where: {
                    padecimientoId: record.clinicalCaseId,
                    doctorId: doctor.id
                }
            });
            if (isCollaborator)
                return true;
        }
    }
    return false;
};
const getFileSecure = async (req, res) => {
    var _a;
    try {
        const { fileId } = req.params;
        const user = req.user;
        if (!user) {
            throw new error_utils_1.AppError('No estás autenticado', 401);
        }
        // Buscar el archivo en la base de datos
        const file = await database_1.default.file.findUnique({
            where: { id: fileId },
            include: {
                uploadedBy: {
                    select: { firstName: true, lastName: true }
                }
            }
        });
        if (!file) {
            throw new error_utils_1.AppError('Archivo no encontrado', 404);
        }
        // Verificar permisos
        if (user.role === 'ASISTENTE') {
            const canAccess = await assistantCanAccessFile(req, file);
            if (!canAccess) {
                logger_utils_1.securityLogger.security('Unauthorized file access attempt', { fileId, requestedBy: user.userId, fileOwner: file.uploadedById }, user.userId, req.ip);
                throw new error_utils_1.AppError('No tienes permisos para acceder a este archivo', 403);
            }
        }
        else if (user.role === 'PATIENT') {
            const patient = await database_1.default.patient.findUnique({
                where: { userId: user.userId },
                select: { id: true }
            });
            if (!patient) {
                throw new error_utils_1.AppError('Perfil de paciente no encontrado', 404);
            }
            let canAccess = file.patientId === patient.id;
            if (!canAccess && file.medicalRecordId) {
                const record = await database_1.default.medicalRecord.findUnique({
                    where: { id: file.medicalRecordId },
                    select: { patientId: true }
                });
                canAccess = (record === null || record === void 0 ? void 0 : record.patientId) === patient.id;
            }
            if (!canAccess) {
                logger_utils_1.securityLogger.security('Unauthorized file access attempt', { fileId, requestedBy: user.userId, fileOwner: file.uploadedById }, user.userId, req.ip);
                throw new error_utils_1.AppError('No tienes permisos para acceder a este archivo', 403);
            }
        }
        else if (user.role === 'DOCTOR') {
            const isUploader = file.uploadedById === user.userId;
            const isCollaborator = !isUploader && await doctorCanAccessFileAsCollaborator(user.userId, file);
            if (!isUploader && !isCollaborator) {
                logger_utils_1.securityLogger.security('Unauthorized file access attempt', { fileId, requestedBy: user.userId, fileOwner: file.uploadedById }, user.userId, req.ip);
                throw new error_utils_1.AppError('No tienes permisos para acceder a este archivo', 403);
            }
        }
        else if (file.uploadedById !== user.userId) {
            logger_utils_1.securityLogger.security('Unauthorized file access attempt', { fileId, requestedBy: user.userId, fileOwner: file.uploadedById }, user.userId, req.ip);
            throw new error_utils_1.AppError('No tienes permisos para acceder a este archivo', 403);
        }
        // Generar URL firmada para S3
        // Extraer la clave S3 de la URL completa
        const s3Key = file.url.replace(`https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/`, '');
        const command = new client_s3_1.GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
        });
        const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: 3600 }); // 1 hora
        logger_utils_1.securityLogger.info('File accessed successfully', { fileId, fileName: file.fileName, fileType: file.fileType }, user.userId);
        res.json({
            url: signedUrl,
            file: {
                id: file.id,
                fileName: file.fileName,
                fileType: file.fileType,
                size: file.size,
                category: file.category,
                uploadedBy: file.uploadedBy
            }
        });
    }
    catch (error) {
        console.error('Error al obtener archivo seguro:', error);
        logger_utils_1.securityLogger.error('Error accessing secure file', error, (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId, req.ip);
        if (error instanceof error_utils_1.AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({
            message: 'Error interno del servidor al obtener el archivo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getFileSecure = getFileSecure;
const getSignedUrlForS3 = async (req, res) => {
    var _a, _b;
    try {
        const { url } = req.query;
        const user = req.user;
        console.log('=== DEBUG: getSignedUrlForS3 ===');
        console.log('URL recibida:', url);
        console.log('Usuario:', user === null || user === void 0 ? void 0 : user.userId);
        console.log('BUCKET_NAME:', BUCKET_NAME);
        console.log('AWS_REGION:', process.env.AWS_REGION);
        if (!user) {
            throw new error_utils_1.AppError('No estás autenticado', 401);
        }
        if (!url || typeof url !== 'string') {
            throw new error_utils_1.AppError('URL requerida', 400);
        }
        // Intentar buscar el archivo en la BD (opcional, para archivos registrados)
        const file = await database_1.default.file.findFirst({
            where: { url: url }
        });
        console.log('Archivo encontrado en DB:', file ? 'SÍ' : 'NO');
        // Extraer el key de S3 desde la URL
        // Esto funciona tanto para archivos registrados en la BD como para fotos de perfil
        const region = process.env.AWS_REGION || 'us-east-1';
        console.log('Extrayendo clave S3 desde URL...');
        console.log('URL completa:', url);
        console.log('Bucket:', BUCKET_NAME);
        console.log('Región:', region);
        // Extraer el key de S3 desde la URL usando el pathname (más robusto)
        let s3Key = '';
        try {
            const urlObj = new URL(url);
            // El pathname contiene el key (sin el slash inicial)
            s3Key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
            console.log('Clave S3 extraída desde pathname:', s3Key);
        }
        catch (urlError) {
            console.error('Error parseando URL con URL constructor:', urlError);
            // Método alternativo: usar replace con diferentes prefijos
            const possiblePrefixes = [
                `https://${BUCKET_NAME}.s3.amazonaws.com/`, // us-east-1
                `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/`, // otras regiones (ej: us-east-2)
                `https://${BUCKET_NAME}.s3-${region}.amazonaws.com/`, // formato legacy
            ];
            for (const prefix of possiblePrefixes) {
                if (url.startsWith(prefix)) {
                    s3Key = url.replace(prefix, '');
                    console.log('Clave S3 extraída usando prefijo:', prefix, '->', s3Key);
                    break;
                }
            }
        }
        // Verificar que se extrajo correctamente
        if (!s3Key || s3Key === url || !s3Key.trim()) {
            console.error('Error: No se pudo extraer la clave S3 correctamente');
            console.error('URL recibida:', url);
            console.error('Bucket esperado:', BUCKET_NAME);
            console.error('Región esperada:', region);
            throw new error_utils_1.AppError('Formato de URL de S3 inválido. No se pudo extraer la clave del archivo desde la URL.', 400);
        }
        console.log('Clave S3 extraída exitosamente:', s3Key);
        // Verificar permisos: si el archivo está en la BD, verificar permisos
        // Si no está en la BD (como fotos de perfil), verificar que el usuario tenga acceso
        // Para fotos de perfil, verificar que la URL pertenezca al usuario autenticado
        if (file) {
            if (user.role === 'ASISTENTE') {
                const canAccess = await assistantCanAccessFile(req, file);
                if (!canAccess) {
                    throw new error_utils_1.AppError('No tienes permisos para acceder a este archivo', 403);
                }
            }
            else if (user.role === 'DOCTOR') {
                const isUploader = file.uploadedById === user.userId;
                const isCollaborator = !isUploader && await doctorCanAccessFileAsCollaborator(user.userId, file);
                if (!isUploader && !isCollaborator) {
                    throw new error_utils_1.AppError('No tienes permisos para acceder a este archivo', 403);
                }
            }
        }
        if (!file) {
            // Verificar que la URL de foto de perfil pertenezca al usuario
            // Las fotos de perfil tienen el formato: category/userId/filename
            const urlParts = s3Key.split('/');
            if (urlParts.length >= 2) {
                const category = urlParts[0];
                const fileUserId = urlParts[1];
                // Verificar si es una foto de perfil (doctor, patient, assistant, admin)
                const allowedProfileCategories = [
                    'doctor-profile-photos',
                    'patient-profile-photos',
                    'assistant-profile-photos',
                    'admin-profile-photos'
                ];
                if (allowedProfileCategories.includes(category)) {
                    // Verificar que el userId en la URL coincida con el usuario autenticado
                    if (fileUserId !== user.userId) {
                        // Si no coincide, permitir para doctores/asistentes que pueden ver fotos de pacientes
                        // o denegar acceso no autorizado
                        console.log('Verificando permisos de acceso a foto de perfil...');
                        console.log('fileUserId:', fileUserId, 'user.userId:', user.userId);
                        // Para fotos de perfil propias, debe coincidir el userId
                        if (['assistant-profile-photos', 'admin-profile-photos'].includes(category)) {
                            throw new error_utils_1.AppError('No tienes permisos para acceder a esta foto de perfil', 403);
                        }
                        console.log('Permitiendo acceso a foto de perfil (verificación de permisos básica)');
                    }
                }
            }
        }
        // Verificar que el archivo existe en S3 (evita NoSuchKey en dev con datos de otro ambiente)
        try {
            await s3Client.send(new client_s3_1.HeadObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
        }
        catch (headErr) {
            const is404 = (headErr === null || headErr === void 0 ? void 0 : headErr.name) === 'NotFound' || ((_a = headErr === null || headErr === void 0 ? void 0 : headErr.$metadata) === null || _a === void 0 ? void 0 : _a.httpStatusCode) === 404 || (headErr === null || headErr === void 0 ? void 0 : headErr.Code) === 'NoSuchKey';
            if (is404) {
                return res.status(404).json({ message: 'Archivo no encontrado en el almacenamiento' });
            }
            throw headErr;
        }
        const command = new client_s3_1.GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
        });
        console.log('Comando S3:', { Bucket: BUCKET_NAME, Key: s3Key });
        // Generar URL firmada con expiración de 7 días para fotos de perfil
        // (más largo que los archivos normales porque las fotos de perfil se muestran frecuentemente)
        const expirationTime = file ? 3600 : 7 * 24 * 3600; // 1 hora para archivos normales, 7 días para fotos de perfil
        const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: expirationTime });
        console.log('URL firmada generada exitosamente (expira en', expirationTime, 'segundos)');
        logger_utils_1.securityLogger.info('Signed URL generated successfully', {
            fileId: (file === null || file === void 0 ? void 0 : file.id) || 'N/A',
            fileName: (file === null || file === void 0 ? void 0 : file.fileName) || 'Profile picture',
            url: url,
            s3Key: s3Key
        }, user.userId);
        res.json({ url: signedUrl });
    }
    catch (error) {
        console.error('Error al generar URL firmada:', error);
        console.error('Stack trace:', error.stack);
        logger_utils_1.securityLogger.error('Error generating signed URL', error, (_b = req.user) === null || _b === void 0 ? void 0 : _b.userId, req.ip);
        if (error instanceof error_utils_1.AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({
            message: 'Error interno del servidor al generar URL firmada',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getSignedUrlForS3 = getSignedUrlForS3;
const uploadFile = async (req, res) => {
    var _a;
    try {
        const file = req.file;
        const user = req.user;
        const { category } = req.body;
        const securityInfo = req.fileSecurityInfo;
        const securityWarnings = req.securityWarnings;
        const antivirusResult = req.antivirusResult;
        // Validaciones básicas
        if (!file) {
            throw new error_utils_1.AppError('No se ha subido ningún archivo', 400);
        }
        if (!user) {
            throw new error_utils_1.AppError('No estás autenticado', 401);
        }
        if (!category || !Object.values(client_1.FileCategory).includes(category)) {
            throw new error_utils_1.AppError('La categoría del archivo es inválida o no fue proporcionada', 400);
        }
        // Validar archivo usando el middleware
        const validation = (0, upload_middleware_1.validateFile)(file);
        if (!validation.isValid) {
            throw new error_utils_1.AppError(validation.error || 'Archivo inválido', 400);
        }
        logger_utils_1.securityLogger.info('Starting file upload', {
            filename: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            category,
            securityHash: securityInfo === null || securityInfo === void 0 ? void 0 : securityInfo.hash
        }, user.userId);
        // Subir a S3
        const { url, key } = await (0, file_utils_1.uploadToS3)(file, category, user.userId);
        logger_utils_1.securityLogger.info('File uploaded to S3 successfully', { s3Key: key, url }, user.userId);
        // Crear registro en la base de datos con información de seguridad
        const newDbFile = await database_1.default.file.create({
            data: Object.assign({ fileName: file.originalname, fileType: file.mimetype, size: file.size, url: url, category: category, uploadedById: user.userId }, (securityInfo && {
                securityHash: securityInfo.hash,
                securityValidated: securityInfo.validated,
                securityWarnings: securityWarnings || []
            })),
            include: {
                uploadedBy: {
                    select: { firstName: true, lastName: true }
                }
            }
        });
        logger_utils_1.securityLogger.info('File registered in database', { fileId: newDbFile.id, fileName: newDbFile.fileName }, user.userId);
        // Log de escaneo antivirus si está disponible
        if (antivirusResult) {
            logger_utils_1.securityLogger.antivirus(antivirusResult.isInfected ? 'Malware detected' : 'File scanned successfully', {
                threats: antivirusResult.threats,
                scanTime: antivirusResult.scanTime,
                warnings: antivirusResult.warnings
            }, {
                filename: file.originalname,
                size: file.size,
                mimeType: file.mimetype
            }, user.userId);
        }
        // Preparar respuesta
        const response = {
            message: 'Archivo subido exitosamente',
            file: newDbFile
        };
        // Incluir advertencias de seguridad si las hay
        if (securityWarnings && securityWarnings.length > 0) {
            response.warnings = securityWarnings;
            response.message += ' (con advertencias de seguridad)';
        }
        res.status(201).json(response);
    }
    catch (error) {
        console.error('Error detallado al subir el archivo:', error);
        logger_utils_1.securityLogger.error('File upload failed', error, (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId, req.ip);
        if (error instanceof error_utils_1.AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({
            message: 'Error interno del servidor al subir el archivo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.uploadFile = uploadFile;
