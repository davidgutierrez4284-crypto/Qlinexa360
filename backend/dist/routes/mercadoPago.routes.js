"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mercadoPago_controller_1 = require("../controllers/mercadoPago.controller");
const mercadoPagoAdmin_controller_1 = require("../controllers/mercadoPagoAdmin.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const assistant_middleware_1 = require("../middlewares/assistant.middleware");
const router = (0, express_1.Router)();
router.get('/connect', (req, res, next) => {
    const hasAuthHeader = !!req.headers.authorization;
    const hasQueryToken = typeof req.query.token === 'string' && req.query.token.length > 0;
    if (!hasAuthHeader && !hasQueryToken) {
        return mercadoPago_controller_1.MercadoPagoController.connectBootstrap(req, res);
    }
    (0, auth_middleware_1.attachAuthTokenFromQuery)(req, res, () => {
        (0, auth_middleware_1.authMiddleware)(['DOCTOR'])(req, res, () => mercadoPago_controller_1.MercadoPagoController.connectRedirect(req, res));
    });
});
router.get('/connect-url', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), mercadoPago_controller_1.MercadoPagoController.connect);
router.get('/callback', mercadoPago_controller_1.MercadoPagoController.callback);
router.post('/disconnect', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), mercadoPago_controller_1.MercadoPagoController.disconnect);
router.get('/status', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), mercadoPago_controller_1.MercadoPagoController.status);
router.get('/teleconsultation-settings', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), mercadoPago_controller_1.MercadoPagoController.getTeleconsultationSettings);
router.put('/teleconsultation-settings', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), mercadoPago_controller_1.MercadoPagoController.updateTeleconsultationSettings);
router.post('/preferences/teleconsultation', mercadoPago_controller_1.MercadoPagoController.createTeleconsultationPreference);
router.post('/preferences/in-person', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), mercadoPago_controller_1.MercadoPagoController.createInPersonPreference);
router.post('/webhook', mercadoPago_controller_1.MercadoPagoController.webhook);
router.get('/webhook', mercadoPago_controller_1.MercadoPagoController.webhookGet);
router.get('/transactions', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('finanzas'), mercadoPago_controller_1.MercadoPagoController.listTransactions);
router.get('/transactions/export', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('finanzas'), mercadoPago_controller_1.MercadoPagoController.exportTransactionsExcel);
router.get('/appointment/:appointmentId/payment-status', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('appointments'), mercadoPago_controller_1.MercadoPagoController.getAppointmentPaymentStatus);
router.get('/in-person-payment/:token', mercadoPago_controller_1.MercadoPagoController.getInPersonPaymentStatusByToken);
router.get('/refund-requests', (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE']), assistant_middleware_1.AssistantMiddleware.checkAssistantModulePermission('finanzas'), mercadoPago_controller_1.MercadoPagoController.listRefundRequests);
router.post('/refund-requests/:id/approve', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), mercadoPago_controller_1.MercadoPagoController.approveRefundRequest);
router.post('/refund-requests/:id/reject', (0, auth_middleware_1.authMiddleware)(['DOCTOR']), mercadoPago_controller_1.MercadoPagoController.rejectRefundRequest);
router.get('/admin/commission-rules', (0, auth_middleware_1.authMiddleware)(['ADMIN']), mercadoPagoAdmin_controller_1.MercadoPagoAdminController.listCommissionRules);
router.put('/admin/commission-rules', (0, auth_middleware_1.authMiddleware)(['ADMIN']), mercadoPagoAdmin_controller_1.MercadoPagoAdminController.upsertCommissionRule);
router.get('/admin/commission-report', (0, auth_middleware_1.authMiddleware)(['ADMIN']), mercadoPagoAdmin_controller_1.MercadoPagoAdminController.commissionReport);
exports.default = router;
