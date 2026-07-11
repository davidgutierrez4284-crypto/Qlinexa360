"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const affiliateAdmin_controller_1 = require("../controllers/affiliateAdmin.controller");
const router = (0, express_1.Router)();
// Todas las rutas requieren rol ADMIN.
router.use((0, auth_middleware_1.authMiddleware)(['ADMIN']));
// Afiliados
router.get('/', affiliateAdmin_controller_1.AffiliateAdminController.listAffiliates);
router.post('/', affiliateAdmin_controller_1.AffiliateAdminController.createAffiliate);
router.get('/detail/:id', affiliateAdmin_controller_1.AffiliateAdminController.getAffiliateDetail);
router.patch('/:id', affiliateAdmin_controller_1.AffiliateAdminController.updateAffiliate);
router.post('/:id/pay-paypal', affiliateAdmin_controller_1.AffiliateAdminController.payAffiliatePaypal);
// Códigos (pool)
router.post('/codes', affiliateAdmin_controller_1.AffiliateAdminController.generateCode);
router.post('/codes/batch', affiliateAdmin_controller_1.AffiliateAdminController.generateCodesBatch);
router.get('/codes', affiliateAdmin_controller_1.AffiliateAdminController.listCodes);
router.get('/codes/export', affiliateAdmin_controller_1.AffiliateAdminController.exportCodesExcel);
// Regla de comisión
router.get('/commission-rule', affiliateAdmin_controller_1.AffiliateAdminController.getCommissionRule);
router.put('/commission-rule', affiliateAdmin_controller_1.AffiliateAdminController.upsertCommissionRule);
// Comisiones
router.get('/commissions', affiliateAdmin_controller_1.AffiliateAdminController.listCommissions);
router.get('/commissions/export', affiliateAdmin_controller_1.AffiliateAdminController.exportCommissionsExcel);
router.post('/commissions/:id/approve', affiliateAdmin_controller_1.AffiliateAdminController.approveCommission);
router.post('/commissions/:id/pay', affiliateAdmin_controller_1.AffiliateAdminController.markCommissionPaid);
exports.default = router;
