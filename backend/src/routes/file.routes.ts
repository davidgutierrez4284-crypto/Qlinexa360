import { Router } from 'express';
import { uploadFile, getSignedUrlForS3, getFileSecure } from '../controllers/file.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';
import { upload, handleUploadError, securityValidationMiddleware } from '../middlewares/upload.middleware';
import { 
  uploadRateLimit, 
  suspiciousActivityDetection, 
  securityHeaders, 
  requestSizeLimit, 
  sanitizeFilename, 
  securityLogging, 
  csrfProtection 
} from '../middlewares/security.middleware';
import { createAntivirusMiddleware } from '../utils/antivirus.utils';
import { createLoggingMiddleware, securityLogger } from '../utils/logger.utils';

const router = Router();

// Aplicar middlewares de seguridad globales
router.use(securityHeaders);
router.use(requestSizeLimit);
router.use(suspiciousActivityDetection);
router.use(createLoggingMiddleware()); // Nuevo middleware de logging
router.use(securityLogging);

// Crear middleware antivirus
const antivirusMiddleware = createAntivirusMiddleware();

// Ruta de upload con todas las protecciones
router.post(
  '/upload', 
  authMiddleware(['DOCTOR', 'PATIENT']), // Autenticación
  csrfProtection, // Protección CSRF
  uploadRateLimit, // Rate limiting
  upload.single('file'), // Multer upload
  handleUploadError, // Manejo de errores de Multer
  sanitizeFilename, // Sanitización de nombres
  antivirusMiddleware, // Escaneo antivirus
  securityValidationMiddleware, // Validación de seguridad avanzada
  uploadFile // Controlador final
);

const assistantClinicalHistoryOnly = (req: any, res: any, next: any) => {
  if (req.user?.role === 'ASISTENTE') {
    return AssistantMiddleware.checkAssistantModulePermission('clinicalHistory')(
      req,
      res,
      next
    );
  }
  return next();
};

// Para signed-url: permitir a asistentes acceder a su propia foto de perfil sin permiso clinicalHistory
const signedUrlOrProfilePhotoForAssistant = (req: any, res: any, next: any) => {
  if (req.user?.role === 'ASISTENTE') {
    const url = req.query?.url as string;
    if (url && url.includes('profile-photos') && url.includes(req.user.userId)) {
      return next(); // Es su propia foto de perfil, permitir
    }
    return assistantClinicalHistoryOnly(req, res, next);
  }
  return next();
};

// Rutas de acceso a archivos (incluye ADMIN para fotos de perfil)
router.get(
  '/signed-url',
  authMiddleware(['DOCTOR', 'PATIENT', 'ASISTENTE', 'ADMIN']),
  signedUrlOrProfilePhotoForAssistant,
  getSignedUrlForS3
);
router.get(
  '/secure/:fileId',
  authMiddleware(['DOCTOR', 'PATIENT', 'ASISTENTE', 'ADMIN']),
  assistantClinicalHistoryOnly,
  getFileSecure
);

export default router; 