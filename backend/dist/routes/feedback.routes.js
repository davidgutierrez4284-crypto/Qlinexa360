"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const feedback_controller_1 = require("../controllers/feedback.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Ruta para enviar feedback (sugerencias o quejas)
// - Con sesión: usa datos del usuario autenticado
// - Sin sesión: requiere email en el body (usuarios externos)
// En ambos casos el correo llega a admin@qlinexa360.com
router.post('/', auth_middleware_1.optionalAuthenticate, feedback_controller_1.submitFeedback);
exports.default = router;
