# Guía: CloudFront + DNS en Squarespace

## Parte 1: CloudFront con OAC para el frontend

### Paso 1.1: Crear la distribución CloudFront

1. En **AWS Console** → **CloudFront** → **Create distribution**.

2. **Origin settings**:
   - **Origin domain**: selecciona el bucket S3 `qlinexa360.s3.us-east-2.amazonaws.com` (o la región que uses).
   - **Origin access**: elige **Origin access control (recommended)**.
   - Haz clic en **Create control setting** si se muestra.
   - Deja **Name** por defecto.

3. **Default cache behavior**:
   - **Viewer protocol policy**: Redirect HTTP to HTTPS.
   - **Allowed HTTP methods**: GET, HEAD, OPTIONS.
   - **Cache policy**: CachingOptimized (o SimpleCaching).

4. **Settings**:
   - **Alternate domain names (CNAMEs)**: `www.qlinexa360.com` (y opcionalmente `qlinexa360.com` si quieres la raíz).
   - **Custom SSL certificate**: solicita o selecciona un certificado ACM para `*.qlinexa360.com` en **us-east-1** (CloudFront solo usa us-east-1 para certificados).

5. Crea la distribución. Anota el **Distribution ID** (ej: `E1234ABCD5678`).

### Paso 1.2: Actualizar la política del bucket S3 (OAC)

Tras crear la distribución, CloudFront te indicará que debes actualizar el bucket policy.

1. En CloudFront, en tu distribución, abre **Origins** → selecciona el origen S3.
2. Copia la **policy** que muestra CloudFront.
3. Ve a **S3** → bucket `qlinexa360` → **Permissions** → **Bucket policy**.
4. Pega la policy (o reemplaza si ya existía). Será algo como:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontServicePrincipal",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::qlinexa360/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::268675503474:distribution/TU_DISTRIBUTION_ID"
                }
            }
        }
    ]
}
```

Reemplaza `TU_DISTRIBUTION_ID` por el ID real de tu distribución.

### Paso 1.3: Configurar el script de deploy

En `scripts/deploy-frontend-s3.ps1`, edita la línea:

```powershell
$CLOUDFRONT_DIST_ID = "E1234ABCD5678"  # Reemplaza con tu Distribution ID real
```

Con esto, cada vez que hagas deploy, se invalidará la caché de CloudFront.

---

## Parte 2: DNS en Squarespace

### Opción A: Solo `www.qlinexa360.com` (CloudFront)

1. En **Squarespace** → **Settings** → **Domains** → tu dominio `qlinexa360.com`.
2. Entra en **DNS Settings** o **Advanced Settings**.
3. Añade o edita un registro:
   - **Tipo**: CNAME.
   - **Host**: `www`.
   - **Data / Apunta a**: dominio de CloudFront, ej. `d1234abcd5678.cloudfront.net`.

### Opción B: Raíz `qlinexa360.com` y `www`

- Squarespace suele permitir CNAME en `www` y redirección de la raíz a `www`.
- Para la raíz (`qlinexa360.com`), Squarespace puede usar ALIAS/ANAME según el proveedor; en Squarespace suele configurarse desde su propio panel.
- Si Squarespace solo acepta CNAME en `www`, basta con apuntar `www` a CloudFront. La raíz puede redirigir a `www` desde Squarespace.

### Valores concretos

| Tipo   | Host | Apunta a                    |
|--------|------|-----------------------------|
| CNAME  | `www`| `dXXXXXXXX.cloudfront.net` |

El dominio CloudFront lo ves en la consola de CloudFront → tu distribución → **Domain name**.

---

## Resumen de comprobaciones

1. CloudFront creado con OAC, origen = bucket S3.
2. Bucket policy del bucket `qlinexa360` actualizada según el mensaje de CloudFront.
3. Certificado ACM en us-east-1 para `*.qlinexa360.com` o `qlinexa360.com`.
4. `$CLOUDFRONT_DIST_ID` definido en `deploy-frontend-s3.ps1`.
5. CNAME en Squarespace: `www` → `xxxxx.cloudfront.net`.

---

## Parte 3: DNS para `api.qlinexa360.com` (API / Backend)

La API corre en ECS detrás de un Application Load Balancer (ALB). Para que `api.qlinexa360.com` funcione, debes añadir un registro CNAME.

### Paso 3.1: Obtener el DNS del ALB

En AWS Console:
1. **EC2** → **Load Balancers**.
2. Busca el ALB asociado a `qlinexa360` (ej. `qlinexa360-prod-alb`).
3. Copia el **DNS name** (ej. `qlinexa360-prod-alb-1234567890.us-east-2.elb.amazonaws.com`).

O con AWS CLI:
```powershell
aws elbv2 describe-load-balancers --region us-east-2 --query "LoadBalancers[?contains(LoadBalancerName,'qlinexa')].DNSName" --output text
```

### Paso 3.2: Añadir CNAME en Squarespace

1. **Squarespace** → **Settings** → **Domains** → `qlinexa360.com`.
2. **DNS Settings** (o **Advanced Settings**).
3. **Add record**:
   - **Tipo**: CNAME.
   - **Host**: `api` (Squarespace puede mostrar solo `api`; si pide el subdominio, no incluyas `.qlinexa360.com`).
   - **Data / Apunta a**: el DNS del ALB del paso 3.1.

| Tipo  | Host | Apunta a                                      |
|-------|------|-----------------------------------------------|
| CNAME | `api`| `qlinexa360-prod-alb-xxx.us-east-2.elb.amazonaws.com` |

### Paso 3.3: Certificado SSL para api

El ALB necesita un certificado ACM para HTTPS. En **us-east-2** (donde está el ALB):

1. **ACM** → **Request certificate**.
2. Dominio: `api.qlinexa360.com` (o `*.qlinexa360.com`).
3. Validación por DNS (CNAME en Squarespace).
4. Asocia el certificado al **Listener HTTPS (443)** del ALB.

### Comprobar después de aplicar DNS

- La propagación DNS puede tardar unos minutos.
- Verifica con: `nslookup api.qlinexa360.com` o [dnschecker.org](https://dnschecker.org).
