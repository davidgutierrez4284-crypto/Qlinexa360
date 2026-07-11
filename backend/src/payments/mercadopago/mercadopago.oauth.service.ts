import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { encrypt, decrypt } from '../../utils/encryption.utils';
import { MercadoPagoApiClient } from './mercadopago.api.client';
import { mercadoPagoConfig } from './mercadopago.config';

type OAuthStatePayload = { doctorId: string; nonce: string };

function serializeEncryptedToken(token: string): string {
  return JSON.stringify(encrypt(token));
}

function parseEncryptedToken(stored: string): string {
  return decrypt(JSON.parse(stored));
}

export class MercadoPagoOAuthService {
  static createState(doctorId: string): string {
    const payload: OAuthStatePayload = { doctorId, nonce: crypto.randomBytes(16).toString('hex') };
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
  }

  static verifyState(state: string): OAuthStatePayload {
    return jwt.verify(state, env.JWT_SECRET) as OAuthStatePayload;
  }

  static getConnectUrl(doctorId: string): string {
    const state = this.createState(doctorId);
    const params = new URLSearchParams({
      client_id: mercadoPagoConfig.clientId,
      response_type: 'code',
      platform_id: 'mp',
      redirect_uri: mercadoPagoConfig.redirectUri,
      state,
    });
    return `${mercadoPagoConfig.authBaseUrl}/authorization?${params.toString()}`;
  }

  static async handleCallback(code: string, state: string) {
    const { doctorId } = this.verifyState(state);
    const tokenData = await MercadoPagoApiClient.exchangeAuthorizationCode(code);
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    await prisma.paymentProviderConnection.upsert({
      where: { doctorId_provider: { doctorId, provider: 'mercadopago' } },
      create: {
        doctorId,
        provider: 'mercadopago',
        providerUserId: tokenData.user_id != null ? String(tokenData.user_id) : null,
        accessTokenEncrypted: serializeEncryptedToken(tokenData.access_token),
        refreshTokenEncrypted: tokenData.refresh_token
          ? serializeEncryptedToken(tokenData.refresh_token)
          : null,
        tokenExpiresAt: expiresAt,
        publicKey: tokenData.public_key || null,
        status: 'active',
        lastConnectionAt: new Date(),
        disconnectedAt: null,
      },
      update: {
        providerUserId: tokenData.user_id != null ? String(tokenData.user_id) : null,
        accessTokenEncrypted: serializeEncryptedToken(tokenData.access_token),
        refreshTokenEncrypted: tokenData.refresh_token
          ? serializeEncryptedToken(tokenData.refresh_token)
          : null,
        tokenExpiresAt: expiresAt,
        publicKey: tokenData.public_key || null,
        status: 'active',
        lastConnectionAt: new Date(),
        disconnectedAt: null,
      },
    });

    return doctorId;
  }

  static async disconnect(doctorId: string) {
    await prisma.paymentProviderConnection.updateMany({
      where: { doctorId, provider: 'mercadopago' },
      data: { status: 'disconnected', disconnectedAt: new Date() },
    });
  }

  static async getConnectionStatus(doctorId: string) {
    const conn = await prisma.paymentProviderConnection.findUnique({
      where: { doctorId_provider: { doctorId, provider: 'mercadopago' } },
      select: {
        status: true,
        providerUserId: true,
        accountEmail: true,
        lastConnectionAt: true,
        disconnectedAt: true,
        tokenExpiresAt: true,
      },
    });
    return {
      connected: conn?.status === 'active',
      status: conn?.status || 'disconnected',
      providerUserId: conn?.providerUserId || null,
      accountEmail: conn?.accountEmail || null,
      lastConnectionAt: conn?.lastConnectionAt || null,
    };
  }

  static async getValidAccessToken(doctorId: string): Promise<string> {
    const conn = await prisma.paymentProviderConnection.findUnique({
      where: { doctorId_provider: { doctorId, provider: 'mercadopago' } },
    });
    if (!conn || conn.status !== 'active') {
      throw new Error('Mercado Pago no conectado para este doctor');
    }

    const accessToken = parseEncryptedToken(conn.accessTokenEncrypted);
    const needsRefresh =
      conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000;

    if (!needsRefresh || !conn.refreshTokenEncrypted) {
      return accessToken;
    }

    const refreshToken = parseEncryptedToken(conn.refreshTokenEncrypted);
    const refreshed = await MercadoPagoApiClient.refreshAccessToken(refreshToken);
    const expiresAt = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : conn.tokenExpiresAt;

    await prisma.paymentProviderConnection.update({
      where: { id: conn.id },
      data: {
        accessTokenEncrypted: serializeEncryptedToken(refreshed.access_token),
        refreshTokenEncrypted: refreshed.refresh_token
          ? serializeEncryptedToken(refreshed.refresh_token)
          : conn.refreshTokenEncrypted,
        tokenExpiresAt: expiresAt,
      },
    });

    return refreshed.access_token;
  }
}

export { parseEncryptedToken, serializeEncryptedToken };
