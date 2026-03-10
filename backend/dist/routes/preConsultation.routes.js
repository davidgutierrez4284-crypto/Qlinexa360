"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const preConsultation_controller_1 = require("../controllers/preConsultation.controller");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
// Rutas públicas (sin autenticación) - para que el paciente acceda con el token
router.get('/token/:token', preConsultation_controller_1.getPreConsultationByToken);
router.put('/token/:token/save', preConsultation_controller_1.savePreConsultationData);
router.post('/token/:token/complete', preConsultation_controller_1.completePreConsultation);
// Subida de archivos en pre-consulta (usa token, no requiere JWT)
router.post('/token/:token/upload', preConsultation_controller_1.validatePreConsultationToken, upload_middleware_1.upload.single('file'), upload_middleware_1.handleUploadError, preConsultation_controller_1.uploadFileForPreConsultation);
// Rutas protegidas - para doctores y asistentes
router.post('/generate-link/:appointmentId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), preConsultation_controller_1.generatePreConsultationLink);
router.get('/appointment/:appointmentId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), preConsultation_controller_1.getPreConsultationByAppointment);
exports.default = router;
