"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStudyDocument = exports.getStudyDocuments = exports.createStudyDocument = void 0;
const client_1 = require("@prisma/client");
const file_utils_1 = require("../utils/file.utils");
const error_utils_1 = require("../utils/error.utils");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const env_1 = require("../config/env");
const prisma = new client_1.PrismaClient();
const resolveDoctorIdForStudy = async (req) => {
    if (!req.user) {
        throw new error_utils_1.AppError('Usuario no autenticado', 401);
    }
    if (req.user.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.userId },
            select: { id: true }
        });
        if (!doctor) {
            throw new error_utils_1.AppError('Usuario no encontrado en tabla Doctor', 404);
        }
        return doctor.id;
    }
    if (req.user.role === 'ASISTENTE') {
        const selectedDoctorId = req.headers['x-selected-doctor-id'];
        if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
            throw new error_utils_1.AppError('Doctor seleccionado requerido', 400);
        }
        const link = await prisma.asistenteDoctorVinculo.findFirst({
            where: {
                doctorId: selectedDoctorId,
                asistenteId: req.user.userId,
                activo: true
            },
            select: { permisosEstudios: true }
        });
        if (!link) {
            throw new error_utils_1.AppError('Asistente no vinculado a este doctor', 403);
        }
        if (!link.permisosEstudios) {
            throw new error_utils_1.AppError('No tienes permisos para Zona de Estudio', 403);
        }
        return selectedDoctorId;
    }
    throw new error_utils_1.AppError('Acceso denegado', 403);
};
// Función de fallback para almacenamiento local
const uploadToLocal = async (file, category, userId) => {
    const uploadsDir = path_1.default.join(__dirname, '../../uploads');
    const categoryDir = path_1.default.join(uploadsDir, category);
    // Crear directorios si no existen
    if (!fs_1.default.existsSync(uploadsDir)) {
        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    }
    if (!fs_1.default.existsSync(categoryDir)) {
        fs_1.default.mkdirSync(categoryDir, { recursive: true });
    }
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path_1.default.join(categoryDir, fileName);
    // Guardar archivo localmente
    fs_1.default.writeFileSync(filePath, file.buffer);
    // URL relativa para acceso local
    const url = `/uploads/${category}/${fileName}`;
    return { url, key: `${category}/${fileName}` };
};
const createStudyDocument = async (req, res) => {
    try {
        console.log('=== INICIO createStudyDocument ===');
        console.log('Body recibido:', req.body);
        console.log('File recibido:', req.file);
        console.log('User:', req.user);
        if (req.user) {
            console.log('User ID:', req.user.userId);
            console.log('User Role:', req.user.role);
        }
        const { title, summary, type, youtubeUrl, externalUrl, isPublic, notes } = req.body;
        const doctorId = await resolveDoctorIdForStudy(req);
        console.log('DoctorId:', doctorId);
        // Validar título y resumen
        if (title.length > 50) {
            console.log('ERROR: Título muy largo');
            return res.status(400).json({ message: 'El título no puede tener más de 50 caracteres' });
        }
        if (summary.length > 200) {
            console.log('ERROR: Resumen muy largo');
            return res.status(400).json({ message: 'El resumen no puede tener más de 200 caracteres' });
        }
        let url = '';
        if (type === 'file') {
            console.log('Procesando archivo...');
            if (!req.file) {
                console.log('ERROR: No se recibió archivo');
                return res.status(400).json({ message: 'Se requiere un archivo' });
            }
            // Enforce per-user total files limit in Zona de Estudio
            const currentCount = await prisma.studyDocument.count({ where: { doctorId, type: 'file' } });
            const maxAllowed = env_1.env.STUDY_MAX_FILES_PER_USER;
            if (currentCount >= maxAllowed) {
                return res.status(400).json({ message: `Límite alcanzado: puedes tener máximo ${maxAllowed} materiales de estudio.` });
            }
            try {
                // Intentar subir a S3 primero
                console.log('Intentando subir a S3...');
                const { url: s3Url, key } = await (0, file_utils_1.uploadToS3)(req.file, 'study-documents', doctorId);
                url = s3Url;
                console.log('Archivo subido a S3:', url);
            }
            catch (s3Error) {
                console.log('Error al subir a S3, usando almacenamiento local:', s3Error);
                // Fallback a almacenamiento local
                const { url: localUrl, key } = await uploadToLocal(req.file, 'study-documents', doctorId);
                url = localUrl;
                console.log('Archivo subido localmente:', url);
            }
        }
        else if (type === 'youtube') {
            console.log('Procesando URL de YouTube...');
            if (!youtubeUrl) {
                console.log('ERROR: No se proporcionó URL de YouTube');
                return res.status(400).json({ message: 'Se requiere una URL de YouTube' });
            }
            if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
                console.log('ERROR: URL de YouTube inválida');
                return res.status(400).json({ message: 'URL de YouTube no válida' });
            }
            url = youtubeUrl;
            console.log('URL de YouTube válida:', url);
        }
        else if (type === 'link') {
            console.log('Procesando enlace externo...');
            if (!externalUrl) {
                console.log('ERROR: No se proporcionó URL externa');
                return res.status(400).json({ message: 'Se requiere una URL externa' });
            }
            if (!externalUrl.startsWith('http://') && !externalUrl.startsWith('https://')) {
                console.log('ERROR: URL externa inválida');
                return res.status(400).json({ message: 'URL externa no válida' });
            }
            url = externalUrl;
            console.log('URL externa válida:', url);
        }
        else {
            console.log('ERROR: Tipo de documento inválido:', type);
            return res.status(400).json({ message: 'Tipo de documento no válido' });
        }
        console.log('Creando documento en la base de datos...');
        // Los documentos de estudio pueden ser privados (solo para el doctor) o públicos (para todos sus pacientes)
        const documentData = {
            title,
            summary,
            type,
            url,
            doctorId
        };
        // Agregar isPublic si está disponible
        if (typeof isPublic !== 'undefined') {
            documentData.isPublic = isPublic === 'true' || isPublic === true;
        }
        // Agregar notas si están disponibles
        if (notes) {
            documentData.notes = notes;
        }
        const document = await prisma.studyDocument.create({
            data: documentData
        });
        // Si es archivo S3, genera signedUrl para la respuesta inmediata
        let signedUrl = undefined;
        if (document.type === 'file' && document.url.includes('amazonaws.com')) {
            try {
                signedUrl = await (0, file_utils_1.getS3SignedUrl)(document.url);
            }
            catch (e) {
                // Si falla, no lo incluimos
            }
        }
        console.log('Documento creado exitosamente:', document);
        console.log('=== FIN createStudyDocument ===');
        res.status(201).json(Object.assign(Object.assign({}, document), { doctorId: document.doctorId, signedUrl }));
    }
    catch (error) {
        console.error('Error al crear documento de estudio:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al crear documento de estudio', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.createStudyDocument = createStudyDocument;
const getStudyDocuments = async (req, res) => {
    try {
        const { search } = req.query;
        if (!req.user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }
        let whereClause = {};
        let documents = [];
        if (req.user.role === 'DOCTOR') {
            const doctorId = await resolveDoctorIdForStudy(req);
            whereClause.doctorId = doctorId;
        }
        else if (req.user.role === 'PATIENT') {
            // Para pacientes: mostrar documentos públicos de sus doctores
            const patient = await prisma.patient.findUnique({
                where: { userId: req.user.userId },
                include: {
                    doctors: {
                        include: {
                            doctor: true
                        }
                    }
                }
            });
            if (!patient) {
                return res.status(404).json({ message: 'Usuario no encontrado en tabla Patient' });
            }
            // Obtener IDs de doctores directamente de la relación DoctorPatient
            const doctorIds = patient.doctors.map(dp => dp.doctorId);
            if (doctorIds.length === 0) {
                console.log('No hay doctores asociados al paciente');
                return res.json([]); // No hay doctores asociados
            }
            console.log('Doctores asociados al paciente:', doctorIds);
            whereClause = {
                doctorId: { in: doctorIds },
                isPublic: true // Solo documentos públicos
            };
        }
        else if (req.user.role === 'ASISTENTE') {
            const doctorId = await resolveDoctorIdForStudy(req);
            whereClause.doctorId = doctorId;
        }
        if (search) {
            whereClause.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { summary: { contains: search, mode: 'insensitive' } }
            ];
        }
        documents = await prisma.studyDocument.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });
        console.log('Documentos encontrados:', documents.length);
        // Generar URLs firmadas para archivos y asegurar que doctorId siempre esté presente
        const documentsWithSignedUrls = await Promise.all(documents.map(async (doc) => {
            const result = Object.assign(Object.assign({}, doc), { doctorId: doc.doctorId });
            if (doc.type === 'file' && doc.url.includes('amazonaws.com')) {
                try {
                    const signedUrl = await (0, file_utils_1.getS3SignedUrl)(doc.url);
                    result.signedUrl = signedUrl;
                }
                catch (error) {
                    // Si falla la URL firmada, solo regresa el doc
                }
            }
            return result;
        }));
        console.log('Documentos con URLs firmadas:', documentsWithSignedUrls.length);
        res.json(documentsWithSignedUrls);
    }
    catch (error) {
        console.error('Error al obtener documentos de estudio:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener documentos de estudio', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.getStudyDocuments = getStudyDocuments;
const deleteStudyDocument = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }
        const doctorId = await resolveDoctorIdForStudy(req);
        const document = await prisma.studyDocument.findUnique({
            where: { id }
        });
        if (!document) {
            return res.status(404).json({ message: 'Documento no encontrado' });
        }
        // Permitir solo al doctor dueño o asistente autorizado
        const isOwner = document.doctorId === doctorId;
        if (!isOwner) {
            return res.status(403).json({ message: 'No tienes permiso para eliminar este documento' });
        }
        // Si es un archivo, eliminar de S3
        if (document.type === 'file') {
            await (0, file_utils_1.deleteFromS3)(document.url);
        }
        await prisma.studyDocument.delete({
            where: { id }
        });
        res.json({ message: 'Documento eliminado exitosamente' });
    }
    catch (error) {
        console.error('Error al eliminar documento de estudio:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al eliminar documento de estudio', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.deleteStudyDocument = deleteStudyDocument;
