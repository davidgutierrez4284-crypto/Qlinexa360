# Despliegue Backend y Base de Datos a PROD

## Regla de oro (OBLIGATORIA — todos los deploys PROD)

**PROD contiene usuarios reales, pacientes y datos clínicos. Nunca se borran ni se reinician.**

| Permitido | Prohibido (nunca en PROD) |
|-----------|---------------------------|
| `npx prisma migrate deploy` | `prisma migrate reset` |
| Despliegue ECS rolling (`force-new-deployment`) | `prisma db push --force-reset` |
| Seed **solo catálogo** Smart Lab (upsert, ver abajo) | `npm run db:seed` completo |
| Build + push ECR + S3 sync **sin** `--delete` | `npm run db:seed:forms` / endpoint `seed-form-templates` |
| | `npm run seed:referral-demo`, `seed-test-users.js`, `migrate:dev-to-prod` sin revisión |

### Comandos seguros (copiar/pegar)

**Despliegue completo recomendado** (migraciones vía arranque ECS, sin seeds):

```powershell
cd e:\proyectos\medilink360
.\scripts\deploy-prod.ps1 -Force
```

**Migraciones manuales** (solo si tu PC alcanza RDS por VPN/bastión):

```powershell
cd e:\proyectos\medilink360\backend
$env:DATABASE_URL = (aws secretsmanager get-secret-value --secret-id qlinexa360-prod-database-url --region us-east-2 --query SecretString --output text)
npx prisma migrate deploy
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

**Catálogo Smart Lab en PROD** (upsert de analitos; no toca usuarios ni formularios):

```powershell
cd e:\proyectos\medilink360\backend
$env:DATABASE_URL = (aws secretsmanager get-secret-value --secret-id qlinexa360-prod-database-url --region us-east-2 --query SecretString --output text)
npx ts-node -e "const { PrismaClient } = require('@prisma/client'); const { seedLabAnalyteCatalog } = require('./prisma/seeds/labAnalyteCatalog.seed'); const p = new PrismaClient(); seedLabAnalyteCatalog(p).finally(() => p.$disconnect());"
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

**Verificación post-deploy:**

```powershell
Invoke-RestMethod -Uri "https://api.qlinexa360.com/health"
```

### Pre-vuelo obligatorio antes de Smart Lab

1. Revisar que **no existan migraciones duplicadas** en `backend/prisma/migrations` (ver auditoría Smart Lab más abajo).
2. `npm run build` en backend y frontend sin errores.
3. Tests Smart Lab: `npm test -- --testPathPattern=smartLab` (opcional pero recomendado).
4. **No** ejecutar seeds destructivos documentados en la sección de auditoría.

---

## Auditoría Smart Lab — migraciones (solo incrementales)

| Migración | Operaciones | ¿Segura en PROD? |
|-----------|-------------|------------------|
| `20260708120000_add_smart_lab` | `CREATE TYPE` (5 enums), `CREATE TABLE` (LabReport, LabResult, LabAnalyteCatalog, LabAlert, LabHealthDashboardScore, LabAuditLog), índices, `ALTER TABLE … ADD CONSTRAINT` (FK a Patient/Doctor/users) | ✅ Aditiva — tablas nuevas, sin DROP/TRUNCATE |
| `20260708200000_add_smart_lab` | **Duplicado** del anterior (mismos CREATE TYPE/TABLE) | ⚠️ **BLOQUEANTE** — fallará si la anterior ya se aplicó. Eliminar o vaciar esta carpeta antes del deploy |
| `20260709160000_smart_lab_pipeline` | `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` | ✅ Aditiva e idempotente |

**Resumen SQL por migración:**

- **20260708120000**: enums `LabReportStatus`, `LabAbnormalFlag`, `LabAlertType`, `LabSeverity`, `LabAuditAction` + 6 tablas nuevas + FKs con `ON DELETE RESTRICT`/`SET NULL` (no borra filas existentes).
- **20260708200000**: repetición del mismo esquema — **no ejecutar en PROD** hasta resolver duplicado.
- **20260709160000**: columnas `classifiedVendor`, `parserUsed`, `extractionTraceJson` en LabReport; `validationErrorsJson` en LabResult; `loincCode`, `allowedUnitsJson` en LabAnalyteCatalog.

### Auditoría Smart Lab — seed

| Script | Comportamiento | ¿Usar en PROD? |
|--------|----------------|----------------|
| `prisma/seeds/labAnalyteCatalog.seed.ts` | Upsert por `(category, name)`: update si existe, create si no | ✅ **Sí** — comando seguro arriba |
| `prisma/seed.ts` | Sin deletes; crea usuarios de prueba solo si no existen; plantillas create-if-not-exists | ⚠️ Evitar — puede crear `doctor@test.com` |
| `scripts/seed-form-templates-only.js` | `deleteMany` en FormTemplate y TemplateField | ❌ **No** — borra plantillas de especialidad |
| `scripts/seed-test-users.js`, `seed-referral-history-demo.js`, `seed-affiliate-*.ts` | Borran usuarios/datos de demo | ❌ **No** — solo DEV |

`DoctorFormTemplate` (formularios personalizados por doctor) **no se toca** en ningún seed de Smart Lab.

---

## Orden de ejecución

1. Corregir credenciales de BD (si hay error de autenticación)
2. Desplegar backend a ECR
3. Actualizar servicio ECS
4. Verificar

---

## Paso 1: Credenciales de la base de datos

Si login/registro fallan con "Authentication failed", las credenciales en Secrets Manager no coinciden con RDS.

### 1.1 Cambiar contraseña maestra en RDS

1. **AWS Console** → **RDS** → **Databases** → `qlinexa360-prod-db`
2. **Modify**
3. **Settings** → **Master password** → **Self managed**
4. Define una contraseña **nueva y sencilla** (solo letras y números, sin `#`, `@`, espacios)
5. **Continue** → **Modify DB instance**
6. Espera a que el estado sea **Available** (varios minutos)

### 1.2 Actualizar el secreto en Secrets Manager

1. **Secrets Manager** → región **us-east-2**
2. Secret `qlinexa360-prod-database-url` → **Edit**
3. **Plaintext** — pega esta URL sustituyendo `TU_NUEVA_CONTRASEÑA`:

```
postgresql://postgres:TU_NUEVA_CONTRASEÑA@qlinexa360-prod-db.cpas024yc0fz.us-east-2.rds.amazonaws.com:5432/medilink360?schema=public
```

4. **Save**

---

## Paso 2: Desplegar Backend a ECR

```powershell
cd c:\Users\david\Projects\medilink360
.\scripts\deploy-backend-ecr.ps1
```

Tarda varios minutos (build de Docker + push).

---

## Paso 3: Actualizar servicio ECS

```powershell
aws ecs update-service --cluster qlinexa360-prod-cluster --service qlinexa360-prod-backend --force-new-deployment --region us-east-2
```

---

## Paso 4: Esperar y verificar

Espera **3–5 minutos**.

### Verificar API

```powershell
Invoke-RestMethod -Uri "https://api.qlinexa360.com/health"
```

Debe responder `status: OK`.

### Verificar BD (opcional)

```powershell
Invoke-RestMethod -Uri "https://api.qlinexa360.com/api/admin/db-stats"
```

### Verificar login

- https://qlinexa360.com/login

---

## Migraciones de la BD

Si la BD de producción está vacía o desactualizada, ejecuta migraciones.  
**Requisito:** tu máquina debe poder alcanzar RDS (VPN, bastion o RDS público).

```powershell
cd c:\Users\david\Projects\medilink360\backend
$env:DATABASE_URL = (aws secretsmanager get-secret-value --secret-id qlinexa360-prod-database-url --region us-east-2 --query SecretString --output text)
npx prisma migrate deploy
```

Si RDS está en subred privada, ejecuta las migraciones desde un contenedor ECS o una instancia dentro de la VPC.

---

## Migrar usuarios y códigos promocionales (DEV → PROD)

**Requisito:** Tu máquina debe poder alcanzar RDS PROD (VPN, bastion o RDS público).

```powershell
cd c:\Users\david\Projects\medilink360\backend

# DEV: tu base local o de desarrollo
$env:DATABASE_URL_DEV = "postgresql://postgres:xxx@localhost:5432/medilink360"

# PROD: desde Secrets Manager
$env:DATABASE_URL_PROD = (aws secretsmanager get-secret-value --secret-id qlinexa360-prod-database-url --region us-east-2 --query SecretString --output text)

npm run migrate:dev-to-prod
```

El script migra:
- Usuarios: `test.doctor1@medilink360.com`, `admin@qlinexa360.com`
- Todos los códigos promocionales

Edita `scripts/migrate-dev-to-prod.ts` para añadir más usuarios.

---

## Cargar plantillas de formularios especiales (Nueva Consulta)

> ⚠️ **DESTRUCTIVO:** `npm run db:seed:forms` y el endpoint `seed-form-templates` **eliminan todas** las `FormTemplate` y `TemplateField` existentes antes de recrearlas. **No ejecutar en PROD** si ya hay plantillas configuradas, salvo ventana acordada con backup. No afecta `DoctorFormTemplate`.

Si en "Nueva Consulta" → "Formulario por Especialidad" aparece "No hay plantillas disponibles", hay que ejecutar el seed en la BD de producción.

### Opción recomendada: desde el contenedor ECS (sin acceso a RDS)

El backend tiene un endpoint que ejecuta el seed desde dentro del contenedor (que ya tiene acceso a la BD):

1. **Despliega el backend** (para que el endpoint esté disponible):
   ```powershell
   .\scripts\deploy-backend-ecr.ps1
   aws ecs update-service --cluster qlinexa360-prod-cluster --service qlinexa360-prod-backend --force-new-deployment --region us-east-2
   ```

2. **Llama al endpoint** (usa el mismo token que seed-prod o reportes admin):
   ```powershell
   $token = "TU_TOKEN"  # ADMIN_REPORT_TOKEN o SEED_TOKEN de Secrets Manager
   Invoke-RestMethod -Uri "https://api.qlinexa360.com/api/admin/reports/seed-form-templates" `
     -Method Post `
     -Headers @{ "X-Admin-Report-Token" = $token }
   ```

3. Refresca la página de Nueva Consulta.

### Opción alternativa: desde tu máquina (requiere acceso a RDS)

Solo si tu máquina puede alcanzar RDS (VPN, bastion o RDS público):

```powershell
cd c:\Users\david\Projects\medilink360
.\scripts\seed-form-templates-prod.ps1
```

---

**Nota:** Si hace unas horas ejecutaste `npm run db:seed:forms` y viste éxito, probablemente se ejecutó contra tu base de datos **local** (`.env` → localhost). La BD de producción es distinta y requiere este seed.
