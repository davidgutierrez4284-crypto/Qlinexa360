"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const collaborativeWork_controller_1 = require("../controllers/collaborativeWork.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Rutas para trabajo colaborativo
router.use((0, auth_middleware_1.authMiddleware)(['DOCTOR']));
// Agregar colaborador a un padecimiento
router.post('/collaborators', collaborativeWork_controller_1.CollaborativeWorkController.addCollaborator);
// Obtener colaboradores de un padecimiento
router.get('/collaborators/:padecimientoId', collaborativeWork_controller_1.CollaborativeWorkController.getCollaborators);
// Verificar permisos de edición
router.get('/permissions/:medicalRecordId', collaborativeWork_controller_1.CollaborativeWorkController.checkEditPermissions);
// Bloquear edición colaborativa
router.post('/block-editing', collaborativeWork_controller_1.CollaborativeWorkController.blockCollaborativeEditing);
// Obtener consultas colaborativas
router.get('/consultations/:patientId/:padecimientoId', collaborativeWork_controller_1.CollaborativeWorkController.getCollaborativeConsultations);
exports.default = router;
