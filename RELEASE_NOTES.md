# Notas de versión - Qlinexa360

## Versión para PROD - Febrero 2026

**Build generado:** Frontend y Backend compilados y listos para despliegue.

### Artefactos de build
- **Frontend:** `frontend/dist/` — Desplegar en S3/CloudFront o hosting estático
- **Backend:** `backend/dist/` — Ejecutar con `node dist/server.js` (o equivalente en tu entorno)

---

## Resumen de correcciones para nueva versión

Este documento consolida todas las correcciones aplicadas para el despliegue de frontend y backend en producción.

---

## 1. Correcciones de API (403 Access Denied en producción)

**Problema:** En producción, las peticiones `fetch('/api/...')` y URLs relativas iban a CloudFront/S3 en lugar del API, causando error 403 Access Denied.

**Solución:** Usar `getApiUrl()` para construir la URL completa del API (api.qlinexa360.com).

### Archivos modificados - Frontend:
- `Prescriptions.jsx` - Todas las peticiones fetch de recetas, pacientes, consultas
- `Profile.jsx` - Subida de foto de perfil
- `DoctorProfileConfig.jsx` - Configuración de perfil para recetas
- `OptimizedCalendarConfig.jsx` - Configuración de calendario
- `CalendarSyncManager.jsx` - OAuth de calendario
- Otros componentes con fetch relativo

**Nota:** `axios` ya usa `baseURL` desde `axiosConfig.js` cuando existe `VITE_API_URL`. Los componentes que usan `fetch` deben usar `getApiUrl()`.

---

## 2. Foto de perfil - Todos los roles

**Problema:** Error 403 al guardar foto de perfil. ADMIN no tenía acceso.

**Cambios:**
- **Frontend:** `Profile.jsx` - fetch con `getApiUrl('/api/auth/profile-picture')`
- **Backend:** 
  - `auth.routes.ts` - Añadido rol ADMIN al endpoint profile-picture
  - `auth.controller.ts` - Soporte para ADMIN en updateProfilePicture, buildAuthResponse, getCurrentUser
  - Categoría S3 para ADMIN: `admin-profile-photos`

**Roles soportados:** DOCTOR, PATIENT, ASISTENTE, ADMIN

---

## 3. Plataforma inclusiva - Eliminación de "Doctor" y "Dr."

**Problema:** Términos "DOCTOR" y "Dr." hardcodeados. La plataforma es para profesionales de la salud (doctores, enfermeras, etc.). El usuario no escribe estos títulos; no deben mostrarse por defecto.

**Cambios - Frontend (corrección reforzada):**
- **Header:** Rol DOCTOR muestra "Profesional | Nombre" (nunca "DOCTOR |")
- **Dashboard:** "Bienvenido, X" — se elimina automáticamente cualquier prefijo "Dr." o "Dra." del nombre
- **Etiquetas:** "Doctor" → "Profesional", "Fotos Doctor" → "Fotos del profesional"
- **UserType:** "Soy profesional de la salud" (ya aplicado)
- **RegisterPatient:** "Vincular profesional" (ya aplicado)

---

## 4. Videos tutoriales - Ayuda y tutoriales

**Problema:** Video no se reproducía; no visible para doctores ni en Benefits.

**Cambios - Backend:**
- `getPublicSalesVideos` - Ahora devuelve secciones `general` y `sales` (antes solo sales)
- `getS3SignedUrl` - Parámetro opcional `expiresInSeconds`; videos usan 1 hora (antes 5 min)
- `tutorialVideo.controller.ts` - URLs firmadas de video con validez de 1 hora

**Cambios - Frontend:**
- `Benefits.jsx` - Tipo MIME dinámico según extensión del video (mp4, webm, ogg, mov, avi)
- `Benefits.jsx` - Opción "Todos" y sección "General" para invitados
- `Benefits.jsx` - Atributo `playsInline` para móviles

---

## 5. Plantillas de formulario por especialidad

### Despliegue de plantillas

Las plantillas se cargan en consultas y cada campo se guarda en `MedicalRecord.formData` (JSON). Para que estén disponibles:

```bash
# En el backend, después de migraciones:
npm run db:seed:forms
```

**Plantillas incluidas:**
- Datos médicos generales (peso, talla, presión arterial, etc.)
- Esquema de vacunación
- Especialidades: Alergología, Anestesiología, Cardiología, Cirugía, Dermatología, Endocrinología, Gastroenterología, Geriatría, Ginecología, Neurología, Oftalmología, Ortopedia, Pediatría, Psiquiatría, Enfermería
- Laboratorio: Orina, Biometría, Química sanguínea, HbA1c, Perfil tiroideo, Perfil lipídico, Función renal/hepática, Coagulación, Perfil de anemias

### Estructura para consultas y gráficas

| Componente | Ubicación BD | Uso |
|------------|--------------|-----|
| FormTemplate | `form_templates` | Define plantillas por especialidad |
| TemplateField | `template_fields` | Define campos (label, fieldType, fieldKey) |
| formData | `medical_records.form_data` (JSON) | Valores capturados: `{ [fieldId]: value }` |

**Consultas SQL ejemplo:**
```sql
-- Valores de un campo específico
SELECT id, "formData"->>'<fieldId>' as valor 
FROM medical_records 
WHERE "formData"->>'<fieldId>' IS NOT NULL;

-- Con fieldKey (tras migración):
SELECT mr.id, mr."formData"->>tf.id as valor
FROM medical_records mr, template_fields tf
WHERE tf."fieldKey" = 'presion_arterial_sistolica'
  AND mr."formData"->>tf.id IS NOT NULL;
```

**Gráficas (PatientHealthCharts):** Extrae valores numéricos de formData usando el mapeo fieldId→label de las plantillas. Campos como Peso, Talla, Presión arterial, Glucosa, etc. son graficables automáticamente.

---

## 6. Correcciones adicionales (quejas, menú móvil, dashboard admin)

### a) Quejas y sugerencias - Abierto a todos los roles

**Problema:** Al enviar feedback (quejas o sugerencias) aparecía "No tienes permiso para acceder a este recurso" (403) para algunos roles.

**Solución:** Usar `authenticateToken` en lugar de `authMiddleware` con roles específicos. Cualquier usuario autenticado puede enviar quejas y sugerencias. El correo se envía a admin@qlinexa360.com.

**Archivo:** `backend/src/routes/feedback.routes.ts`

---

### b) Menú hamburguesa en móvil horizontal - Scroll

**Problema:** En orientación horizontal (landscape) del teléfono, el menú lateral no se veía completo y no permitía desplazarse hacia abajo para ver "Ayuda y tutoriales" u otras opciones.

**Solución:** Habilitar scroll vertical en el sidebar con `overflow-y-auto` y estructura flex para que el contenido del menú sea desplazable.

**Archivo:** `frontend/src/components/layout/Sidebar.jsx` - Contenedor con `overflow-hidden`, nav con `overflow-y-auto min-h-0 flex-1`

---

### c) Error "al cargar estadísticas del dashboard" para ADMIN

**Problema:** Los administradores veían el mensaje "Error al cargar estadísticas del dashboard" porque el endpoint `/api/doctors/dashboard-stats` solo permite rol DOCTOR y requiere un perfil de doctor (que ADMIN no tiene).

**Solución:** No mostrar el componente `DoctorDashboardStats` cuando el usuario es ADMIN. El panel de administración no necesita estadísticas por doctor.

**Archivo:** `frontend/src/pages/Dashboard.jsx` - Condición cambiada de `(DOCTOR || ADMIN)` a solo `DOCTOR`

---

## 7. Checklist de despliegue

### Backend
- [ ] Ejecutar migraciones: `npm run db:migrate`
- [ ] Ejecutar seed de plantillas: `npm run db:seed:forms`
- [ ] Verificar variables de entorno: `VITE_API_URL` (en frontend), `DATABASE_URL`, `AWS_*`
- [ ] Desplegar y reiniciar servicio

### Frontend
- [ ] Configurar `VITE_API_URL=https://api.qlinexa360.com` (o tu dominio API) en build
- [ ] Build: `npm run build`
- [ ] Desplegar a S3/CloudFront o hosting

### Verificaciones post-despliegue
- [ ] Login y foto de perfil (todos los roles)
- [ ] Recetas: búsqueda de pacientes y creación
- [ ] Ayuda y tutoriales: videos visibles y reproducibles
- [ ] Historial clínico: formularios por especialidad cargados
- [ ] Dashboards: gráficas de evolución con datos de formData
- [ ] Quejas y sugerencias: ADMIN puede enviar feedback
- [ ] Menú hamburguesa en móvil horizontal: scroll funcional
- [ ] Dashboard ADMIN: sin error de estadísticas

---

## Archivos modificados (resumen)

### Frontend
- `src/pages/Dashboard.jsx` (estadísticas solo para DOCTOR, sin error para ADMIN)
- `src/components/layout/Sidebar.jsx` (scroll en menú móvil horizontal)
- `src/pages/Prescriptions.jsx`
- `src/pages/Profile.jsx`
- `src/pages/Benefits.jsx`
- `src/components/layout/Header.jsx`
- `src/components/medical/DoctorProfileConfig.jsx`
- `src/components/medical/OptimizedCalendarConfig.jsx`
- `src/components/Calendar/CalendarSyncManager.jsx`
- `src/pages/MedicalRecords.jsx`
- `src/pages/ActivateInvitation.jsx`
- `src/pages/ActivateAssistantInvitation.jsx`
- `src/pages/Prescriptions.jsx`
- `src/pages/RegisterPatient.jsx`
- `src/pages/auth/UserType.jsx`
- `src/components/assistant/DoctorSelector.jsx`
- `src/components/assistant/ModuleDoctorSelector.jsx`
- `src/components/medical/ConsultationAttachmentsForm.jsx`
- `src/components/medical/NewConsultationModal.jsx`
- `src/components/medical/FileUploadWithCategories.jsx`
- `src/components/medical/FileHistoryViewer.jsx`
- `src/components/appointments/CancellationManager.jsx`
- `src/pages/PreConsultation.jsx`
- `src/pages/CalendarReminderConfig.jsx`
- `src/components/medical/CollaborativeConsultations.jsx`

### Backend
- `src/routes/feedback.routes.ts` (ADMIN en feedback)
- `src/routes/auth.routes.ts`
- `src/controllers/auth.controller.ts`
- `src/controllers/tutorialVideo.controller.ts`
- `src/utils/file.utils.ts`
