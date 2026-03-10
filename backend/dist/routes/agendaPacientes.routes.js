"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agendaPacientes_controller_1 = require("../controllers/agendaPacientes.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const router = (0, express_1.Router)();
// Rutas protegidas (doctor o asistente con permiso de citas)
router.get('/config', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), agendaPacientes_controller_1.AgendaPacientesController.getAgendaConfig);
router.put('/config', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), agendaPacientes_controller_1.AgendaPacientesController.updateAgendaConfig);
router.post('/config/send-link', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), agendaPacientes_controller_1.AgendaPacientesController.sendLinkToPatients);
router.get('/patient/:patientId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), agendaPacientes_controller_1.AgendaPacientesController.getPatientAppointments);
// Rutas públicas (para pacientes)
router.get('/doctor/:doctorUsername', agendaPacientes_controller_1.AgendaPacientesController.getDoctorInfo);
router.get('/doctor/:doctorUsername/slots', agendaPacientes_controller_1.AgendaPacientesController.getAvailableSlots);
router.post('/doctor/:doctorUsername/appointment', agendaPacientes_controller_1.AgendaPacientesController.createAppointment);
exports.default = router;
