"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Rutas de autenticación para Qlinexa360
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
// Endpoint para registrar usuario
router.post('/register', auth_controller_1.register);
// Endpoint para login de usuario
router.post('/login', auth_controller_1.login);
// Endpoints para 2FA
router.post('/2fa/setup', auth_controller_1.setupTwoFactor);
router.post('/2fa/verify', auth_controller_1.verifyTwoFactor);
router.post('/2fa/recovery-email', auth_controller_1.sendTwoFactorRecoveryEmail);
router.post('/2fa/recovery-verify', auth_controller_1.verifyTwoFactorRecovery);
// Endpoint para obtener datos del usuario actual (requiere autenticación)
router.get('/me', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'PATIENT', 'ASISTENTE', 'ADMIN']), auth_controller_1.getCurrentUser);
// Endpoint para actualizar foto de perfil (requiere autenticación)
router.put('/profile-picture', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'PATIENT', 'ASISTENTE', 'ADMIN']), upload_middleware_1.upload.single('profilePicture'), upload_middleware_1.handleUploadError, auth_controller_1.updateProfilePicture);
exports.default = router;
