import {
  buildRefundTokenOrder,
  isInsufficientBalanceRefundError,
  isRetriableRefundError,
  mapMpRefundErrorToUserMessage,
} from '../mercadopago.refund.service';

describe('buildRefundTokenOrder', () => {
  const platform = 'platform-token';
  const preferred = 'preferred-token';
  const doctor = 'doctor-token';

  it('tries platform token first in production', () => {
    expect(
      buildRefundTokenOrder({
        env: 'production',
        platformToken: platform,
        preferredAccessToken: preferred,
        doctorAccessToken: doctor,
      })
    ).toEqual([platform, preferred, doctor]);
  });

  it('deduplicates when preferred token equals doctor token in sandbox', () => {
    expect(
      buildRefundTokenOrder({
        env: 'sandbox',
        platformToken: platform,
        preferredAccessToken: doctor,
        doctorAccessToken: doctor,
      })
    ).toEqual([doctor, platform]);
  });

  it('prefers resolve token before doctor in sandbox', () => {
    expect(
      buildRefundTokenOrder({
        env: 'sandbox',
        platformToken: platform,
        preferredAccessToken: preferred,
        doctorAccessToken: doctor,
      })
    ).toEqual([preferred, doctor, platform]);
  });

  it('omits null tokens', () => {
    expect(
      buildRefundTokenOrder({
        env: 'production',
        platformToken: null,
        preferredAccessToken: preferred,
        doctorAccessToken: doctor,
      })
    ).toEqual([preferred, doctor]);
  });
});

describe('isInsufficientBalanceRefundError', () => {
  it('detects Spanish insufficient balance message', () => {
    expect(
      isInsufficientBalanceRefundError(
        new Error('Mercado Pago createRefund 400: {"message":"No tienes suficiente dinero"}')
      )
    ).toBe(true);
  });

  it('detects English insufficient balance message', () => {
    expect(
      isInsufficientBalanceRefundError(new Error('createRefund 400: insufficient_amount'))
    ).toBe(true);
  });
});

describe('isRetriableRefundError', () => {
  it('treats insufficient balance as retriable to allow integrator fallback', () => {
    expect(
      isRetriableRefundError(
        new Error('Mercado Pago createRefund 400: No tienes suficiente dinero')
      )
    ).toBe(true);
  });
});

describe('mapMpRefundErrorToUserMessage', () => {
  it('returns marketplace guidance for insufficient balance', () => {
    const message = mapMpRefundErrorToUserMessage(
      new Error('Mercado Pago createRefund 400: No tienes suficiente dinero')
    );
    expect(message).toContain('cuenta integradora');
    expect(message).toContain('marketplace');
  });

  it('returns not-found guidance for missing payment', () => {
    const message = mapMpRefundErrorToUserMessage(
      new Error('Mercado Pago createRefund 404: Payment not found')
    );
    expect(message).toContain('No pudimos localizar');
  });
});
