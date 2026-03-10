# Configuración de Google Calendar OAuth

## Paso 1: Crear proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita las APIs necesarias:
   - Google Calendar API
   - Google+ API (si es necesario)

## Paso 2: Configurar credenciales OAuth 2.0

1. En el menú lateral, ve a **"APIs y servicios" > "Credenciales"**
2. Haz clic en **"Crear credenciales" > "ID de cliente de OAuth 2.0"**
3. Selecciona **"Aplicación web"**
4. Configura las URIs de redirección autorizadas:
   ```
   http://localhost:3000/api/calendar/external/callback/google
   http://localhost:5173/dashboard/calendario
   ```

## Paso 3: Obtener credenciales

1. Copia el **ID de cliente** y **Secreto del cliente**
2. Agrega estas variables a tu archivo `.env`:

```env
GOOGLE_CLIENT_ID="tu-id-de-cliente-aqui"
GOOGLE_CLIENT_SECRET="tu-secreto-de-cliente-aqui"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/calendar/external/callback/google"
```

## Paso 4: Configurar pantalla de consentimiento

1. Ve a **"APIs y servicios" > "Pantalla de consentimiento de OAuth"**
2. Selecciona **"Externo"** si es para desarrollo
3. Completa la información básica:
   - Nombre de la aplicación: "Medilink360"
   - Correo electrónico de soporte
   - Dominio autorizado: `localhost`

## Paso 5: Agregar usuarios de prueba (opcional)

1. En la pantalla de consentimiento, agrega tu correo como usuario de prueba
2. Esto te permitirá probar la funcionalidad sin verificación

## Variables de entorno completas

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID="tu-id-de-cliente-aqui"
GOOGLE_CLIENT_SECRET="tu-secreto-de-cliente-aqui"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/calendar/external/callback/google"

# Encryption Key (32 characters)
ENCRYPTION_KEY="tu-clave-de-encriptacion-de-32-caracteres"
```

## Prueba de la configuración

Una vez configurado, podrás:
1. Ir al perfil del doctor
2. Hacer clic en "Vincular nuevo calendario" > "Google Calendar"
3. Autorizar el acceso
4. Ver eventos sincronizados en el calendario principal 