const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
  console.log('=== CONFIGURACIÓN SMTP ===');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);
  console.log('Secure:', process.env.SMTP_SECURE);
  console.log('User:', process.env.SMTP_USER);
  console.log('Pass:', process.env.SMTP_PASS ? '***CONFIGURADO***' : 'NO CONFIGURADO');
  console.log('From NoReply:', process.env.SMTP_FROM_NOREPLY);
  console.log('========================\n');

  if (!process.env.SMTP_PASS) {
    console.error('❌ ERROR: SMTP_PASS no está configurado en .env');
    return;
  }

  // Crear transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    console.log('🔍 Verificando conexión SMTP...');
    await transporter.verify();
    console.log('✅ Conexión SMTP exitosa\n');

    console.log('📧 Enviando email de prueba...');
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM_NOREPLY || process.env.SMTP_USER,
      to: 'david@atlangaholdings.com',
      subject: '🧪 Prueba de correo - Qlinexa360',
      html: `
        <h2>Prueba de correo exitosa</h2>
        <p>Este es un email de prueba para verificar que la configuración de Zoho SMTP funciona correctamente.</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-MX')}</p>
        <p><strong>Servidor:</strong> ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Qlinexa360 - Plataforma de salud digital</p>
      `
    });

    console.log('✅ Email enviado exitosamente!');
    console.log('Message ID:', info.messageId);
    console.log('URL de respuesta:', info.response);

  } catch (error) {
    console.error('❌ Error al enviar email:', error.message);
    if (error.code) console.error('Código de error:', error.code);
    if (error.response) console.error('Respuesta del servidor:', error.response);
  }
}

testEmail();
