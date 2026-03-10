"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const assistantInvitation_controller_1 = require("../controllers/assistantInvitation.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Rutas protegidas (requieren autenticación)
router.post('/create', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), assistantInvitation_controller_1.createAssistantInvitation);
router.get('/doctor', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), assistantInvitation_controller_1.getDoctorAssistantInvitations);
// Rutas públicas (no requieren autenticación)
router.get('/validate/:token', assistantInvitation_controller_1.validateAssistantInvitationToken);
router.post('/complete', assistantInvitation_controller_1.completeAssistantRegistration);
exports.default = router;
