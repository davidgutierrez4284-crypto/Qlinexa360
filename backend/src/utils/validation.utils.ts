import { AppError } from './error.utils';

export const validateRegister = (data: any): void => {
  const { email, password, firstName, lastName, role } = data;

  if (!email || !password || !firstName || !lastName || !role) {
    throw new AppError('Todos los campos son requeridos', 400);
  }

  if (role === 'DOCTOR') {
    const { paypalSubscriptionId, promoCode } = data;
    if (!paypalSubscriptionId && !promoCode) {
      throw new AppError('Se requiere paypalSubscriptionId o un código promocional válido para el registro de doctor', 400);
    }
  }

  if (password.length < 6) {
    throw new AppError('La contraseña debe tener al menos 6 caracteres', 400);
  }

  if (!isValidEmail(email)) {
    throw new AppError('El email no es válido', 400);
  }
};

export const validateLogin = (data: any): void => {
  const { email, password } = data;

  if (!email || !password) {
    throw new AppError('Email y contraseña son requeridos', 400);
  }

  if (!isValidEmail(email)) {
    throw new AppError('El email no es válido', 400);
  }
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateYouTubeUrl = (url: string): boolean => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  return youtubeRegex.test(url);
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  // Mínimo 8 caracteres, al menos una letra mayúscula, una minúscula y un número
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
  return passwordRegex.test(password);
};

export const validatePhone = (phone: string): boolean => {
  // Formato: +XX XXXXXXXXXX
  const phoneRegex = /^\+\d{2}\s\d{10}$/;
  return phoneRegex.test(phone);
}; 