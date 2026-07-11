"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clinicalIntake_controller_1 = require("../controllers/clinicalIntake.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
// Público
router.get('/public/doctor/:doctorSlug', clinicalIntake_controller_1.ClinicalIntakeController.getPortalInfoBySlug);
router.post('/public/doctor/:doctorSlug/start', clinicalIntake_controller_1.ClinicalIntakeController.startPortalBySlug);
router.get('/public/portal/:portalToken', clinicalIntake_controller_1.ClinicalIntakeController.getPortalInfo);
router.post('/public/portal/:portalToken/start', clinicalIntake_controller_1.ClinicalIntakeController.startPortal);
router.get('/public/:token', clinicalIntake_controller_1.ClinicalIntakeController.getPublic);
router.put('/public/:token', clinicalIntake_controller_1.ClinicalIntakeController.savePublicDraft);
router.post('/public/:token/submit', clinicalIntake_controller_1.ClinicalIntakeController.submitPublic);
router.post('/public/:token/upload', upload_middleware_1.upload.single('file'), upload_middleware_1.handleUploadError, clinicalIntake_controller_1.ClinicalIntakeController.uploadPublic);
// Staff
router.get('/portal-link', auth_middleware_1.authenticateToken, clinicalIntake_controller_1.ClinicalIntakeController.getPortalLink);
router.post('/portal-link/regenerate', auth_middleware_1.authenticateToken, clinicalIntake_controller_1.ClinicalIntakeController.regeneratePortalLink);
router.get('/:id', auth_middleware_1.authenticateToken, clinicalIntake_controller_1.ClinicalIntakeController.getStaff);
router.post('/:id/convert', auth_middleware_1.authenticateToken, clinicalIntake_controller_1.ClinicalIntakeController.convertStaff);
router.get('/', auth_middleware_1.authenticateToken, clinicalIntake_controller_1.ClinicalIntakeController.listStaff);
router.post('/send-link', auth_middleware_1.authenticateToken, clinicalIntake_controller_1.ClinicalIntakeController.sendLink);
router.patch('/:id', auth_middleware_1.authenticateToken, clinicalIntake_controller_1.ClinicalIntakeController.patchStaff);
exports.default = router;
