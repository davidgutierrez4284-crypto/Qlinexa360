import { Request, Response } from 'express';
import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { generateToken, generateTwoFactorToken, verifyToken, generateTrustedDeviceToken, verifyTrustedDeviceToken } from '../utils/jwt.utils';
import { env } from '../config/env';
import { validateRegister, validateLogin } from '../utils/validation.utils';
import { AppError } from '../utils/error.utils';
import { NotificationService } from '../services/notification.service';
import { ConsentPdfService } from '../services/consentPdf.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { uploadToS3 } from '../utils/file.utils';
import { getPromoCodeOrThrow, getPromoDurationDays, normalizePromoCode } from '../utils/promo.utils';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';

const TWO_FACTOR_TOKEN_EXPIRY = '10m';
const TWO_FACTOR_RECOVERY_EXPIRY_MS = 10 * 60 * 1000;

const buildAuthResponse = async (user: any) => {
  let doctorId: string | null = null;
  let patientId: string | null = null;
  let profilePictureUrl: string | null = null;

  if (user.role === 'DOCTOR') {
    try {
      const doctorProfile = await prisma.doctor.findUnique({ where: { userId: user.id } });
      if (doctorProfile) {
        doctorId = doctorProfile.id;
        profilePictureUrl = doctorProfile.profilePictureUrl || null;
      }
      // Usuario DOCTOR que también es paciente: incluir patientId para contexto dual
      const patientProfile = await prisma.patient.findUnique({ where: { userId: user.id } });
      if (patientProfile) patientId = patientProfile.id;
    } catch (doctorError: any) {
      console.error('Error al buscar perfil de doctor:', doctorError);
    }
  } else if (user.role === 'PATIENT') {
    try {
      const patientProfile = await prisma.patient.findUnique({ where: { userId: user.id } });
      if (patientProfile) {
        patientId = patientProfile.id;
        profilePictureUrl = patientProfile.profilePictureUrl || null;
      }
    } catch (patientError: any) {
      console.error('Error al buscar perfil de paciente:', patientError);
    }
  } else if (user.role === 'ASISTENTE' || user.role === 'ADMIN') {
    profilePictureUrl = user.profilePictureUrl || null;
  }

  const tokenPayload: any = { userId: user.id, role: user.role };
  if (doctorId) tokenPayload.doctorId = doctorId;
  if (patientId) tokenPayload.patientId = patientId;
  const token = generateToken(tokenPayload);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      doctorId,
      patientId,
      profilePictureUrl
    }
  };
};

const getTwoFactorUserFromRequest = async (req: Request) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    throw new AppError('Token de verificación requerido.', 401);
  }

  let payload: any;
  try {
    payload = verifyToken(token) as any;
  } catch (error) {
    throw new AppError('Token inválido o expirado.', 403);
  }

  if (!payload?.twoFactorPending) {
    throw new AppError('Token inválido para verificación 2FA.', 403);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw new AppError('Usuario no encontrado.', 404);
  }

  return { user, payload };
};

export const register = async (req: Request, res: Response) => {
  try {
    validateRegister(req.body);
    const { email, password, firstName, lastName, role, phone } = req.body;
    const rawPromoCode = req.body?.promoCode ? String(req.body.promoCode) : '';
    const promoCode = rawPromoCode ? normalizePromoCode(rawPromoCode) : '';

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('El usuario ya existe', 400);
    }

    let promo = null;
    if (role === 'DOCTOR' && promoCode) {
      promo = await getPromoCodeOrThrow(promoCode);
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = await prisma.user.create({
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
      // Crear perfil Doctor (rellenar campos con datos reales si están en el formulario)
      const doctorProfile = await prisma.doctor.create({
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
          taxCertificateUrl: '', // Puedes agregar lógica de subida de archivo si aplica
          dataConsent: !!req.body.acceptPrivacy,
          termsAccepted: !!req.body.acceptTerms,
          termsAcceptedAt: new Date(),
          accessType: promo?.type === 'LIFETIME' ? 'lifetime' : promo ? 'trial' : 'subscription',
          trialStart: promo && promo.type !== 'LIFETIME' ? new Date() : null,
          trialEnd: promo && promo.type !== 'LIFETIME'
            ? new Date(Date.now() + getPromoDurationDays(promo.type) * 24 * 60 * 60 * 1000)
            : null,
          profilePictureUrl: '' // Puedes agregar lógica de subida de imagen si aplica
        }
      });
      const doctorId = doctorProfile.id;
      const { paypalSubscriptionId, paypalPlanId } = req.body;
      const now = new Date();

      if (paypalSubscriptionId) {
        // Con PayPal: pago directo o promo con trial (1M/3M) + PayPal
        const isTrialPromo = promo && promo.type !== 'LIFETIME';
        const endDate = isTrialPromo
          ? new Date(Date.now() + getPromoDurationDays(promo!.type) * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días si pago directo

        const tx: Promise<unknown>[] = [];
        if (promo) {
          tx.push(
            prisma.promoCode.update({
              where: { id: promo.id },
              data: { redemptionCount: { increment: 1 } }
            }),
            prisma.promoRedemption.create({
              data: { promoCodeId: promo.id, doctorId }
            })
          );
        }
        tx.push(
          prisma.subscription.create({
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
          })
        );
        await prisma.$transaction(tx as any);
      } else if (promo && promo.type === 'LIFETIME') {
        // Solo LIFETIME sin PayPal
        const endDate = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
        await prisma.$transaction([
          prisma.promoCode.update({
            where: { id: promo.id },
            data: { redemptionCount: { increment: 1 } }
          }),
          prisma.promoRedemption.create({
            data: { promoCodeId: promo.id, doctorId }
          }),
          prisma.subscription.create({
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
      } else if (promo) {
        // Código de trial (1M/3M) sin PayPal: rechazar (deberían haber registrado PayPal)
        throw new AppError(
          'Con tu código promocional debes registrar tu método de pago con PayPal. No se te cobrará durante el periodo gratuito.',
          400
        );
      }

      // Generar token con doctorId incluido
      const tokenPayload = { userId: user.id, role: user.role, doctorId };
      const token = generateToken(tokenPayload);

      // Generar PDFs de consentimiento, guardar en ConsentHistory y enviar a legal@qlinexa360.com
      const signature = req.body.signature?.trim();
      if (signature && req.body.acceptPrivacy && req.body.acceptTerms && req.body.acceptContract) {
        try {
          const fullName = `${user.firstName} ${user.lastName}`.trim();
          const pdfResults = await ConsentPdfService.generateConsentPdfs({
            userId: user.id,
            email: user.email,
            fullName,
            signature
          });
          await prisma.consentHistory.createMany({
            data: [
              { userId: user.id, type: 'PRIVACY_POLICY', version: '1.0', content: 'Aviso de Privacidad de Qlinexa360', pdfUrl: pdfResults.PRIVACY_POLICY.url },
              { userId: user.id, type: 'TERMS_OF_SERVICE', version: '1.0', content: 'Términos de Uso de Qlinexa360', pdfUrl: pdfResults.TERMS_OF_SERVICE.url },
              { userId: user.id, type: 'PLATFORM_CONTRACT', version: '1.0', content: 'Contrato de Uso de Plataforma de Qlinexa360', pdfUrl: pdfResults.PLATFORM_CONTRACT.url },
              { userId: user.id, type: 'DIGITAL_SIGNATURE', version: '1.0', content: `Firma digital: ${signature}` }
            ]
          });
          await NotificationService.sendNewUserConsentToLegal({
            fullName,
            email: user.email,
            role: 'DOCTOR',
            pdfBuffers: {
              aviso: pdfResults.PRIVACY_POLICY.buffer,
              terminos: pdfResults.TERMS_OF_SERVICE.buffer,
              contrato: pdfResults.PLATFORM_CONTRACT.buffer
            }
          });
        } catch (consentError) {
          console.error('Error generando consentimientos o enviando a legal:', consentError);
          // No fallar el registro si falla
        }
      }

      // Enviar correo de bienvenida
      try {
        await NotificationService.sendWelcomeEmail(user.email, user.firstName, user.lastName, user.role as 'DOCTOR' | 'ASISTENTE' | 'PATIENT');
      } catch (emailError) {
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
    } else {
      // Generar token sin doctorId para otros roles
      const token = generateToken({ userId: user.id, role: user.role });

      // Enviar correo de bienvenida
      try {
        await NotificationService.sendWelcomeEmail(user.email, user.firstName, user.lastName, user.role as 'DOCTOR' | 'ASISTENTE' | 'PATIENT');
      } catch (emailError) {
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
  } catch (error: any) {
    const handled = error instanceof AppError ? error : new AppError('Error al registrar usuario', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    console.log('=== INICIO DE LOGIN ===');
    console.log('Email recibido:', req.body?.email);
    
    validateLogin(req.body);
    const { email, password } = req.body;

    // Buscar usuario
    console.log('Buscando usuario con email:', email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('Usuario no encontrado');
      throw new AppError('Credenciales inválidas', 401);
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
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('Contraseña inválida');
      throw new AppError('Credenciales inválidas', 401);
    }
    console.log('Contraseña válida');

    // Bypass 2FA solo en desarrollo cuando DISABLE_2FA_DEV=true (usuarios con email inexistente)
    const isDevBypass = env.NODE_ENV === 'development' && env.DISABLE_2FA_DEV;
    if (isDevBypass) {
      const authResponse = await buildAuthResponse(user);
      res.json({
        message: 'Login exitoso (2FA deshabilitado en desarrollo)',
        ...authResponse
      });
      return;
    }

    // Si envía token de "dispositivo de confianza" válido para este usuario, omitir 2FA
    const trustedDeviceToken = req.body.trustedDeviceToken as string | undefined;
    if (trustedDeviceToken) {
      const decoded = verifyTrustedDeviceToken(trustedDeviceToken);
      if (decoded && decoded.userId === user.id) {
        const authResponse = await buildAuthResponse(user);
        res.json({
          message: 'Login exitoso (dispositivo de confianza)',
          ...authResponse
        });
        return;
      }
    }

    const requiresSetup = !user.twoFactorEnabled || !user.twoFactorSecret;
    const tempToken = generateTwoFactorToken({ userId: user.id, role: user.role }, TWO_FACTOR_TOKEN_EXPIRY);

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
  } catch (error: any) {
    console.error('=== ERROR EN LOGIN ===');
    console.error('Tipo de error:', error?.constructor?.name);
    console.error('Mensaje:', error?.message);
    console.error('Stack:', error?.stack);
    console.error('Error completo:', error);
    
    const handled = error instanceof AppError 
      ? error 
      : new AppError(error?.message || 'Error al iniciar sesión', 500);
    
    console.log('Respondiendo con:', handled.statusCode, handled.message);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

export const setupTwoFactor = async (req: Request, res: Response) => {
  try {
    const { user } = await getTwoFactorUserFromRequest(req);

    const secret = speakeasy.generateSecret({
      name: `Qlinexa360 (${user.email})`
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret.base32,
        twoFactorEnabled: false,
        twoFactorVerifiedAt: null
      }
    });

    const qrCodeDataUrl = secret.otpauth_url
      ? await qrcode.toDataURL(secret.otpauth_url)
      : null;

    res.json({
      message: 'Configuración 2FA iniciada',
      otpauthUrl: secret.otpauth_url,
      qrCodeDataUrl,
      secret: secret.base32
    });
  } catch (error: any) {
    const handled = error instanceof AppError ? error : new AppError('Error al iniciar 2FA', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

export const verifyTwoFactor = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      throw new AppError('Código 2FA requerido.', 400);
    }

    const { user } = await getTwoFactorUserFromRequest(req);
    if (!user.twoFactorSecret) {
      throw new AppError('Configuración 2FA no encontrada.', 400);
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!isValid) {
      throw new AppError('Código 2FA inválido.', 400);
    }

    await prisma.user.update({
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
    const response: Record<string, unknown> = {
      message: '2FA verificado',
      ...authResponse
    };
    if (rememberDevice) {
      response.trustedDeviceToken = generateTrustedDeviceToken(user.id);
    }
    res.json(response);
  } catch (error: any) {
    const handled = error instanceof AppError ? error : new AppError('Error al verificar 2FA', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

export const sendTwoFactorRecoveryEmail = async (req: Request, res: Response) => {
  try {
    const { user } = await getTwoFactorUserFromRequest(req);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + TWO_FACTOR_RECOVERY_EXPIRY_MS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorRecoveryToken: tokenHash,
        twoFactorRecoveryExpiresAt: expiresAt
      }
    });

    const notificationService = NotificationService.getInstance();
    const emailSent = await notificationService.sendTwoFactorRecoveryEmail(
      user.email,
      user.firstName,
      code
    );

    if (!emailSent) {
      throw new AppError('No se pudo enviar el correo de recuperación.', 500);
    }

    res.json({ message: 'Código de recuperación enviado.' });
  } catch (error: any) {
    const handled = error instanceof AppError ? error : new AppError('Error al enviar correo de recuperación', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

export const verifyTwoFactorRecovery = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      throw new AppError('Código de recuperación requerido.', 400);
    }

    const { user } = await getTwoFactorUserFromRequest(req);
    if (!user.twoFactorRecoveryToken || !user.twoFactorRecoveryExpiresAt) {
      throw new AppError('No hay un código de recuperación activo.', 400);
    }

    if (user.twoFactorRecoveryExpiresAt < new Date()) {
      throw new AppError('El código de recuperación expiró.', 400);
    }

    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    if (tokenHash !== user.twoFactorRecoveryToken) {
      throw new AppError('Código de recuperación inválido.', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorVerifiedAt: null,
        twoFactorRecoveryToken: null,
        twoFactorRecoveryExpiresAt: null
      }
    });

    const tempToken = generateTwoFactorToken({ userId: user.id, role: user.role }, TWO_FACTOR_TOKEN_EXPIRY);
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
  } catch (error: any) {
    const handled = error instanceof AppError ? error : new AppError('Error al validar recuperación', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// =================================================================
// ACTUALIZAR FOTO DE PERFIL
// =================================================================
export const updateProfilePicture = async (req: AuthRequest, res: Response) => {
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
      throw new AppError('Tipo de archivo no permitido. Solo se permiten imágenes JPG, PNG y WEBP', 400);
    }

    // Validar tamaño (máximo 5MB para fotos de perfil)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      throw new AppError('El archivo es demasiado grande. Máximo 5MB', 400);
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
    
    let url: string;
    try {
      const uploadResult = await uploadToS3(req.file, category, req.user.userId);
      url = uploadResult.url;
      console.log('Imagen subida a S3 exitosamente. URL:', url);
    } catch (s3Error: any) {
      console.error('Error subiendo a S3:', s3Error);
      throw new AppError(`Error al subir la imagen: ${s3Error.message || 'Error desconocido'}`, 500);
    }

    // Actualizar foto de perfil según el rol
    let updatedProfilePictureUrl: string | null = null;
    
    if (req.user.role === 'DOCTOR') {
      console.log('Buscando perfil de doctor...');
      const doctor = await prisma.doctor.findUnique({
        where: { userId: req.user.userId }
      });
      
      if (!doctor) {
        console.error('Perfil de doctor no encontrado para userId:', req.user.userId);
        throw new AppError('Perfil de doctor no encontrado', 404);
      }

      console.log('Doctor encontrado. Actualizando foto de perfil...');
      // Actualizar foto de perfil del doctor
      await prisma.doctor.update({
        where: { id: doctor.id },
        data: { profilePictureUrl: url }
      });
      
      updatedProfilePictureUrl = url;
      console.log('Foto de perfil del doctor actualizada exitosamente');
    } else if (req.user.role === 'PATIENT') {
      console.log('Buscando perfil de paciente...');
      const patient = await prisma.patient.findUnique({
        where: { userId: req.user.userId }
      });
      
      if (!patient) {
        console.error('Perfil de paciente no encontrado para userId:', req.user.userId);
        throw new AppError('Perfil de paciente no encontrado', 404);
      }

      console.log('Paciente encontrado. Actualizando foto de perfil...');
      // Actualizar foto de perfil del paciente
      await prisma.patient.update({
        where: { id: patient.id },
        data: { profilePictureUrl: url }
      });
      
      updatedProfilePictureUrl = url;
      console.log('Foto de perfil del paciente actualizada exitosamente');
    } else if (req.user.role === 'ASISTENTE' || req.user.role === 'ADMIN') {
      console.log(`Actualizando foto de perfil del ${req.user.role.toLowerCase()}...`);
      await prisma.user.update({
        where: { id: req.user.userId },
        data: { profilePictureUrl: url }
      });
      
      updatedProfilePictureUrl = url;
      console.log(`Foto de perfil del ${req.user.role.toLowerCase()} actualizada exitosamente`);
    } else {
      throw new AppError('Tu rol no permite actualizar la foto de perfil', 403);
    }

    console.log('Enviando respuesta exitosa con profilePictureUrl:', updatedProfilePictureUrl);
    res.status(200).json({
      message: 'Foto de perfil actualizada exitosamente',
      profilePictureUrl: updatedProfilePictureUrl
    });
    console.log('Respuesta enviada exitosamente');
  } catch (error: any) {
    console.error('Error al actualizar foto de perfil:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    
    // Asegurarse de que siempre se devuelva una respuesta JSON
    if (error instanceof AppError) {
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

// Obtener datos del usuario actual autenticado
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('No estás autenticado', 401);
    }

    // Buscar usuario en la base de datos
    const user = await prisma.user.findUnique({
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
      throw new AppError('Usuario no encontrado', 404);
    }

    // Obtener doctorId, patientId y profilePictureUrl según el rol
    let doctorId: string | null = null;
    let patientId: string | null = null;
    let profilePictureUrl: string | null = null;

    if (user.role === 'DOCTOR') {
      try {
        const doctorProfile = await prisma.doctor.findUnique({
          where: { userId: user.id }
        });
        if (doctorProfile) {
          doctorId = doctorProfile.id;
          profilePictureUrl = doctorProfile.profilePictureUrl || null;
        }
        const patientProfile = await prisma.patient.findUnique({
          where: { userId: user.id }
        });
        if (patientProfile) patientId = patientProfile.id;
      } catch (doctorError: any) {
        console.error('Error al buscar perfil de doctor:', doctorError);
      }
    } else if (user.role === 'PATIENT') {
      try {
        const patientProfile = await prisma.patient.findUnique({
          where: { userId: user.id }
        });
        if (patientProfile) {
          patientId = patientProfile.id;
          profilePictureUrl = patientProfile.profilePictureUrl || null;
        }
      } catch (patientError: any) {
        console.error('Error al buscar perfil de paciente:', patientError);
      }
    } else if (user.role === 'ASISTENTE' || user.role === 'ADMIN') {
      profilePictureUrl = user.profilePictureUrl || null;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        doctorId,
        patientId,
        profilePictureUrl
      }
    });
  } catch (error: any) {
    console.error('Error al obtener usuario actual:', error);
    
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Error al obtener datos del usuario' });
  }
}; 