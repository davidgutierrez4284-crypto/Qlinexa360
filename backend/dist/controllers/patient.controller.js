"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyRecipePdfViewUrl = exports.getMyRecipeById = exports.getMyRecipes = exports.deactivatePatientInsurancePolicy = exports.updatePatientInsurancePolicy = exports.addPatientInsurancePolicy = exports.getPatientInsurancePolicies = exports.getPatientCompleteData = exports.getDoctorPatients = exports.getPhotoHistory = exports.getMyPhotoHistory = exports.getMyConsultations = exports.getMyAppointments = exports.getMyClinicalCases = exports.getMyProfile = exports.registerPatient = void 0;
const client_1 = require("@prisma/client");
const password_utils_1 = require("../utils/password.utils");
const file_utils_1 = require("../utils/file.utils");
const error_utils_1 = require("../utils/error.utils");
const date_utils_1 = require("../utils/date.utils");
const mercadopago_teleconsultation_service_1 = require("../payments/mercadopago/mercadopago.teleconsultation.service");
const mercadopago_inperson_service_1 = require("../payments/mercadopago/mercadopago.inperson.service");
const mercadopago_refund_service_1 = require("../payments/mercadopago/mercadopago.refund.service");
const patientPortal_utils_1 = require("../utils/patientPortal.utils");
const recipePdf_service_1 = require("../services/recipePdf.service");
const logger_utils_1 = require("../utils/logger.utils");
const prisma = new client_1.PrismaClient();
// =================================================================
// REGISTRO DE PACIENTE
// =================================================================
const registerPatient = async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, dateOfBirth } = req.body;
        // Validación de campos obligatorios (responde 400 en vez de fallar con 500)
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                message: "Faltan campos obligatorios: email, contraseña, nombre y apellidos son requeridos",
            });
        }
        const normalizedEmail = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({ message: "El email no es válido" });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
        }
        // Verificar si el usuario ya existe
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });
        if (existingUser) {
            return res.status(400).json({ message: "El email ya está registrado" });
        }
        // Encriptar la contraseña (login usa bcrypt.compare; almacenar en texto plano impedía iniciar sesión)
        const hashedPassword = await (0, password_utils_1.hashPassword)(String(password));
        // Crear el nuevo usuario y perfil de paciente
        const newUser = await prisma.user.create({
            data: {
                email: normalizedEmail,
                password: hashedPassword,
                firstName,
                lastName,
                phone,
                role: 'PATIENT',
                patientProfile: {
                    create: {
                        firstName,
                        lastName,
                        email: normalizedEmail,
                        phone: phone || null, // Guardar el teléfono en el modelo Patient
                        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date(),
                        gender: 'No especificado',
                        dataConsent: true,
                        dataConsentAt: new Date(),
                    }
                }
            },
            include: {
                patientProfile: true
            }
        });
        res.status(201).json({
            message: "Paciente registrado exitosamente",
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                role: newUser.role
            }
        });
    }
    catch (error) {
        console.error("Error al registrar paciente:", error);
        res.status(500).json({ message: "Error al registrar paciente" });
    }
};
exports.registerPatient = registerPatient;
// =================================================================
// OBTENER EXPEDIENTE DEL PACIENTE (mismos datos que registra el profesional; solo lectura en la app)
// =================================================================
const getMyProfile = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ message: 'Acceso denegado. Solo para pacientes.' });
        }
        const patient = await prisma.patient.findUnique({
            where: { userId: req.user.userId },
            include: {
                user: true,
                emergencyContacts: true
            }
        });
        if (!patient) {
            return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
        }
        const clinicalHistoryPortalEnabled = await (0, patientPortal_utils_1.patientHasClinicalHistoryPortalAccess)(patient.id);
        res.json(Object.assign(Object.assign({}, patient), { clinicalHistoryPortalEnabled }));
    }
    catch (error) {
        console.error('Error al obtener perfil del paciente:', error);
        res.status(500).json({ message: 'Error al obtener perfil' });
    }
};
exports.getMyProfile = getMyProfile;
// =================================================================
// OBTENER CASOS CLÍNICOS DEL PACIENTE (VISTA DEL PACIENTE)
// =================================================================
const getMyClinicalCases = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ message: 'Acceso denegado. Solo para pacientes.' });
        }
        // Buscar el paciente
        const patient = await prisma.patient.findUnique({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        if (!patient) {
            return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
        }
        const visibleDoctorPatientIds = await (0, patientPortal_utils_1.getVisibleDoctorPatientIdsForPatient)(patient.id);
        if (visibleDoctorPatientIds.length === 0) {
            return res.json([]);
        }
        const patientWithCases = await prisma.patient.findUnique({
            where: { userId: req.user.userId },
            include: {
                clinicalCases: {
                    include: {
                        medicalRecords: {
                            where: { doctorPatientId: { in: visibleDoctorPatientIds } },
                            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
                            select: {
                                id: true,
                                diagnosis: true,
                                notes: true,
                                isPublic: true,
                                clinicalEvolution: true,
                                createdAt: true,
                                date: true,
                                reason: true,
                                tags: true,
                                formData: true,
                                treatment: true
                            }
                        },
                        colaboradores: {
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
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!patientWithCases) {
            return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
        }
        // Procesar los casos clínicos para el paciente
        const processedCases = patientWithCases.clinicalCases
            .map(clinicalCase => {
            // Procesar las consultas según la visibilidad
            const processedConsultations = clinicalCase.medicalRecords.map(consultation => {
                const baseConsultation = {
                    id: consultation.id,
                    clinicalEvolution: consultation.clinicalEvolution,
                    createdAt: consultation.createdAt,
                    date: consultation.date,
                    reason: consultation.reason,
                    tags: consultation.tags,
                    formData: consultation.formData
                };
                // Si la consulta es pública, mostrar todo el contenido
                if (consultation.isPublic) {
                    return Object.assign(Object.assign({}, baseConsultation), { diagnosis: consultation.diagnosis, notes: consultation.notes, treatment: consultation.treatment, isContentVisible: true });
                }
                else {
                    // Si es privada, mostrar que existe pero ocultar contenido
                    return Object.assign(Object.assign({}, baseConsultation), { diagnosis: 'Contenido privado', notes: 'Contenido privado', treatment: 'Contenido privado', isContentVisible: false });
                }
            });
            return {
                id: clinicalCase.id,
                padecimiento: clinicalCase.padecimiento,
                createdAt: clinicalCase.createdAt,
                updatedAt: clinicalCase.updatedAt,
                consultations: processedConsultations,
                collaborators: clinicalCase.colaboradores.map(colab => ({
                    id: colab.doctor.id,
                    name: `${colab.doctor.user.firstName} ${colab.doctor.user.lastName}`,
                    role: colab.rol
                }))
            };
        })
            .filter((clinicalCase) => clinicalCase.consultations.length > 0);
        res.json(processedCases);
    }
    catch (error) {
        console.error('Error al obtener casos clínicos del paciente:', error);
        res.status(500).json({ message: 'Error al obtener casos clínicos' });
    }
};
exports.getMyClinicalCases = getMyClinicalCases;
// =================================================================
// CITAS DEL PACIENTE (agenda / mis citas)
// =================================================================
const getMyAppointments = async (req, res) => {
    var _a;
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ message: 'Acceso denegado. Solo para pacientes.' });
        }
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { email: true },
        });
        const patient = await prisma.patient.findUnique({
            where: { userId: req.user.userId }
        });
        if (!patient && !(user === null || user === void 0 ? void 0 : user.email)) {
            return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
        }
        const normalizedEmail = (_a = user === null || user === void 0 ? void 0 : user.email) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
        const relatedPatients = await prisma.patient.findMany({
            where: {
                OR: [
                    { userId: req.user.userId },
                    ...(normalizedEmail
                        ? [{ email: { equals: normalizedEmail, mode: 'insensitive' } }]
                        : []),
                ],
            },
            select: { id: true },
        });
        const patientIds = [...new Set(relatedPatients.map((p) => p.id))];
        if ((patient === null || patient === void 0 ? void 0 : patient.id) && !patientIds.includes(patient.id)) {
            patientIds.push(patient.id);
        }
        const from = new Date();
        from.setDate(from.getDate() - 30);
        const to = new Date();
        to.setDate(to.getDate() + 365);
        const appointments = await prisma.appointment.findMany({
            where: {
                date: { gte: from, lte: to },
                OR: [
                    { userId: req.user.userId },
                    ...(patientIds.length > 0 ? [{ patientId: { in: patientIds } }] : []),
                    { patient: { userId: req.user.userId } },
                    ...(normalizedEmail
                        ? [{ patient: { email: { equals: normalizedEmail, mode: 'insensitive' } } }]
                        : []),
                ],
                AND: [
                    {
                        OR: [
                            { confirmationStatus: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] } },
                            {
                                confirmationStatus: 'CANCELLED',
                                mercadoPagoRefundRequests: { some: { status: { in: ['pending', 'completed', 'failed'] } } },
                            },
                        ],
                    },
                ],
            },
            include: {
                doctor: { include: { user: true } },
                teleconsultation: {
                    select: { meetingUrl: true, consentSigned: true }
                }
            },
            orderBy: { date: 'asc' },
            take: 100
        });
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const data = await Promise.all(appointments.map(async (apt) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            const pendingReq = await prisma.appointmentConfirmationRequest.findFirst({
                where: {
                    appointmentId: apt.id,
                    status: 'PENDING',
                    expiresAt: { gt: new Date() }
                },
                orderBy: { createdAt: 'desc' }
            });
            const fallbackReq = pendingReq ||
                (await prisma.appointmentConfirmationRequest.findFirst({
                    where: { appointmentId: apt.id },
                    orderBy: { createdAt: 'desc' }
                }));
            const tz = apt.doctor.timezone || 'America/Mexico_City';
            const doctorName = apt.doctor.user
                ? `${apt.doctor.professionalTitle || ''} ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`.trim()
                : apt.doctor.professionalTitle || 'Profesional';
            const confirmationLabels = {
                PENDING: 'Pendiente de confirmación',
                CONFIRMED: 'Confirmada',
                RESCHEDULED: 'Reprogramada',
                CANCELLED: 'Cancelada'
            };
            const token = fallbackReq === null || fallbackReq === void 0 ? void 0 : fallbackReq.confirmationToken;
            const manageLink = token
                ? apt.appointmentType === 'teleconsulta'
                    ? `${baseUrl}/teleconsulta/${token}`
                    : `${baseUrl}/confirm-appointment/${token}`
                : null;
            let paymentCtx = await (0, mercadopago_teleconsultation_service_1.getTeleconsultationPaymentContext)(apt.doctorId, apt.id);
            let inPersonCtx = apt.appointmentType === 'presencial'
                ? await (0, mercadopago_inperson_service_1.getInPersonPaymentContext)(apt.doctorId, apt.id)
                : null;
            if ((inPersonCtx === null || inPersonCtx === void 0 ? void 0 : inPersonCtx.paymentOffered) &&
                inPersonCtx.paymentStatus === 'pending' &&
                !inPersonCtx.checkoutUrl &&
                token) {
                try {
                    const checkoutUrl = await (0, mercadopago_inperson_service_1.ensureInPersonCheckoutUrl)(apt.id, token);
                    if (checkoutUrl) {
                        inPersonCtx = Object.assign(Object.assign({}, inPersonCtx), { checkoutUrl });
                    }
                }
                catch (_m) {
                    /* checkout opcional */
                }
            }
            else if (apt.appointmentType === 'presencial' &&
                (inPersonCtx === null || inPersonCtx === void 0 ? void 0 : inPersonCtx.paymentOffered) &&
                inPersonCtx.paymentStatus === 'approved') {
                try {
                    await (0, mercadopago_inperson_service_1.finalizeInPersonAfterPayment)(apt.id);
                }
                catch (syncErr) {
                    logger_utils_1.securityLogger.warn('getMyAppointments: no se pudo reconciliar calendario presencial MP', {
                        appointmentId: apt.id,
                        syncErr,
                    });
                }
            }
            const refundCtx = await (0, mercadopago_refund_service_1.getRefundContextForAppointment)(apt.id);
            let meetingUrl = (_b = (_a = apt.teleconsultation) === null || _a === void 0 ? void 0 : _a.meetingUrl) !== null && _b !== void 0 ? _b : null;
            if (apt.appointmentType === 'teleconsulta' &&
                ((_c = apt.teleconsultation) === null || _c === void 0 ? void 0 : _c.consentSigned) &&
                paymentCtx.paymentRequired &&
                paymentCtx.paymentStatus === 'approved' &&
                !meetingUrl) {
                try {
                    await (0, mercadopago_teleconsultation_service_1.finalizeTeleconsultationAfterPayment)(apt.id);
                    const refreshedTc = await prisma.teleconsultation.findUnique({
                        where: { appointmentId: apt.id },
                        select: { meetingUrl: true },
                    });
                    meetingUrl = (_d = refreshedTc === null || refreshedTc === void 0 ? void 0 : refreshedTc.meetingUrl) !== null && _d !== void 0 ? _d : null;
                }
                catch (syncErr) {
                    logger_utils_1.securityLogger.warn('getMyAppointments: no se pudo reconciliar enlace teleconsulta', {
                        appointmentId: apt.id,
                        syncErr,
                    });
                }
            }
            else if (apt.appointmentType === 'teleconsulta' &&
                paymentCtx.paymentRequired &&
                paymentCtx.paymentStatus !== 'approved' &&
                (await (0, mercadopago_teleconsultation_service_1.isTeleconsultationPaymentApproved)(apt.id))) {
                paymentCtx = Object.assign(Object.assign({}, paymentCtx), { paymentStatus: 'approved', checkoutUrl: null });
            }
            return {
                id: apt.id,
                date: apt.date,
                dateLabel: (0, date_utils_1.formatAppointmentDate)(apt.date, tz),
                timeLabel: (0, date_utils_1.formatAppointmentTime)(apt.date, tz),
                status: apt.status,
                confirmationStatus: apt.confirmationStatus,
                confirmationLabel: confirmationLabels[apt.confirmationStatus] || apt.confirmationStatus,
                appointmentType: apt.appointmentType,
                notes: apt.notes,
                doctorName,
                manageLink,
                meetingUrl: !paymentCtx.paymentRequired || paymentCtx.paymentStatus === 'approved'
                    ? meetingUrl
                    : null,
                consentSigned: (_f = (_e = apt.teleconsultation) === null || _e === void 0 ? void 0 : _e.consentSigned) !== null && _f !== void 0 ? _f : false,
                paymentRequired: paymentCtx.paymentRequired,
                paymentStatus: paymentCtx.paymentStatus,
                checkoutUrl: ((_g = apt.teleconsultation) === null || _g === void 0 ? void 0 : _g.consentSigned) &&
                    paymentCtx.paymentRequired &&
                    paymentCtx.paymentStatus === 'pending'
                    ? paymentCtx.checkoutUrl
                    : null,
                inPersonPaymentOffered: (_h = inPersonCtx === null || inPersonCtx === void 0 ? void 0 : inPersonCtx.paymentOffered) !== null && _h !== void 0 ? _h : false,
                inPersonPaymentStatus: (_j = inPersonCtx === null || inPersonCtx === void 0 ? void 0 : inPersonCtx.paymentStatus) !== null && _j !== void 0 ? _j : 'not_required',
                inPersonCheckoutUrl: (_k = inPersonCtx === null || inPersonCtx === void 0 ? void 0 : inPersonCtx.checkoutUrl) !== null && _k !== void 0 ? _k : null,
                inPersonPaymentAmount: (_l = inPersonCtx === null || inPersonCtx === void 0 ? void 0 : inPersonCtx.amount) !== null && _l !== void 0 ? _l : 0,
                canRequestRefund: refundCtx.canRequestRefund,
                refundableAmount: refundCtx.refundableAmount,
                refundRequest: refundCtx.refundRequest,
                rescheduledFrom: apt.rescheduledFrom,
                rescheduledTo: apt.rescheduledTo
            };
        }));
        res.json({ success: true, data });
    }
    catch (error) {
        console.error('Error al obtener citas del paciente:', error);
        res.status(500).json({ message: 'Error al obtener citas' });
    }
};
exports.getMyAppointments = getMyAppointments;
// =================================================================
// OBTENER CONSULTAS DEL PACIENTE (VISTA DEL PACIENTE)
// =================================================================
const getMyConsultations = async (req, res) => {
    var _a, _b;
    try {
        console.log('=== getMyConsultations DEBUG ===');
        console.log('req.user:', req.user);
        console.log('req.user?.role:', (_a = req.user) === null || _a === void 0 ? void 0 : _a.role);
        console.log('req.user?.userId:', (_b = req.user) === null || _b === void 0 ? void 0 : _b.userId);
        console.log('Headers:', req.headers);
        if (!req.user) {
            console.log('ERROR: Usuario no autenticado');
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }
        if (req.user.role !== 'PATIENT') {
            console.log('ERROR: Rol incorrecto. Esperado: PATIENT, Recibido:', req.user.role);
            return res.status(403).json({ message: 'Acceso denegado. Solo para pacientes.' });
        }
        const { clinicalCaseId } = req.query;
        // Buscar el paciente
        const patient = await prisma.patient.findUnique({
            where: { userId: req.user.userId }
        });
        if (!patient) {
            return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
        }
        const visibleDoctorPatientIds = await (0, patientPortal_utils_1.getVisibleDoctorPatientIdsForPatient)(patient.id);
        if (visibleDoctorPatientIds.length === 0) {
            return res.json([]);
        }
        // Construir filtros
        const whereClause = {
            patientId: patient.id,
            doctorPatientId: { in: visibleDoctorPatientIds },
        };
        if (clinicalCaseId) {
            whereClause.clinicalCaseId = clinicalCaseId;
        }
        // Obtener todas las consultas del paciente
        const consultations = await prisma.medicalRecord.findMany({
            where: whereClause,
            include: {
                clinicalCase: {
                    select: {
                        id: true,
                        padecimiento: true
                    }
                },
                files: {
                    select: {
                        id: true,
                        fileName: true,
                        fileType: true,
                        url: true,
                        size: true,
                        category: true,
                        createdAt: true
                    }
                },
                links: {
                    select: {
                        id: true,
                        url: true,
                        description: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        // Procesar consultas según visibilidad
        const processedConsultations = consultations.map(consultation => {
            const baseConsultation = {
                id: consultation.id,
                clinicalCaseId: consultation.clinicalCaseId,
                clinicalCase: consultation.clinicalCase,
                clinicalEvolution: consultation.clinicalEvolution,
                createdAt: consultation.createdAt,
                date: consultation.date,
                reason: consultation.reason,
                tags: consultation.tags,
                formData: consultation.formData,
                files: consultation.files,
                links: consultation.links,
                isEditable: consultation.isEditable // Incluir isEditable para que el frontend sepa si la consulta está abierta
            };
            // Si la consulta es pública, mostrar todo el contenido
            if (consultation.isPublic) {
                return Object.assign(Object.assign({}, baseConsultation), { diagnosis: consultation.diagnosis, notes: consultation.notes, treatment: consultation.treatment, isContentVisible: true });
            }
            else {
                // Si es privada, mostrar que existe pero ocultar contenido
                return Object.assign(Object.assign({}, baseConsultation), { diagnosis: 'Contenido privado', notes: 'Contenido privado', treatment: 'Contenido privado', isContentVisible: false });
            }
        });
        res.json(processedConsultations);
    }
    catch (error) {
        console.error('Error al obtener consultas del paciente:', error);
        res.status(500).json({ message: 'Error al obtener consultas' });
    }
};
exports.getMyConsultations = getMyConsultations;
// Endpoint: Obtener historial fotográfico del paciente autenticado (solo para pacientes)
const getMyPhotoHistory = async (req, res) => {
    var _a;
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ message: 'Acceso denegado. Solo para pacientes.' });
        }
        const { clinicalCaseId } = req.query; // Parámetro opcional para filtrar por caso clínico
        // Buscar el paciente
        const patient = await prisma.patient.findUnique({
            where: { userId: req.user.userId }
        });
        if (!patient) {
            return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
        }
        const visibleDoctorPatientIds = await (0, patientPortal_utils_1.getVisibleDoctorPatientIdsForPatient)(patient.id);
        if (visibleDoctorPatientIds.length === 0) {
            return res.json([]);
        }
        // Construir la condición where para filtrar por caso clínico si se proporciona
        const whereClause = {
            patientId: patient.id,
            doctorPatientId: { in: visibleDoctorPatientIds },
        };
        if (clinicalCaseId) {
            whereClause.clinicalCaseId = clinicalCaseId;
        }
        const medicalRecords = await prisma.medicalRecord.findMany({
            where: whereClause,
            include: {
                files: true,
                clinicalCase: {
                    select: {
                        id: true,
                        padecimiento: true
                    }
                }
            },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        });
        const photoHistory = [];
        for (const record of medicalRecords) {
            const imageFiles = record.files.filter(f => f.fileType && f.fileType.startsWith('image/'));
            if (imageFiles.length > 0) {
                const images = [];
                for (const file of imageFiles) {
                    const url = await (0, file_utils_1.getS3SignedUrlIfExists)(file.url);
                    if (url)
                        images.push({ id: file.id, url, fileName: file.fileName, fileType: file.fileType });
                }
                if (images.length > 0) {
                    photoHistory.push({
                        medicalRecordId: record.id,
                        clinicalCaseId: record.clinicalCaseId,
                        clinicalCasePadecimiento: (_a = record.clinicalCase) === null || _a === void 0 ? void 0 : _a.padecimiento,
                        date: record.date || record.createdAt,
                        comment: record.notes || record.diagnosis || '',
                        images,
                    });
                }
            }
        }
        res.json(photoHistory);
    }
    catch (error) {
        console.error('Error al obtener historial fotográfico del paciente:', error);
        res.status(500).json({ message: "Error al obtener historial fotográfico" });
    }
};
exports.getMyPhotoHistory = getMyPhotoHistory;
// Endpoint: Obtener historial fotográfico del paciente
const getPhotoHistory = async (req, res) => {
    var _a;
    try {
        const { patientId } = req.params;
        const { clinicalCaseId } = req.query; // Nuevo parámetro opcional
        console.log('PhotoHistory: patientId recibido:', patientId);
        console.log('PhotoHistory: clinicalCaseId recibido:', clinicalCaseId);
        if (!req.user) {
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        }
        if (req.user.role === 'DOCTOR' || req.user.role === 'ASISTENTE') {
            let doctorId = null;
            if (req.user.role === 'DOCTOR') {
                const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
                if (!doctor)
                    throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
                doctorId = doctor.id;
            }
            else {
                const selectedDoctorId = req.headers['x-selected-doctor-id'];
                if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
                    throw new error_utils_1.AppError('Doctor seleccionado requerido.', 400);
                }
                const link = await prisma.asistenteDoctorVinculo.findFirst({
                    where: {
                        doctorId: selectedDoctorId,
                        asistenteId: req.user.userId,
                        activo: true
                    }
                });
                if (!link) {
                    throw new error_utils_1.AppError('Asistente no vinculado a este doctor.', 403);
                }
                doctorId = selectedDoctorId;
            }
            if (!doctorId)
                throw new error_utils_1.AppError('Doctor no encontrado.', 404);
            const doctorPatientLink = await prisma.doctorPatient.findUnique({
                where: { doctorId_patientId: { doctorId, patientId } }
            });
            if (!doctorPatientLink) {
                const collaborationCheck = await prisma.padecimientoDoctorColaborador.findMany({
                    where: {
                        doctorId,
                        patientId
                    },
                    select: {
                        padecimientoId: true
                    }
                });
                if (collaborationCheck.length === 0) {
                    throw new error_utils_1.AppError('No tienes acceso al historial fotográfico de este paciente.', 403);
                }
            }
        }
        // Construir la condición where para filtrar por caso clínico si se proporciona
        const whereClause = { patientId };
        if (clinicalCaseId) {
            whereClause.clinicalCaseId = clinicalCaseId;
        }
        const medicalRecords = await prisma.medicalRecord.findMany({
            where: whereClause,
            include: {
                files: true,
                clinicalCase: {
                    select: {
                        id: true,
                        padecimiento: true
                    }
                }
            },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        });
        console.log('PhotoHistory: registros médicos encontrados:', medicalRecords.length);
        const photoHistory = [];
        for (const record of medicalRecords) {
            const imageFiles = record.files.filter(f => f.fileType && f.fileType.startsWith('image/'));
            if (imageFiles.length > 0) {
                console.log(`PhotoHistory: registro ${record.id} tiene ${imageFiles.length} imágenes`);
                const images = [];
                for (const file of imageFiles) {
                    const url = await (0, file_utils_1.getS3SignedUrlIfExists)(file.url);
                    if (url)
                        images.push({ id: file.id, url, fileName: file.fileName, fileType: file.fileType });
                }
                if (images.length > 0) {
                    photoHistory.push({
                        medicalRecordId: record.id,
                        clinicalCaseId: record.clinicalCaseId,
                        clinicalCasePadecimiento: (_a = record.clinicalCase) === null || _a === void 0 ? void 0 : _a.padecimiento,
                        date: record.date || record.createdAt,
                        comment: record.notes || record.diagnosis || '',
                        images,
                    });
                }
            }
        }
        res.json(photoHistory);
    }
    catch (error) {
        console.error('Error al obtener historial fotográfico:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener historial fotográfico', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.getPhotoHistory = getPhotoHistory;
// Endpoint: Obtener pacientes de un doctor
const getDoctorPatients = async (req, res) => {
    var _a;
    try {
        const doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
        if (!doctorId) {
            return res.status(400).json({ message: "ID de doctor requerido" });
        }
        const patients = await prisma.patient.findMany({
            where: {
                doctors: {
                    some: {
                        doctorId: doctorId
                    }
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true
                    }
                }
            },
            orderBy: [
                { user: { firstName: 'asc' } },
                { user: { lastName: 'asc' } }
            ]
        });
        res.json(patients);
    }
    catch (error) {
        console.error('Error fetching doctor patients:', error);
        res.status(500).json({ message: "Error al obtener pacientes" });
    }
};
exports.getDoctorPatients = getDoctorPatients;
// Obtener datos completos del paciente para doctores/asistentes
const getPatientCompleteData = async (req, res) => {
    try {
        const { patientId } = req.params;
        if (!patientId) {
            return res.status(400).json({ message: 'ID de paciente requerido' });
        }
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        createdAt: true
                    }
                },
                emergencyContacts: true,
                doctors: {
                    include: {
                        doctor: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!patient) {
            return res.status(404).json({ message: 'Paciente no encontrado' });
        }
        // Formatear la respuesta con todos los datos
        const patientData = {
            id: patient.id,
            user: patient.user,
            // Datos personales
            gender: patient.gender,
            dateOfBirth: patient.dateOfBirth,
            bloodType: patient.bloodType,
            allergies: patient.allergies,
            chronicDiseases: patient.chronicDiseases,
            // Contactos de emergencia
            emergencyContacts: patient.emergencyContacts.map(contact => ({
                id: contact.id,
                name: contact.firstName,
                lastName: contact.lastName,
                phone: contact.phone,
                email: contact.email,
                relationship: contact.relationship
            })),
            // Datos fiscales
            taxName: patient.taxName,
            taxId: patient.taxId,
            taxAddress: patient.taxAddress,
            taxPostalCode: patient.taxPostalCode,
            taxRegime: patient.taxRegime,
            taxCertificateUrl: patient.taxCertificateUrl,
            // Doctores vinculados
            doctors: patient.doctors.map(dv => ({
                id: dv.doctor.id,
                name: `${dv.doctor.user.firstName} ${dv.doctor.user.lastName}`,
                email: dv.doctor.user.email,
                status: dv.status,
                context: dv.context,
                specialization: dv.specialization,
                startDate: dv.startDate
            })),
            createdAt: patient.createdAt,
            updatedAt: patient.updatedAt
        };
        res.json(patientData);
    }
    catch (error) {
        console.error('Error obteniendo datos completos del paciente:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
exports.getPatientCompleteData = getPatientCompleteData;
// Obtener pólizas de seguro de un paciente
const getPatientInsurancePolicies = async (req, res) => {
    try {
        const { patientId } = req.params;
        const insurancePolicies = await prisma.patientInsurance.findMany({
            where: {
                patientId,
                isActive: true
            },
            orderBy: {
                endDate: 'desc' // La más reciente primero
            }
        });
        res.json(insurancePolicies);
    }
    catch (error) {
        console.error('Error obteniendo pólizas de seguro:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
exports.getPatientInsurancePolicies = getPatientInsurancePolicies;
// Agregar nueva póliza de seguro
const addPatientInsurancePolicy = async (req, res) => {
    try {
        const { patientId } = req.params;
        const { insuranceCompany, policyNumber, policyHolder, startDate, endDate } = req.body;
        // Validaciones
        if (!insuranceCompany || !policyNumber || !policyHolder || !startDate || !endDate) {
            return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }
        // Verificar que el paciente existe
        const patient = await prisma.patient.findUnique({
            where: { id: patientId }
        });
        if (!patient) {
            return res.status(404).json({ message: 'Paciente no encontrado' });
        }
        // Desactivar pólizas anteriores si la nueva es más reciente
        if (new Date(endDate) > new Date()) {
            await prisma.patientInsurance.updateMany({
                where: {
                    patientId,
                    isActive: true
                },
                data: { isActive: false }
            });
        }
        // Crear nueva póliza
        const newPolicy = await prisma.patientInsurance.create({
            data: {
                patientId,
                insuranceCompany,
                policyNumber,
                policyHolder,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                isActive: true
            }
        });
        res.status(201).json(newPolicy);
    }
    catch (error) {
        console.error('Error agregando póliza de seguro:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
exports.addPatientInsurancePolicy = addPatientInsurancePolicy;
// Actualizar póliza de seguro
const updatePatientInsurancePolicy = async (req, res) => {
    try {
        const { policyId } = req.params;
        const { insuranceCompany, policyNumber, policyHolder, startDate, endDate } = req.body;
        const updatedPolicy = await prisma.patientInsurance.update({
            where: { id: policyId },
            data: {
                insuranceCompany,
                policyNumber,
                policyHolder,
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            }
        });
        res.json(updatedPolicy);
    }
    catch (error) {
        console.error('Error actualizando póliza de seguro:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
exports.updatePatientInsurancePolicy = updatePatientInsurancePolicy;
// Desactivar póliza de seguro
const deactivatePatientInsurancePolicy = async (req, res) => {
    try {
        const { policyId } = req.params;
        const deactivatedPolicy = await prisma.patientInsurance.update({
            where: { id: policyId },
            data: { isActive: false }
        });
        res.json(deactivatedPolicy);
    }
    catch (error) {
        console.error('Error desactivando póliza de seguro:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
exports.deactivatePatientInsurancePolicy = deactivatePatientInsurancePolicy;
const myRecipeInclude = {
    detalleMedicamentos: true,
    estudiosSolicitados: true,
    doctor: {
        select: {
            id: true,
            professionalTitle: true,
            user: {
                select: {
                    firstName: true,
                    lastName: true,
                },
            },
        },
    },
    consulta: {
        select: {
            id: true,
            createdAt: true,
            clinicalCase: {
                select: {
                    padecimiento: true,
                },
            },
        },
    },
};
async function getAuthenticatedPatientProfile(req) {
    if (!req.user || req.user.role !== 'PATIENT') {
        return null;
    }
    return prisma.patient.findUnique({ where: { userId: req.user.userId } });
}
// =================================================================
// RECETAS DEL PACIENTE (solo lectura, solo las propias)
// =================================================================
const getMyRecipes = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'PATIENT') {
            return res.status(403).json({ success: false, message: 'Acceso denegado. Solo para pacientes.' });
        }
        const patient = await getAuthenticatedPatientProfile(req);
        if (!patient) {
            return res.status(404).json({ success: false, message: 'Perfil de paciente no encontrado' });
        }
        const { limit = 100, offset = 0 } = req.query;
        const recetas = await prisma.recetaMedica.findMany({
            where: { pacienteId: patient.id },
            include: myRecipeInclude,
            orderBy: { fechaEmision: 'desc' },
            take: Number(limit),
            skip: Number(offset),
        });
        const total = await prisma.recetaMedica.count({
            where: { pacienteId: patient.id },
        });
        res.json({
            success: true,
            data: recetas.map((r) => {
                var _a, _b;
                return (Object.assign(Object.assign({}, r), { padecimiento: ((_b = (_a = r.consulta) === null || _a === void 0 ? void 0 : _a.clinicalCase) === null || _b === void 0 ? void 0 : _b.padecimiento) || '' }));
            }),
            pagination: { total, limit: Number(limit), offset: Number(offset) },
        });
    }
    catch (error) {
        console.error('Error al obtener recetas del paciente autenticado:', error);
        res.status(500).json({ success: false, message: 'Error al obtener recetas' });
    }
};
exports.getMyRecipes = getMyRecipes;
const getMyRecipeById = async (req, res) => {
    var _a, _b;
    try {
        if (!req.user || req.user.role !== 'PATIENT') {
            return res.status(403).json({ success: false, message: 'Acceso denegado. Solo para pacientes.' });
        }
        const patient = await getAuthenticatedPatientProfile(req);
        if (!patient) {
            return res.status(404).json({ success: false, message: 'Perfil de paciente no encontrado' });
        }
        const receta = await prisma.recetaMedica.findFirst({
            where: { id: req.params.id, pacienteId: patient.id },
            include: myRecipeInclude,
        });
        if (!receta) {
            return res.status(404).json({ success: false, message: 'Receta no encontrada' });
        }
        res.json({
            success: true,
            data: Object.assign(Object.assign({}, receta), { padecimiento: ((_b = (_a = receta.consulta) === null || _a === void 0 ? void 0 : _a.clinicalCase) === null || _b === void 0 ? void 0 : _b.padecimiento) || '' }),
        });
    }
    catch (error) {
        console.error('Error al obtener receta del paciente:', error);
        res.status(500).json({ success: false, message: 'Error al obtener receta' });
    }
};
exports.getMyRecipeById = getMyRecipeById;
const getMyRecipePdfViewUrl = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'PATIENT') {
            return res.status(403).json({ success: false, message: 'Acceso denegado. Solo para pacientes.' });
        }
        const patient = await getAuthenticatedPatientProfile(req);
        if (!patient) {
            return res.status(404).json({ success: false, message: 'Perfil de paciente no encontrado' });
        }
        const receta = await prisma.recetaMedica.findFirst({
            where: { id: req.params.id, pacienteId: patient.id },
            select: {
                id: true,
                archivoPdf: true,
                doctorId: true,
                pacienteId: true,
                fechaEmision: true,
            },
        });
        if (!receta || !receta.archivoPdf) {
            return res.status(404).json({ success: false, message: 'Receta no encontrada' });
        }
        const emissionDate = receta.fechaEmision || new Date('2025-08-11');
        const viewUrl = recipePdf_service_1.RecipePdfService.buildPdfViewUrl(receta.id, receta.doctorId, emissionDate);
        res.json({
            success: true,
            data: {
                viewUrl,
                expiresIn: 'permanente (enlace con verificación segura)',
            },
        });
    }
    catch (error) {
        logger_utils_1.securityLogger.error('Error al generar URL de receta para paciente:', error);
        res.status(500).json({ success: false, message: 'Error al abrir la receta' });
    }
};
exports.getMyRecipePdfViewUrl = getMyRecipePdfViewUrl;
