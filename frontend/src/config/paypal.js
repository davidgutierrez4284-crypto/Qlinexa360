export const PAYPAL_CONFIG = {
  // Credenciales de PayPal (cambiar en producción)
  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID,
  // Plan de suscripción mensual
  subscriptionPlan: {
    // Caso A (1ra inscripción, sin promo, sin referido): QLX360-ALTA-BASE-NOREF → VITE_PAYPAL_PLAN_ID
    // Reanudar sin promo: VITE_PAYPAL_PLAN_RESUME (sin trial); ver ResumeSubscriptionPayment.jsx
    planId: import.meta.env.VITE_PAYPAL_PLAN_ID, // ID del plan creado en PayPal
    amount: '499.00',
    currency: 'MXN',
    interval: 'MONTH',
    description: 'Acceso a Qlinexa360 para 1 doctor durante 1 mes'
  }
}; 