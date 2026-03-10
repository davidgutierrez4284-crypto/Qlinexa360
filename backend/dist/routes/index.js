"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const doctor_routes_1 = __importDefault(require("./doctor.routes"));
const patient_routes_1 = __importDefault(require("./patient.routes"));
const file_routes_1 = __importDefault(require("./file.routes"));
const prescription_routes_1 = __importDefault(require("./prescription.routes"));
const studyDocument_routes_1 = __importDefault(require("./studyDocument.routes"));
const collaborativeWork_routes_1 = __importDefault(require("./collaborativeWork.routes"));
const assistant_routes_1 = __importDefault(require("./assistant.routes"));
const recipe_routes_1 = __importDefault(require("./recipe.routes"));
const consultation_routes_1 = __importDefault(require("./consultation.routes"));
const agendaPacientes_routes_1 = __importDefault(require("./agendaPacientes.routes"));
const externalCalendar_routes_1 = __importDefault(require("./externalCalendar.routes"));
const calendarSync_routes_1 = __importDefault(require("./calendarSync.routes"));
const schedule_routes_1 = __importDefault(require("./schedule.routes"));
const notifications_routes_1 = __importDefault(require("./notifications.routes"));
const invitation_routes_1 = __importDefault(require("./invitation.routes"));
const assistantInvitation_routes_1 = __importDefault(require("./assistantInvitation.routes"));
const collaboration_routes_1 = __importDefault(require("./collaboration.routes"));
const feedback_routes_1 = __importDefault(require("./feedback.routes"));
const tutorialVideo_routes_1 = __importDefault(require("./tutorialVideo.routes"));
const preConsultation_routes_1 = __importDefault(require("./preConsultation.routes"));
const router = (0, express_1.Router)();
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
router.use('/auth', auth_routes_1.default);
router.use('/doctors', doctor_routes_1.default);
router.use('/patients', patient_routes_1.default);
router.use('/files', file_routes_1.default);
router.use('/prescriptions', prescription_routes_1.default);
router.use('/study-documents', studyDocument_routes_1.default);
router.use('/collaborative-work', collaborativeWork_routes_1.default);
router.use('/assistants', assistant_routes_1.default);
router.use('/recipes', recipe_routes_1.default);
router.use('/consultations', consultation_routes_1.default);
router.use('/agenda-pacientes', agendaPacientes_routes_1.default);
router.use('/external-calendars', externalCalendar_routes_1.default);
router.use('/calendar', calendarSync_routes_1.default);
router.use('/schedule', schedule_routes_1.default);
router.use('/notifications', notifications_routes_1.default);
router.use('/invitations', invitation_routes_1.default);
router.use('/assistant-invitations', assistantInvitation_routes_1.default);
router.use('/collaboration', collaboration_routes_1.default);
router.use('/feedback', feedback_routes_1.default);
router.use('/tutorial-videos', tutorialVideo_routes_1.default);
router.use('/pre-consultations', preConsultation_routes_1.default);
exports.default = router;
