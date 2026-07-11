"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teleconsultation_controller_1 = require("../controllers/teleconsultation.controller");
const router = (0, express_1.Router)();
// Rutas públicas (sin autenticación) - el token en la URL actúa como autenticación
router.get('/info/:token', teleconsultation_controller_1.getTeleconsultationInfoByToken);
router.post('/sign-consent/:token', teleconsultation_controller_1.signTeleconsultationConsent);
router.get('/refund-request/:token', teleconsultation_controller_1.getTeleconsultationRefundContext);
router.post('/refund-request/:token', teleconsultation_controller_1.createTeleconsultationRefundRequest);
exports.default = router;
