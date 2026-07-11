# Guia de despliegue PROD

## Completado

- **Backend**: Dockerfile, .dockerignore, health endpoint `/health`
- **ECR**: Imagen `qlinexa360-backend:prod` en ECR
- **ECS**: Task definition registrada (rev 2+), service actualizada en `qlinexa360-prod-cluster`
- **Frontend**: Build con `VITE_API_URL=https://api.qlinexa360.com`, deploy a S3 `qlinexa360`

## Scripts de deploy

**Orquestación recomendada (un solo script desde la raíz del repo):**

```powershell
cd e:\proyectos\medilink360
.\scripts\deploy-prod.ps1
# Sin confirmación interactiva (CI / ya revisado):
.\scripts\deploy-prod.ps1 -Force
# Solo si tu PC alcanza RDS por VPN/bastión (opcional; si no, ECS aplica migraciones al arrancar):
.\scripts\deploy-prod.ps1 -RunPrismaMigrateLocal
# Parciales:
.\scripts\deploy-prod.ps1 -SkipFrontend -Force
```

**Seguridad PROD:** el script **no** ejecuta seeds ni borra datos. Solo `prisma migrate deploy` (incremental) vía contenedor ECS al iniciar, o con `-RunPrismaMigrateLocal` si hay túnel a RDS. S3 sync **sin** `--delete`.

Alias retrocompatible: `.\scripts\deploy-prod-from-cursor.ps1` (misma lógica).

**Por pasos (equivalente):**

```powershell
# 1. Backend: Build + push a ECR
.\scripts\deploy-backend-ecr.ps1

# 2. ECS: Registrar task def + actualizar service (ajusta variables si es primera vez)
.\scripts\deploy-ecs-service.ps1

# 3. Frontend: Build + sync a S3
.\scripts\deploy-frontend-s3.ps1
```

---

## Pase a PROD (noche / ventana corta)

Objetivo: desplegar con **mínimo impacto** a usuarios y **sin datos de seed** en PROD.

### Antes de empezar (pre-vuelo)

- [ ] `git pull` en la rama que vais a desplegar; revisión rápida de cambios.
- [ ] **AWS CLI** funciona: `aws sts get-caller-identity` (cuenta correcta).
- [ ] **Docker** en ejecución.
- [ ] `frontend/.env.production` completo y guardado (build de Vite lo embebe):
  - `VITE_API_URL`, `VITE_PAYPAL_CLIENT_ID`
  - `VITE_PAYPAL_PLAN_ID`, `VITE_PAYPAL_PLAN_REF`, `VITE_PAYPAL_PLAN_RESUME`
  - `VITE_PAYPAL_PLAN_ID_TRIAL_1M`, `VITE_PAYPAL_PLAN_ID_TRIAL_1M_REF`, `VITE_PAYPAL_PLAN_ID_TRIAL_1M_RESUME`
  - `VITE_PAYPAL_PLAN_ID_TRIAL_3M`, `VITE_PAYPAL_PLAN_ID_TRIAL_3M_REF`, `VITE_PAYPAL_PLAN_ID_TRIAL_3M_RESUME`
  - `VITE_ENABLE_REFERRALS=true` (si programa referidos en prod)
  - `VITE_SMART_LAB_ENABLED=true` (Laboratorio Inteligente; build-time)
  - Backend ECS (`aws/ecs-task-def.json`): `SMART_LAB_ENABLED=true` y flags relacionados
- [ ] Migraciones: revisar carpeta `backend/prisma/migrations` y nombres SQL; **no** ejecutar `db:seed`, `seed:referral-demo`, `migrate:dev-to-prod` contra PROD.

### Orden sugerido (si la BD tarda o es sensible)

1. **Ventana horaria** (poca actividad).
2. **Migraciones**: en este proyecto el contenedor de producción ejecuta `npx prisma migrate deploy` **al iniciar** (`backend/docker-entrypoint.js`) con `DATABASE_URL` desde Secrets Manager **dentro de la VPC**. Es decir: **al desplegar una imagen nueva en ECS que incluya las carpetas `prisma/migrations`**, las migraciones se aplican **sin** conectar tu PC a RDS. El flag `-RunPrismaMigrate` del script de Cursor solo sirve si tu máquina **tiene red** hasta la base (VPN/bastión); si RDS es solo privada, **omitid ese flag** y confiad en el arranque del contenedor tras el deploy del backend.
3. **Código**: imagen backend + ECS + frontend.
   ```powershell
   .\scripts\deploy-prod-from-cursor.ps1
   ```
   O con migración local previa (solo si tenéis túnel/VPN a RDS):
   ```powershell
   .\scripts\deploy-prod-from-cursor.ps1 -RunPrismaMigrate
   ```

### Si aun así quisieras `prisma migrate deploy` desde tu PC (Cursor / script)

RDS en subred **privada** no es alcanzable desde Internet; hace falta uno de estos en **AWS** (configuración típica):

| Enfoque | Idea | Complejidad |
|--------|------|----------------|
| **A) Confiar en el arranque ECS** (recomendado si ya usáis el entrypoint) | Nada más: deploy backend; la tarea nueva aplica migraciones y levanta API. | Baja |
| **B) AWS Client VPN** | Endpoint VPN en la VPC; tu PC obtiene IP dentro de la VPC y `DATABASE_URL` al host privado de RDS funciona. | Media |
| **C) Bastión + SSM** | EC2 pequeña en subred privada con acceso a RDS; desde tu PC `aws ssm start-session` + **port forwarding** al puerto 5432 de RDS; `DATABASE_URL` apuntando a `127.0.0.1:5432` vía túnel. | Media |
| **D) Tarea única ECS** | `aws ecs run-task` con la misma task definition y **override** del `command` a `["sh","-c","npx prisma migrate deploy && exit 0"]` (sin arrancar el servidor). Misma red que el servicio. | Media (scriptable) |

**Seguridad:** no abras RDS a `0.0.0.0/0`. Mantened SG de RDS limitado al SG de ECS (y bastión si existe).

### Qué **no** hacer en PROD

- No `npm run db:seed` / `db:seed:forms` / `seed:referral-demo` salvo procedimiento admin explícito acordado.
- No `migrate:dev-to-prod` en producción.

### Después del deploy

- [ ] `https://api.qlinexa360.com/health`
- [ ] Login + pantalla crítica (ej. dashboard).
- [ ] Registro o PayPal solo si probáis en caliente (Live cobra según plan).

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
