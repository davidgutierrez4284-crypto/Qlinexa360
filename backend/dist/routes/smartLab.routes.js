"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const smartLab_config_1 = require("../config/smartLab.config");
const smartLabUpload_middleware_1 = require("../middlewares/smartLabUpload.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const smartLab_controller_1 = require("../controllers/smartLab.controller");
const router = (0, express_1.Router)();
router.use((_req, res, next) => {
    if (!(0, smartLab_config_1.isSmartLabEnabled)()) {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
});
const labAuth = (0, auth_middleware_1.authMiddleware)(['DOCTOR', 'ASISTENTE', 'PATIENT', 'ADMIN']);
const adminAuth = (0, auth_middleware_1.authMiddleware)(['ADMIN']);
router.get('/status', labAuth, smartLab_controller_1.getSmartLabStatus);
router.post('/patients/:patientId/reports/upload', labAuth, smartLabUpload_middleware_1.smartLabPdfUpload.single('file'), upload_middleware_1.handleUploadError, smartLab_controller_1.uploadPatientLabReport);
router.get('/patients/:patientId/reports', labAuth, smartLab_controller_1.listPatientReports);
router.get('/patients/:patientId/alerts', labAuth, smartLab_controller_1.getPatientLabAlerts);
router.get('/patients/:patientId/dashboard', labAuth, smartLab_controller_1.getPatientLabDashboard);
router.get('/patients/:patientId/compare', labAuth, smartLab_controller_1.comparePatientLabAnalyte);
router.get('/reports/compare', labAuth, smartLab_controller_1.compareLabReports);
router.get('/reports/:reportId', labAuth, smartLab_controller_1.getLabReport);
router.get('/reports/:reportId/download', labAuth, smartLab_controller_1.downloadLabReportPdf);
router.post('/reports/:reportId/process', labAuth, smartLab_controller_1.processLabReportHandler);
router.patch('/reports/:reportId/results', labAuth, smartLab_controller_1.patchLabReportResults);
router.post('/reports/:reportId/confirm', labAuth, smartLab_controller_1.confirmLabReportHandler);
router.post('/reports/:reportId/reject', labAuth, smartLab_controller_1.rejectLabReportHandler);
router.delete('/reports/:reportId', labAuth, smartLab_controller_1.deleteLabReportHandler);
router.get('/catalog', labAuth, smartLab_controller_1.getAnalyteCatalog);
router.get('/admin/catalog', adminAuth, smartLab_controller_1.listAdminAnalyteCatalog);
router.post('/admin/catalog', adminAuth, smartLab_controller_1.createAdminAnalyteCatalog);
router.patch('/admin/catalog/:id', adminAuth, smartLab_controller_1.patchAdminAnalyteCatalog);
router.get('/admin/metrics', adminAuth, smartLab_controller_1.getSmartLabAdminMetricsHandler);
router.post('/alerts/:alertId/dismiss', labAuth, smartLab_controller_1.dismissPatientLabAlert);
exports.default = router;
