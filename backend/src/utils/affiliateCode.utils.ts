import { randomInt } from 'crypto';
import {
  AFFILIATE_CODE_ALPHABET,
  AFFILIATE_CODE_PREFIX,
  AFFILIATE_CODE_RANDOM_LENGTH
} from '../constants/affiliate.constants';

/** Genera un código con el formato QLX-AF-XXXXXX (alfabeto sin caracteres ambiguos). */
export function generateAffiliateCode(): string {
  let suffix = '';
  for (let i = 0; i < AFFILIATE_CODE_RANDOM_LENGTH; i += 1) {
    suffix += AFFILIATE_CODE_ALPHABET[randomInt(0, AFFILIATE_CODE_ALPHABET.length)];
  }
  return `${AFFILIATE_CODE_PREFIX}${suffix}`;
}

/** Normaliza un código (trim + mayúsculas) para comparaciones consistentes. */
export function normalizeAffiliateCode(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

/**
 * Genera un código único verificando colisiones tanto en perfiles como en el pool de códigos.
 */
export async function generateUniqueAffiliateCode(prisma: {
  affiliateProfile: { findUnique: (args: any) => Promise<any> };
  affiliateCode: { findUnique: (args: any) => Promise<any> };
}): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = generateAffiliateCode();
    const [inProfile, inPool] = await Promise.all([
      prisma.affiliateProfile.findUnique({ where: { affiliateCode: code }, select: { id: true } }),
      prisma.affiliateCode.findUnique({ where: { code }, select: { id: true } })
    ]);
    if (!inProfile && !inPool) return code;
  }
  throw new Error('No se pudo generar un código de afiliado único');
}

/**
 * Genera un lote de códigos únicos en memoria (sin colisiones internas).
 * La verificación contra la BD se hace al insertar con skipDuplicates.
 */
export function generateUniqueCodeBatch(count: number): string[] {
  const set = new Set<string>();
  let guard = 0;
  const maxGuard = count * 50 + 1000;
  while (set.size < count && guard < maxGuard) {
    set.add(generateAffiliateCode());
    guard += 1;
  }
  return [...set];
}
