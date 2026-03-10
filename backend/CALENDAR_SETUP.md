# Configuración de Calendarios Externos - Qlinexa360

## Descripción General
Este documento explica cómo configurar la integración con calendarios externos (Google Calendar, Microsoft Outlook, Apple Calendar y Notion Calendar) en Qlinexa360.

📘 **Guía detallada:** Ver [OAUTH_CALENDARIOS_PRODUCCION.md](../../docs/OAUTH_CALENDARIOS_PRODUCCION.md) para instrucciones paso a paso para obtener las credenciales OAuth de cada proveedor en producción.

## Variables de Entorno Requeridas

### Google Calendar
```bash
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret
# Producción: https://api.qlinexa360.com/api/calendar-sync/auth/google/callback
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar-sync/auth/google/callback
```

### Microsoft Outlook
```bash
OUTLOOK_CLIENT_ID=tu_outlook_client_id
OUTLOOK_CLIENT_SECRET=tu_outlook_client_secret
# Producción: https://api.qlinexa360.com/api/calendar-sync/auth/outlook/callback
OUTLOOK_REDIRECT_URI=http://localhost:3000/api/calendar-sync/auth/outlook/callback
```

### Apple Calendar
```bash
APPLE_CLIENT_ID=tu_apple_client_id
APPLE_CLIENT_SECRET=tu_apple_client_secret
# Producción: https://api.qlinexa360.com/api/calendar-sync/auth/apple/callback
APPLE_REDIRECT_URI=http://localhost:3000/api/calendar-sync/auth/apple/callback
```

### Notion Calendar
```bash
NOTION_CLIENT_ID=tu_notion_client_id
NOTION_CLIENT_SECRET=tu_notion_client_secret
# Producción: https://api.qlinexa360.com/api/calendar-sync/auth/notion/callback
NOTION_REDIRECT_URI=http://localhost:3000/api/calendar-sync/auth/notion/callback
```

**Importante:** En producción, configura en el backend también `FRONTEND_URL=https://www.qlinexa360.com`. En cada proveedor OAuth (Google Cloud Console, Azure, etc.) debes registrar la URI de callback de producción como autorizada.

## Pasos para Configurar

### 1. Google Calendar API
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google Calendar
4. Crea credenciales OAuth 2.0
5. Configura las URIs de redirección autorizadas
6. Copia el Client ID y Client Secret

### 2. Microsoft Graph API (Outlook)
1. Ve a [Azure Portal](https://portal.azure.com/)
2. Registra una nueva aplicación
3. Configura los permisos para Calendars.ReadWrite
4. Crea un secreto de cliente
5. Copia el Client ID y Client Secret

### 3. Apple Calendar API
1. Ve a [Apple Developer](https://developer.apple.com/)
2. Crea un nuevo App ID
3. Habilita los servicios de calendario
4. Crea credenciales de cliente
5. Copia el Client ID y Client Secret

### 4. Notion API
1. Ve a [Notion Developers](https://developers.notion.com/)
2. Crea una nueva integración
3. Configura los permisos de calendario
4. Copia el Client ID y Client Secret

## Funcionalidades Implementadas

### Backend
- ✅ Controlador para manejar conexiones de calendarios
- ✅ Servicio para generar URLs de autorización
- ✅ Manejo de callbacks OAuth
- ✅ Almacenamiento seguro de tokens
- ✅ Sincronización de eventos

### Frontend
- ✅ Componente de calendarios vinculados
- ✅ Botones funcionales para cada proveedor
- ✅ Manejo de estados de conexión
- ✅ Notificaciones de éxito/error
- ✅ Interfaz de usuario intuitiva

## Flujo de Autorización

1. **Usuario hace clic en "Vincular Calendario"**
2. **Sistema genera URL de autorización OAuth**
3. **Se abre ventana popup para autorización**
4. **Usuario autoriza en el proveedor del calendario**
5. **Proveedor redirige al callback con código**
6. **Sistema intercambia código por tokens**
7. **Se almacena la conexión en la base de datos**
8. **Se cierra la ventana popup**
9. **Se muestra mensaje de éxito**

## Seguridad

- Los tokens se almacenan encriptados en la base de datos
- Se usan URIs de redirección específicas
- Se implementa validación de estado OAuth
- Los tokens se refrescan automáticamente
- Se pueden revocar conexiones en cualquier momento

## Sincronización

- **Automática**: Los eventos se sincronizan cada 15 minutos
- **Manual**: Los usuarios pueden forzar sincronización
- **Bidireccional**: Los cambios se reflejan en ambas direcciones
- **Conflictos**: Se resuelven automáticamente con timestamp más reciente

## Solución de Problemas

### Error: "Configuración de calendarios externos incompleta"
- Verifica que todas las variables de entorno estén configuradas
- Reinicia el servidor después de cambiar las variables

### Error: "URI de redirección no válida"
- Verifica que la URI de redirección coincida exactamente
- Asegúrate de que esté configurada en el proveedor del calendario

### Error: "Token expirado"
- Los tokens se refrescan automáticamente
- Si persiste, desvincula y vuelve a vincular el calendario

## Notas de Desarrollo

- Los calendarios se vinculan por doctor (no por usuario)
- Cada doctor puede tener múltiples calendarios vinculados
- Los eventos se sincronizan solo cuando el calendario está activo
- Se implementa rate limiting para evitar exceder límites de API
