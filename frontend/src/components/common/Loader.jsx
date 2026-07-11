import React from 'react';

const Loader = ({ text = 'Cargando...' }) => {
  return (
    <div className="fixed inset-0 bg-white bg-opacity-75 backdrop-blur-sm flex flex-col items-center justify-center z-50">
      <div className="flex flex-col items-center">
        <img src="/logo.svg" alt="Qlinexa360" className="h-20 w-20 animate-pulse" />
        <h2 className="mt-4 text-2xl font-bold text-blue-600">Qlinexa360</h2>
        <p className="text-gray-500 mt-2">{text}</p>
      </div>
    </div>
  );
};

export default Loader; 