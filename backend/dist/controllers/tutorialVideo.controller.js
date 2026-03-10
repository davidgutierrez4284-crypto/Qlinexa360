"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTutorialVideo = exports.updateTutorialVideo = exports.uploadTutorialVideo = exports.getVideosBySection = exports.getPublicSalesVideos = exports.streamVideo = exports.getAllTutorialVideos = exports.VALID_SECTIONS = void 0;
const client_1 = require("@prisma/client");
const promises_1 = require("stream/promises");
const error_utils_1 = require("../utils/error.utils");
const file_utils_1 = require("../utils/file.utils");
const prisma = new client_1.PrismaClient();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const withStreamUrl = (video) => {
    const streamUrl = `${BASE_URL}/api/tutorial-videos/${video.id}/stream`;
    return Object.assign(Object.assign({}, video), { videoUrl: streamUrl, streamUrl });
};
const withStreamUrls = (videos) => videos.map(withStreamUrl);
// Secciones válidas de la plataforma
exports.VALID_SECTIONS = [
    'dashboard',
    'patients',
    'calendar',
    'medical-records',
    'prescriptions',
    'documents',
    'billing',
    'profile',
    'help',
    'general',
    'sales'
];
// Obtener todos los videos tutoriales (públicos)
const getAllTutorialVideos = async (req, res) => {
    try {
        const { section } = req.query;
        const where = {
            isActive: true,
        };
        if (section && typeof section === 'string' && exports.VALID_SECTIONS.includes(section)) {
            where.section = section;
        }
        const videos = await prisma.tutorialVideo.findMany({
            where,
            orderBy: [
                { section: 'asc' },
                { order: 'asc' },
                { createdAt: 'desc' },
            ],
        });
        const videosWithStream = withStreamUrls(videos);
        res.json(videosWithStream);
    }
    catch (error) {
        console.error('Error obteniendo videos tutoriales:', error);
        res.status(500).json({ message: 'Error al obtener los videos tutoriales.' });
    }
};
exports.getAllTutorialVideos = getAllTutorialVideos;
// Secciones públicas (visibles sin login)
const PUBLIC_SECTIONS = ['general', 'sales'];
// Stream de video (evita CORS de S3): general/sales sin auth, resto con auth
const streamVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const video = await prisma.tutorialVideo.findUnique({
            where: { id, isActive: true },
        });
        if (!video) {
            return res.status(404).json({ message: 'Video no encontrado' });
        }
        const isPublic = PUBLIC_SECTIONS.includes(video.section);
        const authReq = req;
        if (!isPublic && !authReq.user) {
            return res.status(401).json({ message: 'Debes iniciar sesión para ver este video' });
        }
        const key = (0, file_utils_1.extractS3KeyFromUrl)(video.videoUrl);
        const rangeHeader = req.headers.range;
        const { stream, contentLength, contentType, contentRange, isPartial } = await (0, file_utils_1.getS3Stream)(key, rangeHeader);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', 'bytes');
        if (isPartial && contentRange) {
            res.status(206);
            res.setHeader('Content-Length', contentLength);
            res.setHeader('Content-Range', contentRange);
        }
        else {
            res.setHeader('Content-Length', contentLength);
        }
        await (0, promises_1.pipeline)(stream, res);
    }
    catch (error) {
        console.error('Error streaming video:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error al reproducir el video' });
        }
    }
};
exports.streamVideo = streamVideo;
// Obtener videos públicos (general + ventas, sin autenticación)
const getPublicSalesVideos = async (_req, res) => {
    try {
        const videos = await prisma.tutorialVideo.findMany({
            where: {
                section: { in: ['sales', 'general'] },
                isActive: true,
            },
            orderBy: [
                { order: 'asc' },
                { createdAt: 'desc' },
            ],
        });
        const videosWithStream = withStreamUrls(videos);
        res.json(videosWithStream);
    }
    catch (error) {
        console.error('Error obteniendo videos de venta:', error);
        res.status(500).json({ message: 'Error al obtener los videos de venta.' });
    }
};
exports.getPublicSalesVideos = getPublicSalesVideos;
// Obtener videos por sección
const getVideosBySection = async (req, res) => {
    try {
        const { section } = req.params;
        if (!exports.VALID_SECTIONS.includes(section)) {
            return res.status(400).json({ message: 'Sección inválida.' });
        }
        const videos = await prisma.tutorialVideo.findMany({
            where: {
                section,
                isActive: true,
            },
            orderBy: [
                { order: 'asc' },
                { createdAt: 'desc' },
            ],
        });
        const videosWithStream = withStreamUrls(videos);
        res.json(videosWithStream);
    }
    catch (error) {
        console.error('Error obteniendo videos por sección:', error);
        res.status(500).json({ message: 'Error al obtener los videos.' });
    }
};
exports.getVideosBySection = getVideosBySection;
// Subir un nuevo video tutorial (solo admin)
const uploadTutorialVideo = async (req, res) => {
    try {
        if (!req.user) {
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        }
        // Verificar que sea admin exclusivamente
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { role: true },
        });
        if ((user === null || user === void 0 ? void 0 : user.role) !== 'ADMIN') {
            throw new error_utils_1.AppError('Solo los administradores de la plataforma pueden subir videos tutoriales.', 403);
        }
        const file = req.file;
        if (!file) {
            throw new error_utils_1.AppError('No se ha subido ningún video.', 400);
        }
        const { title, description, section, order } = req.body;
        if (!title || !section) {
            throw new error_utils_1.AppError('Título y sección son requeridos.', 400);
        }
        if (!exports.VALID_SECTIONS.includes(section)) {
            throw new error_utils_1.AppError(`Sección inválida. Secciones válidas: ${exports.VALID_SECTIONS.join(', ')}`, 400);
        }
        // Subir video a S3
        const { url, key } = await (0, file_utils_1.uploadToS3)(file, 'tutorials', req.user.userId);
        // Crear registro en la base de datos
        const video = await prisma.tutorialVideo.create({
            data: {
                title,
                description: description || null,
                section,
                videoUrl: url,
                order: order ? parseInt(order) : 0,
                uploadedBy: req.user.userId,
                isActive: true,
            },
        });
        res.status(201).json({
            message: 'Video subido exitosamente.',
            video,
        });
    }
    catch (error) {
        console.error('Error subiendo video tutorial:', error);
        if (error instanceof error_utils_1.AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error al subir el video.' });
    }
};
exports.uploadTutorialVideo = uploadTutorialVideo;
// Actualizar un video tutorial (solo admin)
const updateTutorialVideo = async (req, res) => {
    try {
        if (!req.user) {
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        }
        const { id } = req.params;
        const { title, description, section, order, isActive } = req.body;
        // Verificar que sea admin exclusivamente
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { role: true },
        });
        if ((user === null || user === void 0 ? void 0 : user.role) !== 'ADMIN') {
            throw new error_utils_1.AppError('Solo los administradores de la plataforma pueden actualizar videos tutoriales.', 403);
        }
        const updateData = {};
        if (title)
            updateData.title = title;
        if (description !== undefined)
            updateData.description = description;
        if (section) {
            if (!exports.VALID_SECTIONS.includes(section)) {
                throw new error_utils_1.AppError(`Sección inválida. Secciones válidas: ${exports.VALID_SECTIONS.join(', ')}`, 400);
            }
            updateData.section = section;
        }
        if (order !== undefined)
            updateData.order = parseInt(order);
        if (isActive !== undefined)
            updateData.isActive = isActive === 'true' || isActive === true;
        const video = await prisma.tutorialVideo.update({
            where: { id },
            data: updateData,
        });
        res.json({
            message: 'Video actualizado exitosamente.',
            video,
        });
    }
    catch (error) {
        console.error('Error actualizando video tutorial:', error);
        if (error instanceof error_utils_1.AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error al actualizar el video.' });
    }
};
exports.updateTutorialVideo = updateTutorialVideo;
// Eliminar un video tutorial (solo admin)
const deleteTutorialVideo = async (req, res) => {
    try {
        if (!req.user) {
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        }
        const { id } = req.params;
        // Verificar que sea admin exclusivamente
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { role: true },
        });
        if ((user === null || user === void 0 ? void 0 : user.role) !== 'ADMIN') {
            throw new error_utils_1.AppError('Solo los administradores de la plataforma pueden eliminar videos tutoriales.', 403);
        }
        const video = await prisma.tutorialVideo.findUnique({
            where: { id },
        });
        if (!video) {
            throw new error_utils_1.AppError('Video no encontrado.', 404);
        }
        // Eliminar de S3 (opcional, puedes implementarlo si lo necesitas)
        // await deleteFromS3(video.videoUrl);
        // Eliminar de la base de datos
        await prisma.tutorialVideo.delete({
            where: { id },
        });
        res.json({ message: 'Video eliminado exitosamente.' });
    }
    catch (error) {
        console.error('Error eliminando video tutorial:', error);
        if (error instanceof error_utils_1.AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error al eliminar el video.' });
    }
};
exports.deleteTutorialVideo = deleteTutorialVideo;
