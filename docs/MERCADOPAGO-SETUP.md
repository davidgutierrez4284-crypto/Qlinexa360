# Mercado Pago Marketplace — Setup y pruebas Qlinexa360

## Estado del código

| Módulo | Ruta / ubicación |
|--------|------------------|
| OAuth doctor | `GET /api/payments/mercadopago/connect` |
| Callback | `GET /api/payments/mercadopago/callback` |
| Webhook | `POST /api/payments/mercadopago/webhook` |
| Config doctor | Perfil → sección Mercado Pago |
| Finanzas | `/dashboard/finanzas` |
| Comisiones admin | `/dashboard/admin/mercadopago-comisiones` |

Comisión plataforma: **1%** (`QLINEXA360_MARKETPLACE_FEE_PERCENTAGE`, regla en BD).

---

## 1. Panel Mercado Pago Developers

Entrar a [developers.mercadopago.com](https://www.mercadopago.com.mx/developers) → **Tus integraciones** → aplicación **Marketplace / Checkout Pro**.

### Redirect URL (OAuth) — obligatorio

**Detalles de la aplicación → Editar aplicación → Redirect URL** (no es la sección Webhooks).

Agregar estas URLs **exactas** (sin barra `/` al final):

- `http://localhost:3000/api/payments/mercadopago/callback` (desarrollo)
- `https://api.qlinexa360.com/api/payments/mercadopago/callback` (producción)

Si falta o no coincide, MP muestra *"Tenemos un problema"* al pulsar Conectar.

- OAuth México usa `https://auth.mercadopago.com.mx/authorization`.
- Si la app tiene **PKCE** activado, desactívalo para pruebas iniciales.

### Modo prueba (sandbox)

| Campo | Valor |
|-------|-------|
| **Client ID** | Copiar a `MERCADOPAGO_CLIENT_ID` |
| **Client Secret** | Solo credenciales **productivas** de la app → `MERCADOPAGO_CLIENT_SECRET` |
| **Access Token integrador** | Credenciales de prueba → `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` |
| **Redirect URI** | `http://localhost:3000/api/payments/mercadopago/callback` |
| **Webhook URL** | `https://api.qlinexa360.com/api/payments/mercadopago/webhook` |
| **Eventos webhook** | **Pagos** ✓ |
| **Clave secreta webhook** | Modo prueba → `MERCADOPAGO_WEBHOOK_SECRET` |
| **MERCADOPAGO_ENV** | `sandbox` |

> El **Client Secret** en MP siempre es el de credenciales productivas, aunque pruebes en sandbox. El **Access Token** de prueba es distinto al productivo.

### Modo productivo (cuando vayan a prod)

| Campo | Valor |
|-------|-------|
| **Redirect URI** | `https://api.qlinexa360.com/api/payments/mercadopago/callback` |
| **Webhook URL** | `https://api.qlinexa360.com/api/payments/mercadopago/webhook` |
| **Clave secreta webhook** | Modo productivo → AWS Secrets Manager |
| **MERCADOPAGO_ENV** | `production` (ECS task def) |

Secretos en ECS (`aws/ecs-task-def.json`): `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_PLATFORM_ACCESS_TOKEN`.

`DATA_ENCRYPTION_KEY` debe existir (cifrado tokens OAuth del doctor).

### Crear secrets en AWS (PowerShell, región us-east-2)

```powershell
$REGION = "us-east-2"

# 1) Client ID productivo (pestaña Productivas → Número de aplicación / Client ID)
aws secretsmanager create-secret --name qlinexa360-prod-mercadopago-client-id --secret-string "TU_CLIENT_ID" --region $REGION

# 2) Client Secret productivo
aws secretsmanager create-secret --name qlinexa360-prod-mercadopago-client-secret --secret-string "TU_CLIENT_SECRET" --region $REGION

# 3) Webhook secret (Notificaciones → Webhooks → Modo productivo → clave secreta)
aws secretsmanager create-secret --name qlinexa360-prod-mercadopago-webhook-secret --secret-string "TU_WEBHOOK_SECRET" --region $REGION

# 4) Access Token productivo del integrador (Credenciales productivas → Access token)
aws secretsmanager create-secret --name qlinexa360-prod-mercadopago-platform-token --secret-string "TU_ACCESS_TOKEN_PROD" --region $REGION

# 5) Clave AES-256 para cifrar tokens OAuth de doctores (generar una sola vez, no perder)
$encKey = -join ((1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) }))
aws secretsmanager create-secret --name qlinexa360-prod-data-encryption-key --secret-string $encKey --region $REGION
Write-Host "DATA_ENCRYPTION_KEY generada (guarda copia segura): $encKey"
```

Actualizar IAM del rol `qlinexa360-ecs-task-execution` con `aws/ecs-execution-secrets-policy.json` (incluye ARNs MP + encryption).

Verificar:

```powershell
aws secretsmanager list-secrets --region us-east-2 --query "SecretList[?contains(Name,'mercadopago')].Name"
```

---

## 2. Cuentas de prueba

En el panel MP → **Cuentas de prueba**:

| Rol | Uso |
|-----|-----|
| **Vendedor** | Conectar OAuth desde Perfil del doctor en Qlinexa360 |
| **Comprador** | Pagar checkout como paciente (tarjeta de prueba) |

Documentación tarjetas: [Tarjetas de prueba MP](https://www.mercadopago.com.mx/developers/es/docs/checkout-api/integration-test/test-cards).

Ejemplo aprobada (MX): Mastercard `5474 9254 3267 0366`, CVV `123`, vencimiento `11/30`.

**Crítico — nombre del titular:** el número de tarjeta solo no basta. En el campo **nombre del titular** (no tu nombre real) escribe exactamente **`APRO`** para simular pago aprobado. Cualquier otro nombre (p. ej. David, OTHE, vacío) produce rechazo u otro estado. Documento: **OTRO** + 9 dígitos (ej. `123456789`).

---

## 3. Variables locales (`backend/.env`)

```env
MERCADOPAGO_CLIENT_ID=""
MERCADOPAGO_CLIENT_SECRET=""
MERCADOPAGO_REDIRECT_URI="http://localhost:3000/api/payments/mercadopago/callback"
MERCADOPAGO_WEBHOOK_SECRET=""
MERCADOPAGO_PLATFORM_ACCESS_TOKEN=""
MERCADOPAGO_ENV="sandbox"
QLINEXA360_MARKETPLACE_FEE_PERCENTAGE=1
```

Verificar configuración:

```bash
cd backend
npx ts-node scripts/mp-sandbox-check.ts
npx ts-node scripts/qa-mercadopago-teleconsultation.ts
```

---

## 4. Prueba E2E — Teleconsulta con pago

### Paso A — Conectar Mercado Pago (doctor)

1. Backend y frontend en marcha (`npm run dev` en cada uno).
2. Login como **doctor** de prueba.
3. **Perfil** → sección **Mercado Pago** → **Conectar Mercado Pago**.
4. Autorizar con la **cuenta vendedor sandbox** de MP.
5. Debe volver a Perfil con toast “Mercado Pago conectado” (`?mp=connected`).

### Paso B — Configurar cobro teleconsulta

En la misma sección:

- Activar **Cobro de teleconsulta**.
- **Obligatorio antes del enlace** ✓
- Monto, ej. **$100 MXN**
- Guardar configuración.

### Paso C — Crear cita teleconsulta

1. Agenda → nueva cita tipo **Teleconsulta** con un paciente.
2. Enviar confirmación / enlace al paciente (token de teleconsulta).

### Paso D — Flujo paciente

1. Abrir enlace `/teleconsulta/{token}`.
2. Firmar consentimiento.
3. Si hay cobro obligatorio → botón **Pagar** → Checkout MP (sandbox).
4. Pagar con tarjeta de prueba **APRO**.
5. Tras el pago, la página hace polling cada 8 s y sincroniza estado con MP (no requiere webhook en localhost).
6. Debe aparecer el **enlace Meet/Teams**.

### Paso E — Verificar backend

- **Finanzas** (`/dashboard/finanzas`): transacción `approved`, comisión 1%.
- BD: `MercadoPagoPayment.status = approved`, `PaymentAuditLog`.
- Admin → **Comisiones MP**: reporte con fee de plataforma.

---

## 5. Prueba — Cobro presencial

1. Doctor con MP conectado.
2. Agenda o consulta → **Cobrar con Mercado Pago** (modal presencial).
3. Paciente paga en checkout; webhook o sync actualiza estado.

---

## 6. Webhooks

| Entorno | URL |
|---------|-----|
| Producción | `https://api.qlinexa360.com/api/payments/mercadopago/webhook` |
| Local | MP no alcanza `localhost` — usar **ngrok** o confiar en sync al volver de checkout |

En sandbox, si falta `MERCADOPAGO_WEBHOOK_SECRET`, el webhook acepta peticiones sin firma (solo dev).

Configurar **dos** claves en MP (Modo prueba y Modo productivo) y usar la que corresponda en cada entorno.

---

## 7. Checklist antes de producción

- [ ] Redirect URI prod registrada en MP
- [ ] Webhook prod con evento Pagos y secret en AWS
- [ ] `MERCADOPAGO_ENV=production` en ECS
- [ ] Access Token **productivo** del integrador en Secrets Manager
- [ ] Doctor real conecta OAuth con su cuenta MP
- [ ] Prueba de pago real de bajo monto
- [ ] Términos de uso actualizados (cláusulas MP en app)

---

## 8. Solución de problemas

| Síntoma | Causa probable |
|---------|----------------|
| “Mercado Pago no configurado” | Faltan `CLIENT_ID` / `CLIENT_SECRET` en `.env` o ECS |
| OAuth error redirect_uri | URI en panel MP ≠ `MERCADOPAGO_REDIRECT_URI` |
| Conectado pero no cobra | Cobro teleconsulta desactivado o monto = 0 |
| Pagó pero no hay enlace | Pago no `approved`; revisar logs backend / sync |
| Webhook 401/invalid signature | `MERCADOPAGO_WEBHOOK_SECRET` incorrecto para el modo (prueba vs prod) |
| Comisión no aparece | Verificar regla activa en `PlatformMercadoPagoCommissionRule` y `marketplace_fee` en preferencia |
| Checkout OK pero «Tu tarjeta rechazó el pago» | Titular de la tarjeta debe ser **`APRO`** (panel MP → Tarjetas de prueba). No uses tu nombre real |
| Botón Pagar deshabilitado | Incógnito; cuenta **Comprador de prueba** distinta al **Vendedor** OAuth; documento OTRO completo |
| MP muestra «pagado» pero Qlinexa sigue pendiente | En sandbox no se envía `marketplace_fee` (la comisión puede dejar la orden en `payment_required`). Pulsa **Generar nuevo enlace de pago** y paga otra vez con titular **APRO** |
| MP «Algo salió mal… No pudimos procesar tu pago» | Pago rechazado en checkout (titular ≠ **APRO**, tarjeta real, sesión MP del vendedor). Pulsa **Generar nuevo enlace de pago** — el enlace anterior queda invalidado |
