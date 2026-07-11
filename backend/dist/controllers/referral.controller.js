"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReferralHistory = exports.sendReferralInviteEmail = exports.getMyReferralInfo = exports.validateReferralCode = void 0;
const database_1 = __importDefault(require("../config/database"));
const env_1 = require("../config/env");
const notification_service_1 = require("../services/notification.service");
const referral_utils_1 = require("../utils/referral.utils");
async function resolveDoctorIdFromAuth(req) {
    var _a, _b, _c;
    let doctorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.doctorId;
    if (!doctorId && ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId) && ((_c = req.user) === null || _c === void 0 ? void 0 : _c.role) === 'DOCTOR') {
        const d = await database_1.default.doctor.findUnique({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        doctorId = d === null || d === void 0 ? void 0 : d.id;
    }
    return doctorId || null;
}
function maskEmail(email) {
    const e = (email || '').trim().toLowerCase();
    if (!e || !e.includes('@'))
        return '—';
    const [u, domain] = e.split('@');
    if (!domain)
        return '—';
    if (u.length <= 2)
        return `**@${domain}`;
    return `${u.slice(0, 2)}***@${domain}`;
}
function formatReferralBenefitDateEsMx(d) {
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}
/** Texto para UI: en qué va el mes sin cargo según suscripción (resumeDate / endDate). */
function buildReferralProgramBenefitHint(opts) {
    const n = opts.referralFreeMonthsGranted;
    if (n <= 0)
        return null;
    const sub = opts.subscription;
    const now = new Date();
    if (!sub) {
        return n === 1
            ? '1 mes de beneficio; al pausar en PayPal, aquí verás la fecha de reanudación.'
            : `${n} meses de beneficio; fechas según tu suscripción/PayPal.`;
    }
    if (sub.freeMonthUsed && sub.resumeDate && sub.resumeDate > now) {
        return `Mes sin cargo hasta el ${formatReferralBenefitDateEsMx(sub.resumeDate)}; después, cobro PayPal.`;
    }
    if (sub.freeMonthUsed && sub.resumeDate) {
        return n === 1
            ? `Mes sin cargo hasta el ${formatReferralBenefitDateEsMx(sub.resumeDate)}.`
            : `${n} meses aplicados; último sin cargo hasta el ${formatReferralBenefitDateEsMx(sub.resumeDate)}.`;
    }
    if (sub.freeMonthUsed) {
        return `${n} mes(es) de beneficio; fin del periodo actual: ${formatReferralBenefitDateEsMx(sub.endDate)}.`;
    }
    return n === 1
        ? '1 mes contabilizado; cuando PayPal muestre la pausa, aquí verás la reanudación.'
        : `${n} meses contabilizados; fechas según PayPal.`;
}
/** Misma regla que {@link applyReferralRewardIfEligible} en `referral.service.ts`. */
function hasQualifyingPaidSubscriptionForReferralCredit(args) {
    const st = (args.subscriptionStatus || '').trim();
    const paypal = (args.paypalSubscriptionId || '').trim();
    const lifetime = (args.accessType || '').toLowerCase() === 'lifetime';
    return st === 'ACTIVE' && (!!paypal || lifetime);
}
function buildPendingReferralNote(args) {
    const st = (args.subscriptionStatus || '').trim().toUpperCase();
    const qualifies = hasQualifyingPaidSubscriptionForReferralCredit({
        subscriptionStatus: args.subscriptionStatus,
        paypalSubscriptionId: args.paypalSubscriptionId,
        accessType: args.accessType,
    });
    if (qualifies) {
        return 'Pago OK (PayPal o lifetime); el crédito suele verse en minutos. Si no, soporte.';
    }
    if (st === 'ACTIVE') {
        return 'Activa sin PayPal recurrente (ni lifetime): aún no acredita.';
    }
    if (st === 'SUSPENDED') {
        return 'Suspendida: acredita al reactivar el cobro.';
    }
    if (st === 'CANCELLED' || st === 'EXPIRED') {
        return 'Cancelada o vencida: sin acreditación.';
    }
    return 'Acredita con PayPal recurrente activo o acceso lifetime.';
}
/** GET /api/referrals/validate?code= — público */
const validateReferralCode = async (req, res) => {
    try {
        const code = (0, referral_utils_1.normalizeReferralCode)(req.query.code);
        if (!code || code.length < 4) {
            return res.status(400).json({ valid: false, message: 'Código inválido' });
        }
        const doctor = await database_1.default.doctor.findFirst({
            where: { referralCode: code },
            select: {
                user: {
                    select: { firstName: true, lastName: true },
                },
            },
        });
        if (!(doctor === null || doctor === void 0 ? void 0 : doctor.user)) {
            return res.json({ valid: false, message: 'Código no encontrado' });
        }
        const first = (doctor.user.firstName || '').trim();
        const last = (doctor.user.lastName || '').trim();
        const lastInitial = last ? `${last.charAt(0)}.` : '';
        const displayHint = [first, lastInitial].filter(Boolean).join(' ').trim() || 'Profesional';
        return res.json({
            valid: true,
            message: 'Código válido',
            displayHint,
        });
    }
    catch (e) {
        console.error('validateReferralCode:', e);
        return res.status(500).json({ valid: false, message: 'Error al validar' });
    }
};
exports.validateReferralCode = validateReferralCode;
/**
 * GET /api/referrals/me — solo DOCTOR autenticado.
 * Devuelve código de invitación (lo crea en BD si aún no existía) y URL lista para compartir.
 */
const getMyReferralInfo = async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    try {
        if (!req.user || req.user.role !== 'DOCTOR') {
            return res.status(403).json({ message: 'Solo disponible para profesionales de la salud' });
        }
        const doctorId = await resolveDoctorIdFromAuth(req);
        if (!doctorId) {
            return res.status(404).json({ message: 'Perfil de doctor no encontrado' });
        }
        let doctor = await database_1.default.doctor.findUnique({
            where: { id: doctorId },
            select: { referralCode: true, referralCreditPercent: true, referralFreeMonthsGranted: true },
        });
        if (!((_a = doctor === null || doctor === void 0 ? void 0 : doctor.referralCode) === null || _a === void 0 ? void 0 : _a.trim())) {
            const code = await (0, referral_utils_1.generateUniqueReferralCode)(database_1.default);
            try {
                await database_1.default.doctor.update({
                    where: { id: doctorId },
                    data: { referralCode: code },
                });
                doctor = {
                    referralCode: code,
                    referralCreditPercent: (_b = doctor === null || doctor === void 0 ? void 0 : doctor.referralCreditPercent) !== null && _b !== void 0 ? _b : 0,
                    referralFreeMonthsGranted: (_c = doctor === null || doctor === void 0 ? void 0 : doctor.referralFreeMonthsGranted) !== null && _c !== void 0 ? _c : 0,
                };
            }
            catch (_g) {
                // Carrera: otro request pudo asignar código; re-leer
                doctor = await database_1.default.doctor.findUnique({
                    where: { id: doctorId },
                    select: { referralCode: true, referralCreditPercent: true, referralFreeMonthsGranted: true },
                });
                if (!((_d = doctor === null || doctor === void 0 ? void 0 : doctor.referralCode) === null || _d === void 0 ? void 0 : _d.trim())) {
                    throw new Error('No se pudo persistir el código de referido');
                }
            }
        }
        const code = doctor.referralCode;
        const base = (0, referral_utils_1.referralRegisterBaseUrl)(env_1.env.FRONTEND_URL);
        const registerUrl = `${base}/register?type=health_staff&ref=${encodeURIComponent(code)}`;
        const qualifiedReferralsCount = await database_1.default.referralConversion.count({
            where: { referrerDoctorId: doctorId },
        });
        const subscription = await database_1.default.subscription.findUnique({
            where: { doctorId },
            select: { freeMonthUsed: true, resumeDate: true, endDate: true },
        });
        const referralFreeMonthsGranted = (_e = doctor.referralFreeMonthsGranted) !== null && _e !== void 0 ? _e : 0;
        const referralBenefitPeriodHint = buildReferralProgramBenefitHint({
            referralFreeMonthsGranted: referralFreeMonthsGranted,
            subscription,
        });
        const credit = (_f = doctor.referralCreditPercent) !== null && _f !== void 0 ? _f : 0;
        const mod = credit % 100;
        const referralsNeededApproxForNextMonth = mod === 0 && credit < 100 ? 5 : mod === 0 && credit >= 100 ? 0 : Math.ceil((100 - mod) / 20);
        return res.json({
            referralCode: code,
            referralCreditPercent: credit,
            referralFreeMonthsGranted,
            qualifiedReferralsCount,
            referralsNeededApproxForNextMonth,
            registerUrl,
            referralBenefitPeriodHint,
        });
    }
    catch (e) {
        console.error('getMyReferralInfo:', e);
        return res.status(500).json({ message: 'Error al obtener datos de referidos' });
    }
};
exports.getMyReferralInfo = getMyReferralInfo;
const emailInviteRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** POST /api/referrals/send-invite-email — DOCTOR; envía HTML profesional al correo del colega. */
const sendReferralInviteEmail = async (req, res) => {
    var _a, _b;
    try {
        if (!req.user || req.user.role !== 'DOCTOR') {
            return res.status(403).json({ message: 'Solo disponible para profesionales de la salud' });
        }
        const to = typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.to) === 'string' ? req.body.to.trim().toLowerCase() : '';
        if (!to || !emailInviteRe.test(to)) {
            return res.status(400).json({ message: 'Correo del destinatario inválido' });
        }
        const doctorId = await resolveDoctorIdFromAuth(req);
        if (!doctorId) {
            return res.status(404).json({ message: 'Perfil de doctor no encontrado' });
        }
        const [userRow, doctorRow] = await Promise.all([
            database_1.default.user.findUnique({
                where: { id: req.user.userId },
                select: { firstName: true, lastName: true, email: true },
            }),
            database_1.default.doctor.findUnique({
                where: { id: doctorId },
                select: { referralCode: true },
            }),
        ]);
        if (!userRow) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        const ownEmail = (userRow.email || '').trim().toLowerCase();
        if (ownEmail && to === ownEmail) {
            return res.status(400).json({ message: 'Indica el correo de tu colega, no el tuyo' });
        }
        let code = (_b = doctorRow === null || doctorRow === void 0 ? void 0 : doctorRow.referralCode) === null || _b === void 0 ? void 0 : _b.trim();
        if (!code) {
            code = await (0, referral_utils_1.generateUniqueReferralCode)(database_1.default);
            await database_1.default.doctor.update({
                where: { id: doctorId },
                data: { referralCode: code },
            });
        }
        const base = (0, referral_utils_1.referralRegisterBaseUrl)(env_1.env.FRONTEND_URL);
        const registerUrl = `${base}/register?type=health_staff&ref=${encodeURIComponent(code)}`;
        const first = (userRow.firstName || '').trim();
        const last = (userRow.lastName || '').trim();
        const inviterDisplayName = [first, last].filter(Boolean).join(' ') || userRow.email || 'Un colega';
        const emailService = notification_service_1.EmailService.getInstance();
        const ok = await emailService.sendReferralInvitationEmail(to, {
            inviterDisplayName,
            registerUrl,
            referralCode: code,
        });
        if (!ok) {
            return res
                .status(502)
                .json({ message: 'No se pudo enviar el correo. Revisa la configuración SMTP o inténtalo más tarde.' });
        }
        return res.json({ success: true });
    }
    catch (e) {
        console.error('sendReferralInviteEmail:', e);
        return res.status(500).json({ message: 'Error al enviar la invitación' });
    }
};
exports.sendReferralInviteEmail = sendReferralInviteEmail;
/**
 * GET /api/referrals/history — colegas con tu código; lista plana (fecha en columna Alta).
 * Cada 5 acreditaciones consecutivas (por fecha de acreditación) = 1 mes sin cargo; se devuelve en `milestones`.
 */
const getReferralHistory = async (req, res) => {
    var _a, _b;
    try {
        if (!req.user || req.user.role !== 'DOCTOR') {
            return res.status(403).json({ message: 'Solo disponible para profesionales de la salud' });
        }
        const doctorId = await resolveDoctorIdFromAuth(req);
        if (!doctorId) {
            return res.status(404).json({ message: 'Perfil de doctor no encontrado' });
        }
        const [me, qualifiedReferrals] = await Promise.all([
            database_1.default.doctor.findUnique({
                where: { id: doctorId },
                select: { referralCreditPercent: true, referralFreeMonthsGranted: true },
            }),
            database_1.default.referralConversion.count({ where: { referrerDoctorId: doctorId } }),
        ]);
        const referred = await database_1.default.doctor.findMany({
            where: { referrerDoctorId: doctorId },
            select: {
                id: true,
                accessType: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        createdAt: true,
                    },
                },
                subscription: { select: { status: true, paypalSubscriptionId: true } },
                referralConversionReceived: {
                    select: { id: true, createdAt: true, percentGranted: true },
                },
            },
            orderBy: { user: { createdAt: 'desc' } },
        });
        const rows = referred.map((d) => {
            var _a, _b, _c;
            const u = d.user;
            const registeredAt = u.createdAt;
            const fn = (u.firstName || '').trim();
            const ln = (u.lastName || '').trim();
            const displayName = [fn, ln].filter(Boolean).join(' ') || maskEmail(u.email);
            const conv = d.referralConversionReceived;
            const credited = !!conv;
            const subSt = ((_b = (_a = d.subscription) === null || _a === void 0 ? void 0 : _a.status) === null || _b === void 0 ? void 0 : _b.trim()) || null;
            const paypalId = (_c = d.subscription) === null || _c === void 0 ? void 0 : _c.paypalSubscriptionId;
            const billingCycleHint = credited && conv
                ? `+${conv.percentGranted}% sumado al 100%. 5 acreditaciones = 1 mes sin cargo.`
                : buildPendingReferralNote({
                    subscriptionStatus: subSt,
                    paypalSubscriptionId: paypalId,
                    accessType: d.accessType,
                });
            return {
                referredDoctorId: d.id,
                displayName,
                emailMasked: maskEmail(u.email),
                registeredAt: registeredAt.toISOString(),
                subscriptionStatus: subSt,
                discountStatus: credited ? 'credited' : 'pending',
                percentGranted: conv ? conv.percentGranted : null,
                creditedAt: conv ? conv.createdAt.toISOString() : null,
                billingCycleHint,
            };
        });
        const items = [...rows].sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
        const creditedAsc = rows
            .filter((r) => r.discountStatus === 'credited' && !!r.creditedAt)
            .sort((a, b) => new Date(a.creditedAt).getTime() - new Date(b.creditedAt).getTime());
        const REFERRALS_PER_FREE_MONTH = 5;
        const milestones = [];
        for (let i = 0; i + REFERRALS_PER_FREE_MONTH <= creditedAsc.length; i += REFERRALS_PER_FREE_MONTH) {
            const chunk = creditedAsc.slice(i, i + REFERRALS_PER_FREE_MONTH);
            const fifthAt = new Date(chunk[REFERRALS_PER_FREE_MONTH - 1].creditedAt);
            const awardedMonthLabelRaw = fifthAt.toLocaleDateString('es-MX', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
            });
            const awardedMonthLabel = awardedMonthLabelRaw.charAt(0).toUpperCase() + awardedMonthLabelRaw.slice(1);
            // Mismo orden visual que la tabla (items): fecha de alta descendente
            const chunkByAltaDesc = [...chunk].sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
            milestones.push({
                freeMonthIndex: milestones.length + 1,
                awardedMonthLabel,
                referrers: chunkByAltaDesc.map((r) => ({ displayName: r.displayName, emailMasked: r.emailMasked })),
            });
        }
        const summary = {
            qualifiedReferrals,
            creditBalancePercent: (_a = me === null || me === void 0 ? void 0 : me.referralCreditPercent) !== null && _a !== void 0 ? _a : 0,
            freeMonthsGrantedAuto: (_b = me === null || me === void 0 ? void 0 : me.referralFreeMonthsGranted) !== null && _b !== void 0 ? _b : 0,
            creditPercentPerReferral: 20,
            creditsPerFreeMonth: 100,
        };
        return res.json({ items, milestones, summary });
    }
    catch (e) {
        console.error('getReferralHistory:', e);
        return res.status(500).json({ message: 'Error al obtener historial de referidos' });
    }
};
exports.getReferralHistory = getReferralHistory;
