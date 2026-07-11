import axios from 'axios';
import prisma from '../config/database';
import { sendEmail } from '../utils/email.utils';
import { getPayPalAccessToken, getPayPalApiBaseUrl } from '../utils/paypalAuth.utils';

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
export async function applyReferralRewardIfEligible(referredDoctorId: string): Promise<void> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: referredDoctorId },
    include: { subscription: true },
  });
  if (!doctor?.referrerDoctorId) return;

  const sub = doctor.subscription;
  const hasQualifyingSub =
    sub?.status === 'ACTIVE' &&
    (!!sub.paypalSubscriptionId?.trim() || doctor.accessType === 'lifetime');

  if (!hasQualifyingSub) return;

  const existing = await prisma.referralConversion.findUnique({
    where: { referredDoctorId },
  });
  if (existing) return;
  if (doctor.referrerDoctorId === referredDoctorId) return;

  const referrerId = doctor.referrerDoctorId;

  await prisma.$transaction([
    prisma.referralConversion.create({
      data: {
        referrerDoctorId: referrerId,
        referredDoctorId,
        percentGranted: CREDIT_PERCENT_PER_REFERRAL,
      },
    }),
    prisma.doctor.update({
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
export async function redeemReferralFreeMonthsForReferrer(referrerDoctorId: string): Promise<void> {
  const maxPasses = 24;
  for (let i = 0; i < maxPasses; i++) {
    const row = await prisma.doctor.findUnique({
      where: { id: referrerDoctorId },
      select: { referralCreditPercent: true },
    });
    const balance = row?.referralCreditPercent ?? 0;
    if (balance < CREDIT_PERCENT_PER_FREE_MONTH) return;

    const ok = await tryGrantOneReferralFreeMonth(referrerDoctorId);
    if (!ok) {
      console.warn(
        `[referrals] Canje mes gratis: no aplicado para referrer ${referrerDoctorId} (saldo ${balance}%). Se reintentará en próxima acreditación.`,
      );
      return;
    }

    await prisma.doctor.update({
      where: { id: referrerDoctorId },
      data: {
        referralCreditPercent: { decrement: CREDIT_PERCENT_PER_FREE_MONTH },
        referralFreeMonthsGranted: { increment: 1 },
      },
    });
  }
}

async function tryGrantOneReferralFreeMonth(referrerDoctorId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { doctorId: referrerDoctorId },
    include: {
      doctor: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  if (!subscription || subscription.status === 'CANCELLED') return false;

  const doctor = subscription.doctor;
  const user = doctor.user;
  if (!user?.email) return false;

  const now = new Date();
  const paypalId = (subscription.paypalSubscriptionId || '').trim();
  const hasPayPal = paypalId.length > 0;
  const endFarFuture = subscription.endDate.getTime() > now.getTime() + LIFETIME_FUTURE_MS;
  const isLifetimeAccess =
    doctor.accessType === 'lifetime' || (!hasPayPal && endFarFuture);

  if (isLifetimeAccess) {
    const base = subscription.endDate > now ? subscription.endDate : now;
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + 30);
    await prisma.subscription.update({
      where: { doctorId: referrerDoctorId },
      data: { endDate: newEnd, updatedAt: now },
    });
    await sendEmail(
      user.email,
      'Beneficio programa de referidos — Qlinexa360',
      `Hola ${user.firstName || ''},

Has acumulado suficientes referidos y te hemos aplicado automáticamente 1 mes adicional de acceso en Qlinexa360 (plan de por vida o acceso extendido).

Nueva fecha de vigencia aproximada: ${newEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.

Gracias por recomendar la plataforma.`,
    );
    return true;
  }

  if (!hasPayPal) return false;

  const baseDate = subscription.endDate > now ? subscription.endDate : now;
  const scheduledPause = subscription.resumeDate && subscription.resumeDate > now;

  if (scheduledPause) {
    const newEnd = new Date(subscription.endDate);
    newEnd.setDate(newEnd.getDate() + 30);
    const newResume = new Date(subscription.resumeDate!);
    newResume.setDate(newResume.getDate() + 30);
    await prisma.subscription.update({
      where: { doctorId: referrerDoctorId },
      data: {
        endDate: newEnd,
        resumeDate: newResume,
        freeMonthUsed: true,
        updatedAt: now,
      },
    });
    await sendEmail(
      user.email,
      'Beneficio programa de referidos — Qlinexa360',
      `Hola ${user.firstName || ''},

Has acumulado otro mes gratis por el programa de referidos. Hemos extendido tu periodo sin cargo en PayPal hasta el ${newResume.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.

Gracias por recomendar Qlinexa360.`,
    );
    return true;
  }

  const newEndDate = new Date(baseDate);
  newEndDate.setDate(newEndDate.getDate() + 30);
  const newResumeDate = new Date(newEndDate);

  const token = await getPayPalAccessToken();
  if (!token) return false;

  const baseUrl = getPayPalApiBaseUrl();
  try {
    await axios.post(
      `${baseUrl}/v1/billing/subscriptions/${encodeURIComponent(paypalId)}/suspend`,
      { reason: 'Beneficio programa referidos Qlinexa360 — mes sin cargo (automático)' },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (err: any) {
    const msg = (err.response?.data?.message || err.message || '').toLowerCase();
    const alreadySuspended =
      msg.includes('suspended') || msg.includes('suspendida') || msg.includes('pause') || msg.includes('already');
    if (!alreadySuspended) {
      console.error('[referrals] tryGrantOneReferralFreeMonth suspend', err.response?.data || err.message);
      return false;
    }
  }

  await prisma.subscription.update({
    where: { doctorId: referrerDoctorId },
    data: {
      endDate: newEndDate,
      resumeDate: newResumeDate,
      freeMonthUsed: true,
      updatedAt: now,
    },
  });

  await sendEmail(
    user.email,
    'Beneficio programa de referidos — Qlinexa360',
    `Hola ${user.firstName || ''},

Has alcanzado el 100% de crédito acumulado por referidos. Te aplicamos automáticamente 1 mes sin cargo en tu suscripción PayPal (misma pausa programada que otros beneficios de la plataforma).

Tu acceso en Qlinexa360 queda ampliado hasta aproximadamente el ${newEndDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.
Los cargos en PayPal se reanudan alrededor del ${newResumeDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.

Gracias por recomendar Qlinexa360.`,
  );

  return true;
}
