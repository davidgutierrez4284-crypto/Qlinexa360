import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

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
  console.log('=== authenticateToken DEBUG ===');
  console.log('Headers:', req.headers);
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  console.log('Auth header:', authHeader);
  console.log('Token extraído:', token ? 'Presente' : 'Ausente');

  if (token == null) {
    console.log('ERROR: No se proporcionó token de autenticación');
    return res.status(401).json({ message: 'No se proporcionó token de autenticación.' });
  }

  jwt.verify(token, env.JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.log('ERROR: Token inválido o expirado:', err.message);
      return res.status(403).json({ message: 'Token inválido o expirado.' });
    }
    
    console.log('Token verificado correctamente');
    console.log('Usuario decodificado:', user);
    
    req.user = user as UserPayload; // 4. Castear el usuario al tipo definido
    console.log('Usuario asignado a req.user:', req.user);
    
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
    console.log('=== authMiddleware DEBUG ===');
    console.log('Roles permitidos:', allowedRoles);
    console.log('req.user antes de authenticateToken:', req.user);
    
    authenticateToken(req, res, () => {
      console.log('=== Después de authenticateToken ===');
      console.log('req.user después de authenticateToken:', req.user);
      console.log('req.user?.role:', req.user?.role);
      console.log('¿Está permitido?:', req.user && allowedRoles.includes(req.user.role));
      
      if (req.user && allowedRoles.includes(req.user.role)) {
        console.log('✅ Usuario autorizado, continuando...');
        next(); // El usuario tiene el rol permitido
      } else {
        console.log('❌ Usuario NO autorizado');
        console.log('Usuario:', req.user);
        console.log('Rol del usuario:', req.user?.role);
        console.log('Roles permitidos:', allowedRoles);
        res.status(403).json({ message: 'No tienes permiso para acceder a este recurso.' });
      }
    });
  };
}; 