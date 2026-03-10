import { PrismaClient } from '@prisma/client';

// Corregir DATABASE_URL: codificar caracteres especiales en la contraseña
function fixDatabaseUrl(url: string | undefined): string | undefined {
  if (!url || !url.startsWith('postgresql://')) return url;
  const match = url.match(/^(postgresql:\/\/[^:]+:)([^@]+)(@.+)$/);
  if (!match) return url;
  // Codificar solo caracteres que rompen el parsing de URL (evitar % para no doble-codificar)
  const password = match[2]
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F')
    .replace(/@/g, '%40')
    .replace(/:/g, '%3A')
    .replace(/\//g, '%2F');
  return match[1] + password + match[3];
}

const rawUrl = process.env.DATABASE_URL;
if (rawUrl) {
  process.env.DATABASE_URL = fixDatabaseUrl(rawUrl) || rawUrl;
}

const prisma = new PrismaClient();

export default prisma; 