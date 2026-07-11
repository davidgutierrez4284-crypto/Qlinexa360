import React from 'react';
import Header from './Header';
import { useAuth } from '../../context/AuthContext';

/** Altura del header público: barra azul (h-14 / sm:h-16) + franja de enlaces legales. */
const PUBLIC_MAIN_TOP_GUEST = 'pt-[6.5rem] sm:pt-[7rem]';

const PublicLayout = ({ children }) => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className={user ? 'pt-16' : PUBLIC_MAIN_TOP_GUEST}>
        {children}
      </main>
    </div>
  );
};

export default PublicLayout; 