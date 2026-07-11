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

  if (!validatePassword(password)) {
    throw new AppError(
      'La contraseña debe tener al menos 8 caracteres e incluir al menos una mayúscula, una minúscula y un número',
      400
    );
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
  // Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número (caracteres especiales permitidos)
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
};

export const getPasswordValidationMessage = (password: string): string => {
  if (!password) return 'Debes ingresar una contraseña.';
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[a-z]/.test(password)) return 'Debe incluir al menos una letra minúscula';
  if (!/[A-Z]/.test(password)) return 'Debe incluir al menos una letra mayúscula';
  if (!/\d/.test(password)) return 'Debe incluir al menos un número';
  return '';
};

export const validatePhone = (phone: string): boolean => {
  // Formato: +XX XXXXXXXXXX
  const phoneRegex = /^\+\d{2}\s\d{10}$/;
  return phoneRegex.test(phone);
}; 