import React from 'react';

const LogoMedilink = ({ size = 48 }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12
  }}>
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: '16%',
      background: '#1976d2', // azul Material UI
      boxShadow: '0 2px 8px rgba(25, 118, 210, 0.08)'
    }}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="14" width="24" height="16" rx="4" stroke="white" strokeWidth="2.5" fill="none"/>
        <rect x="14" y="10" width="12" height="8" rx="2" stroke="white" strokeWidth="2.5" fill="none"/>
        <rect x="18.5" y="20" width="3" height="8" rx="1.5" fill="white"/>
        <rect x="14" y="23.5" width="12" height="3" rx="1.5" fill="white"/>
      </svg>
    </span>
    <span style={{
      color: '#1976d2',
      fontWeight: 800,
      fontSize: size * 0.45,
      letterSpacing: 1,
      fontFamily: 'Montserrat, Roboto, Arial, sans-serif'
    }}>
      Qlinexa360
    </span>
  </div>
);

export default LogoMedilink; 