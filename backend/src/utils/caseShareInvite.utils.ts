import crypto from 'crypto';

const INVITE_DAYS = 14;

export function generateCaseShareToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function defaultCaseShareInviteExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_DAYS);
  return d;
}
