# Configuración de Variables de Entorno

## Variables Requeridas para OAuth

Agrega las siguientes variables a tu archivo `.env`:

```env
# Encryption Key (32 characters)
ENCRYPTION_KEY="your-secret-key-32-chars-long"

# Google OAuth Configuration
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/calendar/external/callback/google"

# Microsoft OAuth Configuration
MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
MICROSOFT_TENANT_ID="your-microsoft-tenant-id"
MICROSOFT_REDIRECT_URI="http://localhost:3000/api/calendar/external/callback/outlook"

# Apple OAuth Configuration (if needed)
APPLE_CLIENT_ID="your-apple-client-id"
APPLE_CLIENT_SECRET="your-apple-client-secret"
APPLE_REDIRECT_URI="http://localhost:3000/api/calendar/external/callback/apple"

# Notion OAuth Configuration (if needed)
NOTION_CLIENT_ID="your-notion-client-id"
NOTION_CLIENT_SECRET="your-notion-client-secret"
NOTION_REDIRECT_URI="http://localhost:3000/api/calendar/external/callback/notion"
```

## Configuración de OAuth

### Google Calendar
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google Calendar
4. Crea credenciales OAuth 2.0
5. Agrega las URIs de redirección autorizadas

### Microsoft Outlook
1. Ve a [Azure Portal](https://portal.azure.com/)
2. Registra una nueva aplicación
3. Configura los permisos para Microsoft Graph
4. Crea un secreto de cliente
5. Configura las URIs de redirección

### Apple Calendar
1. Ve a [Apple Developer](https://developer.apple.com/)
2. Crea un identificador de servicios
3. Configura los permisos necesarios
4. Crea las credenciales correspondientes

### Notion Calendar
1. Ve a [Notion Developers](https://developers.notion.com/)
2. Crea una nueva integración
3. Configura los permisos necesarios
4. Obtén las credenciales de OAuth 