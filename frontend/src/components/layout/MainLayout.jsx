import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ResumeSubscriptionButton from '../common/ResumeSubscriptionButton';
import { useAuth } from '../../context/AuthContext';

const MainLayout = ({ children }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pt-16">
      <Header onMenuClick={() => setMenuOpen(!menuOpen)} />
      {user && menuOpen && (
        <>
          {/* Overlay: cerrar menú al hacer click fuera */}
          <div
            className="fixed inset-0 top-16 z-40 bg-black/30 md:bg-transparent"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed top-16 left-0 z-50">
            <Sidebar onClose={() => setMenuOpen(false)} />
          </div>
        </>
      )}
      <div className={`transition-all duration-300 ease-in-out flex-1 min-w-0 flex flex-col ${user && menuOpen ? 'md:ml-64' : ''}`}>
        <main className="flex-1 flex flex-col min-h-0 min-w-0 px-4 py-4 w-full max-w-7xl mx-auto overflow-y-auto">
          {children}
        </main>
      </div>
      {/* Botón flotante para reanudar suscripción cuando está cancelada */}
      <ResumeSubscriptionButton />
    </div>
  );
};

export default MainLayout; 