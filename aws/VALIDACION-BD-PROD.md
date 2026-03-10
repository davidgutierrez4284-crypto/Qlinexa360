# Validación de datos en BD de producción

## Cómo verificar usuarios y códigos promocionales

### Paso 1: Obtener DATABASE_URL

La URL de la base de datos de producción está en **AWS Secrets Manager**.

**Opción A – AWS CLI:**
```powershell
aws secretsmanager get-secret-value --secret-id qlinexa360-prod-database-url --region us-east-2 --query SecretString --output text
```

**Opción B – Consola AWS:**
1. Secrets Manager → us-east-2
2. Secret `qlinexa360-prod-database-url`
3. "Retrieve secret value" y copia el valor

---

### Paso 2: Ejecutar el script de validación

En la carpeta `backend`:

```powershell
# PowerShell: define la variable y ejecuta
$env:DATABASE_URL = "postgresql://usuario:contraseña@host:5432/nombre_db"
npm run validate:prod
```

O con la URL en una sola línea:

```powershell
$env:DATABASE_URL="postgresql://xxx:yyy@host.rds.amazonaws.com:5432/qlinexa360"; npm run validate:prod
```

---

### Qué muestra el script

- **a) Usuarios:** Total y los últimos 10 (email, rol, nombre, fecha).
- **b) Códigos promocionales:** Total y listado (código, tipo, activo, usados).

---

## Alternativa: Prisma Studio (interfaz gráfica)

Para explorar la BD de forma visual:

```powershell
$env:DATABASE_URL="postgresql://xxx:yyy@host:5432/qlinexa360"
npx prisma studio
```

Se abrirá en `http://localhost:5555`. Puedes ver las tablas `User` y `PromoCode`.

---

## Importante

- No compartas `DATABASE_URL` por medios inseguros.
- No la guardes en archivos versionados.
- Usa esta validación solo desde tu equipo o entorno de confianza.
