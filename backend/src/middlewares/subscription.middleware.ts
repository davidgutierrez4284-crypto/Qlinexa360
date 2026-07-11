import prisma from '../config/database';
import { AuthRequest } from './auth.middleware';
import { Response, NextFunction } from 'express';
import { AppError } from '../utils/error.utils';

export const subscriptionAccess = (mode: 'read' | 'edit') => async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) throw new AppError('Autenticación requerida.', 401);
  
  // Si el usuario no es DOCTOR, no aplicar restricciones de suscripción
  // (ASISTENTE y PATIENT no tienen suscripciones propias)
  if (req.user.role !== 'DOCTOR') {
    return next();
  }
  
  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.userId },
    include: { subscription: true }
  });

  if (!doctor) {
    throw new AppError('Perfil de doctor no encontrado.', 404);
  }

  const subscription = doctor.subscription;
  const subscriptionStatus = (subscription?.status || 'none').toUpperCase();
  const now = new Date();

  // Solo aplicar restricciones en operaciones de edición
  if (mode === 'edit' || ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // d) CANCELLED: bloqueado, solo lectura
    if (subscriptionStatus === 'CANCELLED') {
      console.warn('[subscription] Bloqueado: suscripción cancelada', { userId: req.user.userId, doctorId: doctor.id, path: req.path });
      return res.status(403).json({
        message: 'Su suscripción está cancelada. Solo puede consultar información en modo lectura. No puede añadir, modificar ni eliminar ningún dato.',
        subscriptionStatus: 'CANCELLED',
        readOnly: true
      });
    }

    // c) Sin suscripción: verificar trial en Doctor (legacy) o accessType lifetime
    if (!subscription) {
      const trialEnd = doctor.trialEnd ? new Date(doctor.trialEnd) : null;
      const isWithinLegacyTrial = trialEnd && trialEnd >= now;
      const isLifetime = (doctor.accessType || '').toLowerCase() === 'lifetime';

      if (isWithinLegacyTrial || isLifetime) {
        return next(); // Permitir: trial activo en Doctor o acceso lifetime
      }

      // Fallback: doctores sin registro de suscripción (legacy, seed, desarrollo).
      // Se permite acceso para no bloquear la plataforma médica.
      return next();
    }

    const hasPayPal = !!(subscription.paypalSubscriptionId && subscription.paypalSubscriptionId.trim() !== '');
    const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
    const isWithinTrial = endDate && endDate >= now;

    // a) Dentro del periodo de trial: permitido
    if (isWithinTrial) {
      return next();
    }

    // b) Status ACTIVE o TRIAL: permitir (doctores con suscripción activa aunque no tengan PayPal aún)
    if (['ACTIVE', 'TRIAL'].includes(subscriptionStatus)) {
      return next();
    }

    // c) Trial expirado: verificar si tiene PayPal activo (incl. periodo de gracia de reintento)
    // SUSPENDED (PayPal permite 1 mes de ciclo de reintento) o APPROVAL_PENDING
    if (hasPayPal && ['SUSPENDED', 'APPROVAL_PENDING'].includes(subscriptionStatus)) {
      return next();
    }

    // d) Trial expirado y sin pago registrado, o c) sin suscripción válida: bloqueado
    console.warn('[subscription] Bloqueado: trial expirado o sin suscripción válida', { userId: req.user.userId, doctorId: doctor.id, subscriptionStatus, path: req.path });
    return res.status(403).json({
      message: 'Su periodo de prueba ha finalizado. Registra un método de pago para continuar creando consultas.',
      subscriptionStatus: subscriptionStatus,
      readOnly: true
    });
  }

  next();
};

// Middleware para bloquear todas las operaciones de escritura cuando la suscripción está cancelada
export const blockWriteOperationsIfCancelled = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Solo aplicar a operaciones de escritura
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Permitir ciertas rutas que no deben ser bloqueadas (como cancelar suscripción, reanudar, etc.)
  const allowedPaths = [
    '/api/subscriptions/cancel',
    '/api/subscriptions/resume',
    '/api/subscriptions/extend-free-month',
    '/api/auth/logout',
    '/api/auth/profile-picture', // Permitir actualizar foto de perfil
    '/api/referrals/send-invite-email', // Invitar colegas aunque la suscripción esté cancelada
  ];

  if (allowedPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  if (!req.user) {
    return next(); // Dejar que authMiddleware maneje esto
  }

  // Para usuarios que no son doctores (ASISTENTE, PATIENT, ADMIN), permitir operaciones
  if (req.user.role !== 'DOCTOR') {
    return next();
  }

  if (!req.user.doctorId) {
    return next();
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { doctorId: req.user.doctorId }
    });

    if (subscription?.status === 'CANCELLED') {
      return res.status(403).json({
        message: 'Su suscripción está cancelada. Solo puede consultar información en modo lectura. No puede añadir, modificar ni eliminar ningún dato.',
        subscriptionStatus: 'CANCELLED',
        readOnly: true
      });
    }
  } catch (error) {
    console.error('Error verificando estado de suscripción:', error);
    // En caso de error, permitir continuar (no bloquear)
  }

  next();
}; 