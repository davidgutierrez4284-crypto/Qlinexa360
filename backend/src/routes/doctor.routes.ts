import { Router } from 'express';
import { 
  getDashboardStats,
  getPatients, 
  getPatientDetails, 
  referPatient, 
  registerDoctor, 
  createConsultation, 
  searchMyPatients, 
  createPatient, 
  updatePatient,
  getPatientMedicalRecords,
  getMedicalRecordById,
  updateMedicalRecord,
  deleteMedicalRecord,
  getAllMyPatients,
  searchHealthProfessionals,
  searchDoctorsPublic,
  getDoctorProfile
} from '../controllers/doctor.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { subscriptionAccess } from '../middlewares/subscription.middleware';
import { upload } from '../middlewares/upload.middleware';
import { uploadInvoice, getInvoices, deleteInvoice, sendInvoiceByEmail, downloadInvoiceFile } from '../controllers/invoice.controller';
import { ReminderController } from '../controllers/reminder.controller';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';

const router = Router();

// Ruta pública para búsqueda de doctores (para registro de asistentes)
router.get('/search', searchDoctorsPublic);

// Ruta para obtener perfil del doctor
router.get('/profile', authMiddleware(['DOCTOR', 'ASISTENTE', 'PATIENT']), getDoctorProfile);

router.get('/dashboard-stats', authMiddleware(['DOCTOR']), getDashboardStats);
router.get('/patients', authMiddleware(['DOCTOR']), getPatients);
router.get('/my-patients', authMiddleware(['DOCTOR', 'ASISTENTE']), getAllMyPatients);
router.get('/patients/:patientId', authMiddleware(['DOCTOR', 'ASISTENTE']), getPatientDetails);
router.post('/patients/:patientId/refer', authMiddleware(['DOCTOR']), referPatient);

// =================================================================
// RUTAS PARA NOTAS CLÍNICAS (MEDICAL RECORDS)
// =================================================================

// Ruta para crear un nuevo registro de consulta (historial médico)
router.post('/patients/:patientId/medical-records', 
  authMiddleware(['DOCTOR']), 
  subscriptionAccess('edit'), // Middleware de suscripción
  createConsultation // Controlador para crear la consulta
);

// Ruta para obtener todas las notas clínicas de un paciente
router.get('/patients/:patientId/medical-records', 
  authMiddleware(['DOCTOR', 'ASISTENTE']), 
  getPatientMedicalRecords
);

// Ruta para obtener una nota clínica específica
router.get('/patients/:patientId/medical-records/:recordId', 
  authMiddleware(['DOCTOR', 'ASISTENTE']), 
  getMedicalRecordById
);

// Ruta para actualizar una nota clínica
router.put('/patients/:patientId/medical-records/:recordId', 
  authMiddleware(['DOCTOR']), 
  subscriptionAccess('edit'),
  updateMedicalRecord
);

// Ruta para eliminar una nota clínica
router.delete('/patients/:patientId/medical-records/:recordId', 
  authMiddleware(['DOCTOR']), 
  subscriptionAccess('edit'),
  deleteMedicalRecord
);

// =================================================================
// OTRAS RUTAS
// =================================================================

router.post('/register', upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'taxCertificate', maxCount: 1 }
]), registerDoctor);

// --- RUTA PARA LA BÚSQUEDA DE PACIENTES ---
router.get('/search-patients', authMiddleware(['DOCTOR', 'ASISTENTE']), searchMyPatients);

// --- Búsqueda de PROFESIONALES (doctores) para colaboración / segunda opinión (médico o paciente) ---
router.get('/', authMiddleware(['DOCTOR', 'PATIENT']), searchHealthProfessionals);

// --- RUTA PARA CREAR UN PACIENTE ---
router.post('/patients', authMiddleware(['DOCTOR', 'ASISTENTE']), AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), createPatient);

router.put('/patients/:patientId', authMiddleware(['DOCTOR', 'ASISTENTE']), AssistantMiddleware.checkAssistantModulePermission('clinicalHistory'), upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'taxCertificate', maxCount: 1 }
]), updatePatient);

const assistantBillingOnly = (req: any, res: any, next: any) => {
  if (req.user?.role === 'ASISTENTE') {
    return AssistantMiddleware.checkAssistantModulePermission('billing')(req, res, next);
  }
  return next();
};

// Subir factura (PDF + XML) asociada a un paciente
router.post('/invoices', authMiddleware(['DOCTOR', 'ASISTENTE']), assistantBillingOnly, upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'xml', maxCount: 1 }
]), uploadInvoice);

// Obtener facturas (doctor ve todas, paciente solo las suyas)
router.get('/invoices', authMiddleware(['DOCTOR', 'ASISTENTE', 'PATIENT']), assistantBillingOnly, getInvoices);

router.get(
  '/invoices/:id/file/:type',
  authMiddleware(['DOCTOR', 'ASISTENTE', 'PATIENT']),
  assistantBillingOnly,
  downloadInvoiceFile
);

// Eliminar factura (solo doctor dueño)
router.delete('/invoices/:id', authMiddleware(['DOCTOR', 'ASISTENTE']), assistantBillingOnly, deleteInvoice);

// Enviar factura por email al paciente
router.post('/invoices/:id/send-email', authMiddleware(['DOCTOR', 'ASISTENTE']), assistantBillingOnly, sendInvoiceByEmail);

// =================================================================
// RUTAS PARA CONFIGURACIÓN DE RECORDATORIOS
// =================================================================

// Obtener configuración de recordatorios (doctor o asistente con permiso de citas)
router.get('/reminder-config', authMiddleware(['DOCTOR', 'ASISTENTE']), AssistantMiddleware.checkAssistantModulePermission('appointments'), ReminderController.getReminderConfig);

// Actualizar configuración de recordatorios (doctor o asistente con permiso de citas)
router.post('/reminder-config', authMiddleware(['DOCTOR', 'ASISTENTE']), AssistantMiddleware.checkAssistantModulePermission('appointments'), ReminderController.updateReminderConfig);

export default router; 