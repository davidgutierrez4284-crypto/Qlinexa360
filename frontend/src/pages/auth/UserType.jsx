import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const UserType = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);

  const handleUserTypeSelect = (type) => {
    setSelected(type);
    setTimeout(() => {
      if (type === 'doctor' || type === 'nurse') navigate('/register?type=doctor');
      else if (type === 'patient') navigate('/register?type=patient');
    }, 300);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Selecciona tu tipo de cuenta
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Elige el tipo de cuenta que mejor se adapte a tus necesidades
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex flex-row gap-4">
            <button
              onClick={() => handleUserTypeSelect('nurse')}
              className={`flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white transition-all duration-150 ${selected === 'nurse' ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              style={{ minWidth: 160 }}
            >
              <svg
                className="h-6 w-6 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Soy Enfermer@
            </button>
            <button
              onClick={() => handleUserTypeSelect('doctor')}
              className={`flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white transition-all duration-150 ${selected === 'doctor' ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              style={{ minWidth: 160 }}
            >
              <svg
                className="h-6 w-6 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Soy profesional de la salud
            </button>
          </div>
          <div className="flex justify-center mt-2">
            <button
              onClick={() => handleUserTypeSelect('patient')}
              className={`flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white transition-all duration-150 ${selected === 'patient' ? 'bg-blue-700' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
              style={{ minWidth: 160 }}
            >
              <svg
                className="h-6 w-6 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Soy Paciente
            </button>
          </div>
        </div>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            ¿Ya tienes una cuenta?{' '}
            <button
              onClick={() => navigate('/login')}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Inicia sesión aquí
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserType; 