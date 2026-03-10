"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Configuración principal de la app Express para Medilink360
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
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
const schedule_routes_1 = __importDefault(require("./routes/schedule.routes"));
const feedback_routes_1 = __importDefault(require("./routes/feedback.routes"));
const tutorialVideo_routes_1 = __importDefault(require("./routes/tutorialVideo.routes"));
const preConsultation_routes_1 = __importDefault(require("./routes/preConsultation.routes"));
const promo_routes_1 = __importDefault(require("./routes/promo.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const subscription_middleware_1 = require("./middlewares/subscription.middleware");
const auth_middleware_1 = require("./middlewares/auth.middleware");
const database_1 = __importDefault(require("./config/database"));
// Puedes importar aquí otras rutas si las necesitas
dotenv_1.default.config();
const app = (0, express_1.default)();
// Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
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
            (0, auth_middleware_1.authenticateToken)(req, res, () => {
                (0, subscription_middleware_1.blockWriteOperationsIfCancelled)(req, res, next);
            });
        }
        else {
            // Si no hay token, continuar (otro middleware manejará la autenticación)
            next();
        }
    }
    else {
        next();
    }
});
// Rutas de autenticación
app.use('/api/auth', auth_routes_1.default);
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.use('/api/patients', patient_routes_1.default);
app.use('/api/doctors', doctor_routes_1.default);
app.use('/api/users', user_routes_1.default);
// Rutas para eventos internos del calendario (CRUD)
app.use('/api/calendar', calendar_routes_1.default);
// Rutas para sincronización con calendarios externos (Google, Outlook, etc.)
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
app.use('/api/schedule', schedule_routes_1.default);
app.use('/api/feedback', feedback_routes_1.default);
app.use('/api/tutorial-videos', tutorialVideo_routes_1.default);
app.use('/api/promo', promo_routes_1.default);
app.use('/api/pre-consultations', preConsultation_routes_1.default);
app.use('/api/admin/reports', admin_routes_1.default);
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
