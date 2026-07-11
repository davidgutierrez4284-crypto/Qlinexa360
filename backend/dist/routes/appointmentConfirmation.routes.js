"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const appointmentConfirmation_controller_1 = require("../controllers/appointmentConfirmation.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const router = (0, express_1.Router)();
// Rutas públicas para confirmación de citas (sin autenticación)
router.get('/info/:token', appointmentConfirmation_controller_1.AppointmentConfirmationController.getAppointmentByToken);
router.post('/confirm/:token', appointmentConfirmation_controller_1.AppointmentConfirmationController.confirmAppointment);
router.post('/cancel/:token', appointmentConfirmation_controller_1.AppointmentConfirmationController.cancelAppointment);
// Obtener horarios disponibles para reprogramación (público, basado en token)
router.get('/reschedule/:token/available-slots', appointmentConfirmation_controller_1.AppointmentConfirmationController.getAvailableRescheduleSlots);
router.post('/reschedule/:token', appointmentConfirmation_controller_1.AppointmentConfirmationController.requestReschedule);
router.get('/refund-request/:token', appointmentConfirmation_controller_1.AppointmentConfirmationController.getRefundContextByToken);
router.post('/refund-request/:token', appointmentConfirmation_controller_1.AppointmentConfirmationController.createRefundRequestByToken);
// Rutas protegidas (DOCTOR y ASISTENTE con permiso de citas)
const doctorOrAssistantAppointments = [(0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments')];
// Obtener estado de confirmaciones para un doctor
router.get('/status', ...doctorOrAssistantAppointments, appointmentConfirmation_controller_1.AppointmentConfirmationController.getConfirmationStatus);
// Crear solicitud de confirmación
router.post('/request', ...doctorOrAssistantAppointments, appointmentConfirmation_controller_1.AppointmentConfirmationController.createConfirmationRequest);
// Gestión de lista de espera
router.get('/waitlist', ...doctorOrAssistantAppointments, appointmentConfirmation_controller_1.AppointmentConfirmationController.getWaitlist);
router.get('/waitlist/available-slots', ...doctorOrAssistantAppointments, appointmentConfirmation_controller_1.AppointmentConfirmationController.getWaitlistAvailableSlots);
router.post('/waitlist/assign', ...doctorOrAssistantAppointments, appointmentConfirmation_controller_1.AppointmentConfirmationController.assignWaitlistToSlot);
// Cancelaciones y reprogramaciones
router.get('/cancellations', ...doctorOrAssistantAppointments, appointmentConfirmation_controller_1.AppointmentConfirmationController.getCancellations);
router.get('/reschedules', ...doctorOrAssistantAppointments, appointmentConfirmation_controller_1.AppointmentConfirmationController.getRescheduleRequests);
// Aprobar o rechazar cita
router.put('/appointment/:appointmentId/status', ...doctorOrAssistantAppointments, appointmentConfirmation_controller_1.AppointmentConfirmationController.updateAppointmentStatus);
exports.default = router;
