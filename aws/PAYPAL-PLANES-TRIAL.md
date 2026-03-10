# Planes PayPal con periodo de prueba (códigos promocionales)

Para que los códigos de 1 mes y 3 meses gratis cobren automáticamente al finalizar el periodo, debes crear planes con trial en PayPal.

## Crear planes en PayPal

1. Ve a [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) → **Apps** → tu app Live
2. O usa el [Product Management](https://www.paypal.com/billing/plans) de PayPal

### Plan 1: Suscripción mensual (sin trial, pago directo)

- **Producto:** Qlinexa360 Suscripción
- **Precio:** $499 MXN/mes
- **Trial:** Ninguno
- **ID del plan:** → `VITE_PAYPAL_PLAN_ID`

### Plan 2: 1 mes gratis (TRIAL_30D)

- **Producto:** Qlinexa360 Suscripción
- **Precio:** $499 MXN/mes
- **Trial:** 1 mes gratis ($0)
- **ID del plan:** → `VITE_PAYPAL_PLAN_ID_TRIAL_1M`

### Plan 3: 3 meses gratis (DISCOUNT_50_3M)

- **Producto:** Qlinexa360 Suscripción
- **Precio:** $499 MXN/mes
- **Trial:** 3 meses gratis ($0)
- **ID del plan:** → `VITE_PAYPAL_PLAN_ID_TRIAL_3M`

## Configuración

Añade en `frontend/.env.production`:

```
VITE_PAYPAL_PLAN_ID=P-XXXXXXXXX
VITE_PAYPAL_PLAN_ID_TRIAL_1M=P-YYYYYYYYY
VITE_PAYPAL_PLAN_ID_TRIAL_3M=P-ZZZZZZZZZ
```

## Referencia PayPal

- [Offer a trial period](https://developer.paypal.com/docs/subscriptions/customize/trial-period/)
- [Create plan API](https://developer.paypal.com/docs/api/subscriptions/v1/#plans_create)

## Si no creas los planes con trial

Si `VITE_PAYPAL_PLAN_ID_TRIAL_1M` o `VITE_PAYPAL_PLAN_ID_TRIAL_3M` no están definidos, el frontend usará el plan estándar (`VITE_PAYPAL_PLAN_ID`), que **cobraría inmediatamente**. Para evitar cobros anticipados, crea los planes con trial antes de desplegar.
