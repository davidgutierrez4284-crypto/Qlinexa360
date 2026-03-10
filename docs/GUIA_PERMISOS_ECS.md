# Guía: Revisar permisos ECS para evitar error 500

> **Para PDFs de recetas:** Ver también [GUIA_PERMISOS_AWS_PDF_RECETAS.md](./GUIA_PERMISOS_AWS_PDF_RECETAS.md) — checklist específico antes de generar versión.

## Contexto

El backend en ECS usa el **Task Role** (`qlinexa360-ecs-task-role`) para acceder a S3 (PDFs de recetas, fotos de perfil, archivos de consultas). Si faltan permisos, aparecen errores 500.

---

## Paso 1: Abrir la definición de tarea

1. En la consola ECS, haz clic en **`qlinexa360-prod-backend`** (la definición de tarea).
2. Verás la última revisión activa. Haz clic en el **número de revisión** (ej: `qlinexa360-prod-backend:42`) para ver los detalles.

---

## Paso 2: Verificar el Task Role

1. En la pestaña **JSON** o en la vista de detalles, busca:
   - **Task role (Rol de la tarea):** `qlinexa360-ecs-task-role`
   - **Execution role (Rol de ejecución):** `qlinexa360-ecs-task-execution`

2. El **Task role** es el que usa la aplicación para S3. El Execution role es para arrancar el contenedor (ECR, logs, secrets).

---

## Paso 3: Revisar la política S3 del Task Role

1. Ve a **IAM** en la consola de AWS (busca "IAM" en la barra superior).
2. En el menú izquierdo: **Roles**.
3. Busca y haz clic en **`qlinexa360-ecs-task-role`**.
4. En la pestaña **Permisos**, revisa las políticas adjuntas.

### Permisos S3 necesarios

La política que da acceso a S3 debe incluir estas acciones:

| Acción        | Uso                                      |
|---------------|------------------------------------------|
| `s3:GetObject`  | Leer PDFs, fotos, archivos               |
| `s3:PutObject`  | Subir archivos y PDFs                    |
| `s3:DeleteObject`| Eliminar archivos                        |
| *(s3:GetObject cubre HeadObject)* | Metadatos y lectura de objetos |
| `s3:ListBucket`  | Listar objetos (opcional)               |

### Recursos

- Bucket: `arn:aws:s3:::qlinexa360`
- Objetos: `arn:aws:s3:::qlinexa360/*`

---

## Paso 4: Añadir o actualizar la política S3

### Opción A: Política inline

1. En el rol `qlinexa360-ecs-task-role`, haz clic en **Add permissions** → **Create inline policy**.
2. Pestaña **JSON** y pega:

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
        "s3:HeadObject",
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

3. **Review policy** → Nombre: `qlinexa360-task-s3` → **Create policy**.

### Opción B: Política gestionada existente

1. Si ya existe una política tipo `qlinexa360-task-s3`, edítala.
2. Añade `s3:HeadObject` a la lista de acciones si no está.

---

## Paso 5: Comprobar que el Task Role está asignado

1. Vuelve a ECS → **Task Definitions** → `qlinexa360-prod-backend`.
2. Abre la revisión activa.
3. Confirma que **Task role** = `qlinexa360-ecs-task-role`.

---

## Paso 6: Reiniciar el servicio (si cambiaste permisos)

1. ECS → **Clusters** → `qlinexa360-prod-cluster`.
2. **Services** → `qlinexa360-prod-backend`.
3. **Update** → **Force new deployment** → **Update**.

---

## Resumen rápido

| Qué revisar              | Dónde                         | Valor esperado                    |
|--------------------------|-------------------------------|-----------------------------------|
| Task role en task def    | ECS → Task definition         | `qlinexa360-ecs-task-role`       |
| Política S3 del rol      | IAM → Roles → qlinexa360-ecs-task-role | Incluye `s3:HeadObject` |
| Bucket                   | Variables de entorno del task  | `qlinexa360`                      |

---

## Archivo de política en el proyecto

La política actualizada está en: `aws/ecs-task-s3-policy.json`
