# Guía para Obtener Credenciales OAuth de Calendarios (Producción)

## Modelo Multi-Tenant

**Importante:** En Qlinexa360 cada profesional de la salud vincula **su propio calendario personal**. La plataforma tendrá tantos calendarios vinculados como profesionales.

- **Una sola aplicación OAuth por proveedor** (Google, Outlook, Apple, Notion): tú creas una app en cada plataforma.
- **Cada profesional autoriza su cuenta** cuando hace clic en "Conectar": el flujo OAuth estándar permite que cada usuario conecte su propia cuenta con la misma app.
- Las credenciales (Client ID, Client Secret) se configuran **una vez** en el servidor; los tokens de acceso se guardan **por profesional** en la base de datos.

---

## Variables de Entorno a Configurar

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | ID de cliente de Google Cloud |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxx` | Secreto de cliente de Google |
| `GOOGLE_REDIRECT_URI` | `https://api.qlinexa360.com/api/calendar-sync/auth/google/callback` | URI de callback (producción) |
| `OUTLOOK_CLIENT_ID` | `xxx-xxx-xxx` | Application (client) ID de Azure |
| `OUTLOOK_CLIENT_SECRET` | `xxx~xxx` | Client secret de Azure |
| `OUTLOOK_REDIRECT_URI` | `https://api.qlinexa360.com/api/calendar-sync/auth/outlook/callback` | URI de callback |
| `NOTION_CLIENT_ID` | `xxx` | OAuth client ID de Notion |
| `NOTION_CLIENT_SECRET` | `secret_xxx` | OAuth client secret de Notion |
| `NOTION_REDIRECT_URI` | `https://api.qlinexa360.com/api/calendar-sync/auth/notion/callback` | URI de callback |
| `APPLE_CLIENT_ID` | `com.tudominio.calendar` | Service ID de Apple |
| `APPLE_CLIENT_SECRET` | `-----BEGIN PRIVATE KEY-----...` | JWT/ clave privada (Apple es distinto) |
| `APPLE_REDIRECT_URI` | `https://api.qlinexa360.com/api/calendar-sync/auth/apple/callback` | URI de callback |
| `FRONTEND_URL` | `https://www.qlinexa360.com` | URL del frontend (para redireccionar tras OAuth) |

**Nota:** Puedes configurar solo los proveedores que quieras habilitar. Si faltan credenciales de uno, ese proveedor mostrará "Integración no configurada" en lugar de éxito falso.

---

## 1. Google Calendar

### Paso 1: Crear proyecto en Google Cloud

1. Entra a [Google Cloud Console](https://console.cloud.google.com/)
2. Menú **☰** → **APIs y servicios** → **Biblioteca**
3. Busca **"Google Calendar API"** → **Habilitar**
4. Menú **☰** → **APIs y servicios** → **Credenciales**

### Paso 2: Configurar pantalla de consentimiento

1. En **Credenciales** → pestaña **Pantalla de consentimiento de OAuth**
2. Si aún no existe, crea una configuración:
   - **Tipo de usuario:** Externo (si profesionales usan cuentas @gmail.com) o Interno (solo si todos usan Google Workspace de tu organización)
   - **Nombre de la aplicación:** `Qlinexa360 Calendario`
   - **Correo de asistencia:** tu email
   - **Dominios autorizados:** `qlinexa360.com`, `api.qlinexa360.com`
   - **Scopes:** Añade:
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/calendar.events`
   - Guarda y continúa hasta finalizar

### Paso 3: Crear credenciales OAuth 2.0

1. **Credenciales** → **+ CREAR CREDENCIALES** → **ID de cliente de OAuth**
2. Tipo: **Aplicación web**
3. Nombre: `Qlinexa360 Calendar Sync`
4. **URIs de redirección autorizadas** — añade:
   ```
   https://api.qlinexa360.com/api/calendar-sync/auth/google/callback
   ```
   (Para desarrollo local puedes añadir también: `http://localhost:3000/api/calendar-sync/auth/google/callback`)
5. **Crear** → copia **ID de cliente** y **Secreto de cliente**

### Variables obtenidas

```bash
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://api.qlinexa360.com/api/calendar-sync/auth/google/callback
```

---

## 2. Microsoft Outlook / Office 365 Calendar

### Paso 1: Registrar aplicación en Azure

1. Entra a [Azure Portal](https://portal.azure.com/)
2. **Microsoft Entra ID** (antes Azure AD) → **Registros de aplicaciones** → **Nuevo registro**
3. Nombre: `Qlinexa360 Calendar Sync`
4. Tipos de cuenta soportados: **"Cuentas en cualquier directorio organizativo y cuentas personales de Microsoft"** (para que Outlook personal y corporativo funcionen)
5. URI de redirección: **Web** → `https://api.qlinexa360.com/api/calendar-sync/auth/outlook/callback`
6. **Registrar**

### Paso 2: Crear secreto de cliente

1. En tu aplicación → **Certificados y secretos**
2. **+ Nuevo secreto de cliente**
3. Descripción: `Qlinexa360 Calendar` / vencimiento según tu política
4. **Agregar** → copia el **Valor** (solo se muestra una vez)

### Paso 3: Configurar permisos API

1. **Permisos de API** → **+ Agregar permiso**
2. **Microsoft Graph** → **Permisos delegados**
3. Añade:
   - `Calendars.ReadWrite`
   - `offline_access` (para refresh token)
   - Opcional: `OnlineMeetings.ReadWrite` si usas reuniones
4. **Agregar permisos**
5. Si se requiere consentimiento de administrador: **Conceder consentimiento de administrador** (si aplica)

### Paso 4: URIs de redirección

1. **Autenticación** → en **URI de redirección**, confirma que esté:
   ```
   https://api.qlinexa360.com/api/calendar-sync/auth/outlook/callback
   ```

### Variables obtenidas

```bash
OUTLOOK_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OUTLOOK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
OUTLOOK_REDIRECT_URI=https://api.qlinexa360.com/api/calendar-sync/auth/outlook/callback
```

---

## 3. Apple Calendar (iCloud)

**Nota:** La integración con Apple Calendar es la más compleja porque Apple usa **Sign in with Apple** y calendarios vía **CalDAV**. Hay dos enfoques:

### Enfoque A: CalDAV (recomendado para iCloud Calendar)

Apple no ofrece un OAuth directo para Calendarios como Google/Outlook. Las opciones habituales son:

1. **CalDAV con app-specific password:** El profesional genera una contraseña de aplicación en iCloud y la introduce en la plataforma (no es OAuth clásico).
2. **Sign in with Apple + CalDAV:** Autenticación con Apple, luego acceso a CalDAV del usuario.

Si tu código actual usa OAuth “tipo Google” para Apple, es posible que el flujo aún no esté implementado de forma compatible con Apple. En ese caso, **Apple Calendar puede quedar pendiente** hasta implementar CalDAV.

### Enfoque B: Credenciales para Sign in with Apple (si ya las tienes)

1. [Apple Developer](https://developer.apple.com/account/) → **Certificates, Identifiers & Profiles**
2. **Identifiers** → **+** → **Services ID** (para web)
3. Identifier: `com.qlinexa360.calendar` (o similar)
4. **Configure** → Domain: `api.qlinexa360.com`, Return URL: `https://api.qlinexa360.com/api/calendar-sync/auth/apple/callback`
5. Para el Client Secret de Apple se usa un JWT firmado con tu clave privada; la generación no es trivial.

**Recomendación:** Dejar Apple Calendar para una fase posterior o documentar que requiere implementación específica de CalDAV.

```bash
# Solo si implementas Sign in with Apple para calendarios
APPLE_CLIENT_ID=com.qlinexa360.calendar
APPLE_CLIENT_SECRET=<JWT generado con tu clave privada>
APPLE_REDIRECT_URI=https://api.qlinexa360.com/api/calendar-sync/auth/apple/callback
```

---

## 4. Notion Calendar

### Paso 1: Crear integración en Notion

1. Entra a [Notion Developers](https://www.notion.so/my-integrations)
2. **+ New integration**
3. Nombre: `Qlinexa360 Calendar Sync`
4. Asociado a tu workspace (o el workspace de la plataforma)
5. **Submit** → se generan **OAuth client ID** y **OAuth client secret**

### Paso 2: Configurar OAuth

1. En la integración → **Capabilities**
2. Activa **Public integration** si quieres que cualquier profesional pueda conectar su Notion
3. **OAuth domain:** Añade `api.qlinexa360.com`
4. **Redirect URIs:** Añade `https://api.qlinexa360.com/api/calendar-sync/auth/notion/callback`

### Paso 3: Permisos

Notion Calendar se basa en la integración. Los permisos se definen al crear la integración; asegúrate de que tenga acceso a contenido relacionado con calendario si Notion lo expone.

### Variables obtenidas

```bash
NOTION_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOTION_CLIENT_SECRET=secret_xxxxxxxxxxxxxxxx
NOTION_REDIRECT_URI=https://api.qlinexa360.com/api/calendar-sync/auth/notion/callback
```

---

## Prioridad de implementación

| Proveedor      | Complejidad | Prioridad sugerida |
|----------------|------------|--------------------|
| Google Calendar| Baja       | ✅ Alta – muchos usuarios |
| Microsoft Outlook | Baja    | ✅ Alta |
| Notion Calendar  | Media     | Media |
| Apple Calendar   | Alta      | Baja – implementación específica |

---

## Checklist antes de producción

- [ ] `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` configurados
- [ ] `GOOGLE_REDIRECT_URI=https://api.qlinexa360.com/api/calendar-sync/auth/google/callback` en `.env`/Secrets
- [ ] URI de callback registrada en Google Cloud Console
- [ ] `OUTLOOK_CLIENT_ID` y `OUTLOOK_CLIENT_SECRET` configurados
- [ ] URI de callback registrada en Azure
- [ ] `FRONTEND_URL=https://www.qlinexa360.com` para redirigir al usuario tras OAuth
- [ ] Variables inyectadas en el backend (ECS, Secrets Manager, etc.) y servidor reiniciado

---

## Dónde configurar las variables

Según tu despliegue:

- **Docker/ECS:** Task Definition → Container Definition → Secrets / Environment
- **Vercel/Railway/Heroku:** Dashboard → Variables de entorno
- **Servidor Linux:** archivo `.env` en la raíz del backend (no subir a Git)
- **AWS Secrets Manager:** Crear secreto con las variables y referenciarlas en ECS

---

## Probar la conexión

1. Despliega el backend con las variables configuradas.
2. Inicia sesión como profesional de la salud.
3. Ve a **Calendario** → **Configuración** → **Calendarios Vinculados**.
4. Haz clic en **Conectar** en Google Calendar.
5. Deberías ser redirigido a Google para autorizar y luego volver con “Autenticación exitosa”.
6. Repite con Outlook y Notion según los que hayas configurado.
