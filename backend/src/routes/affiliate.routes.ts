import { Router } from 'express';
import { requireAffiliateAccess } from '../middlewares/auth.middleware';
import { AffiliateController } from '../controllers/affiliate.controller';

const router = Router();

router.get('/validate', AffiliateController.validateAffiliateCode);

// El acceso al módulo es una capacidad: rol AFFILIATE o cualquier usuario con perfil de afiliado.
router.use(requireAffiliateAccess);

router.get('/me', AffiliateController.getMyProfile);
router.get('/dashboard', AffiliateController.getMyDashboard);
router.get('/referrals', AffiliateController.getMyReferrals);
router.get('/commissions', AffiliateController.getMyCommissions);
router.get('/bank-account', AffiliateController.getMyBankAccount);
router.put('/bank-account', AffiliateController.upsertBankAccount);

export default router;
