import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import LabBetaNotice from './LabBetaNotice';

export const LAB_DISCLAIMER_TEXT =
  'La interpretación clínica de los resultados corresponde exclusivamente al profesional de la salud. Qlinexa360 muestra información estructurada, tendencias y alertas visuales como apoyo, sin sustituir el juicio médico.';

const LabDisclaimer = ({ className = '', showBetaNotice = true }) => (
  <div className={'space-y-3 ' + className}>
    {showBetaNotice ? <LabBetaNotice /> : null}
    <div
      role="note"
      className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden />
      <p>{LAB_DISCLAIMER_TEXT}</p>
    </div>
  </div>
);

export default LabDisclaimer;
