# Despliegue Backend y Base de Datos a PROD

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
