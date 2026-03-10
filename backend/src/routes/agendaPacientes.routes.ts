import { Router } from 'express';
import { AgendaPacientesController } from '../controllers/agendaPacientes.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';

const router = Router();

// Rutas protegidas (doctor o asistente con permiso de citas)
router.get('/config', authMiddleware(['DOCTOR', 'ASISTENTE']), AssistantMiddleware.checkAssistantModulePermission('appointments'), AgendaPacientesController.getAgendaConfig);
router.put('/config', authMiddleware(['DOCTOR', 'ASISTENTE']), AssistantMiddleware.checkAssistantModulePermission('appointments'), AgendaPacientesController.updateAgendaConfig);
router.post('/config/send-link', authMiddleware(['DOCTOR', 'ASISTENTE']), AssistantMiddleware.checkAssistantModulePermission('appointments'), AgendaPacientesController.sendLinkToPatients);
router.get('/patient/:patientId', authMiddleware(['DOCTOR', 'ASISTENTE']), AgendaPacientesController.getPatientAppointments);

// Rutas públicas (para pacientes)
router.get('/doctor/:doctorUsername', AgendaPacientesController.getDoctorInfo);
router.get('/doctor/:doctorUsername/slots', AgendaPacientesController.getAvailableSlots);
router.post('/doctor/:doctorUsername/appointment', AgendaPacientesController.createAppointment);

export default router; 