export const PAYPAL_CONFIG = {
  // Credenciales de PayPal (cambiar en producción)
  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID,
  // Plan de suscripción mensual
  subscriptionPlan: {
    planId: import.meta.env.VITE_PAYPAL_PLAN_ID, // ID del plan creado en PayPal
    amount: '499.00',
    currency: 'MXN',
    interval: 'MONTH',
    description: 'Acceso a Qlinexa360 para 1 doctor durante 1 mes'
  }
}; 