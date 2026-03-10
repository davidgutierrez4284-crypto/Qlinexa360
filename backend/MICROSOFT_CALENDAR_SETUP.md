# Configuración de Microsoft Calendar (Outlook)

## Variables de Entorno Requeridas

Para habilitar la sincronización con Microsoft Calendar (Outlook), necesitas configurar las siguientes variables de entorno:

```env
# Microsoft Graph API Configuration
MICROSOFT_CLIENT_ID=your_client_id_here
MICROSOFT_CLIENT_SECRET=your_client_secret_here
MICROSOFT_TENANT_ID=your_tenant_id_here
MICROSOFT_REDIRECT_URI=http://localhost:3001/api/external-calendar/callback/outlook
```

## Cómo Obtener las Credenciales

### 1. Registrar la Aplicación en Azure Portal

1. Ve a [Azure Portal](https://portal.azure.com)
2. Navega a **Azure Active Directory** > **App registrations**
3. Haz clic en **New registration**
4. Completa el formulario:
   - **Name**: `Medilink360 Calendar Sync`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: `Web` → `http://localhost:3001/api/external-calendar/callback/outlook`

### 2. Obtener Client ID y Tenant ID

1. En la página de la aplicación registrada, copia:
   - **Application (client) ID** → `MICROSOFT_CLIENT_ID`
   - **Directory (tenant) ID** → `MICROSOFT_TENANT_ID`

### 3. Crear Client Secret

1. Ve a **Certificates & secrets**
2. Haz clic en **New client secret**
3. Agrega una descripción y selecciona la expiración
4. Copia el **Value** → `MICROSOFT_CLIENT_SECRET`

### 4. Configurar Permisos

1. Ve a **API permissions**
2. Haz clic en **Add a permission**
3. Selecciona **Microsoft Graph**
4. Selecciona **Delegated permissions**
5. Busca y agrega:
   - `Calendars.Read`
   - `Calendars.ReadWrite` (opcional, para crear eventos)
6. Haz clic en **Grant admin consent**

## Configuración en Producción

Para producción, actualiza `MICROSOFT_REDIRECT_URI` con tu dominio:

```env
MICROSOFT_REDIRECT_URI=https://tu-dominio.com/api/external-calendar/callback/outlook
```

## Verificación

Una vez configuradas las variables, el servicio mostrará:

```
✅ Microsoft Calendar: Credenciales configuradas correctamente
```

Si no están configuradas, verás:

```
⚠️  Microsoft Calendar: Credenciales no configuradas. La sincronización de Outlook estará deshabilitada.
```

## Solución de Problemas

### Error: "Client credential must not be empty"

- Verifica que `MICROSOFT_CLIENT_SECRET` esté configurado
- Asegúrate de que el secret no haya expirado

### Error: "Invalid client"

- Verifica que `MICROSOFT_CLIENT_ID` sea correcto
- Confirma que la aplicación esté registrada en el tenant correcto

### Error: "Redirect URI mismatch"

- Verifica que `MICROSOFT_REDIRECT_URI` coincida exactamente con el configurado en Azure Portal 