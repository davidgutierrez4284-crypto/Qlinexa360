"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundRequestError = void 0;
exports.serializeRefundRequest = serializeRefundRequest;
exports.getRefundableAmount = getRefundableAmount;
exports.getRefundContextForAppointment = getRefundContextForAppointment;
exports.createRefundRequestByToken = createRefundRequestByToken;
exports.listRefundRequestsForDoctor = listRefundRequestsForDoctor;
exports.isInsufficientBalanceRefundError = isInsufficientBalanceRefundError;
exports.isRetriableRefundError = isRetriableRefundError;
exports.buildRefundTokenOrder = buildRefundTokenOrder;
exports.mapMpRefundErrorToUserMessage = mapMpRefundErrorToUserMessage;
exports.approveRefundRequest = approveRefundRequest;
exports.rejectRefundRequest = rejectRefundRequest;
exports.getRefundRequestByToken = getRefundRequestByToken;
const axios_1 = require("axios");
const database_1 = __importDefault(require("../../config/database"));
const client_1 = require("@prisma/client");
const logger_utils_1 = require("../../utils/logger.utils");
const mercadopago_api_client_1 = require("./mercadopago.api.client");
const mercadopago_commission_utils_1 = require("./mercadopago.commission.utils");
const mercadopago_oauth_service_1 = require("./mercadopago.oauth.service");
const mercadopago_preference_service_1 = require("./mercadopago.preference.service");
const mercadopago_payment_fees_utils_1 = require("./mercadopago.payment-fees.utils");
const mercadopago_config_1 = require("./mercadopago.config");
const mercadopago_payment_resolve_service_1 = require("./mercadopago.payment-resolve.service");
const mercadopago_appointment_display_service_1 = require("./mercadopago.appointment-display.service");
const appointmentConfirmation_utils_1 = require("../../utils/appointmentConfirmation.utils");
class RefundRequestError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.RefundRequestError = RefundRequestError;
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
function serializeRefundRequest(row) {
    return {
        id: row.id,
        status: row.status,
        requestedAmount: (0, mercadopago_commission_utils_1.decimalToNumber)(row.requestedAmount),
        approvedAmount: row.approvedAmount != null ? (0, mercadopago_commission_utils_1.decimalToNumber)(row.approvedAmount) : null,
        reason: row.reason,
        doctorNotes: row.doctorNotes,
        createdAt: row.createdAt,
        processedAt: row.processedAt,
        failureReason: row.failureReason,
    };
}
function getRefundableAmount(payment) {
    if (payment.status === 'refunded')
        return 0;
    if (payment.status !== 'approved')
        return 0;
    const gross = (0, mercadopago_commission_utils_1.decimalToNumber)(payment.amount);
    const refunded = (0, mercadopago_commission_utils_1.decimalToNumber)(payment.refundedAmount);
    return Math.max(0, roundMoney(gross - refunded));
}
async function resolveAppointmentFromToken(token) {
    const confirmationRequest = await database_1.default.appointmentConfirmationRequest.findUnique({
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
        await (0, appointmentConfirmation_utils_1.ensureActiveConfirmationRequest)(confirmationRequest);
    }
    catch (tokenErr) {
        throw new RefundRequestError(tokenErr.message || 'Este enlace ha expirado', tokenErr.statusCode || 400);
    }
    return confirmationRequest.appointment;
}
async function getApprovedPaymentForAppointment(appointmentId) {
    return database_1.default.mercadoPagoPayment.findFirst({
        where: {
            appointmentId,
            status: 'approved',
            providerPaymentId: { not: null },
        },
        orderBy: { paidAt: 'desc' },
    });
}
async function getActiveRefundRequest(paymentId) {
    return database_1.default.mercadoPagoRefundRequest.findFirst({
        where: {
            paymentId,
            status: { in: ['pending', 'failed'] },
        },
        orderBy: { createdAt: 'desc' },
    });
}
async function getRefundContextForAppointment(appointmentId) {
    const payment = await getApprovedPaymentForAppointment(appointmentId);
    if (!payment) {
        return {
            paymentId: null,
            canRequestRefund: false,
            refundableAmount: 0,
            refundRequest: null,
        };
    }
    const refundableAmount = getRefundableAmount(payment);
    const latest = await database_1.default.mercadoPagoRefundRequest.findFirst({
        where: { paymentId: payment.id },
        orderBy: { createdAt: 'desc' },
    });
    const canRequestRefund = refundableAmount > 0 &&
        !!payment.providerPaymentId &&
        (!latest || latest.status === 'rejected' || latest.status === 'failed');
    return {
        paymentId: payment.id,
        canRequestRefund,
        refundableAmount,
        refundRequest: latest ? serializeRefundRequest(latest) : null,
    };
}
async function notifyDoctorRefundRequested(params) {
    try {
        await database_1.default.notification.create({
            data: {
                userId: params.doctorUserId,
                type: client_1.NotificationType.SYSTEM_MESSAGE,
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
    }
    catch (err) {
        logger_utils_1.securityLogger.warn('Refund request notification failed', { err });
    }
}
async function createRefundRequestByToken(token, input) {
    var _a, _b;
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
    if ((pending === null || pending === void 0 ? void 0 : pending.status) === 'pending') {
        throw new RefundRequestError('Ya existe una solicitud de reembolso pendiente de revisión');
    }
    let requestedAmount = refundableAmount;
    if (input.requestedAmount != null) {
        requestedAmount = roundMoney(Number(input.requestedAmount));
        if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
            throw new RefundRequestError('Monto solicitado inválido');
        }
        if (requestedAmount > refundableAmount) {
            throw new RefundRequestError(`El monto solicitado no puede superar $${refundableAmount.toLocaleString('es-MX', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`);
        }
    }
    const patientName = `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim() ||
        `${((_a = appointment.patient.user) === null || _a === void 0 ? void 0 : _a.firstName) || ''} ${((_b = appointment.patient.user) === null || _b === void 0 ? void 0 : _b.lastName) || ''}`.trim() ||
        'Paciente';
    const created = await database_1.default.mercadoPagoRefundRequest.create({
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
        await (0, mercadopago_appointment_display_service_1.cancelAppointmentAfterRefundRequest)(appointment.id, reason);
    }
    catch (cancelErr) {
        logger_utils_1.securityLogger.warn('Refund request created but appointment cancel sync failed', {
            appointmentId: appointment.id,
            cancelErr,
        });
    }
    return serializeRefundRequest(created);
}
async function listRefundRequestsForDoctor(doctorId, filters) {
    const where = { doctorId };
    if (filters === null || filters === void 0 ? void 0 : filters.status)
        where.status = filters.status;
    const rows = await database_1.default.mercadoPagoRefundRequest.findMany({
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
        take: Math.min((filters === null || filters === void 0 ? void 0 : filters.limit) || 50, 100),
    });
    return rows.map((row) => (Object.assign(Object.assign({}, serializeRefundRequest(row)), { payment: {
            id: row.paymentId,
            amount: (0, mercadopago_commission_utils_1.decimalToNumber)(row.payment.amount),
            currency: row.payment.currency,
            status: row.payment.status,
            providerPaymentId: row.payment.providerPaymentId,
            refundedAmount: (0, mercadopago_commission_utils_1.decimalToNumber)(row.payment.refundedAmount),
            paidAt: row.payment.paidAt,
        }, patient: row.patient, appointment: row.appointment, appointmentId: row.appointmentId })));
}
async function syncPaymentFromMercadoPago(paymentId) {
    const payment = await database_1.default.mercadoPagoPayment.findUnique({ where: { id: paymentId } });
    if (!(payment === null || payment === void 0 ? void 0 : payment.providerPaymentId))
        return payment;
    try {
        const accessToken = await mercadopago_oauth_service_1.MercadoPagoOAuthService.getValidAccessToken(payment.doctorId);
        const mpPayment = await mercadopago_api_client_1.MercadoPagoApiClient.getPayment(accessToken, payment.providerPaymentId);
        const mappedStatus = mercadopago_preference_service_1.MercadoPagoPreferenceService.mapMpStatus(mpPayment.status);
        const financials = mappedStatus === 'approved' ? (0, mercadopago_payment_fees_utils_1.buildPaymentFinancialUpdate)(mpPayment, payment) : undefined;
        return database_1.default.mercadoPagoPayment.update({
            where: { id: payment.id },
            data: Object.assign({ status: mappedStatus }, (financials !== null && financials !== void 0 ? financials : {})),
        });
    }
    catch (err) {
        logger_utils_1.securityLogger.warn('MP sync after refund failed', { paymentId, err });
        return payment;
    }
}
function refundErrorText(err) {
    if (err instanceof Error)
        return err.message;
    return String(err);
}
function serializeRefundApiError(err) {
    var _a, _b;
    if ((0, axios_1.isAxiosError)(err)) {
        return {
            message: err.message,
            status: (_a = err.response) === null || _a === void 0 ? void 0 : _a.status,
            mpBody: (_b = err.response) === null || _b === void 0 ? void 0 : _b.data,
        };
    }
    if (err instanceof Error) {
        return { message: err.message };
    }
    return { message: String(err) };
}
function describeRefundTokenLabel(token, labels) {
    if (labels.platformToken && token === labels.platformToken)
        return 'platform';
    if (labels.doctorAccessToken && token === labels.doctorAccessToken)
        return 'doctor';
    if (labels.preferredAccessToken && token === labels.preferredAccessToken)
        return 'preferred';
    return 'other';
}
function isInsufficientBalanceRefundError(err) {
    var _a, _b;
    const msg = refundErrorText(err).toLowerCase();
    if (msg.includes('insufficient') ||
        msg.includes('suficiente dinero') ||
        msg.includes('not enough money') ||
        msg.includes('insufficient_amount')) {
        return true;
    }
    if ((0, axios_1.isAxiosError)(err)) {
        const body = JSON.stringify((_b = (_a = err.response) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : '').toLowerCase();
        return (body.includes('insufficient') ||
            body.includes('suficiente dinero') ||
            body.includes('not enough money'));
    }
    return false;
}
function isRetriableRefundError(err) {
    var _a;
    if ((0, mercadopago_payment_resolve_service_1.isMpNotFoundError)(err))
        return true;
    if (isInsufficientBalanceRefundError(err))
        return true;
    if ((0, axios_1.isAxiosError)(err)) {
        const status = (_a = err.response) === null || _a === void 0 ? void 0 : _a.status;
        if (status === 404 || status === 401)
            return true;
    }
    if (err instanceof Error) {
        const msg = err.message;
        if (msg.includes('createRefund 404') || msg.includes('Payment not found'))
            return true;
        if (msg.includes('createRefund 401') || msg.includes('Unauthorized use of live credentials')) {
            return true;
        }
    }
    return false;
}
function buildRefundTokenOrder(params) {
    const { env, platformToken, preferredAccessToken, doctorAccessToken } = params;
    const ordered = env === 'production'
        ? [platformToken, preferredAccessToken, doctorAccessToken]
        : [preferredAccessToken, doctorAccessToken, platformToken];
    return [...new Set(ordered.filter(Boolean))];
}
function mapMpRefundErrorToUserMessage(err) {
    if (isInsufficientBalanceRefundError(err)) {
        return ('Mercado Pago rechazó el reembolso: la cuenta del doctor no tiene saldo suficiente para devolver el monto completo. ' +
            'En cobros marketplace (Checkout Pro), el reembolso debe procesarse con la cuenta integradora de Qlinexa360. ' +
            'Si ves este mensaje tras aprobar desde Qlinexa360, contacta a soporte con el ID del cobro.');
    }
    const msg = refundErrorText(err);
    if (msg.includes('createRefund 404') ||
        msg.includes('Payment not found') ||
        msg.includes('Unable to resolve Mercado Pago payment')) {
        return ('No pudimos localizar este cobro en Mercado Pago para devolverlo automáticamente. ' +
            'Procésalo en tu panel de Mercado Pago (Actividad → buscar el cobro → Devolver dinero). ' +
            'Qlinexa360 lo marcará como reembolsado cuando Mercado Pago lo confirme.');
    }
    if (msg.includes('createRefund 401') || msg.includes('Unauthorized use of live credentials')) {
        return ('Mercado Pago rechazó el reembolso por credenciales inválidas para este cobro marketplace. ' +
            'Qlinexa360 intentará reintentar con la cuenta integradora; si persiste, contacta a soporte.');
    }
    if (msg.includes('createRefund 403')) {
        return ('Mercado Pago rechazó el reembolso: la cuenta usada no tiene permiso para devolver este cobro marketplace. ' +
            'Verifica que el token integrador de Qlinexa360 en producción sea el de la aplicación marketplace correcta.');
    }
    const lower = msg.toLowerCase();
    if (lower.includes('createRefund 400') && (lower.includes('status') || lower.includes('estado'))) {
        return ('Mercado Pago no permite reembolsar este cobro en su estado actual. ' +
            'Revisa el cobro en el panel de Mercado Pago o contacta a soporte con el ID del pago.');
    }
    return 'No pudimos completar el reembolso en Mercado Pago. Intenta de nuevo o contacta a soporte.';
}
function toRefundRequestError(err) {
    if (err instanceof RefundRequestError)
        return err;
    return new RefundRequestError(mapMpRefundErrorToUserMessage(err), 502);
}
/** @deprecated use isRetriableRefundError */
function isRefundNotFoundError(err) {
    return isRetriableRefundError(err);
}
function isResolveNotFoundError(err) {
    return err instanceof Error && err.message.includes('Unable to resolve Mercado Pago payment');
}
async function isSandboxManualApprovedPayment(paymentId) {
    if (mercadopago_config_1.mercadoPagoConfig.env !== 'sandbox')
        return false;
    const audit = await database_1.default.paymentAuditLog.findFirst({
        where: { paymentId, eventType: 'SANDBOX_MANUAL_APPROVE' },
        select: { id: true },
    });
    return !!audit;
}
async function executeSandboxLocalRefund(params) {
    const gross = (0, mercadopago_commission_utils_1.decimalToNumber)(params.payment.amount);
    const alreadyRefunded = (0, mercadopago_commission_utils_1.decimalToNumber)(params.payment.refundedAmount);
    const newRefundedTotal = roundMoney(alreadyRefunded + params.approvedAmount);
    const nextStatus = newRefundedTotal >= gross ? 'refunded' : params.payment.status;
    await database_1.default.mercadoPagoPayment.update({
        where: { id: params.payment.id },
        data: {
            refundedAmount: newRefundedTotal,
            status: nextStatus,
        },
    });
    await database_1.default.paymentAuditLog.create({
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
    logger_utils_1.securityLogger.warn('MP sandbox local refund applied (no MP API call)', {
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
async function createRefundWithFallback(params) {
    var _a, _b, _c, _d;
    const { payment, approvedAmount, isFullRefund, idempotencyKey, refundRequestId } = params;
    if (await isSandboxManualApprovedPayment(payment.id)) {
        logger_utils_1.securityLogger.info('MP refund: sandbox manual payment, applying local refund only', {
            localPaymentId: payment.id,
        });
        return executeSandboxLocalRefund({
            payment,
            refundRequestId,
            approvedAmount,
        });
    }
    const doctorAccessToken = await mercadopago_oauth_service_1.MercadoPagoOAuthService.getValidAccessToken(payment.doctorId);
    const platformToken = mercadopago_config_1.mercadoPagoConfig.platformAccessToken || null;
    const refundOptions = {
        amount: isFullRefund ? undefined : approvedAmount,
        idempotencyKey,
    };
    let mpPaymentId = payment.providerPaymentId;
    let resolveSource = null;
    let preferredAccessToken = null;
    try {
        const resolved = await (0, mercadopago_payment_resolve_service_1.resolveMpPaymentWithFallback)({
            paymentId: payment.providerPaymentId,
            doctorAccessToken,
            preferenceId: payment.providerPreferenceId,
            externalReference: payment.externalReference,
        });
        mpPaymentId = String(resolved.payment.id);
        resolveSource = resolved.source;
        preferredAccessToken = resolved.accessToken;
        if (payment.providerPaymentId !== mpPaymentId) {
            await database_1.default.mercadoPagoPayment.update({
                where: { id: payment.id },
                data: { providerPaymentId: mpPaymentId },
            });
        }
    }
    catch (err) {
        if (!isResolveNotFoundError(err))
            throw err;
        logger_utils_1.securityLogger.warn('MP refund: resolve failed, trying direct refund', {
            localPaymentId: payment.id,
            providerPaymentId: payment.providerPaymentId,
        });
    }
    if (!mpPaymentId) {
        throw new RefundRequestError('El pago no tiene identificador de Mercado Pago');
    }
    const tokensToTry = buildRefundTokenOrder({
        env: mercadopago_config_1.mercadoPagoConfig.env,
        platformToken,
        preferredAccessToken,
        doctorAccessToken,
    });
    const tokenLabels = {
        platformToken,
        preferredAccessToken,
        doctorAccessToken,
    };
    let lastError = null;
    const attemptErrors = [];
    for (const token of tokensToTry) {
        const tokenLabel = describeRefundTokenLabel(token, tokenLabels);
        try {
            const mpRefund = await mercadopago_api_client_1.MercadoPagoApiClient.createRefund(token, mpPaymentId, refundOptions);
            logger_utils_1.securityLogger.info('MP refund executed', {
                localPaymentId: payment.id,
                mpPaymentId,
                resolveSource,
                tokenLabel,
                usedPlatformToken: tokenLabel === 'platform',
            });
            return mpRefund;
        }
        catch (err) {
            lastError = err;
            const serialized = serializeRefundApiError(err);
            attemptErrors.push({ token: tokenLabel, error: serialized });
            logger_utils_1.securityLogger.warn('MP refund attempt failed', {
                localPaymentId: payment.id,
                mpPaymentId,
                tokenLabel,
                errorMessage: serialized.message,
                errorStatus: (_a = serialized.status) !== null && _a !== void 0 ? _a : null,
                errorMpBody: (_b = serialized.mpBody) !== null && _b !== void 0 ? _b : null,
            });
            if (!isRetriableRefundError(err))
                break;
        }
    }
    const serializedLastError = serializeRefundApiError(lastError);
    logger_utils_1.securityLogger.error('MP refund failed after all fallbacks', {
        localPaymentId: payment.id,
        mpPaymentId,
        platformTokenConfigured: !!platformToken,
        tokenOrder: tokensToTry.map((token) => describeRefundTokenLabel(token, tokenLabels)),
        tokensAttempted: tokensToTry.length,
        attemptErrors: attemptErrors.map(({ token, error }) => {
            var _a, _b;
            return ({
                token,
                message: error.message,
                status: (_a = error.status) !== null && _a !== void 0 ? _a : null,
                mpBody: (_b = error.mpBody) !== null && _b !== void 0 ? _b : null,
            });
        }),
        lastErrorMessage: serializedLastError.message,
        lastErrorStatus: (_c = serializedLastError.status) !== null && _c !== void 0 ? _c : null,
        lastErrorMpBody: (_d = serializedLastError.mpBody) !== null && _d !== void 0 ? _d : null,
    });
    throw toRefundRequestError(lastError);
}
async function executeMercadoPagoRefund(params) {
    const { payment, refundRequestId, approvedAmount, retryingFailed } = params;
    if (!payment.providerPaymentId) {
        throw new RefundRequestError('El pago no tiene identificador de Mercado Pago');
    }
    const gross = (0, mercadopago_commission_utils_1.decimalToNumber)(payment.amount);
    const alreadyRefunded = (0, mercadopago_commission_utils_1.decimalToNumber)(payment.refundedAmount);
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
        await database_1.default.$transaction(async (tx) => {
            const fresh = await lockPaymentRow(tx, payment.id);
            if (!fresh) {
                throw new RefundRequestError('Pago no encontrado al registrar reembolso', 404);
            }
            const freshRefunded = (0, mercadopago_commission_utils_1.decimalToNumber)(fresh.refundedAmount);
            const freshGross = (0, mercadopago_commission_utils_1.decimalToNumber)(fresh.amount);
            const newRefundedTotal = roundMoney(freshRefunded + approvedAmount);
            if (newRefundedTotal > freshGross + 0.001) {
                throw new RefundRequestError('El reembolso superaría el monto cobrado');
            }
            const nextStatus = newRefundedTotal >= freshGross ? 'refunded' : fresh.status;
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
    await database_1.default.paymentAuditLog.create({
        data: {
            paymentId: payment.id,
            eventType: 'REFUND_EXECUTED',
            rawPayloadJson: mpRefund,
        },
    });
    return mpRefund;
}
async function lockPaymentRow(tx, paymentId) {
    return tx.mercadoPagoPayment.findUnique({
        where: { id: paymentId },
    });
}
async function approveRefundRequest(doctorId, requestId, input, decidedByUserId) {
    var _a;
    try {
        const request = await database_1.default.mercadoPagoRefundRequest.findFirst({
            where: { id: requestId, doctorId },
            include: { payment: true },
        });
        if (!request)
            throw new RefundRequestError('Solicitud no encontrada', 404);
        if (request.status !== 'pending' && request.status !== 'failed') {
            throw new RefundRequestError('Esta solicitud ya fue procesada');
        }
        let approvedAmount = (0, mercadopago_commission_utils_1.decimalToNumber)(request.requestedAmount);
        if (input.approvedAmount != null) {
            approvedAmount = roundMoney(Number(input.approvedAmount));
            if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
                throw new RefundRequestError('Monto aprobado inválido');
            }
        }
        const doctorNotes = ((_a = input.doctorNotes) === null || _a === void 0 ? void 0 : _a.trim()) || null;
        const lockedPayment = await database_1.default.$transaction(async (tx) => {
            const payment = await lockPaymentRow(tx, request.paymentId);
            if (!payment)
                throw new RefundRequestError('Pago no encontrado', 404);
            const refundableAmount = getRefundableAmount(payment);
            if (refundableAmount <= 0) {
                throw new RefundRequestError('No queda saldo reembolsable en este pago');
            }
            if (approvedAmount > refundableAmount) {
                throw new RefundRequestError(`El monto aprobado no puede superar $${refundableAmount.toLocaleString('es-MX', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })}`);
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
            const completed = await database_1.default.mercadoPagoRefundRequest.update({
                where: { id: request.id },
                data: {
                    status: 'completed',
                    providerRefundId: String(mpRefund.id),
                    processedAt: new Date(),
                    failureReason: null,
                },
            });
            return serializeRefundRequest(completed);
        }
        catch (err) {
            const refundError = toRefundRequestError(err);
            try {
                await database_1.default.mercadoPagoRefundRequest.update({
                    where: { id: request.id },
                    data: {
                        status: 'failed',
                        failureReason: refundError.message.slice(0, 500),
                    },
                });
            }
            catch (dbErr) {
                logger_utils_1.securityLogger.error('Failed to mark refund request as failed', {
                    refundRequestId: request.id,
                    dbErr,
                    originalErr: err,
                });
            }
            throw refundError;
        }
    }
    catch (err) {
        if (err instanceof RefundRequestError)
            throw err;
        logger_utils_1.securityLogger.error('approveRefundRequest unexpected error', {
            requestId,
            doctorId,
            err,
        });
        throw new RefundRequestError(err instanceof Error ? err.message : 'Error al procesar reembolso', 502);
    }
}
async function rejectRefundRequest(doctorId, requestId, input, decidedByUserId) {
    var _a;
    const request = await database_1.default.mercadoPagoRefundRequest.findFirst({
        where: { id: requestId, doctorId },
    });
    if (!request)
        throw new RefundRequestError('Solicitud no encontrada', 404);
    if (request.status !== 'pending') {
        throw new RefundRequestError('Solo se pueden rechazar solicitudes pendientes');
    }
    const updated = await database_1.default.mercadoPagoRefundRequest.update({
        where: { id: request.id },
        data: {
            status: 'rejected',
            doctorNotes: ((_a = input.doctorNotes) === null || _a === void 0 ? void 0 : _a.trim()) || null,
            decidedAt: new Date(),
            decidedByUserId: decidedByUserId || null,
        },
    });
    return serializeRefundRequest(updated);
}
async function getRefundRequestByToken(token) {
    const appointment = await resolveAppointmentFromToken(token);
    return getRefundContextForAppointment(appointment.id);
}
