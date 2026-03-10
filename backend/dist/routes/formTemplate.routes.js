"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const formTemplate_controller_1 = require("../controllers/formTemplate.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Ruta para obtener las plantillas de formulario para el doctor autenticado
router.get('/', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE', 'PATIENT']), // Permitir acceso a todos los roles autenticados
formTemplate_controller_1.getFormTemplates);
exports.default = router;
