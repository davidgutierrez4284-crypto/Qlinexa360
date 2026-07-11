/**
 * Prueba EN VIVO de solo lectura contra Microsoft Graph (Outlook):
 * - Verifica token, identifica la cuenta y si Teams está disponible.
 * Ejecutar desde backend/: node scripts/qa-outlook-live-read.js
 */
require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });
const { OAuthService } = require('../dist/services/oauth.service');

const GRAPH = 'https://graph.microsoft.com/v1.0';

async function main() {
  console.log('\n=== OUTLOOK LIVE (solo lectura) ===\n');

  const cfg = await prisma.calendarSyncConfig.findFirst({
    where: { provider: 'outlook', isConnected: true, accessToken: { not: null } }
  });
  if (!cfg) {
    console.log('No hay Outlook conectado en BD.');
    return;
  }
  console.log('Doctor con Outlook:', cfg.doctorId);

  // Refrescar token si está por vencer
  let accessToken = cfg.accessToken;
  const needsRefresh = !cfg.expiresAt || new Date(cfg.expiresAt).getTime() <= Date.now() + 60000;
  if (needsRefresh && cfg.refreshToken) {
    const refreshed = await OAuthService.refreshAccessToken('outlook', cfg.refreshToken);
    if (refreshed?.access_token) {
      accessToken = refreshed.access_token;
      console.log('Token refrescado OK.');
    } else {
      console.log('\u26a0\ufe0f No se pudo refrescar el token (puede estar revocado).');
    }
  }

  const headers = { Authorization: `Bearer ${accessToken}` };

  // 1) Identidad de la cuenta
  try {
    const me = await axios.get(`${GRAPH}/me`, { headers });
    console.log('\u2705 /me OK');
    console.log('   userPrincipalName:', me.data.userPrincipalName);
    console.log('   mail:', me.data.mail);
  } catch (e) {
    console.log('\u274c /me error:', e?.response?.status, e?.response?.data?.error?.message || e.message);
    return;
  }

  // 2) Proveedores de reunión permitidos (¿Teams disponible?)
  try {
    const cal = await axios.get(`${GRAPH}/me/calendar?$select=allowedOnlineMeetingProviders,defaultOnlineMeetingProvider`, { headers });
    const allowed = cal.data.allowedOnlineMeetingProviders || [];
    console.log('\u2705 /me/calendar OK');
    console.log('   allowedOnlineMeetingProviders:', JSON.stringify(allowed));
    console.log('   defaultOnlineMeetingProvider:', cal.data.defaultOnlineMeetingProvider);
    if (allowed.includes('teamsForBusiness')) {
      console.log('   \u2705 Teams DISPONIBLE en esta cuenta -> liga de teleconsulta funcionará.');
    } else {
      console.log('   \u26a0\ufe0f Teams NO disponible (sin licencia Teams) -> la liga de teleconsulta NO se generará.');
    }
  } catch (e) {
    console.log('\u26a0\ufe0f /me/calendar error:', e?.response?.status, e?.response?.data?.error?.message || e.message);
  }

  // 3) Lectura de eventos próximos
  try {
    const ev = await axios.get(`${GRAPH}/me/events?$select=subject,start,isOnlineMeeting,onlineMeetingProvider&$top=3&$orderby=start/dateTime`, { headers });
    const items = ev.data.value || [];
    console.log(`\u2705 /me/events OK (${items.length} leídos)`);
    items.forEach((it) => console.log(`   - ${it.subject} | online:${it.isOnlineMeeting} | provider:${it.onlineMeetingProvider || '-'}`));
  } catch (e) {
    console.log('\u26a0\ufe0f /me/events error:', e?.response?.status, e?.response?.data?.error?.message || e.message);
  }

  console.log('');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
