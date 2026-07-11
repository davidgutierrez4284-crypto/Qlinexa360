"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAffiliateAccess = exports.authMiddleware = exports.optionalAuthenticate = exports.authenticateToken = void 0;
exports.attachAuthTokenFromQuery = attachAuthTokenFromQuery;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const database_1 = __importDefault(require("../config/database"));
// 3. Middleware de autenticación principal
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        return res.status(401).json({ message: 'No se proporcionó token de autenticación.' });
    }
    jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido o expirado.' });
        }
        req.user = user;
        next();
    });
};
exports.authenticateToken = authenticateToken;
/** Autenticación opcional: adjunta el usuario si hay token válido, sino continúa sin req.user */
const optionalAuthenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token)
        return next();
    jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET, (err, user) => {
        if (!err && user)
            req.user = user;
        next();
    });
};
exports.optionalAuthenticate = optionalAuthenticate;
// 5. Middleware de autorización por rol
const authMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        (0, exports.authenticateToken)(req, res, () => {
            if (req.user && allowedRoles.includes(req.user.role)) {
                next();
            }
            else {
                res.status(403).json({ message: 'No tienes permiso para acceder a este recurso.' });
            }
        });
    };
};
exports.authMiddleware = authMiddleware;
/** Para redirecciones del navegador (OAuth MP): acepta JWT en ?token= si no hay Authorization header. */
function attachAuthTokenFromQuery(req, _res, next) {
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
const requireAffiliateAccess = (req, res, next) => {
    (0, exports.authenticateToken)(req, res, async () => {
        if (!req.user) {
            return res.status(401).json({ message: 'No autenticado.' });
        }
        if (req.user.role === 'AFFILIATE') {
            return next();
        }
        try {
            const profile = await database_1.default.affiliateProfile.findUnique({
                where: { userId: req.user.userId },
                select: { id: true }
            });
            if (profile) {
                return next();
            }
        }
        catch (error) {
            console.error('Error verificando capacidad de afiliado:', error);
            return res.status(500).json({ message: 'Error verificando permisos.' });
        }
        return res.status(403).json({ message: 'No tienes permiso para acceder a este recurso.' });
    });
};
exports.requireAffiliateAccess = requireAffiliateAccess;
