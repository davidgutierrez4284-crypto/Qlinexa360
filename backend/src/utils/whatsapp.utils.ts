// import twilio from 'twilio';

// Comentado temporalmente para evitar errores de inicialización
// const client = twilio(
//   process.env.TWILIO_ACCOUNT_SID,
//   process.env.TWILIO_AUTH_TOKEN
// );

export const sendWhatsAppMessage = async (to: string, message: string) => {
  try {
    console.warn('Funcionalidad de WhatsApp temporalmente deshabilitada. Configure TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN para habilitarla.');
    // await client.messages.create({
    //   body: message,
    //   from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    //   to: `whatsapp:${to}`
    // });
  } catch (error) {
    console.error('Error al enviar mensaje de WhatsApp:', error);
    throw error;
  }
}; 