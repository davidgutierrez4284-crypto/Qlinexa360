"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const prescription_controller_1 = require("../controllers/prescription.controller");
const router = (0, express_1.Router)();
// Plantillas de recetas
router.get('/templates', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), prescription_controller_1.getPrescriptionTemplates);
router.post('/templates', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), prescription_controller_1.createPrescriptionTemplate);
router.put('/templates/:id', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), prescription_controller_1.updatePrescriptionTemplate);
router.delete('/templates/:id', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), prescription_controller_1.deletePrescriptionTemplate);
// Recetas asociadas a consulta
router.post('/medical-records/:medicalRecordId/prescriptions', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), prescription_controller_1.createPrescription);
router.get('/medical-records/:medicalRecordId/prescriptions', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'PATIENT']), prescription_controller_1.getPrescriptionsByMedicalRecord);
router.post('/medical-records/:medicalRecordId/prescriptions/generate', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), prescription_controller_1.generatePdfFromTemplate);
exports.default = router;
