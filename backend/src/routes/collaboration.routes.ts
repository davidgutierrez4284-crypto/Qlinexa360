import { Router } from 'express';
import { inviteExternalDoctor } from '../controllers/collaboration.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/invite-external', authMiddleware(['DOCTOR']), inviteExternalDoctor);

export default router;


