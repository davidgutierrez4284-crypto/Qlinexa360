"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subscription_controller_1 = require("../controllers/subscription.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Rutas protegidas que requieren autenticación
router.post('/renew', auth_middleware_1.authenticateToken, subscription_controller_1.renewSubscription);
router.get('/status', auth_middleware_1.authenticateToken, subscription_controller_1.getSubscriptionStatus);
router.get('/details', auth_middleware_1.authenticateToken, subscription_controller_1.getSubscriptionDetails);
router.post('/cancel', auth_middleware_1.authenticateToken, subscription_controller_1.cancelSubscription);
router.post('/extend-free-month', auth_middleware_1.authenticateToken, subscription_controller_1.extendSubscriptionFreeMonth);
router.get('/check-free-month', auth_middleware_1.authenticateToken, subscription_controller_1.checkFreeMonthUsed);
router.post('/resume', auth_middleware_1.authenticateToken, subscription_controller_1.resumeCancelledSubscription);
router.post('/resume-with-payment', auth_middleware_1.authenticateToken, subscription_controller_1.resumeWithPayment);
// Ruta para reanudar suscripciones (puede ser llamada por un cron job)
// En producción, proteger esta ruta con un token secreto o autenticación de servicio
router.post('/resume-suspended', subscription_controller_1.resumeSuspendedSubscriptions);
// Ruta para el webhook de PayPal (no requiere autenticación)
router.post('/webhook', subscription_controller_1.handlePayPalWebhook);
exports.default = router;
