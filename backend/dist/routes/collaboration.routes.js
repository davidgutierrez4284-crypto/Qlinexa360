"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const collaboration_controller_1 = require("../controllers/collaboration.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post('/invite-external', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), collaboration_controller_1.inviteExternalDoctor);
exports.default = router;
