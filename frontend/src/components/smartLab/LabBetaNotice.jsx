import React from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

export const LAB_BETA_SUPPORT_EMAIL = 'admin@qlinexa360.com';

export const LAB_BETA_NOTICE_TEXT =
  'Esta es una versión Beta que debe fortalecerse con los diversos formatos de laboratorio. Si encuentra que no interpreta bien los resultados, envíe su estudio tapando los datos personales (para mantenerlo anónimo) a ';

const LabBetaNotice = ({ className = '' }) => (
  <div
    role="note"
    className={
      'flex gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 ' + className
    }
  >
    <InformationCircleIcon className="h-5 w-5 flex-shrink-0 text-blue-600" aria-hidden />
    <div className="min-w-0 space-y-2">
      <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
        Beta
      </span>
      <p>
        {LAB_BETA_NOTICE_TEXT}
        <a
          href={'mailto:' + LAB_BETA_SUPPORT_EMAIL}
          className="font-medium text-blue-700 underline hover:text-blue-900"
        >
          {LAB_BETA_SUPPORT_EMAIL}
        </a>
        . Solo con esa contribución podremos lograr que la plataforma interprete automáticamente la mayoría de
        los estudios.
      </p>
    </div>
  </div>
);

export default LabBetaNotice;
