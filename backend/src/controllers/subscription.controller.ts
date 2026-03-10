import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { sendEmail } from '../utils/email.utils';
import { AuthRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

// Función para obtener token de acceso de PayPal
const getPayPalAccessToken = async (): Promise<string | null> => {
  try {
    const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim();
    const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
    const isSandbox = process.env.PAYPAL_ENVIRONMENT === 'sandbox' || !process.env.PAYPAL_ENVIRONMENT;
    const baseUrl = isSandbox 
      ? 'https://api-m.sandbox.paypal.com' 
      : 'https://api-m.paypal.com';

    if (!clientId || !clientSecret) {
      console.error('PayPal credentials not configured (clientId:', !!clientId, ', clientSecret:', !!clientSecret, ')');
      return null;
    }

    const response = await axios.post(
      `${baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: clientId,
          password: clientSecret,
        },
      }
    );

    return response.data.access_token;
  } catch (error: any) {
    const paypalError = error.response?.data;
    const status = error.response?.status;
    console.error('Error obteniendo token de PayPal:', { status, error: paypalError?.error || paypalError?.error_description || error.message });
    return null;
  }
};

export const renewSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId, planId } = req.body;
    if (!req.user) {
      return res.status(401).json({ message: "No autorizado" });
    }
    
    if (!req.user.doctorId) {
      return res.status(400).json({ message: "Usuario no es un doctor" });
    }
    
    const doctorId = req.user.doctorId;

    // Verificar la suscripción con PayPal
    try {
      const paypalAccessToken = await getPayPalAccessToken();
      if (paypalAccessToken) {
        const isSandbox = process.env.PAYPAL_ENVIRONMENT === 'sandbox' || !process.env.PAYPAL_ENVIRONMENT;
        const baseUrl = isSandbox 
          ? 'https://api-m.sandbox.paypal.com' 
          : 'https://api-m.paypal.com';

        const paypalResponse = await axios.get(
          `${baseUrl}/v1/billing/subscriptions/${subscriptionId}`,
          {
            headers: {
              'Authorization': `Bearer ${paypalAccessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (paypalResponse.data.status !== 'ACTIVE' && paypalResponse.data.status !== 'APPROVAL_PENDING') {
          return res.status(400).json({ error: `La suscripción no está activa. Estado: ${paypalResponse.data.status}` });
        }
      }
    } catch (paypalError: any) {
      console.error('Error verificando suscripción en PayPal:', paypalError.response?.data || paypalError.message);
      // Continuar con la actualización en BD aunque falle la verificación
    }

    // Obtener la suscripción actual para verificar si hay una anterior
    const existingSubscription = await prisma.subscription.findUnique({
      where: { doctorId }
    });

    // Si existe una suscripción anterior en PayPal diferente, cancelarla
    if (existingSubscription?.paypalSubscriptionId && existingSubscription.paypalSubscriptionId !== subscriptionId) {
      try {
        const paypalAccessToken = await getPayPalAccessToken();
        if (paypalAccessToken) {
          const isSandbox = process.env.PAYPAL_ENVIRONMENT === 'sandbox' || !process.env.PAYPAL_ENVIRONMENT;
          const baseUrl = isSandbox 
            ? 'https://api-m.sandbox.paypal.com' 
            : 'https://api-m.paypal.com';

          await axios.post(
            `${baseUrl}/v1/billing/subscriptions/${existingSubscription.paypalSubscriptionId}/cancel`,
            { 
              reason: 'Reemplazada por nueva suscripción' 
            },
            {
              headers: {
                'Authorization': `Bearer ${paypalAccessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('Suscripción anterior de PayPal cancelada');
        }
      } catch (error: any) {
        console.error('Error cancelando suscripción anterior:', error.response?.data || error.message);
        // Continuar aunque falle
      }
    }

    // Calcular nueva fecha de fin (30 días desde hoy)
    const now = new Date();
    const newEndDate = new Date(now);
    newEndDate.setDate(newEndDate.getDate() + 30);

    // Actualizar la suscripción en la base de datos
    const subscription = await prisma.subscription.upsert({
      where: {
        doctorId
      },
      update: {
        paypalSubscriptionId: subscriptionId,
        paypalPlanId: planId,
        status: 'ACTIVE',
        startDate: now,
        endDate: newEndDate,
        cancelledAt: null,
        cancellationReason: null,
        updatedAt: new Date()
      },
      create: {
        doctorId,
        paypalSubscriptionId: subscriptionId,
        paypalPlanId: planId,
        status: 'ACTIVE',
        startDate: now,
        endDate: newEndDate,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Enviar email de confirmación si existe el usuario
    try {
      const doctor = await prisma.doctor.findUnique({
        where: { id: doctorId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      if (doctor?.user) {
        await sendEmail(
          doctor.user.email,
          'Suscripción Reanudada - Qlinexa360',
          `Hola ${doctor.user.firstName || ''}, tu suscripción ha sido reanudada exitosamente.

Los cargos mensuales se realizarán normalmente a partir de ahora por $499 mxn/mes IVA incluido.

Próximo cargo: ${newEndDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}

¡Gracias por confiar en Qlinexa360!`
        );
      }
    } catch (emailError) {
      console.error('Error enviando email de confirmación:', emailError);
      // No fallar si el email falla
    }

    res.json({
      message: 'Suscripción renovada exitosamente',
      subscription
    });
  } catch (error) {
    console.error('Error al renovar suscripción:', error);
    res.status(500).json({ error: 'Error al procesar la suscripción' });
  }
};

export const getSubscriptionStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "No autorizado" });
    }
    
    // ASISTENTE y PATIENT son usuarios gratuitos: no tienen suscripción propia
    if (req.user.role === 'ASISTENTE' || req.user.role === 'PATIENT') {
      return res.json({ status: 'ACTIVE' });
    }
    
    if (!req.user.doctorId) {
      return res.status(400).json({ message: "Usuario no es un doctor" });
    }
    
    const doctorId = req.user.doctorId;

    const subscription = await prisma.subscription.findUnique({
      where: { doctorId }
    });

    if (!subscription) {
      return res.json({ status: 'EXPIRED' });
    }

    // Verificar si la suscripción está activa
    const now = new Date();
    if (subscription.endDate < now) {
      await prisma.subscription.update({
        where: { doctorId },
        data: { status: 'EXPIRED' }
      });
      return res.json({ status: 'EXPIRED' });
    }

    res.json({ status: subscription.status });
  } catch (error) {
    console.error('Error al obtener estado de suscripción:', error);
    res.status(500).json({ error: 'Error al obtener estado de suscripción' });
  }
};

// Obtener detalles completos de la suscripción
export const getSubscriptionDetails = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "No autorizado" });
    }

    if (!req.user.doctorId) {
      return res.status(400).json({ message: "Usuario no es un doctor" });
    }

    const doctorId = req.user.doctorId;

    const subscription = await prisma.subscription.findUnique({
      where: { doctorId }
    });

    if (!subscription) {
      return res.status(404).json({ message: "Suscripción no encontrada" });
    }

    // Calcular fechas - todos los cargos son mensuales consecutivos (30 días)
    // Corregir fechas si endDate es anterior a hoy (usar fecha actual como base)
    const now = new Date();
    const correctedEndDate = subscription.endDate > now ? subscription.endDate : now;
    
    const freeMonthEndDate = subscription.freeMonthUsed ? correctedEndDate : null;
    const nextChargeDate = subscription.freeMonthUsed 
      ? (subscription.resumeDate && subscription.resumeDate > now 
          ? subscription.resumeDate 
          : (() => {
              // Si se usó el mes gratis, el siguiente cargo es 30 días después del fin del mes gratis
              const date = new Date(correctedEndDate);
              date.setDate(date.getDate() + 30);
              return date;
            })())
      : correctedEndDate;

    res.json({
      status: subscription.status,
      endDate: subscription.endDate.toISOString(),
      freeMonthUsed: subscription.freeMonthUsed || false,
      freeMonthEndDate: freeMonthEndDate ? freeMonthEndDate.toISOString() : null,
      nextChargeDate: nextChargeDate.toISOString(),
      resumeDate: subscription.resumeDate ? subscription.resumeDate.toISOString() : null
    });
  } catch (error) {
    console.error('Error al obtener detalles de suscripción:', error);
    res.status(500).json({ error: 'Error al obtener detalles de suscripción' });
  }
};

export const handlePayPalWebhook = async (req: Request, res: Response) => {
  try {
    const event = req.body;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      return res.status(400).json({ error: "Falta webhookId" });
    }
    // Verificar la firma del webhook
    const isValid = await verifyWebhookSignature(req, webhookId);
    if (!isValid) {
      return res.status(401).json({ error: 'Firma de webhook inválida' });
    }

    // Procesar diferentes tipos de eventos
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(event);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(event);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        await handlePaymentCompleted(event);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(event);
        break;

      case 'BILLING.SUBSCRIPTION.REACTIVATED':
        // Cuando PayPal reanuda una suscripción después de estar suspendida
        await handleSubscriptionResumed(event);
        break;

      default:
        console.log('Evento no manejado:', event.event_type);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error al procesar webhook:', error);
    res.status(500).json({ error: 'Error al procesar webhook' });
  }
};

const verifyWebhookSignature = async (req: Request, webhookId: string): Promise<boolean> => {
  try {
    const response = await axios.post(
      'https://api-m.paypal.com/v1/notifications/verify-webhook-signature',
      {
        auth_algo: req.headers['paypal-auth-algo'],
        cert_url: req.headers['paypal-cert-url'],
        transmission_id: req.headers['paypal-transmission-id'],
        transmission_sig: req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: req.body
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PAYPAL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('Error al verificar firma del webhook:', error);
    return false;
  }
};

const handleSubscriptionActivated = async (event: any) => {
  const subscription = event.resource;
  const doctor = await prisma.doctor.findFirst({
    where: {
      subscription: {
        paypalSubscriptionId: subscription.id
      }
    },
    include: {
      user: true
    }
  });

  if (doctor) {
    await prisma.subscription.update({
      where: { doctorId: doctor.id },
      data: {
        status: 'ACTIVE',
        startDate: new Date(subscription.start_time),
        endDate: new Date(subscription.billing_info.next_billing_time),
        updatedAt: new Date()
      }
    });

    // Enviar email de confirmación
    await sendEmail(
      doctor.user.email,
      'Suscripción Activada - Qlinexa360',
      `Tu suscripción ha sido activada exitosamente. Tu acceso está activo hasta ${new Date(subscription.billing_info.next_billing_time).toLocaleDateString()}.`
    );
  }
};

const handleSubscriptionCancelled = async (event: any) => {
  const subscription = event.resource;
  const doctor = await prisma.doctor.findFirst({
    where: {
      subscription: {
        paypalSubscriptionId: subscription.id
      }
    },
    include: {
      user: true
    }
  });

  if (doctor) {
    await prisma.subscription.update({
      where: { doctorId: doctor.id },
      data: {
        status: 'EXPIRED',
        updatedAt: new Date()
      }
    });

    // Enviar email de cancelación
    await sendEmail(
      doctor.user.email,
      'Suscripción Cancelada - Qlinexa360',
      'Tu suscripción ha sido cancelada. Tu acceso seguirá activo hasta el final del período pagado.'
    );
  }
};

const handlePaymentCompleted = async (event: any) => {
  const payment = event.resource;
  const subId = payment.billing_agreement_id;
  if (!subId) return;

  const doctor = await prisma.doctor.findFirst({
    where: {
      subscription: {
        paypalSubscriptionId: subId
      }
    },
    include: {
      user: true,
      subscription: true
    }
  });

  if (doctor?.subscription) {
    // Extender endDate 30 días al recibir cada pago (renovación mensual)
    const newEndDate = new Date(doctor.subscription.endDate);
    newEndDate.setDate(newEndDate.getDate() + 30);
    await prisma.subscription.update({
      where: { doctorId: doctor.id },
      data: { endDate: newEndDate, updatedAt: new Date() }
    });
    // Enviar email de confirmación de pago
    await sendEmail(
      doctor.user.email,
      'Pago Recibido - Qlinexa360',
      `Hemos recibido tu pago de $${payment.amount?.total || '499'} ${payment.amount?.currency || 'MXN'}. Gracias por tu confianza.`
    );
  }
};

const handleSubscriptionSuspended = async (event: any) => {
  const subscription = event.resource;
  const doctor = await prisma.doctor.findFirst({
    where: {
      subscription: {
        paypalSubscriptionId: subscription.id
      }
    },
    include: {
      user: true,
      subscription: true
    }
  });

  if (doctor) {
    // Solo actualizar a SUSPENDED si no es una pausa programada por mes gratis
    if (!doctor.subscription?.resumeDate) {
      await prisma.subscription.update({
        where: { doctorId: doctor.id },
        data: {
          status: 'SUSPENDED',
          updatedAt: new Date()
        }
      });

      // Enviar email de suspensión
      await sendEmail(
        doctor.user.email,
        'Suscripción Suspendida - Qlinexa360',
        'Tu suscripción ha sido suspendida debido a un problema con el pago. Por favor, actualiza tu información de pago para reactivar tu acceso.'
      );
    }
  }
};

// Manejar reanudación de suscripción (después del mes gratis)
const handleSubscriptionResumed = async (event: any) => {
  const subscription = event.resource;
  const doctor = await prisma.doctor.findFirst({
    where: {
      subscription: {
        paypalSubscriptionId: subscription.id
      }
    },
    include: {
      user: true,
      subscription: true
    }
  });

  if (doctor && doctor.subscription) {
    // Si tiene resumeDate y estamos después de esa fecha, limpiar el campo
    if (doctor.subscription.resumeDate && new Date() >= doctor.subscription.resumeDate) {
      await prisma.subscription.update({
        where: { doctorId: doctor.id },
        data: {
          status: 'ACTIVE',
          resumeDate: null, // Limpiar la fecha de reanudación
          updatedAt: new Date()
        }
      });

      // Enviar email de confirmación
      await sendEmail(
        doctor.user.email,
        'Suscripción Reanudada - Qlinexa360',
        `Hola ${doctor.user.firstName || ''}, tu suscripción ha sido reanudada. Los cargos mensuales se realizarán normalmente a partir de ahora por $499 mxn/mes IVA incluido.`
      );
    }
  }
};

// Extender suscripción 1 mes gratis (solo una vez)
export const extendSubscriptionFreeMonth = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "No autorizado" });
    }

    if (!req.user.doctorId) {
      return res.status(400).json({ message: "Usuario no es un doctor" });
    }

    const doctorId = req.user.doctorId;

    // Obtener la suscripción del doctor
    const subscription = await prisma.subscription.findUnique({
      where: { doctorId },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ message: "Suscripción no encontrada" });
    }

    // Verificar si ya se usó el mes gratis
    if (subscription.freeMonthUsed) {
      return res.status(400).json({ 
        message: "Ya has utilizado tu mes gratis. Por favor, contacta con soporte para más opciones.",
        freeMonthUsed: true
      });
    }

    // Extender la suscripción 1 mes (30 días) - todos los cargos son mensuales consecutivos
    // Usar la fecha actual como base si endDate es anterior a hoy (corrige fechas incorrectas)
    const now = new Date();
    const baseDate = subscription.endDate > now ? subscription.endDate : now;
    const newEndDate = new Date(baseDate);
    // Agregar exactamente 30 días para mantener consistencia mensual
    newEndDate.setDate(newEndDate.getDate() + 30);

    // La reanudación/cargo es cuando termina el mes gratis (mismo día que newEndDate)
    const resumeDate = new Date(newEndDate);

    // 1. Pausar la suscripción en PayPal para evitar el cobro durante el mes gratis
    // Si tiene PayPal: DEBE suspenderse primero. Si falla, no actualizamos BD (evitar estado inconsistente).
    // Si es LIFETIME (sin PayPal): solo actualizamos BD.
    const hasPayPal = !!(subscription.paypalSubscriptionId && subscription.paypalSubscriptionId.trim() !== '');

    if (hasPayPal) {
      const paypalAccessToken = await getPayPalAccessToken();
      if (!paypalAccessToken) {
        return res.status(503).json({
          success: false,
          message: 'No se pudo conectar con PayPal. Por favor, intenta más tarde o contacta a soporte.'
        });
      }

      try {
        const isSandbox = process.env.PAYPAL_ENVIRONMENT === 'sandbox' || !process.env.PAYPAL_ENVIRONMENT;
        const baseUrl = isSandbox 
          ? 'https://api-m.sandbox.paypal.com' 
          : 'https://api-m.paypal.com';

        await axios.post(
          `${baseUrl}/v1/billing/subscriptions/${subscription.paypalSubscriptionId}/suspend`,
          { reason: 'Mes gratis otorgado - pausa temporal' },
          {
            headers: {
              'Authorization': `Bearer ${paypalAccessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (paypalError: any) {
        const errMsg = paypalError.response?.data?.message || paypalError.message;
        console.error('Error al pausar suscripción en PayPal:', paypalError.response?.data || paypalError.message);
        return res.status(502).json({
          success: false,
          message: `No se pudo pausar la suscripción en PayPal: ${errMsg}. Tu mes gratis no se aplicó. Por favor, contacta a soporte.`
        });
      }
    }

    // 2. Actualizar en la base de datos (solo si PayPal suspendió OK o no tiene PayPal)
    await prisma.subscription.update({
      where: { doctorId },
      data: {
        endDate: newEndDate,
        freeMonthUsed: true,
        resumeDate: resumeDate, // Guardar la fecha de reanudación
        updatedAt: new Date()
      }
    });

    // Enviar email de confirmación
    const user = subscription.doctor.user;
    const paypalNote = hasPayPal
      ? 'Tu suscripción ha sido pausada temporalmente en PayPal para evitar cargos durante este mes.'
      : '';
    await sendEmail(
      user.email,
      'Mes gratis otorgado - Qlinexa360',
      `Hola ${user.firstName || ''}, te hemos otorgado 1 mes adicional gratis en tu suscripción de Qlinexa360. 
      
${paypalNote}

Fecha del mes gratis: ${newEndDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
Fecha de reanudación de cargos: ${resumeDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}

Los cargos mensuales se reanudarán automáticamente después del mes gratis por $499 mxn/mes IVA incluido.`
    );

    res.json({
      success: true,
      message: hasPayPal
        ? 'Se ha extendido tu suscripción 1 mes gratis. La suscripción de PayPal ha sido pausada temporalmente.'
        : 'Se ha extendido tu suscripción 1 mes gratis.',
      newEndDate: newEndDate.toISOString(),
      resumeDate: resumeDate.toISOString()
    });
  } catch (error) {
    console.error('Error al extender suscripción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al extender la suscripción'
    });
  }
};

// Verificar si el usuario ya usó el mes gratis
export const checkFreeMonthUsed = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "No autorizado" });
    }

    if (!req.user.doctorId) {
      return res.status(400).json({ message: "Usuario no es un doctor" });
    }

    const doctorId = req.user.doctorId;

    const subscription = await prisma.subscription.findUnique({
      where: { doctorId },
      select: {
        freeMonthUsed: true
      }
    });

    if (!subscription) {
      return res.status(404).json({ message: "Suscripción no encontrada" });
    }

    res.json({
      freeMonthUsed: subscription.freeMonthUsed || false
    });
  } catch (error) {
    console.error('Error al verificar mes gratis:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar el estado del mes gratis'
    });
  }
};

/** Lógica compartida: reanudar suscripciones que pasaron su resumeDate. Usado por controller y cron. */
export async function runResumeSuspendedSubscriptions(): Promise<{ success: boolean; count: number; results: any[] }> {
  const now = new Date();
  const subscriptionsToResume = await prisma.subscription.findMany({
      where: {
        resumeDate: {
          lte: now // Fecha de reanudación ya pasó
        },
        freeMonthUsed: true,
        status: {
          not: 'CANCELLED'
        }
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
  });

  const results: any[] = [];

  for (const subscription of subscriptionsToResume) {
      try {
        if (subscription.paypalSubscriptionId) {
          const paypalAccessToken = await getPayPalAccessToken();
          if (paypalAccessToken) {
            const isSandbox = process.env.PAYPAL_ENVIRONMENT === 'sandbox' || !process.env.PAYPAL_ENVIRONMENT;
            const baseUrl = isSandbox 
              ? 'https://api-m.sandbox.paypal.com' 
              : 'https://api-m.paypal.com';

            // Reanudar la suscripción en PayPal
            await axios.post(
              `${baseUrl}/v1/billing/subscriptions/${subscription.paypalSubscriptionId}/activate`,
              {
                reason: 'Reanudación después del mes gratis'
              },
              {
                headers: {
                  'Authorization': `Bearer ${paypalAccessToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            // Actualizar en la base de datos
            await prisma.subscription.update({
              where: { doctorId: subscription.doctorId },
              data: {
                status: 'ACTIVE',
                resumeDate: null,
                updatedAt: new Date()
              }
            });

            // Enviar email de confirmación
            if (subscription.doctor && subscription.doctor.user) {
              await sendEmail(
                subscription.doctor.user.email,
                'Suscripción Reanudada - Qlinexa360',
                `Hola ${subscription.doctor.user.firstName || ''}, tu suscripción ha sido reanudada. Los cargos mensuales se realizarán normalmente a partir de ahora por $499 mxn/mes IVA incluido.`
              );
            }

            results.push({ 
              doctorId: subscription.doctorId, 
              status: 'resumed',
              message: 'Suscripción reanudada exitosamente' 
            });
          }
        }
    } catch (error: any) {
      console.error(`Error reanudando suscripción para doctor ${subscription.doctorId}:`, error);
      results.push({ 
        doctorId: subscription.doctorId, 
        status: 'error',
        message: error.message || 'Error al reanudar suscripción' 
      });
    }
  }

  return { success: true, count: subscriptionsToResume.length, results };
}

// Reanudar suscripciones que han pasado su fecha de reanudación
export const resumeSuspendedSubscriptions = async (req: Request, res: Response) => {
  try {
    const { success, count, results } = await runResumeSuspendedSubscriptions();
    res.json({
      success,
      message: `Procesadas ${count} suscripción(es)`,
      results
    });
  } catch (error: any) {
    console.error('Error al reanudar suscripciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reanudar suscripciones'
    });
  }
};

// Reanudar una suscripción cancelada manualmente
export const resumeCancelledSubscription = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "No autorizado" });
    }

    if (!req.user.doctorId) {
      return res.status(400).json({ message: "Usuario no es un doctor" });
    }

    const doctorId = req.user.doctorId;

    // Obtener la suscripción
    const subscription = await prisma.subscription.findUnique({
      where: { doctorId },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ message: "Suscripción no encontrada" });
    }

    if (subscription.status !== 'CANCELLED') {
      return res.status(400).json({ message: "La suscripción no está cancelada" });
    }

    // 1. Reanudar en PayPal si existe paypalSubscriptionId
    if (subscription.paypalSubscriptionId) {
      try {
        const paypalAccessToken = await getPayPalAccessToken();
        if (paypalAccessToken) {
          const isSandbox = process.env.PAYPAL_ENVIRONMENT === 'sandbox' || !process.env.PAYPAL_ENVIRONMENT;
          const baseUrl = isSandbox 
            ? 'https://api-m.sandbox.paypal.com' 
            : 'https://api-m.paypal.com';

          // Reanudar la suscripción en PayPal
          await axios.post(
            `${baseUrl}/v1/billing/subscriptions/${subscription.paypalSubscriptionId}/activate`,
            {
              reason: 'Reanudación de suscripción cancelada'
            },
            {
              headers: {
                'Authorization': `Bearer ${paypalAccessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('Suscripción reanudada en PayPal exitosamente');
        }
      } catch (paypalError: any) {
        console.error('Error al reanudar suscripción en PayPal:', paypalError.response?.data || paypalError.message);
        // Continuar con la reanudación en BD aunque falle PayPal
      }
    }

    // 2. Calcular nueva fecha de fin (30 días desde hoy)
    const now = new Date();
    const newEndDate = new Date(now);
    newEndDate.setDate(newEndDate.getDate() + 30);

    // 3. Actualizar en la base de datos
    await prisma.subscription.update({
      where: { doctorId },
      data: {
        status: 'ACTIVE',
        startDate: now,
        endDate: newEndDate,
        cancelledAt: null,
        cancellationReason: null,
        updatedAt: new Date(),
      }
    });

    // 4. Enviar email de confirmación
    const user = subscription.doctor.user;
    await sendEmail(
      user.email,
      'Suscripción Reanudada - Qlinexa360',
      `Hola ${user.firstName || ''}, tu suscripción ha sido reanudada exitosamente.

Los cargos mensuales se realizarán normalmente a partir de ahora por $499 mxn/mes IVA incluido.

Próximo cargo: ${newEndDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}

¡Gracias por confiar en Qlinexa360!`
    );

    res.json({
      success: true,
      message: 'Suscripción reanudada correctamente',
      endDate: newEndDate.toISOString()
    });
  } catch (error) {
    console.error('Error al reanudar suscripción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reanudar la suscripción'
    });
  }
};

// Reanudar suscripción cancelada con un nuevo pago de PayPal
export const resumeWithPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId, planId } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: "No autorizado" });
    }

    if (!req.user.doctorId) {
      return res.status(400).json({ message: "Usuario no es un doctor" });
    }

    if (!subscriptionId) {
      return res.status(400).json({ message: "subscriptionId es requerido" });
    }

    const doctorId = req.user.doctorId;

    // Obtener la suscripción actual
    const subscription = await prisma.subscription.findUnique({
      where: { doctorId },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ message: "Suscripción no encontrada" });
    }

    if (subscription.status !== 'CANCELLED') {
      return res.status(400).json({ message: "La suscripción no está cancelada" });
    }

    // Verificar la suscripción con PayPal
    try {
      const paypalAccessToken = await getPayPalAccessToken();
      if (paypalAccessToken) {
        const isSandbox = process.env.PAYPAL_ENVIRONMENT === 'sandbox' || !process.env.PAYPAL_ENVIRONMENT;
        const baseUrl = isSandbox 
          ? 'https://api-m.sandbox.paypal.com' 
          : 'https://api-m.paypal.com';

        const paypalResponse = await axios.get(
          `${baseUrl}/v1/billing/subscriptions/${subscriptionId}`,
          {
            headers: {
              'Authorization': `Bearer ${paypalAccessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (paypalResponse.data.status !== 'ACTIVE' && paypalResponse.data.status !== 'APPROVAL_PENDING') {
          return res.status(400).json({ 
            message: `La suscripción de PayPal no está activa. Estado: ${paypalResponse.data.status}` 
          });
        }
      }
    } catch (paypalError: any) {
      console.error('Error verificando suscripción en PayPal:', paypalError.response?.data || paypalError.message);
      // Continuar con la actualización en BD aunque falle la verificación
    }

    // Si existe una suscripción anterior en PayPal, cancelarla
    if (subscription.paypalSubscriptionId && subscription.paypalSubscriptionId !== subscriptionId) {
      try {
        const paypalAccessToken = await getPayPalAccessToken();
        if (paypalAccessToken) {
          const isSandbox = process.env.PAYPAL_ENVIRONMENT === 'sandbox' || !process.env.PAYPAL_ENVIRONMENT;
          const baseUrl = isSandbox 
            ? 'https://api-m.sandbox.paypal.com' 
            : 'https://api-m.paypal.com';

          await axios.post(
            `${baseUrl}/v1/billing/subscriptions/${subscription.paypalSubscriptionId}/cancel`,
            { 
              reason: 'Reemplazada por nueva suscripción' 
            },
            {
              headers: {
                'Authorization': `Bearer ${paypalAccessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('Suscripción anterior de PayPal cancelada');
        }
      } catch (error: any) {
        console.error('Error cancelando suscripción anterior:', error.response?.data || error.message);
        // Continuar aunque falle
      }
    }

    // Calcular nueva fecha de fin (30 días desde hoy)
    const now = new Date();
    const newEndDate = new Date(now);
    newEndDate.setDate(newEndDate.getDate() + 30);

    // Actualizar en la base de datos con el nuevo paypalSubscriptionId
    await prisma.subscription.update({
      where: { doctorId },
      data: {
        status: 'ACTIVE',
        paypalSubscriptionId: subscriptionId,
        paypalPlanId: planId || subscription.paypalPlanId,
        startDate: now,
        endDate: newEndDate,
        cancelledAt: null,
        cancellationReason: null,
        updatedAt: new Date(),
      }
    });

    // Enviar email de confirmación
    const user = subscription.doctor.user;
    await sendEmail(
      user.email,
      'Suscripción Reanudada - Qlinexa360',
      `Hola ${user.firstName || ''}, tu suscripción ha sido reanudada exitosamente.

Los cargos mensuales se realizarán normalmente a partir de ahora por $499 mxn/mes IVA incluido.

Próximo cargo: ${newEndDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}

¡Gracias por confiar en Qlinexa360!`
    );

    res.json({
      success: true,
      message: 'Suscripción reanudada correctamente',
      endDate: newEndDate.toISOString()
    });
  } catch (error) {
    console.error('Error al reanudar suscripción con pago:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reanudar la suscripción'
    });
  }
};

export const cancelSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!req.user) {
      return res.status(401).json({ message: "No autorizado" });
    }

    if (!req.user.doctorId) {
      return res.status(400).json({ message: "Usuario no es un doctor" });
    }

    const doctorId = req.user.doctorId;

    // Obtener la suscripción para obtener el paypalSubscriptionId
    const subscription = await prisma.subscription.findUnique({
      where: { doctorId },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ message: "Suscripción no encontrada" });
    }

    let paypalCancelSucceeded = !subscription.paypalSubscriptionId; // Sin PayPal = OK
    if (subscription.paypalSubscriptionId) {
      try {
        const paypalAccessToken = await getPayPalAccessToken();
        if (paypalAccessToken) {
          const isSandbox = process.env.PAYPAL_ENVIRONMENT === 'sandbox' || !process.env.PAYPAL_ENVIRONMENT;
          const baseUrl = isSandbox 
            ? 'https://api-m.sandbox.paypal.com' 
            : 'https://api-m.paypal.com';

          await axios.post(
            `${baseUrl}/v1/billing/subscriptions/${subscription.paypalSubscriptionId}/cancel`,
            { 
              reason: `Cancelado por el usuario: ${reason || 'Sin razón especificada'}` 
            },
            {
              headers: {
                'Authorization': `Bearer ${paypalAccessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          paypalCancelSucceeded = true;
          console.log('Suscripción cancelada en PayPal exitosamente');
        }
      } catch (paypalError: any) {
        console.error('Error al cancelar suscripción en PayPal:', paypalError.response?.data || paypalError.message);
        // Continuar con la cancelación en BD aunque falle PayPal
      }
    } else {
      paypalCancelSucceeded = true; // Sin PayPal, no hay nada que cancelar
    }

    // 2. Actualizar en la base de datos usando el doctorId
    await prisma.subscription.update({
      where: { doctorId },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason || null,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      }
    });

    // 3. Enviar email de confirmación
    const user = subscription.doctor.user;
    await sendEmail(
      user.email,
      'Suscripción cancelada - Qlinexa360',
      `Hola ${user.firstName || ''}, tu suscripción ha sido cancelada. Motivo: ${reason || 'No especificado'}

Puedes seguir consultando tus expedientes clínicos por hasta 5 años conforme a la NOM-004-SSA3-2012.

Si cambias de opinión, puedes reactivar tu suscripción en cualquier momento.`
    );

    res.json({
      success: true,
      message: 'Suscripción cancelada correctamente',
      paypalCancelSucceeded
    });
  } catch (error) {
    console.error('Error al cancelar suscripción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar la suscripción'
    });
  }
};

/**
 * Sincronizar mes gratis con PayPal (reparación).
 * Para suscripciones con freeMonthUsed=true que no se suspendieron en PayPal.
 * Uso: POST /api/admin/reports/subscriptions/sync-free-month-paypal
 * Body: { doctorId?: string, email?: string } - doctorId o email para un doctor; si no, repara todos.
 */
export const syncFreeMonthToPayPal = async (req: Request, res: Response) => {
  try {
    const { doctorId, email } = req.body || {};

    const where: any = {
      freeMonthUsed: true,
      status: { not: 'CANCELLED' }
    };
    if (doctorId) {
      where.doctorId = doctorId;
    } else if (email) {
      const user = await prisma.user.findUnique({ where: { email: String(email).trim() }, select: { id: true } });
      if (!user) {
        return res.status(404).json({ success: false, message: `Usuario no encontrado con email: ${email}` });
      }
      const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!doctor) {
        return res.status(404).json({ success: false, message: `No hay doctor asociado al email: ${email}` });
      }
      where.doctorId = doctor.id;
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        doctor: {
          include: {
            user: { select: { email: true, firstName: true, lastName: true } }
          }
        }
      }
    });

    const results: Array<{ doctorId: string; email?: string; status: string; message: string }> = [];
    const paypalAccessToken = await getPayPalAccessToken();

    if (!paypalAccessToken) {
      return res.status(503).json({
        success: false,
        message: 'No se pudo conectar con PayPal (credenciales no configuradas o inválidas)',
        results: []
      });
    }

    const isSandbox = process.env.PAYPAL_ENVIRONMENT === 'sandbox' || !process.env.PAYPAL_ENVIRONMENT;
    const baseUrl = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

    for (const sub of subscriptions) {
      const hasPayPal = !!(sub.paypalSubscriptionId && sub.paypalSubscriptionId.trim() !== '');
      if (!hasPayPal) {
        results.push({
          doctorId: sub.doctorId,
          email: sub.doctor?.user?.email,
          status: 'skipped',
          message: 'Sin suscripción PayPal (ej. LIFETIME)'
        });
        continue;
      }

      try {
        await axios.post(
          `${baseUrl}/v1/billing/subscriptions/${sub.paypalSubscriptionId}/suspend`,
          { reason: 'Reparación: mes gratis de retención - pausa temporal' },
          {
            headers: {
              'Authorization': `Bearer ${paypalAccessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        results.push({
          doctorId: sub.doctorId,
          email: sub.doctor?.user?.email,
          status: 'suspended',
          message: 'Suscripción pausada en PayPal correctamente'
        });
      } catch (err: any) {
        const msg = (err.response?.data?.message || err.message || '').toLowerCase();
        const alreadySuspended = msg.includes('suspended') || msg.includes('suspendida') || msg.includes('pause');
        if (alreadySuspended) {
          results.push({
            doctorId: sub.doctorId,
            email: sub.doctor?.user?.email,
            status: 'already_suspended',
            message: 'Suscripción ya estaba pausada en PayPal'
          });
        } else {
          results.push({
            doctorId: sub.doctorId,
            email: sub.doctor?.user?.email,
            status: 'error',
            message: err.response?.data?.message || err.message || 'Error al pausar en PayPal'
          });
        }
      }
    }

    res.json({
      success: true,
      message: `Procesadas ${subscriptions.length} suscripción(es)`,
      results
    });
  } catch (error: any) {
    console.error('Error en syncFreeMonthToPayPal:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al sincronizar'
    });
  }
};

/**
 * Corregir resumeDate para suscripciones con mes gratis.
 * Bug: resumeDate se calculaba como endDate+30, debe ser endDate (primer cargo = fin del mes gratis).
 * POST /api/admin/reports/subscriptions/fix-resume-date
 * Body: { email: string }
 * Header: X-Admin-Report-Token o X-Seed-Token
 */
export const fixResumeDateForFreeMonth = async (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'email es requerido' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true }
    });
    if (!user) {
      return res.status(404).json({ success: false, message: `Usuario no encontrado: ${email}` });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: { id: true }
    });
    if (!doctor) {
      return res.status(404).json({ success: false, message: `No hay doctor asociado: ${email}` });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { doctorId: doctor.id }
    });
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Suscripción no encontrada' });
    }
    if (!subscription.freeMonthUsed) {
      return res.status(400).json({ success: false, message: 'Esta suscripción no tiene mes gratis aplicado' });
    }

    const newResumeDate = new Date(subscription.endDate);
    await prisma.subscription.update({
      where: { doctorId: doctor.id },
      data: { resumeDate: newResumeDate, updatedAt: new Date() }
    });

    return res.json({
      success: true,
      message: 'resumeDate corregido',
      details: {
        email,
        endDate: subscription.endDate.toISOString(),
        resumeDate: newResumeDate.toISOString(),
        nextChargeDate: newResumeDate.toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error en fixResumeDateForFreeMonth:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al corregir'
    });
  }
};