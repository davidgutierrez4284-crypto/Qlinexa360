import multer from 'multer';
import { Request } from 'express';

// Configuración de almacenamiento en memoria para videos
const storage = multer.memoryStorage();

// Tipos MIME permitidos para videos
const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogg',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
};

// Tamaño máximo de video (500MB)
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

// Filtro de archivos de video
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  try {
    // Validación de tipo MIME
    if (!ALLOWED_VIDEO_TYPES[file.mimetype as keyof typeof ALLOWED_VIDEO_TYPES]) {
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
  } catch (error) {
    cb(new Error('Error durante la validación del video'));
  }
};

// Configuración de multer para videos
export const videoUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
    files: 1, // Solo un video por request
  },
});

// Middleware para manejar errores de multer en videos
export const handleVideoUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
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

