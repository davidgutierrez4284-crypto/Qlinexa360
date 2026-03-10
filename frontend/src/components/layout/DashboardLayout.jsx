import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Bars3Icon } from '@heroicons/react/24/outline';
import Sidebar from './Sidebar';

const DashboardLayout = () => {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user'));
  const [menuOpen, setMenuOpen] = useState(false);

  // Obtener el nombre de la sección activa
  const getActiveSection = () => {
    const sections = {
      '/dashboard': 'Dashboard',
      '/calendario': 'Calendario',
      '/patients': 'Mis Pacientes',
      '/medical-records': 'Historial Clínico',
      '/prescriptions': 'Recetas',
      '/documents': 'Documentos de estudio',
      '/billing': 'Relación de facturación',
      '/profile': 'Mi perfil',
      '/benefits': 'Beneficios'
    };
    return sections[location.pathname] || '';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Cenefa azul superior */}
      <div className="bg-blue-600 h-16 shadow-md flex items-center justify-between px-6 w-full fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center space-x-2">
          <Link to="/dashboard/benefits" className="flex items-center space-x-2">
            <img
              src="/logo.svg"
              alt="Qlinexa360 Logo"
              className="h-8 w-8"
            />
            <span className="text-white text-xl font-semibold">Qlinexa360</span>
          </Link>
          {/* Menú de hamburguesa */}
          {user && (
            <button
              className="ml-4 text-white focus:outline-none"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Bars3Icon className="h-7 w-7" />
            </button>
          )}
          {/* Nombre de la sección activa centrado */}
          <span className="text-white text-lg font-semibold mx-auto absolute left-1/2 transform -translate-x-1/2">
            {getActiveSection()}
          </span>
        </div>
      </div>

      {/* Sidebar */}
      {user && menuOpen && <Sidebar />}

      {/* Layout principal con padding superior para la cenefa y lateral para el sidebar */}
      <main className="flex-1 flex flex-col pt-20 pl-64 pr-4 pb-8 w-full max-w-7xl mx-auto">
        <div className="flex-1">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <Outlet />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout; 