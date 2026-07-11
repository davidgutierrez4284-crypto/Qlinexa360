/**
 * Verifica credenciales Mercado Pago sandbox y muestra checklist del panel.
 * Ejecutar: npx ts-node scripts/mp-sandbox-check.ts
 */
import axios from 'axios';
import { mercadoPagoConfig } from '../src/payments/mercadopago/mercadopago.config';
import { env } from '../src/config/env';

function status(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '  OK   ' : '  FAIL '}${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log('\n=== Mercado Pago — verificación sandbox ===\n');

  status('MERCADOPAGO_CLIENT_ID', !!mercadoPagoConfig.clientId);
  status('MERCADOPAGO_CLIENT_SECRET', !!mercadoPagoConfig.clientSecret);
  status('MERCADOPAGO_PLATFORM_ACCESS_TOKEN', !!mercadoPagoConfig.platformAccessToken);
  status('MERCADOPAGO_WEBHOOK_SECRET', !!mercadoPagoConfig.webhookSecret);
  status('MERCADOPAGO_ENV=sandbox', mercadoPagoConfig.env === 'sandbox', mercadoPagoConfig.env);
  status('DATA_ENCRYPTION_KEY', !!env.DATA_ENCRYPTION_KEY);

  console.log('\n--- URLs que deben coincidir en el panel MP ---');
  console.log(`Redirect OAuth:  ${mercadoPagoConfig.redirectUri}`);
  console.log(`Webhook (prod):  https://api.qlinexa360.com/api/payments/mercadopago/webhook`);
  console.log(`Webhook (local): requiere túnel (ngrok) → ${env.BASE_URL || 'http://localhost:3000'}/api/payments/mercadopago/webhook`);

  if (mercadoPagoConfig.platformAccessToken) {
    try {
      const { data } = await axios.get('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${mercadoPagoConfig.platformAccessToken}` },
      });
      status('Token plataforma válido', true, `user_id=${data.id}, nickname=${data.nickname || 'n/a'}`);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message || e.message : String(e);
      status('Token plataforma válido', false, msg);
    }
  }

  console.log('\n--- Próximos pasos manuales ---');
  console.log('1. Panel MP → Tu aplicación → Modo prueba');
  console.log('2. Redirect URI: copiar la URL OAuth de arriba (localhost para dev)');
  console.log('3. Webhooks → Modo prueba → URL prod + evento Pagos → copiar clave secreta a .env');
  console.log('4. Cuentas de prueba → crear Vendedor (doctor) y Comprador (paciente)');
  console.log('5. Login doctor en Qlinexa360 → Perfil → Conectar Mercado Pago (OAuth con cuenta vendedor)');
  console.log('6. Activar cobro teleconsulta (monto > 0) y crear cita teleconsulta de prueba');
  console.log('7. Firmar consentimiento como paciente y pagar con tarjeta de prueba MP');
  console.log('8. Verificar en Finanzas y en admin/mercadopago-comisiones (comisión 1%)');
  console.log('\nTarjetas sandbox MX: https://www.mercadopago.com.mx/developers/es/docs/checkout-api/integration-test/test-cards\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
