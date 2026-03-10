# Guia de despliegue PROD

## Completado

- **Backend**: Dockerfile, .dockerignore, health endpoint `/health`
- **ECR**: Imagen `qlinexa360-backend:prod` en ECR
- **ECS**: Task definition registrada (rev 2+), service actualizada en `qlinexa360-prod-cluster`
- **Frontend**: Build con `VITE_API_URL=https://api.qlinexa360.com`, deploy a S3 `qlinexa360`

## Scripts de deploy

```powershell
# 1. Backend: Build + push a ECR
.\scripts\deploy-backend-ecr.ps1

# 2. ECS: Registrar task def + actualizar service (ajusta variables si es primera vez)
.\scripts\deploy-ecs-service.ps1

# 3. Frontend: Build + sync a S3
.\scripts\deploy-frontend-s3.ps1
```

## PayPal en producción (no Sandbox)

El registro de doctores usa PayPal. Si te lleva a **Sandbox**, usa credenciales **Live**.

1. Entra en **developer.paypal.com** → cambia a **Live** (no Sandbox).
2. **Apps & Credentials** → crea o usa una app → copia el **Client ID**.
3. **Products** → crea un **Subscription plan** en Live → copia el **Plan ID**.
4. Antes de desplegar el frontend:
   ```powershell
   $env:VITE_PAYPAL_CLIENT_ID = "tu-client-id-live"
   $env:VITE_PAYPAL_PLAN_ID = "tu-plan-id-live"
   .\scripts\deploy-frontend-s3.ps1
   ```
   O crea `frontend/.env.production` con esos valores y despliega.

---

## Pendiente (manual)

1. **CloudFront**: Si usas CDN, configura OAC y politica. Para invalidar cache tras deploy:
   ```bash
   aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
   ```
   Ajusta `$CLOUDFRONT_DIST_ID` en `deploy-frontend-s3.ps1` si aplica.

2. **DNS Squarespace**: CNAME/ALIAS para `www.qlinexa360.com` hacia CloudFront (o S3 si aplica).

## Reportes de BD (admin)

Para reportes de usuarios, códigos promocionales y facturación mensual, ver **[REPORTES-BD-PROD.md](REPORTES-BD-PROD.md)**. Requiere crear el secreto `qlinexa360-prod-admin-report-token` y añadirlo a la task definition de ECS.

## Zona horaria (multi-país / fronteras)

Para doctores en otros países (Colombia, Argentina) o zonas fronterizas (Tijuana), ver **[CONFIGURACION-ZONA-HORARIA.md](CONFIGURACION-ZONA-HORARIA.md)**. La task definition ya incluye `TZ` y `PRACTICE_TIMEZONE`.

## Validacion

- Backend: `https://api.qlinexa360.com/health`
- Frontend: `https://www.qlinexa360.com` - login y flujo basico
