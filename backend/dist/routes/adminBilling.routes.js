"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const adminBilling_controller_1 = require("../controllers/adminBilling.controller");
const router = (0, express_1.Router)();
// Todas las rutas requieren rol ADMIN (sesión JWT).
router.use((0, auth_middleware_1.authMiddleware)(['ADMIN']));
router.get('/doctors', adminBilling_controller_1.AdminBillingController.listDoctors);
router.put('/doctors/:id/tax', adminBilling_controller_1.AdminBillingController.updateDoctorTax);
router.get('/doctors/:doctorId/invoices', adminBilling_controller_1.AdminBillingController.getDoctorInvoices);
router.post('/invoices', upload_middleware_1.upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'xml', maxCount: 1 }
]), adminBilling_controller_1.AdminBillingController.uploadInvoice);
router.delete('/invoices/:id', adminBilling_controller_1.AdminBillingController.deleteInvoice);
router.post('/invoices/:id/send-email', adminBilling_controller_1.AdminBillingController.sendInvoiceEmail);
exports.default = router;
