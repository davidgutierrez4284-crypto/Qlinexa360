# Guía: Revisar permisos AWS para ver PDFs de recetas

Esta guía te ayuda a verificar que los permisos en AWS estén correctos para que las recetas en PDF se generen, se guarden en S3 y se puedan ver/descargar sin errores.

---

## Importante: Deploy del frontend y archivos de usuario

El bucket `qlinexa360` almacena tanto el frontend (index.html, assets/) como archivos de usuario (doctor-profile-photos, prescription_request, recipes, etc.). El script `deploy-frontend-s3.ps1` hace `aws s3 sync dist/` **sin** `--delete` para no borrar esos archivos en cada deploy. Si se usara `--delete`, cada despliegue eliminaría fotos de perfil, adjuntos de consultas y recetas.

---

## Resumen del flujo

1. **Crear receta** → El backend genera el PDF con Puppeteer/Chromium
2. **Subir a S3** → El PDF se guarda en el bucket `qlinexa360` (carpeta `recipes/`)
3. **Servir PDF** → Cuando el usuario abre el enlace, el backend obtiene el PDF de S3 y lo sirve

Si falla cualquiera de estos pasos, verás "PDF no encontrado" o error 500.

---

## Checklist antes de generar versión

### 1. Permisos S3 del Task Role

El rol **`qlinexa360-ecs-task-role`** debe tener permisos para leer y escribir en S3.

**Pasos:**

1. Ve a **AWS Console** → **IAM** → **Roles**
2. Busca y abre **`qlinexa360-ecs-task-role`**
3. En **Permisos**, verifica que exista una política con estas acciones:

| Acción | Para qué |
|--------|----------|
| `s3:GetObject` | Leer PDFs, fotos y archivos (incluye HeadObject) |
| `s3:PutObject` | Subir PDFs al crear la receta |
| `s3:DeleteObject` | Eliminar archivos (opcional) |
| `s3:ListBucket` | Listar objetos (opcional) |

**Nota:** `s3:HeadObject` no existe como acción IAM; la operación HeadObject se autoriza con `s3:GetObject`.

**Recursos permitidos:**
- `arn:aws:s3:::qlinexa360`
- `arn:aws:s3:::qlinexa360/*`

**Política de ejemplo** (si necesitas crearla o actualizarla):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::qlinexa360",
        "arn:aws:s3:::qlinexa360/*"
      ]
    }
  ]
}
```

Archivo de referencia en el proyecto: `aws/ecs-task-s3-policy.json`

---

### 2. Bucket S3 y región

**Verificar:**

1. El bucket **`qlinexa360`** existe en la región **us-east-2**
2. En la definición de tarea ECS, las variables de entorno son:
   - `AWS_S3_BUCKET_NAME` = `qlinexa360`
   - `AWS_BUCKET_NAME` = `qlinexa360`
   - `AWS_REGION` = `us-east-2`

**Dónde revisar:** ECS → Task Definitions → `qlinexa360-prod-backend` → Revisión activa → Container → Environment variables

---

### 3. Task Role asignado a la definición de tarea

1. ECS → **Task Definitions** → `qlinexa360-prod-backend`
2. Abre la revisión activa (ej: `qlinexa360-prod-backend:42`)
3. Confirma que **Task role** = `qlinexa360-ecs-task-role`

El **Execution role** (`qlinexa360-ecs-task-execution`) es para arrancar el contenedor; el **Task role** es el que usa la aplicación para S3.

---

### 4. Chromium en el contenedor (generación de PDF)

Para que Puppeteer genere PDFs en ECS, el Dockerfile debe incluir Chromium.

**Verificar en `backend/Dockerfile`:**

- Instalación del paquete `chromium` en `apt-get install`
- Variables de entorno:
  - `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
  - `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`

Si falta Chromium, la generación del PDF falla y la receta queda con `archivoPdf: 'temp_placeholder.pdf'`, lo que provoca "PDF no encontrado".

---

### 5. BASE_URL correcta

El enlace que recibe el paciente en el correo usa `BASE_URL`. Debe apuntar a tu API en producción:

- `BASE_URL` = `https://api.qlinexa360.com` (o tu dominio de API)

**Dónde revisar:** ECS Task Definition → Environment variables

---

## Comandos útiles para verificar

### Ver políticas del rol (AWS CLI)

```bash
aws iam list-attached-role-policies --role-name qlinexa360-ecs-task-role
aws iam list-role-policies --role-name qlinexa360-ecs-task-role
```

### Ver política inline (si existe)

```bash
aws iam get-role-policy --role-name qlinexa360-ecs-task-role --policy-name NOMBRE_POLITICA
```

### Probar acceso a S3 desde tu máquina (con credenciales del rol)

Si tienes credenciales temporales del rol, puedes probar:

```bash
aws s3 ls s3://qlinexa360/recipes/ --region us-east-2
aws s3 cp s3://qlinexa360/recipes/UN_ARCHIVO.pdf ./test.pdf --region us-east-2
```

---

## Después de cambiar permisos

1. **IAM:** Los cambios en políticas son efectivos de inmediato.
2. **ECS:** Las tareas en ejecución siguen usando el rol anterior hasta que se reinicien.
3. **Reiniciar servicio:**
   - ECS → Clusters → `qlinexa360-prod-cluster`
   - Services → `qlinexa360-prod-backend`
   - **Update** → **Force new deployment** → **Update**

---

## Resumen rápido

| Qué | Dónde | Valor esperado |
|-----|-------|----------------|
| Task role | ECS Task Definition | `qlinexa360-ecs-task-role` |
| Política S3 | IAM → qlinexa360-ecs-task-role | Incluye `s3:GetObject`, `s3:PutObject` |
| Bucket | Variables de entorno | `qlinexa360` |
| Región | Variables de entorno | `us-east-2` |
| BASE_URL | Variables de entorno | `https://api.qlinexa360.com` |
| Chromium | Dockerfile | Instalado + PUPPETEER_EXECUTABLE_PATH |

---

## Si sigue fallando

1. **Revisar logs de ECS:** CloudWatch → Log groups → `/ecs/qlinexa360-prod-backend`
2. **Buscar errores** como: "Error generando PDF", "Error obteniendo PDF de S3", "NoSuchKey"
3. **Recetas antiguas:** Las que tienen `archivoPdf: 'temp_placeholder.pdf'` nunca se generó el PDF. Crear una receta nueva para probar.
