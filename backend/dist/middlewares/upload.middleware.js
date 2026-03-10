"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFile = exports.handleUploadError = exports.securityValidationMiddleware = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const security_utils_1 = require("../utils/security.utils");
// Configuración de almacenamiento en memoria
const storage = multer_1.default.memoryStorage();
// Tipos de archivo permitidos
const ALLOWED_MIME_TYPES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpeg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'text/xml': '.xml',
    'application/xml': '.xml'
};
// Tamaño máximo de archivo (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Filtro de archivos mejorado con validaciones de seguridad
const fileFilter = (req, file, cb) => {
    try {
        // 1. Validación básica de tipo MIME
        if (!ALLOWED_MIME_TYPES[file.mimetype]) {
            return cb(new Error(`Tipo de archivo no permitido. Tipos permitidos: ${Object.values(ALLOWED_MIME_TYPES).join(', ')}`));
        }
        // 2. Validación de extensión (solo para imágenes en este caso)
        const fileExtension = file.originalname.toLowerCase().split('.').pop();
        const allowedExtensions = Object.values(ALLOWED_MIME_TYPES).map(ext => ext.replace('.', ''));
        if (!fileExtension || !allowedExtensions.includes(fileExtension.toLowerCase())) {
            return cb(new Error(`Extensión de archivo no permitida. Extensiones permitidas: ${allowedExtensions.join(', ')}`));
        }
        // 3. Validación de nombre
        if (!file.originalname || file.originalname.trim().length === 0) {
            return cb(new Error('El nombre del archivo no puede estar vacío'));
        }
        // 4. Validación de caracteres peligrosos (solo los más críticos)
        // Permitir espacios y caracteres comunes, pero rechazar path traversal
        if (file.originalname.includes('..')) {
            return cb(new Error('El nombre del archivo contiene caracteres peligrosos'));
        }
        // 5. Validación de longitud del nombre
        if (file.originalname.length > 255) {
            return cb(new Error('El nombre del archivo es demasiado largo'));
        }
        // Nota: La validación de tamaño se hace en los límites de multer, no aquí
        // porque file.size puede no estar disponible en este punto
        cb(null, true);
    }
    catch (error) {
        console.error('Error en fileFilter:', error);
        cb(new Error('Error durante la validación del archivo'));
    }
};
// Configuración de multer mejorada
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 10, // Máximo 10 archivos por request
    },
});
// Middleware para validación de seguridad post-upload
const securityValidationMiddleware = async (req, res, next) => {
    var _a;
    if (!req.file) {
        return next();
    }
    try {
        // Realizar validación de seguridad completa
        const securityResult = (0, security_utils_1.performSecurityValidation)(req.file);
        // Registrar evento de seguridad
        (0, security_utils_1.logSecurityEvent)({
            type: securityResult.isValid ? 'file_upload' : 'file_rejected',
            userId: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || 'anonymous',
            filename: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            hash: securityResult.hash,
            errors: securityResult.errors,
            warnings: securityResult.warnings,
            ipAddress: req.ip || req.connection.remoteAddress
        });
        // Si hay errores de seguridad, rechazar el archivo
        if (!securityResult.isValid) {
            return res.status(400).json({
                message: 'Archivo rechazado por razones de seguridad',
                errors: securityResult.errors
            });
        }
        // Si hay advertencias, agregarlas a la respuesta pero permitir el archivo
        if (securityResult.warnings.length > 0) {
            req.securityWarnings = securityResult.warnings;
        }
        // Agregar información de seguridad al request
        req.fileSecurityInfo = {
            hash: securityResult.hash,
            validated: true,
            warnings: securityResult.warnings
        };
        next();
    }
    catch (error) {
        console.error('Error en validación de seguridad:', error);
        return res.status(500).json({
            message: 'Error durante la validación de seguridad del archivo'
        });
    }
};
exports.securityValidationMiddleware = securityValidationMiddleware;
// Middleware para manejar errores de multer
const handleUploadError = (error, req, res, next) => {
    var _a;
    console.error('Error en handleUploadError:', error);
    console.error('Error type:', (_a = error === null || error === void 0 ? void 0 : error.constructor) === null || _a === void 0 ? void 0 : _a.name);
    console.error('Error message:', error === null || error === void 0 ? void 0 : error.message);
    console.error('Error code:', error === null || error === void 0 ? void 0 : error.code);
    // Verificar si es un error de multer
    if (error instanceof multer_1.default.MulterError) {
        console.error('Es un error de multer:', error.code);
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    message: `El archivo excede el tamaño máximo permitido de ${MAX_FILE_SIZE / (1024 * 1024)}MB`
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    message: 'Se excedió el número máximo de archivos permitidos (10)'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    message: 'Campo de archivo inesperado'
                });
            default:
                return res.status(400).json({
                    message: `Error al procesar el archivo: ${error.message || error.code}`
                });
        }
    }
    // Si hay un mensaje de error (por ejemplo, del fileFilter)
    if (error && error.message) {
        console.error('Error con mensaje:', error.message);
        return res.status(400).json({
            message: error.message
        });
    }
    // Si no es un error conocido, pasar al siguiente middleware de error
    console.error('Error desconocido, pasando al siguiente middleware');
    next(error);
};
exports.handleUploadError = handleUploadError;
// Función de utilidad para validar archivos (mantener compatibilidad)
const validateFile = (file) => {
    if (!file) {
        return { isValid: false, error: 'No se ha proporcionado ningún archivo' };
    }
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
        return {
            isValid: false,
            error: `Tipo de archivo no permitido. Tipos permitidos: ${Object.values(ALLOWED_MIME_TYPES).join(', ')}`
        };
    }
    if (file.size > MAX_FILE_SIZE) {
        return {
            isValid: false,
            error: `El archivo excede el tamaño máximo permitido de ${MAX_FILE_SIZE / (1024 * 1024)}MB`
        };
    }
    return { isValid: true };
};
exports.validateFile = validateFile;
