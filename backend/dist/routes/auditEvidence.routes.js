"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const auditEvidence_controller_1 = require("../controllers/auditEvidence.controller");
const router = (0, express_1.Router)();
router.get('/exports', (0, auth_middleware_1.authMiddleware)(['ADMIN']), auditEvidence_controller_1.listAuditEvidenceExports);
router.post('/export', (0, auth_middleware_1.authMiddleware)(['ADMIN']), auditEvidence_controller_1.exportAuditEvidence);
exports.default = router;
