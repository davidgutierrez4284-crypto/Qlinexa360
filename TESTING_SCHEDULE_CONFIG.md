# Guía para Probar la Configuración de Horarios

## Resumen
La configuración de horarios **solo se aplica para la agenda compartida** donde los pacientes pueden agendar sus propias citas. Esta configuración NO afecta el calendario interno del profesional de la salud.

## Pasos para Probar en Desarrollo

### 1. Configurar el Entorno de Desarrollo

Asegúrate de que el backend esté configurado para usar localhost:

**En `backend/.env` o variables de entorno:**
```env
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 2. Configurar Horarios de Disponibilidad

1. **Como profesional de la salud:**
   - Ve a **Calendario** → **Configuración** → **Horarios**
   - Configura tus horarios de disponibilidad para cada día de la semana
   - Ejemplo:
     - Lunes a Viernes: 09:00-12:00 y 14:00-18:00
     - Sábado: 09:00-11:00
     - Domingo: Sin disponibilidad
   - Guarda la configuración

### 3. Activar la Agenda Compartida

1. **Como profesional de la salud:**
   - Ve a **Calendario** → **Compartir Agenda**
   - Activa la opción "Activar agenda compartida"
   - Opcionalmente, agrega un mensaje personalizado
   - Guarda la configuración

### 4. Obtener el Link de Agendamiento

El link se genera automáticamente con el formato:
```
http://localhost:5173/agendar/[nombre-apellido]
```

**Para obtener el link:**
1. Ve a **Calendario** → **Compartir Agenda**
2. Copia el link que aparece en la sección
3. O verifica el email que se envía a los pacientes (debe contener el link)

### 5. Probar como Paciente

**Opción A: Usar el link directamente**
1. Abre una ventana de incógnito o usa otro navegador
2. Ve al link: `http://localhost:5173/agendar/[nombre-apellido]`
3. Deberías ver la página de agendamiento público

**Opción B: Enviar email de prueba**
1. Como profesional de la salud, ve a **Pacientes**
2. Selecciona un paciente
3. Envía el link de agendamiento por email
4. El paciente recibirá un email con el link (debe apuntar a localhost en desarrollo)

### 6. Verificar que los Horarios se Respeten

1. **Como paciente:**
   - Selecciona una fecha en el calendario
   - Verifica que solo aparezcan los horarios disponibles según la configuración
   - Intenta agendar una cita en un horario disponible
   - Intenta agendar una cita en un horario NO disponible (no debería aparecer)

2. **Verificaciones específicas:**
   - Los horarios fuera del rango configurado NO deben aparecer
   - Los días sin configuración (ej: domingo) NO deben mostrar horarios
   - Los horarios ya ocupados por otras citas NO deben aparecer
   - El tiempo entre citas debe respetar el `bufferTime` configurado

### 7. Verificar Conflictos con Citas Existentes

1. **Como profesional de la salud:**
   - Crea una cita manualmente en el calendario interno
   - Ejemplo: Lunes 10:00 AM

2. **Como paciente:**
   - Intenta agendar una cita en el mismo horario (10:00 AM del lunes)
   - El sistema NO debe permitir agendar en ese horario
   - Solo deben aparecer los horarios disponibles

## Cómo Funciona

### Flujo de la Configuración de Horarios

1. **Configuración guardada:**
   - Se guarda en `DoctorScheduleConfig` en la base de datos
   - Incluye: `weeklySchedule`, `appointmentDuration`, `bufferTime`

2. **Generación de slots:**
   - Cuando un paciente selecciona una fecha, se llama a `/api/agenda-pacientes/doctor/[username]/slots?fecha=[fecha]`
   - El backend usa `ScheduleService.generateAvailableSlots()` para generar los slots
   - Se filtran los slots que tienen conflictos con citas existentes

3. **Validación al agendar:**
   - Cuando el paciente intenta agendar, se valida:
     - Que el horario esté en la configuración (`ScheduleService.isTimeSlotAvailable()`)
     - Que no haya conflictos con citas existentes (`ScheduleService.checkAppointmentConflicts()`)

### Endpoints Relevantes

- `GET /api/schedule/config` - Obtener configuración de horarios
- `PUT /api/schedule/config` - Actualizar configuración de horarios
- `GET /api/agenda-pacientes/doctor/[username]` - Obtener info del doctor para el link público
- `GET /api/agenda-pacientes/doctor/[username]/slots?fecha=[fecha]` - Obtener slots disponibles
- `POST /api/agenda-pacientes/doctor/[username]/appointment` - Crear cita desde el link público

## Troubleshooting

### El link apunta a producción en lugar de localhost

**Solución:**
1. Verifica que `NODE_ENV=development` en el backend
2. Verifica que `FRONTEND_URL=http://localhost:5173` en el backend
3. Reinicia el servidor backend
4. Actualiza la configuración de agenda compartida (esto regenerará el link)

### Los horarios no aparecen correctamente

**Verificaciones:**
1. Confirma que la configuración de horarios se guardó correctamente:
   - Ve a **Calendario** → **Configuración** → **Horarios**
   - Verifica que los horarios estén guardados
2. Verifica en la base de datos:
   ```sql
   SELECT * FROM "DoctorScheduleConfig" WHERE "doctorId" = '[tu-doctor-id]';
   ```
3. Revisa los logs del backend cuando se solicitan los slots

### Los horarios aparecen pero no se pueden agendar

**Posibles causas:**
1. Hay un conflicto con una cita existente
2. El horario está fuera del rango configurado
3. Hay un error en la validación del backend

**Solución:**
- Revisa los logs del backend
- Verifica que no haya citas existentes en ese horario
- Verifica que el horario esté dentro del rango configurado

## Notas Importantes

- La configuración de horarios **solo afecta la agenda compartida** (link público)
- El calendario interno del profesional NO está limitado por esta configuración
- Los horarios se generan dinámicamente basándose en:
  - La configuración de horarios del doctor
  - Las citas existentes
  - El `appointmentDuration` y `bufferTime` configurados

