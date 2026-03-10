# Resumen de correcciones para deployment

## 1. Horarios en agendamiento por link público (9:00 a.m. vs 3:00 a.m.)

- **`backend/src/utils/date.utils.ts`**
  - `createDateInTimezone`: crea fechas en la zona horaria del doctor
  - `getDatePartsInTimezone`: obtiene año, mes y día en la zona del doctor
  - `getTimezoneOffsetMinutes`: calcula el offset de la zona horaria

- **`backend/src/services/schedule.service.ts`**
  - `generateAvailableSlots` usa la zona horaria del doctor
  - `isTimeSlotAvailable` adaptado para comparar por timestamp y zona horaria

- **`backend/src/controllers/agendaPacientes.controller.ts`**
  - Slots generados en la zona del doctor
  - Formato de slots en la zona del doctor
  - `createAppointment` pasa la zona horaria correcta

- **`backend/src/controllers/appointmentConfirmation.controller.ts`**
  - `getAvailableRescheduleSlots` y `getWaitlistAvailableSlots` usan la zona del doctor

---

## 2. Formato am/pm en hora

- **`frontend/src/components/Calendar/EventDetailsModal.jsx`**
  - Fecha de inicio y fin con `hour12: true` (ej. "9:00 a.m.")

- **`backend/src/services/notification.service.ts`**
  - Emails y WhatsApp usan `formatAppointmentTimeWithAmPm` o `data.time` cuando viene formateado

- **`backend/src/controllers/agendaPacientes.controller.ts`**
  - Notificaciones de cita usan `formatAppointmentTimeWithAmPm`

---

## 3. Texto de privacidad en agendamiento directo

- **`frontend/src/components/medical/AgendaConfig.jsx`**
  - Texto añadido: *"Tu agenda siempre permanece oculta, el paciente únicamente verá horarios disponibles. La privacidad de tu agenda se mantiene."*

---

## 4. Permisos para el DOCTOR para guardar consultas

- **`backend/src/middlewares/subscription.middleware.ts`**
  - Fallback cuando no hay registro en `Subscription`: se usa `Doctor.trialEnd` y `Doctor.accessType === 'lifetime'`
  - Doctores con trial activo o acceso lifetime pueden crear consultas sin suscripción PayPal
  - Corrige el error: *"Sin permiso para crear consultas. Verifica tu suscripción."*

- **`backend/src/middlewares/subscription.middleware.ts` (blockWriteOperationsIfCancelled)**
  - Ruta `/api/auth/profile-picture` permitida aunque la suscripción esté cancelada (actualizar foto de perfil)

- **Rutas afectadas:** `consultation.routes.ts` (createBasicConsultation, addAttachmentsToConsultation, markConsultationComplete, etc.)

---

## 5. Permisos para ver recetas en PDF

- **`backend/src/routes/recipe.routes.ts`**
  - Rutas de recetas usan `authMiddleware` y `AssistantMiddleware.checkAssistantModulePermission('prescriptions')`
  - PDF view público: `/:id/pdf-view` (sin auth, usa hash+timestamp en URL)
  - PDF view autenticado: `/:id/pdf-view-url` y `/:id/pdf` para DOCTOR/ASISTENTE

- **`backend/src/controllers/recipe.controller.ts`**
  - Crear receta exige `subscription.status === 'active'` (no usa trial/lifetime como consultas)
  - Ver/descargar PDF: requiere autenticación y permiso de prescripciones

- **IAM / S3:** Las recetas en PDF se guardan en S3; la política de la tarea ECS debe incluir `s3:GetObject` para el bucket de recetas

---

## 6. Permisos para guardar archivos y fotos en consultas y visualizarlos

- **`backend/src/controllers/file.controller.ts`**
  - Cliente S3 con credenciales condicionales: solo si existen `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`; si no, usa task role en ECS
  - Uso de `HeadObjectCommand` para generar URLs firmadas

- **`backend/src/utils/file.utils.ts`**
  - `getS3SignedUrl` usa `HeadObject` para validar existencia del objeto antes de firmar

- **IAM (task role ECS):** La política `qlinexa360-task-s3` debe incluir:
  - `s3:GetObject` – lectura de archivos
  - `s3:PutObject` – subida de archivos
  - `s3:DeleteObject` – eliminación de archivos
  - `s3:HeadObject` – metadatos para URLs firmadas

---

## 7. Guardado de foto de perfil y visualización en el banner

- **`backend/src/controllers/auth.controller.ts`**
  - Endpoint `PUT /api/auth/profile-picture` para subir foto de perfil
  - Subida a S3 y actualización de `profilePictureUrl` en Doctor/Patient/User

- **`backend/src/middlewares/subscription.middleware.ts`**
  - `/api/auth/profile-picture` en `allowedPaths` de `blockWriteOperationsIfCancelled` (permite actualizar foto aunque la suscripción esté cancelada)

- **`frontend/src/components/layout/Header.jsx`**
  - Obtiene URL firmada para la foto de perfil
  - Fallback a avatar por defecto si falla la URL firmada
  - Usa `profilePictureUrl` del usuario en el banner

- **`frontend/src/pages/Profile.jsx`**
  - Subida de foto de perfil
  - Mismo fallback para visualización
  - Dispara evento `profilePictureUpdated` para actualizar el Header

- **`backend/src/controllers/file.controller.ts`**
  - Endpoint `GET /api/files/signed-url` para generar URLs firmadas de S3

---

## Archivos modificados (resumen)

| Tipo | Archivos |
|------|----------|
| `backend` | `date.utils.ts`, `schedule.service.ts`, `agendaPacientes.controller.ts`, `appointmentConfirmation.controller.ts`, `notification.service.ts`, `subscription.middleware.ts`, `file.controller.ts`, `auth.controller.ts` |
| `frontend` | `EventDetailsModal.jsx`, `AgendaConfig.jsx`, `Header.jsx`, `Profile.jsx` |

---

## Checklist pre-deployment

- [ ] **Backend:** `.\scripts\deploy-backend-ecr.ps1` y `.\scripts\deploy-ecs-service.ps1`
- [ ] **Frontend:** `.\scripts\deploy-frontend-s3.ps1`
- [ ] **IAM:** Política `qlinexa360-task-s3` con `s3:HeadObject`

---

## Verificación post-deployment

1. **Horarios:** Paciente agenda 9:00 a.m. por link → doctor y paciente ven 9:00 a.m. (no 3:00 a.m.)
2. **Consultas:** Doctor con trial/lifetime puede crear consultas sin suscripción PayPal
3. **Recetas PDF:** Doctor puede ver y descargar recetas en PDF
4. **Archivos:** Subir y ver fotos/archivos en consultas
5. **Foto de perfil:** Subir foto en Mi perfil y verla en el banner
