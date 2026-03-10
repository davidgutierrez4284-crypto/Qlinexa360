"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const studyDocument_controller_1 = require("../controllers/studyDocument.controller");
const router = (0, express_1.Router)();
const assistantStudiesOnly = (req, res, next) => {
    var _a;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === 'ASISTENTE') {
        return assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('studies')(req, res, next);
    }
    return next();
};
// Rutas protegidas que requieren autenticación
router.use(auth_middleware_1.authenticateToken);
// Obtener documentos de estudio
router.get('/', assistantStudiesOnly, studyDocument_controller_1.getStudyDocuments);
// Crear documento de estudio
router.post('/', assistantStudiesOnly, upload_middleware_1.upload.single('file'), studyDocument_controller_1.createStudyDocument);
// Eliminar documento de estudio
router.delete('/:id', assistantStudiesOnly, studyDocument_controller_1.deleteStudyDocument);
exports.default = router;
