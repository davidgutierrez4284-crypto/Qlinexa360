# Configurar bucket S3 para desarrollo

Para que el entorno de desarrollo no afecte producción, usa un bucket S3 separado.

---

## Paso 1: Crear el bucket en AWS

1. Entra a **AWS Console** → **S3** → **Buckets**
2. **Create bucket**
3. Configuración:
   - **Bucket name:** `qlinexa360-dev` (debe ser único en toda AWS; si ya existe, prueba `qlinexa360-dev-tu-nombre` o `medilink360-dev`)
   - **Region:** `us-east-2` (Ohio) — misma que producción
   - **Block Public Access:** Desmarca "Block all public access" si necesitas que las fotos/PDFs sean accesibles por URL (igual que en prod). O déjalo bloqueado y usa URLs firmadas.
   - **Bucket Versioning:** Opcional (Off está bien para dev)
4. **Create bucket**

---

## Paso 2: Política de acceso (si usas URLs públicas)

Si desmarcaste "Block all public access", el bucket permitirá objetos públicos. Para que las fotos de perfil y PDFs se vean sin URLs firmadas, añade una política de bucket:

1. En el bucket → **Permissions** → **Bucket policy**
2. **Edit** y pega (reemplaza `qlinexa360-dev` si usaste otro nombre):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::qlinexa360-dev/*"
    }
  ]
}
```

3. **Save changes**

---

## Paso 3: Permisos de tu usuario IAM

Tu usuario AWS (el de `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` en `.env`) debe poder leer y escribir en el bucket.

- Si usas credenciales de **root** o un usuario con permisos amplios de S3, normalmente ya funciona.
- Si usas un usuario IAM restringido, añade una política que permita:
  - `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` en `arn:aws:s3:::qlinexa360-dev` y `arn:aws:s3:::qlinexa360-dev/*`

---

## Paso 4: Actualizar backend/.env

Edita `backend/.env` y cambia las variables de bucket:

```env
# AWS - Bucket de DESARROLLO (no usar qlinexa360 de prod)
AWS_REGION=us-east-2
AWS_BUCKET_NAME=qlinexa360-dev
AWS_S3_BUCKET_NAME=qlinexa360-dev
```

Si usaste otro nombre de bucket, pon ese nombre en ambos.

---

## Paso 5: Verificar

1. Inicia el backend: `cd backend && npm run dev`
2. Sube una foto de perfil o crea una receta con PDF
3. Revisa en S3 que el archivo aparezca en `qlinexa360-dev`, no en `qlinexa360`

---

## Resumen

| Variable | Desarrollo | Producción |
|----------|------------|------------|
| AWS_BUCKET_NAME | `qlinexa360-dev` | `qlinexa360` |
| AWS_S3_BUCKET_NAME | `qlinexa360-dev` | `qlinexa360` |
| AWS_REGION | `us-east-2` | `us-east-2` |
