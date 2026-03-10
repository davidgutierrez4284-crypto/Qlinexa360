import { Router } from 'express';
import {
  getAllTutorialVideos,
  getVideosBySection,
  getPublicSalesVideos,
  streamVideo,
  uploadTutorialVideo,
  updateTutorialVideo,
  deleteTutorialVideo,
} from '../controllers/tutorialVideo.controller';
import { authMiddleware, optionalAuthenticate } from '../middlewares/auth.middleware';
import { videoUpload, handleVideoUploadError } from '../middlewares/videoUpload.middleware';

const router = Router();

// Ruta pública (sin autenticación): videos de venta y general
router.get('/public', getPublicSalesVideos);

// Stream de video: general/sales sin auth; otras secciones requieren login
router.get('/:id/stream', optionalAuthenticate, streamVideo);

// Rutas para usuarios autenticados (tutoriales internos)
router.get('/', authMiddleware(['DOCTOR', 'ASISTENTE', 'PATIENT', 'ADMIN']), getAllTutorialVideos);
router.get('/section/:section', authMiddleware(['DOCTOR', 'ASISTENTE', 'PATIENT', 'ADMIN']), getVideosBySection);

// Rutas de administración (solo ADMIN)
router.post(
  '/upload',
  authMiddleware(['ADMIN']),
  videoUpload.single('video'),
  handleVideoUploadError,
  uploadTutorialVideo
);

router.put('/:id', authMiddleware(['ADMIN']), updateTutorialVideo);
router.delete('/:id', authMiddleware(['ADMIN']), deleteTutorialVideo);

export default router;

