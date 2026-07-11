import crypto from 'crypto';

/** Identificador corto irreversible (no reversible a UUID completo sin diccionario). */
export function hashId(id: string | null | undefined): string {
  if (!id) return '—';
  return crypto.createHash('sha256').update(id).digest('hex').slice(0, 16);
}

export function hashEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const n = email.trim().toLowerCase();
  return crypto.createHash('sha256').update(n).digest('hex').slice(0, 24);
}

/** IPv4: a.b.*.* ; IPv6: primer segmento + '::…' */
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const v = ip.replace(/^::ffff:/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
    const p = v.split('.');
    return `${p[0]}.${p[1]}.*.*`;
  }
  const seg = v.split(':')[0];
  return seg ? `${seg}:…` : '*';
}
