"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUser = exports.updateProfilePicture = exports.verifyTwoFactorRecovery = exports.sendTwoFactorRecoveryEmail = exports.verifyTwoFactor = exports.setupTwoFactor = exports.login = exports.register = void 0;
const database_1 = __importDefault(require("../config/database"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt_utils_1 = require("../utils/jwt.utils");
const env_1 = require("../config/env");
const validation_utils_1 = require("../utils/validation.utils");
const error_utils_1 = require("../utils/error.utils");
const patientPortal_utils_1 = require("../utils/patientPortal.utils");
const notification_service_1 = require("../services/notification.service");
const consentPdf_service_1 = require("../services/consentPdf.service");
const file_utils_1 = require("../utils/file.utils");
const promo_utils_1 = require("../utils/promo.utils");
const referral_utils_1 = require("../utils/referral.utils");
const referralRegistration_utils_1 = require("../utils/referralRegistration.utils");
const referral_service_1 = require("../services/referral.service");
const affiliate_constants_1 = require("../constants/affiliate.constants");
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const crypto_1 = __importDefault(require("crypto"));
const securityLoginAudit_service_1 = require("../services/securityLoginAudit.service");
const TWO_FACTOR_TOKEN_EXPIRY = '10m';
const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
/** Data URL desde el registro (jpg/png/webp). null si no hay foto o formato inválido. */
function parseDoctorRegistrationProfilePictureDataUrl(raw) {
    if (raw == null || typeof raw !== 'string')
        return null;
    const s = raw.trim();
    if (!s)
        return null;
    const m = /^data:image\/(jpeg|jpg|png|webp);base64,([\s\S]+)$/i.exec(s);
    if (!m)
        return null;
    const kind = m[1].toLowerCase();
    const mimetype = kind === 'png' ? 'image/png' : kind === 'webp' ? 'image/webp' : 'image/jpeg';
    const ext = kind === 'png' ? 'png' : kind === 'webp' ? 'webp' : 'jpg';
    let buffer;
    try {
        buffer = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
    }
    catch (_a) {
        return null;
    }
    if (!buffer.length)
        return null;
    if (buffer.length > MAX_PROFILE_PHOTO_BYTES) {
        throw new error_utils_1.AppError('La foto de perfil supera 5MB', 400);
    }
    return { buffer, mimetype, ext };
}
async function uploadDoctorRegistrationProfilePicture(userId, raw) {
    try {
        const parsed = parseDoctorRegistrationProfilePictureDataUrl(raw);
        if (!parsed)
            return null;
        const { buffer, mimetype, ext } = parsed;
        const fakeFile = {
            fieldname: 'profilePicture',
            originalname: `profile.${ext}`,
            encoding: '7bit',
            mimetype,
            buffer,
            size: buffer.length,
            destination: '',
            filename: '',
            path: '',
            stream: null,
        };
        const { url } = await (0, file_utils_1.uploadToS3)(fakeFile, 'doctor-profile-photos', userId);
        return url;
    }
    catch (e) {
        if (e instanceof error_utils_1.AppError)
            throw e;
        console.error('Registro doctor: no se pudo subir la foto de perfil a S3:', e);
        return null;
    }
}
function clientIp(req) {
    var _a;
    const x = req.headers['x-forwarded-for'];
    if (typeof x === 'string')
        return (_a = x.split(',')[0]) === null || _a === void 0 ? void 0 : _a.trim();
    return req.socket.remoteAddress || undefined;
}
function clientUa(req) {
    const ua = req.headers['user-agent'];
    return typeof ua === 'string' ? ua : undefined;
}
const TWO_FACTOR_RECOVERY_EXPIRY_MS = 10 * 60 * 1000;
const buildAuthResponse = async (user) => {
    let doctorId = null;
    let patientId = null;
    let profilePictureUrl = null;
    if (user.role === 'DOCTOR') {
        try {
            const doctorProfile = await database_1.default.doctor.findUnique({ where: { userId: user.id } });
            if (doctorProfile) {
                doctorId = doctorProfile.id;
                profilePictureUrl = doctorProfile.profilePictureUrl || null;
            }
            // Usuario DOCTOR que también es paciente: incluir patientId para contexto dual
            const patientProfile = await database_1.default.patient.findUnique({ where: { userId: user.id } });
            if (patientProfile)
                patientId = patientProfile.id;
        }
        catch (doctorError) {
            console.error('Error al buscar perfil de doctor:', doctorError);
        }
    }
    else if (user.role === 'PATIENT') {
        try {
            const patientProfile = await database_1.default.patient.findUnique({ where: { userId: user.id } });
            if (patientProfile) {
                patientId = patientProfile.id;
                profilePictureUrl = patientProfile.profilePictureUrl || null;
            }
        }
        catch (patientError) {
            console.error('Error al buscar perfil de paciente:', patientError);
        }
    }
    else if (user.role === 'ASISTENTE' || user.role === 'ADMIN') {
        profilePictureUrl = user.profilePictureUrl || null;
    }
    // Capacidad "afiliado": cualquier usuario (paciente/doctor/etc.) puede además tener
    // un perfil de afiliado. No depende del rol, sino de la existencia del perfil.
    let affiliateProfileId = null;
    try {
        const affiliateProfile = await database_1.default.affiliateProfile.findUnique({
            where: { userId: user.id },
            select: { id: true }
        });
        if (affiliateProfile)
            affiliateProfileId = affiliateProfile.id;
    }
    catch (affiliateError) {
        console.error('Error al buscar perfil de afiliado:', affiliateError);
    }
    let clinicalHistoryPortalEnabled;
    if (user.role === 'PATIENT' && patientId) {
        clinicalHistoryPortalEnabled = await (0, patientPortal_utils_1.patientHasClinicalHistoryPortalAccess)(patientId);
    }
    const tokenPayload = { userId: user.id, role: user.role };
    if (doctorId)
        tokenPayload.doctorId = doctorId;
    if (patientId)
        tokenPayload.patientId = patientId;
    const token = (0, jwt_utils_1.generateToken)(tokenPayload);
    return {
        token,
        user: Object.assign({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, doctorId,
            patientId,
            profilePictureUrl, hasAffiliateProfile: !!affiliateProfileId, affiliateProfileId }, (clinicalHistoryPortalEnabled !== undefined && { clinicalHistoryPortalEnabled }))
    };
};
const getTwoFactorUserFromRequest = async (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        throw new error_utils_1.AppError('Token de verificación requerido.', 401);
    }
    let payload;
    try {
        payload = (0, jwt_utils_1.verifyToken)(token);
    }
    catch (error) {
        throw new error_utils_1.AppError('Token inválido o expirado.', 403);
    }
    if (!(payload === null || payload === void 0 ? void 0 : payload.twoFactorPending)) {
        throw new error_utils_1.AppError('Token inválido para verificación 2FA.', 403);
    }
    const user = await database_1.default.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
        throw new error_utils_1.AppError('Usuario no encontrado.', 404);
    }
    return { user, payload };
};
const register = async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    try {
        (0, validation_utils_1.validateRegister)(req.body);
        const { email, password, firstName, lastName, role, phone } = req.body;
        const rawPromoCode = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.promoCode) ? String(req.body.promoCode) : '';
        const promoCode = rawPromoCode ? (0, promo_utils_1.normalizePromoCode)(rawPromoCode) : '';
        // Verificar si el usuario ya existe
        const existingUser = await database_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new error_utils_1.AppError('El usuario ya existe', 400);
        }
        let promo = null;
        if (role === 'DOCTOR' && promoCode) {
            promo = await (0, promo_utils_1.getPromoCodeOrThrow)(promoCode);
        }
        // Encriptar contraseña
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Crear usuario
        const user = await database_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                role,
                phone
            }
        });
        // Si el rol es DOCTOR, crear el perfil Doctor y la suscripción asociada
        if (role === 'DOCTOR') {
            let registrationProfilePictureUrl = '';
            try {
                const uploadedUrl = await uploadDoctorRegistrationProfilePicture(user.id, req.body.profilePictureBase64);
                if (uploadedUrl)
                    registrationProfilePictureUrl = uploadedUrl;
            }
            catch (e) {
                if (e instanceof error_utils_1.AppError)
                    throw e;
                console.error('Registro doctor: error inesperado con foto de perfil', e);
            }
            let referrerDoctorId;
            const rawRef = (_c = (_b = req.body) === null || _b === void 0 ? void 0 : _b.referrerInviteCode) !== null && _c !== void 0 ? _c : (_d = req.body) === null || _d === void 0 ? void 0 : _d.ref;
            const normalizedRef = (0, referral_utils_1.normalizeReferralCode)(typeof rawRef === 'string' ? rawRef : '');
            if (normalizedRef) {
                const referrer = await database_1.default.doctor.findFirst({
                    where: { referralCode: normalizedRef },
                    select: { id: true, userId: true },
                });
                if (referrer && referrer.userId !== user.id) {
                    referrerDoctorId = referrer.id;
                }
            }
            // Código de afiliado comercial (comisionista). Mutuamente excluyente con referido-doctor.
            const rawAffiliateCode = (_f = (_e = req.body) === null || _e === void 0 ? void 0 : _e.affiliateCode) !== null && _f !== void 0 ? _f : (_g = req.body) === null || _g === void 0 ? void 0 : _g.aff;
            const normalizedAffiliateCode = typeof rawAffiliateCode === 'string' ? rawAffiliateCode.trim().toUpperCase() : '';
            let affiliateForReferral = null;
            if (normalizedAffiliateCode) {
                if (referrerDoctorId) {
                    throw new error_utils_1.AppError('No puedes usar un código de afiliado y un código de referido al mismo tiempo.', 400);
                }
                const affiliate = await database_1.default.affiliateProfile.findUnique({
                    where: { affiliateCode: normalizedAffiliateCode },
                    select: {
                        id: true,
                        affiliateCode: true,
                        status: true,
                        userId: true,
                        user: { select: { email: true } }
                    }
                });
                if (!affiliate || affiliate.status !== 'ACTIVE') {
                    throw new error_utils_1.AppError('El código de afiliado no es válido o está inactivo.', 400);
                }
                if (affiliate.userId === user.id ||
                    (((_h = affiliate.user) === null || _h === void 0 ? void 0 : _h.email) || '').toLowerCase() === String(email).toLowerCase()) {
                    throw new error_utils_1.AppError('Un afiliado no puede referirse a sí mismo.', 400);
                }
                affiliateForReferral = { id: affiliate.id, affiliateCode: affiliate.affiliateCode };
            }
            const ownReferralCode = await (0, referral_utils_1.generateUniqueReferralCode)(database_1.default);
            // Crear perfil Doctor (rellenar campos con datos reales si están en el formulario)
            const doctorProfile = await database_1.default.doctor.create({
                data: {
                    userId: user.id,
                    licenseNumber: req.body.licenseNumber || '',
                    specialization: req.body.specialty || '',
                    officeAddress: req.body.officeAddress || '',
                    officePhone: req.body.phone || '',
                    professionalTitle: req.body.professionalTitle || '',
                    taxId: req.body.taxId || '',
                    taxName: req.body.taxName || '',
                    taxAddress: req.body.taxStreet || '',
                    taxPostalCode: req.body.taxZip || null,
                    taxRegime: req.body.taxRegime || null,
                    taxCertificateUrl: '', // Puedes agregar lógica de subida de archivo si aplica
                    dataConsent: !!req.body.acceptPrivacy,
                    termsAccepted: !!req.body.acceptTerms,
                    termsAcceptedAt: new Date(),
                    accessType: (promo === null || promo === void 0 ? void 0 : promo.type) === 'LIFETIME' ? 'lifetime' : promo ? 'trial' : 'subscription',
                    trialStart: promo && promo.type !== 'LIFETIME' ? new Date() : null,
                    trialEnd: promo && promo.type !== 'LIFETIME'
                        ? new Date(Date.now() + (0, promo_utils_1.getPromoDurationDays)(promo.type) * 24 * 60 * 60 * 1000)
                        : null,
                    profilePictureUrl: registrationProfilePictureUrl,
                    referralCode: ownReferralCode,
                    referrerDoctorId: referrerDoctorId !== null && referrerDoctorId !== void 0 ? referrerDoctorId : undefined,
                }
            });
            const doctorId = doctorProfile.id;
            // Registrar la relación afiliado→doctor (si vino un código de afiliado válido).
            // La comisión solo se generará cuando PayPal confirme el primer pago (vía webhook).
            if (affiliateForReferral) {
                try {
                    await database_1.default.affiliateReferral.create({
                        data: {
                            affiliateId: affiliateForReferral.id,
                            doctorUserId: user.id,
                            doctorEmail: email,
                            doctorName: `${firstName} ${lastName}`.trim() || null,
                            affiliateCodeUsed: affiliateForReferral.affiliateCode,
                            trialDaysGranted: affiliate_constants_1.DEFAULT_AFFILIATE_TRIAL_DAYS,
                            status: 'REGISTERED'
                        }
                    });
                }
                catch (affErr) {
                    // No romper el registro del doctor si la vinculación con el afiliado falla.
                    console.error('Error registrando AffiliateReferral:', affErr);
                }
            }
            const { paypalSubscriptionId, paypalPlanId } = req.body;
            const now = new Date();
            if (paypalSubscriptionId) {
                // Con PayPal: primer ciclo = días promo/referido + 15 días de uso gratuito plataforma (cobro desde día 16), salvo LIFETIME. Ver computePayPalFirstCycleDays.
                const { totalDays } = (0, referralRegistration_utils_1.computePayPalFirstCycleDays)(promo, referrerDoctorId, {
                    affiliateGrantsFreeMonth: !!affiliateForReferral
                });
                const endDate = new Date(Date.now() + totalDays * 24 * 60 * 60 * 1000);
                const tx = [];
                if (promo) {
                    tx.push(database_1.default.promoCode.update({
                        where: { id: promo.id },
                        data: { redemptionCount: { increment: 1 } }
                    }), database_1.default.promoRedemption.create({
                        data: { promoCodeId: promo.id, doctorId }
                    }));
                }
                tx.push(database_1.default.subscription.create({
                    data: {
                        doctorId,
                        paypalSubscriptionId,
                        paypalPlanId: paypalPlanId || '',
                        status: 'ACTIVE',
                        startDate: now,
                        endDate,
                        createdAt: now,
                        updatedAt: now
                    }
                }));
                await database_1.default.$transaction(tx);
                await (0, referral_service_1.applyReferralRewardIfEligible)(doctorId);
            }
            else if (promo && promo.type === 'LIFETIME') {
                // Solo LIFETIME sin PayPal
                const endDate = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
                await database_1.default.$transaction([
                    database_1.default.promoCode.update({
                        where: { id: promo.id },
                        data: { redemptionCount: { increment: 1 } }
                    }),
                    database_1.default.promoRedemption.create({
                        data: { promoCodeId: promo.id, doctorId }
                    }),
                    database_1.default.subscription.create({
                        data: {
                            doctorId,
                            paypalSubscriptionId: '',
                            paypalPlanId: '',
                            status: 'ACTIVE',
                            startDate: now,
                            endDate,
                            createdAt: now,
                            updatedAt: now
                        }
                    })
                ]);
                await (0, referral_service_1.applyReferralRewardIfEligible)(doctorId);
            }
            else if (promo) {
                // Código de trial (1M/3M) sin PayPal: rechazar (deberían haber registrado PayPal)
                throw new error_utils_1.AppError('Con tu código promocional debes registrar tu método de pago con PayPal. No se te cobrará durante el periodo gratuito.', 400);
            }
            // Generar token con doctorId incluido
            const tokenPayload = { userId: user.id, role: user.role, doctorId };
            const token = (0, jwt_utils_1.generateToken)(tokenPayload);
            // Generar PDFs de consentimiento, guardar en ConsentHistory y enviar a legal@qlinexa360.com
            const signature = (_j = req.body.signature) === null || _j === void 0 ? void 0 : _j.trim();
            if (signature && req.body.acceptPrivacy && req.body.acceptTerms && req.body.acceptContract) {
                try {
                    const fullName = `${user.firstName} ${user.lastName}`.trim();
                    const consentDate = new Date();
                    const pdfResults = await consentPdf_service_1.ConsentPdfService.generateConsentPdfs({
                        userId: user.id,
                        email: user.email,
                        fullName,
                        signature,
                        role: user.role,
                        ipAddress: req.ip || req.socket.remoteAddress || 'IP no disponible',
                        signedAt: consentDate
                    });
                    await database_1.default.consentHistory.createMany({
                        data: [
                            { userId: user.id, type: 'PRIVACY_POLICY', version: '1.0', content: 'Aviso de Privacidad de Qlinexa360', acceptedAt: consentDate, pdfUrl: pdfResults.PRIVACY_POLICY.url },
                            { userId: user.id, type: 'TERMS_OF_SERVICE', version: '1.0', content: 'Términos de Uso de Qlinexa360', acceptedAt: consentDate, pdfUrl: pdfResults.TERMS_OF_SERVICE.url },
                            { userId: user.id, type: 'PLATFORM_CONTRACT', version: '1.0', content: 'Contrato de Uso de Plataforma de Qlinexa360', acceptedAt: consentDate, pdfUrl: pdfResults.PLATFORM_CONTRACT.url },
                            { userId: user.id, type: 'DIGITAL_SIGNATURE', version: '1.0', content: `Firma digital: ${signature}`, acceptedAt: consentDate }
                        ]
                    });
                    const consentEmailPayload = {
                        fullName,
                        email: user.email,
                        role: user.role,
                        pdfBuffers: {
                            aviso: pdfResults.PRIVACY_POLICY.buffer,
                            terminos: pdfResults.TERMS_OF_SERVICE.buffer,
                            contrato: pdfResults.PLATFORM_CONTRACT.buffer
                        }
                    };
                    await Promise.all([
                        notification_service_1.NotificationService.sendNewUserConsentToUser(consentEmailPayload),
                        notification_service_1.NotificationService.sendNewUserConsentToLegal(consentEmailPayload)
                    ]);
                }
                catch (consentError) {
                    console.error('Error generando consentimientos o enviando a legal:', consentError);
                    // No fallar el registro si falla
                }
            }
            // Enviar correo de bienvenida
            try {
                await notification_service_1.NotificationService.sendWelcomeEmail(user.email, user.firstName, user.lastName, user.role);
            }
            catch (emailError) {
                console.error('Error enviando correo de bienvenida:', emailError);
                // No fallar el registro si el correo falla
            }
            res.status(201).json({
                message: 'Usuario registrado exitosamente',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    doctorId
                }
            });
        }
        else {
            // Generar token sin doctorId para otros roles
            const token = (0, jwt_utils_1.generateToken)({ userId: user.id, role: user.role });
            // Enviar correo de bienvenida
            try {
                await notification_service_1.NotificationService.sendWelcomeEmail(user.email, user.firstName, user.lastName, user.role);
            }
            catch (emailError) {
                console.error('Error enviando correo de bienvenida:', emailError);
                // No fallar el registro si el correo falla
            }
            res.status(201).json({
                message: 'Usuario registrado exitosamente',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role
                }
            });
        }
    }
    catch (error) {
        if (!(error instanceof error_utils_1.AppError)) {
            console.error('Error inesperado en register:', error);
        }
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al registrar usuario', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.register = register;
const login = async (req, res) => {
    var _a, _b;
    try {
        console.log('=== INICIO DE LOGIN ===');
        console.log('Email recibido:', (_a = req.body) === null || _a === void 0 ? void 0 : _a.email);
        (0, validation_utils_1.validateLogin)(req.body);
        const { email, password } = req.body;
        // Buscar usuario
        console.log('Buscando usuario con email:', email);
        const user = await database_1.default.user.findUnique({ where: { email } });
        if (!user) {
            console.log('Usuario no encontrado');
            void (0, securityLoginAudit_service_1.recordSecurityLoginAudit)({
                email,
                success: false,
                ip: clientIp(req),
                userAgent: clientUa(req),
            });
            throw new error_utils_1.AppError('Credenciales inválidas', 401);
        }
        console.log('Usuario encontrado:', {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName
        });
        // Verificar contraseña
        console.log('Verificando contraseña...');
        const validPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!validPassword) {
            console.log('Contraseña inválida');
            void (0, securityLoginAudit_service_1.recordSecurityLoginAudit)({
                userId: user.id,
                email,
                success: false,
                ip: clientIp(req),
                userAgent: clientUa(req),
            });
            throw new error_utils_1.AppError('Credenciales inválidas', 401);
        }
        console.log('Contraseña válida');
        void (0, securityLoginAudit_service_1.recordSecurityLoginAudit)({
            userId: user.id,
            email,
            success: true,
            ip: clientIp(req),
            userAgent: clientUa(req),
        });
        // Bypass 2FA solo en desarrollo cuando DISABLE_2FA_DEV=true (usuarios con email inexistente)
        const isDevBypass = env_1.env.NODE_ENV === 'development' && env_1.env.DISABLE_2FA_DEV;
        if (isDevBypass) {
            const authResponse = await buildAuthResponse(user);
            res.json(Object.assign({ message: 'Login exitoso (2FA deshabilitado en desarrollo)' }, authResponse));
            return;
        }
        // Si envía token de "dispositivo de confianza" válido para este usuario, omitir 2FA
        const trustedDeviceToken = req.body.trustedDeviceToken;
        if (trustedDeviceToken) {
            const decoded = (0, jwt_utils_1.verifyTrustedDeviceToken)(trustedDeviceToken);
            if (decoded && decoded.userId === user.id) {
                const authResponse = await buildAuthResponse(user);
                res.json(Object.assign({ message: 'Login exitoso (dispositivo de confianza)' }, authResponse));
                return;
            }
        }
        const requiresSetup = !user.twoFactorEnabled || !user.twoFactorSecret;
        const tempToken = (0, jwt_utils_1.generateTwoFactorToken)({ userId: user.id, role: user.role }, TWO_FACTOR_TOKEN_EXPIRY);
        res.json({
            message: 'Verificación 2FA requerida',
            requiresTwoFactor: true,
            twoFactorSetupRequired: requiresSetup,
            tempToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error('=== ERROR EN LOGIN ===');
        console.error('Tipo de error:', (_b = error === null || error === void 0 ? void 0 : error.constructor) === null || _b === void 0 ? void 0 : _b.name);
        console.error('Mensaje:', error === null || error === void 0 ? void 0 : error.message);
        console.error('Stack:', error === null || error === void 0 ? void 0 : error.stack);
        console.error('Error completo:', error);
        const handled = error instanceof error_utils_1.AppError
            ? error
            : new error_utils_1.AppError((error === null || error === void 0 ? void 0 : error.message) || 'Error al iniciar sesión', 500);
        console.log('Respondiendo con:', handled.statusCode, handled.message);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.login = login;
const setupTwoFactor = async (req, res) => {
    try {
        const { user } = await getTwoFactorUserFromRequest(req);
        const secret = speakeasy_1.default.generateSecret({
            name: `Qlinexa360 (${user.email})`
        });
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                twoFactorSecret: secret.base32,
                twoFactorEnabled: false,
                twoFactorVerifiedAt: null
            }
        });
        const qrCodeDataUrl = secret.otpauth_url
            ? await qrcode_1.default.toDataURL(secret.otpauth_url)
            : null;
        res.json({
            message: 'Configuración 2FA iniciada',
            otpauthUrl: secret.otpauth_url,
            qrCodeDataUrl,
            secret: secret.base32
        });
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al iniciar 2FA', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.setupTwoFactor = setupTwoFactor;
const verifyTwoFactor = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            throw new error_utils_1.AppError('Código 2FA requerido.', 400);
        }
        const { user } = await getTwoFactorUserFromRequest(req);
        if (!user.twoFactorSecret) {
            throw new error_utils_1.AppError('Configuración 2FA no encontrada.', 400);
        }
        const isValid = speakeasy_1.default.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token,
            window: 1
        });
        if (!isValid) {
            throw new error_utils_1.AppError('Código 2FA inválido.', 400);
        }
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                twoFactorEnabled: true,
                twoFactorVerifiedAt: new Date(),
                twoFactorRecoveryToken: null,
                twoFactorRecoveryExpiresAt: null
            }
        });
        const authResponse = await buildAuthResponse(user);
        const rememberDevice = req.body.rememberDevice === true || req.body.rememberDevice === 'true';
        const response = Object.assign({ message: '2FA verificado' }, authResponse);
        if (rememberDevice) {
            response.trustedDeviceToken = (0, jwt_utils_1.generateTrustedDeviceToken)(user.id);
        }
        void (0, securityLoginAudit_service_1.recordSecurityLoginAudit)({
            userId: user.id,
            email: user.email,
            success: true,
            ip: clientIp(req),
            userAgent: clientUa(req),
        });
        res.json(response);
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al verificar 2FA', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.verifyTwoFactor = verifyTwoFactor;
const sendTwoFactorRecoveryEmail = async (req, res) => {
    try {
        const { user } = await getTwoFactorUserFromRequest(req);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const tokenHash = crypto_1.default.createHash('sha256').update(code).digest('hex');
        const expiresAt = new Date(Date.now() + TWO_FACTOR_RECOVERY_EXPIRY_MS);
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                twoFactorRecoveryToken: tokenHash,
                twoFactorRecoveryExpiresAt: expiresAt
            }
        });
        const notificationService = notification_service_1.NotificationService.getInstance();
        const emailSent = await notificationService.sendTwoFactorRecoveryEmail(user.email, user.firstName, code);
        if (!emailSent) {
            throw new error_utils_1.AppError('No se pudo enviar el correo de recuperación.', 500);
        }
        res.json({ message: 'Código de recuperación enviado.' });
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al enviar correo de recuperación', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.sendTwoFactorRecoveryEmail = sendTwoFactorRecoveryEmail;
const verifyTwoFactorRecovery = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            throw new error_utils_1.AppError('Código de recuperación requerido.', 400);
        }
        const { user } = await getTwoFactorUserFromRequest(req);
        if (!user.twoFactorRecoveryToken || !user.twoFactorRecoveryExpiresAt) {
            throw new error_utils_1.AppError('No hay un código de recuperación activo.', 400);
        }
        if (user.twoFactorRecoveryExpiresAt < new Date()) {
            throw new error_utils_1.AppError('El código de recuperación expiró.', 400);
        }
        const tokenHash = crypto_1.default.createHash('sha256').update(code).digest('hex');
        if (tokenHash !== user.twoFactorRecoveryToken) {
            throw new error_utils_1.AppError('Código de recuperación inválido.', 400);
        }
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
                twoFactorVerifiedAt: null,
                twoFactorRecoveryToken: null,
                twoFactorRecoveryExpiresAt: null
            }
        });
        const tempToken = (0, jwt_utils_1.generateTwoFactorToken)({ userId: user.id, role: user.role }, TWO_FACTOR_TOKEN_EXPIRY);
        res.json({
            message: 'Código verificado. Configura 2FA nuevamente.',
            requiresTwoFactorSetup: true,
            tempToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    }
    catch (error) {
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al validar recuperación', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.verifyTwoFactorRecovery = verifyTwoFactorRecovery;
// =================================================================
// ACTUALIZAR FOTO DE PERFIL
// =================================================================
const updateProfilePicture = async (req, res) => {
    try {
        console.log('=== INICIO updateProfilePicture ===');
        console.log('req.user:', req.user ? { userId: req.user.userId, role: req.user.role } : 'null');
        console.log('req.file:', req.file ? { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size } : 'null');
        console.log('req.body:', req.body);
        if (!req.user) {
            console.error('Usuario no autenticado');
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }
        if (!req.file) {
            console.error('No se recibió ningún archivo');
            return res.status(400).json({ message: 'No se ha subido ningún archivo. Por favor selecciona una imagen.' });
        }
        // Validar que sea una imagen
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            throw new error_utils_1.AppError('Tipo de archivo no permitido. Solo se permiten imágenes JPG, PNG y WEBP', 400);
        }
        // Validar tamaño (máximo 5MB para fotos de perfil)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (req.file.size > maxSize) {
            throw new error_utils_1.AppError('El archivo es demasiado grande. Máximo 5MB', 400);
        }
        // Subir imagen a S3
        console.log('Subiendo imagen a S3...');
        const category = req.user.role === 'DOCTOR'
            ? 'doctor-profile-photos'
            : req.user.role === 'PATIENT'
                ? 'patient-profile-photos'
                : req.user.role === 'ADMIN'
                    ? 'admin-profile-photos'
                    : 'assistant-profile-photos';
        console.log('Category:', category);
        console.log('UserId:', req.user.userId);
        let url;
        try {
            const uploadResult = await (0, file_utils_1.uploadToS3)(req.file, category, req.user.userId);
            url = uploadResult.url;
            console.log('Imagen subida a S3 exitosamente. URL:', url);
        }
        catch (s3Error) {
            console.error('Error subiendo a S3:', s3Error);
            throw new error_utils_1.AppError(`Error al subir la imagen: ${s3Error.message || 'Error desconocido'}`, 500);
        }
        // Actualizar foto de perfil según el rol
        let updatedProfilePictureUrl = null;
        if (req.user.role === 'DOCTOR') {
            console.log('Buscando perfil de doctor...');
            const doctor = await database_1.default.doctor.findUnique({
                where: { userId: req.user.userId }
            });
            if (!doctor) {
                console.error('Perfil de doctor no encontrado para userId:', req.user.userId);
                throw new error_utils_1.AppError('Perfil de doctor no encontrado', 404);
            }
            console.log('Doctor encontrado. Actualizando foto de perfil...');
            // Actualizar foto de perfil del doctor
            await database_1.default.doctor.update({
                where: { id: doctor.id },
                data: { profilePictureUrl: url }
            });
            updatedProfilePictureUrl = url;
            console.log('Foto de perfil del doctor actualizada exitosamente');
        }
        else if (req.user.role === 'PATIENT') {
            console.log('Buscando perfil de paciente...');
            const patient = await database_1.default.patient.findUnique({
                where: { userId: req.user.userId }
            });
            if (!patient) {
                console.error('Perfil de paciente no encontrado para userId:', req.user.userId);
                throw new error_utils_1.AppError('Perfil de paciente no encontrado', 404);
            }
            console.log('Paciente encontrado. Actualizando foto de perfil...');
            // Actualizar foto de perfil del paciente
            await database_1.default.patient.update({
                where: { id: patient.id },
                data: { profilePictureUrl: url }
            });
            updatedProfilePictureUrl = url;
            console.log('Foto de perfil del paciente actualizada exitosamente');
        }
        else if (req.user.role === 'ASISTENTE' || req.user.role === 'ADMIN') {
            console.log(`Actualizando foto de perfil del ${req.user.role.toLowerCase()}...`);
            await database_1.default.user.update({
                where: { id: req.user.userId },
                data: { profilePictureUrl: url }
            });
            updatedProfilePictureUrl = url;
            console.log(`Foto de perfil del ${req.user.role.toLowerCase()} actualizada exitosamente`);
        }
        else {
            throw new error_utils_1.AppError('Tu rol no permite actualizar la foto de perfil', 403);
        }
        console.log('Enviando respuesta exitosa con profilePictureUrl:', updatedProfilePictureUrl);
        res.status(200).json({
            message: 'Foto de perfil actualizada exitosamente',
            profilePictureUrl: updatedProfilePictureUrl
        });
        console.log('Respuesta enviada exitosamente');
    }
    catch (error) {
        console.error('Error al actualizar foto de perfil:', error);
        console.error('Error stack:', error.stack);
        console.error('Error message:', error.message);
        // Asegurarse de que siempre se devuelva una respuesta JSON
        if (error instanceof error_utils_1.AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        // Si el error tiene un mensaje, usarlo
        if (error.message) {
            return res.status(500).json({ message: error.message });
        }
        // Error genérico
        return res.status(500).json({ message: 'Error al actualizar la foto de perfil' });
    }
};
exports.updateProfilePicture = updateProfilePicture;
// Obtener datos del usuario actual autenticado
const getCurrentUser = async (req, res) => {
    try {
        if (!req.user) {
            throw new error_utils_1.AppError('No estás autenticado', 401);
        }
        // Buscar usuario en la base de datos
        const user = await database_1.default.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                phone: true,
                profilePictureUrl: true
            }
        });
        if (!user) {
            throw new error_utils_1.AppError('Usuario no encontrado', 404);
        }
        // Obtener doctorId, patientId y profilePictureUrl según el rol
        let doctorId = null;
        let patientId = null;
        let profilePictureUrl = null;
        if (user.role === 'DOCTOR') {
            try {
                const doctorProfile = await database_1.default.doctor.findUnique({
                    where: { userId: user.id }
                });
                if (doctorProfile) {
                    doctorId = doctorProfile.id;
                    profilePictureUrl = doctorProfile.profilePictureUrl || null;
                }
                const patientProfile = await database_1.default.patient.findUnique({
                    where: { userId: user.id }
                });
                if (patientProfile)
                    patientId = patientProfile.id;
            }
            catch (doctorError) {
                console.error('Error al buscar perfil de doctor:', doctorError);
            }
        }
        else if (user.role === 'PATIENT') {
            try {
                const patientProfile = await database_1.default.patient.findUnique({
                    where: { userId: user.id }
                });
                if (patientProfile) {
                    patientId = patientProfile.id;
                    profilePictureUrl = patientProfile.profilePictureUrl || null;
                }
            }
            catch (patientError) {
                console.error('Error al buscar perfil de paciente:', patientError);
            }
        }
        else if (user.role === 'ASISTENTE' || user.role === 'ADMIN') {
            profilePictureUrl = user.profilePictureUrl || null;
        }
        let clinicalHistoryPortalEnabled;
        if (user.role === 'PATIENT' && patientId) {
            clinicalHistoryPortalEnabled = await (0, patientPortal_utils_1.patientHasClinicalHistoryPortalAccess)(patientId);
        }
        // Capacidad "afiliado" (independiente del rol): existe perfil de afiliado.
        let affiliateProfileId = null;
        try {
            const affiliateProfile = await database_1.default.affiliateProfile.findUnique({
                where: { userId: user.id },
                select: { id: true }
            });
            if (affiliateProfile)
                affiliateProfileId = affiliateProfile.id;
        }
        catch (affiliateError) {
            console.error('Error al buscar perfil de afiliado:', affiliateError);
        }
        res.json({
            user: Object.assign({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, phone: user.phone, doctorId,
                patientId,
                profilePictureUrl, hasAffiliateProfile: !!affiliateProfileId, affiliateProfileId }, (clinicalHistoryPortalEnabled !== undefined && { clinicalHistoryPortalEnabled }))
        });
    }
    catch (error) {
        console.error('Error al obtener usuario actual:', error);
        if (error instanceof error_utils_1.AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error al obtener datos del usuario' });
    }
};
exports.getCurrentUser = getCurrentUser;
