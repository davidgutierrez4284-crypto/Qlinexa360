"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminReportToken = void 0;
const env_1 = require("../config/env");
/**
 * Middleware que valida el token para reportes de administración.
 * Requiere header: X-Admin-Report-Token: <token>
 * El token se configura en ADMIN_REPORT_TOKEN (Secrets Manager en PROD).
 */
const requireAdminReportToken = (req, res, next) => {
    const token = req.headers['x-admin-report-token'];
    const expected = env_1.env.ADMIN_REPORT_TOKEN;
    if (!expected || expected.length < 16) {
        return res.status(503).json({
            error: 'Reportes admin no configurados',
            message: 'ADMIN_REPORT_TOKEN no está definido en el servidor.',
        });
    }
    if (!token || token !== expected) {
        return res.status(401).json({
            error: 'No autorizado',
            message: 'Header X-Admin-Report-Token inválido o ausente.',
        });
    }
    next();
};
exports.requireAdminReportToken = requireAdminReportToken;
