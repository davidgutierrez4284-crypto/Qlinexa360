import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { isSmartLabEnabled } from '../config/smartLab.config';
import { smartLabPdfUpload } from '../middlewares/smartLabUpload.middleware';
import { handleUploadError } from '../middlewares/upload.middleware';
import {
  compareLabReports,
  comparePatientLabAnalyte,
  confirmLabReportHandler,
  dismissPatientLabAlert,
  downloadLabReportPdf,
  getAnalyteCatalog,
  listAdminAnalyteCatalog,
  createAdminAnalyteCatalog,
  patchAdminAnalyteCatalog,
  getSmartLabAdminMetricsHandler,
  getLabReport,
  getPatientLabAlerts,
  getPatientLabDashboard,
  getSmartLabStatus,
  listPatientReports,
  patchLabReportResults,
  processLabReportHandler,
  rejectLabReportHandler,
  deleteLabReportHandler,
  uploadPatientLabReport,
} from '../controllers/smartLab.controller';

const router = Router();

router.use((_req: Request, res: Response, next: NextFunction) => {
  if (!isSmartLabEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

const labAuth = authMiddleware(['DOCTOR', 'ASISTENTE', 'PATIENT', 'ADMIN']);
const adminAuth = authMiddleware(['ADMIN']);

router.get('/status', labAuth, getSmartLabStatus);

router.post(
  '/patients/:patientId/reports/upload',
  labAuth,
  smartLabPdfUpload.single('file'),
  handleUploadError,
  uploadPatientLabReport
);

router.get('/patients/:patientId/reports', labAuth, listPatientReports);
router.get('/patients/:patientId/alerts', labAuth, getPatientLabAlerts);
router.get('/patients/:patientId/dashboard', labAuth, getPatientLabDashboard);
router.get('/patients/:patientId/compare', labAuth, comparePatientLabAnalyte);

router.get('/reports/compare', labAuth, compareLabReports);
router.get('/reports/:reportId', labAuth, getLabReport);
router.get('/reports/:reportId/download', labAuth, downloadLabReportPdf);
router.post('/reports/:reportId/process', labAuth, processLabReportHandler);
router.patch('/reports/:reportId/results', labAuth, patchLabReportResults);
router.post('/reports/:reportId/confirm', labAuth, confirmLabReportHandler);
router.post('/reports/:reportId/reject', labAuth, rejectLabReportHandler);
router.delete('/reports/:reportId', labAuth, deleteLabReportHandler);


router.get('/catalog', labAuth, getAnalyteCatalog);
router.get('/admin/catalog', adminAuth, listAdminAnalyteCatalog);
router.post('/admin/catalog', adminAuth, createAdminAnalyteCatalog);
router.patch('/admin/catalog/:id', adminAuth, patchAdminAnalyteCatalog);
router.get('/admin/metrics', adminAuth, getSmartLabAdminMetricsHandler);
router.post('/alerts/:alertId/dismiss', labAuth, dismissPatientLabAlert);

export default router;

