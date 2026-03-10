"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultationController = void 0;
const client_1 = require("@prisma/client");
const error_utils_1 = require("../utils/error.utils");
const logger_utils_1 = require("../utils/logger.utils");
const prisma = new client_1.PrismaClient();
class ConsultationController {
    static async createBasicConsultation(req, res) {
        var _a;
        try {
            const { patientId, clinicalCaseId } = req.body;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                throw new error_utils_1.AppError('Usuario no autenticado', 401);
            }
            if (!patientId) {
                throw new error_utils_1.AppError('El ID del paciente es obligatorio', 400);
            }
            if (!clinicalCaseId) {
                throw new error_utils_1.AppError('El caso clínico es obligatorio. Selecciona un padecimiento antes de crear la consulta.', 400);
            }
            // Validar doctor y vínculo doctor-paciente
            const doctor = await prisma.doctor.findUnique({ where: { userId } });
            if (!doctor) {
                throw new error_utils_1.AppError('Perfil de doctor no encontrado', 404);
            }
            // Buscar relación titular; si no existe, permitir si es colaborador del caso
            let doctorPatientLink = await prisma.doctorPatient.findUnique({
                where: { doctorId_patientId: { doctorId: doctor.id, patientId } }
            });
            if (!doctorPatientLink) {
                const isCollaborator = await prisma.padecimientoDoctorColaborador.findFirst({
                    where: { doctorId: doctor.id, patientId, padecimientoId: clinicalCaseId }
                });
                if (!isCollaborator) {
                    throw new error_utils_1.AppError('No tienes acceso a este paciente. Verifica que seas el doctor titular o colaborador del caso clínico.', 403);
                }
                // Usar la relación doctorPatient del titular como vínculo para la consulta
                const titularLink = await prisma.doctorPatient.findFirst({ where: { patientId } });
                if (!titularLink) {
                    throw new error_utils_1.AppError('No se encontró vínculo titular para este paciente', 500);
                }
                doctorPatientLink = titularLink;
            }
            // Datos enviados desde el frontend (parte básica)
            const { date, reason, notes, isPublic, clinicalEvolution, tags = [], formData = {} } = req.body;
            // Crear la consulta básica
            const consultation = await prisma.medicalRecord.create({
                data: {
                    patientId,
                    clinicalCaseId,
                    doctorPatientId: doctorPatientLink.id,
                    userId,
                    autorConsultaId: userId,
                    realizadoPor: userId,
                    vinculadoADoctor: doctor.id,
                    diagnosis: notes,
                    treatment: notes,
                    notes,
                    reason,
                    tags,
                    clinicalEvolution,
                    formData,
                    date: date ? new Date(date) : new Date(),
                    isPublic: typeof isPublic === 'boolean' ? isPublic : true,
                    isComplete: false,
                    hasAttachments: false
                }
            });
            // Marcar notas anteriores del mismo caso clínico como no editables
            await prisma.medicalRecord.updateMany({
                where: { clinicalCaseId: clinicalCaseId, createdAt: { lt: consultation.createdAt } },
                data: { isEditable: false }
            });
            // Si es la primera consulta del paciente con este doctor, expirar cualquier pre-consulta pendiente
            const previousConsultations = await prisma.medicalRecord.count({
                where: {
                    patientId,
                    doctorPatient: {
                        doctorId: doctor.id
                    },
                    id: { not: consultation.id },
                    createdAt: { lt: consultation.createdAt }
                }
            });
            if (previousConsultations === 0) {
                // Es la primera consulta, expirar pre-consultas pendientes
                await prisma.preConsultation.updateMany({
                    where: {
                        patientId,
                        doctorId: doctor.id,
                        status: 'PENDING'
                    },
                    data: {
                        status: 'EXPIRED',
                        expiresAt: new Date() // Marcar como expirada ahora
                    }
                });
                console.log('Pre-consultas expiradas al crear la primera consulta real');
            }
            logger_utils_1.securityLogger.info(`Consulta básica creada: ${consultation.id} para paciente: ${patientId}`);
            res.status(201).json({
                success: true,
                data: consultation,
                message: 'Consulta básica creada exitosamente. Las consultas anteriores han sido bloqueadas.'
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al crear consulta básica:', error);
            if (error instanceof error_utils_1.AppError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            // Errores de Prisma (FK, validación, etc.)
            if (error.code === 'P2003') {
                return res.status(400).json({
                    message: 'Datos inválidos: el paciente o el caso clínico no existen. Verifica que hayas seleccionado un padecimiento.'
                });
            }
            if (error.code === 'P2025') {
                return res.status(404).json({ message: 'Registro no encontrado. Recarga la página e intenta de nuevo.' });
            }
            const message = error.message || 'Error al crear la consulta básica';
            res.status(500).json({ message });
        }
    }
    static async addAttachmentsToConsultation(req, res) {
        var _a, _b;
        try {
            const { consultationId } = req.params;
            const { files: filesRaw, links } = req.body;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const userRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
            if (!userId) {
                throw new error_utils_1.AppError('Usuario no autenticado', 401);
            }
            // Verificar que la consulta existe y no está bloqueada
            const consultation = await prisma.medicalRecord.findUnique({ where: { id: consultationId } });
            if (!consultation) {
                throw new error_utils_1.AppError('Consulta no encontrada', 404);
            }
            // Bloquear si la consulta no es editable (existe otra más reciente del mismo caso)
            if (!consultation.isEditable) {
                throw new error_utils_1.AppError('Esta consulta está bloqueada (solo lectura) porque existe una consulta más reciente.', 403);
            }
            // Normalizar lista de archivos (aceptar arreglo o objeto indexado)
            // Si viene como objeto con categorías, convertirlo a array plano
            let files = [];
            if (Array.isArray(filesRaw)) {
                // Formato antiguo: array plano (mantener compatibilidad)
                // Validar categorías para pacientes si vienen en el array
                if (userRole === 'PATIENT') {
                    for (const file of filesRaw) {
                        const category = file.category;
                        if (category === 'PRESCRIPTION_REQUEST' || category === 'DOCTOR_PHOTO') {
                            throw new error_utils_1.AppError(`Los pacientes no pueden subir archivos en la categoría "${category}". Solo pueden subir en "Resultados de Estudios" y "Fotos Subidas por Paciente".`, 403);
                        }
                        // Solo permitir STUDY_RESULT y PATIENT_PHOTO
                        if (category === 'STUDY_RESULT' || category === 'PATIENT_PHOTO') {
                            files.push(file);
                        }
                    }
                }
                else {
                    files = filesRaw;
                }
            }
            else if (filesRaw && typeof filesRaw === 'object') {
                // Si viene como objeto { PRESCRIPTION_REQUEST: [...], STUDY_RESULT: [...], etc. }
                // Convertir a array plano con la categoría incluida
                for (const [category, fileList] of Object.entries(filesRaw)) {
                    if (Array.isArray(fileList)) {
                        // Validar categorías permitidas para pacientes
                        if (userRole === 'PATIENT') {
                            if (category === 'PRESCRIPTION_REQUEST' || category === 'DOCTOR_PHOTO') {
                                throw new error_utils_1.AppError(`Los pacientes no pueden subir archivos en la categoría "${category}". Solo pueden subir en "Resultados de Estudios" y "Fotos Subidas por Paciente".`, 403);
                            }
                            // Solo permitir STUDY_RESULT y PATIENT_PHOTO
                            if (category !== 'STUDY_RESULT' && category !== 'PATIENT_PHOTO') {
                                continue; // Ignorar otras categorías
                            }
                        }
                        // Agregar la categoría a cada archivo
                        fileList.forEach((file) => {
                            files.push(Object.assign(Object.assign({}, file), { category: category }));
                        });
                    }
                }
            }
            let filesProcessed = 0;
            // Asociar archivos si se proporcionaron (preferir id si viene del upload)
            if (files && files.length > 0) {
                for (const file of files) {
                    try {
                        if (file.id) {
                            await prisma.file.update({
                                where: { id: file.id },
                                data: {
                                    category: file.category || undefined,
                                    uploadedById: userId,
                                    medicalRecordId: consultationId,
                                    doctorId: consultation.vinculadoADoctor || undefined,
                                    patientId: consultation.patientId
                                }
                            });
                            filesProcessed++;
                        }
                        else if (file.url) {
                            await prisma.file.upsert({
                                where: { url: file.url },
                                update: {
                                    fileName: file.fileName || undefined,
                                    fileType: file.fileType || undefined,
                                    size: file.size || undefined,
                                    category: file.category || undefined,
                                    uploadedById: userId,
                                    medicalRecordId: consultationId,
                                    doctorId: consultation.vinculadoADoctor || undefined,
                                    patientId: consultation.patientId
                                },
                                create: {
                                    fileName: file.fileName,
                                    fileType: file.fileType,
                                    size: file.size,
                                    url: file.url,
                                    category: file.category,
                                    uploadedById: userId,
                                    medicalRecordId: consultationId,
                                    doctorId: consultation.vinculadoADoctor || undefined,
                                    patientId: consultation.patientId
                                }
                            });
                            filesProcessed++;
                        }
                    }
                    catch (e) {
                        logger_utils_1.securityLogger.error('No se pudo asociar archivo a la consulta', e);
                    }
                }
            }
            // Crear enlaces si se proporcionaron
            if (links && links.length > 0) {
                const linkData = links.map((link) => ({
                    url: link.url,
                    description: link.description,
                    medicalRecordId: consultationId
                }));
                await prisma.link.createMany({
                    data: linkData
                });
            }
            // Actualizar el estado de la consulta
            const hasFiles = filesProcessed > 0;
            const hasLinks = links && links.length > 0;
            const hasAttachments = hasFiles || hasLinks;
            await prisma.medicalRecord.update({
                where: { id: consultationId },
                data: {
                    hasAttachments: hasAttachments,
                    isComplete: hasAttachments // Marcar como completa si tiene archivos
                }
            });
            // Obtener archivos y links actuales para confirmar asociación
            const updated = await prisma.medicalRecord.findUnique({
                where: { id: consultationId },
                include: {
                    files: true,
                    links: true
                }
            });
            logger_utils_1.securityLogger.info(`Archivos agregados a consulta: ${consultationId}`);
            res.status(200).json({
                success: true,
                message: 'Archivos agregados exitosamente',
                data: {
                    consultationId,
                    filesAdded: filesProcessed,
                    linksAdded: (links === null || links === void 0 ? void 0 : links.length) || 0,
                    files: (updated === null || updated === void 0 ? void 0 : updated.files) || [],
                    links: (updated === null || updated === void 0 ? void 0 : updated.links) || []
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al agregar archivos a consulta:', error);
            const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al agregar archivos', 500);
            res.status(handled.statusCode).json({ message: handled.message });
        }
    }
    /**
     * Actualizar consulta (guardado parcial) - solo si isEditable.
     * Permite al doctor o colaborador añadir/editar notas, formData, etc. hasta que se cree una nueva consulta.
     */
    static async updateConsultation(req, res) {
        var _a, _b;
        try {
            const { consultationId } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const userRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
            if (!userId) {
                throw new error_utils_1.AppError('Usuario no autenticado', 401);
            }
            const consultation = await prisma.medicalRecord.findUnique({
                where: { id: consultationId },
                include: { clinicalCase: true }
            });
            if (!consultation) {
                throw new error_utils_1.AppError('Consulta no encontrada', 404);
            }
            if (!consultation.isEditable) {
                throw new error_utils_1.AppError('Esta consulta está cerrada. Solo se puede editar la consulta más reciente hasta que se cree una nueva.', 403);
            }
            // Verificar permiso: doctor titular, autor o colaborador del caso
            const doctor = await prisma.doctor.findUnique({ where: { userId } });
            if (!doctor) {
                throw new error_utils_1.AppError('Perfil de doctor no encontrado', 404);
            }
            const isAuthor = consultation.autorConsultaId === userId;
            const isLinkedDoctor = consultation.vinculadoADoctor === doctor.id;
            const isCollaborator = await prisma.padecimientoDoctorColaborador.findFirst({
                where: {
                    doctorId: doctor.id,
                    patientId: consultation.patientId,
                    padecimientoId: consultation.clinicalCaseId
                }
            });
            const canEdit = isAuthor || isLinkedDoctor || !!isCollaborator || userRole === 'ASISTENTE';
            if (!canEdit) {
                throw new error_utils_1.AppError('No tienes permiso para editar esta consulta', 403);
            }
            const { notes, reason, date, tags, clinicalEvolution, formData, isPublic, diagnosis, treatment } = req.body;
            const updateData = { updatedAt: new Date() };
            if (notes !== undefined)
                updateData.notes = notes;
            if (reason !== undefined)
                updateData.reason = reason;
            if (date !== undefined)
                updateData.date = date ? new Date(date) : null;
            if (Array.isArray(tags))
                updateData.tags = tags;
            if (clinicalEvolution !== undefined)
                updateData.clinicalEvolution = clinicalEvolution;
            if (formData !== undefined && typeof formData === 'object')
                updateData.formData = formData;
            if (typeof isPublic === 'boolean')
                updateData.isPublic = isPublic;
            if (diagnosis !== undefined)
                updateData.diagnosis = diagnosis;
            if (treatment !== undefined)
                updateData.treatment = treatment;
            const updated = await prisma.medicalRecord.update({
                where: { id: consultationId },
                data: updateData
            });
            logger_utils_1.securityLogger.info(`Consulta actualizada (guardado parcial): ${consultationId}`);
            res.status(200).json({
                success: true,
                data: updated,
                message: 'Consulta actualizada'
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al actualizar consulta:', error);
            const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al actualizar consulta', 500);
            res.status(handled.statusCode).json({ message: handled.message });
        }
    }
    static async markConsultationComplete(req, res) {
        var _a;
        try {
            const { consultationId } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                throw new error_utils_1.AppError('Usuario no autenticado', 401);
            }
            const consultation = await prisma.medicalRecord.update({
                where: { id: consultationId },
                data: { isComplete: true }
            });
            logger_utils_1.securityLogger.info(`Consulta marcada como completa: ${consultationId}`);
            res.status(200).json({
                success: true,
                data: consultation,
                message: 'Consulta marcada como completa'
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al marcar consulta como completa:', error);
            const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al marcar consulta como completa', 500);
            res.status(handled.statusCode).json({ message: handled.message });
        }
    }
    static async getPendingConsultations(req, res) {
        var _a, _b;
        try {
            let { patientId } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                throw new error_utils_1.AppError('Usuario no autenticado', 401);
            }
            // Paciente accediendo a sus propias consultas: resolver 'self' al ID real
            if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === 'PATIENT' && patientId === 'self') {
                const patient = await prisma.patient.findUnique({
                    where: { userId },
                    select: { id: true }
                });
                if (!patient) {
                    throw new error_utils_1.AppError('Perfil de paciente no encontrado', 404);
                }
                patientId = patient.id;
            }
            const { clinicalCaseId } = req.query;
            const whereClause = { patientId, isComplete: false };
            if (clinicalCaseId && typeof clinicalCaseId === 'string') {
                whereClause.clinicalCaseId = clinicalCaseId;
            }
            const consultations = await prisma.medicalRecord.findMany({
                where: whereClause,
                include: {
                    files: true,
                    links: true
                },
                orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
            });
            res.status(200).json({
                success: true,
                data: consultations
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener consultas pendientes:', error);
            const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener consultas pendientes', 500);
            res.status(handled.statusCode).json({ message: handled.message });
        }
    }
    static async getConsultationStats(req, res) {
        var _a, _b, _c, _d;
        try {
            let { patientId } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                throw new error_utils_1.AppError('Usuario no autenticado', 401);
            }
            // Paciente accediendo a sus propias estadísticas: resolver 'self' al ID real
            if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === 'PATIENT' && patientId === 'self') {
                const patient = await prisma.patient.findUnique({
                    where: { userId },
                    select: { id: true }
                });
                if (!patient) {
                    throw new error_utils_1.AppError('Perfil de paciente no encontrado', 404);
                }
                patientId = patient.id;
            }
            const { clinicalCaseId } = req.query;
            const statsWhere = { patientId };
            if (clinicalCaseId && typeof clinicalCaseId === 'string') {
                statsWhere.clinicalCaseId = clinicalCaseId;
            }
            const stats = await prisma.medicalRecord.groupBy({
                by: ['isComplete', 'hasAttachments'],
                where: statsWhere,
                _count: {
                    id: true
                }
            });
            const total = await prisma.medicalRecord.count({
                where: statsWhere
            });
            const complete = ((_c = stats.find(s => s.isComplete)) === null || _c === void 0 ? void 0 : _c._count.id) || 0;
            const withAttachments = ((_d = stats.find(s => s.hasAttachments)) === null || _d === void 0 ? void 0 : _d._count.id) || 0;
            res.status(200).json({
                success: true,
                data: {
                    total,
                    complete,
                    withAttachments,
                    pending: total - complete
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener estadísticas de consultas:', error);
            const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener estadísticas', 500);
            res.status(handled.statusCode).json({ message: handled.message });
        }
    }
    // Nuevo método para obtener archivos por categoría
    static async getFilesByCategory(req, res) {
        var _a;
        try {
            const { consultationId } = req.params;
            const { category } = req.query;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                throw new error_utils_1.AppError('Usuario no autenticado', 401);
            }
            const whereClause = {
                medicalRecordId: consultationId
            };
            if (category) {
                whereClause.category = category;
            }
            const files = await prisma.file.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' }
            });
            res.status(200).json({
                success: true,
                data: files
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener archivos por categoría:', error);
            const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener archivos', 500);
            res.status(handled.statusCode).json({ message: handled.message });
        }
    }
    // Método para verificar si una consulta está bloqueada
    static async checkConsultationLock(req, res) {
        var _a;
        try {
            const { consultationId } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                throw new error_utils_1.AppError('Usuario no autenticado', 401);
            }
            const consultation = await prisma.medicalRecord.findUnique({
                where: { id: consultationId },
                select: {
                    id: true,
                    isComplete: true,
                    hasAttachments: true,
                    createdAt: true
                }
            });
            if (!consultation) {
                throw new error_utils_1.AppError('Consulta no encontrada', 404);
            }
            res.status(200).json({
                success: true,
                data: {
                    isLocked: false,
                    isComplete: consultation.isComplete,
                    hasAttachments: consultation.hasAttachments,
                    canEdit: true,
                    createdAt: consultation.createdAt
                }
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al verificar bloqueo de consulta:', error);
            const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al verificar bloqueo', 500);
            res.status(handled.statusCode).json({ message: handled.message });
        }
    }
    // Obtener consultas médicas de un paciente
    static async getPatientConsultations(req, res) {
        var _a, _b, _c;
        try {
            const { patientId } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                throw new error_utils_1.AppError('Usuario no autenticado', 401);
            }
            let doctorId = null;
            if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === 'DOCTOR') {
                const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
                doctorId = (doctor === null || doctor === void 0 ? void 0 : doctor.id) || null;
            }
            else if (((_c = req.user) === null || _c === void 0 ? void 0 : _c.role) === 'ASISTENTE') {
                const selectedDoctorId = req.headers['x-selected-doctor-id'];
                if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
                    throw new error_utils_1.AppError('Doctor seleccionado requerido', 400);
                }
                const link = await prisma.asistenteDoctorVinculo.findFirst({
                    where: {
                        doctorId: selectedDoctorId,
                        asistenteId: userId,
                        activo: true
                    },
                    select: { id: true }
                });
                if (!link) {
                    throw new error_utils_1.AppError('Asistente no vinculado a este doctor', 403);
                }
                doctorId = selectedDoctorId;
            }
            if (!doctorId) {
                throw new error_utils_1.AppError('Perfil de doctor no encontrado', 404);
            }
            const doctorPatientLink = await prisma.doctorPatient.findUnique({
                where: { doctorId_patientId: { doctorId: doctorId, patientId } }
            });
            if (!doctorPatientLink) {
                throw new error_utils_1.AppError('No tienes acceso a este paciente', 403);
            }
            // Obtener consultas médicas del paciente
            const consultations = await prisma.medicalRecord.findMany({
                where: {
                    patientId: patientId,
                    doctorPatientId: doctorPatientLink.id
                },
                include: {
                    clinicalCase: {
                        select: {
                            id: true,
                            padecimiento: true
                        }
                    }
                },
                orderBy: [
                    { date: 'desc' },
                    { createdAt: 'desc' }
                ]
            });
            res.json(consultations);
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al obtener consultas del paciente:', error);
            const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener consultas', 500);
            res.status(handled.statusCode).json({ message: handled.message });
        }
    }
}
exports.ConsultationController = ConsultationController;
