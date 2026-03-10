"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleVideoUploadError = exports.videoUpload = void 0;
const multer_1 = __importDefault(require("multer"));
// Configuración de almacenamiento en memoria para videos
const storage = multer_1.default.memoryStorage();
// Tipos MIME permitidos para videos
const ALLOWED_VIDEO_TYPES = {
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogg',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
};
// Tamaño máximo de video (500MB)
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
// Filtro de archivos de video
const fileFilter = (req, file, cb) => {
    try {
        // Validación de tipo MIME
        if (!ALLOWED_VIDEO_TYPES[file.mimetype]) {
            return cb(new Error(`Tipo de video no permitido. Tipos permitidos: ${Object.values(ALLOWED_VIDEO_TYPES).join(', ')}`));
        }
        // Validación de extensión
        const fileExtension = file.originalname.toLowerCase().split('.').pop();
        const allowedExtensions = Object.values(ALLOWED_VIDEO_TYPES).map(ext => ext.replace('.', ''));
        if (!fileExtension || !allowedExtensions.includes(fileExtension.toLowerCase())) {
            return cb(new Error(`Extensión de video no permitida. Extensiones permitidas: ${allowedExtensions.join(', ')}`));
        }
        // Validación de tamaño
        if (file.size > MAX_VIDEO_SIZE) {
            return cb(new Error(`El video excede el tamaño máximo permitido de ${MAX_VIDEO_SIZE / (1024 * 1024)}MB`));
        }
        // Validación de nombre
        if (!file.originalname || file.originalname.trim().length === 0) {
            return cb(new Error('El nombre del video no puede estar vacío'));
        }
        // Validación de caracteres especiales
        const invalidChars = /[<>:"/\\|?*]/;
        if (invalidChars.test(file.originalname)) {
            return cb(new Error('El nombre del video contiene caracteres no permitidos'));
        }
        // Validación de longitud del nombre
        if (file.originalname.length > 255) {
            return cb(new Error('El nombre del video es demasiado largo'));
        }
        // Validación de path traversal
        if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
            return cb(new Error('El nombre del video contiene caracteres peligrosos'));
        }
        cb(null, true);
    }
    catch (error) {
        cb(new Error('Error durante la validación del video'));
    }
};
// Configuración de multer para videos
exports.videoUpload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_VIDEO_SIZE,
        files: 1, // Solo un video por request
    },
});
// Middleware para manejar errores de multer en videos
const handleVideoUploadError = (error, req, res, next) => {
    if (error instanceof multer_1.default.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    message: `El video excede el tamaño máximo permitido de ${MAX_VIDEO_SIZE / (1024 * 1024)}MB`
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    message: 'Solo se permite un video por solicitud'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    message: 'Campo de video inesperado'
                });
            default:
                return res.status(400).json({
                    message: 'Error al procesar el video'
                });
        }
    }
    if (error.message) {
        return res.status(400).json({
            message: error.message
        });
    }
    next(error);
};
exports.handleVideoUploadError = handleVideoUploadError;
