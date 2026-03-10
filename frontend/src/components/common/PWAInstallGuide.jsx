import React, { useState } from 'react';
import { 
  DevicePhoneMobileIcon, 
  ComputerDesktopIcon, 
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const PWAInstallGuide = () => {
  const [activeTab, setActiveTab] = useState('mobile');

  const mobileSteps = [
    {
      title: 'Chrome (Android)',
      steps: [
        'Abre Qlinexa360 en Chrome',
        'Toca el menú (⋮) en la esquina superior derecha',
        'Selecciona "Instalar aplicación" o "Añadir a pantalla de inicio"',
        'Confirma la instalación'
      ]
    },
    {
      title: 'Safari (iPhone/iPad)',
      steps: [
        'Abre Qlinexa360 en Safari',
        'Toca el botón de compartir (□↑) en la barra inferior',
        'Selecciona "Añadir a pantalla de inicio"',
        'Confirma la instalación'
      ]
    }
  ];

  const desktopSteps = [
    {
      title: 'Chrome (Windows/Mac/Linux)',
      steps: [
        'Abre Qlinexa360 en Chrome',
        'Busca el ícono de instalación (⬇️) en la barra de direcciones',
        'Haz clic en "Instalar Qlinexa360"',
        'Confirma la instalación'
      ]
    },
    {
      title: 'Edge (Windows)',
      steps: [
        'Abre Qlinexa360 en Edge',
        'Busca el ícono de instalación (⬇️) en la barra de direcciones',
        'Haz clic en "Instalar Qlinexa360"',
        'Confirma la instalación'
      ]
    }
  ];

  const benefits = [
    'Acceso rápido desde el escritorio o pantalla de inicio',
    'Funciona offline para consultar información guardada',
    'Experiencia similar a una aplicación nativa',
    'Notificaciones push para recordatorios importantes',
    'Mejor rendimiento y navegación'
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="flex-shrink-0">
          <img src="/logo.svg" alt="Qlinexa360" className="h-12 w-12" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Instalar Qlinexa360 como Aplicación
          </h3>
          <p className="text-sm text-gray-500">
            Convierte Qlinexa360 en una aplicación de escritorio o móvil
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('mobile')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'mobile'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DevicePhoneMobileIcon className="h-5 w-5" />
            <span>Móvil</span>
          </button>
          <button
            onClick={() => setActiveTab('desktop')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'desktop'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ComputerDesktopIcon className="h-5 w-5" />
            <span>Escritorio</span>
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'mobile' && (
          <div className="space-y-4">
            {mobileSteps.map((platform, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">{platform.title}</h4>
                <ol className="space-y-2">
                  {platform.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {stepIndex + 1}
                      </span>
                      <span className="text-sm text-gray-600">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'desktop' && (
          <div className="space-y-4">
            {desktopSteps.map((platform, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">{platform.title}</h4>
                <ol className="space-y-2">
                  {platform.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {stepIndex + 1}
                      </span>
                      <span className="text-sm text-gray-600">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {/* Benefits */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <InformationCircleIcon className="h-5 w-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-2">
                Beneficios de instalar Qlinexa360
              </h4>
              <ul className="space-y-1">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center space-x-2 text-sm text-blue-800">
                    <CheckCircleIcon className="h-4 w-4 text-blue-500" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="text-xs text-gray-500 text-center">
          <p>
            💡 <strong>Consejo:</strong> Si ves un banner de instalación en la parte inferior de la pantalla, 
            puedes hacer clic en "Instalar" para una instalación rápida.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallGuide;
