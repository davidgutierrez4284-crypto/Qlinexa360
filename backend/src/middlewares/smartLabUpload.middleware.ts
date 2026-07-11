import multer from 'multer';
import { getSmartLabMaxPdfMb } from '../config/smartLab.config';

const storage = multer.memoryStorage();
const MAX_BYTES = () => getSmartLabMaxPdfMb() * 1024 * 1024;

const pdfFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const mt = (file.mimetype || '').toLowerCase();
  if (mt !== 'application/pdf' && mt !== 'application/x-pdf') {
    return cb(new Error('Solo se permiten archivos PDF.'));
  }
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (ext !== 'pdf') {
    return cb(new Error('La extension del archivo debe ser .pdf'));
  }
  cb(null, true);
};

export const smartLabPdfUpload = multer({
  storage,
  fileFilter: pdfFilter,
  limits: {
    fileSize: MAX_BYTES(),
    files: 1,
  },
});
