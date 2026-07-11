import { Router } from 'express';
import { MercadoPagoController } from '../controllers/mercadoPago.controller';
import { MercadoPagoAdminController } from '../controllers/mercadoPagoAdmin.controller';
import { authMiddleware, attachAuthTokenFromQuery } from '../middlewares/auth.middleware';
import { AssistantMiddleware } from '../middlewares/assistant.middleware';

const router = Router();

router.get('/connect', (req, res, next) => {
  const hasAuthHeader = !!req.headers.authorization;
  const hasQueryToken = typeof req.query.token === 'string' && req.query.token.length > 0;
  if (!hasAuthHeader && !hasQueryToken) {
    return MercadoPagoController.connectBootstrap(req, res);
  }
  attachAuthTokenFromQuery(req, res, () => {
    authMiddleware(['DOCTOR'])(req, res, () => MercadoPagoController.connectRedirect(req, res));
  });
});
router.get('/connect-url', authMiddleware(['DOCTOR']), MercadoPagoController.connect);
router.get('/callback', MercadoPagoController.callback);
router.post('/disconnect', authMiddleware(['DOCTOR']), MercadoPagoController.disconnect);
router.get('/status', authMiddleware(['DOCTOR']), MercadoPagoController.status);

router.get(
  '/teleconsultation-settings',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  MercadoPagoController.getTeleconsultationSettings
);
router.put(
  '/teleconsultation-settings',
  authMiddleware(['DOCTOR']),
  MercadoPagoController.updateTeleconsultationSettings
);

router.post('/preferences/teleconsultation', MercadoPagoController.createTeleconsultationPreference);
router.post(
  '/preferences/in-person',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  MercadoPagoController.createInPersonPreference
);

router.post('/webhook', MercadoPagoController.webhook);
router.get('/webhook', MercadoPagoController.webhookGet);

router.get(
  '/transactions',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('finanzas'),
  MercadoPagoController.listTransactions
);
router.get(
  '/transactions/export',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('finanzas'),
  MercadoPagoController.exportTransactionsExcel
);

router.get(
  '/appointment/:appointmentId/payment-status',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('appointments'),
  MercadoPagoController.getAppointmentPaymentStatus
);

router.get('/in-person-payment/:token', MercadoPagoController.getInPersonPaymentStatusByToken);

router.get(
  '/refund-requests',
  authMiddleware(['DOCTOR', 'ASISTENTE']),
  AssistantMiddleware.checkAssistantModulePermission('finanzas'),
  MercadoPagoController.listRefundRequests
);
router.post(
  '/refund-requests/:id/approve',
  authMiddleware(['DOCTOR']),
  MercadoPagoController.approveRefundRequest
);
router.post(
  '/refund-requests/:id/reject',
  authMiddleware(['DOCTOR']),
  MercadoPagoController.rejectRefundRequest
);

router.get('/admin/commission-rules', authMiddleware(['ADMIN']), MercadoPagoAdminController.listCommissionRules);
router.put('/admin/commission-rules', authMiddleware(['ADMIN']), MercadoPagoAdminController.upsertCommissionRule);
router.get('/admin/commission-report', authMiddleware(['ADMIN']), MercadoPagoAdminController.commissionReport);

export default router;
