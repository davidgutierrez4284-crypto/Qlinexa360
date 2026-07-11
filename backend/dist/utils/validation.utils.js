"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePhone = exports.getPasswordValidationMessage = exports.validatePassword = exports.validateEmail = exports.validateYouTubeUrl = exports.validateLogin = exports.validateRegister = void 0;
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
    if (!(0, exports.validatePassword)(password)) {
        throw new error_utils_1.AppError('La contraseña debe tener al menos 8 caracteres e incluir al menos una mayúscula, una minúscula y un número', 400);
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
    // Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número (caracteres especiales permitidos)
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
};
exports.validatePassword = validatePassword;
const getPasswordValidationMessage = (password) => {
    if (!password)
        return 'Debes ingresar una contraseña.';
    if (password.length < 8)
        return 'La contraseña debe tener al menos 8 caracteres';
    if (!/[a-z]/.test(password))
        return 'Debe incluir al menos una letra minúscula';
    if (!/[A-Z]/.test(password))
        return 'Debe incluir al menos una letra mayúscula';
    if (!/\d/.test(password))
        return 'Debe incluir al menos un número';
    return '';
};
exports.getPasswordValidationMessage = getPasswordValidationMessage;
const validatePhone = (phone) => {
    // Formato: +XX XXXXXXXXXX
    const phoneRegex = /^\+\d{2}\s\d{10}$/;
    return phoneRegex.test(phone);
};
exports.validatePhone = validatePhone;
