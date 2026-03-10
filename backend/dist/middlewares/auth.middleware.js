"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = exports.optionalAuthenticate = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
// 3. Middleware de autenticación principal
const authenticateToken = (req, res, next) => {
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
    jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log('ERROR: Token inválido o expirado:', err.message);
            return res.status(403).json({ message: 'Token inválido o expirado.' });
        }
        console.log('Token verificado correctamente');
        console.log('Usuario decodificado:', user);
        req.user = user; // 4. Castear el usuario al tipo definido
        console.log('Usuario asignado a req.user:', req.user);
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
        console.log('=== authMiddleware DEBUG ===');
        console.log('Roles permitidos:', allowedRoles);
        console.log('req.user antes de authenticateToken:', req.user);
        (0, exports.authenticateToken)(req, res, () => {
            var _a, _b;
            console.log('=== Después de authenticateToken ===');
            console.log('req.user después de authenticateToken:', req.user);
            console.log('req.user?.role:', (_a = req.user) === null || _a === void 0 ? void 0 : _a.role);
            console.log('¿Está permitido?:', req.user && allowedRoles.includes(req.user.role));
            if (req.user && allowedRoles.includes(req.user.role)) {
                console.log('✅ Usuario autorizado, continuando...');
                next(); // El usuario tiene el rol permitido
            }
            else {
                console.log('❌ Usuario NO autorizado');
                console.log('Usuario:', req.user);
                console.log('Rol del usuario:', (_b = req.user) === null || _b === void 0 ? void 0 : _b.role);
                console.log('Roles permitidos:', allowedRoles);
                res.status(403).json({ message: 'No tienes permiso para acceder a este recurso.' });
            }
        });
    };
};
exports.authMiddleware = authMiddleware;
