# Reportes de Base de Datos PROD - Qlinexa360

Guía para obtener reportes de la base de datos de producción sin acceso directo a RDS (que está en subred privada).

---

## Opción 1: API de reportes (recomendada)

El backend expone endpoints protegidos por token. Requieren el header `X-Admin-Report-Token`.

### Configuración inicial (una vez)

1. **Crear secreto en AWS Secrets Manager:**

```powershell
aws secretsmanager create-secret `
  --name qlinexa360-prod-admin-report-token `
  --secret-string "TU_TOKEN_SEGURO_AQUI" `
  --region us-east-2
```

Genera un token seguro (ej: `openssl rand -hex 32` o usa un UUID largo). Guarda el token en un lugar seguro.

2. **Actualizar política de permisos del rol ECS:**

```powershell
aws iam put-role-policy `
  --role-name qlinexa360-ecs-task-execution `
  --policy-name qlinexa360-ecs-secrets `
  --policy-document file://aws/ecs-execution-secrets-policy.json
```

3. **Añadir secret a la definición de tarea ECS:**

En AWS Console → ECS → Task Definitions → qlinexa360-prod-backend → Create new revision:

- En **Secrets**, agregar:
  - Name: `ADMIN_REPORT_TOKEN`
  - Value: `arn:aws:secretsmanager:us-east-2:268675503474:secret:qlinexa360-prod-admin-report-token-XXXXXX`

(Obtén el ARN completo en Secrets Manager → el secreto → ARN)

4. **Actualizar el servicio ECS** para usar la nueva revisión:

```powershell
aws ecs update-service --cluster qlinexa360-prod-cluster --service qlinexa360-prod-backend --force-new-deployment --region us-east-2
```

---

### Reportes disponibles

Reemplaza `TU_TOKEN` por el valor del secreto.

#### a) Usuarios que podrían ser de desarrollo

Identifica usuarios con emails típicos de prueba (@test., @example.com, test@, etc.).

```powershell
Invoke-RestMethod -Uri "https://api.qlinexa360.com/api/admin/reports/users-dev-check" `
  -Headers @{ "X-Admin-Report-Token" = "TU_TOKEN" }
```

#### b) Códigos promocionales migrados

Lista todos los códigos promocionales con su estado.

```powershell
Invoke-RestMethod -Uri "https://api.qlinexa360.com/api/admin/reports/promo-codes" `
  -Headers @{ "X-Admin-Report-Token" = "TU_TOKEN" }
```

#### c) Reporte mensual de facturación (clientes que pagan)

Profesionales con suscripción activa: datos fiscales y correo para enviar facturas.

```powershell
# Mes actual
Invoke-RestMethod -Uri "https://api.qlinexa360.com/api/admin/reports/billing-monthly" `
  -Headers @{ "X-Admin-Report-Token" = "TU_TOKEN" }

# Mes específico (ej: febrero 2025)
Invoke-RestMethod -Uri "https://api.qlinexa360.com/api/admin/reports/billing-monthly?month=2025-02" `
  -Headers @{ "X-Admin-Report-Token" = "TU_TOKEN" }
```

**Exportar a CSV (ejemplo):**

```powershell
$r = Invoke-RestMethod -Uri "https://api.qlinexa360.com/api/admin/reports/billing-monthly?month=2025-02" `
  -Headers @{ "X-Admin-Report-Token" = "TU_TOKEN" }
$r.clients | Export-Csv -Path "facturacion-2025-02.csv" -NoTypeInformation
```

---

## Opción 2: Conexión directa a RDS (si tienes VPN)

Si RDS está accesible desde tu red (VPN, bastion, o RDS público):

```powershell
$env:DATABASE_URL = (aws secretsmanager get-secret-value --secret-id qlinexa360-prod-database-url --region us-east-2 --query SecretString --output text)
cd backend
npx ts-node scripts/validate-prod-data.ts
```

Ese script muestra usuarios y códigos promocionales. Para reportes más detallados, puedes ejecutar consultas SQL con `psql` o crear scripts similares.

---

## Opción 3: Ejecutar desde ECS (avanzado)

```powershell
aws ecs execute-command --cluster qlinexa360-prod-cluster --task <TASK_ID> --container qlinexa360-prod-backend --interactive --command "/bin/sh"
```

Dentro del contenedor podrías ejecutar scripts con `node` si tienes acceso al código. No es la opción más práctica para reportes regulares.

---

## Resumen de endpoints

| Reporte | URL | Query params |
|---------|-----|--------------|
| Usuarios de dev | `GET /api/admin/reports/users-dev-check` | - |
| Códigos promocionales | `GET /api/admin/reports/promo-codes` | - |
| Facturación mensual | `GET /api/admin/reports/billing-monthly` | `month=YYYY-MM` |

Todos requieren header: `X-Admin-Report-Token: <token>`

---

## Seed PROD: Admin + códigos promocionales

Crea el usuario admin y los códigos promocionales directamente en PROD (sin migración).

**Endpoint:** `POST /api/admin/reports/seed-prod`

**Headers:** `X-Admin-Report-Token` o `X-Seed-Token` (usa el que tengas configurado)

**Configuración:** Crea el secreto `qlinexa360-prod-admin-report-token` o `qlinexa360-prod-seed-token` en Secrets Manager y añádelo a la task definition como `ADMIN_REPORT_TOKEN` o `SEED_TOKEN`.

**Ejemplo (PowerShell):**

```powershell
$token = "TU_TOKEN"  # El que configuraste en Secrets Manager
$body = @{ adminPassword = "TuContraseñaSegura" } | ConvertTo-Json  # Opcional
Invoke-RestMethod -Uri "https://api.qlinexa360.com/api/admin/reports/seed-prod" `
  -Method Post `
  -Headers @{ "X-Admin-Report-Token" = $token; "Content-Type" = "application/json" } `
  -Body $body
```

**Crea:**
- Usuario ADMIN: `admin@qlinexa360.com` (contraseña por defecto: AdminQlinexa3602024!, o la que envíes en el body)
- 100 códigos LIFETIME (formato QLX-LIFE-XXXXXXXX)
- 100 códigos 3 meses gratis (QLX-3M-XXXXXXXX)
- 200 códigos 1 mes gratis (QLX-1M-XXXXXXXX)

---

## Seed PROD: Plantillas de formularios especiales

Crea las plantillas de "Formulario por Especialidad" (Cardiología, Dermatología, Traumatología, etc.) en la BD de producción. Ejecuta **desde el contenedor ECS** (no requiere acceso directo a RDS).

**Endpoint:** `POST /api/admin/reports/seed-form-templates`

**Headers:** `X-Admin-Report-Token` o `X-Seed-Token` (mismo que seed-prod)

**Ejemplo (PowerShell):**

```powershell
$token = "TU_TOKEN"  # ADMIN_REPORT_TOKEN o SEED_TOKEN
Invoke-RestMethod -Uri "https://api.qlinexa360.com/api/admin/reports/seed-form-templates" `
  -Method Post `
  -Headers @{ "X-Admin-Report-Token" = $token }
```

Tras ejecutarlo, refresca la página de Nueva Consulta y las plantillas aparecerán en "Formulario por Especialidad".
