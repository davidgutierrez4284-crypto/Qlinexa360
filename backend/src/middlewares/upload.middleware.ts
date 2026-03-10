import multer from 'multer';
import { Request } from 'express';
import { performSecurityValidation, logSecurityEvent } from '../utils/security.utils';

// Configuración de almacenamiento en memoria
const storage = multer.memoryStorage();

// Tipos de archivo permitidos
const ALLOWED_MIME_TYPES: Record<string, string> = {
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
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  try {
    // 1. Validación básica de tipo MIME
    if (!ALLOWED_MIME_TYPES[file.mimetype as keyof typeof ALLOWED_MIME_TYPES]) {
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
  } catch (error) {
    console.error('Error en fileFilter:', error);
    cb(new Error('Error durante la validación del archivo'));
  }
};

// Configuración de multer mejorada
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Máximo 10 archivos por request
  },
});

// Middleware para validación de seguridad post-upload
export const securityValidationMiddleware = async (req: Request, res: any, next: any) => {
  if (!req.file) {
    return next();
  }

  try {
    // Realizar validación de seguridad completa
    const securityResult = performSecurityValidation(req.file);
    
    // Registrar evento de seguridad
    logSecurityEvent({
      type: securityResult.isValid ? 'file_upload' : 'file_rejected',
      userId: (req as any).user?.userId || 'anonymous',
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
      (req as any).securityWarnings = securityResult.warnings;
    }

    // Agregar información de seguridad al request
    (req as any).fileSecurityInfo = {
      hash: securityResult.hash,
      validated: true,
      warnings: securityResult.warnings
    };

    next();
  } catch (error) {
    console.error('Error en validación de seguridad:', error);
    return res.status(500).json({
      message: 'Error durante la validación de seguridad del archivo'
    });
  }
};

// Middleware para manejar errores de multer
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  console.error('Error en handleUploadError:', error);
  console.error('Error type:', error?.constructor?.name);
  console.error('Error message:', error?.message);
  console.error('Error code:', (error as any)?.code);
  
  // Verificar si es un error de multer
  if (error instanceof multer.MulterError) {
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

// Función de utilidad para validar archivos (mantener compatibilidad)
export const validateFile = (file: Express.Multer.File): { isValid: boolean; error?: string } => {
  if (!file) {
    return { isValid: false, error: 'No se ha proporcionado ningún archivo' };
  }

  if (!ALLOWED_MIME_TYPES[file.mimetype as keyof typeof ALLOWED_MIME_TYPES]) {
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