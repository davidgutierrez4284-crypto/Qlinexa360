import { Router } from 'express';
import { ClinicalIntakeController } from '../controllers/clinicalIntake.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { upload, handleUploadError } from '../middlewares/upload.middleware';

const router = Router();

// Público
router.get('/public/doctor/:doctorSlug', ClinicalIntakeController.getPortalInfoBySlug);
router.post('/public/doctor/:doctorSlug/start', ClinicalIntakeController.startPortalBySlug);
router.get('/public/portal/:portalToken', ClinicalIntakeController.getPortalInfo);
router.post('/public/portal/:portalToken/start', ClinicalIntakeController.startPortal);
router.get('/public/:token', ClinicalIntakeController.getPublic);
router.put('/public/:token', ClinicalIntakeController.savePublicDraft);
router.post('/public/:token/submit', ClinicalIntakeController.submitPublic);
router.post(
  '/public/:token/upload',
  upload.single('file'),
  handleUploadError,
  ClinicalIntakeController.uploadPublic
);

// Staff
router.get('/portal-link', authenticateToken, ClinicalIntakeController.getPortalLink);
router.post('/portal-link/regenerate', authenticateToken, ClinicalIntakeController.regeneratePortalLink);
router.get('/:id', authenticateToken, ClinicalIntakeController.getStaff);
router.post('/:id/convert', authenticateToken, ClinicalIntakeController.convertStaff);
router.get('/', authenticateToken, ClinicalIntakeController.listStaff);
router.post('/send-link', authenticateToken, ClinicalIntakeController.sendLink);
router.patch('/:id', authenticateToken, ClinicalIntakeController.patchStaff);

export default router;
