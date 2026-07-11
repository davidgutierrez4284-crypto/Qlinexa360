import React from 'react';
import PrivacyPolicyFullBody from '../legal/PrivacyPolicyFullBody';

const AvisoPrivacidad = () => {
  return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-6">Aviso de Privacidad</h1>
          <p className="text-gray-600 mb-8">Última actualización: Mayo 2026</p>

          <div className="prose prose-gray max-w-none">
            <PrivacyPolicyFullBody className="space-y-6 text-gray-700" />
          </div>

          <footer className="mt-10 pt-6 border-t border-gray-200 text-gray-700 text-sm space-y-2">
            <p>
              <span className="font-semibold">Contacto:</span>{' '}
              <a href="mailto:admin@qlinexa360.com" className="text-blue-600 hover:text-blue-800">admin@qlinexa360.com</a>
              {' · '}
              <a href="mailto:legal@qlinexa360.com" className="text-blue-600 hover:text-blue-800">legal@qlinexa360.com</a>
            </p>
            <p><span className="font-semibold">Última actualización:</span> Mayo 2026</p>
          </footer>
        </div>
      </div>
  );
};

export default AvisoPrivacidad;
