import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Middleware que valida el token para reportes de administración.
 * Requiere header: X-Admin-Report-Token: <token>
 * El token se configura en ADMIN_REPORT_TOKEN (Secrets Manager en PROD).
 */
export const requireAdminReportToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-admin-report-token'] as string | undefined;
  const expected = env.ADMIN_REPORT_TOKEN;

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
