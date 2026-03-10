# Configuración OAuth2 Real para Calendarios

## ¿Por qué implementar OAuth2 real?

La autenticación simulada actual es útil para desarrollo rápido, pero **no es suficiente para producción**. Implementar OAuth2 real te permite:

✅ **Probar el flujo completo** antes de ir a producción  
✅ **Verificar la integración** con APIs reales  
✅ **Detectar problemas** de configuración temprano  
✅ **Validar tokens** y refresh tokens  
✅ **Sincronizar eventos** reales  

## Configuración por Proveedor

### 1. Google Calendar (Recomendado para empezar)

#### Paso 1: Google Cloud Console
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita **Google Calendar API**

#### Paso 2: Credenciales OAuth2
1. **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth 2.0 Client IDs**
3. **Application type**: Web application
4. **Authorized redirect URIs**: 
   - `http://localhost:3000/api/calendar/auth/google/callback`
   - `http://localhost:5173/api/calendar/auth/google/callback`

#### Paso 3: Variables de Entorno
```bash
GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="tu-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/calendar/auth/google/callback"
```

### 2. Microsoft Outlook

#### Paso 1: Azure Portal
1. Ve a [Azure Portal](https://portal.azure.com/)
2. **App registrations** → **New registration**
3. **Supported account types**: Personal Microsoft accounts only

#### Paso 2: Permisos
1. **API permissions** → **Add a permission**
2. **Microsoft Graph** → **Calendars.ReadWrite**
3. **Grant admin consent**

#### Paso 3: Variables de Entorno
```bash
OUTLOOK_CLIENT_ID="tu-client-id"
OUTLOOK_CLIENT_SECRET="tu-client-secret"
OUTLOOK_REDIRECT_URI="http://localhost:3000/api/calendar/auth/outlook/callback"
```

### 3. Notion

#### Paso 1: Notion Developers
1. Ve a [Notion Developers](https://developers.notion.com/)
2. **My integrations** → **New integration**
3. **Capabilities**: Read content, Update content

#### Paso 2: Variables de Entorno
```bash
NOTION_CLIENT_ID="tu-client-id"
NOTION_CLIENT_SECRET="tu-client-secret"
NOTION_REDIRECT_URI="http://localhost:3000/api/calendar/auth/notion/callback"
```

## Instalación

### 1. Instalar Dependencias
```bash
npm install axios
```

### 2. Configurar Variables de Entorno
Copia las variables necesarias a tu archivo `.env`:
```bash
# Solo las que necesites
GOOGLE_CLIENT_ID="tu-client-id"
GOOGLE_CLIENT_SECRET="tu-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/calendar/auth/google/callback"
```

### 3. Reiniciar Backend
```bash
npm run dev
```

## Cómo Funciona

### Modo Híbrido
- **Si OAuth está configurado**: Usa autenticación real
- **Si OAuth NO está configurado**: Usa autenticación simulada

### Flujo OAuth2 Real
1. Usuario hace clic en "Conectar"
2. Se abre ventana con URL de autorización real
3. Usuario autoriza en Google/Microsoft/Notion
4. Se recibe código de autorización
5. Se intercambia por tokens reales
6. Se guardan en base de datos
7. Se valida el token

### Flujo Simulado (Fallback)
1. Usuario hace clic en "Conectar"
2. Se simula autorización exitosa
3. Se guardan tokens simulados
4. Funciona para desarrollo básico

## Ventajas de OAuth2 Real

### En Desarrollo
- **Pruebas reales** del flujo de autenticación
- **Validación de tokens** y permisos
- **Detección temprana** de problemas
- **Experiencia real** para el usuario

### En Producción
- **Seguridad real** con tokens válidos
- **Sincronización real** de eventos
- **Integración completa** con calendarios externos
- **Escalabilidad** para múltiples usuarios

## Solución de Problemas

### Error: "OAuth no configurado"
- Verifica que las variables de entorno estén definidas
- Reinicia el backend después de cambiar `.env`
- Confirma que los nombres de variables sean correctos

### Error: "Invalid redirect URI"
- Verifica que la URI de redirección coincida exactamente
- Incluye `http://localhost:3000` y `http://localhost:5173`
- Confirma en la consola del proveedor

### Error: "Invalid client credentials"
- Verifica Client ID y Client Secret
- Confirma que la aplicación esté habilitada
- Verifica que la API esté habilitada

## Próximos Pasos

1. **Configura Google Calendar** (más fácil)
2. **Prueba la conexión** completa
3. **Configura Outlook** si es necesario
4. **Implementa sincronización** de eventos reales
5. **Prueba en producción** con HTTPS

## Notas Importantes

- **HTTPS requerido** en producción (Google/Microsoft no permiten HTTP)
- **Rate limiting** puede afectar desarrollo
- **Tokens expiran** y necesitan refresh
- **Permisos** deben ser mínimos necesarios
- **Logs** para debugging en desarrollo
