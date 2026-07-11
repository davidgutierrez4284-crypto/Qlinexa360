import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';
import { AdminBillingController } from '../controllers/adminBilling.controller';

const router = Router();

// Todas las rutas requieren rol ADMIN (sesión JWT).
router.use(authMiddleware(['ADMIN']));

router.get('/doctors', AdminBillingController.listDoctors);
router.put('/doctors/:id/tax', AdminBillingController.updateDoctorTax);
router.get('/doctors/:doctorId/invoices', AdminBillingController.getDoctorInvoices);
router.post(
  '/invoices',
  upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'xml', maxCount: 1 }
  ]),
  AdminBillingController.uploadInvoice
);
router.delete('/invoices/:id', AdminBillingController.deleteInvoice);
router.post('/invoices/:id/send-email', AdminBillingController.sendInvoiceEmail);

export default router;
