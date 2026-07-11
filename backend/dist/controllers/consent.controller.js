"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatientAvisoPrivacidad = exports.getConsentsByUserId = exports.submitConsentAssistant = exports.submitConsentAfterPatientSetup = void 0;
const client_1 = require("@prisma/client");
const consentPdf_service_1 = require("../services/consentPdf.service");
const jwt_utils_1 = require("../utils/jwt.utils");
const file_utils_1 = require("../utils/file.utils");
const notification_service_1 = require("../services/notification.service");
const prisma = new client_1.PrismaClient();
const CONSENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutos tras password reset
/**
 * POST /api/consent/submit-after-setup
 * Para PACIENTE: tras configurar contraseña (token de password reset usado recientemente)
 */
const submitConsentAfterPatientSetup = async (req, res) => {
    try {
        const { token, acceptPrivacy, acceptTerms, acceptContract, signature } = req.body;
        if (!token || !acceptPrivacy || !acceptTerms || !acceptContract || !(signature === null || signature === void 0 ? void 0 : signature.trim())) {
            return res.status(400).json({
                error: 'Faltan datos requeridos: token, aceptación de los 3 documentos y firma digital'
            });
        }
        const resetToken = await prisma.passwordResetToken.findFirst({
            where: { token },
            include: { user: true }
        });
        if (!resetToken) {
            return res.status(400).json({ error: 'Token no encontrado' });
        }
        if (resetToken.purpose !== 'patient_setup') {
            return res.status(400).json({ error: 'Este enlace no es válido para consentimientos' });
        }
        if (!resetToken.used || !resetToken.usedAt) {
            return res.status(400).json({ error: 'Debe configurar la contraseña primero' });
        }
        const elapsed = Date.now() - resetToken.usedAt.getTime();
        if (elapsed > CONSENT_WINDOW_MS) {
            return res.status(400).json({ error: 'El tiempo para firmar los consentimientos ha expirado. Inicie sesión y contacte a soporte.' });
        }
        await createConsentRecords(resetToken.user, signature.trim(), req.ip || req.socket.remoteAddress || 'IP no disponible');
        res.json({ message: 'Consentimientos registrados exitosamente' });
    }
    catch (error) {
        console.error('Error en submitConsentAfterPatientSetup:', error);
        res.status(500).json({ error: error.message || 'Error al registrar consentimientos' });
    }
};
exports.submitConsentAfterPatientSetup = submitConsentAfterPatientSetup;
/**
 * POST /api/consent/submit-assistant
 * Para ASISTENTE: tras completar registro (consentToken devuelto en la respuesta)
 */
const submitConsentAssistant = async (req, res) => {
    try {
        const { consentToken, acceptPrivacy, acceptTerms, acceptContract, signature } = req.body;
        if (!consentToken || !acceptPrivacy || !acceptTerms || !acceptContract || !(signature === null || signature === void 0 ? void 0 : signature.trim())) {
            return res.status(400).json({
                error: 'Faltan datos requeridos: consentToken, aceptación de los 3 documentos y firma digital'
            });
        }
        const { userId } = (0, jwt_utils_1.verifyConsentToken)(consentToken);
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        if (user.role !== 'ASISTENTE') {
            return res.status(400).json({ error: 'Token inválido' });
        }
        await createConsentRecords(user, signature.trim(), req.ip || req.socket.remoteAddress || 'IP no disponible');
        res.json({ message: 'Consentimientos registrados exitosamente' });
    }
    catch (error) {
        console.error('Error en submitConsentAssistant:', error);
        res.status(500).json({ error: error.message || 'Error al registrar consentimientos' });
    }
};
exports.submitConsentAssistant = submitConsentAssistant;
async function createConsentRecords(user, signature, ipAddress) {
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    const consentDate = new Date();
    const pdfResults = await consentPdf_service_1.ConsentPdfService.generateConsentPdfs({
        userId: user.id,
        email: user.email,
        fullName,
        signature,
        role: user.role,
        ipAddress,
        signedAt: consentDate
    });
    await prisma.consentHistory.createMany({
        data: [
            {
                userId: user.id,
                type: 'PRIVACY_POLICY',
                version: '1.0',
                content: 'Aviso de Privacidad de Qlinexa360',
                acceptedAt: consentDate,
                pdfUrl: pdfResults.PRIVACY_POLICY.url
            },
            {
                userId: user.id,
                type: 'TERMS_OF_SERVICE',
                version: '1.0',
                content: 'Términos de Uso de Qlinexa360',
                acceptedAt: consentDate,
                pdfUrl: pdfResults.TERMS_OF_SERVICE.url
            },
            {
                userId: user.id,
                type: 'PLATFORM_CONTRACT',
                version: '1.0',
                content: 'Contrato de Uso de Plataforma de Qlinexa360',
                acceptedAt: consentDate,
                pdfUrl: pdfResults.PLATFORM_CONTRACT.url
            },
            {
                userId: user.id,
                type: 'DIGITAL_SIGNATURE',
                version: '1.0',
                content: `Firma digital: ${signature}`,
                acceptedAt: consentDate
            }
        ]
    });
    // Enviar documentos firmados en mails independientes al usuario y a legal
    try {
        const payload = {
            fullName,
            email: user.email,
            role: user.role,
            pdfBuffers: {
                aviso: pdfResults.PRIVACY_POLICY.buffer,
                terminos: pdfResults.TERMS_OF_SERVICE.buffer,
                contrato: pdfResults.PLATFORM_CONTRACT.buffer
            }
        };
        await Promise.all([
            notification_service_1.NotificationService.sendNewUserConsentToUser(payload),
            notification_service_1.NotificationService.sendNewUserConsentToLegal(payload)
        ]);
    }
    catch (emailError) {
        console.error('Error enviando consentimientos por email:', emailError);
        // No fallar el registro si el email falla
    }
}
/**
 * GET /api/consent/admin/:userId
 * Admin: listar consentimientos de un usuario (para auditoría)
 */
const getConsentsByUserId = async (req, res) => {
    var _a;
    try {
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== 'ADMIN') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        const { userId } = req.params;
        const consents = await prisma.consentHistory.findMany({
            where: { userId },
            orderBy: { acceptedAt: 'asc' }
        });
        const withUrls = await Promise.all(consents.map(async (c) => {
            let signedUrl = null;
            if (c.pdfUrl && c.pdfUrl.startsWith('http')) {
                signedUrl = await (0, file_utils_1.getS3SignedUrlIfExists)(c.pdfUrl, 60 * 15);
            }
            return Object.assign(Object.assign({}, c), { signedPdfUrl: signedUrl });
        }));
        res.json(withUrls);
    }
    catch (error) {
        console.error('Error getConsentsByUserId:', error);
        res.status(500).json({ error: error.message || 'Error al obtener consentimientos' });
    }
};
exports.getConsentsByUserId = getConsentsByUserId;
/**
 * GET /api/consent/doctor/patient/:patientId/aviso-privacidad
 * Doctor: obtener Aviso de Privacidad firmado de su paciente
 */
const getPatientAvisoPrivacidad = async (req, res) => {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId)) {
            return res.status(401).json({ error: 'Autenticación requerida' });
        }
        const { patientId } = req.params;
        const link = await prisma.doctorPatient.findFirst({
            where: {
                doctorId: req.user.doctorId,
                patientId
            }
        });
        if (!link) {
            return res.status(404).json({ error: 'Paciente no encontrado' });
        }
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { userId: true }
        });
        if (!patient)
            return res.status(404).json({ error: 'Paciente no encontrado' });
        const consent = await prisma.consentHistory.findFirst({
            where: {
                userId: patient.userId,
                type: 'PRIVACY_POLICY'
            }
        });
        if (!(consent === null || consent === void 0 ? void 0 : consent.pdfUrl)) {
            return res.status(404).json({ error: 'Aviso de Privacidad no disponible para este paciente' });
        }
        const signedUrl = await (0, file_utils_1.getS3SignedUrlIfExists)(consent.pdfUrl, 60 * 15);
        if (!signedUrl) {
            return res.status(404).json({ error: 'Archivo no disponible' });
        }
        res.json({ url: signedUrl });
    }
    catch (error) {
        console.error('Error getPatientAvisoPrivacidad:', error);
        res.status(500).json({ error: error.message || 'Error al obtener documento' });
    }
};
exports.getPatientAvisoPrivacidad = getPatientAvisoPrivacidad;
