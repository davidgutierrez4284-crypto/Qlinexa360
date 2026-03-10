// Rutas de autenticación para Qlinexa360
import { Router } from 'express';
import { register, login, updateProfilePicture, getCurrentUser, setupTwoFactor, verifyTwoFactor, sendTwoFactorRecoveryEmail, verifyTwoFactorRecovery } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { upload, handleUploadError } from '../middlewares/upload.middleware';

const router = Router();

// Endpoint para registrar usuario
router.post('/register', register);
// Endpoint para login de usuario
router.post('/login', login);
// Endpoints para 2FA
router.post('/2fa/setup', setupTwoFactor);
router.post('/2fa/verify', verifyTwoFactor);
router.post('/2fa/recovery-email', sendTwoFactorRecoveryEmail);
router.post('/2fa/recovery-verify', verifyTwoFactorRecovery);
// Endpoint para obtener datos del usuario actual (requiere autenticación)
router.get('/me', authMiddleware(['DOCTOR', 'PATIENT', 'ASISTENTE', 'ADMIN']), getCurrentUser);
// Endpoint para actualizar foto de perfil (requiere autenticación)
router.put('/profile-picture', 
  authMiddleware(['DOCTOR', 'PATIENT', 'ASISTENTE', 'ADMIN']), 
  upload.single('profilePicture'), 
  handleUploadError,
  updateProfilePicture
);

export default router; 