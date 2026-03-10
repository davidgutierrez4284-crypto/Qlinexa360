"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inviteExternalDoctor = void 0;
const client_1 = require("@prisma/client");
const logger_utils_1 = require("../utils/logger.utils");
const notification_service_1 = require("../services/notification.service");
const file_utils_1 = require("../utils/file.utils");
const prisma = new client_1.PrismaClient();
const notificationService = notification_service_1.NotificationService.getInstance();
const inviteExternalDoctor = async (req, res) => {
    var _a, _b;
    try {
        console.log('=== INVITE EXTERNAL DOCTOR STARTED ===');
        console.log('req.user:', req.user);
        console.log('req.body:', req.body);
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId) || !((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId)) {
            console.log('ERROR: Authentication required');
            return res.status(401).json({ message: 'Autenticación requerida' });
        }
        const { email, clinicalCaseId } = req.body;
        console.log('email:', email);
        console.log('clinicalCaseId:', clinicalCaseId);
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            console.log('ERROR: Invalid email');
            return res.status(400).json({ message: 'Email inválido' });
        }
        if (!clinicalCaseId) {
            console.log('ERROR: clinicalCaseId required');
            return res.status(400).json({ message: 'clinicalCaseId es requerido' });
        }
        console.log('=== FETCHING DOCTOR AND CLINICAL CASE ===');
        // Obtener info del invitador y del caso clínico para personalizar el mensaje
        const doctor = await prisma.doctor.findUnique({
            where: { id: req.user.doctorId },
            include: { user: true }
        });
        console.log('doctor found:', !!doctor);
        const clinicalCase = await prisma.clinicalCase.findUnique({
            where: { id: clinicalCaseId },
            include: { patient: { include: { user: true } } }
        });
        console.log('clinicalCase found:', !!clinicalCase);
        if (!doctor || !doctor.user) {
            console.log('ERROR: Doctor not found');
            return res.status(404).json({ message: 'Doctor no encontrado' });
        }
        if (!clinicalCase) {
            console.log('ERROR: Clinical case not found');
            return res.status(404).json({ message: 'Caso clínico no encontrado' });
        }
        const inviterName = `${doctor.user.firstName} ${doctor.user.lastName}`.trim();
        const patientName = `${clinicalCase.patient.firstName} ${clinicalCase.patient.lastName}`.trim();
        const padecimiento = clinicalCase.padecimiento;
        const websiteUrl = 'https://www.qlinexa360.com';
        // Obtener el Aviso de Privacidad firmado por el paciente para adjuntarlo al doctor colaborador
        let avisoPdfBuffer;
        const patientUserId = clinicalCase.patient.userId;
        try {
            const consentAviso = await prisma.consentHistory.findFirst({
                where: { userId: patientUserId, type: 'PRIVACY_POLICY', pdfUrl: { not: null } },
                orderBy: { acceptedAt: 'desc' }
            });
            if (consentAviso === null || consentAviso === void 0 ? void 0 : consentAviso.pdfUrl) {
                const { buffer } = await (0, file_utils_1.fetchBufferFromUrl)(consentAviso.pdfUrl);
                avisoPdfBuffer = buffer;
                console.log('Aviso de Privacidad del paciente obtenido para adjuntar al colaborador');
            }
            else {
                console.log('Paciente sin Aviso de Privacidad en PDF (puede ser registro antiguo), se enviará invitación sin adjunto');
            }
        }
        catch (consentErr) {
            console.warn('Error obteniendo Aviso de Privacidad del paciente:', consentErr);
            // Continuar sin el PDF, la invitación se envía igual
        }
        console.log('=== PREPARING EMAIL DATA ===');
        console.log('inviterName:', inviterName);
        console.log('patientName:', patientName);
        console.log('padecimiento:', padecimiento);
        console.log('websiteUrl:', websiteUrl);
        console.log('avisoPdfBuffer:', avisoPdfBuffer ? 'SÍ' : 'NO');
        console.log('=== CALLING NOTIFICATION SERVICE ===');
        const emailResult = await notificationService.sendExternalCollaborationInvite({
            email,
            inviterName,
            patientName,
            padecimiento,
            websiteUrl,
            inviterEmail: doctor.user.email,
            avisoPdfBuffer
        });
        console.log('=== EMAIL RESULT ===');
        console.log('emailResult:', emailResult);
        logger_utils_1.securityLogger.info(`External collaboration invite attempted to ${email} by ${inviterName}. emailSent=${emailResult.emailSent}`);
        console.log('=== SENDING RESPONSE ===');
        return res.json({
            message: emailResult.emailSent
                ? 'Invitación enviada por correo electrónico'
                : 'No se pudo enviar correo (credenciales no configuradas). Desarrollo listo.'
        });
    }
    catch (error) {
        console.log('=== ERROR IN INVITE EXTERNAL DOCTOR ===');
        console.error('Error:', error);
        logger_utils_1.securityLogger.error('Error sending external doctor collaboration invite', error);
        return res.status(500).json({ message: 'Error al enviar la invitación' });
    }
};
exports.inviteExternalDoctor = inviteExternalDoctor;
