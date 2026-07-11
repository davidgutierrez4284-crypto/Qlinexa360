import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AffiliateAdminController } from '../controllers/affiliateAdmin.controller';

const router = Router();

// Todas las rutas requieren rol ADMIN.
router.use(authMiddleware(['ADMIN']));

// Afiliados
router.get('/', AffiliateAdminController.listAffiliates);
router.post('/', AffiliateAdminController.createAffiliate);
router.get('/detail/:id', AffiliateAdminController.getAffiliateDetail);
router.patch('/:id', AffiliateAdminController.updateAffiliate);
router.post('/:id/pay-paypal', AffiliateAdminController.payAffiliatePaypal);

// Códigos (pool)
router.post('/codes', AffiliateAdminController.generateCode);
router.post('/codes/batch', AffiliateAdminController.generateCodesBatch);
router.get('/codes', AffiliateAdminController.listCodes);
router.get('/codes/export', AffiliateAdminController.exportCodesExcel);

// Regla de comisión
router.get('/commission-rule', AffiliateAdminController.getCommissionRule);
router.put('/commission-rule', AffiliateAdminController.upsertCommissionRule);

// Comisiones
router.get('/commissions', AffiliateAdminController.listCommissions);
router.get('/commissions/export', AffiliateAdminController.exportCommissionsExcel);
router.post('/commissions/:id/approve', AffiliateAdminController.approveCommission);
router.post('/commissions/:id/pay', AffiliateAdminController.markCommissionPaid);

export default router;
