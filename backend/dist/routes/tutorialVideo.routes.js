"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tutorialVideo_controller_1 = require("../controllers/tutorialVideo.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const videoUpload_middleware_1 = require("../middlewares/videoUpload.middleware");
const router = (0, express_1.Router)();
// Ruta pública (sin autenticación): videos de venta y general
router.get('/public', tutorialVideo_controller_1.getPublicSalesVideos);
// Stream de video: general/sales sin auth; otras secciones requieren login
router.get('/:id/stream', auth_middleware_1.optionalAuthenticate, tutorialVideo_controller_1.streamVideo);
// Rutas para usuarios autenticados (tutoriales internos)
router.get('/', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE', 'PATIENT', 'ADMIN']), tutorialVideo_controller_1.getAllTutorialVideos);
router.get('/section/:section', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE', 'PATIENT', 'ADMIN']), tutorialVideo_controller_1.getVideosBySection);
// Rutas de administración (solo ADMIN)
router.post('/upload', (0, auth_middleware_1.authMiddleware)(['ADMIN']), videoUpload_middleware_1.videoUpload.single('video'), videoUpload_middleware_1.handleVideoUploadError, tutorialVideo_controller_1.uploadTutorialVideo);
router.put('/:id', (0, auth_middleware_1.authMiddleware)(['ADMIN']), tutorialVideo_controller_1.updateTutorialVideo);
router.delete('/:id', (0, auth_middleware_1.authMiddleware)(['ADMIN']), tutorialVideo_controller_1.deleteTutorialVideo);
exports.default = router;
