"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const assistant_controller_1 = require("../controllers/assistant.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
// Configurar multer para manejar archivos
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB máximo
    },
});
// Ruta pública para registro de asistentes (sin autenticación)
router.post('/register', upload.single('profilePhoto'), assistant_controller_1.AssistantController.registerAssistant);
// Ruta para que los asistentes obtengan sus doctores vinculados (requiere autenticación pero permite ASISTENTE)
router.get('/my-doctors', (0, auth_middleware_1.authMiddleware)(['ASISTENTE']), assistant_controller_1.AssistantController.getMyLinkedDoctors);
// Aplicar middleware de autenticación a las rutas protegidas (solo doctores)
router.use((0, auth_middleware_1.authMiddleware)(['DOCTOR']));
// Buscar asistentes por nombre o correo
router.get('/search', assistant_controller_1.AssistantController.searchAssistants);
// Obtener asistentes vinculados al doctor
router.get('/linked', assistant_controller_1.AssistantController.getLinkedAssistants);
// Vincular asistente al doctor
router.post('/link', assistant_controller_1.AssistantController.linkAssistant);
// Revocar acceso del asistente
router.delete('/revoke/:assistantId', assistant_controller_1.AssistantController.revokeAssistantAccess);
// Verificar permisos del asistente para un módulo específico
router.post('/check-permissions', assistant_controller_1.AssistantController.checkAssistantPermissions);
// Obtener información del asistente vinculado
router.get('/info/:assistantId', assistant_controller_1.AssistantController.getAssistantInfo);
exports.default = router;
