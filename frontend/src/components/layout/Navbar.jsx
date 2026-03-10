import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from '../icons/MedicalIcon';
import TestNotification from '../TestNotification';

const Navbar = () => {
  const location = useLocation();
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname);

  console.log('Navbar: Component rendering, isAuthPage:', isAuthPage);

  return (
    <nav className="bg-indigo-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex items-center">
              <Logo className="h-8 w-8" />
            </Link>
          </div>

          {!isAuthPage && (
            <div className="flex items-center space-x-4">
              {console.log('Navbar: Rendering TestNotification')}
              <TestNotification />
              <Link
                to="/profile"
                className="text-white hover:text-indigo-100 px-3 py-2 rounded-md text-sm font-medium"
              >
                Perfil
              </Link>
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }}
                className="text-white hover:text-indigo-100 px-3 py-2 rounded-md text-sm font-medium"
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 