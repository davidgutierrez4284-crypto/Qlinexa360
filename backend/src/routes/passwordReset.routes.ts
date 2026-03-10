import { Router } from 'express';
import { PasswordResetController } from '../controllers/passwordReset.controller';

const router = Router();

// Ruta pública para solicitar recuperación de contraseña
router.post('/request', PasswordResetController.requestPasswordReset);

// Ruta pública para verificar token de recuperación
router.get('/verify/:token', PasswordResetController.verifyResetToken);

// Ruta pública para resetear contraseña
router.post('/reset', PasswordResetController.resetPassword);

export default router;
