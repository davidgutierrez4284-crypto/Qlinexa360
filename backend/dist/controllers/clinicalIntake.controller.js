"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicalIntakeController = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const clinicalIntake_constants_1 = require("../constants/clinicalIntake.constants");
const clinicalIntakeConsentPdf_service_1 = require("../services/clinicalIntakeConsentPdf.service");
const file_utils_1 = require("../utils/file.utils");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const client_2 = require("@prisma/client");
const clinicalIntakeDisplay_utils_1 = require("../utils/clinicalIntakeDisplay.utils");
const clinicalIntakePortal_utils_1 = require("../utils/clinicalIntakePortal.utils");
const prisma = new client_1.PrismaClient();
const STAFF_VISIBLE_STATUSES = [
    'SUBMITTED_PENDING_VALIDATION',
    'APPROVED',
    'REJECTED',
    'CONVERTED'
];
const generateToken = () => (0, crypto_1.randomBytes)(32).toString('hex');
async function resolveDoctorForRequest(req) {
    var _a;
    if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId))
        return null;
    if (req.user.role === 'DOCTOR') {
        return prisma.doctor.findUnique({ where: { userId: req.user.userId } });
    }
    if (req.user.role === 'ASISTENTE') {
        const selectedDoctorId = req.headers['x-selected-doctor-id'];
        if (!selectedDoctorId || Array.isArray(selectedDoctorId))
            return null;
        const link = await prisma.asistenteDoctorVinculo.findFirst({
            where: { doctorId: selectedDoctorId, asistenteId: req.user.userId, activo: true }
        });
        if (!link)
            return null;
        return prisma.doctor.findUnique({ where: { id: selectedDoctorId } });
    }
    return null;
}
function intakeExpired(intake) {
    if (intake.linkNeverExpires)
        return false;
    if (!intake.expiresAt)
        return false;
    return intake.expiresAt < new Date() && intake.status === 'DRAFT';
}
async function ensureIntakePortalToken(doctorId, existingToken) {
    if (existingToken)
        return existingToken;
    const portalToken = generateToken();
    await prisma.doctor.update({
        where: { id: doctorId },
        data: { intakePortalToken: portalToken }
    });
    return portalToken;
}
async function buildPortalInfoData(doctor) {
    const agenda = await prisma.agendaPacientesLink.findFirst({
        where: { doctor_id: doctor.id }
    });
    const agendaEnabled = !!((agenda === null || agenda === void 0 ? void 0 : agenda.esta_activo) && (agenda === null || agenda === void 0 ? void 0 : agenda.link));
    return {
        doctorId: doctor.id,
        doctorName: doctor.user
            ? `${doctor.user.firstName} ${doctor.user.lastName}`.trim()
            : doctor.professionalTitle,
        reasons: clinicalIntake_constants_1.INTAKE_REASONS,
        agenda: {
            enabled: agendaEnabled,
            link: agendaEnabled ? agenda.link : null,
            message: agendaEnabled ? agenda.mensaje_custom || null : null
        }
    };
}
async function createPortalDraftIntake(doctorId) {
    return prisma.clinicalIntake.create({
        data: {
            token: generateToken(),
            doctorId,
            linkNeverExpires: true,
            status: 'DRAFT'
        }
    });
}
class ClinicalIntakeController {
    /** Staff: obtener link fijo de portal (slug amigable + token legacy para compatibilidad). */
    static async getPortalLink(req, res) {
        const doctor = await resolveDoctorForRequest(req);
        if (!doctor) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        const doctorFull = await prisma.doctor.findUnique({
            where: { id: doctor.id },
            include: { user: { select: { firstName: true, lastName: true } } }
        });
        if (!doctorFull) {
            return res.status(404).json({ success: false, message: 'Doctor no encontrado' });
        }
        const portalToken = await ensureIntakePortalToken(doctor.id, doctorFull.intakePortalToken);
        const portalSlug = await (0, clinicalIntakePortal_utils_1.ensureIntakePortalSlug)(prisma, doctorFull);
        const frontendUrl = (0, clinicalIntakePortal_utils_1.resolveFrontendBaseUrl)();
        const portalUrl = (0, clinicalIntakePortal_utils_1.intakePortalPublicUrl)(frontendUrl, portalSlug);
        return res.json({
            success: true,
            data: { portalToken, portalSlug, portalUrl }
        });
    }
    /** Staff: regenerar token legacy (/pre-registro/p/...). El slug amigable no cambia. */
    static async regeneratePortalLink(req, res) {
        const doctor = await resolveDoctorForRequest(req);
        if (!doctor) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        const doctorFull = await prisma.doctor.findUnique({
            where: { id: doctor.id },
            include: { user: { select: { firstName: true, lastName: true } } }
        });
        if (!doctorFull) {
            return res.status(404).json({ success: false, message: 'Doctor no encontrado' });
        }
        const portalToken = generateToken();
        await prisma.doctor.update({
            where: { id: doctor.id },
            data: { intakePortalToken: portalToken }
        });
        const portalSlug = await (0, clinicalIntakePortal_utils_1.ensureIntakePortalSlug)(prisma, doctorFull);
        const frontendUrl = (0, clinicalIntakePortal_utils_1.resolveFrontendBaseUrl)();
        const portalUrl = (0, clinicalIntakePortal_utils_1.intakePortalPublicUrl)(frontendUrl, portalSlug);
        return res.json({
            success: true,
            data: { portalToken, portalSlug, portalUrl }
        });
    }
    /** GET público por token */
    static async getPublic(req, res) {
        const { token } = req.params;
        const intake = await prisma.clinicalIntake.findUnique({
            where: { token },
            include: {
                doctor: {
                    include: {
                        user: { select: { firstName: true, lastName: true } }
                    }
                }
            }
        });
        if (!intake) {
            return res.status(404).json({ success: false, message: 'Enlace no válido' });
        }
        if (intakeExpired(intake)) {
            return res.status(410).json({ success: false, message: 'El enlace expiró' });
        }
        const agenda = await prisma.agendaPacientesLink.findFirst({
            where: { doctor_id: intake.doctorId }
        });
        const agendaEnabled = !!((agenda === null || agenda === void 0 ? void 0 : agenda.esta_activo) && (agenda === null || agenda === void 0 ? void 0 : agenda.link));
        // Plantillas (mismas que se usan en consulta). Público: solo lectura + captura, sin autenticación.
        const formTemplates = await prisma.formTemplate.findMany({
            include: {
                fields: { orderBy: { order: 'asc' } }
            },
            orderBy: { name: 'asc' }
        });
        return res.json({
            success: true,
            data: {
                status: intake.status,
                formData: intake.formData,
                consultationReason: intake.consultationReason,
                reasons: clinicalIntake_constants_1.INTAKE_REASONS,
                doctorName: intake.doctor.user
                    ? `${intake.doctor.user.firstName} ${intake.doctor.user.lastName}`.trim()
                    : intake.doctor.professionalTitle,
                expiresAt: intake.expiresAt,
                agenda: {
                    enabled: agendaEnabled,
                    link: agendaEnabled ? agenda.link : null,
                    message: agendaEnabled ? agenda.mensaje_custom || null : null
                },
                formTemplates
            }
        });
    }
    /** PUT borrador público */
    static async savePublicDraft(req, res) {
        const { token } = req.params;
        const { formData, consultationReason } = req.body;
        const intake = await prisma.clinicalIntake.findUnique({ where: { token } });
        if (!intake || intakeExpired(intake)) {
            return res.status(404).json({ success: false, message: 'Enlace no válido o expirado' });
        }
        if (intake.status !== 'DRAFT' && intake.status !== 'SUBMITTED_PENDING_VALIDATION') {
            return res.status(400).json({ success: false, message: 'Este formulario ya fue enviado' });
        }
        const updated = await prisma.clinicalIntake.update({
            where: { id: intake.id },
            data: {
                formData: formData !== null && formData !== void 0 ? formData : intake.formData,
                consultationReason: consultationReason !== null && consultationReason !== void 0 ? consultationReason : intake.consultationReason
            }
        });
        return res.json({ success: true, data: updated });
    }
    /** POST envío + PDF consentimiento */
    static async submitPublic(req, res) {
        var _a, _b, _c;
        const { token } = req.params;
        const { formData, consultationReason, consentPrivacy, consentTreatment, consentPlatform, consentSignerName } = req.body;
        const intake = await prisma.clinicalIntake.findUnique({
            where: { token },
            include: { doctor: { include: { user: true } } }
        });
        if (!intake || intakeExpired(intake)) {
            return res.status(404).json({ success: false, message: 'Enlace no válido o expirado' });
        }
        if (!consentPrivacy || !consentTreatment || !consentPlatform) {
            return res.status(400).json({ success: false, message: 'Debes aceptar todos los consentimientos' });
        }
        if (!consentSignerName || String(consentSignerName).trim().length < 3) {
            return res.status(400).json({ success: false, message: 'Firma (nombre) requerida' });
        }
        const patientBlock = formData === null || formData === void 0 ? void 0 : formData.patient;
        const fullName = `${(patientBlock === null || patientBlock === void 0 ? void 0 : patientBlock.firstName) || ''} ${(patientBlock === null || patientBlock === void 0 ? void 0 : patientBlock.lastName) || ''}`.trim() || consentSignerName;
        const email = String((patientBlock === null || patientBlock === void 0 ? void 0 : patientBlock.email) || '').trim() || 'paciente@preregistro.local';
        const phone = String((patientBlock === null || patientBlock === void 0 ? void 0 : patientBlock.phone) || '').trim();
        const ip = ((_b = (_a = req.headers['x-forwarded-for']) === null || _a === void 0 ? void 0 : _a.split(',')[0]) === null || _b === void 0 ? void 0 : _b.trim()) || req.ip || '';
        const signedAt = new Date();
        const doctorUserId = (_c = intake.doctor) === null || _c === void 0 ? void 0 : _c.userId;
        if (!doctorUserId) {
            return res.status(500).json({
                success: false,
                message: 'No se pudo registrar el consentimiento (doctor no encontrado)'
            });
        }
        let consentPdfUrl = null;
        let consentDocumentHash = null;
        let consentFileId = null;
        let mergedFormData = formData;
        try {
            const consentFile = await clinicalIntakeConsentPdf_service_1.ClinicalIntakeConsentPdfService.generateAndPersist({
                intakeId: intake.id,
                doctorId: intake.doctorId,
                uploadedByUserId: doctorUserId,
                patientId: intake.patientId,
                fullName,
                email,
                phone,
                signature: String(consentSignerName).trim(),
                ipAddress: ip,
                signedAt
            });
            consentPdfUrl = consentFile.url;
            consentDocumentHash = consentFile.hash;
            consentFileId = consentFile.fileId;
            mergedFormData = (0, clinicalIntakeConsentPdf_service_1.mergeConsentFileIntoFormData)(formData, {
                url: consentFile.url,
                fileName: consentFile.fileName,
                type: 'application/pdf',
                size: consentFile.size,
                fileId: consentFile.fileId
            });
        }
        catch (pdfErr) {
            console.error('Error generando PDF de consentimiento (pre-consulta):', pdfErr);
            return res.status(500).json({
                success: false,
                message: 'No se pudo generar el documento de consentimiento. Verifica la configuración del servidor e intenta de nuevo.'
            });
        }
        const updated = await prisma.clinicalIntake.update({
            where: { id: intake.id },
            data: {
                formData: mergedFormData,
                consultationReason,
                consentPrivacy: true,
                consentTreatment: true,
                consentPlatform: true,
                consentSignerName: String(consentSignerName).trim(),
                consentSignedAt: signedAt,
                consentIp: ip,
                consentPdfUrl,
                consentFileId,
                consentDocumentHash,
                status: 'SUBMITTED_PENDING_VALIDATION'
            }
        });
        try {
            await prisma.notification.create({
                data: {
                    userId: doctorUserId,
                    type: client_2.NotificationType.NEW_CONSULTATION,
                    title: 'Pre-consulta recibida',
                    message: `${fullName} envió una pre-consulta. Revísala en el módulo Pre-consultas.`,
                    data: { clinicalIntakeId: updated.id, path: `/dashboard/pre-consultas/${updated.id}` }
                }
            });
        }
        catch (notifErr) {
            console.error('Error creando notificación de pre-consulta:', notifErr);
        }
        return res.json({ success: true, data: { id: updated.id, status: updated.status } });
    }
    /** Subida de archivos (público con token, sin JWT). */
    static async uploadPublic(req, res) {
        var _a, _b;
        try {
            const { token } = req.params;
            const { category } = req.body;
            const file = req.file;
            if (!file) {
                return res.status(400).json({ success: false, message: 'No se ha subido ningún archivo' });
            }
            if (!category || !Object.values(client_2.FileCategory).includes(category)) {
                return res.status(400).json({ success: false, message: 'Categoría de archivo inválida' });
            }
            const intake = await prisma.clinicalIntake.findUnique({ where: { token } });
            if (!intake || intakeExpired(intake)) {
                return res.status(404).json({ success: false, message: 'Enlace no válido o expirado' });
            }
            const validation = (0, upload_middleware_1.validateFile)(file);
            if (!validation.isValid) {
                return res.status(400).json({ success: false, message: validation.error });
            }
            // Subir a S3 y registrar en DB. `uploadedById` debe ser un `User.id` válido.
            // - Si ya existe paciente vinculado: usar userId del paciente.
            // - Si aún no existe (portal público): usar userId del doctor propietario del intake.
            const patientUserId = intake.patientId
                ? (_a = (await prisma.patient.findUnique({ where: { id: intake.patientId }, select: { userId: true } }))) === null || _a === void 0 ? void 0 : _a.userId
                : null;
            const doctorUserId = ((_b = (await prisma.doctor.findUnique({ where: { id: intake.doctorId }, select: { userId: true } }))) === null || _b === void 0 ? void 0 : _b.userId) || null;
            const uploadedById = patientUserId || doctorUserId;
            if (!uploadedById) {
                return res.status(500).json({ success: false, message: 'No se pudo asociar el archivo a un usuario' });
            }
            const { url } = await (0, file_utils_1.uploadToS3)(file, category, uploadedById);
            // Registrar en DB (sin medicalRecordId hasta convertir)
            await prisma.file.create({
                data: {
                    fileName: file.originalname,
                    fileType: file.mimetype,
                    size: file.size,
                    url,
                    category,
                    uploadedById,
                    patientId: intake.patientId || null,
                    doctorId: intake.doctorId
                }
            });
            return res.status(201).json({
                success: true,
                file: {
                    fileName: file.originalname,
                    url,
                    type: file.mimetype,
                    size: file.size,
                    category
                }
            });
        }
        catch (e) {
            console.error('Error subiendo archivo en clinical intake:', e);
            return res.status(500).json({ success: false, message: e.message || 'Error al subir el archivo' });
        }
    }
    /** Staff: listar */
    static async listStaff(req, res) {
        const doctor = await resolveDoctorForRequest(req);
        if (!doctor) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        const intakes = await prisma.clinicalIntake.findMany({
            where: {
                doctorId: doctor.id,
                status: { in: STAFF_VISIBLE_STATUSES }
            },
            orderBy: { updatedAt: 'desc' },
            take: 100,
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
        });
        const data = intakes.map((row) => {
            var _a;
            const display = (0, clinicalIntakeDisplay_utils_1.getPatientDisplayFromIntake)(row);
            return Object.assign(Object.assign({}, row), { patientDisplayName: display.displayName, patient: (_a = row.patient) !== null && _a !== void 0 ? _a : {
                    firstName: display.firstName,
                    lastName: display.lastName,
                    email: display.email
                } });
        });
        return res.json({ success: true, data });
    }
    /** Staff: detalle */
    static async getStaff(req, res) {
        const doctor = await resolveDoctorForRequest(req);
        if (!doctor)
            return res.status(401).json({ success: false, message: 'No autorizado' });
        const { id } = req.params;
        const intake = await prisma.clinicalIntake.findFirst({
            where: { id, doctorId: doctor.id },
            include: {
                patient: { include: { user: true } },
                appointment: {
                    select: { id: true, date: true, status: true, confirmationStatus: true }
                }
            }
        });
        if (!intake)
            return res.status(404).json({ success: false, message: 'Pre-consulta no encontrada' });
        if (intake.status === 'DRAFT') {
            return res.status(404).json({ success: false, message: 'Esta pre-consulta aún no fue enviada por el paciente' });
        }
        const formTemplates = await prisma.formTemplate.findMany({
            include: { fields: { orderBy: { order: 'asc' } } },
            orderBy: { name: 'asc' }
        });
        const display = (0, clinicalIntakeDisplay_utils_1.getPatientDisplayFromIntake)(intake);
        return res.json({
            success: true,
            data: Object.assign(Object.assign({}, intake), { patientDisplayName: display.displayName, formTemplates })
        });
    }
    /** Staff: Guardar → convertir a Historial Clínico (MedicalRecord + adjuntos). */
    static async convertStaff(req, res) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const doctor = await resolveDoctorForRequest(req);
        if (!doctor)
            return res.status(401).json({ success: false, message: 'No autorizado' });
        const { id } = req.params;
        const { staffNotes: staffNotesBody } = req.body;
        const intake = await prisma.clinicalIntake.findFirst({
            where: { id, doctorId: doctor.id },
            include: { patient: { include: { user: true } } }
        });
        if (!intake)
            return res.status(404).json({ success: false, message: 'Pre-consulta no encontrada' });
        if (intake.status === 'CONVERTED') {
            return res.status(400).json({ success: false, message: 'Ya fue guardada en el historial clínico' });
        }
        const staffNotesTrim = String((_a = staffNotesBody !== null && staffNotesBody !== void 0 ? staffNotesBody : intake.staffNotes) !== null && _a !== void 0 ? _a : '').trim();
        const formData = intake.formData || {};
        const patientForm = formData.patient || {};
        let patientId = intake.patientId || null;
        let patientUserId = ((_b = intake.patient) === null || _b === void 0 ? void 0 : _b.userId) || null;
        // 1) Asegurar paciente (si no existe, crear estilo createPatient simplificado)
        if (!patientId || !patientUserId) {
            const email = String(patientForm.email || '').trim().toLowerCase();
            const firstName = String(patientForm.firstName || '').trim() || 'Paciente';
            const lastName = String(patientForm.lastName || '').trim() || '';
            const phone = String(patientForm.phone || '').trim() || undefined;
            const existingUser = email ? await prisma.user.findUnique({ where: { email }, include: { patientProfile: true } }) : null;
            if (existingUser === null || existingUser === void 0 ? void 0 : existingUser.patientProfile) {
                patientId = existingUser.patientProfile.id;
                patientUserId = existingUser.id;
            }
            else {
                const created = await prisma.user.create({
                    data: {
                        email: email || `patient-no-email@${(0, crypto_1.randomBytes)(12).toString('hex')}.qlinexa360.local`,
                        password: (0, crypto_1.randomBytes)(12).toString('hex'), // placeholder; onboarding real se maneja por invitación en otros flujos
                        firstName,
                        lastName,
                        role: 'PATIENT',
                        phone,
                        patientProfile: {
                            create: {
                                firstName,
                                lastName,
                                email: email || null,
                                phone,
                                gender: patientForm.gender || 'No especificado',
                                dateOfBirth: patientForm.dateOfBirth ? new Date(patientForm.dateOfBirth) : new Date(),
                                dataConsent: true,
                                dataConsentAt: new Date()
                            }
                        }
                    },
                    include: { patientProfile: true }
                });
                patientId = created.patientProfile.id;
                patientUserId = created.id;
            }
            // Vincular doctor-paciente
            const existingLink = await prisma.doctorPatient.findUnique({
                where: { doctorId_patientId: { doctorId: doctor.id, patientId: patientId } }
            });
            if (!existingLink) {
                await prisma.doctorPatient.create({
                    data: {
                        doctorId: doctor.id,
                        patientId: patientId,
                        status: 'activo',
                        specialization: (_c = doctor.specialization) !== null && _c !== void 0 ? _c : 'General',
                        context: 'Pre-consulta (capturada por paciente)'
                    }
                });
            }
            await prisma.clinicalIntake.update({
                where: { id: intake.id },
                data: { patientId: patientId }
            });
        }
        // 2) Crear doctorPatient (para medicalRecord)
        let doctorPatient = await prisma.doctorPatient.findUnique({
            where: { doctorId_patientId: { doctorId: doctor.id, patientId: patientId } }
        });
        if (!doctorPatient) {
            doctorPatient = await prisma.doctorPatient.create({
                data: {
                    doctorId: doctor.id,
                    patientId: patientId,
                    status: 'activo',
                    specialization: (_d = doctor.specialization) !== null && _d !== void 0 ? _d : 'General',
                    context: 'Pre-consulta (capturada por paciente)'
                }
            });
        }
        // 3) Caso clínico
        const padecimiento = `Pre-consulta ${intake.consultationReason || 'Medicina general'}`;
        let clinicalCase = await prisma.clinicalCase.findFirst({
            where: { patientId: patientId, padecimiento }
        });
        if (!clinicalCase) {
            clinicalCase = await prisma.clinicalCase.create({
                data: { patientId: patientId, padecimiento, status: 'ACTIVO' }
            });
        }
        // 4) MedicalRecord — formData con mismos fieldId que consultas (plantillas de especialidad)
        const intakeReserved = new Set([
            'patient',
            'additional',
            'health',
            'attachments',
            'scheduling',
            'files',
            'notes',
            'clinical'
        ]);
        const specialtyFromNested = ((_e = formData === null || formData === void 0 ? void 0 : formData.health) === null || _e === void 0 ? void 0 : _e.datosMedicosGenerales) && typeof formData.health.datosMedicosGenerales === 'object'
            ? Object.assign({}, formData.health.datosMedicosGenerales) : {};
        const specialtyFromTop = {};
        for (const [key, val] of Object.entries(formData)) {
            if (intakeReserved.has(key))
                continue;
            if (val !== undefined && val !== null && val !== '')
                specialtyFromTop[key] = val;
        }
        const mergedSpecialty = Object.assign(Object.assign({}, specialtyFromTop), specialtyFromNested);
        const motivo = String(((_f = formData === null || formData === void 0 ? void 0 : formData.health) === null || _f === void 0 ? void 0 : _f.motivoConsulta) || (formData === null || formData === void 0 ? void 0 : formData.motivoConsulta) || '').trim() ||
            intake.consultationReason ||
            'Pre-consulta';
        const notasPaciente = String(((_g = formData === null || formData === void 0 ? void 0 : formData.health) === null || _g === void 0 ? void 0 : _g.notasPaciente) || (formData === null || formData === void 0 ? void 0 : formData.notas) || (formData === null || formData === void 0 ? void 0 : formData.notes) || '').trim();
        const consultationFormData = Object.assign({ motivoConsulta: motivo, notas: notasPaciente || 'Pre-consulta registrada por el paciente.', evolucionClinica: 'INITIAL_EVALUATION', etiquetas: ['pre-consulta', 'evaluación-inicial'], registradoPor: 'PACIENTE_PRE_CONSULTA', origenConsulta: 'pre-consulta' }, mergedSpecialty);
        const patientNotes = String(notasPaciente || (formData === null || formData === void 0 ? void 0 : formData.notes) || ((_h = formData === null || formData === void 0 ? void 0 : formData.clinical) === null || _h === void 0 ? void 0 : _h.notes) || '').trim();
        const recordNotesParts = [
            patientNotes || 'Pre-consulta registrada por el paciente.',
            staffNotesTrim ? `Notas del equipo: ${staffNotesTrim}` : ''
        ].filter(Boolean);
        const medicalRecord = await prisma.medicalRecord.create({
            data: {
                patientId: patientId,
                clinicalCaseId: clinicalCase.id,
                doctorPatientId: doctorPatient.id,
                userId: patientUserId,
                autorConsultaId: doctor.userId,
                realizadoPor: doctor.userId,
                vinculadoADoctor: doctor.id,
                diagnosis: `Pre-consulta — ${motivo}`,
                treatment: 'Pendiente de evaluación médica',
                notes: recordNotesParts.join('\n\n'),
                reason: motivo,
                tags: ['pre-consulta', 'evaluación-inicial'],
                clinicalEvolution: 'INITIAL_EVALUATION',
                formData: consultationFormData,
                date: new Date(),
                isPublic: true,
                isComplete: false,
                hasAttachments: false,
                isEditable: true
            }
        });
        // 5) Adjuntos (si en formData vienen urls ya registradas, las conectamos)
        const urls = [];
        const filesBlock = ((_j = formData === null || formData === void 0 ? void 0 : formData.attachments) === null || _j === void 0 ? void 0 : _j.files) && typeof formData.attachments.files === 'object'
            ? formData.attachments.files
            : formData === null || formData === void 0 ? void 0 : formData.files;
        if (filesBlock && typeof filesBlock === 'object') {
            for (const key of Object.keys(filesBlock)) {
                const arr = filesBlock[key];
                if (Array.isArray(arr)) {
                    for (const item of arr) {
                        if (item === null || item === void 0 ? void 0 : item.url)
                            urls.push(String(item.url));
                    }
                }
            }
        }
        let linkedFileCount = 0;
        const urlSet = new Set(urls);
        if (intake.consentPdfUrl)
            urlSet.add(intake.consentPdfUrl);
        const allUrls = [...urlSet];
        if (allUrls.length > 0) {
            const files = await prisma.file.findMany({ where: { url: { in: allUrls } } });
            linkedFileCount = files.length;
            for (const f of files) {
                await prisma.file.update({
                    where: { id: f.id },
                    data: { medicalRecordId: medicalRecord.id, patientId: patientId, doctorPatientId: doctorPatient.id }
                });
            }
        }
        if (intake.consentFileId) {
            const consentFile = await prisma.file.findUnique({ where: { id: intake.consentFileId } });
            if (consentFile && !consentFile.medicalRecordId) {
                await prisma.file.update({
                    where: { id: consentFile.id },
                    data: {
                        medicalRecordId: medicalRecord.id,
                        patientId: patientId,
                        doctorPatientId: doctorPatient.id
                    }
                });
                if (!allUrls.includes(consentFile.url)) {
                    linkedFileCount += 1;
                }
            }
        }
        const intakeLinks = Array.isArray((_k = formData === null || formData === void 0 ? void 0 : formData.attachments) === null || _k === void 0 ? void 0 : _k.links) ? formData.attachments.links : [];
        const linksToCreate = intakeLinks
            .map((link) => {
            const url = String((link === null || link === void 0 ? void 0 : link.url) || '').trim();
            if (!url)
                return null;
            const description = String((link === null || link === void 0 ? void 0 : link.description) || (link === null || link === void 0 ? void 0 : link.label) || '').trim() || 'Enlace compartido por el paciente';
            return { url, description };
        })
            .filter(Boolean);
        if (linksToCreate.length > 0) {
            await prisma.link.createMany({
                data: linksToCreate.map((l) => ({
                    url: l.url,
                    description: l.description,
                    medicalRecordId: medicalRecord.id
                }))
            });
        }
        if (linkedFileCount > 0 || linksToCreate.length > 0) {
            await prisma.medicalRecord.update({
                where: { id: medicalRecord.id },
                data: { hasAttachments: true }
            });
        }
        const updated = await prisma.clinicalIntake.update({
            where: { id: intake.id },
            data: {
                status: 'CONVERTED',
                staffNotes: staffNotesTrim || intake.staffNotes,
                convertedClinicalCaseId: clinicalCase.id,
                convertedMedicalRecordId: medicalRecord.id
            }
        });
        return res.json({ success: true, data: updated });
    }
    /** Staff: enviar enlace por correo (crea intake) */
    static async sendLink(req, res) {
        const doctor = await resolveDoctorForRequest(req);
        if (!doctor) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        const { patientId, appointmentId, email } = req.body;
        const safeEmail = (email || '').toString().trim().toLowerCase();
        if (!patientId && !safeEmail) {
            return res.status(400).json({
                success: false,
                message: 'Ingresa un correo o selecciona un paciente.'
            });
        }
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + clinicalIntake_constants_1.INTAKE_LINK_EXPIRY_DAYS);
        const intake = await prisma.clinicalIntake.create({
            data: {
                token: generateToken(),
                doctorId: doctor.id,
                patientId: patientId || null,
                appointmentId: appointmentId || null,
                expiresAt,
                status: 'DRAFT',
                formData: safeEmail ? { patient: { email: safeEmail } } : undefined
            }
        });
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const link = `${frontendUrl}/pre-registro/${intake.token}`;
        // TODO: enviar correo con NotificationService
        if (safeEmail) {
            console.log(`Pre-registro: enviar enlace a ${safeEmail}: ${link}`);
        }
        return res.json({ success: true, data: { id: intake.id, link, token: intake.token } });
    }
    /** Staff: notas internas y/o aprobar / rechazar */
    static async patchStaff(req, res) {
        const doctor = await resolveDoctorForRequest(req);
        if (!doctor) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }
        const { id } = req.params;
        const { status, staffNotes } = req.body;
        const intake = await prisma.clinicalIntake.findFirst({
            where: { id, doctorId: doctor.id }
        });
        if (!intake) {
            return res.status(404).json({ success: false, message: 'Pre-registro no encontrado' });
        }
        if (intake.status === 'CONVERTED') {
            return res.status(400).json({ success: false, message: 'Ya fue guardada en el historial clínico' });
        }
        const data = {};
        if (staffNotes !== undefined) {
            data.staffNotes = String(staffNotes).trim() || null;
        }
        if (status) {
            if (!['APPROVED', 'REJECTED'].includes(status)) {
                return res.status(400).json({ success: false, message: 'status debe ser APPROVED o REJECTED' });
            }
            data.status = status;
        }
        if (!data.status && data.staffNotes === undefined) {
            return res.status(400).json({ success: false, message: 'Nada que actualizar' });
        }
        const updated = await prisma.clinicalIntake.update({
            where: { id },
            data
        });
        return res.json({ success: true, data: updated });
    }
    /** Portal fijo (token legacy): info */
    static async getPortalInfo(req, res) {
        const { portalToken } = req.params;
        const doctor = await prisma.doctor.findFirst({
            where: { intakePortalToken: portalToken },
            include: { user: { select: { firstName: true, lastName: true } } }
        });
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Portal no encontrado' });
        }
        return res.json({ success: true, data: await buildPortalInfoData(doctor) });
    }
    /** Portal fijo (slug amigable): info */
    static async getPortalInfoBySlug(req, res) {
        const { doctorSlug } = req.params;
        const doctor = await prisma.doctor.findFirst({
            where: { intakePortalSlug: doctorSlug },
            include: { user: { select: { firstName: true, lastName: true } } }
        });
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Portal no encontrado' });
        }
        return res.json({ success: true, data: await buildPortalInfoData(doctor) });
    }
    /** Portal fijo: iniciar borrador (token legacy) */
    static async startPortal(req, res) {
        const { portalToken } = req.params;
        const doctor = await prisma.doctor.findFirst({
            where: { intakePortalToken: portalToken },
            select: { id: true }
        });
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Portal no encontrado' });
        }
        const intake = await createPortalDraftIntake(doctor.id);
        return res.json({ success: true, data: { token: intake.token } });
    }
    /** Portal fijo: iniciar borrador (slug amigable) */
    static async startPortalBySlug(req, res) {
        const { doctorSlug } = req.params;
        const doctor = await prisma.doctor.findFirst({
            where: { intakePortalSlug: doctorSlug },
            select: { id: true }
        });
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Portal no encontrado' });
        }
        const intake = await createPortalDraftIntake(doctor.id);
        return res.json({ success: true, data: { token: intake.token } });
    }
}
exports.ClinicalIntakeController = ClinicalIntakeController;
