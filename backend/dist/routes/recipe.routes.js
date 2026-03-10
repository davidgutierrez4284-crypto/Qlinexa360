"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const recipe_controller_1 = require("../controllers/recipe.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const subscription_middleware_1 = require("../middlewares/subscription.middleware");
const router = (0, express_1.Router)();
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
router.post('/templates/:doctorId', auth_middleware_1.authMiddleware, (0, subscription_middleware_1.subscriptionAccess)('edit'), recipe_controller_1.RecipeController.uploadRecipeTemplate);
/**
 * @route GET /api/recipes/templates/:doctorId
 * @desc Obtener templates de recetas de un doctor
 * @access Private (Doctor)
 */
router.get('/templates/:doctorId', auth_middleware_1.authMiddleware, (0, subscription_middleware_1.subscriptionAccess)('read'), recipe_controller_1.RecipeController.getRecipeTemplates);
/**
 * Ruta de verificación pública (sin autenticación).
 * Usado por personas externas que escanean el QR: farmacia, familiares, etc.
 * No requieren ser usuarios de Qlinexa360. Solo lectura.
 */
router.get('/verify/:id', recipe_controller_1.RecipeController.verifyRecipe);
// Rutas protegidas
router.post('/', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), recipe_controller_1.RecipeController.createRecipe);
/**
 * @route GET /api/recipes/patient/:pacienteId
 * @desc Obtener recetas de un paciente
 * @access Private (Doctor/Asistente)
 */
router.get('/patient/:pacienteId', auth_middleware_1.authMiddleware, (0, subscription_middleware_1.subscriptionAccess)('read'), recipe_controller_1.RecipeController.getPatientRecipes);
/**
 * @route GET /api/recipes/doctor/:doctorId
 * @desc Obtener recetas de un doctor
 * @access Private (Doctor)
 */
router.get('/doctor/:doctorId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('prescriptions'), 
// subscriptionAccess('read'), // Temporalmente removido para debugging
recipe_controller_1.RecipeController.getDoctorRecipes);
/**
 * @route GET /api/recipes/my-recipes
 * @desc Obtener recetas del doctor autenticado (sus propias recetas)
 * @access Private (Doctor/Asistente)
 */
router.get('/my-recipes', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('prescriptions'), recipe_controller_1.RecipeController.getMyRecipes);
/**
 * @route GET /api/recipes/:id
 * @desc Obtener receta específica
 * @access Private (Doctor/Asistente)
 */
router.get('/:id', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('prescriptions'), 
// subscriptionAccess('read'), // Temporalmente removido para debugging
recipe_controller_1.RecipeController.getRecipeById);
// Endpoint para generar URL segura de visualización
router.get('/:id/pdf-view-url', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE', 'PATIENT']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('prescriptions'), 
// subscriptionAccess('read'), // Temporalmente removido para debugging
recipe_controller_1.RecipeController.getRecipePdfViewUrl);
/**
 * Servir PDF de receta para visualización pública.
 * Sin autenticación: usa hash+timestamp en la URL como token temporal.
 * Accesible por farmacias, familiares y cualquier persona que escanee el QR.
 */
router.get('/:id/pdf-view', recipe_controller_1.RecipeController.serveRecipePdf);
router.get('/:id/pdf', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('prescriptions'), 
// subscriptionAccess('read'), // Temporalmente removido para debugging
recipe_controller_1.RecipeController.downloadRecipePdf);
/**
 * @route PUT /api/recipes/:id
 * @desc Actualizar receta médica
 * @access Private (Doctor/Asistente)
 */
router.put('/:id', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), (0, subscription_middleware_1.subscriptionAccess)('edit'), recipe_controller_1.RecipeController.updateRecipe);
/**
 * @route DELETE /api/recipes/:id
 * @desc Eliminar receta médica
 * @access Private (Doctor)
 */
router.delete('/:id', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), 
// subscriptionAccess('edit'), // Temporalmente removido para debugging
recipe_controller_1.RecipeController.deleteRecipe);
// Enviar receta por email al paciente
router.post('/:id/email-to-patient', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('prescriptions'), recipe_controller_1.RecipeController.emailRecipeToPatient);
/**
 * @route GET /api/recipes/stats/:doctorId
 * @desc Obtener estadísticas de recetas para un doctor
 * @access Private (Doctor)
 */
router.get('/stats/:doctorId', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), 
// subscriptionAccess('read'), // Temporalmente removido para debugging
recipe_controller_1.RecipeController.getRecipeStats);
/**
 * @route GET /api/recipes/patients/search
 * @desc Buscar pacientes para el módulo de recetas (incluye colaboradores)
 * @access Private (Doctor)
 */
router.get('/patients/search', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), recipe_controller_1.RecipeController.searchPatientsForRecipes);
exports.default = router;
