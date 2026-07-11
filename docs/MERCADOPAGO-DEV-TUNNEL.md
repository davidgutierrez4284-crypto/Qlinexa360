# Mercado Pago — prueba OAuth en desarrollo local (sin deploy a prod)

Mercado Pago **no acepta** `http://localhost` en Redirect URL. Para probar OAuth en tu PC usamos un **túnel HTTPS** (ngrok) hacia el backend local (`:3000`).

## Requisitos

- Backend local: `cd backend && npm run dev` (puerto **3000**)
- Frontend local: `cd frontend && npm run dev` (puerto **5173**)
- [ngrok](https://ngrok.com/download) instalado y cuenta gratuita (auth token)

## Pasos

### 1. Iniciar túnel

En una terminal aparte:

```bash
ngrok http 3000
```

Copia la URL **HTTPS** que aparece, por ejemplo:

```
https://a1b2c3d4.ngrok-free.app
```

### 2. Mercado Pago Developers

**Detalles de la aplicación → Editar → Configuración avanzada → Redirect URL**

Agrega (además de la de prod si quieres):

```
https://a1b2c3d4.ngrok-free.app/api/payments/mercadopago/callback
```

Guarda la aplicación.

> La URL de ngrok **cambia** cada vez que reinicias ngrok (plan free). Hay que actualizar MP y `.env` cuando cambie.

### 3. `backend/.env`

```env
MERCADOPAGO_ENV=sandbox
MERCADOPAGO_REDIRECT_URI=https://a1b2c3d4.ngrok-free.app/api/payments/mercadopago/callback
BASE_URL=https://a1b2c3d4.ngrok-free.app
FRONTEND_URL=http://localhost:5173
# Opcional: túnel HTTPS al frontend para redirección post-pago MP (back_urls).
# Sin esto, el checkout funciona igual; el paciente vuelve manualmente y el webhook actualiza el estado.
# FRONTEND_PUBLIC_URL=https://b5c6d7e8.ngrok-free.app
```

Reinicia el backend.

### 4. Probar conexión

1. Abre `http://localhost:5173/dashboard/profile`
2. **Conectar Mercado Pago**
3. Login con cuenta **Vendedor de prueba** (Developers → Cuentas de prueba)
4. **Autorizar**
5. Debes volver a `http://localhost:5173/dashboard/profile?mp=connected`

### 5. Verificar en BD local

Tabla `payment_provider_connections` debe tener `status = active` para tu doctor.

## Webhooks en local (opcional)

Con `BASE_URL` apuntando a ngrok, las notificaciones de pago de MP también pueden llegar a tu backend local si MP puede alcanzar esa URL.

## Volver a prod

Cuando termines pruebas locales, restaura en `.env`:

```env
MERCADOPAGO_REDIRECT_URI=https://api.qlinexa360.com/api/payments/mercadopago/callback
BASE_URL=http://localhost:3000
```

Y en MP deja la Redirect URL de prod; puedes quitar la de ngrok.

## Script auxiliar

```powershell
.\scripts\mp-dev-ngrok.ps1
```

Muestra las URLs exactas para copiar en MP y `.env`.
