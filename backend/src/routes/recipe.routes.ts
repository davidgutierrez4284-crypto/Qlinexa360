import { Router } from 'express';
import { RecipeController } from '../controllers/recipe.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';
import { subscriptionAccess } from '../middlewares/subscription.middleware';

const router = Router();

// ===== ENDPOINT DE PRUEBA =====
router.get('/test', (req, res) => {
  console.log('Test endpoint called at:', new Date().toISOString());
  console.log('Request headers:', req.headers);
  console.log('Authorization header:', req.headers.authorization);
  
  res.json({ 
    message: 'Recipe routes working', 
    timestamp: new Date().toISOString(),
    status: 'success',
    headers: {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      contentType: req.headers['content-type']
    }
  });
});

// ===== TEMPLATES DE RECETAS =====

/**
 * @route POST /api/recipes/templates/:doctorId
 * @desc Subir template de receta personalizado del doctor
 * @access Private (Doctor)
 */
router.post(
  '/templates/:doctorId',
  authMiddleware,
  subscriptionAccess('edit'),
  RecipeController.uploadRecipeTemplate
);

/**
 * @route GET /api/recipes/templates/:doctorId
 * @desc Obtener templates de recetas de un doctor
 * @access Private (Doctor)
 */
router.get(
  '/templates/:doctorId',
  authMiddleware,
  subscriptionAccess('read'),
  RecipeController.getRecipeTemplates
);

/**
 * Ruta de verificación pública (sin autenticación).
 * Usado por personas externas que escanean el QR: farmacia, familiares, etc.
 * No requieren ser usuarios de Qlinexa360. Solo lectura.
 */
router.get('/verify/:id', RecipeController.verifyRecipe);

// Rutas protegidas
router.post('/', authMiddleware(['DOCTOR']), RecipeController.createRecipe);

/**
 * @route GET /api/recipes/patient/:pacienteId
 * @desc Obtener recetas de un paciente
 * @access Private (Doctor/Asistente)
 */
router.get(
  '/patient/:pacienteId',
  authMiddleware,
  subscriptionAccess('read'),
  RecipeController.getPatientRecipes
);

/**
 * @route GET /api/recipes/doctor/:doctorId
 * @desc Obtener recetas de un doctor
 * @access Private (Doctor)
 */
router.get(
  '/doctor/:doctorId',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('prescriptions'),
  // subscriptionAccess('read'), // Temporalmente removido para debugging
  RecipeController.getDoctorRecipes
);

/**
 * @route GET /api/recipes/my-recipes
 * @desc Obtener recetas del doctor autenticado (sus propias recetas)
 * @access Private (Doctor/Asistente)
 */
router.get(
  '/my-recipes',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('prescriptions'),
  RecipeController.getMyRecipes
);

/**
 * @route GET /api/recipes/:id
 * @desc Obtener receta específica
 * @access Private (Doctor/Asistente)
 */
router.get(
  '/:id',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('prescriptions'),
  // subscriptionAccess('read'), // Temporalmente removido para debugging
  RecipeController.getRecipeById
);

// Endpoint para generar URL segura de visualización
router.get(
  '/:id/pdf-view-url',
  authMiddleware(['DOCTOR', 'ASISTENTE', 'PATIENT']),
  AssistantMiddleware.checkAssistantModulePermission('prescriptions'),
  // subscriptionAccess('read'), // Temporalmente removido para debugging
  RecipeController.getRecipePdfViewUrl
);

/**
 * Servir PDF de receta para visualización pública.
 * Sin autenticación: usa hash+timestamp en la URL como token temporal.
 * Accesible por farmacias, familiares y cualquier persona que escanee el QR.
 */
router.get(
  '/:id/pdf-view',
  RecipeController.serveRecipePdf
);

router.get(
  '/:id/pdf',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('prescriptions'),
  // subscriptionAccess('read'), // Temporalmente removido para debugging
  RecipeController.downloadRecipePdf
);

/**
 * @route PUT /api/recipes/:id
 * @desc Actualizar receta médica
 * @access Private (Doctor/Asistente)
 */
router.put(
  '/:id',
  authMiddleware(['DOCTOR']),
  subscriptionAccess('edit'),
  RecipeController.updateRecipe
);

/**
 * @route DELETE /api/recipes/:id
 * @desc Eliminar receta médica
 * @access Private (Doctor)
 */
router.delete(
  '/:id',
  authMiddleware(['DOCTOR']),
  // subscriptionAccess('edit'), // Temporalmente removido para debugging
  RecipeController.deleteRecipe
);

// Enviar receta por email al paciente
router.post(
  '/:id/email-to-patient',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('prescriptions'),
  RecipeController.emailRecipeToPatient
);

/**
 * @route GET /api/recipes/stats/:doctorId
 * @desc Obtener estadísticas de recetas para un doctor
 * @access Private (Doctor)
 */
router.get(
  '/stats/:doctorId',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  // subscriptionAccess('read'), // Temporalmente removido para debugging
  RecipeController.getRecipeStats
);

/**
 * @route GET /api/recipes/patients/search
 * @desc Buscar pacientes para el módulo de recetas (incluye colaboradores)
 * @access Private (Doctor)
 */
router.get(
  '/patients/search',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  RecipeController.searchPatientsForRecipes
);

export default router; 