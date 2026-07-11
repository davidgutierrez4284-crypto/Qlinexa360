import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { exportAuditEvidence, listAuditEvidenceExports } from '../controllers/auditEvidence.controller';

const router = Router();

router.get('/exports', authMiddleware(['ADMIN']), listAuditEvidenceExports);
router.post('/export', authMiddleware(['ADMIN']), exportAuditEvidence);

export default router;
