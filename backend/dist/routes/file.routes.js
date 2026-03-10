"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const file_controller_1 = require("../controllers/file.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const security_middleware_1 = require("../middlewares/security.middleware");
const antivirus_utils_1 = require("../utils/antivirus.utils");
const logger_utils_1 = require("../utils/logger.utils");
const router = (0, express_1.Router)();
// Aplicar middlewares de seguridad globales
router.use(security_middleware_1.securityHeaders);
router.use(security_middleware_1.requestSizeLimit);
router.use(security_middleware_1.suspiciousActivityDetection);
router.use((0, logger_utils_1.createLoggingMiddleware)()); // Nuevo middleware de logging
router.use(security_middleware_1.securityLogging);
// Crear middleware antivirus
const antivirusMiddleware = (0, antivirus_utils_1.createAntivirusMiddleware)();
// Ruta de upload con todas las protecciones
router.post('/upload', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'PATIENT']), // Autenticación
security_middleware_1.csrfProtection, // Protección CSRF
security_middleware_1.uploadRateLimit, // Rate limiting
upload_middleware_1.upload.single('file'), // Multer upload
upload_middleware_1.handleUploadError, // Manejo de errores de Multer
security_middleware_1.sanitizeFilename, // Sanitización de nombres
antivirusMiddleware, // Escaneo antivirus
upload_middleware_1.securityValidationMiddleware, // Validación de seguridad avanzada
file_controller_1.uploadFile // Controlador final
);
const assistantClinicalHistoryOnly = (req, res, next) => {
    var _a;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === 'ASISTENTE') {
        return assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('clinicalHistory')(req, res, next);
    }
    return next();
};
// Para signed-url: permitir a asistentes acceder a su propia foto de perfil sin permiso clinicalHistory
const signedUrlOrProfilePhotoForAssistant = (req, res, next) => {
    var _a, _b;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === 'ASISTENTE') {
        const url = (_b = req.query) === null || _b === void 0 ? void 0 : _b.url;
        if (url && url.includes('profile-photos') && url.includes(req.user.userId)) {
            return next(); // Es su propia foto de perfil, permitir
        }
        return assistantClinicalHistoryOnly(req, res, next);
    }
    return next();
};
// Rutas de acceso a archivos (incluye ADMIN para fotos de perfil)
router.get('/signed-url', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'PATIENT', 'ASISTENTE', 'ADMIN']), signedUrlOrProfilePhotoForAssistant, file_controller_1.getSignedUrlForS3);
router.get('/secure/:fileId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'PATIENT', 'ASISTENTE', 'ADMIN']), assistantClinicalHistoryOnly, file_controller_1.getFileSecure);
exports.default = router;
