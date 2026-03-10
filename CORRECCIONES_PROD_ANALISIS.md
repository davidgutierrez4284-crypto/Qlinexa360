# Análisis y correcciones para producción - Qlinexa360

## Problemas reportados

1. **Historial clínico**: No se pueden guardar consultas
2. **Calendario**: No funciona como en desarrollo
3. **Recetas**: La información no se guarda bien y el PDF no se puede abrir

---

## Correcciones implementadas

### 1. PDF de recetas → almacenamiento en S3 (CRÍTICO) ✅

**Problema:** Los PDFs de recetas se guardaban en el disco local del contenedor ECS (`uploads/recipes/`). El sistema de archivos en ECS/Fargate es **efímero**: al reiniciar o escalar el contenedor, los archivos desaparecen.

**Solución implementada:**
- `uploadBufferToS3` en `file.utils.ts`: sube buffers (PDFs) directamente a S3
- `recipePdf.service.ts`: genera el PDF y lo sube a S3 cuando está configurado (producción), con fallback a disco local en desarrollo
- `recipe.controller.ts`:
  - `serveRecipePdf`: si `archivoPdf` es URL de S3, redirige a URL firmada; si no, sirve desde disco local
  - `downloadRecipePdf`: mismo manejo para S3 vs local
  - Registro en tabla File: usa URL S3 cuando aplica
- `RecetaMedica.archivoPdf` ahora almacena: URL S3 en prod, nombre de archivo en desarrollo

**Requisito:** El bucket S3 (`AWS_S3_BUCKET_NAME` / `AWS_BUCKET_NAME`) debe estar configurado en la task definition de ECS. Ya lo está en `ecs-task-def.json`.

---

## Áreas a revisar con evidencia

### 2. Guardado de consultas (Historial clínico)

**Flujo actual:**
- Frontend: `medicalService.createMedicalRecord(patientId, data)` → `POST /api/doctors/patients/:patientId/medical-records`
- Backend: `doctor.controller.createConsultation`
- Archivos: se suben primero a `/api/files/upload` (S3), luego se envían los `fileIds` en el payload

**Posibles causas en prod:**
- Falta de `clinicalCaseId` (es obligatorio)
- Archivos: el frontend debe usar `getApiUrl` o axios con `baseURL` en llamadas a `/api/files/upload` — axios ya usa `VITE_API_URL` como baseURL
- Errores de CORS o 403 que no se muestran bien en la UI
- Header `X-Selected-Doctor-Id` para asistentes

**Para diagnosticar:** Revisar en DevTools (Network) la petición que falla al guardar una consulta: código de estado, cuerpo de respuesta.

### 3. Calendario

**APIs usadas:**
- `/api/doctors/profile`, `/api/doctors/my-patients`
- `/api/calendar-sync/sync-status`, `/api/calendar-sync/auth/:provider`
- Carga de eventos desde backend (FullCalendar)

**Posibles causas:**
- URLs de OAuth de calendar-sync que apuntan a localhost en lugar de la API de producción
- `getApiUrl` en `CalendarSyncManager` para el redirect de auth — ya usa `getApiUrl`
- Falta de `selectedDoctorId` para asistentes al cargar eventos
- Timeouts o errores de red no manejados

**Para diagnosticar:** Comprobar en Network qué peticiones fallan al cargar el calendario.

---

## Pasos para desplegar la versión corregida

### Backend

```powershell
cd c:\Users\david\Projects\medilink360
.\scripts\deploy-backend-ecr.ps1
aws ecs update-service --cluster qlinexa360-prod-cluster --service qlinexa360-prod-backend --force-new-deployment --region us-east-2
```

### Frontend

```powershell
cd frontend
npm run build
# Luego subir a S3 según tu proceso de deploy
.\scripts\deploy-frontend-s3.ps1
```

### Verificaciones post-despliegue

1. **Recetas:** Crear una receta y abrir el PDF. Debe cargarse correctamente (redirect a S3).
2. **Consultas:** Intentar guardar una consulta y revisar Network si falla.
3. **Calendario:** Cargar la página y revisar Network si hay errores.

---

## Variables de entorno en ECS (recordatorio)

Deben estar configuradas en la task definition:
- `DATABASE_URL`, `JWT_SECRET`
- `AWS_S3_BUCKET_NAME` o `AWS_BUCKET_NAME`
- `AWS_REGION` (us-east-2)
- `BASE_URL` = `https://api.qlinexa360.com`
- `FRONTEND_URL` = `https://www.qlinexa360.com`

El rol IAM de la tarea ECS debe tener permisos para:
- S3: PutObject, GetObject en el bucket de recetas
- Secrets Manager (para variables sensibles)
