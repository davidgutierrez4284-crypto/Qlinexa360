"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePhone = exports.validatePassword = exports.validateEmail = exports.validateYouTubeUrl = exports.validateLogin = exports.validateRegister = void 0;
const error_utils_1 = require("./error.utils");
const validateRegister = (data) => {
    const { email, password, firstName, lastName, role } = data;
    if (!email || !password || !firstName || !lastName || !role) {
        throw new error_utils_1.AppError('Todos los campos son requeridos', 400);
    }
    if (role === 'DOCTOR') {
        const { paypalSubscriptionId, promoCode } = data;
        if (!paypalSubscriptionId && !promoCode) {
            throw new error_utils_1.AppError('Se requiere paypalSubscriptionId o un código promocional válido para el registro de doctor', 400);
        }
    }
    if (password.length < 6) {
        throw new error_utils_1.AppError('La contraseña debe tener al menos 6 caracteres', 400);
    }
    if (!isValidEmail(email)) {
        throw new error_utils_1.AppError('El email no es válido', 400);
    }
};
exports.validateRegister = validateRegister;
const validateLogin = (data) => {
    const { email, password } = data;
    if (!email || !password) {
        throw new error_utils_1.AppError('Email y contraseña son requeridos', 400);
    }
    if (!isValidEmail(email)) {
        throw new error_utils_1.AppError('El email no es válido', 400);
    }
};
exports.validateLogin = validateLogin;
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
const validateYouTubeUrl = (url) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return youtubeRegex.test(url);
};
exports.validateYouTubeUrl = validateYouTubeUrl;
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.validateEmail = validateEmail;
const validatePassword = (password) => {
    // Mínimo 8 caracteres, al menos una letra mayúscula, una minúscula y un número
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    return passwordRegex.test(password);
};
exports.validatePassword = validatePassword;
const validatePhone = (phone) => {
    // Formato: +XX XXXXXXXXXX
    const phoneRegex = /^\+\d{2}\s\d{10}$/;
    return phoneRegex.test(phone);
};
exports.validatePhone = validatePhone;
