import { Response, Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { pipeline } from 'stream/promises';
import { AppError } from '../utils/error.utils';
import { AuthRequest } from '../middlewares/auth.middleware';
import { uploadToS3, extractS3KeyFromUrl, getS3Stream } from '../utils/file.utils';

const prisma = new PrismaClient();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const withStreamUrl = (video: any) => {
  const streamUrl = `${BASE_URL}/api/tutorial-videos/${video.id}/stream`;
  return { ...video, videoUrl: streamUrl, streamUrl };
};

const withStreamUrls = (videos: any[]) => videos.map(withStreamUrl);

// Secciones válidas de la plataforma
export const VALID_SECTIONS = [
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
export const getAllTutorialVideos = async (req: AuthRequest, res: Response) => {
  try {
    const { section } = req.query;

    const where: any = {
      isActive: true,
    };

    if (section && typeof section === 'string' && VALID_SECTIONS.includes(section)) {
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
  } catch (error: any) {
    console.error('Error obteniendo videos tutoriales:', error);
    res.status(500).json({ message: 'Error al obtener los videos tutoriales.' });
  }
};

// Secciones públicas (visibles sin login)
const PUBLIC_SECTIONS = ['general', 'sales'];

// Stream de video (evita CORS de S3): general/sales sin auth, resto con auth
export const streamVideo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const video = await prisma.tutorialVideo.findUnique({
      where: { id, isActive: true },
    });
    if (!video) {
      return res.status(404).json({ message: 'Video no encontrado' });
    }
    const isPublic = PUBLIC_SECTIONS.includes(video.section);
    const authReq = req as AuthRequest;
    if (!isPublic && !authReq.user) {
      return res.status(401).json({ message: 'Debes iniciar sesión para ver este video' });
    }
    const key = extractS3KeyFromUrl(video.videoUrl);
    const rangeHeader = req.headers.range;
    const { stream, contentLength, contentType, contentRange, isPartial } = await getS3Stream(key, rangeHeader);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    if (isPartial && contentRange) {
      res.status(206);
      res.setHeader('Content-Length', contentLength);
      res.setHeader('Content-Range', contentRange);
    } else {
      res.setHeader('Content-Length', contentLength);
    }
    await pipeline(stream, res);
  } catch (error: any) {
    console.error('Error streaming video:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error al reproducir el video' });
    }
  }
};

// Obtener videos públicos (general + ventas, sin autenticación)
export const getPublicSalesVideos = async (_req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('Error obteniendo videos de venta:', error);
    res.status(500).json({ message: 'Error al obtener los videos de venta.' });
  }
};

// Obtener videos por sección
export const getVideosBySection = async (req: AuthRequest, res: Response) => {
  try {
    const { section } = req.params;

    if (!VALID_SECTIONS.includes(section)) {
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
  } catch (error: any) {
    console.error('Error obteniendo videos por sección:', error);
    res.status(500).json({ message: 'Error al obtener los videos.' });
  }
};

// Subir un nuevo video tutorial (solo admin)
export const uploadTutorialVideo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Autenticación requerida.', 401);
    }

    // Verificar que sea admin exclusivamente
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      throw new AppError('Solo los administradores de la plataforma pueden subir videos tutoriales.', 403);
    }

    const file = req.file;
    if (!file) {
      throw new AppError('No se ha subido ningún video.', 400);
    }

    const { title, description, section, order } = req.body;

    if (!title || !section) {
      throw new AppError('Título y sección son requeridos.', 400);
    }

    if (!VALID_SECTIONS.includes(section)) {
      throw new AppError(`Sección inválida. Secciones válidas: ${VALID_SECTIONS.join(', ')}`, 400);
    }

    // Subir video a S3
    const { url, key } = await uploadToS3(file, 'tutorials', req.user.userId);

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
  } catch (error: any) {
    console.error('Error subiendo video tutorial:', error);
    
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error al subir el video.' });
  }
};

// Actualizar un video tutorial (solo admin)
export const updateTutorialVideo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Autenticación requerida.', 401);
    }

    const { id } = req.params;
    const { title, description, section, order, isActive } = req.body;

    // Verificar que sea admin exclusivamente
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      throw new AppError('Solo los administradores de la plataforma pueden actualizar videos tutoriales.', 403);
    }

    const updateData: any = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (section) {
      if (!VALID_SECTIONS.includes(section)) {
        throw new AppError(`Sección inválida. Secciones válidas: ${VALID_SECTIONS.join(', ')}`, 400);
      }
      updateData.section = section;
    }
    if (order !== undefined) updateData.order = parseInt(order);
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;

    const video = await prisma.tutorialVideo.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: 'Video actualizado exitosamente.',
      video,
    });
  } catch (error: any) {
    console.error('Error actualizando video tutorial:', error);
    
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error al actualizar el video.' });
  }
};

// Eliminar un video tutorial (solo admin)
export const deleteTutorialVideo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Autenticación requerida.', 401);
    }

    const { id } = req.params;

    // Verificar que sea admin exclusivamente
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      throw new AppError('Solo los administradores de la plataforma pueden eliminar videos tutoriales.', 403);
    }

    const video = await prisma.tutorialVideo.findUnique({
      where: { id },
    });

    if (!video) {
      throw new AppError('Video no encontrado.', 404);
    }

    // Eliminar de S3 (opcional, puedes implementarlo si lo necesitas)
    // await deleteFromS3(video.videoUrl);

    // Eliminar de la base de datos
    await prisma.tutorialVideo.delete({
      where: { id },
    });

    res.json({ message: 'Video eliminado exitosamente.' });
  } catch (error: any) {
    console.error('Error eliminando video tutorial:', error);
    
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error al eliminar el video.' });
  }
};

