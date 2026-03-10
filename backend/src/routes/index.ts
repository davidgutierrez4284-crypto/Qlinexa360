import { Router } from 'express';
import authRoutes from './auth.routes';
import doctorRoutes from './doctor.routes';
import patientRoutes from './patient.routes';
import fileRoutes from './file.routes';
import prescriptionRoutes from './prescription.routes';
import studyDocumentRoutes from './studyDocument.routes';
import collaborativeWorkRoutes from './collaborativeWork.routes';
import assistantRoutes from './assistant.routes';
import recipeRoutes from './recipe.routes';
import consultationRoutes from './consultation.routes';
import agendaPacientesRoutes from './agendaPacientes.routes';
import externalCalendarRoutes from './externalCalendar.routes';
import calendarSyncRoutes from './calendarSync.routes';
import scheduleRoutes from './schedule.routes';
import notificationsRoutes from './notifications.routes';
import invitationRoutes from './invitation.routes';
import assistantInvitationRoutes from './assistantInvitation.routes';
import collaborationRoutes from './collaboration.routes';
import feedbackRoutes from './feedback.routes';
import tutorialVideoRoutes from './tutorialVideo.routes';
import preConsultationRoutes from './preConsultation.routes';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    security: 'enabled'
  });
});

// Test endpoint para verificar autenticación
router.get('/test-auth', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  res.json({
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    headers: Object.keys(req.headers).filter(key => key.toLowerCase().includes('auth'))
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/patients', patientRoutes);
router.use('/files', fileRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/study-documents', studyDocumentRoutes);
router.use('/collaborative-work', collaborativeWorkRoutes);
router.use('/assistants', assistantRoutes);
router.use('/recipes', recipeRoutes);
router.use('/consultations', consultationRoutes);
router.use('/agenda-pacientes', agendaPacientesRoutes);
router.use('/external-calendars', externalCalendarRoutes);
router.use('/calendar', calendarSyncRoutes);
router.use('/schedule', scheduleRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/invitations', invitationRoutes);
router.use('/assistant-invitations', assistantInvitationRoutes);
router.use('/collaboration', collaborationRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/tutorial-videos', tutorialVideoRoutes);
router.use('/pre-consultations', preConsultationRoutes);

export default router; 