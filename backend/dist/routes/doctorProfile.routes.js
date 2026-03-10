"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const doctorProfile_controller_1 = require("../controllers/doctorProfile.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const subscription_middleware_1 = require("../middlewares/subscription.middleware");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
// Multer memory storage para subir logos a S3 (disco local es efímero en ECS)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Tipo de archivo no permitido. Solo se permiten JPG, PNG y GIF'));
        }
    }
});
/**
 * @route GET /api/doctor-profile/config
 * @desc Obtener configuración del perfil del doctor
 * @access Private (Doctor/Asistente con permisos de recetas)
 */
router.get('/config', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('prescriptions'), (0, subscription_middleware_1.subscriptionAccess)('read'), doctorProfile_controller_1.DoctorProfileController.getProfileConfig);
/**
 * @route PUT /api/doctor-profile/config
 * @desc Actualizar configuración del perfil del doctor
 * @access Private (Doctor/Asistente con permisos de recetas)
 */
router.put('/config', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('prescriptions'), (0, subscription_middleware_1.subscriptionAccess)('edit'), doctorProfile_controller_1.DoctorProfileController.updateProfileConfig);
/**
 * @route POST /api/doctor-profile/logo
 * @desc Subir logo del consultorio
 * @access Private (Doctor/Asistente con permisos de recetas)
 */
router.post('/logo', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('prescriptions'), (0, subscription_middleware_1.subscriptionAccess)('edit'), upload.single('logo'), doctorProfile_controller_1.DoctorProfileController.uploadLogo);
/**
 * @route DELETE /api/doctor-profile/logo
 * @desc Eliminar logo del consultorio
 * @access Private (Doctor/Asistente con permisos de recetas)
 */
router.delete('/logo', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('prescriptions'), (0, subscription_middleware_1.subscriptionAccess)('edit'), doctorProfile_controller_1.DoctorProfileController.deleteLogo);
/**
 * @route GET /api/doctor-profile/recipe-preview
 * @desc Obtener vista previa del template de receta
 * @access Private (Doctor/Asistente con permisos de recetas)
 */
router.get('/recipe-preview', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('prescriptions'), (0, subscription_middleware_1.subscriptionAccess)('read'), doctorProfile_controller_1.DoctorProfileController.getRecipePreview);
exports.default = router;
