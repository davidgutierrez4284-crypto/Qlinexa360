"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clinicalCase_controller_1 = require("../controllers/clinicalCase.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const router = (0, express_1.Router)();
// Casos clínicos de un paciente
router.get('/patients/:patientId/cases', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), clinicalCase_controller_1.listClinicalCases);
router.post('/patients/:patientId/cases', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), clinicalCase_controller_1.createClinicalCase);
// Operaciones sobre un caso clínico específico
router.get('/cases/:caseId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), clinicalCase_controller_1.getClinicalCase);
router.put('/cases/:caseId', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), clinicalCase_controller_1.updateClinicalCase);
router.delete('/cases/:caseId', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), clinicalCase_controller_1.deleteClinicalCase);
// Notas clínicas dentro de un caso
router.get('/cases/:caseId/medical-records', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), clinicalCase_controller_1.listCaseMedicalRecords);
router.post('/cases/:caseId/medical-records', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), clinicalCase_controller_1.createCaseMedicalRecord);
exports.default = router;
