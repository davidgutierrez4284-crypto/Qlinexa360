"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAffiliateCode = generateAffiliateCode;
exports.normalizeAffiliateCode = normalizeAffiliateCode;
exports.generateUniqueAffiliateCode = generateUniqueAffiliateCode;
exports.generateUniqueCodeBatch = generateUniqueCodeBatch;
const crypto_1 = require("crypto");
const affiliate_constants_1 = require("../constants/affiliate.constants");
/** Genera un código con el formato QLX-AF-XXXXXX (alfabeto sin caracteres ambiguos). */
function generateAffiliateCode() {
    let suffix = '';
    for (let i = 0; i < affiliate_constants_1.AFFILIATE_CODE_RANDOM_LENGTH; i += 1) {
        suffix += affiliate_constants_1.AFFILIATE_CODE_ALPHABET[(0, crypto_1.randomInt)(0, affiliate_constants_1.AFFILIATE_CODE_ALPHABET.length)];
    }
    return `${affiliate_constants_1.AFFILIATE_CODE_PREFIX}${suffix}`;
}
/** Normaliza un código (trim + mayúsculas) para comparaciones consistentes. */
function normalizeAffiliateCode(raw) {
    return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}
/**
 * Genera un código único verificando colisiones tanto en perfiles como en el pool de códigos.
 */
async function generateUniqueAffiliateCode(prisma) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const code = generateAffiliateCode();
        const [inProfile, inPool] = await Promise.all([
            prisma.affiliateProfile.findUnique({ where: { affiliateCode: code }, select: { id: true } }),
            prisma.affiliateCode.findUnique({ where: { code }, select: { id: true } })
        ]);
        if (!inProfile && !inPool)
            return code;
    }
    throw new Error('No se pudo generar un código de afiliado único');
}
/**
 * Genera un lote de códigos únicos en memoria (sin colisiones internas).
 * La verificación contra la BD se hace al insertar con skipDuplicates.
 */
function generateUniqueCodeBatch(count) {
    const set = new Set();
    let guard = 0;
    const maxGuard = count * 50 + 1000;
    while (set.size < count && guard < maxGuard) {
        set.add(generateAffiliateCode());
        guard += 1;
    }
    return [...set];
}
