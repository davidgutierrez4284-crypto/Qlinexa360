import { Router } from 'express';
import { DoctorProfileController } from '../controllers/doctorProfile.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';
import { subscriptionAccess } from '../middlewares/subscription.middleware';
import multer from 'multer';

const router = Router();

// Multer memory storage para subir logos a S3 (disco local es efímero en ECS)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se permiten JPG, PNG y GIF'));
    }
  }
});

/**
 * @route GET /api/doctor-profile/config
 * @desc Obtener configuración del perfil del doctor
 * @access Private (Doctor/Asistente con permisos de recetas)
 */
router.get(
  '/config',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('prescriptions'),
  subscriptionAccess('read'),
  DoctorProfileController.getProfileConfig
);

/**
 * @route PUT /api/doctor-profile/config
 * @desc Actualizar configuración del perfil del doctor
 * @access Private (Doctor/Asistente con permisos de recetas)
 */
router.put(
  '/config',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('prescriptions'),
  subscriptionAccess('edit'),
  DoctorProfileController.updateProfileConfig
);

/**
 * @route POST /api/doctor-profile/logo
 * @desc Subir logo del consultorio
 * @access Private (Doctor/Asistente con permisos de recetas)
 */
router.post(
  '/logo',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('prescriptions'),
  subscriptionAccess('edit'),
  upload.single('logo'),
  DoctorProfileController.uploadLogo
);

/**
 * @route DELETE /api/doctor-profile/logo
 * @desc Eliminar logo del consultorio
 * @access Private (Doctor/Asistente con permisos de recetas)
 */
router.delete(
  '/logo',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('prescriptions'),
  subscriptionAccess('edit'),
  DoctorProfileController.deleteLogo
);

/**
 * @route GET /api/doctor-profile/recipe-preview
 * @desc Obtener vista previa del template de receta
 * @access Private (Doctor/Asistente con permisos de recetas)
 */
router.get(
  '/recipe-preview',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('prescriptions'),
  subscriptionAccess('read'),
  DoctorProfileController.getRecipePreview
);

export default router;
