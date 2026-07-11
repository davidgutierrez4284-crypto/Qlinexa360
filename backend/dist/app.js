"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ConfiguraciÃ³n principal de la app Express para Medilink360
// Cargar .env antes de cualquier import que instancie Prisma u otro cliente con process.env.
require("./config/env");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const patient_routes_1 = __importDefault(require("./routes/patient.routes"));
const doctor_routes_1 = __importDefault(require("./routes/doctor.routes"));
const path_1 = __importDefault(require("path"));
const subscription_routes_1 = __importDefault(require("./routes/subscription.routes"));
const file_routes_1 = __importDefault(require("./routes/file.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const calendarSync_routes_1 = __importDefault(require("./routes/calendarSync.routes"));
const calendar_routes_1 = __importDefault(require("./routes/calendar.routes"));
const studyDocument_routes_1 = __importDefault(require("./routes/studyDocument.routes"));
const formTemplate_routes_1 = __importDefault(require("./routes/formTemplate.routes"));
const doctorFormTemplate_routes_1 = __importDefault(require("./routes/doctorFormTemplate.routes"));
const clinicalCase_routes_1 = __importDefault(require("./routes/clinicalCase.routes"));
const prescription_routes_1 = __importDefault(require("./routes/prescription.routes"));
const agendaPacientes_routes_1 = __importDefault(require("./routes/agendaPacientes.routes"));
const externalCalendar_routes_1 = __importDefault(require("./routes/externalCalendar.routes"));
const notifications_routes_1 = __importDefault(require("./routes/notifications.routes"));
const consultation_routes_1 = __importDefault(require("./routes/consultation.routes"));
const recipe_routes_1 = __importDefault(require("./routes/recipe.routes"));
const doctorProfile_routes_1 = __importDefault(require("./routes/doctorProfile.routes"));
const collaborativeWork_routes_1 = __importDefault(require("./routes/collaborativeWork.routes"));
const collaboration_routes_1 = __importDefault(require("./routes/collaboration.routes"));
const invitation_routes_1 = __importDefault(require("./routes/invitation.routes"));
const assistantInvitation_routes_1 = __importDefault(require("./routes/assistantInvitation.routes"));
const assistant_routes_1 = __importDefault(require("./routes/assistant.routes"));
const passwordReset_routes_1 = __importDefault(require("./routes/passwordReset.routes"));
const consent_routes_1 = __importDefault(require("./routes/consent.routes"));
const appointmentConfirmation_routes_1 = __importDefault(require("./routes/appointmentConfirmation.routes"));
const teleconsultation_routes_1 = __importDefault(require("./routes/teleconsultation.routes"));
const schedule_routes_1 = __importDefault(require("./routes/schedule.routes"));
const feedback_routes_1 = __importDefault(require("./routes/feedback.routes"));
const tutorialVideo_routes_1 = __importDefault(require("./routes/tutorialVideo.routes"));
const preConsultation_routes_1 = __importDefault(require("./routes/preConsultation.routes"));
const clinicalIntake_routes_1 = __importDefault(require("./routes/clinicalIntake.routes"));
const promo_routes_1 = __importDefault(require("./routes/promo.routes"));
const referral_routes_1 = __importDefault(require("./routes/referral.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const auditEvidence_routes_1 = __importDefault(require("./routes/auditEvidence.routes"));
const affiliateAdmin_routes_1 = __importDefault(require("./routes/affiliateAdmin.routes"));
const affiliate_routes_1 = __importDefault(require("./routes/affiliate.routes"));
const mercadoPago_routes_1 = __importDefault(require("./routes/mercadoPago.routes"));
const adminBilling_routes_1 = __importDefault(require("./routes/adminBilling.routes"));
const caseShareInvite_routes_1 = __importDefault(require("./routes/caseShareInvite.routes"));
const smartLab_routes_1 = __importDefault(require("./routes/smartLab.routes"));
const subscription_middleware_1 = require("./middlewares/subscription.middleware");
const auth_middleware_1 = require("./middlewares/auth.middleware");
const enrichDoctorId_middleware_1 = require("./middlewares/enrichDoctorId.middleware");
const database_1 = __importDefault(require("./config/database"));
// Puedes importar aquÃ­ otras rutas si las necesitas
const app = (0, express_1.default)();
// CORS: reflejar el origen (www vs apex) y credenciales.
// No fijar allowedHeaders: el paquete cors refleja Access-Control-Request-Headers del preflight.
// Si se lista a mano, cualquier cabecera extra del cliente (p. ej. Cache-Control en Calendar.jsx) rompe el preflight.
const corsOptions = {
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 204,
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '8mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Middleware global para bloquear operaciones de escritura cuando la suscripciÃ³n estÃ¡ cancelada
// Se aplica despuÃ©s de las rutas de autenticaciÃ³n pero antes de las demÃ¡s rutas
// GET /api/case-share-invite/:token es pÃºblico (enlace por correo). Un JWT invÃ¡lido en el navegador
// no debe bloquear con 403 antes de cargar el invite â€” usar autenticaciÃ³n opcional.
app.use((req, res, next) => {
    if (req.path.startsWith('/api/') && !req.path.startsWith('/api/auth')) {
        if (req.path.startsWith('/api/case-share-invite')) {
            const isPublicCaseShare = req.method === 'GET' ||
                (req.method === 'POST' && /^\/api\/case-share-invite\/.+\/sign\/?$/.test(req.path));
            if (isPublicCaseShare) {
                return (0, auth_middleware_1.optionalAuthenticate)(req, res, () => {
                    (0, enrichDoctorId_middleware_1.enrichDoctorId)(req, res, () => {
                        (0, subscription_middleware_1.blockWriteOperationsIfCancelled)(req, res, next);
                    });
                });
            }
        }
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            (0, auth_middleware_1.authenticateToken)(req, res, () => {
                (0, enrichDoctorId_middleware_1.enrichDoctorId)(req, res, () => {
                    (0, subscription_middleware_1.blockWriteOperationsIfCancelled)(req, res, next);
                });
            });
        }
        else {
            next();
        }
    }
    else {
        next();
    }
});
// Rutas de autenticaciÃ³n
app.use('/api/auth', auth_routes_1.default);
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.use('/api/patients', patient_routes_1.default);
app.use('/api/case-share-invite', caseShareInvite_routes_1.default);
app.use('/api/doctors', doctor_routes_1.default);
app.use('/api/users', user_routes_1.default);
// Rutas para eventos internos del calendario (CRUD)
app.use('/api/calendar', calendar_routes_1.default);
// Rutas para sincronizaciÃ³n con calendarios externos (Google, Outlook, etc.)
app.use('/api/calendar-sync', calendarSync_routes_1.default);
app.use('/api/files', file_routes_1.default);
app.use('/api/subscriptions', subscription_routes_1.default);
app.use('/api/study-documents', studyDocument_routes_1.default);
app.use('/api/form-templates', formTemplate_routes_1.default);
app.use('/api/doctor-form-templates', doctorFormTemplate_routes_1.default);
app.use('/api/clinical-cases', clinicalCase_routes_1.default);
app.use('/api/prescriptions', prescription_routes_1.default);
app.use('/api/agenda-pacientes', agendaPacientes_routes_1.default);
app.use('/api/external-calendars', externalCalendar_routes_1.default);
app.use('/api/notifications', notifications_routes_1.default);
app.use('/api/consultations', consultation_routes_1.default);
app.use('/api/recipes', recipe_routes_1.default);
app.use('/api/doctor-profile', doctorProfile_routes_1.default);
app.use('/api/collaborative-work', collaborativeWork_routes_1.default);
app.use('/api/collaboration', collaboration_routes_1.default);
app.use('/api/invitations', invitation_routes_1.default);
app.use('/api/assistant-invitations', assistantInvitation_routes_1.default);
app.use('/api/assistants', assistant_routes_1.default);
app.use('/api/password-reset', passwordReset_routes_1.default);
app.use('/api/consent', consent_routes_1.default);
app.use('/api/appointment-confirmation', appointmentConfirmation_routes_1.default);
app.use('/api/teleconsultation', teleconsultation_routes_1.default);
app.use('/api/schedule', schedule_routes_1.default);
app.use('/api/feedback', feedback_routes_1.default);
app.use('/api/tutorial-videos', tutorialVideo_routes_1.default);
app.use('/api/promo', promo_routes_1.default);
app.use('/api/referrals', referral_routes_1.default);
app.use('/api/pre-consultations', preConsultation_routes_1.default);
app.use('/api/clinical-intakes', clinicalIntake_routes_1.default);
app.use('/api/admin/reports', admin_routes_1.default);
app.use('/api/admin/audit-evidence', auditEvidence_routes_1.default);
app.use('/api/admin/affiliates', affiliateAdmin_routes_1.default);
app.use('/api/admin/billing', adminBilling_routes_1.default);
app.use('/api/affiliate', affiliate_routes_1.default);
app.use('/api/payments/mercadopago', mercadoPago_routes_1.default);
app.use('/api/smart-lab', smartLab_routes_1.default);
app.use('/api/labs', smartLab_routes_1.default);
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
            database_1.default.user.count(),
            database_1.default.promoCode.count(),
        ]);
        res.json({
            users: { total: userCount },
            promoCodes: { total: promoCount },
        });
    }
    catch (e) {
        res.status(500).json({ error: 'Error al consultar BD', message: e.message });
    }
});
exports.default = app;
