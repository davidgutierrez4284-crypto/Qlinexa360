"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyReferralRewardIfEligible = applyReferralRewardIfEligible;
exports.redeemReferralFreeMonthsForReferrer = redeemReferralFreeMonthsForReferrer;
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../config/database"));
const email_utils_1 = require("../utils/email.utils");
const paypalAuth_utils_1 = require("../utils/paypalAuth.utils");
/** Crédito Qlinexa360 por cada colega con suscripción de pago activa (20% de un mes hacia mes gratis). */
const CREDIT_PERCENT_PER_REFERRAL = 20;
/**
 * Al llegar a 100% de crédito (= 5 referidos acreditados, cada uno +20%) se otorga 1 mes sin cargo:
 * se suspende la suscripción en PayPal (sin cargos) y se fija {@link Subscription.resumeDate}.
 * Pasado ese día, `runResumeSuspendedSubscriptions` (cron) llama a PayPal `activate`: el cobro vuelve al
 * **100% del importe del plan** en PayPal (no hay plan con descuento; no queda estado de “% rebajado”).
 * Si el doctor vuelve a acumular otros 100% de crédito, se repite pausa + reanudación automática.
 */
const CREDIT_PERCENT_PER_FREE_MONTH = 100;
const LIFETIME_FUTURE_MS = 25 * 365 * 24 * 60 * 60 * 1000;
/**
 * Acredita al referidor cuando el referido tiene suscripción activa (PayPal o lifetime).
 * Idempotente: una fila por referredDoctorId.
 * Tras acreditar, intenta canjear bloques de 100% por meses gratis automáticos (PayPal).
 */
async function applyReferralRewardIfEligible(referredDoctorId) {
    var _a;
    const doctor = await database_1.default.doctor.findUnique({
        where: { id: referredDoctorId },
        include: { subscription: true },
    });
    if (!(doctor === null || doctor === void 0 ? void 0 : doctor.referrerDoctorId))
        return;
    const sub = doctor.subscription;
    const hasQualifyingSub = (sub === null || sub === void 0 ? void 0 : sub.status) === 'ACTIVE' &&
        (!!((_a = sub.paypalSubscriptionId) === null || _a === void 0 ? void 0 : _a.trim()) || doctor.accessType === 'lifetime');
    if (!hasQualifyingSub)
        return;
    const existing = await database_1.default.referralConversion.findUnique({
        where: { referredDoctorId },
    });
    if (existing)
        return;
    if (doctor.referrerDoctorId === referredDoctorId)
        return;
    const referrerId = doctor.referrerDoctorId;
    await database_1.default.$transaction([
        database_1.default.referralConversion.create({
            data: {
                referrerDoctorId: referrerId,
                referredDoctorId,
                percentGranted: CREDIT_PERCENT_PER_REFERRAL,
            },
        }),
        database_1.default.doctor.update({
            where: { id: referrerId },
            data: { referralCreditPercent: { increment: CREDIT_PERCENT_PER_REFERRAL } },
        }),
    ]);
    await redeemReferralFreeMonthsForReferrer(referrerId);
}
/**
 * Canjea todo el saldo en bloques de 100%: cada bloque = 1 mes sin cargo en PayPal (misma mecánica que el mes gratis de retención).
 * Si PayPal falla, el saldo no se descuenta y se reintentará en la próxima conversión.
 */
async function redeemReferralFreeMonthsForReferrer(referrerDoctorId) {
    var _a;
    const maxPasses = 24;
    for (let i = 0; i < maxPasses; i++) {
        const row = await database_1.default.doctor.findUnique({
            where: { id: referrerDoctorId },
            select: { referralCreditPercent: true },
        });
        const balance = (_a = row === null || row === void 0 ? void 0 : row.referralCreditPercent) !== null && _a !== void 0 ? _a : 0;
        if (balance < CREDIT_PERCENT_PER_FREE_MONTH)
            return;
        const ok = await tryGrantOneReferralFreeMonth(referrerDoctorId);
        if (!ok) {
            console.warn(`[referrals] Canje mes gratis: no aplicado para referrer ${referrerDoctorId} (saldo ${balance}%). Se reintentará en próxima acreditación.`);
            return;
        }
        await database_1.default.doctor.update({
            where: { id: referrerDoctorId },
            data: {
                referralCreditPercent: { decrement: CREDIT_PERCENT_PER_FREE_MONTH },
                referralFreeMonthsGranted: { increment: 1 },
            },
        });
    }
}
async function tryGrantOneReferralFreeMonth(referrerDoctorId) {
    var _a, _b, _c;
    const subscription = await database_1.default.subscription.findUnique({
        where: { doctorId: referrerDoctorId },
        include: {
            doctor: {
                include: {
                    user: { select: { firstName: true, lastName: true, email: true } },
                },
            },
        },
    });
    if (!subscription || subscription.status === 'CANCELLED')
        return false;
    const doctor = subscription.doctor;
    const user = doctor.user;
    if (!(user === null || user === void 0 ? void 0 : user.email))
        return false;
    const now = new Date();
    const paypalId = (subscription.paypalSubscriptionId || '').trim();
    const hasPayPal = paypalId.length > 0;
    const endFarFuture = subscription.endDate.getTime() > now.getTime() + LIFETIME_FUTURE_MS;
    const isLifetimeAccess = doctor.accessType === 'lifetime' || (!hasPayPal && endFarFuture);
    if (isLifetimeAccess) {
        const base = subscription.endDate > now ? subscription.endDate : now;
        const newEnd = new Date(base);
        newEnd.setDate(newEnd.getDate() + 30);
        await database_1.default.subscription.update({
            where: { doctorId: referrerDoctorId },
            data: { endDate: newEnd, updatedAt: now },
        });
        await (0, email_utils_1.sendEmail)(user.email, 'Beneficio programa de referidos — Qlinexa360', `Hola ${user.firstName || ''},

Has acumulado suficientes referidos y te hemos aplicado automáticamente 1 mes adicional de acceso en Qlinexa360 (plan de por vida o acceso extendido).

Nueva fecha de vigencia aproximada: ${newEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.

Gracias por recomendar la plataforma.`);
        return true;
    }
    if (!hasPayPal)
        return false;
    const baseDate = subscription.endDate > now ? subscription.endDate : now;
    const scheduledPause = subscription.resumeDate && subscription.resumeDate > now;
    if (scheduledPause) {
        const newEnd = new Date(subscription.endDate);
        newEnd.setDate(newEnd.getDate() + 30);
        const newResume = new Date(subscription.resumeDate);
        newResume.setDate(newResume.getDate() + 30);
        await database_1.default.subscription.update({
            where: { doctorId: referrerDoctorId },
            data: {
                endDate: newEnd,
                resumeDate: newResume,
                freeMonthUsed: true,
                updatedAt: now,
            },
        });
        await (0, email_utils_1.sendEmail)(user.email, 'Beneficio programa de referidos — Qlinexa360', `Hola ${user.firstName || ''},

Has acumulado otro mes gratis por el programa de referidos. Hemos extendido tu periodo sin cargo en PayPal hasta el ${newResume.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.

Gracias por recomendar Qlinexa360.`);
        return true;
    }
    const newEndDate = new Date(baseDate);
    newEndDate.setDate(newEndDate.getDate() + 30);
    const newResumeDate = new Date(newEndDate);
    const token = await (0, paypalAuth_utils_1.getPayPalAccessToken)();
    if (!token)
        return false;
    const baseUrl = (0, paypalAuth_utils_1.getPayPalApiBaseUrl)();
    try {
        await axios_1.default.post(`${baseUrl}/v1/billing/subscriptions/${encodeURIComponent(paypalId)}/suspend`, { reason: 'Beneficio programa referidos Qlinexa360 — mes sin cargo (automático)' }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
    }
    catch (err) {
        const msg = (((_b = (_a = err.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || err.message || '').toLowerCase();
        const alreadySuspended = msg.includes('suspended') || msg.includes('suspendida') || msg.includes('pause') || msg.includes('already');
        if (!alreadySuspended) {
            console.error('[referrals] tryGrantOneReferralFreeMonth suspend', ((_c = err.response) === null || _c === void 0 ? void 0 : _c.data) || err.message);
            return false;
        }
    }
    await database_1.default.subscription.update({
        where: { doctorId: referrerDoctorId },
        data: {
            endDate: newEndDate,
            resumeDate: newResumeDate,
            freeMonthUsed: true,
            updatedAt: now,
        },
    });
    await (0, email_utils_1.sendEmail)(user.email, 'Beneficio programa de referidos — Qlinexa360', `Hola ${user.firstName || ''},

Has alcanzado el 100% de crédito acumulado por referidos. Te aplicamos automáticamente 1 mes sin cargo en tu suscripción PayPal (misma pausa programada que otros beneficios de la plataforma).

Tu acceso en Qlinexa360 queda ampliado hasta aproximadamente el ${newEndDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.
Los cargos en PayPal se reanudan alrededor del ${newResumeDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.

Gracias por recomendar Qlinexa360.`);
    return true;
}
