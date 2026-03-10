"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schedule_controller_1 = require("../controllers/schedule.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const router = (0, express_1.Router)();
// Rutas para configuración de horarios
router.get('/config', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), schedule_controller_1.ScheduleController.getScheduleConfig);
router.put('/config', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), schedule_controller_1.ScheduleController.updateScheduleConfig);
exports.default = router;
