import { Router } from 'express';
import { validateReferralCode, getMyReferralInfo, sendReferralInviteEmail, getReferralHistory } from '../controllers/referral.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.get('/validate', validateReferralCode);
router.get('/me', authMiddleware(['DOCTOR']), getMyReferralInfo);
router.get('/history', authMiddleware(['DOCTOR']), getReferralHistory);
router.post('/send-invite-email', authMiddleware(['DOCTOR']), sendReferralInviteEmail);

export default router;
