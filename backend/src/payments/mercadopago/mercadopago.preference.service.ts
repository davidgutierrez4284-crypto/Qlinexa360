import { randomUUID } from 'crypto';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { MercadoPagoApiClient } from './mercadopago.api.client';
import { calculateMarketplaceFee } from './mercadopago.commission.utils';
import { getMercadoPagoReturnBaseUrl, mercadoPagoConfig } from './mercadopago.config';
import { MercadoPagoOAuthService } from './mercadopago.oauth.service';

type CreatePreferenceParams = {
  doctorId: string;
  patientId: string;
  appointmentId?: string | null;
  amount: number;
  currency: string;
  paymentType: 'teleconsultation' | 'in_person';
  concept: string;
  payerEmail?: string;
  confirmationToken?: string;
};

function mapMpStatus(status: string): 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back' {
  switch (status) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'charged_back':
      return 'charged_back';
    default:
      return 'pending';
  }
}

export class MercadoPagoPreferenceService {
  static async createPreference(params: CreatePreferenceParams) {
    const accessToken = await MercadoPagoOAuthService.getValidAccessToken(params.doctorId);
    const externalReference = randomUUID();
    const { feeAmount, feePercent } = await calculateMarketplaceFee({
      amount: params.amount,
      paymentType: params.paymentType,
    });

    const returnBase = getMercadoPagoReturnBaseUrl();
    const webhookUrl = `${env.BASE_URL || 'http://localhost:3000'}/api/payments/mercadopago/webhook`;

    const preferencePayload: Record<string, unknown> = {
      items: [
        {
          id: externalReference,
          title: params.concept.slice(0, 256),
          quantity: 1,
          unit_price: params.amount,
          currency_id: params.currency,
        },
      ],
      payer: params.payerEmail ? { email: params.payerEmail } : undefined,
      external_reference: externalReference,
      notification_url: webhookUrl,
      metadata: {
        appointment_id: params.appointmentId || '',
        doctor_id: params.doctorId,
        patient_id: params.patientId,
        payment_type: params.paymentType,
      },
    };

    if (returnBase) {
      if (params.confirmationToken) {
        if (params.paymentType === 'teleconsultation') {
          preferencePayload.back_urls = {
            success: `${returnBase}/teleconsulta/${params.confirmationToken}?payment=success`,
            failure: `${returnBase}/teleconsulta/${params.confirmationToken}?payment=failure`,
            pending: `${returnBase}/teleconsulta/${params.confirmationToken}?payment=pending`,
          };
        } else {
          preferencePayload.back_urls = {
            success: `${returnBase}/confirm-appointment/${params.confirmationToken}?payment=success`,
            failure: `${returnBase}/confirm-appointment/${params.confirmationToken}?payment=failure`,
            pending: `${returnBase}/confirm-appointment/${params.confirmationToken}?payment=pending`,
          };
        }
      } else {
        preferencePayload.back_urls = {
          success: `${returnBase}/dashboard/mis-citas?payment=success`,
          failure: `${returnBase}/dashboard/mis-citas?payment=failure`,
          pending: `${returnBase}/dashboard/mis-citas?payment=pending`,
        };
      }
      preferencePayload.auto_return = 'approved';
    }

    // En sandbox la comisión marketplace suele dejar la orden en payment_required aunque la UI muestre éxito.
    if (feeAmount > 0 && mercadoPagoConfig.env !== 'sandbox') {
      preferencePayload.marketplace_fee = feeAmount;
    }

    const preference = await MercadoPagoApiClient.createPreference(accessToken, preferencePayload);
    const checkoutUrl =
      mercadoPagoConfig.env === 'sandbox' && preference.sandbox_init_point
        ? preference.sandbox_init_point
        : preference.init_point || preference.sandbox_init_point || null;

    const payment = await prisma.mercadoPagoPayment.create({
      data: {
        doctorId: params.doctorId,
        patientId: params.patientId,
        appointmentId: params.appointmentId || null,
        amount: params.amount,
        currency: params.currency,
        platformCommissionAmount: feeAmount,
        platformCommissionPercent: feePercent,
        status: 'pending',
        paymentType: params.paymentType,
        externalReference,
        providerPreferenceId: preference.id,
        checkoutUrl,
        concept: params.concept,
        metadataJson: {
          confirmationToken: params.confirmationToken || null,
        },
      },
    });

    await prisma.paymentAuditLog.create({
      data: {
        paymentId: payment.id,
        eventType: 'PREFERENCE_CREATED',
        rawPayloadJson: { preferenceId: preference.id, externalReference },
      },
    });

    return { payment, checkoutUrl, externalReference };
  }

  static mapMpStatus = mapMpStatus;
}

export async function getLatestTeleconsultationPayment(appointmentId: string) {
  return prisma.mercadoPagoPayment.findFirst({
    where: {
      appointmentId,
      paymentType: 'teleconsultation',
      status: { notIn: ['cancelled'] },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function isTeleconsultationPaymentApproved(appointmentId: string): Promise<boolean> {
  const payment = await prisma.mercadoPagoPayment.findFirst({
    where: { appointmentId, paymentType: 'teleconsultation', status: 'approved' },
  });
  return !!payment;
}
