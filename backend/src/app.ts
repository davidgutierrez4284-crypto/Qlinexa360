// Configuración principal de la app Express para Medilink360
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patient.routes';
import doctorRoutes from './routes/doctor.routes';
import path from 'path';
import subscriptionRoutes from './routes/subscription.routes';
import fileRoutes from './routes/file.routes';
import userRoutes from './routes/user.routes';
import calendarSyncRoutes from './routes/calendarSync.routes';
import calendarRoutes from './routes/calendar.routes';
import studyDocumentRoutes from './routes/studyDocument.routes';
import formTemplateRoutes from './routes/formTemplate.routes';
import doctorFormTemplateRoutes from './routes/doctorFormTemplate.routes';
import clinicalCaseRoutes from './routes/clinicalCase.routes';
import prescriptionRoutes from './routes/prescription.routes';
import agendaPacientesRoutes from './routes/agendaPacientes.routes';
import externalCalendarRoutes from './routes/externalCalendar.routes';
import notificationsRoutes from './routes/notifications.routes';
import consultationRoutes from './routes/consultation.routes';
import recipeRoutes from './routes/recipe.routes';
import doctorProfileRoutes from './routes/doctorProfile.routes';
import collaborativeWorkRoutes from './routes/collaborativeWork.routes';
import collaborationRoutes from './routes/collaboration.routes';
import invitationRoutes from './routes/invitation.routes';
import assistantInvitationRoutes from './routes/assistantInvitation.routes';
import assistantRoutes from './routes/assistant.routes';
import passwordResetRoutes from './routes/passwordReset.routes';
import consentRoutes from './routes/consent.routes';
import appointmentConfirmationRoutes from './routes/appointmentConfirmation.routes';
import scheduleRoutes from './routes/schedule.routes';
import feedbackRoutes from './routes/feedback.routes';
import tutorialVideoRoutes from './routes/tutorialVideo.routes';
import preConsultationRoutes from './routes/preConsultation.routes';
import promoRoutes from './routes/promo.routes';
import adminReportRoutes from './routes/admin.routes';
import { blockWriteOperationsIfCancelled } from './middlewares/subscription.middleware';
import { authenticateToken } from './middlewares/auth.middleware';
import prisma from './config/database';
// Puedes importar aquí otras rutas si las necesitas

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware global para bloquear operaciones de escritura cuando la suscripción está cancelada
// Se aplica después de las rutas de autenticación pero antes de las demás rutas
app.use((req, res, next) => {
  // Solo aplicar a rutas que requieren autenticación (excepto /api/auth)
  if (req.path.startsWith('/api/') && !req.path.startsWith('/api/auth')) {
    // Verificar si hay token de autenticación
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      // Si hay token, autenticar y luego verificar suscripción
      authenticateToken(req, res, () => {
        blockWriteOperationsIfCancelled(req, res, next);
      });
    } else {
      // Si no hay token, continuar (otro middleware manejará la autenticación)
      next();
    }
  } else {
    next();
  }
});

// Rutas de autenticación
app.use('/api/auth', authRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/users', userRoutes);
// Rutas para eventos internos del calendario (CRUD)
app.use('/api/calendar', calendarRoutes);
// Rutas para sincronización con calendarios externos (Google, Outlook, etc.)
app.use('/api/calendar-sync', calendarSyncRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/study-documents', studyDocumentRoutes);
app.use('/api/form-templates', formTemplateRoutes);
app.use('/api/doctor-form-templates', doctorFormTemplateRoutes);
app.use('/api/clinical-cases', clinicalCaseRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/agenda-pacientes', agendaPacientesRoutes);
app.use('/api/external-calendars', externalCalendarRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/doctor-profile', doctorProfileRoutes);
app.use('/api/collaborative-work', collaborativeWorkRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/assistant-invitations', assistantInvitationRoutes);
app.use('/api/assistants', assistantRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/appointment-confirmation', appointmentConfirmationRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/tutorial-videos', tutorialVideoRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/pre-consultations', preConsultationRoutes);
app.use('/api/admin/reports', adminReportRoutes);

// Ruta básica de prueba
app.get('/', (req, res) => {
  res.json({ message: 'Bienvenido a Medilink360 API' });
});

// Health check para ALB/ECS
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Estadísticas de BD (usuarios, códigos promocionales) - para validar datos en PROD
app.get('/api/admin/db-stats', async (_req, res) => {
  try {
    const [userCount, promoCount] = await Promise.all([
      prisma.user.count(),
      prisma.promoCode.count(),
    ]);
    res.json({
      users: { total: userCount },
      promoCodes: { total: promoCount },
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al consultar BD', message: (e as Error).message });
  }
});

export default app; 