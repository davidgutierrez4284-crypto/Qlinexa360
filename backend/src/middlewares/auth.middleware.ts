import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../config/database';

// 1. Definir y exportar el tipo del payload del usuario
export interface UserPayload {
  userId: string;
  role: string;
  doctorId?: string;
}

// 2. Extender Request para incluir este payload
export interface AuthRequest extends Request {
  user?: UserPayload;
}

// 3. Middleware de autenticación principal
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'No se proporcionó token de autenticación.' });
  }

  jwt.verify(token, env.JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido o expirado.' });
    }
    req.user = user as UserPayload;
    next();
  });
};

/** Autenticación opcional: adjunta el usuario si hay token válido, sino continúa sin req.user */
export const optionalAuthenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  jwt.verify(token, env.JWT_SECRET, (err: any, user: any) => {
    if (!err && user) req.user = user as UserPayload;
    next();
  });
};

// 5. Middleware de autorización por rol
export const authMiddleware = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    authenticateToken(req, res, () => {
      if (req.user && allowedRoles.includes(req.user.role)) {
        next();
      } else {
        res.status(403).json({ message: 'No tienes permiso para acceder a este recurso.' });
      }
    });
  };
};

/** Para redirecciones del navegador (OAuth MP): acepta JWT en ?token= si no hay Authorization header. */
export function attachAuthTokenFromQuery(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.headers.authorization && typeof req.query.token === 'string' && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

/**
 * Autoriza el acceso al módulo de afiliado tratándolo como una CAPACIDAD y no como un rol:
 * pasa si el usuario tiene rol AFFILIATE (afiliado "puro") o si tiene un AffiliateProfile
 * vinculado (p. ej. un paciente que además es afiliado).
 */
export const requireAffiliateAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  authenticateToken(req, res, async () => {
    if (!req.user) {
      return res.status(401).json({ message: 'No autenticado.' });
    }
    if (req.user.role === 'AFFILIATE') {
      return next();
    }
    try {
      const profile = await prisma.affiliateProfile.findUnique({
        where: { userId: req.user.userId },
        select: { id: true }
      });
      if (profile) {
        return next();
      }
    } catch (error) {
      console.error('Error verificando capacidad de afiliado:', error);
      return res.status(500).json({ message: 'Error verificando permisos.' });
    }
    return res.status(403).json({ message: 'No tienes permiso para acceder a este recurso.' });
  });
}; 