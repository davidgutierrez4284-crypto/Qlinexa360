import { Router } from 'express';
import { submitFeedback } from '../controllers/feedback.controller';
import { optionalAuthenticate } from '../middlewares/auth.middleware';

const router = Router();

// Ruta para enviar feedback (sugerencias o quejas)
// - Con sesión: usa datos del usuario autenticado
// - Sin sesión: requiere email en el body (usuarios externos)
// En ambos casos el correo llega a admin@qlinexa360.com
router.post('/', optionalAuthenticate, submitFeedback);

export default router;

