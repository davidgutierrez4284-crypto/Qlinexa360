"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passwordReset_controller_1 = require("../controllers/passwordReset.controller");
const router = (0, express_1.Router)();
// Ruta pública para solicitar recuperación de contraseña
router.post('/request', passwordReset_controller_1.PasswordResetController.requestPasswordReset);
// Ruta pública para verificar token de recuperación
router.get('/verify/:token', passwordReset_controller_1.PasswordResetController.verifyResetToken);
// Ruta pública para resetear contraseña
router.post('/reset', passwordReset_controller_1.PasswordResetController.resetPassword);
exports.default = router;
