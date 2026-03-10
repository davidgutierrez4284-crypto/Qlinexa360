import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../icons/MedicalIcon';

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f7fa' }}>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(25, 118, 210, 0.08)', padding: 32, marginTop: 64 }}>
          <div className="text-center">
            <Link to="/" className="inline-block">
              <Logo className="h-12 w-12 text-white" />
            </Link>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              {title}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {subtitle}
            </p>
          </div>

          <div className="mt-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthLayout; 