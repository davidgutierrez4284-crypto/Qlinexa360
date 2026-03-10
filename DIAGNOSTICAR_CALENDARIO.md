# Guía para Diagnosticar Problemas de Sincronización de Calendarios

Cuando un paciente no recibe la invitación de calendario aunque el doctor tenga el calendario sincronizado, sigue estos pasos para diagnosticar el problema.

## 📋 Paso 1: Ejecutar el Script de Diagnóstico

El script de diagnóstico te ayudará a identificar problemas comunes:

```bash
# Desde la raíz del proyecto
cd backend
npm run diagnose:calendar <doctorId> [eventId]
```

**Ejemplo:**
```bash
# Diagnosticar todos los eventos recientes de un doctor
npm run diagnose:calendar "doctor-uuid-here"

# Diagnosticar un evento específico
npm run diagnose:calendar "doctor-uuid-here" "event-uuid-here"
```

**Para obtener el doctorId:**
1. Abre Prisma Studio: `npm run db:studio`
2. Ve a la tabla `Doctor`
3. Copia el `id` del doctor

**Para obtener el eventId:**
1. En Prisma Studio, ve a la tabla `InternalCalendarEvent`
2. Busca el evento reciente que creaste
3. Copia el `id` del evento

## 📊 Paso 2: Revisar los Logs del Servidor

### En Desarrollo

Los logs se muestran en la **consola donde ejecutaste `npm run dev`** en el backend.

Cuando creas una cita, busca estos mensajes clave:

```
=== INICIO createCalendarEvent ===
📅 Sincronizando con Google Calendar...
   Email del paciente obtenido: paciente@email.com
   Attendees (pacientes): paciente@email.com
✅ Evento sincronizado exitosamente con Google Calendar
   📧 Las invitaciones se enviaron automáticamente a los attendees
```

**Si ves errores, busca:**
- `❌ ERROR CRÍTICO sincronizando evento con Google Calendar`
- `❌ ERROR CRÍTICO: Hay un paciente asociado pero NO se sincronizó con ningún calendario externo`
- `⚠️  No se obtuvo resultado de sincronización con Google Calendar`

### En Producción

Los logs se guardan en archivos en el directorio `backend/logs/`:

- `security.log` - Eventos de seguridad y errores importantes
- `calendar.log` - Logs específicos de calendario (si están configurados)

Para ver los logs más recientes:
```bash
# Windows PowerShell
Get-Content backend/logs/security.log -Tail 100

# Linux/Mac
tail -n 100 backend/logs/security.log
```

## 🔍 Paso 3: Verificar el Estado de Sincronización

### Verificar que el calendario esté conectado:

1. Abre Prisma Studio: `npm run db:studio`
2. Ve a la tabla `CalendarSyncConfig`
3. Busca las filas donde `doctorId` coincida con el doctor
4. Verifica que:
   - `isConnected` sea `true`
   - `error` sea `null` o esté vacío
   - `lastSync` tenga una fecha reciente

### Verificar un evento específico:

1. En Prisma Studio, ve a la tabla `InternalCalendarEvent`
2. Busca el evento que creaste
3. Verifica:
   - `patientId` no sea `null`
   - `externalProvider` tenga un valor (google, outlook, apple)
   - `externalEventId` tenga un valor
   - El paciente tenga `email` registrado

## 📧 Paso 4: Verificar el Email del Paciente

El paciente **DEBE** tener un email registrado para recibir invitaciones:

1. En Prisma Studio, ve a la tabla `Patient`
2. Busca el paciente por `id` (desde el evento)
3. Verifica que tenga `email` O que el `userId` apunte a un `User` con email:
   - Si `email` está en `Patient`: ✅ Listo
   - Si no, ve a la tabla `User` y busca por `userId`
   - Verifica que el `User` tenga `email`

## 🐛 Problemas Comunes y Soluciones

### Problema 1: "No hay calendarios externos conectados"

**Síntoma:** El script muestra que no hay calendarios conectados

**Solución:**
1. El doctor debe conectar su calendario desde la interfaz
2. Ve a la configuración de calendarios externos
3. Conecta Google Calendar, Outlook o Apple Calendar

### Problema 2: "El paciente no tiene email"

**Síntoma:** El script muestra que el evento no tiene email del paciente

**Solución:**
1. Asegúrate de que el paciente tenga email registrado
2. Si el paciente fue creado sin email, edítalo para agregar el email

### Problema 3: "Error en las credenciales"

**Síntoma:** El script muestra error en `CalendarSyncConfig.error`

**Solución:**
1. El doctor debe desconectar y volver a conectar el calendario
2. Esto refrescará las credenciales OAuth

### Problema 4: "Sincronización exitosa pero el paciente no recibe invitación"

**Síntoma:** Los logs muestran sincronización exitosa pero el paciente no recibe email

**Posibles causas:**
1. El email del paciente está mal escrito
2. El email está en carpeta de spam
3. El paciente usa un proveedor de email que bloquea invitaciones de calendario
4. El evento se creó pero Google/Outlook no envió la invitación (raro pero posible)

**Solución:**
1. Verifica que el email del paciente sea correcto
2. Pide al paciente que revise su carpeta de spam
3. Prueba enviando un email manual desde la plataforma

## 📝 Compartir Logs para Análisis

Si necesitas compartir logs para análisis, ejecuta:

```bash
# Ejecutar diagnóstico y guardar resultado
npm run diagnose:calendar "doctor-id" "event-id" > diagnostico.txt 2>&1

# Obtener últimas 200 líneas de logs del servidor (en desarrollo, desde la consola)
# En producción:
Get-Content backend/logs/security.log -Tail 200 > logs-recientes.txt
```

Luego comparte:
1. El archivo `diagnostico.txt`
2. El archivo `logs-recientes.txt`
3. El `doctorId` y `eventId` específicos del problema

## 🔄 Verificación Manual Rápida

Si quieres verificar rápidamente sin ejecutar el script:

```sql
-- Ver configuraciones de calendario del doctor
SELECT id, provider, "isConnected", "lastSync", error 
FROM "CalendarSyncConfig" 
WHERE "doctorId" = 'doctor-id-here';

-- Ver eventos recientes del doctor con pacientes
SELECT 
  e.id, 
  e.titulo, 
  e."fechaHoraInicio",
  e."externalProvider",
  e."externalEventId",
  p."firstName" || ' ' || p."lastName" as paciente,
  p.email as paciente_email
FROM "InternalCalendarEvent" e
LEFT JOIN "Patient" p ON e."patientId" = p.id
WHERE e."doctorId" = 'doctor-id-here'
  AND e."fechaHoraInicio" >= NOW() - INTERVAL '7 days'
ORDER BY e."fechaHoraInicio" DESC;
```

