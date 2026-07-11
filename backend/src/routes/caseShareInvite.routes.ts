import { Router } from 'express';
import { getCaseShareInvitePublic, signCaseShareInvite } from '../controllers/clinicalCaseShareInvite.controller';

const router = Router();

router.get('/:token', getCaseShareInvitePublic);
router.post('/:token/sign', signCaseShareInvite);

export default router;
