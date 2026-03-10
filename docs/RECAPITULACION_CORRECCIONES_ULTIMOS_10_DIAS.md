
# Recapitulación de Correcciones – Últimos 10 Días

**Proyecto:** Qlinexa360 / Medilink360  
**Período:** Febrero 2026  
**Estado:** Producción – Plataforma para profesionales de la salud y pacientes

---

## ⚠️ CONTEXTO CRÍTICO

Esta plataforma está en **producción** y es utilizada por profesionales de la salud y pacientes. Las correcciones documentadas afectan flujos que pueden impactar la atención médica. Al retomar trabajo, verificar que cada corrección esté desplegada y funcionando correctamente.

---

## 1. RECETAS MÉDICAS – LINK PDF EXPIRADO

### Problema
Al abrir el enlace del correo que recibe el paciente para ver/descargar la receta en PDF, aparecía el mensaje: **"Token de visualización expirado"**. El token tenía validez de solo 1 hora.

### Pantalla de contexto
- **Email:** "Tu receta médica - Qlinexa360" con enlace "Ver y descargar receta"
- **URL:** `https://api.qlinexa360.com/api/recipes/{id}/pdf-view?temp={hash}&t={timestamp}`
- **Error:** Pantalla en blanco con JSON: `{"success":false,"message":"Token de visualización expirado."}`

### Solución aplicada
- **Archivo:** `backend/src/controllers/recipe.controller.ts`
- **Cambio:** Validez del token ampliada de 1 hora a **7 días** (168 horas)
- **Líneas:** Verificación `now - timestamp > 60 * 60 * 1000` → `MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000`
- **Texto API:** `expiresIn: '1 hora'` → `expiresIn: '7 días'`

### Despliegue
Backend: compilar y desplegar en ECS.

---

## 2. CONFIGURACIÓN DE HORARIOS – BUFFER Y DURACIÓN NO SE GUARDABAN

### Problema
En "Configuración de Horarios" del calendario:
- **Tiempo de buffer:** Al guardar "Sin buffer" (0), al volver a entrar aparecía "15 minutos"
- **Duración de cita:** Posible mismo comportamiento con valores guardados

### Pantalla de contexto
- **Sección:** Calendario → Configuración → Configuración de Horarios
- **Campos:** "Duración de cita (minutos)", "Tiempo de buffer entre citas (minutos)"
- **Opciones buffer:** Sin buffer (0), 5, 10, 15, 30 minutos

### Solución aplicada
- **Archivo:** `frontend/src/components/medical/CalendlyStyleScheduleConfig.jsx`
- **Causa:** `data.data.bufferTime || 15` trataba `0` como falsy y lo reemplazaba por 15
- **Cambio:** Usar nullish coalescing: `data.data.bufferTime ?? 15` y `data.data.appointmentDuration ?? 30`

### Asistentes – Actualizar horarios del doctor
- **Archivo:** `backend/src/controllers/schedule.controller.ts`
- **Cambio:** `updateScheduleConfig` ahora soporta ASISTENTE usando `X-Selected-Doctor-Id`
- **Lógica:** Si rol ASISTENTE, obtener doctorId del header, verificar vínculo activo, actualizar config de ese doctor

### Despliegue
Frontend y backend.

---

## 3. TRABAJO COLABORATIVO – ARCHIVOS ADJUNTOS NO VISIBLES

### Problema
Al compartir un caso clínico con otro doctor (Trabajo colaborativo), el doctor invitado podía ver la consulta pero **no** podía abrir archivos, fotos ni vínculos adjuntos.

### Pantalla de contexto
- **Vista:** Mis Pacientes → columna "Trabajo colaborativo" muestra "Blanca Lopez" como colaboradora
- **Flujo:** Doctor Blanca Lopez entra al historial del paciente, ve la consulta, pero al hacer clic en archivos/PDFs recibe 403

### Solución aplicada
- **Archivo:** `backend/src/controllers/file.controller.ts`
- **Función nueva:** `doctorCanAccessFileAsCollaborator(userId, file)`
  - Verifica si el doctor es titular (doctorPatient), vinculado (vinculadoADoctor) o colaborador (PadecimientoDoctorColaborador)
- **Integración:** En `getFileSecure` y `getSignedUrlForS3`, si el usuario es DOCTOR y no es el subidor, se llama a `doctorCanAccessFileAsCollaborator`
- **Asistentes:** `assistantCanAccessFile` ampliado para permitir acceso cuando el doctor seleccionado es colaborador del caso

### Despliegue
Backend.

---

## 4. BOTÓN "GUARDAR CONSULTA BÁSICA"

### Problema
Texto del botón demasiado largo o poco claro.

### Pantalla de contexto
- **Modal:** "Parte 1: Información básica de la consulta" al crear consulta desde Historial clínico
- **Botón:** "Guardar Consulta Básica"

### Solución aplicada
- **Archivo:** `frontend/src/components/medical/BasicConsultationForm.jsx`
- **Cambio:** Texto del botón de "Guardar Consulta Básica" a **"Guardar Consulta"**

### Despliegue
Frontend.

---

## 5. NOTIFICACIONES Y HEADER EN MÓVIL (ROL ASISTENTE)

### Problema
- **Panel de notificaciones:** El texto se cortaba, no se podía ver completo; el panel parecía alineado a la izquierda
- **Header (cenefa superior):** Muy apretado y encimado en móvil (logo, nombre, iconos solapados)

### Pantalla de contexto
- **Notificaciones:** Panel blanco con "ficaciones" (truncado de "Notificaciones"), texto de notificación cortado
- **Header:** "vidQlinexa360" superpuesto, "Asistente | David Atlanga Atlanga Holdings" muy largo

### Solución aplicada

**NotificationInbox.jsx:**
- Panel centrado en móvil: `left-1/2 -translate-x-1/2`
- Ancho: `w-[calc(100vw-2rem)] max-w-sm`
- Contenido: `min-w-0`, `overflow-hidden`, `break-words` para evitar corte de texto

**Header.jsx:**
- Rol/nombre oculto en más breakpoints: `lg:inline` → `xl:inline`
- Menos gap y padding en móvil
- Logo más pequeño en móvil
- DoctorSelector con `max-w-[85px]` en móvil para asistentes

### Despliegue
Frontend.

---

## 6. ROL ASISTENTE – RECETAS (PENDIENTE DE VERIFICAR)

### Problemas reportados
- **a)** Error 403 al descargar PDF; error al compartir por correo ("Unexpected token '<', '<!DOCTYPE'..." – respuesta HTML en lugar de JSON)
- **b)** En Configuración de Recetas: "No tienes permiso para acceder a este recurso" al intentar actualizar colores corporativos, logo, etc.

### Pantalla de contexto
- **Recetas emitidas:** Cards con iconos de ojo, compartir, documento; error "Error al descargar PDF: 403"
- **Configuración:** Sección "Colores Corporativos", "Logo del Consultorio"; error "No tienes permiso para acceder a este recurso"

### Acciones requeridas (verificar si se implementaron)
1. **Prescriptions.jsx:** Enviar header `X-Selected-Doctor-Id` en todas las peticiones de recetas
2. **Backend recipe.controller.ts:** Aceptar ASISTENTE con permiso de recetas y usar doctorId del header
3. **Backend doctorProfile.controller.ts (recipe config):** Permitir ASISTENTE con `X-Selected-Doctor-Id` para actualizar configuración de recetas del doctor

### Despliegue
Frontend y backend.

---

## 7. ROL ASISTENTE – CALENDARIO (PENDIENTE DE VERIFICAR)

### Problemas reportados
- **a)** Agenda compartida: poder utilizar la funcionalidad
- **b)** Configuración de horarios: Error 403 al guardar
- **c)** Configuración de recordatorios: "Error al actualizar configuración"
- **d)** Confirmaciones, Lista de espera, Cancelaciones: "No tienes permiso para acceder a este recurso"

### Pantalla de contexto
- **Configuración de horarios:** Error 403 al hacer clic en "Guardar Cambios"
- **Configuración de recordatorios:** Toggle activado, checkboxes; error al guardar
- **Lista de espera:** Filtros visibles; banner rojo "No tienes permiso para acceder a este recurso"

### Acciones requeridas (verificar si se implementaron)
1. **schedule.controller.ts:** Ya soporta ASISTENTE en get y update (X-Selected-Doctor-Id)
2. **reminder.controller.ts:** Rutas `reminder-config` GET y POST deben aceptar ASISTENTE con `checkAssistantModulePermission('appointments')` – verificar doctor.routes.ts
3. **agendaPacientes.controller.ts:** Endpoints de agenda compartida deben aceptar ASISTENTE
4. **appointmentConfirmation.controller.ts:** Confirmaciones, lista de espera, cancelaciones – verificar que usen `doctorOrAssistantAppointments` y resuelvan doctorId para asistentes

### Despliegue
Backend (y frontend si hay cambios en headers).

---

## 8. ROL ASISTENTE – REGISTRAR Y ACTUALIZAR PACIENTES (PENDIENTE DE VERIFICAR)

### Problemas reportados
- **Registrar nuevo paciente:** Error 403 "Request failed with status code 403"
- **Datos adicionales del paciente:** "No tienes permiso para acceder a este recurso"

### Pantalla de contexto
- **Modal:** "Registrar Nuevo Paciente" con campos Nombre, Apellido, Email, Fecha de Nacimiento, Teléfono
- **Formulario:** "Datos adicionales del paciente" (contacto emergencia, RFC, constancia fiscal, foto de perfil)

### Acciones requeridas (verificar si se implementaron)
1. **doctor.controller.ts / patient.controller.ts:** Endpoints de crear paciente y actualizar datos deben aceptar ASISTENTE con `X-Selected-Doctor-Id` y permiso de historial
2. **Rutas:** Verificar que usen `authMiddleware(['DOCTOR', 'ASISTENTE'])` y `AssistantMiddleware.checkAssistantModulePermission('clinicalHistory')`

### Despliegue
Backend.

---

## 9. ERROR DE COMPILACIÓN – specialización

### Problema
`npm run build` fallaba con:
```
Type 'string | null' is not assignable to type 'string'.
specialization: doctorProfile.specialization
```

### Solución aplicada
- **Archivo:** `backend/src/controllers/doctor.controller.ts`
- **Cambio:** `doctorProfile.specialization` → `doctorProfile.specialization ?? 'General'` en las dos ocurrencias (líneas ~325 y ~363)
- **Motivo:** Doctor.specialization puede ser null; DoctorPatient.specialization exige string

### Despliegue
Backend (build debe pasar).

---

## 10. RESUMEN DE ARCHIVOS MODIFICADOS

| Archivo | Correcciones |
|---------|--------------|
| `backend/src/controllers/recipe.controller.ts` | Token PDF 7 días |
| `backend/src/controllers/schedule.controller.ts` | Asistente en update, doctorId |
| `backend/src/controllers/file.controller.ts` | doctorCanAccessFileAsCollaborator, assistantCanAccessFile |
| `backend/src/controllers/doctor.controller.ts` | specialization ?? 'General' |
| `frontend/src/components/medical/CalendlyStyleScheduleConfig.jsx` | bufferTime/appointmentDuration ?? |
| `frontend/src/components/medical/BasicConsultationForm.jsx` | Texto botón "Guardar Consulta" |
| `frontend/src/components/NotificationInbox.jsx` | Panel centrado, overflow |
| `frontend/src/components/layout/Header.jsx` | Menos elementos en móvil |

---

## 11. CHECKLIST PARA RETOMAR TRABAJO

- [ ] Verificar que todas las correcciones anteriores estén en el código actual
- [ ] Revisar rutas de doctor, recipe, schedule, reminder, agendaPacientes, appointmentConfirmation para permisos de ASISTENTE
- [ ] Confirmar que el frontend envía `X-Selected-Doctor-Id` en Prescriptions, Calendar, Patients
- [ ] Probar en desarrollo: asistente con permisos de recetas, calendario, historial
- [ ] Desplegar backend y frontend tras validar
- [ ] Probar en producción con usuario asistente real

---

## 12. IMÁGENES DE REFERENCIA (Rutas en assets)

Las capturas de pantalla mencionadas en este documento están en:
- `assets/c__Users_david_AppData_Roaming_Cursor_User_workspaceStorage_.../images/`

Al mover el proyecto a otra unidad (ej. E:), estas rutas pueden cambiar. Las descripciones en este documento sirven como contexto visual alternativo.
