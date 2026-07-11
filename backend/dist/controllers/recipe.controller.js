"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipeController = void 0;
const client_1 = require("@prisma/client");
const logger_utils_1 = require("../utils/logger.utils");
const recipePdf_service_1 = require("../services/recipePdf.service");
const notification_service_1 = require("../services/notification.service");
const file_utils_1 = require("../utils/file.utils");
const email_utils_1 = require("../utils/email.utils");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
const resolveDoctorId = async (req) => {
    if (!req.user) {
        throw new Error('Usuario no autenticado');
    }
    if (req.user.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.userId },
            select: { id: true }
        });
        if (!doctor) {
            throw new Error('Perfil de doctor no encontrado');
        }
        return doctor.id;
    }
    if (req.user.role === 'ASISTENTE') {
        const selectedDoctorId = req.headers['x-selected-doctor-id'];
        if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
            throw new Error('Doctor seleccionado requerido');
        }
        const link = await prisma.asistenteDoctorVinculo.findFirst({
            where: {
                doctorId: selectedDoctorId,
                asistenteId: req.user.userId,
                activo: true
            },
            select: { id: true }
        });
        if (!link) {
            throw new Error('Asistente no vinculado a este doctor');
        }
        return selectedDoctorId;
    }
    throw new Error('Acceso denegado');
};
class RecipeController {
    // ===== TEMPLATES DE RECETAS =====
    /**
     * Subir template de receta personalizado del doctor
     */
    static async uploadRecipeTemplate(req, res) {
        try {
            const { doctorId } = req.params;
            const { pdfUrl, camposEditables } = req.body;
            if (!pdfUrl || !camposEditables) {
                return res.status(400).json({
                    success: false,
                    message: 'PDF URL y campos editables son requeridos'
                });
            }
            const template = await prisma.doctorRecipeTemplate.create({
                data: {
                    doctorId,
                    pdfUrl,
                    camposEditables: camposEditables
                }
            });
            logger_utils_1.securityLogger.info(`Template de receta creado para doctor ${doctorId}`, { templateId: template.id });
            res.status(201).json({
                success: true,
                data: template
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al crear template de receta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Obtener templates de recetas de un doctor
     */
    static async getRecipeTemplates(req, res) {
        try {
            const { doctorId } = req.params;
            const templates = await prisma.doctorRecipeTemplate.findMany({
                where: { doctorId },
                orderBy: { createdAt: 'desc' }
            });
            res.status(200).json({
                success: true,
                data: templates
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener templates de recetas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    // ===== RECETAS MÉDICAS =====
    /**
     * Crear nueva receta médica
     */
    static async createRecipe(req, res) {
        var _a, _b, _c, _d, _e, _f;
        try {
            console.log('Creating recipe with data:', req.body);
            const { doctorId, pacienteId, citaId, // Ahora se refiere a consultationId
            observaciones, esRecetaMedicamento = true, esSolicitudEstudios = false, medicamentos = [], estudios = [], realizadoPor, vinculadoADoctor } = req.body;
            // Validaciones básicas
            console.log('Validating required fields...');
            if (!doctorId || !pacienteId) {
                console.log('Missing required fields:', { doctorId, pacienteId });
                return res.status(400).json({
                    success: false,
                    message: 'Doctor ID y paciente ID son requeridos'
                });
            }
            console.log('Required fields validation passed');
            // Verificar suscripción activa del doctor
            const requesterUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const requester = await prisma.user.findUnique({
                where: { id: requesterUserId }
            });
            const doctorProfile = await prisma.doctor.findUnique({ where: { userId: requesterUserId } });
            const subscription = doctorProfile ? await prisma.subscription.findUnique({ where: { doctorId: doctorProfile.id } }) : null;
            if (!requester || !doctorProfile) {
                return res.status(400).json({ success: false, message: 'Perfil de doctor no encontrado' });
            }
            const normalizedStatus = subscription ? String(subscription.status).toLowerCase() : '';
            if (!subscription || normalizedStatus !== 'active') {
                return res.status(403).json({ success: false, message: 'Suscripción vencida. No puedes crear recetas.' });
            }
            // Verificar que el doctor autenticado puede crear recetas para este paciente
            const authenticatedDoctor = await prisma.doctor.findUnique({
                where: { userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.userId }
            });
            if (!authenticatedDoctor) {
                return res.status(400).json({
                    success: false,
                    message: 'Perfil de doctor no encontrado'
                });
            }
            // Verificar si el doctor es titular del paciente
            const isTitular = await prisma.doctorPatient.findUnique({
                where: {
                    doctorId_patientId: {
                        doctorId: authenticatedDoctor.id,
                        patientId: pacienteId
                    }
                }
            });
            // Si no es titular, verificar si es colaborador
            if (!isTitular) {
                const isCollaborator = await prisma.padecimientoDoctorColaborador.findFirst({
                    where: {
                        doctorId: authenticatedDoctor.id,
                        patientId: pacienteId
                    }
                });
                if (!isCollaborator) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes permisos para crear recetas para este paciente'
                    });
                }
            }
            // Si se proporciona citaId, verificar que sea una consulta válida del paciente
            if (citaId) {
                const consultation = await prisma.medicalRecord.findFirst({
                    where: {
                        id: citaId,
                        patientId: pacienteId,
                        vinculadoADoctor: vinculadoADoctor
                    }
                });
                if (!consultation) {
                    return res.status(400).json({
                        success: false,
                        message: 'La consulta seleccionada no es válida para este paciente'
                    });
                }
            }
            // Crear la receta principal con un placeholder temporal para archivoPdf
            console.log('Creating main recipe record...');
            const receta = await prisma.recetaMedica.create({
                data: {
                    doctorId,
                    pacienteId,
                    citaId,
                    archivoPdf: 'temp_placeholder.pdf', // Placeholder temporal
                    observaciones,
                    esRecetaMedicamento,
                    esSolicitudEstudios,
                    realizadoPor,
                    vinculadoADoctor
                }
            });
            console.log('Main recipe created with ID:', receta.id);
            // CRÍTICO: Crear medicamentos y estudios ANTES del PDF para que:
            // 1) El PDF incluya estos datos  2) Si el PDF falla, los datos igual se guardan
            if (esRecetaMedicamento && medicamentos.length > 0) {
                const medicamentosData = medicamentos.map((med) => ({
                    recetaId: receta.id,
                    medicamento: String(med.medicamento || '').trim(),
                    dosis: String(med.dosis || '').trim(),
                    frecuencia: String(med.frecuencia || '').trim(),
                    duracion: med.duracion ? String(med.duracion).trim() : null
                })).filter((m) => m.medicamento);
                if (medicamentosData.length > 0) {
                    await prisma.recetaDetalleMedicamento.createMany({ data: medicamentosData });
                    console.log('Medicamentos creados:', medicamentosData.length);
                }
            }
            if (esSolicitudEstudios && estudios.length > 0) {
                const estudiosData = estudios.map((estudio) => ({
                    recetaId: receta.id,
                    nombreEstudio: String(estudio.nombreEstudio || '').trim(),
                    indicaciones: estudio.indicaciones ? String(estudio.indicaciones).trim() : null
                })).filter((e) => e.nombreEstudio);
                if (estudiosData.length > 0) {
                    await prisma.recetaEstudioSolicitado.createMany({ data: estudiosData });
                    console.log('Estudios creados:', estudiosData.length);
                }
            }
            // Generar PDF después de tener medicamentos y estudios
            let pdfFileName;
            try {
                console.log('Generating PDF for recipe...');
                pdfFileName = await recipePdf_service_1.RecipePdfService.generateRecipePdf(receta.id);
                console.log('PDF generated:', pdfFileName);
            }
            catch (pdfError) {
                console.error('PDF generation failed (data already saved):', pdfError);
                const recetaCompleta = await prisma.recetaMedica.findUnique({
                    where: { id: receta.id },
                    include: {
                        detalleMedicamentos: true,
                        estudiosSolicitados: true,
                        doctor: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
                        paciente: { select: { id: true, firstName: true, lastName: true } }
                    }
                });
                return res.status(201).json({
                    success: true,
                    data: recetaCompleta,
                    message: 'Receta creada. La generación del PDF falló; puedes regenerarlo más tarde.'
                });
            }
            // La receta ya fue actualizada con archivoPdf en RecipePdfService
            const isS3Url = typeof pdfFileName === 'string' && pdfFileName.startsWith('http');
            const fileUrl = isS3Url ? pdfFileName : `uploads/recipes/${pdfFileName}`;
            const displayFileName = isS3Url ? `receta_${receta.id}.pdf` : pdfFileName;
            let fileSize = 0;
            if (!isS3Url) {
                const fsLocal = require('fs');
                const pathLocal = require('path');
                const localPath = pathLocal.join(__dirname, '../../uploads/recipes', String(pdfFileName));
                if (fsLocal.existsSync(localPath))
                    fileSize = fsLocal.statSync(localPath).size;
            }
            // Registrar el PDF en la tabla File para que aparezca en el historial clínico
            const fileRecord = await prisma.file.create({
                data: {
                    fileName: displayFileName,
                    fileType: 'application/pdf',
                    size: fileSize,
                    url: fileUrl,
                    category: 'PRESCRIPTION_REQUEST',
                    doctorId: vinculadoADoctor,
                    uploadedById: realizadoPor,
                    medicalRecordId: citaId || null
                }
            });
            console.log('PDF registered in File table with ID:', fileRecord.id);
            // Si hay una consulta asociada, también vincular el archivo a esa consulta
            if (citaId) {
                console.log('PDF linked to consultation:', citaId);
            }
            // Obtener la receta completa con detalles (medicamentos y estudios ya creados antes del PDF)
            const recetaCompleta = await prisma.recetaMedica.findUnique({
                where: { id: receta.id },
                include: {
                    detalleMedicamentos: true,
                    estudiosSolicitados: true,
                    doctor: {
                        select: {
                            id: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    },
                    paciente: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });
            // Delay 2-3 segundos para asegurar que el PDF esté formado y disponible en S3 antes del email
            await new Promise(resolve => setTimeout(resolve, 2500));
            // ENVIAR CORREO AUTOMÁTICAMENTE AL PACIENTE
            try {
                console.log('Sending automatic email to patient...');
                const svc = notification_service_1.NotificationService.getInstance();
                // Verificar que recetaCompleta existe
                if (!recetaCompleta) {
                    console.log('recetaCompleta is null, skipping email');
                    return;
                }
                // Obtener información del paciente para el correo
                const patientInfo = await prisma.patient.findUnique({
                    where: { id: pacienteId },
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        user: { select: { email: true } }
                    }
                });
                if (patientInfo && (patientInfo.email || ((_c = patientInfo.user) === null || _c === void 0 ? void 0 : _c.email))) {
                    const patientEmail = patientInfo.email || ((_d = patientInfo.user) === null || _d === void 0 ? void 0 : _d.email);
                    const patientName = `${patientInfo.firstName} ${patientInfo.lastName}`;
                    const doctorName = `${((_e = recetaCompleta.doctor) === null || _e === void 0 ? void 0 : _e.user.firstName) || ''} ${((_f = recetaCompleta.doctor) === null || _f === void 0 ? void 0 : _f.user.lastName) || ''}`.trim();
                    // Construir URL de visualización
                    const emissionDate = recetaCompleta.fechaEmision || new Date();
                    const viewUrl = recipePdf_service_1.RecipePdfService.buildPdfViewUrl(recetaCompleta.id, doctorId, emissionDate);
                    // Enviar correo automáticamente
                    const emailSent = await svc.sendRecipeToPatientEmail({
                        toEmail: patientEmail,
                        patientName,
                        doctorName,
                        recipeId: recetaCompleta.id,
                        viewUrl
                    });
                    if (emailSent) {
                        console.log('Recipe email sent successfully to patient:', patientEmail);
                        logger_utils_1.securityLogger.info(`Receta médica creada y enviada por correo: ${receta.id}`, {
                            doctorId,
                            pacienteId,
                            citaId,
                            patientEmail
                        });
                    }
                    else {
                        console.log('Failed to send recipe email to patient:', patientEmail);
                        logger_utils_1.securityLogger.warn(`Receta médica creada pero falló envío de correo: ${receta.id}`, {
                            doctorId,
                            pacienteId,
                            citaId,
                            patientEmail
                        });
                    }
                }
                else {
                    console.log('Patient email not found, skipping automatic email');
                    logger_utils_1.securityLogger.warn(`Receta médica creada pero paciente sin email: ${receta.id}`, {
                        doctorId,
                        pacienteId,
                        citaId
                    });
                }
            }
            catch (emailError) {
                console.error('Error sending automatic recipe email:', emailError);
                logger_utils_1.securityLogger.error(`Error enviando correo automático de receta: ${receta.id}`, emailError);
                // No fallar la creación de la receta por un error de correo
            }
            logger_utils_1.securityLogger.info(`Receta médica creada: ${receta.id}`, {
                doctorId,
                pacienteId,
                citaId
            });
            res.status(201).json({
                success: true,
                data: recetaCompleta
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al crear receta médica:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Obtener recetas del doctor autenticado (sus propias recetas)
     */
    static async getMyRecipes(req, res) {
        var _a;
        try {
            const { limit = 50, offset = 0 } = req.query;
            // Obtener el doctor del usuario autenticado
            const doctor = await prisma.doctor.findUnique({
                where: { userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId }
            });
            if (!doctor) {
                return res.status(400).json({
                    success: false,
                    message: 'Perfil de doctor no encontrado'
                });
            }
            const recetas = await prisma.recetaMedica.findMany({
                where: { doctorId: doctor.id },
                include: {
                    detalleMedicamentos: true,
                    estudiosSolicitados: true,
                    paciente: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    },
                    consulta: {
                        select: {
                            id: true,
                            createdAt: true,
                            notes: true
                        }
                    }
                },
                orderBy: { fechaEmision: 'desc' },
                take: Number(limit),
                skip: Number(offset)
            });
            const total = await prisma.recetaMedica.count({
                where: { doctorId: doctor.id }
            });
            res.status(200).json({
                success: true,
                data: recetas,
                pagination: {
                    total,
                    limit: Number(limit),
                    offset: Number(offset)
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener recetas del doctor:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Obtener recetas de un paciente
     */
    static async getPatientRecipes(req, res) {
        try {
            const { pacienteId } = req.params;
            const { limit = 50, offset = 0 } = req.query;
            const recetas = await prisma.recetaMedica.findMany({
                where: { pacienteId },
                include: {
                    detalleMedicamentos: true,
                    estudiosSolicitados: true,
                    doctor: {
                        select: {
                            id: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    },
                    consulta: {
                        select: {
                            id: true,
                            createdAt: true,
                            notes: true
                        }
                    }
                },
                orderBy: { fechaEmision: 'desc' },
                take: Number(limit),
                skip: Number(offset)
            });
            const total = await prisma.recetaMedica.count({
                where: { pacienteId }
            });
            res.status(200).json({
                success: true,
                data: recetas,
                pagination: {
                    total,
                    limit: Number(limit),
                    offset: Number(offset)
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener recetas del paciente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Obtener recetas de un doctor
     */
    static async getDoctorRecipes(req, res) {
        try {
            const { doctorId } = req.params;
            const { limit = 50, offset = 0 } = req.query;
            const recetas = await prisma.recetaMedica.findMany({
                where: { doctorId },
                include: {
                    detalleMedicamentos: true,
                    estudiosSolicitados: true,
                    paciente: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            user: {
                                select: { email: true }
                            }
                        }
                    },
                    consulta: {
                        select: {
                            id: true,
                            createdAt: true,
                            notes: true,
                            clinicalCase: {
                                select: {
                                    id: true,
                                    padecimiento: true
                                }
                            }
                        }
                    }
                },
                orderBy: { fechaEmision: 'desc' },
                take: Number(limit),
                skip: Number(offset)
            });
            const total = await prisma.recetaMedica.count({
                where: { doctorId }
            });
            // Mapear padecimiento: si no viene por consulta, intentar deducirlo del caso compartido
            const missingPatientIds = recetas
                .filter((r) => { var _a, _b; return !((_b = (_a = r === null || r === void 0 ? void 0 : r.consulta) === null || _a === void 0 ? void 0 : _a.clinicalCase) === null || _b === void 0 ? void 0 : _b.padecimiento); })
                .map((r) => r.paciente.id);
            let patientIdToPadecimiento = {};
            if (missingPatientIds.length > 0) {
                const uniqueIds = Array.from(new Set(missingPatientIds));
                const collabCases = await prisma.clinicalCase.findMany({
                    where: {
                        patientId: { in: uniqueIds },
                        colaboradores: { some: { doctorId } }
                    },
                    select: { patientId: true, padecimiento: true }
                });
                for (const c of collabCases) {
                    if (!patientIdToPadecimiento[c.patientId]) {
                        patientIdToPadecimiento[c.patientId] = c.padecimiento;
                    }
                }
            }
            const recetasWithDerived = recetas.map((r) => {
                var _a, _b, _c;
                return (Object.assign(Object.assign({}, r), { padecimiento: ((_b = (_a = r === null || r === void 0 ? void 0 : r.consulta) === null || _a === void 0 ? void 0 : _a.clinicalCase) === null || _b === void 0 ? void 0 : _b.padecimiento) || patientIdToPadecimiento[(_c = r === null || r === void 0 ? void 0 : r.paciente) === null || _c === void 0 ? void 0 : _c.id] || '' }));
            });
            res.status(200).json({
                success: true,
                data: recetasWithDerived,
                pagination: {
                    total,
                    limit: Number(limit),
                    offset: Number(offset)
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener recetas del doctor:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Probar configuración SMTP (conexión + envío real al correo del usuario autenticado).
     */
    static async testSmtpConnection(req, res) {
        var _a;
        try {
            if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId)) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            if (!(0, email_utils_1.isSmtpConfigured)()) {
                return res.status(503).json({
                    success: false,
                    message: 'SMTP no configurado en el servidor (SMTP_HOST, SMTP_USER o SMTP_PASS)',
                });
            }
            const verify = await (0, email_utils_1.verifySmtpConnection)();
            if (!verify.ok) {
                return res.status(500).json({ success: false, message: verify.message, stage: 'verify' });
            }
            const user = await prisma.user.findUnique({
                where: { id: req.user.userId },
                select: { email: true },
            });
            if (!(user === null || user === void 0 ? void 0 : user.email)) {
                return res.status(400).json({ success: false, message: 'No se encontró correo del usuario' });
            }
            const sent = await (0, email_utils_1.sendEmailHtml)(user.email, 'Prueba SMTP - Qlinexa360', '<p>Si recibes este correo, el envío SMTP del servidor funciona correctamente.</p>', email_utils_1.fromAddresses.noReply);
            if (!sent) {
                const detail = (0, email_utils_1.getLastSmtpError)() || 'Error desconocido al enviar';
                logger_utils_1.securityLogger.error('SMTP test send failed:', detail);
                return res.status(500).json({
                    success: false,
                    message: `Conexión SMTP OK, pero falló el envío de prueba: ${detail}`,
                    stage: 'send',
                });
            }
            return res.json({
                success: true,
                message: `Correo de prueba enviado a ${user.email}. Si el envío a pacientes falla, puede ser bloqueo Zoho (550 5.4.6) al enviar a correos externos.`,
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error en test SMTP:', error);
            return res.status(500).json({ success: false, message: 'Error interno al probar SMTP' });
        }
    }
    /**
     * Enviar receta por email al paciente
     */
    static async emailRecipeToPatient(req, res) {
        var _a, _b, _c, _d, _e;
        try {
            const { id } = req.params; // recipe id
            let doctorId = null;
            try {
                doctorId = await resolveDoctorId(req);
            }
            catch (resolveError) {
                return res.status(403).json({ success: false, message: resolveError.message || 'Acceso denegado' });
            }
            const recipe = await prisma.recetaMedica.findUnique({
                where: { id },
                include: {
                    paciente: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            user: { select: { email: true } }
                        }
                    },
                    doctor: { select: { id: true, user: { select: { firstName: true, lastName: true } } } }
                }
            });
            if (!recipe) {
                return res.status(404).json({ success: false, message: 'Receta no encontrada' });
            }
            if (doctorId && recipe.doctorId !== doctorId) {
                return res.status(403).json({ success: false, message: 'No tienes permiso para enviar esta receta' });
            }
            const patientEmail = ((_a = recipe.paciente) === null || _a === void 0 ? void 0 : _a.email) || ((_c = (_b = recipe.paciente) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.email) || null;
            if (!patientEmail) {
                return res.status(404).json({ success: false, message: 'El paciente no tiene correo registrado' });
            }
            // Construir URL de visualización simple (reutilizando lógica existente)
            let viewUrl;
            try {
                const tmpRes = await prisma.recetaMedica.findUnique({
                    where: { id },
                    select: { id: true, doctorId: true, fechaEmision: true, archivoPdf: true }
                });
                if (tmpRes) {
                    const emissionDate = tmpRes.fechaEmision || new Date('2025-08-11');
                    viewUrl = recipePdf_service_1.RecipePdfService.buildPdfViewUrl(tmpRes.id, tmpRes.doctorId, emissionDate);
                    // Enviar correo con enlace (sin adjunto)
                    const svc = notification_service_1.NotificationService.getInstance();
                    const sent = await svc.sendRecipeToPatientEmail({
                        toEmail: patientEmail,
                        patientName: `${recipe.paciente.firstName} ${recipe.paciente.lastName}`,
                        doctorName: `${((_d = recipe.doctor) === null || _d === void 0 ? void 0 : _d.user.firstName) || ''} ${((_e = recipe.doctor) === null || _e === void 0 ? void 0 : _e.user.lastName) || ''}`.trim(),
                        recipeId: recipe.id,
                        viewUrl
                    });
                    if (!sent) {
                        const detail = (0, email_utils_1.getLastSmtpError)() || 'No se pudo enviar el correo';
                        logger_utils_1.securityLogger.error('Fallo SMTP al enviar receta:', detail);
                        return res.status(500).json({ success: false, message: detail });
                    }
                    return res.json({ success: true, message: 'Receta enviada al paciente por correo' });
                }
            }
            catch (error) {
                logger_utils_1.securityLogger.error('Error al enviar receta por email:', error);
                return res.status(500).json({ success: false, message: 'Error interno del servidor' });
            }
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al enviar receta por email:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }
    /**
     * Obtener receta específica
     */
    static async getRecipeById(req, res) {
        try {
            const { id } = req.params;
            console.log('Getting recipe by ID:', id);
            const receta = await prisma.recetaMedica.findUnique({
                where: { id },
                include: {
                    detalleMedicamentos: true,
                    estudiosSolicitados: true,
                    doctor: {
                        select: {
                            id: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    },
                    paciente: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    },
                    consulta: {
                        select: {
                            id: true,
                            createdAt: true,
                            notes: true
                        }
                    }
                }
            });
            if (!receta) {
                console.log('Recipe not found for ID:', id);
                return res.status(404).json({
                    success: false,
                    message: 'Receta no encontrada'
                });
            }
            console.log('Recipe found:', receta.id);
            res.status(200).json({
                success: true,
                data: receta
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener receta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Generar URL segura para visualización de PDF
     */
    static async getRecipePdfViewUrl(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            console.log('Generating PDF view URL for recipe ID:', id);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuario no autenticado'
                });
            }
            // Verificar que la receta existe
            const receta = await prisma.recetaMedica.findUnique({
                where: { id },
                select: {
                    id: true,
                    archivoPdf: true,
                    doctorId: true,
                    pacienteId: true,
                    fechaEmision: true
                }
            });
            if (!receta || !receta.archivoPdf) {
                return res.status(404).json({
                    success: false,
                    message: 'Receta no encontrada'
                });
            }
            // Si el usuario es PATIENT, verificar que la receta pertenece a su paciente
            if (user.role === 'PATIENT') {
                // Buscar el Patient asociado al userId del usuario
                const patient = await prisma.patient.findUnique({
                    where: { userId: user.userId }
                });
                if (!patient) {
                    return res.status(403).json({
                        success: false,
                        message: 'No se encontró el perfil de paciente'
                    });
                }
                // Verificar que la receta pertenece a este paciente
                if (receta.pacienteId !== patient.id) {
                    logger_utils_1.securityLogger.security('Unauthorized recipe access attempt by patient', { recipeId: id, requestedBy: user.userId, recipePatientId: receta.pacienteId, patientId: patient.id }, user.userId, req.ip);
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes permisos para ver esta receta'
                    });
                }
            }
            // Solución temporal: generar un hash simple en lugar de JWT
            const crypto = require('crypto');
            const emissionDate = receta.fechaEmision || new Date('2025-08-11');
            const viewUrl = recipePdf_service_1.RecipePdfService.buildPdfViewUrl(receta.id, receta.doctorId, emissionDate);
            res.status(200).json({
                success: true,
                data: {
                    viewUrl,
                    expiresIn: 'permanente (enlace con verificación segura)'
                }
            });
        }
        catch (error) {
            console.error('Error generando URL de visualización:', error);
            logger_utils_1.securityLogger.error('Error al generar URL de visualización de PDF:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Servir PDF de receta para visualización pública.
     * Sin autenticación: usa hash+timestamp como token temporal.
     * Accesible por farmacias, familiares y cualquier persona que escanee el QR.
     */
    static async serveRecipePdf(req, res) {
        try {
            const { id } = req.params;
            const { temp } = req.query;
            console.log('Serving PDF for recipe ID:', id);
            if (!temp || typeof temp !== 'string') {
                return res.status(401).json({
                    success: false,
                    message: 'Token de visualización requerido.'
                });
            }
            // El parámetro t (timestamp) en enlaces antiguos ya no caduca: la seguridad es el hash temp.
            // Obtener la receta para verificar que existe
            const receta = await prisma.recetaMedica.findUnique({
                where: { id },
                select: { id: true, archivoPdf: true, doctorId: true, fechaEmision: true }
            });
            if (!receta || !receta.archivoPdf) {
                return res.status(404).json({
                    success: false,
                    message: 'PDF no encontrado'
                });
            }
            // Verificar el hash
            const crypto = require('crypto');
            const emissionDate = receta.fechaEmision || new Date('2025-08-11'); // Usar fecha de emisión real
            const expectedHash = recipePdf_service_1.RecipePdfService.generateProductionHash(receta.id, receta.doctorId, emissionDate);
            if (temp !== expectedHash) {
                return res.status(401).json({
                    success: false,
                    message: 'Token de visualización inválido.'
                });
            }
            // Si el PDF está en S3: redirigir a URL firmada (rápido, evita 504 por proxy + buffer grande y reduce carga en ECS).
            // El enlace del correo abre esta ruta; el navegador sigue el 302 y descarga el PDF directamente desde S3.
            if (receta.archivoPdf.startsWith('http')) {
                try {
                    const maxPresign = 7 * 24 * 60 * 60; // 604800 s — máximo típico SigV4; alineado con validez del token temp (~7 días)
                    const signed = await (0, file_utils_1.getS3SignedUrlIfExists)(receta.archivoPdf, maxPresign);
                    if (signed) {
                        return res.redirect(302, signed);
                    }
                }
                catch (signErr) {
                    console.error('Error generando URL firmada para PDF de receta:', signErr);
                }
                try {
                    const { buffer } = await (0, file_utils_1.fetchBufferFromUrl)(receta.archivoPdf);
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'inline; filename="receta.pdf"');
                    res.setHeader('Cache-Control', 'public, max-age=3600');
                    return res.send(buffer);
                }
                catch (fetchErr) {
                    console.error('Error obteniendo PDF de S3:', fetchErr);
                    return res.status(404).json({ success: false, message: 'PDF no encontrado' });
                }
            }
            // PDF local (desarrollo) - verificar si existe en disco
            const fsLocal = require('fs');
            const pathLocal = require('path');
            const filePath = pathLocal.join(__dirname, '../../uploads/recipes', receta.archivoPdf);
            if (!fsLocal.existsSync(filePath)) {
                // Archivo no existe (ej: receta antigua en ECS con disco efímero).
                // Regenerar PDF: si S3 está configurado, subirá ahí y actualizará archivoPdf.
                try {
                    const regenerated = await recipePdf_service_1.RecipePdfService.generateRecipePdf(id);
                    if (typeof regenerated === 'string' && regenerated.startsWith('http')) {
                        const { buffer } = await (0, file_utils_1.fetchBufferFromUrl)(regenerated);
                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', 'inline; filename="receta.pdf"');
                        res.setHeader('Cache-Control', 'public, max-age=3600');
                        return res.send(buffer);
                    }
                    // Si devolvió path local, verificar de nuevo
                    const newPath = pathLocal.join(__dirname, '../../uploads/recipes', regenerated);
                    if (fsLocal.existsSync(newPath)) {
                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', 'inline; filename="' + regenerated + '"');
                        res.setHeader('Cache-Control', 'public, max-age=3600');
                        return res.sendFile(newPath);
                    }
                }
                catch (regenError) {
                    console.error('Error regenerando PDF:', regenError);
                }
                return res.status(404).json({
                    success: false,
                    message: 'PDF no encontrado en el servidor'
                });
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="' + receta.archivoPdf + '"');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.sendFile(filePath);
            logger_utils_1.securityLogger.info(`PDF servido para visualización: ${id}`);
        }
        catch (error) {
            console.error('Error sirviendo PDF:', error);
            logger_utils_1.securityLogger.error('Error al servir PDF de receta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Generar y descargar PDF de receta.
     * Primero intenta servir el PDF existente (archivoPdf); si no existe, lo regenera.
     */
    static async downloadRecipePdf(req, res) {
        try {
            const { id } = req.params;
            console.log('Download PDF for recipe ID:', id);
            const receta = await prisma.recetaMedica.findUnique({
                where: { id },
                select: { id: true, archivoPdf: true }
            });
            if (!receta) {
                return res.status(404).json({ success: false, message: 'Receta no encontrada' });
            }
            // Si ya existe PDF en S3: servir sin regenerar (evita Puppeteer en cada request)
            if (receta.archivoPdf && receta.archivoPdf.startsWith('http')) {
                try {
                    const { buffer } = await (0, file_utils_1.fetchBufferFromUrl)(receta.archivoPdf);
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="receta_${id}.pdf"`);
                    return res.send(buffer);
                }
                catch (fetchErr) {
                    console.error('Error obteniendo PDF de S3:', fetchErr);
                    // Fallback: regenerar
                }
            }
            // Si existe PDF local
            if (receta.archivoPdf && !receta.archivoPdf.startsWith('http')) {
                const filePath = path.join(__dirname, '../../uploads/recipes', receta.archivoPdf);
                if (fs.existsSync(filePath)) {
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="receta_${id}.pdf"`);
                    return res.sendFile(filePath);
                }
            }
            // No existe o falló: regenerar
            const result = await recipePdf_service_1.RecipePdfService.generateRecipePdf(id);
            if (typeof result === 'string' && result.startsWith('http')) {
                try {
                    const { buffer } = await (0, file_utils_1.fetchBufferFromUrl)(result);
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="receta_${id}.pdf"`);
                    return res.send(buffer);
                }
                catch (fetchErr) {
                    console.error('Error obteniendo PDF de S3:', fetchErr);
                    return res.status(404).json({ success: false, message: 'PDF no encontrado' });
                }
            }
            const filePath = path.join(__dirname, '../../uploads/recipes', result);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ success: false, message: 'PDF no encontrado' });
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="receta_${id}.pdf"`);
            res.sendFile(filePath);
            logger_utils_1.securityLogger.info(`PDF descargado para receta: ${id}`);
        }
        catch (error) {
            console.error('Error generando PDF:', error);
            logger_utils_1.securityLogger.error('Error al generar PDF de receta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Actualizar receta médica
     */
    static async updateRecipe(req, res) {
        try {
            const { id } = req.params;
            const { observaciones, esRecetaMedicamento, esSolicitudEstudios, medicamentos = [], estudios = [] } = req.body;
            // Verificar que la receta existe
            const recetaExistente = await prisma.recetaMedica.findUnique({
                where: { id }
            });
            if (!recetaExistente) {
                return res.status(404).json({
                    success: false,
                    message: 'Receta no encontrada'
                });
            }
            // Actualizar la receta principal
            const recetaActualizada = await prisma.recetaMedica.update({
                where: { id },
                data: {
                    observaciones,
                    esRecetaMedicamento,
                    esSolicitudEstudios
                }
            });
            // Eliminar detalles existentes
            await prisma.recetaDetalleMedicamento.deleteMany({
                where: { recetaId: id }
            });
            await prisma.recetaEstudioSolicitado.deleteMany({
                where: { recetaId: id }
            });
            // Crear nuevos detalles de medicamentos si es receta de medicamentos
            if (esRecetaMedicamento && medicamentos.length > 0) {
                const medicamentosData = medicamentos.map((med) => ({
                    recetaId: id,
                    medicamento: med.medicamento,
                    dosis: med.dosis,
                    frecuencia: med.frecuencia,
                    duracion: med.duracion
                }));
                await prisma.recetaDetalleMedicamento.createMany({
                    data: medicamentosData
                });
            }
            // Crear nuevos estudios solicitados si es solicitud de estudios
            if (esSolicitudEstudios && estudios.length > 0) {
                const estudiosData = estudios.map((estudio) => ({
                    recetaId: id,
                    nombreEstudio: estudio.nombreEstudio,
                    indicaciones: estudio.indicaciones
                }));
                await prisma.recetaEstudioSolicitado.createMany({
                    data: estudiosData
                });
            }
            // Obtener la receta actualizada con detalles
            const recetaCompleta = await prisma.recetaMedica.findUnique({
                where: { id },
                include: {
                    detalleMedicamentos: true,
                    estudiosSolicitados: true,
                    doctor: {
                        select: {
                            id: true,
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    },
                    paciente: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });
            logger_utils_1.securityLogger.info(`Receta médica actualizada: ${id}`);
            res.status(200).json({
                success: true,
                data: recetaCompleta
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al actualizar receta médica:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Eliminar receta médica
     */
    static async deleteRecipe(req, res) {
        try {
            const { id } = req.params;
            console.log('Deleting recipe with ID:', id); // Added log
            // Verificar que la receta existe
            const receta = await prisma.recetaMedica.findUnique({
                where: { id }
            });
            if (!receta) {
                console.log('Recipe not found for deletion:', id); // Added log
                return res.status(404).json({
                    success: false,
                    message: 'Receta no encontrada'
                });
            }
            console.log('Recipe found, proceeding with deletion:', id); // Added log
            // Eliminar la receta (los detalles se eliminan automáticamente por CASCADE)
            await prisma.recetaMedica.delete({
                where: { id }
            });
            console.log('Recipe deleted successfully:', id); // Added log
            logger_utils_1.securityLogger.info(`Receta médica eliminada: ${id}`);
            res.status(200).json({
                success: true,
                message: 'Receta eliminada exitosamente'
            });
        }
        catch (error) {
            console.error('Error deleting recipe:', error); // Added log
            logger_utils_1.securityLogger.error('Error al eliminar receta médica:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Verificar autenticidad de receta (endpoint público, sin login).
     * Quien escanea el QR puede ser: farmacia, familiar, persona externa.
     * No requiere ser usuario de Qlinexa360. Solo lectura.
     */
    static async verifyRecipe(req, res) {
        try {
            const { id } = req.params;
            const { hash } = req.query;
            console.log('Verificando receta:', id, 'con hash:', hash);
            // Verificar que la receta existe
            const receta = await prisma.recetaMedica.findUnique({
                where: { id },
                include: {
                    doctor: {
                        include: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    },
                    paciente: {
                        include: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    },
                    detalleMedicamentos: true,
                    estudiosSolicitados: true
                }
            });
            if (!receta) {
                return res.status(404).json({
                    success: false,
                    message: 'Receta no encontrada'
                });
            }
            // Verificar el hash
            const emissionDate = receta.fechaEmision || new Date('2025-08-11');
            const expectedHash = recipePdf_service_1.RecipePdfService.generateProductionHash(receta.id, receta.doctorId, emissionDate);
            if (hash !== expectedHash) {
                return res.status(401).json({
                    success: false,
                    message: 'Token de visualización inválido.'
                });
            }
            // Si es petición del navegador (no AJAX) y hay PDF: redirigir a la vista digital de la receta
            const isBrowserRequest = !req.headers.accept || !req.headers.accept.includes('application/json');
            if (isBrowserRequest && receta.archivoPdf) {
                const pdfViewUrl = recipePdf_service_1.RecipePdfService.buildPdfViewUrl(receta.id, receta.doctorId, emissionDate);
                return res.redirect(302, pdfViewUrl);
            }
            // Preparar respuesta (para peticiones AJAX/JSON)
            const response = {
                success: true,
                data: {
                    isValid: true, // Si el hash coincide, la receta es válida
                    recipe: {
                        id: receta.id,
                        fechaEmision: receta.fechaEmision,
                        doctor: {
                            name: `${receta.doctor.user.firstName} ${receta.doctor.user.lastName}`,
                            specialization: receta.doctor.specialization,
                            certificadoProfesional: receta.doctor.certificadoProfesional,
                            certificadoEspecialidad: receta.doctor.certificadoEspecialidad,
                            certificadoMaestria: receta.doctor.certificadoMaestria
                        },
                        patient: {
                            name: `${receta.paciente.user.firstName} ${receta.paciente.user.lastName}`,
                            id: receta.paciente.id
                        },
                        medicamentos: receta.detalleMedicamentos,
                        estudios: receta.estudiosSolicitados,
                        observaciones: receta.observaciones
                    }
                }
            };
            // Si es una petición AJAX, devolver JSON
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.json(response);
            }
            // Si es una petición normal del navegador, devolver HTML
            const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verificación de Receta Médica</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { text-align: center; margin-bottom: 30px; }
                .status { padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; font-weight: bold; }
                .valid { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .invalid { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; margin: 20px 0; padding: 15px; border-radius: 5px; }
                .section { margin: 20px 0; }
                .section h3 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 5px; }
                .medication-item, .study-item { background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 3px; }
                .back-button { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                .back-button:hover { background: #0056b3; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔍 Verificación de Receta Médica</h1>
                    <p>Sistema de Autenticidad - Qlinexa360</p>
                </div>
                
                <div class="status ${true ? 'valid' : 'invalid'}">
                    ${true ? '✅ RECETA VÁLIDA Y AUTÉNTICA' : '❌ RECETA NO VÁLIDA'}
                </div>
                
                <div class="info">
                    <strong>Información de Verificación:</strong><br>
                    ID de Receta: ${receta.id}<br>
                    Fecha de Emisión: ${receta.fechaEmision ? new Date(receta.fechaEmision).toLocaleDateString('es-ES') : 'No especificada'}<br>
                    Hash de Verificación: ${hash}
                </div>
                
                <div class="section">
                    <h3>👨‍⚕️ Información del Doctor</h3>
                    <p><strong>Nombre:</strong> ${receta.doctor.user.firstName} ${receta.doctor.user.lastName}</p>
                    <p><strong>Especialidad:</strong> ${receta.doctor.specialization || 'No especificada'}</p>
                    <p><strong>Cédula Profesional:</strong> ${receta.doctor.certificadoProfesional || 'No especificada'}</p>
                    <p><strong>Cédula de Especialidad:</strong> ${receta.doctor.certificadoEspecialidad || 'No especificada'}</p>
                    <p><strong>Cédula de Maestría:</strong> ${receta.doctor.certificadoMaestria || 'No especificada'}</p>
                </div>
                
                <div class="section">
                    <h3>👤 Información del Paciente</h3>
                    <p><strong>Nombre:</strong> ${receta.paciente.user.firstName} ${receta.paciente.user.lastName}</p>
                    <p><strong>ID de Paciente:</strong> ${receta.paciente.id}</p>
                </div>
                
                ${receta.detalleMedicamentos.length > 0 ? `
                <div class="section">
                    <h3>💊 Medicamentos Prescritos</h3>
                    ${receta.detalleMedicamentos.map(med => `
                        <div class="medication-item">
                            <strong>${med.medicamento}</strong><br>
                            Dosis: ${med.dosis} | Frecuencia: ${med.frecuencia}${med.duracion ? ` | Duración: ${med.duracion}` : ''}
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                
                ${receta.estudiosSolicitados.length > 0 ? `
                <div class="section">
                    <h3>🔬 Estudios Solicitados</h3>
                    ${receta.estudiosSolicitados.map(estudio => `
                        <div class="study-item">
                            <strong>${estudio.nombreEstudio}</strong>${estudio.indicaciones ? `<br>Indicaciones: ${estudio.indicaciones}` : ''}
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                
                ${receta.observaciones ? `
                <div class="section">
                    <h3>📝 Observaciones</h3>
                    <p>${receta.observaciones}</p>
                </div>
                ` : ''}
                
                <div style="text-align: center;">
                    <a href="javascript:history.back()" class="back-button">← Volver</a>
                </div>
            </div>
        </body>
        </html>
      `;
            res.send(html);
        }
        catch (error) {
            console.error('Error verificando receta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Obtener estadísticas de recetas para un doctor
     */
    static async getRecipeStats(req, res) {
        try {
            const { doctorId } = req.params;
            // Obtener estadísticas básicas
            const totalRecetas = await prisma.recetaMedica.count({
                where: { doctorId }
            });
            const recetasMedicamentos = await prisma.recetaMedica.count({
                where: {
                    doctorId,
                    esRecetaMedicamento: true
                }
            });
            const solicitudesEstudios = await prisma.recetaMedica.count({
                where: {
                    doctorId,
                    esSolicitudEstudios: true
                }
            });
            // Obtener medicamentos más usados
            const medicamentosMasUsados = await prisma.recetaDetalleMedicamento.groupBy({
                by: ['medicamento'],
                where: {
                    receta: {
                        doctorId: doctorId
                    }
                },
                _count: {
                    medicamento: true
                },
                orderBy: {
                    _count: {
                        medicamento: 'desc'
                    }
                },
                take: 10
            });
            // Obtener estudios más solicitados
            const estudiosMasSolicitados = await prisma.recetaEstudioSolicitado.groupBy({
                by: ['nombreEstudio'],
                where: {
                    receta: {
                        doctorId: doctorId
                    }
                },
                _count: {
                    nombreEstudio: true
                },
                orderBy: {
                    _count: {
                        nombreEstudio: 'desc'
                    }
                },
                take: 10
            });
            res.status(200).json({
                success: true,
                data: {
                    totalRecetas,
                    recetasMedicamentos,
                    solicitudesEstudios,
                    medicamentosMasUsados: medicamentosMasUsados.map(item => ({
                        medicamento: item.medicamento,
                        count: item._count.medicamento
                    })),
                    estudiosMasSolicitados: estudiosMasSolicitados.map(item => ({
                        nombreEstudio: item.nombreEstudio,
                        count: item._count.nombreEstudio
                    }))
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener estadísticas de recetas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
    /**
     * Buscar pacientes para el módulo de recetas (incluye colaboradores)
     */
    static async searchPatientsForRecipes(req, res) {
        var _a;
        try {
            const { search } = req.query;
            // Obtener el doctor del usuario autenticado
            const doctor = await prisma.doctor.findUnique({
                where: { userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId }
            });
            if (!doctor) {
                return res.status(400).json({
                    success: false,
                    message: 'Perfil de doctor no encontrado'
                });
            }
            const doctorId = doctor.id;
            // Buscar pacientes directamente asociados al doctor (TITULARES)
            let directPatientsQuery = {
                doctors: { some: { doctorId } }
            };
            if (search) {
                directPatientsQuery = {
                    AND: [
                        { doctors: { some: { doctorId } } },
                        {
                            OR: [
                                { user: {
                                        OR: [
                                            { firstName: { contains: search, mode: 'insensitive' } },
                                            { lastName: { contains: search, mode: 'insensitive' } },
                                            { email: { contains: search, mode: 'insensitive' } }
                                        ]
                                    } },
                                { clinicalCases: {
                                        some: {
                                            padecimiento: { contains: search, mode: 'insensitive' }
                                        }
                                    } }
                            ]
                        }
                    ]
                };
            }
            const directPatients = await prisma.patient.findMany({
                where: directPatientsQuery,
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    clinicalCases: {
                        select: {
                            id: true,
                            padecimiento: true
                        }
                    },
                    doctors: {
                        where: { doctorId },
                        select: {
                            id: true
                        }
                    }
                }
            });
            // Buscar pacientes donde el doctor es colaborador (COLABORADORES)
            let collaborativePatientsQuery = {
                AND: [
                    {
                        clinicalCases: {
                            some: {
                                colaboradores: {
                                    some: { doctorId }
                                }
                            }
                        }
                    },
                    {
                        doctors: {
                            none: { doctorId }
                        }
                    }
                ]
            };
            if (search) {
                collaborativePatientsQuery.AND.push({
                    OR: [
                        { user: {
                                OR: [
                                    { firstName: { contains: search, mode: 'insensitive' } },
                                    { lastName: { contains: search, mode: 'insensitive' } },
                                    { email: { contains: search, mode: 'insensitive' } }
                                ]
                            } },
                        { clinicalCases: {
                                some: {
                                    padecimiento: { contains: search, mode: 'insensitive' }
                                }
                            } }
                    ]
                });
            }
            const collaborativePatients = await prisma.patient.findMany({
                where: collaborativePatientsQuery,
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    clinicalCases: {
                        where: {
                            colaboradores: {
                                some: { doctorId }
                            }
                        },
                        select: {
                            id: true,
                            padecimiento: true
                        }
                    },
                    doctors: {
                        where: { doctorId },
                        select: {
                            id: true
                        }
                    }
                }
            });
            // Combinar pacientes titulares y colaboradores
            const allPatients = [...directPatients, ...collaborativePatients];
            // Log de diagnóstico para paciente@test.com
            const dbg = allPatients.find((p) => { var _a; return ((_a = p.user) === null || _a === void 0 ? void 0 : _a.email) === 'paciente@test.com'; });
            if (dbg) {
                console.log('=== DIAGNÓSTICO RECETAS paciente@test.com ===');
                console.log('doctorsIds:', (dbg.doctors || []).map((d) => d.doctorId));
                console.log('clinicalCases:', (dbg.clinicalCases || []).map((c) => ({ id: c.id, padecimiento: c.padecimiento })));
            }
            // Formatear respuesta
            const formattedPatients = allPatients.map((patient) => {
                // Verificar si el doctor actual está en la lista de doctors de este paciente
                const isTitular = patient.doctors && patient.doctors.some((d) => d.doctorId === doctorId);
                return {
                    id: patient.id,
                    firstName: patient.user.firstName,
                    lastName: patient.user.lastName,
                    email: patient.user.email,
                    isTitular,
                    isCollaborator: !isTitular,
                    clinicalCases: patient.clinicalCases.map((case_) => ({
                        id: case_.id,
                        padecimiento: case_.padecimiento
                    }))
                };
            });
            res.status(200).json({
                success: true,
                data: formattedPatients
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al buscar pacientes para recetas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}
exports.RecipeController = RecipeController;
