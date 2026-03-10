# Variables de Entorno - Calendarios Externos

Este documento describe las variables de entorno necesarias para configurar las integraciones con Google Calendar y Outlook Calendar.

## Variables Requeridas

### Base de Datos
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/medilink360"
```

### Servidor
```bash
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here
```

### Google Calendar API

Para configurar Google Calendar, necesitas crear un proyecto en Google Cloud Console:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la Google Calendar API
4. Crea credenciales OAuth 2.0
5. Configura las URLs de redirección autorizadas

```bash
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/external-calendars/google/callback
```

### Microsoft Outlook API

Para configurar Outlook Calendar, necesitas registrar una aplicación en Azure Portal:

1. Ve a [Azure Portal](https://portal.azure.com/)
2. Registra una nueva aplicación
3. Configura los permisos para Microsoft Graph
4. Crea un secreto de cliente

```bash
OUTLOOK_CLIENT_ID=your_outlook_client_id_here
OUTLOOK_CLIENT_SECRET=your_outlook_client_secret_here
OUTLOOK_REDIRECT_URI=http://localhost:3000/api/external-calendars/outlook/callback
```

## Variables Opcionales

### SendGrid (para emails)
```bash
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@qlinexa360.com
```

### WhatsApp Business API
```bash
WHATSAPP_API_KEY=your_whatsapp_api_key_here
WHATSAPP_PHONE_NUMBER=your_whatsapp_phone_number_here
```

## Configuración de Desarrollo

Para desarrollo local, crea un archivo `.env` en la carpeta `backend` con las variables necesarias:

```bash
# Copia este contenido a backend/.env
DATABASE_URL="postgresql://username:password@localhost:5432/medilink360"
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here

# Google Calendar (configurar después de crear proyecto en Google Cloud)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/external-calendars/google/callback

# Microsoft Outlook (configurar después de registrar app en Azure)
OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=
OUTLOOK_REDIRECT_URI=http://localhost:3000/api/external-calendars/outlook/callback
```

## Pasos para Configurar las APIs

### Google Calendar

1. **Crear proyecto en Google Cloud Console:**
   - Ve a https://console.cloud.google.com/
   - Crea un nuevo proyecto
   - Habilita la Google Calendar API

2. **Configurar OAuth 2.0:**
   - Ve a "Credenciales" > "Crear credenciales" > "ID de cliente de OAuth 2.0"
   - Tipo de aplicación: Aplicación web
   - URLs autorizadas: `http://localhost:3000`
   - URLs de redirección: `http://localhost:3000/api/external-calendars/google/callback`

3. **Copiar credenciales:**
   - Copia el Client ID y Client Secret
   - Agrégalos a tu archivo `.env`

### Microsoft Outlook

1. **Registrar aplicación en Azure:**
   - Ve a https://portal.azure.com/
   - Registra una nueva aplicación
   - Configura los permisos para Microsoft Graph (Calendars.ReadWrite)

2. **Crear secreto de cliente:**
   - Ve a "Certificados y secretos"
   - Crea un nuevo secreto de cliente
   - Copia el valor del secreto

3. **Configurar redirecciones:**
   - Ve a "Autenticación"
   - Agrega la URL de redirección: `http://localhost:3000/api/external-calendars/outlook/callback`

4. **Copiar credenciales:**
   - Copia el Application (client) ID y el secreto
   - Agrégalos a tu archivo `.env` 