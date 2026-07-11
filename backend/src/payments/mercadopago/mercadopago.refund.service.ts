import { isAxiosError } from 'axios';
import prisma from '../../config/database';
import { NotificationType, MercadoPagoPaymentStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { securityLogger } from '../../utils/logger.utils';
import { MercadoPagoApiClient } from './mercadopago.api.client';
import { decimalToNumber } from './mercadopago.commission.utils';
import { MercadoPagoOAuthService } from './mercadopago.oauth.service';
import { MercadoPagoPreferenceService } from './mercadopago.preference.service';
import { buildPaymentFinancialUpdate } from './mercadopago.payment-fees.utils';
import { mercadoPagoConfig } from './mercadopago.config';
import {
  isMpNotFoundError,
  resolveMpPaymentWithFallback,
} from './mercadopago.payment-resolve.service';
import { cancelAppointmentAfterRefundRequest } from './mercadopago.appointment-display.service';
import { ensureActiveConfirmationRequest } from '../../utils/appointmentConfirmation.utils';

export class RefundRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export type RefundRequestSummary = {
  id: string;
  status: string;
  requestedAmount: number;
  approvedAmount: number | null;
  reason: string;
  doctorNotes: string | null;
  createdAt: Date;
  processedAt: Date | null;
  failureReason: string | null;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function serializeRefundRequest(row: {
  id: string;
  status: string;
  requestedAmount: Decimal | number;
  approvedAmount: Decimal | number | null;
  reason: string;
  doctorNotes: string | null;
  createdAt: Date;
  processedAt: Date | null;
  failureReason: string | null;
}): RefundRequestSummary {
  return {
    id: row.id,
    status: row.status,
    requestedAmount: decimalToNumber(row.requestedAmount),
    approvedAmount: row.approvedAmount != null ? decimalToNumber(row.approvedAmount) : null,
    reason: row.reason,
    doctorNotes: row.doctorNotes,
    createdAt: row.createdAt,
    processedAt: row.processedAt,
    failureReason: row.failureReason,
  };
}

export function getRefundableAmount(payment: {
  amount: Decimal | number;
  refundedAmount: Decimal | number;
  status: string;
}) {
  if (payment.status === 'refunded') return 0;
  if (payment.status !== 'approved') return 0;
  const gross = decimalToNumber(payment.amount);
  const refunded = decimalToNumber(payment.refundedAmount);
  return Math.max(0, roundMoney(gross - refunded));
}

async function resolveAppointmentFromToken(token: string) {
  const confirmationRequest = await prisma.appointmentConfirmationRequest.findUnique({
    where: { confirmationToken: token },
    include: {
      appointment: {
        include: {
          patient: { include: { user: true } },
          doctor: { include: { user: true } },
        },
      },
    },
  });
  if (!confirmationRequest) {
    throw new RefundRequestError('Enlace no encontrado o expirado', 404);
  }
  try {
    await ensureActiveConfirmationRequest(confirmationRequest);
  } catch (tokenErr: any) {
    throw new RefundRequestError(tokenErr.message || 'Este enlace ha expirado', tokenErr.statusCode || 400);
  }
  return confirmationRequest.appointment;
}

async function getApprovedPaymentForAppointment(appointmentId: string) {
  return prisma.mercadoPagoPayment.findFirst({
    where: {
      appointmentId,
      status: 'approved',
      providerPaymentId: { not: null },
    },
    orderBy: { paidAt: 'desc' },
  });
}

async function getActiveRefundRequest(paymentId: string) {
  return prisma.mercadoPagoRefundRequest.findFirst({
    where: {
      paymentId,
      status: { in: ['pending', 'failed'] },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getRefundContextForAppointment(appointmentId: string) {
  const payment = await getApprovedPaymentForAppointment(appointmentId);
  if (!payment) {
    return {
      paymentId: null as string | null,
      canRequestRefund: false,
      refundableAmount: 0,
      refundRequest: null as RefundRequestSummary | null,
    };
  }

  const refundableAmount = getRefundableAmount(payment);
  const latest = await prisma.mercadoPagoRefundRequest.findFirst({
    where: { paymentId: payment.id },
    orderBy: { createdAt: 'desc' },
  });

  const canRequestRefund =
    refundableAmount > 0 &&
    !!payment.providerPaymentId &&
    (!latest || latest.status === 'rejected' || latest.status === 'failed');

  return {
    paymentId: payment.id,
    canRequestRefund,
    refundableAmount,
    refundRequest: latest ? serializeRefundRequest(latest) : null,
  };
}

async function notifyDoctorRefundRequested(params: {
  doctorUserId: string;
  patientName: string;
  amount: number;
  currency: string;
  refundRequestId: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: params.doctorUserId,
        type: NotificationType.SYSTEM_MESSAGE,
        title: 'Solicitud de reembolso',
        message: `${params.patientName} solicitó un reembolso de $${params.amount.toLocaleString('es-MX', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${params.currency}. Revísala en Cobros Mercado Pago.`,
        data: {
          path: '/dashboard/finanzas',
          refundRequestId: params.refundRequestId,
        },
      },
    });
  } catch (err) {
    securityLogger.warn('Refund request notification failed', { err });
  }
}

export async function createRefundRequestByToken(
  token: string,
  input: { reason: string; requestedAmount?: number }
) {
  const reason = String(input.reason || '').trim();
  if (reason.length < 10) {
    throw new RefundRequestError('Describe el motivo del reembolso (mínimo 10 caracteres)');
  }

  const appointment = await resolveAppointmentFromToken(token);
  const payment = await getApprovedPaymentForAppointment(appointment.id);
  if (!payment) {
    throw new RefundRequestError('No hay un pago aprobado asociado a esta cita');
  }

  const refundableAmount = getRefundableAmount(payment);
  if (refundableAmount <= 0) {
    throw new RefundRequestError('Este pago ya fue reembolsado por completo');
  }

  const pending = await getActiveRefundRequest(payment.id);
  if (pending?.status === 'pending') {
    throw new RefundRequestError('Ya existe una solicitud de reembolso pendiente de revisión');
  }

  let requestedAmount = refundableAmount;
  if (input.requestedAmount != null) {
    requestedAmount = roundMoney(Number(input.requestedAmount));
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new RefundRequestError('Monto solicitado inválido');
    }
    if (requestedAmount > refundableAmount) {
      throw new RefundRequestError(
        `El monto solicitado no puede superar $${refundableAmount.toLocaleString('es-MX', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      );
    }
  }

  const patientName =
    `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim() ||
    `${appointment.patient.user?.firstName || ''} ${appointment.patient.user?.lastName || ''}`.trim() ||
    'Paciente';

  const created = await prisma.mercadoPagoRefundRequest.create({
    data: {
      paymentId: payment.id,
      appointmentId: appointment.id,
      doctorId: payment.doctorId,
      patientId: payment.patientId,
      requestedAmount,
      reason,
      status: 'pending',
    },
  });

  await notifyDoctorRefundRequested({
    doctorUserId: appointment.doctor.userId,
    patientName,
    amount: requestedAmount,
    currency: payment.currency,
    refundRequestId: created.id,
  });

  try {
    await cancelAppointmentAfterRefundRequest(appointment.id, reason);
  } catch (cancelErr) {
    securityLogger.warn('Refund request created but appointment cancel sync failed', {
      appointmentId: appointment.id,
      cancelErr,
    });
  }

  return serializeRefundRequest(created);
}

export async function listRefundRequestsForDoctor(
  doctorId: string,
  filters?: { status?: string; limit?: number }
) {
  const where: Record<string, unknown> = { doctorId };
  if (filters?.status) where.status = filters.status;

  const rows = await prisma.mercadoPagoRefundRequest.findMany({
    where,
    include: {
      payment: {
        select: {
          amount: true,
          currency: true,
          status: true,
          providerPaymentId: true,
          refundedAmount: true,
          paidAt: true,
        },
      },
      patient: { select: { firstName: true, lastName: true, email: true } },
      appointment: { select: { date: true, appointmentType: true, confirmationStatus: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(filters?.limit || 50, 100),
  });

  return rows.map((row) => ({
    ...serializeRefundRequest(row),
    payment: {
      id: row.paymentId,
      amount: decimalToNumber(row.payment.amount),
      currency: row.payment.currency,
      status: row.payment.status,
      providerPaymentId: row.payment.providerPaymentId,
      refundedAmount: decimalToNumber(row.payment.refundedAmount),
      paidAt: row.payment.paidAt,
    },
    patient: row.patient,
    appointment: row.appointment,
    appointmentId: row.appointmentId,
  }));
}

async function syncPaymentFromMercadoPago(paymentId: string) {
  const payment = await prisma.mercadoPagoPayment.findUnique({ where: { id: paymentId } });
  if (!payment?.providerPaymentId) return payment;

  try {
    const accessToken = await MercadoPagoOAuthService.getValidAccessToken(payment.doctorId);
    const mpPayment = await MercadoPagoApiClient.getPayment(accessToken, payment.providerPaymentId);
    const mappedStatus = MercadoPagoPreferenceService.mapMpStatus(mpPayment.status);
    const financials =
      mappedStatus === 'approved' ? buildPaymentFinancialUpdate(mpPayment, payment) : undefined;

    return prisma.mercadoPagoPayment.update({
      where: { id: payment.id },
      data: {
        status: mappedStatus,
        ...(financials ?? {}),
      },
    });
  } catch (err) {
    securityLogger.warn('MP sync after refund failed', { paymentId, err });
    return payment;
  }
}

function refundErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function serializeRefundApiError(err: unknown): {
  message: string;
  status?: number;
  mpBody?: unknown;
} {
  if (isAxiosError(err)) {
    return {
      message: err.message,
      status: err.response?.status,
      mpBody: err.response?.data,
    };
  }
  if (err instanceof Error) {
    return { message: err.message };
  }
  return { message: String(err) };
}

function describeRefundTokenLabel(
  token: string,
  labels: {
    platformToken: string | null;
    preferredAccessToken: string | null;
    doctorAccessToken: string;
  }
): string {
  if (labels.platformToken && token === labels.platformToken) return 'platform';
  if (labels.doctorAccessToken && token === labels.doctorAccessToken) return 'doctor';
  if (labels.preferredAccessToken && token === labels.preferredAccessToken) return 'preferred';
  return 'other';
}

export function isInsufficientBalanceRefundError(err: unknown): boolean {
  const msg = refundErrorText(err).toLowerCase();
  if (
    msg.includes('insufficient') ||
    msg.includes('suficiente dinero') ||
    msg.includes('not enough money') ||
    msg.includes('insufficient_amount')
  ) {
    return true;
  }
  if (isAxiosError(err)) {
    const body = JSON.stringify(err.response?.data ?? '').toLowerCase();
    return (
      body.includes('insufficient') ||
      body.includes('suficiente dinero') ||
      body.includes('not enough money')
    );
  }
  return false;
}

export function isRetriableRefundError(err: unknown): boolean {
  if (isMpNotFoundError(err)) return true;
  if (isInsufficientBalanceRefundError(err)) return true;
  if (isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 404 || status === 401) return true;
  }
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes('createRefund 404') || msg.includes('Payment not found')) return true;
    if (msg.includes('createRefund 401') || msg.includes('Unauthorized use of live credentials')) {
      return true;
    }
  }
  return false;
}

export function buildRefundTokenOrder(params: {
  env: string;
  platformToken: string | null;
  preferredAccessToken: string | null;
  doctorAccessToken: string;
}): string[] {
  const { env, platformToken, preferredAccessToken, doctorAccessToken } = params;
  const ordered =
    env === 'production'
      ? [platformToken, preferredAccessToken, doctorAccessToken]
      : [preferredAccessToken, doctorAccessToken, platformToken];
  return [...new Set(ordered.filter(Boolean) as string[])];
}

export function mapMpRefundErrorToUserMessage(err: unknown): string {
  if (isInsufficientBalanceRefundError(err)) {
    return (
      'Mercado Pago rechazó el reembolso: la cuenta del doctor no tiene saldo suficiente para devolver el monto completo. ' +
      'En cobros marketplace (Checkout Pro), el reembolso debe procesarse con la cuenta integradora de Qlinexa360. ' +
      'Si ves este mensaje tras aprobar desde Qlinexa360, contacta a soporte con el ID del cobro.'
    );
  }

  const msg = refundErrorText(err);
  if (
    msg.includes('createRefund 404') ||
    msg.includes('Payment not found') ||
    msg.includes('Unable to resolve Mercado Pago payment')
  ) {
    return (
      'No pudimos localizar este cobro en Mercado Pago para devolverlo automáticamente. ' +
      'Procésalo en tu panel de Mercado Pago (Actividad → buscar el cobro → Devolver dinero). ' +
      'Qlinexa360 lo marcará como reembolsado cuando Mercado Pago lo confirme.'
    );
  }

  if (msg.includes('createRefund 401') || msg.includes('Unauthorized use of live credentials')) {
    return (
      'Mercado Pago rechazó el reembolso por credenciales inválidas para este cobro marketplace. ' +
      'Qlinexa360 intentará reintentar con la cuenta integradora; si persiste, contacta a soporte.'
    );
  }

  if (msg.includes('createRefund 403')) {
    return (
      'Mercado Pago rechazó el reembolso: la cuenta usada no tiene permiso para devolver este cobro marketplace. ' +
      'Verifica que el token integrador de Qlinexa360 en producción sea el de la aplicación marketplace correcta.'
    );
  }

  const lower = msg.toLowerCase();
  if (lower.includes('createRefund 400') && (lower.includes('status') || lower.includes('estado'))) {
    return (
      'Mercado Pago no permite reembolsar este cobro en su estado actual. ' +
      'Revisa el cobro en el panel de Mercado Pago o contacta a soporte con el ID del pago.'
    );
  }

  return 'No pudimos completar el reembolso en Mercado Pago. Intenta de nuevo o contacta a soporte.';
}

function toRefundRequestError(err: unknown): RefundRequestError {
  if (err instanceof RefundRequestError) return err;
  return new RefundRequestError(mapMpRefundErrorToUserMessage(err), 502);
}

/** @deprecated use isRetriableRefundError */
function isRefundNotFoundError(err: unknown): boolean {
  return isRetriableRefundError(err);
}

function isResolveNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('Unable to resolve Mercado Pago payment');
}

async function isSandboxManualApprovedPayment(paymentId: string): Promise<boolean> {
  if (mercadoPagoConfig.env !== 'sandbox') return false;
  const audit = await prisma.paymentAuditLog.findFirst({
    where: { paymentId, eventType: 'SANDBOX_MANUAL_APPROVE' },
    select: { id: true },
  });
  return !!audit;
}

async function executeSandboxLocalRefund(params: {
  payment: {
    id: string;
    providerPaymentId: string | null;
    amount: Decimal | number;
    refundedAmount: Decimal | number;
    status: MercadoPagoPaymentStatus;
  };
  refundRequestId: string;
  approvedAmount: number;
}) {
  const gross = decimalToNumber(params.payment.amount);
  const alreadyRefunded = decimalToNumber(params.payment.refundedAmount);
  const newRefundedTotal = roundMoney(alreadyRefunded + params.approvedAmount);
  const nextStatus: MercadoPagoPaymentStatus =
    newRefundedTotal >= gross ? 'refunded' : params.payment.status;

  await prisma.mercadoPagoPayment.update({
    where: { id: params.payment.id },
    data: {
      refundedAmount: newRefundedTotal,
      status: nextStatus,
    },
  });

  await prisma.paymentAuditLog.create({
    data: {
      paymentId: params.payment.id,
      eventType: 'SANDBOX_LOCAL_REFUND',
      rawPayloadJson: {
        refundRequestId: params.refundRequestId,
        approvedAmount: params.approvedAmount,
        reason: 'Pago aprobado manualmente en sandbox; reembolso registrado solo en Qlinexa360',
      },
    },
  });

  securityLogger.warn('MP sandbox local refund applied (no MP API call)', {
    paymentId: params.payment.id,
    approvedAmount: params.approvedAmount,
  });

  return {
    id: `sandbox-local-${params.refundRequestId}`,
    payment_id: params.payment.providerPaymentId,
    amount: params.approvedAmount,
    status: 'approved',
  };
}

async function createRefundWithFallback(params: {
  payment: {
    id: string;
    doctorId: string;
    providerPaymentId: string | null;
    providerPreferenceId: string | null;
    externalReference: string;
    amount: Decimal | number;
    refundedAmount: Decimal | number;
    status: MercadoPagoPaymentStatus;
  };
  approvedAmount: number;
  isFullRefund: boolean;
  idempotencyKey: string;
  refundRequestId: string;
}) {
  const { payment, approvedAmount, isFullRefund, idempotencyKey, refundRequestId } = params;

  if (await isSandboxManualApprovedPayment(payment.id)) {
    securityLogger.info('MP refund: sandbox manual payment, applying local refund only', {
      localPaymentId: payment.id,
    });
    return executeSandboxLocalRefund({
      payment,
      refundRequestId,
      approvedAmount,
    });
  }

  const doctorAccessToken = await MercadoPagoOAuthService.getValidAccessToken(payment.doctorId);
  const platformToken = mercadoPagoConfig.platformAccessToken || null;
  const refundOptions = {
    amount: isFullRefund ? undefined : approvedAmount,
    idempotencyKey,
  };

  let mpPaymentId = payment.providerPaymentId;
  let resolveSource: string | null = null;
  let preferredAccessToken: string | null = null;

  try {
    const resolved = await resolveMpPaymentWithFallback({
      paymentId: payment.providerPaymentId,
      doctorAccessToken,
      preferenceId: payment.providerPreferenceId,
      externalReference: payment.externalReference,
    });
    mpPaymentId = String(resolved.payment.id);
    resolveSource = resolved.source;
    preferredAccessToken = resolved.accessToken;
    if (payment.providerPaymentId !== mpPaymentId) {
      await prisma.mercadoPagoPayment.update({
        where: { id: payment.id },
        data: { providerPaymentId: mpPaymentId },
      });
    }
  } catch (err) {
    if (!isResolveNotFoundError(err)) throw err;
    securityLogger.warn('MP refund: resolve failed, trying direct refund', {
      localPaymentId: payment.id,
      providerPaymentId: payment.providerPaymentId,
    });
  }

  if (!mpPaymentId) {
    throw new RefundRequestError('El pago no tiene identificador de Mercado Pago');
  }

  const tokensToTry = buildRefundTokenOrder({
    env: mercadoPagoConfig.env,
    platformToken,
    preferredAccessToken,
    doctorAccessToken,
  });
  const tokenLabels = {
    platformToken,
    preferredAccessToken,
    doctorAccessToken,
  };
  let lastError: unknown = null;
  const attemptErrors: Array<{ token: string; error: ReturnType<typeof serializeRefundApiError> }> =
    [];

  for (const token of tokensToTry) {
    const tokenLabel = describeRefundTokenLabel(token, tokenLabels);
    try {
      const mpRefund = await MercadoPagoApiClient.createRefund(token, mpPaymentId, refundOptions);
      securityLogger.info('MP refund executed', {
        localPaymentId: payment.id,
        mpPaymentId,
        resolveSource,
        tokenLabel,
        usedPlatformToken: tokenLabel === 'platform',
      });
      return mpRefund;
    } catch (err) {
      lastError = err;
      const serialized = serializeRefundApiError(err);
      attemptErrors.push({ token: tokenLabel, error: serialized });
      securityLogger.warn('MP refund attempt failed', {
        localPaymentId: payment.id,
        mpPaymentId,
        tokenLabel,
        errorMessage: serialized.message,
        errorStatus: serialized.status ?? null,
        errorMpBody: serialized.mpBody ?? null,
      });
      if (!isRetriableRefundError(err)) break;
    }
  }

  const serializedLastError = serializeRefundApiError(lastError);
  securityLogger.error('MP refund failed after all fallbacks', {
    localPaymentId: payment.id,
    mpPaymentId,
    platformTokenConfigured: !!platformToken,
    tokenOrder: tokensToTry.map((token) => describeRefundTokenLabel(token, tokenLabels)),
    tokensAttempted: tokensToTry.length,
    attemptErrors: attemptErrors.map(({ token, error }) => ({
      token,
      message: error.message,
      status: error.status ?? null,
      mpBody: error.mpBody ?? null,
    })),
    lastErrorMessage: serializedLastError.message,
    lastErrorStatus: serializedLastError.status ?? null,
    lastErrorMpBody: serializedLastError.mpBody ?? null,
  });

  throw toRefundRequestError(lastError);
}

async function executeMercadoPagoRefund(params: {
  payment: {
    id: string;
    doctorId: string;
    providerPaymentId: string | null;
    providerPreferenceId: string | null;
    externalReference: string;
    amount: Decimal | number;
    refundedAmount: Decimal | number;
    status: MercadoPagoPaymentStatus;
  };
  refundRequestId: string;
  approvedAmount: number;
  retryingFailed?: boolean;
}) {
  const { payment, refundRequestId, approvedAmount, retryingFailed } = params;
  if (!payment.providerPaymentId) {
    throw new RefundRequestError('El pago no tiene identificador de Mercado Pago');
  }

  const gross = decimalToNumber(payment.amount);
  const alreadyRefunded = decimalToNumber(payment.refundedAmount);
  const remaining = roundMoney(gross - alreadyRefunded);
  const isFullRefund = approvedAmount >= remaining;

  const idempotencyKey = retryingFailed
    ? `${refundRequestId}-retry-${Date.now()}`
    : refundRequestId;

  const mpRefund = await createRefundWithFallback({
    payment,
    approvedAmount,
    isFullRefund,
    idempotencyKey,
    refundRequestId,
  });

  const sandboxLocalRefund = String(mpRefund.id).startsWith('sandbox-local-');
  if (!sandboxLocalRefund) {
    await prisma.$transaction(async (tx) => {
      const fresh = await lockPaymentRow(tx, payment.id);
      if (!fresh) {
        throw new RefundRequestError('Pago no encontrado al registrar reembolso', 404);
      }

      const freshRefunded = decimalToNumber(fresh.refundedAmount);
      const freshGross = decimalToNumber(fresh.amount);
      const newRefundedTotal = roundMoney(freshRefunded + approvedAmount);

      if (newRefundedTotal > freshGross + 0.001) {
        throw new RefundRequestError('El reembolso superaría el monto cobrado');
      }

      const nextStatus: MercadoPagoPaymentStatus =
        newRefundedTotal >= freshGross ? 'refunded' : (fresh.status as MercadoPagoPaymentStatus);

      await tx.mercadoPagoPayment.update({
        where: { id: payment.id },
        data: {
          refundedAmount: newRefundedTotal,
          status: nextStatus,
        },
      });
    });

    await syncPaymentFromMercadoPago(payment.id);
  }

  await prisma.paymentAuditLog.create({
    data: {
      paymentId: payment.id,
      eventType: 'REFUND_EXECUTED',
      rawPayloadJson: mpRefund as object,
    },
  });

  return mpRefund;
}

async function lockPaymentRow(tx: Prisma.TransactionClient, paymentId: string) {
  return tx.mercadoPagoPayment.findUnique({
    where: { id: paymentId },
  });
}

export async function approveRefundRequest(
  doctorId: string,
  requestId: string,
  input: { approvedAmount?: number; doctorNotes?: string },
  decidedByUserId?: string
) {
  try {
    const request = await prisma.mercadoPagoRefundRequest.findFirst({
      where: { id: requestId, doctorId },
      include: { payment: true },
    });
    if (!request) throw new RefundRequestError('Solicitud no encontrada', 404);
    if (request.status !== 'pending' && request.status !== 'failed') {
      throw new RefundRequestError('Esta solicitud ya fue procesada');
    }

    let approvedAmount = decimalToNumber(request.requestedAmount);
    if (input.approvedAmount != null) {
      approvedAmount = roundMoney(Number(input.approvedAmount));
      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
        throw new RefundRequestError('Monto aprobado inválido');
      }
    }

    const doctorNotes = input.doctorNotes?.trim() || null;

    const lockedPayment = await prisma.$transaction(async (tx) => {
      const payment = await lockPaymentRow(tx, request.paymentId);
      if (!payment) throw new RefundRequestError('Pago no encontrado', 404);

      const refundableAmount = getRefundableAmount(payment);
      if (refundableAmount <= 0) {
        throw new RefundRequestError('No queda saldo reembolsable en este pago');
      }
      if (approvedAmount > refundableAmount) {
        throw new RefundRequestError(
          `El monto aprobado no puede superar $${refundableAmount.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        );
      }

      await tx.mercadoPagoRefundRequest.update({
        where: { id: request.id },
        data: {
          approvedAmount,
          doctorNotes,
          decidedAt: new Date(),
          decidedByUserId: decidedByUserId || null,
        },
      });

      return payment;
    });

    try {
      const mpRefund = await executeMercadoPagoRefund({
        payment: lockedPayment,
        refundRequestId: request.id,
        approvedAmount,
        retryingFailed: request.status === 'failed',
      });

      const completed = await prisma.mercadoPagoRefundRequest.update({
        where: { id: request.id },
        data: {
          status: 'completed',
          providerRefundId: String(mpRefund.id),
          processedAt: new Date(),
          failureReason: null,
        },
      });

      return serializeRefundRequest(completed);
    } catch (err) {
      const refundError = toRefundRequestError(err);
      try {
        await prisma.mercadoPagoRefundRequest.update({
          where: { id: request.id },
          data: {
            status: 'failed',
            failureReason: refundError.message.slice(0, 500),
          },
        });
      } catch (dbErr) {
        securityLogger.error('Failed to mark refund request as failed', {
          refundRequestId: request.id,
          dbErr,
          originalErr: err,
        });
      }
      throw refundError;
    }
  } catch (err) {
    if (err instanceof RefundRequestError) throw err;
    securityLogger.error('approveRefundRequest unexpected error', {
      requestId,
      doctorId,
      err,
    });
    throw new RefundRequestError(
      err instanceof Error ? err.message : 'Error al procesar reembolso',
      502
    );
  }
}

export async function rejectRefundRequest(
  doctorId: string,
  requestId: string,
  input: { doctorNotes?: string },
  decidedByUserId?: string
) {
  const request = await prisma.mercadoPagoRefundRequest.findFirst({
    where: { id: requestId, doctorId },
  });
  if (!request) throw new RefundRequestError('Solicitud no encontrada', 404);
  if (request.status !== 'pending') {
    throw new RefundRequestError('Solo se pueden rechazar solicitudes pendientes');
  }

  const updated = await prisma.mercadoPagoRefundRequest.update({
    where: { id: request.id },
    data: {
      status: 'rejected',
      doctorNotes: input.doctorNotes?.trim() || null,
      decidedAt: new Date(),
      decidedByUserId: decidedByUserId || null,
    },
  });

  return serializeRefundRequest(updated);
}

export async function getRefundRequestByToken(token: string) {
  const appointment = await resolveAppointmentFromToken(token);
  return getRefundContextForAppointment(appointment.id);
}
