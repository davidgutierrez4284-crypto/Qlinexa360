"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const affiliate_controller_1 = require("../controllers/affiliate.controller");
const router = (0, express_1.Router)();
router.get('/validate', affiliate_controller_1.AffiliateController.validateAffiliateCode);
// El acceso al módulo es una capacidad: rol AFFILIATE o cualquier usuario con perfil de afiliado.
router.use(auth_middleware_1.requireAffiliateAccess);
router.get('/me', affiliate_controller_1.AffiliateController.getMyProfile);
router.get('/dashboard', affiliate_controller_1.AffiliateController.getMyDashboard);
router.get('/referrals', affiliate_controller_1.AffiliateController.getMyReferrals);
router.get('/commissions', affiliate_controller_1.AffiliateController.getMyCommissions);
router.get('/bank-account', affiliate_controller_1.AffiliateController.getMyBankAccount);
router.put('/bank-account', affiliate_controller_1.AffiliateController.upsertBankAccount);
exports.default = router;
