import React from 'react';
import Header from './Header';

const PublicLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="pt-16">
        {children}
      </main>
    </div>
  );
};

export default PublicLayout; 