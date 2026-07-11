import { Router } from 'express';
import { AppointmentConfirmationController } from '../controllers/appointmentConfirmation.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';

const router = Router();

// Rutas públicas para confirmación de citas (sin autenticación)
router.get('/info/:token', AppointmentConfirmationController.getAppointmentByToken);
router.post('/confirm/:token', AppointmentConfirmationController.confirmAppointment);
router.post('/cancel/:token', AppointmentConfirmationController.cancelAppointment);
// Obtener horarios disponibles para reprogramación (público, basado en token)
router.get('/reschedule/:token/available-slots', AppointmentConfirmationController.getAvailableRescheduleSlots);
router.post('/reschedule/:token', AppointmentConfirmationController.requestReschedule);
router.get('/refund-request/:token', AppointmentConfirmationController.getRefundContextByToken);
router.post('/refund-request/:token', AppointmentConfirmationController.createRefundRequestByToken);

// Rutas protegidas (DOCTOR y ASISTENTE con permiso de citas)
const doctorOrAssistantAppointments = [authMiddleware(['DOCTOR', 'ASISTENTE']), AssistantMiddleware.checkAssistantModulePermission('appointments')];

// Obtener estado de confirmaciones para un doctor
router.get('/status', ...doctorOrAssistantAppointments, AppointmentConfirmationController.getConfirmationStatus);

// Crear solicitud de confirmación
router.post('/request', ...doctorOrAssistantAppointments, AppointmentConfirmationController.createConfirmationRequest);

// Gestión de lista de espera
router.get('/waitlist', ...doctorOrAssistantAppointments, AppointmentConfirmationController.getWaitlist);
router.get('/waitlist/available-slots', ...doctorOrAssistantAppointments, AppointmentConfirmationController.getWaitlistAvailableSlots);
router.post('/waitlist/assign', ...doctorOrAssistantAppointments, AppointmentConfirmationController.assignWaitlistToSlot);

// Cancelaciones y reprogramaciones
router.get('/cancellations', ...doctorOrAssistantAppointments, AppointmentConfirmationController.getCancellations);
router.get('/reschedules', ...doctorOrAssistantAppointments, AppointmentConfirmationController.getRescheduleRequests);

// Aprobar o rechazar cita
router.put('/appointment/:appointmentId/status', ...doctorOrAssistantAppointments, AppointmentConfirmationController.updateAppointmentStatus);

export default router;
