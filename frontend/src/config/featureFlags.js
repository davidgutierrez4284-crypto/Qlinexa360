/**
 * Flags leídos en tiempo de build (Vite `import.meta.env`).
 *
 * Referidos: en `production` solo se activan con `VITE_ENABLE_REFERRALS=true`.
 * En desarrollo: `frontend/.env.development` fija `true`; para ocultar sin tocar el repo,
 * usa `.env.development.local` con `VITE_ENABLE_REFERRALS=false` (ver `.cursor/rules/referidos-feature-flag.mdc`).
 */
export const isReferralsFeatureEnabled = () => {
  const v = import.meta.env.VITE_ENABLE_REFERRALS;
  if (import.meta.env.PROD) {
    return v === 'true';
  }
  if (v === 'false' || v === '0') return false;
  return true;
};

/**
 * Laboratorio Inteligente: desactivado por defecto en todos los entornos.
 * Activar solo con VITE_SMART_LAB_ENABLED=true (ver frontend/.env.example).
 */
export const isSmartLabEnabled = () => {
  const v = import.meta.env.VITE_SMART_LAB_ENABLED;
  return v === 'true' || v === '1';
};
