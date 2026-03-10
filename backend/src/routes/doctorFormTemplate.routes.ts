import { Router } from 'express';
import {
  getDoctorTemplates,
  createDoctorTemplate,
  updateDoctorTemplate,
  deleteDoctorTemplate,
  saveDoctorFormData,
  getDoctorFormDataForCharts,
} from '../controllers/doctorFormTemplate.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware(['DOCTOR', 'ASISTENTE']));

router.get('/', getDoctorTemplates);
router.post('/', createDoctorTemplate);
router.put('/:id', updateDoctorTemplate);
router.delete('/:id', deleteDoctorTemplate);

router.post('/data', saveDoctorFormData);
router.get('/data/charts', getDoctorFormDataForCharts);

export default router;
