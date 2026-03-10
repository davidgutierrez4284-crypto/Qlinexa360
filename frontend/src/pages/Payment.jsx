import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../context/SubscriptionContext';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { PAYPAL_CONFIG } from '../config/paypal';
import axios from 'axios';
import { toast } from 'react-toastify';

const Payment = () => {
  const navigate = useNavigate();
  const { updateSubscriptionStatus } = useSubscription();

  const handleSubscriptionSuccess = async (data) => {
    try {
      await axios.post('/api/doctors/renew-subscription', {
        subscriptionId: data.subscriptionID,
        planId: PAYPAL_CONFIG.subscriptionPlan.planId
      });

      updateSubscriptionStatus('ACTIVE');
      toast.success('¡Suscripción renovada exitosamente!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error al procesar la suscripción:', error);
      toast.error('Error al procesar la suscripción. Por favor, intenta de nuevo.');
    }
  };

  const handleSubscriptionError = (err) => {
    console.error('Error en la suscripción de PayPal:', err);
    toast.error('Error al procesar el pago. Por favor, intenta de nuevo.');
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Suscripción Mensual
        </h2>
        
        {/* Información de la suscripción */}
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="font-semibold text-blue-900 mb-2">Detalles de la Suscripción</h3>
            <ul className="space-y-2 text-blue-700">
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Monto mensual: $499 mxn/mes IVA incluido
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Cargo recurrente mensual
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Cancelación en cualquier momento
              </li>
            </ul>
          </div>

          {/* Términos y condiciones */}
          <div className="text-sm text-gray-600">
            <p className="mb-2">
              Al hacer clic en "Pagar con PayPal", aceptas que:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Se te cobrará $499 mxn/mes IVA incluido de forma automática cada mes</li>
              <li>El cargo se realizará automáticamente a la tarjeta registrada en tu cuenta PayPal</li>
              <li>Puedes cancelar tu suscripción en cualquier momento desde tu cuenta de PayPal o desde esta plataforma</li>
              <li>Tu acceso continuará hasta el final del período pagado con posibilidad de ocupar todas las funcionalidades</li>
            </ul>
          </div>

          {/* Botón de PayPal */}
          <div className="flex justify-center">
            <PayPalScriptProvider options={{ 
              clientId: PAYPAL_CONFIG.clientId,
              vault: true,
              intent: 'subscription'
            }}>
              <PayPalButtons
                style={{ layout: 'vertical' }}
                createSubscription={(data, actions) => {
                  return actions.subscription.create({
                    plan_id: PAYPAL_CONFIG.subscriptionPlan.planId
                  });
                }}
                onApprove={handleSubscriptionSuccess}
                onError={handleSubscriptionError}
              />
            </PayPalScriptProvider>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment; 