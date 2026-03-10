import crypto from 'crypto';
import { env } from '../config/env';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex'); // 32 bytes

export function encrypt(text: string): { iv: string, content: string, tag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), content: encrypted, tag: tag.toString('hex') };
}

export function decrypt(encrypted: { iv: string, content: string, tag: string }): string {
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(encrypted.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
  let decrypted = decipher.update(encrypted.content, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
} 