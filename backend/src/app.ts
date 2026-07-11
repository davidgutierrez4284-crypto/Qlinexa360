// ConfiguraciÃ³n principal de la app Express para Medilink360
// Cargar .env antes de cualquier import que instancie Prisma u otro cliente con process.env.
import './config/env';
import express from 'express';
import cors, { CorsOptions } from 'cors';
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
import teleconsultationRoutes from './routes/teleconsultation.routes';
import scheduleRoutes from './routes/schedule.routes';
import feedbackRoutes from './routes/feedback.routes';
import tutorialVideoRoutes from './routes/tutorialVideo.routes';
import preConsultationRoutes from './routes/preConsultation.routes';
import clinicalIntakeRoutes from './routes/clinicalIntake.routes';
import promoRoutes from './routes/promo.routes';
import referralRoutes from './routes/referral.routes';
import adminReportRoutes from './routes/admin.routes';
import auditEvidenceRoutes from './routes/auditEvidence.routes';
import affiliateAdminRoutes from './routes/affiliateAdmin.routes';
import affiliateRoutes from './routes/affiliate.routes';
import mercadoPagoRoutes from './routes/mercadoPago.routes';
import adminBillingRoutes from './routes/adminBilling.routes';
import caseShareInviteRoutes from './routes/caseShareInvite.routes';
import smartLabRoutes from './routes/smartLab.routes';
import { blockWriteOperationsIfCancelled } from './middlewares/subscription.middleware';
import { authenticateToken, optionalAuthenticate } from './middlewares/auth.middleware';
import { enrichDoctorId } from './middlewares/enrichDoctorId.middleware';
import prisma from './config/database';
// Puedes importar aquÃ­ otras rutas si las necesitas

const app = express();

// CORS: reflejar el origen (www vs apex) y credenciales.
// No fijar allowedHeaders: el paquete cors refleja Access-Control-Request-Headers del preflight.
// Si se lista a mano, cualquier cabecera extra del cliente (p. ej. Cache-Control en Calendar.jsx) rompe el preflight.
const corsOptions: CorsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware global para bloquear operaciones de escritura cuando la suscripciÃ³n estÃ¡ cancelada
// Se aplica despuÃ©s de las rutas de autenticaciÃ³n pero antes de las demÃ¡s rutas
// GET /api/case-share-invite/:token es pÃºblico (enlace por correo). Un JWT invÃ¡lido en el navegador
// no debe bloquear con 403 antes de cargar el invite â€” usar autenticaciÃ³n opcional.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && !req.path.startsWith('/api/auth')) {
    if (req.path.startsWith('/api/case-share-invite')) {
      const isPublicCaseShare =
        req.method === 'GET' ||
        (req.method === 'POST' && /^\/api\/case-share-invite\/.+\/sign\/?$/.test(req.path));
      if (isPublicCaseShare) {
        return optionalAuthenticate(req, res, () => {
          enrichDoctorId(req, res, () => {
            blockWriteOperationsIfCancelled(req, res, next);
          });
        });
      }
    }
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      authenticateToken(req, res, () => {
        enrichDoctorId(req, res, () => {
          blockWriteOperationsIfCancelled(req, res, next);
        });
      });
    } else {
      next();
    }
  } else {
    next();
  }
});

// Rutas de autenticaciÃ³n
app.use('/api/auth', authRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/patients', patientRoutes);
app.use('/api/case-share-invite', caseShareInviteRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/users', userRoutes);
// Rutas para eventos internos del calendario (CRUD)
app.use('/api/calendar', calendarRoutes);
// Rutas para sincronizaciÃ³n con calendarios externos (Google, Outlook, etc.)
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
app.use('/api/teleconsultation', teleconsultationRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/tutorial-videos', tutorialVideoRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/pre-consultations', preConsultationRoutes);
app.use('/api/clinical-intakes', clinicalIntakeRoutes);
app.use('/api/admin/reports', adminReportRoutes);
app.use('/api/admin/audit-evidence', auditEvidenceRoutes);
app.use('/api/admin/affiliates', affiliateAdminRoutes);
app.use('/api/admin/billing', adminBillingRoutes);
app.use('/api/affiliate', affiliateRoutes);
app.use('/api/payments/mercadopago', mercadoPagoRoutes);
app.use('/api/smart-lab', smartLabRoutes);
app.use('/api/labs', smartLabRoutes);

// Ruta bÃ¡sica de prueba
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

// EstadÃ­sticas de BD (usuarios, cÃ³digos promocionales) - para validar datos en PROD
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