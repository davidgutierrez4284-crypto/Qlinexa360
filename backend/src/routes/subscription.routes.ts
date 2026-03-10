import { Router } from 'express';
import { renewSubscription, getSubscriptionStatus, getSubscriptionDetails, handlePayPalWebhook, cancelSubscription, extendSubscriptionFreeMonth, checkFreeMonthUsed, resumeSuspendedSubscriptions, resumeCancelledSubscription, resumeWithPayment } from '../controllers/subscription.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// Rutas protegidas que requieren autenticación
router.post('/renew', authenticateToken, renewSubscription);
router.get('/status', authenticateToken, getSubscriptionStatus);
router.get('/details', authenticateToken, getSubscriptionDetails);
router.post('/cancel', authenticateToken, cancelSubscription);
router.post('/extend-free-month', authenticateToken, extendSubscriptionFreeMonth);
router.get('/check-free-month', authenticateToken, checkFreeMonthUsed);
router.post('/resume', authenticateToken, resumeCancelledSubscription);
router.post('/resume-with-payment', authenticateToken, resumeWithPayment);

// Ruta para reanudar suscripciones (puede ser llamada por un cron job)
// En producción, proteger esta ruta con un token secreto o autenticación de servicio
router.post('/resume-suspended', resumeSuspendedSubscriptions);

// Ruta para el webhook de PayPal (no requiere autenticación)
router.post('/webhook', handlePayPalWebhook);

export default router; 