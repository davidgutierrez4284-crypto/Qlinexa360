import jwt from 'jsonwebtoken';
import { env } from '../config/env';

interface TokenPayload {
  userId: string;
  role: string;
  doctorId?: string;
  twoFactorPending?: boolean;
}

const normalizeExpiresIn = (value?: string) => value as jwt.SignOptions['expiresIn'];

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(
    payload,
    env.JWT_SECRET as string,
    { expiresIn: normalizeExpiresIn(env.JWT_EXPIRES_IN || '24h') }
  );
};

export const generateTwoFactorToken = (payload: TokenPayload, expiresIn: string = '10m'): string => {
  return jwt.sign(
    { ...payload, twoFactorPending: true },
    env.JWT_SECRET as string,
    { expiresIn: normalizeExpiresIn(expiresIn) }
  );
};

export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(
      token,
      env.JWT_SECRET as string
    ) as TokenPayload;
  } catch (error) {
    throw new Error('Token inválido');
  }
};

/** Token de corta duración para completar consentimientos tras registro (asistente) */
export const generateConsentToken = (userId: string, expiresIn: string = '10m'): string => {
  return jwt.sign(
    { userId, purpose: 'consent' },
    env.JWT_SECRET as string,
    { expiresIn: normalizeExpiresIn(expiresIn) }
  );
};

export const verifyConsentToken = (token: string): { userId: string } => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET as string) as { userId: string; purpose?: string };
    if (decoded.purpose !== 'consent') throw new Error('Token inválido');
    return { userId: decoded.userId };
  } catch {
    throw new Error('Token de consentimiento inválido o expirado');
  }
};

/** Token para "recordar dispositivo" - evita pedir 2FA por 30 días en el mismo dispositivo */
const TRUSTED_DEVICE_EXPIRY = '30d';

export const generateTrustedDeviceToken = (userId: string): string => {
  return jwt.sign(
    { userId, purpose: 'trustedDevice' },
    env.JWT_SECRET as string,
    { expiresIn: TRUSTED_DEVICE_EXPIRY }
  );
};

export const verifyTrustedDeviceToken = (token: string): { userId: string } | null => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET as string) as { userId: string; purpose?: string };
    if (decoded.purpose !== 'trustedDevice') return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
};

export {}; 