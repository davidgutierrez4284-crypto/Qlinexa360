import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../context/SubscriptionContext';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { PAYPAL_CONFIG } from '../config/paypal';
import axios from 'axios';
import { toast } from 'react-toastify';
import { getApiUrl } from '../utils/api';

const validatePromo = async (code) => {
  const normalized = (code || '').trim().toUpperCase().replace(/\s+/g, '');
  const response = await axios.post(getApiUrl('/api/promo/validate'), { code: normalized });
  return response.data;
};

const ResumeSubscriptionPayment = () => {
  const navigate = useNavigate();
  const { updateSubscriptionStatus, checkSubscriptionStatus } = useSubscription();
  const [promoCode, setPromoCode] = useState('');
  const [promoCodeType, setPromoCodeType] = useState('');
  const [promoCodeStatus, setPromoCodeStatus] = useState('');
  const [promoCodeLoading, setPromoCodeLoading] = useState(false);
  const [lifetimeLoading, setLifetimeLoading] = useState(false);

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) {
      setPromoCodeStatus('Ingresa un código');
      setPromoCodeType('');
      return;
    }
    setPromoCodeLoading(true);
    setPromoCodeStatus('');
    try {
      const data = await validatePromo(promoCode);
      if (data.valid) {
        setPromoCodeType(data.type);
        setPromoCodeStatus(data.message || 'Código válido');
      } else {
        setPromoCodeType('');
        setPromoCodeStatus(data.message || 'Código no válido');
      }
    } catch (e) {
      setPromoCodeType('');
      setPromoCodeStatus(
        e.response?.data?.message || 'No se pudo validar el código. Intenta de nuevo.'
      );
    } finally {
      setPromoCodeLoading(false);
    }
  };

  const handleLifetimeApply = async () => {
    if (!promoCode.trim() || promoCodeType !== 'LIFETIME') return;
    setLifetimeLoading(true);
    try {
      await axios.post(
        '/api/subscriptions/renew',
        { promoCode: promoCode.trim() },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      updateSubscriptionStatus('ACTIVE');
      await checkSubscriptionStatus();
      window.dispatchEvent(new Event('userUpdated'));
      toast.success('¡Código de por vida aplicado correctamente!');
      navigate('/dashboard/profile');
    } catch (e) {
      console.error(e);
      toast.error(
        e.response?.data?.error || e.response?.data?.message || 'No se pudo aplicar el código'
      );
    } finally {
      setLifetimeLoading(false);
    }
  };

  const handleSubscriptionSuccess = async (data) => {
    const planIdBase = import.meta.env.VITE_PAYPAL_PLAN_ID || '';
    const planIdResume =
      import.meta.env.VITE_PAYPAL_PLAN_RESUME || planIdBase;
    const planIdTrial1M =
      import.meta.env.VITE_PAYPAL_PLAN_ID_TRIAL_1M_RESUME ||
      import.meta.env.VITE_PAYPAL_PLAN_ID_TRIAL_1M ||
      planIdBase;
    const planIdTrial3M =
      import.meta.env.VITE_PAYPAL_PLAN_ID_TRIAL_3M_RESUME ||
      import.meta.env.VITE_PAYPAL_PLAN_ID_TRIAL_3M ||
      planIdBase;
    const expectedPlanId =
      promoCodeType === 'DISCOUNT_50_3M'
        ? planIdTrial3M
        : promoCodeType === 'TRIAL_30D' || promoCodeType === 'REACTIVATION_30D'
          ? planIdTrial1M
          : planIdResume;

    try {
      const body = {
        subscriptionId: data.subscriptionID,
        planId: expectedPlanId || PAYPAL_CONFIG.subscriptionPlan.planId
      };
      if (promoCodeType) {
        body.promoCode = promoCode.trim();
      }
      await axios.post('/api/subscriptions/renew', body, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      updateSubscriptionStatus('ACTIVE');
      await checkSubscriptionStatus();
      window.dispatchEvent(new Event('userUpdated'));
      toast.success('¡Suscripción reanudada exitosamente!');
      navigate('/dashboard/profile');
    } catch (error) {
      console.error('Error al procesar la suscripción:', error);
      toast.error('Error al procesar la suscripción. Por favor, intenta de nuevo.');
    }
  };

  const handleSubscriptionError = (err) => {
    console.error('Error en la suscripción de PayPal:', err);
    toast.error('Error al procesar el pago. Por favor, intenta de nuevo.');
  };

  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';
  const planIdBase = import.meta.env.VITE_PAYPAL_PLAN_ID || '';
  const planIdResume =
    import.meta.env.VITE_PAYPAL_PLAN_RESUME || planIdBase;
  const planIdTrial1M =
    import.meta.env.VITE_PAYPAL_PLAN_ID_TRIAL_1M_RESUME ||
    import.meta.env.VITE_PAYPAL_PLAN_ID_TRIAL_1M ||
    planIdBase;
  const planIdTrial3M =
    import.meta.env.VITE_PAYPAL_PLAN_ID_TRIAL_3M_RESUME ||
    import.meta.env.VITE_PAYPAL_PLAN_ID_TRIAL_3M ||
    planIdBase;
  const planIdForButton =
    promoCodeType === 'DISCOUNT_50_3M'
      ? planIdTrial3M
      : promoCodeType === 'TRIAL_30D' || promoCodeType === 'REACTIVATION_30D'
        ? planIdTrial1M
        : planIdResume;

  const showPayPal =
    !promoCodeType ||
    promoCodeType === 'TRIAL_30D' ||
    promoCodeType === 'DISCOUNT_50_3M' ||
    promoCodeType === 'REACTIVATION_30D';

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Reanudar suscripción
        </h2>
        <p className="text-sm text-gray-600 text-center mb-6">
          Puedes ingresar un código promocional (mismos códigos que en el registro) o suscribirte con
          PayPal.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código promocional</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value);
                  setPromoCodeType('');
                  setPromoCodeStatus('');
                }}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                placeholder="Opcional"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={handleValidatePromo}
                disabled={promoCodeLoading}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md font-medium hover:bg-gray-300 disabled:opacity-50"
              >
                {promoCodeLoading ? 'Validando...' : 'Validar'}
              </button>
            </div>
            {promoCodeStatus && (
              <p
                className={`mt-1 text-sm ${
                  promoCodeStatus.includes('válido') || promoCodeStatus.includes('Código válido') || promoCodeType
                    ? 'text-green-600'
                    : 'text-red-500'
                }`}
              >
                {promoCodeStatus}
              </p>
            )}
          </div>
        </div>

        {promoCodeType === 'LIFETIME' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm text-amber-900 font-medium mb-2">Código de acceso de por vida</p>
            <p className="text-xs text-amber-800 mb-3">
              No requiere PayPal. Al aplicar, tu acceso queda activo según el código.
            </p>
            <button
              type="button"
              onClick={handleLifetimeApply}
              disabled={lifetimeLoading}
              className="w-full py-2 bg-amber-600 text-white rounded-md font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              {lifetimeLoading ? 'Aplicando...' : 'Activar con este código'}
            </button>
          </div>
        )}

        {showPayPal && (
          <>
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-md">
                <h3 className="font-semibold text-blue-900 mb-2">Detalles de la suscripción</h3>
                <ul className="space-y-2 text-blue-700 text-sm">
                  <li>• Monto: $499 mxn/mes IVA incluido (tras el periodo promocional, si aplica)</li>
                  <li>• Cargo recurrente con PayPal</li>
                </ul>
              </div>

              <div className="text-sm text-gray-600">
                <p className="mb-2">Al usar PayPal, aceptas los términos de la suscripción mensual.</p>
                {(promoCodeType === 'TRIAL_30D' || promoCodeType === 'REACTIVATION_30D') && (
                  <p className="text-green-700 font-medium">
                    Con este código, no se te cobrará durante el primer mes; luego $499/mes.
                  </p>
                )}
                {promoCodeType === 'DISCOUNT_50_3M' && (
                  <p className="text-green-700 font-medium">
                    Con este código, no se te cobrará durante 3 meses; luego $499/mes.
                  </p>
                )}
              </div>

              {!paypalClientId ? (
                <p className="text-red-600 text-sm">Falta la configuración de PayPal (VITE_PAYPAL_CLIENT_ID).</p>
              ) : !planIdForButton ? (
                <p className="text-red-600 text-sm">
                  Falta el plan de suscripción (VITE_PAYPAL_PLAN_RESUME sin promo, o planes trial / VITE_PAYPAL_PLAN_ID).
                </p>
              ) : (
                <div className="flex justify-center">
                  <PayPalScriptProvider
                    options={{
                      clientId: paypalClientId,
                      vault: true,
                      intent: 'subscription'
                    }}
                  >
                    <PayPalButtons
                      key={planIdForButton}
                      style={{ layout: 'vertical' }}
                      createSubscription={(data, actions) => {
                        return actions.subscription.create({
                          plan_id: planIdForButton
                        });
                      }}
                      onApprove={handleSubscriptionSuccess}
                      onError={handleSubscriptionError}
                    />
                  </PayPalScriptProvider>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResumeSubscriptionPayment;
