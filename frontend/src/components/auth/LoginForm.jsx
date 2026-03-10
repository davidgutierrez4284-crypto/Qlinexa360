import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const azul = '#2563eb'; // igual que la cenefa superior
const grisClaro = '#f3f4f6';

const TOOLTIP_2FA_TEXT = 'Paso 1: Abre tu app de autenticación (Google Authenticator o Microsoft Authenticator son las más usadas). Paso 2: Copia el código de 6 dígitos vigente. Paso 3: Pégalo aquí y presiona "Verificar 2FA". Si no tienes acceso, usa "Enviar código por email". La autenticación en dos pasos es la mejor protección contra hackeo de cuentas y protege tus datos clínicos.';

const LoginForm = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isHoveringEye, setIsHoveringEye] = useState(false);
  const [showTooltip2FA, setShowTooltip2FA] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [twoFactorStep, setTwoFactorStep] = useState('none');
  const [tempToken, setTempToken] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [manualSecret, setManualSecret] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const tooltip2FARef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tooltip2FARef.current && !tooltip2FARef.current.contains(e.target)) {
        setShowTooltip2FA(false);
      }
    };
    if (showTooltip2FA) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showTooltip2FA]);

  const handleCopyManualKey = async () => {
    if (!manualSecret) return;
    try {
      await navigator.clipboard.writeText(manualSecret);
      setCopiedKey(true);
      toast.success('Clave copiada al portapapeles');
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      toast.error('No se pudo copiar la clave');
    }
  };
  const { login, setupTwoFactor, verifyTwoFactor, sendTwoFactorRecoveryEmail, verifyTwoFactorRecovery } = useAuth();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setInfo('');
  };

  const navigateByRole = (user) => {
    if (user.role === 'DOCTOR' || user.role === 'ASISTENTE') {
      navigate('/dashboard/dashboard', { replace: true });
    } else if (user.role === 'PATIENT') {
      navigate('/dashboard/medical-records', { replace: true });
    } else if (user.role === 'ADMIN') {
      navigate('/dashboard/dashboard', { replace: true });
    } else {
      navigate('/dashboard/dashboard', { replace: true });
    }
  };

  const resetTwoFactorState = () => {
    setTwoFactorStep('none');
    setTempToken('');
    setQrCodeDataUrl('');
    setManualSecret('');
    setTwoFactorCode('');
    setRecoveryCode('');
    setCopiedKey(false);
    setShowTooltip2FA(false);
    setInfo('');
  };

  const startTwoFactorSetup = async (token) => {
    const data = await setupTwoFactor(token);
    setQrCodeDataUrl(data.qrCodeDataUrl || '');
    setManualSecret(data.secret || '');
    setTwoFactorStep('setup');
    setInfo('Escanea el QR en tu autenticador y confirma el código.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setInfo('');
    try {
      const data = await login(formData.email, formData.password);
      if (data?.requiresTwoFactor) {
        setTempToken(data.tempToken);
        if (data.twoFactorSetupRequired) {
          await startTwoFactorSetup(data.tempToken);
        } else {
          setTwoFactorStep('verify');
          setInfo('Ingresa el código de tu autenticador.');
        }
        return;
      }
      if (data?.user) {
        navigateByRole(data.user);
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión. Verifique sus credenciales.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyTwoFactor = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setInfo('');
    try {
      const data = await verifyTwoFactor(tempToken, twoFactorCode, rememberDevice, formData.email);
      if (data?.user) {
        navigateByRole(data.user);
      }
    } catch (err) {
      setError(err.message || 'Código 2FA inválido.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRecoveryEmail = async () => {
    setIsLoading(true);
    setError('');
    setInfo('');
    try {
      await sendTwoFactorRecoveryEmail(tempToken);
      setTwoFactorStep('recovery');
      setInfo('Te enviamos un código de recuperación por email.');
    } catch (err) {
      setError(err.message || 'No se pudo enviar el correo de recuperación.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyRecovery = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setInfo('');
    try {
      const data = await verifyTwoFactorRecovery(tempToken, recoveryCode);
      const nextToken = data?.tempToken || tempToken;
      if (data?.requiresTwoFactorSetup) {
        setTempToken(nextToken);
        await startTwoFactorSetup(nextToken);
        return;
      }
    } catch (err) {
      setError(err.message || 'Código de recuperación inválido.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: '#f9fafb' }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 400,
          marginTop: 60, // sube el cuadro
          background: '#fff',
          padding: 32,
          borderRadius: 16,
          boxShadow: '0 2px 16px #0002',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <h2 style={{
          textAlign: 'center',
          marginBottom: 8,
          fontWeight: 700,
          fontSize: 32,
          color: '#111827',
          letterSpacing: '-1px',
        }}>
          Iniciar Sesión
        </h2>
        {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
        {info && <div style={{ color: '#2563eb', textAlign: 'center' }}>{info}</div>}
        {twoFactorStep === 'none' ? (
          <>
            <div>
              <label htmlFor="login-email" style={{ fontWeight: 500 }}>Correo Electrónico</label>
              <input
                type="email"
                id="login-email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '12px 10px',
                  marginTop: 6,
                  background: grisClaro,
                  border: '1.5px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 16,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label htmlFor="login-password" style={{ fontWeight: 500 }}>Contraseña</label>
              <div style={{ position: 'relative', marginTop: 6 }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 45px 12px 10px',
                    background: grisClaro,
                    border: '1.5px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 16,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  onMouseEnter={() => setIsHoveringEye(true)}
                  onMouseLeave={() => setIsHoveringEye(false)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isHoveringEye ? '#374151' : '#6b7280',
                    transition: 'color 0.2s',
                  }}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
              <div>
                <input type="checkbox" id="remember-me" name="remember-me" style={{ marginRight: 4 }} />
                <label htmlFor="remember-me" style={{ fontSize: 15 }}>Recordarme</label>
              </div>
              <Link to="/forgot-password" style={{ fontSize: 15, color: azul, fontWeight: 500, textDecoration: 'none' }}>¿Olvidaste tu contraseña?</Link>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: 14,
                background: azul,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 18,
                marginTop: 8,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 4, fontSize: 15 }}>
              ¿No tienes una cuenta?{' '}
              <Link to="/register" style={{ color: azul, fontWeight: 500, textDecoration: 'none' }}>Regístrate aquí</Link>
            </div>
          </>
        ) : (
          <>
            {twoFactorStep === 'setup' && (
              <>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    Configura tu autenticador
                    <span
                      title={
                        'Paso 1: Abre Google Authenticator, Authy u otra app.\n' +
                        'Paso 2: Toca “Agregar” y escanea el QR.\n' +
                        'Paso 3: Si no puedes escanear, usa la clave manual.\n' +
                        'Paso 4: Ingresa aquí el código de 6 dígitos.\n' +
                        'Paso 5: Presiona “Activar 2FA”.'
                      }
                      style={{
                        display: 'inline-flex',
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: '#e5e7eb',
                        color: '#374151',
                        fontSize: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'help',
                      }}
                      aria-label="Ayuda para configurar 2FA"
                    >
                      ?
                    </span>
                  </div>
                  {qrCodeDataUrl && (
                    <img src={qrCodeDataUrl} alt="QR 2FA" style={{ maxWidth: '100%', borderRadius: 8 }} />
                  )}
                  {manualSecret && (
                    <div style={{
                      marginTop: 12,
                      padding: '12px 16px',
                      background: grisClaro,
                      borderRadius: 8,
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                    }}>
                      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Clave manual:</div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}>
                        <code style={{
                          flex: '1 1 auto',
                          minWidth: 0,
                          fontSize: 12,
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          overflowWrap: 'break-word',
                          color: '#374151',
                        }}>
                          {manualSecret}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyManualKey}
                          style={{
                            flexShrink: 0,
                            padding: '6px 12px',
                            fontSize: 12,
                            background: copiedKey ? '#10b981' : azul,
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          {copiedKey ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="twofactor-code" style={{ fontWeight: 500 }}>Código de verificación</label>
                  <input
                    type="text"
                    id="twofactor-code"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 10px',
                      marginTop: 6,
                      background: grisClaro,
                      border: '1.5px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 16,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleVerifyTwoFactor}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: 14,
                    background: azul,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 18,
                    marginTop: 8,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                  }}
                >
                  {isLoading ? 'Verificando...' : 'Activar 2FA'}
                </button>
              </>
            )}
            {twoFactorStep === 'verify' && (
              <>
                <div ref={tooltip2FARef} style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', position: 'relative' }}>
                  <span
                    title={
                      'Paso 1: Abre tu app de autenticación.\n' +
                      'Paso 2: Copia el código de 6 dígitos vigente.\n' +
                      'Paso 3: Pégalo aquí y presiona “Verificar 2FA”.\n' +
                      'Si no tienes acceso, usa “Enviar código por email”.'
                    }
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setShowTooltip2FA((v) => !v)}
                    onKeyDown={(e) => e.key === 'Enter' && setShowTooltip2FA((v) => !v)}
                    role="button"
                    tabIndex={0}
                    aria-label="Ayuda para verificar 2FA"
                  >
                    ¿Cómo usar el código?
                  </span>
                  {showTooltip2FA && (
                    <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, width: 'min(320px, 90vw)', padding: 12, background: '#1f2937', color: '#fff', fontSize: 12, borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)', zIndex: 50, lineHeight: 1.5 }}>
                      {TOOLTIP_2FA_TEXT}
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="twofactor-code-verify" style={{ fontWeight: 500 }}>Código de verificación</label>
                  <input
                    type="text"
                    id="twofactor-code-verify"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 10px',
                      marginTop: 6,
                      background: grisClaro,
                      border: '1.5px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 16,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4b5563', cursor: 'pointer', marginTop: 8 }}>
                  <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} style={{ width: 18, height: 18 }} />
                  Recordar este dispositivo (30 días)
                </label>
                <button
                  type="button"
                  onClick={handleVerifyTwoFactor}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: 14,
                    background: azul,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 18,
                    marginTop: 8,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                  }}
                >
                  {isLoading ? 'Verificando...' : 'Verificar 2FA'}
                </button>
                <button
                  type="button"
                  onClick={handleSendRecoveryEmail}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: 12,
                    background: '#e5e7eb',
                    color: '#111827',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 14,
                    marginTop: 8,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? 'Enviando...' : 'Enviar código por email'}
                </button>
              </>
            )}
            {twoFactorStep === 'recovery' && (
              <>
                <div>
                  <label htmlFor="twofactor-recovery-code" style={{ fontWeight: 500 }}>Código de recuperación</label>
                  <input
                    type="text"
                    id="twofactor-recovery-code"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 10px',
                      marginTop: 6,
                      background: grisClaro,
                      border: '1.5px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 16,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleVerifyRecovery}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: 14,
                    background: azul,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 18,
                    marginTop: 8,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                  }}
                >
                  {isLoading ? 'Verificando...' : 'Verificar código'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={resetTwoFactorState}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: 12,
                background: 'transparent',
                color: '#6b7280',
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                marginTop: 4,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
          </>
        )}
      </form>
      <style>{`
        @media (max-width: 600px) {
          form {
            max-width: 95vw !important;
            padding: 18px !important;
            border-radius: 10px !important;
          }
        }
        @media (max-width: 400px) {
          form {
            padding: 8px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginForm; 