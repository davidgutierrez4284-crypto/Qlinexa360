# Configuración de Planes PayPal – Error RESOURCE_NOT_FOUND

## Error que aparece

Cuando el usuario hace clic en "PayPal Suscribirse" durante el registro de doctor, aparece en consola:

```
RESOURCE_NOT_FOUND
INVALID_RESOURCE_ID - Requested resource ID was not found.
```

Esto significa que **PayPal no encuentra el Plan de suscripción** (el ID del plan que enviamos).

---

## Causas habituales

1. **Plan eliminado o desactivado** en el Dashboard de PayPal
2. **Mezcla de entornos**: Client ID de **Live** con Plan IDs de **Sandbox** (o al revés)
3. **Plan de otra cuenta**: Los planes están en una cuenta de PayPal diferente a la del Client ID
4. **Plan ID incorrecto**: Error al copiar o configurar el ID en `.env.production`

---

## Pasos para verificar y corregir

### 1. Entrar al Dashboard de PayPal

- **Producción (Live):** https://www.paypal.com/billing/plans  
- **Pruebas (Sandbox):** https://www.sandbox.paypal.com/billing/plans  

### 2. Verificar que usas el mismo entorno

Tu `.env.production` tiene `VITE_PAYPAL_CLIENT_ID` de **Live**. Los planes deben estar creados en **Live** (no en Sandbox).

### 3. Revisar los planes

En el Dashboard, comprueba que existen:

| Variable | Uso | Estado requerido |
|---------|-----|------------------|
| `VITE_PAYPAL_PLAN_ID` | Suscripción mensual sin código | **ACTIVE** |
| `VITE_PAYPAL_PLAN_ID_TRIAL_1M` | Código 1 mes gratis | **ACTIVE** |
| `VITE_PAYPAL_PLAN_ID_TRIAL_3M` | Código 3 meses gratis | **ACTIVE** |

### 4. Obtener el Plan ID correcto

En cada plan, haz clic en el plan → verás el **Plan ID** (formato `P-XXXXXXXXXXXXXXXX`). Copia ese ID exacto.

### 5. Actualizar `.env.production`

```env
VITE_PAYPAL_PLAN_ID=P-XXXXXXXXXX  # Plan mensual $499 mxn
VITE_PAYPAL_PLAN_ID_TRIAL_1M=P-XXXXXXXXXX  # Plan con 1 mes trial
VITE_PAYPAL_PLAN_ID_TRIAL_3M=P-XXXXXXXXXX   # Plan con 3 meses trial
```

### 6. Rebuild y redesplegar

```powershell
cd E:\proyectos\medilink360
.\scripts\deploy-frontend-s3.ps1
```

---

## Crear un plan nuevo (si no existe)

1. En https://www.paypal.com/billing/plans → **Create plan**
2. Configurar:
   - **Product:** Crear producto "Qlinexa360 Suscripción" si no existe
   - **Billing cycle:** 1 mes
   - **Precio:** $499 MXN (o el que corresponda)
   - **Moneda:** MXN
3. Guardar y copiar el **Plan ID** generado.

---

## Verificar Client ID y Plan en la misma cuenta

- Client ID: [developer.paypal.com](https://developer.paypal.com) → Apps → Tu app → Live credentials  
- Planes: [paypal.com/billing/plans](https://www.paypal.com/billing/plans)  

Ambos deben pertenecer a la **misma cuenta de negocio** de PayPal.
