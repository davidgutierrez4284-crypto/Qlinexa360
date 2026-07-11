"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const doctor_controller_1 = require("../controllers/doctor.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const subscription_middleware_1 = require("../middlewares/subscription.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const invoice_controller_1 = require("../controllers/invoice.controller");
const reminder_controller_1 = require("../controllers/reminder.controller");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const router = (0, express_1.Router)();
// Ruta pública para búsqueda de doctores (para registro de asistentes)
router.get('/search', doctor_controller_1.searchDoctorsPublic);
// Ruta para obtener perfil del doctor
router.get('/profile', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE', 'PATIENT']), doctor_controller_1.getDoctorProfile);
router.get('/dashboard-stats', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), doctor_controller_1.getDashboardStats);
router.get('/patients', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), doctor_controller_1.getPatients);
router.get('/my-patients', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), doctor_controller_1.getAllMyPatients);
router.get('/patients/:patientId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), doctor_controller_1.getPatientDetails);
router.post('/patients/:patientId/refer', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), doctor_controller_1.referPatient);
// =================================================================
// RUTAS PARA NOTAS CLÍNICAS (MEDICAL RECORDS)
// =================================================================
// Ruta para crear un nuevo registro de consulta (historial médico)
router.post('/patients/:patientId/medical-records', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), (0, subscription_middleware_1.subscriptionAccess)('edit'), // Middleware de suscripción
doctor_controller_1.createConsultation // Controlador para crear la consulta
);
// Ruta para obtener todas las notas clínicas de un paciente
router.get('/patients/:patientId/medical-records', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), doctor_controller_1.getPatientMedicalRecords);
// Ruta para obtener una nota clínica específica
router.get('/patients/:patientId/medical-records/:recordId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), doctor_controller_1.getMedicalRecordById);
// Ruta para actualizar una nota clínica
router.put('/patients/:patientId/medical-records/:recordId', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), (0, subscription_middleware_1.subscriptionAccess)('edit'), doctor_controller_1.updateMedicalRecord);
// Ruta para eliminar una nota clínica
router.delete('/patients/:patientId/medical-records/:recordId', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), (0, subscription_middleware_1.subscriptionAccess)('edit'), doctor_controller_1.deleteMedicalRecord);
// =================================================================
// OTRAS RUTAS
// =================================================================
router.post('/register', upload_middleware_1.upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'taxCertificate', maxCount: 1 }
]), doctor_controller_1.registerDoctor);
// --- RUTA PARA LA BÚSQUEDA DE PACIENTES ---
router.get('/search-patients', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), doctor_controller_1.searchMyPatients);
// --- Búsqueda de PROFESIONALES (doctores) para colaboración / segunda opinión (médico o paciente) ---
router.get('/', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'PATIENT']), doctor_controller_1.searchHealthProfessionals);
// --- RUTA PARA CREAR UN PACIENTE ---
router.post('/patients', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), doctor_controller_1.createPatient);
router.put('/patients/:patientId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), upload_middleware_1.upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'taxCertificate', maxCount: 1 }
]), doctor_controller_1.updatePatient);
const assistantBillingOnly = (req, res, next) => {
    var _a;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === 'ASISTENTE') {
        return assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('billing')(req, res, next);
    }
    return next();
};
// Subir factura (PDF + XML) asociada a un paciente
router.post('/invoices', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistantBillingOnly, upload_middleware_1.upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'xml', maxCount: 1 }
]), invoice_controller_1.uploadInvoice);
// Obtener facturas (doctor ve todas, paciente solo las suyas)
router.get('/invoices', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE', 'PATIENT']), assistantBillingOnly, invoice_controller_1.getInvoices);
router.get('/invoices/:id/file/:type', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE', 'PATIENT']), assistantBillingOnly, invoice_controller_1.downloadInvoiceFile);
// Eliminar factura (solo doctor dueño)
router.delete('/invoices/:id', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistantBillingOnly, invoice_controller_1.deleteInvoice);
// Enviar factura por email al paciente
router.post('/invoices/:id/send-email', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistantBillingOnly, invoice_controller_1.sendInvoiceByEmail);
// =================================================================
// RUTAS PARA CONFIGURACIÓN DE RECORDATORIOS
// =================================================================
// Obtener configuración de recordatorios (doctor o asistente con permiso de citas)
router.get('/reminder-config', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), reminder_controller_1.ReminderController.getReminderConfig);
// Actualizar configuración de recordatorios (doctor o asistente con permiso de citas)
router.post('/reminder-config', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), reminder_controller_1.ReminderController.updateReminderConfig);
exports.default = router;
