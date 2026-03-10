"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const invitation_controller_1 = require("../controllers/invitation.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Rutas protegidas (requieren autenticación)
router.post('/create', auth_middleware_1.authMiddleware, invitation_controller_1.createPatientInvitation);
router.post('/resend', auth_middleware_1.authMiddleware, invitation_controller_1.resendPatientInvitation);
router.get('/doctor', auth_middleware_1.authMiddleware, invitation_controller_1.getDoctorInvitations);
// Rutas públicas (no requieren autenticación)
router.get('/validate/:token', invitation_controller_1.validateInvitationToken);
router.post('/complete', invitation_controller_1.completePatientRegistration);
exports.default = router;
