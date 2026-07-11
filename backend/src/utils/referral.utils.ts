import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeReferralCode(raw: unknown): string {
  if (raw == null || typeof raw !== 'string') return '';
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 32);
}

/**
 * Base URL del SPA para enlaces de registro por referido (WhatsApp, correo, /api/referrals/me).
 * El apex qlinexa360.com suele no tener DNS; el sitio público es https://www.qlinexa360.com
 */
export function referralRegisterBaseUrl(frontendUrl: string | undefined): string {
  const fallback = 'http://localhost:5173';
  const raw = (frontendUrl || '').trim() || fallback;
  const trimmed = raw.replace(/\/$/, '');
  try {
    const u = new URL(trimmed);
    if (u.hostname.toLowerCase() === 'qlinexa360.com') {
      u.hostname = 'www.qlinexa360.com';
    }
    return u.toString().replace(/\/$/, '');
  } catch {
    return trimmed;
  }
}

export async function generateUniqueReferralCode(prisma: PrismaClient): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
    }
    const exists = await prisma.doctor.findFirst({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error('No se pudo generar un código de referido único');
}
