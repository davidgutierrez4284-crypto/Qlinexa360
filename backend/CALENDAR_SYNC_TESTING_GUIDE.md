# Guía de Pruebas - Sincronización de Calendarios

Esta guía detalla cómo probar y validar la sincronización de calendarios para cada plataforma antes de pasar a producción.

## 📋 Checklist de Verificación por Plataforma

### ✅ Google Calendar
- [x] **Probado en desarrollo**
- [ ] Autenticación OAuth funciona
- [ ] Sincronización bidireccional (importar eventos)
- [ ] Crear eventos desde Qlinexa → Google Calendar
- [ ] Actualizar eventos desde Qlinexa → Google Calendar
- [ ] Eliminar eventos desde Qlinexa → Google Calendar
- [ ] Generación de enlaces de Google Meet válidos
- [ ] Refresh de tokens automático

### 🔄 Outlook/Teams
- [ ] **Pendiente de pruebas**
- [ ] Autenticación OAuth funciona
- [ ] Sincronización bidireccional (importar eventos)
- [ ] Crear eventos desde Qlinexa → Outlook Calendar
- [ ] Actualizar eventos desde Qlinexa → Outlook Calendar
- [ ] Eliminar eventos desde Qlinexa → Outlook Calendar
- [ ] Generación de enlaces de Teams válidos
- [ ] Refresh de tokens automático
- [ ] Funciona con cuentas Microsoft 365 (corporativas)
- [ ] Funciona con cuentas personales (@outlook.com, @hotmail.com)

### 🍎 Apple Calendar
- [ ] **Pendiente de pruebas**
- [ ] Autenticación OAuth funciona
- [ ] Configuración de credenciales (App-Specific Password)
- [ ] Sincronización bidireccional (importar eventos)
- [ ] Crear eventos desde Qlinexa → Apple Calendar (iCloud)
- [ ] Actualizar eventos desde Qlinexa → Apple Calendar
- [ ] Eliminar eventos desde Qlinexa → Apple Calendar
- [ ] Funciona con iCloud CalDAV
- [ ] Manejo correcto de zonas horarias

### 📝 Notion Calendar
- [ ] **Pendiente de pruebas**
- [ ] Autenticación OAuth funciona
- [ ] Búsqueda automática de base de datos de calendario
- [ ] Sincronización bidireccional (importar eventos)
- [ ] Crear eventos desde Qlinexa → Notion Database
- [ ] Actualizar eventos desde Qlinexa → Notion Database
- [ ] Eliminar eventos desde Qlinexa → Notion Database
- [ ] Mapeo correcto de propiedades (título, fechas, descripción)
- [ ] Manejo de bases de datos con nombres personalizados

## 🧪 Plan de Pruebas por Escenario

### Escenario 1: Autenticación OAuth
**Objetivo**: Verificar que el flujo de autenticación funciona para cada plataforma.

**Pasos**:
1. Ir a Configuración > Calendarios vinculados
2. Hacer clic en "Conectar" para cada plataforma
3. Completar el flujo OAuth
4. Verificar que aparece como "Conectado" en el dashboard

**Criterios de éxito**:
- ✅ Se completa el flujo OAuth sin errores
- ✅ El estado muestra "Conectado" en el dashboard
- ✅ Los tokens se guardan correctamente en la base de datos

---

### Escenario 2: Sincronización Incoming (Importar eventos)
**Objetivo**: Verificar que los eventos externos se importan correctamente a Qlinexa.

**Pasos**:
1. Conectar el calendario externo
2. Crear un evento directamente en el calendario externo (Google/Outlook/Apple/Notion)
3. En Qlinexa, hacer clic en "Sincronizar" para ese calendario
4. Verificar que el evento aparece en el calendario de Qlinexa

**Criterios de éxito**:
- ✅ El evento aparece en Qlinexa con el título correcto
- ✅ Las fechas/horas coinciden
- ✅ La descripción se importa correctamente
- ✅ El origen del evento muestra la plataforma correcta

---

### Escenario 3: Crear Evento (Outgoing Sync)
**Objetivo**: Verificar que los eventos creados en Qlinexa se sincronizan al calendario externo.

**Pasos**:
1. Conectar el calendario externo
2. En Qlinexa, crear un nuevo evento
3. Verificar que el evento aparece en el calendario externo

**Criterios de éxito**:
- ✅ El evento aparece en el calendario externo
- ✅ Título, fechas y descripción coinciden
- ✅ Si es cita remota con Google Meet/Teams, el enlace es válido

---

### Escenario 4: Actualizar Evento
**Objetivo**: Verificar que las actualizaciones se sincronizan correctamente.

**Pasos**:
1. Tener un evento sincronizado en ambos sistemas
2. Editar el evento en Qlinexa (cambiar título, fecha, descripción)
3. Verificar que los cambios se reflejan en el calendario externo

**Criterios de éxito**:
- ✅ Los cambios se reflejan en el calendario externo
- ✅ No se crean eventos duplicados
- ✅ El `externalEventId` se mantiene correcto

---

### Escenario 5: Eliminar Evento
**Objetivo**: Verificar que la eliminación se sincroniza correctamente.

**Pasos**:
1. Tener un evento sincronizado en ambos sistemas
2. Eliminar el evento en Qlinexa
3. Verificar que el evento se elimina del calendario externo

**Criterios de éxito**:
- ✅ El evento se elimina del calendario externo
- ✅ No quedan eventos huérfanos

---

### Escenario 6: Generación de Enlaces de Videollamada
**Objetivo**: Verificar que los enlaces generados son válidos.

**Pasos**:
1. Conectar Google Calendar o Outlook
2. Crear una cita remota seleccionando "Google Meet" o "Microsoft Teams"
3. Guardar la cita
4. Hacer clic en el enlace generado
5. Verificar que el enlace abre la videollamada correctamente

**Criterios de éxito**:
- ✅ El enlace se genera automáticamente
- ✅ El enlace es válido y abre la videollamada
- ✅ El enlace se guarda correctamente en la base de datos

---

### Escenario 7: Refresh de Tokens
**Objetivo**: Verificar que los tokens se refrescan automáticamente.

**Pasos**:
1. Conectar un calendario externo
2. Esperar a que el token expire (o simular expiración)
3. Intentar crear/actualizar un evento
4. Verificar que el sistema refresca el token automáticamente

**Criterios de éxito**:
- ✅ El token se refresca automáticamente
- ✅ Las operaciones continúan funcionando sin interrupciones
- ✅ El nuevo token se guarda en la base de datos

---

## 🔧 Configuración de Entornos de Prueba

### Variables de Entorno Requeridas

```bash
# Google Calendar
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REDIRECT_URI=https://tu-dominio.com/api/calendar-sync/auth/google/callback

# Outlook/Teams
OUTLOOK_CLIENT_ID=tu_client_id
OUTLOOK_CLIENT_SECRET=tu_client_secret
OUTLOOK_REDIRECT_URI=https://tu-dominio.com/api/calendar-sync/auth/outlook/callback

# Apple Calendar
APPLE_CLIENT_ID=tu_client_id
APPLE_CLIENT_SECRET=tu_client_secret
APPLE_REDIRECT_URI=https://tu-dominio.com/api/calendar-sync/auth/apple/callback

# Notion
NOTION_CLIENT_ID=tu_client_id
NOTION_CLIENT_SECRET=tu_client_secret
NOTION_REDIRECT_URI=https://tu-dominio.com/api/calendar-sync/auth/notion/callback
```

### Configuración de OAuth Apps

#### Google Calendar
1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear/Seleccionar proyecto
3. Habilitar Google Calendar API
4. Crear credenciales OAuth 2.0
5. Agregar URI de redirección autorizada
6. Agregar usuarios de prueba (si está en modo "Testing")

#### Outlook/Teams
1. Ir a [Azure Portal](https://portal.azure.com/)
2. Registrar nueva aplicación
3. Configurar permisos:
   - `Calendars.ReadWrite`
   - `OnlineMeetings.ReadWrite`
   - `offline_access`
4. Crear secreto de cliente
5. Configurar URIs de redirección

#### Apple Calendar
1. Ir a [Apple Developer](https://developer.apple.com/)
2. Crear App ID con servicios de calendario
3. Configurar credenciales
4. **Importante**: El usuario debe generar un "App-Specific Password" desde appleid.apple.com

#### Notion
1. Ir a [Notion Developers](https://developers.notion.com/)
2. Crear nueva integración
3. Configurar permisos de lectura/escritura
4. Compartir la base de datos de calendario con la integración

---

## 🐛 Problemas Comunes y Soluciones

### Google Calendar
**Problema**: "Access blocked: This app's request is invalid"
- **Solución**: Verificar que el proyecto esté en modo "Testing" y agregar usuarios de prueba, o solicitar verificación de la app

**Problema**: "Invalid grant"
- **Solución**: El refresh token puede haber expirado, reconectar el calendario

### Outlook/Teams
**Problema**: "AADSTS70011: The provided value for the input parameter 'scope' is not valid"
- **Solución**: Verificar que los scopes estén correctamente configurados en Azure Portal

**Problema**: "Online meeting not created"
- **Solución**: Verificar que la cuenta tenga licencia de Microsoft 365 con Teams

### Apple Calendar
**Problema**: "Authentication failed"
- **Solución**: Verificar que se esté usando un App-Specific Password, no la contraseña de la cuenta

**Problema**: "No calendars found"
- **Solución**: Verificar que las credenciales CalDAV sean correctas y que el calendario esté compartido

### Notion
**Problema**: "Database not found"
- **Solución**: Verificar que la base de datos esté compartida con la integración de Notion

**Problema**: "Property not found"
- **Solución**: Verificar que la base de datos tenga las propiedades requeridas (Name, Fecha Inicio, Fecha Fin)

---

## 📊 Logs y Monitoreo

### Verificar Logs del Backend
```bash
# Buscar errores de sincronización
grep -i "error.*calendar" logs/backend.log

# Buscar errores de OAuth
grep -i "oauth.*error" logs/backend.log
```

### Verificar Estado en Base de Datos
```sql
-- Ver estado de conexiones
SELECT provider, isConnected, lastSync, error 
FROM calendar_sync_configs 
WHERE doctorId = 'tu_doctor_id';

-- Ver eventos sincronizados
SELECT origenEvento, externalProvider, COUNT(*) 
FROM internal_calendar_events 
WHERE doctorId = 'tu_doctor_id'
GROUP BY origenEvento, externalProvider;
```

---

## ✅ Checklist Pre-Producción

Antes de pasar a producción, asegúrate de:

- [ ] Todas las plataformas han sido probadas en entorno de staging
- [ ] Las variables de entorno están configuradas correctamente
- [ ] Los OAuth apps están configurados con las URIs de producción
- [ ] Los scopes y permisos están correctamente configurados
- [ ] Se han probado todos los escenarios de sincronización
- [ ] Los enlaces de videollamada (Google Meet/Teams) funcionan correctamente
- [ ] El refresh de tokens funciona automáticamente
- [ ] Se han documentado los problemas conocidos y sus soluciones
- [ ] Se ha configurado monitoreo y alertas para errores de sincronización

---

## 🚀 Recomendaciones para Producción

1. **Monitoreo**: Configurar alertas para errores de sincronización
2. **Logs**: Mantener logs detallados de todas las operaciones de sincronización
3. **Rate Limiting**: Implementar rate limiting para evitar exceder límites de API
4. **Retry Logic**: Ya implementado en los servicios, pero verificar que funcione correctamente
5. **Backup**: Asegurar que los tokens se respalden correctamente
6. **Documentación**: Mantener esta guía actualizada con problemas encontrados

---

## 📞 Soporte

Si encuentras problemas durante las pruebas:
1. Revisar los logs del backend
2. Verificar el estado en la base de datos
3. Consultar la documentación oficial de cada API
4. Revisar esta guía para problemas comunes

