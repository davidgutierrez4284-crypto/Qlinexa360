# Guía de Trabajo Colaborativo - Medilink360

## 🎯 Resumen de la Funcionalidad

La nueva funcionalidad de **Trabajo Colaborativo** permite que múltiples doctores trabajen en el mismo padecimiento de un paciente, manteniendo la trazabilidad de autoría y la integridad clínica.

## 📋 Características Principales

### 1. Asociación de Doctores Colaboradores
- **Doctor Titular**: El doctor principal que maneja el padecimiento
- **Doctores Colaboradores**: Doctores adicionales que pueden contribuir
- **Roles**: "titular" o "colaborador"

### 2. Registro de Consulta Individual
- Cada consulta tiene un campo `autor_consulta_id`
- Vinculada a un `padecimiento_id` específico
- Permite carga de formularios específicos por especialidad

### 3. Archivos y Documentos Clínicos
- **Adjuntos a cada consulta**:
  - Fotos (timeline visual)
  - Recetas
  - Estudios solicitados
  - Resultados
  - Vínculos a imágenes (ej. radiografías)

### 4. Edición Colaborativa
- Los documentos pueden ser agregados por múltiples doctores
- **Condiciones**:
  - Ser parte de los colaboradores del padecimiento
  - No existir una consulta nueva ya registrada sobre ese mismo padecimiento

### 5. Control de Edición
- **Al guardar una nueva consulta**:
  - Se bloquea la edición colaborativa de la anterior
  - Se inicia una nueva etapa de captura documental

### 6. Visibilidad por Rol
- Cada doctor ve:
  - Las consultas que él realizó
  - Las consultas del mismo padecimiento (si es colaborador)
- **Solo lectura** para consultas ajenas

## 🚀 Cómo Usar la Funcionalidad

### Paso 1: Agregar Colaboradores
```javascript
// POST /api/collaborative-work/collaborators
{
  "patientId": "uuid-del-paciente",
  "padecimientoId": "uuid-del-padecimiento", 
  "doctorId": "uuid-del-doctor-colaborador",
  "rol": "colaborador"
}
```

### Paso 2: Crear Consulta Colaborativa
```javascript
// POST /api/clinical-cases/:caseId/medical-records
{
  "patientId": "uuid-del-paciente",
  "doctorPatientId": "uuid-relacion-doctor-paciente",
  "diagnosis": "Diagnóstico del paciente",
  "treatment": "Tratamiento prescrito",
  "clinicalEvolution": "INITIAL_EVALUATION",
  "formData": {},
  "date": "2024-01-15"
}
```

### Paso 3: Verificar Permisos
```javascript
// GET /api/collaborative-work/permissions/:medicalRecordId
// Retorna:
{
  "canEdit": true,
  "isAuthor": false,
  "isCollaborator": true,
  "isEditable": true
}
```

## 🔧 Endpoints Disponibles

### Gestión de Colaboradores
- `POST /api/collaborative-work/collaborators` - Agregar colaborador
- `GET /api/collaborative-work/collaborators/:padecimientoId` - Obtener colaboradores

### Control de Permisos
- `GET /api/collaborative-work/permissions/:medicalRecordId` - Verificar permisos
- `POST /api/collaborative-work/block-editing` - Bloquear edición colaborativa

### Consultas Colaborativas
- `GET /api/collaborative-work/consultations/:patientId/:padecimientoId` - Obtener consultas

## 🎨 Componentes Frontend

### CollaborativeWork.jsx
- Gestión de colaboradores
- Agregar/remover doctores colaboradores
- Visualizar roles y permisos

### CollaborativeConsultations.jsx
- Mostrar consultas colaborativas
- Indicadores de permisos (Autor/Colaborador/Solo Lectura)
- Estado de edición (Editable/Bloqueado)

## 🔒 Seguridad y Permisos

### Reglas de Acceso
1. **Doctor Titular**: Acceso completo a todas las consultas
2. **Doctor Colaborador**: 
   - Puede editar consultas propias
   - Puede editar consultas colaborativas (si están habilitadas)
   - Solo lectura en consultas bloqueadas
3. **Otros Doctores**: Solo lectura

### Control de Edición
- **Nueva Consulta**: Bloquea automáticamente las anteriores
- **Consulta Actual**: Editable por colaboradores activos
- **Consulta Bloqueada**: Solo lectura para todos

## 📊 Flujo de Trabajo

### Escenario 1: Doctor Principal
1. Crea padecimiento
2. Agrega colaboradores
3. Crea consultas
4. Los colaboradores pueden contribuir

### Escenario 2: Doctor Colaborador
1. Ve consultas del padecimiento
2. Puede editar consultas activas
3. Puede agregar archivos y documentos
4. No puede editar consultas bloqueadas

### Escenario 3: Nueva Consulta
1. Doctor crea nueva consulta
2. Sistema bloquea consultas anteriores
3. Inicia nueva etapa colaborativa
4. Colaboradores pueden contribuir a la nueva consulta

## 🐛 Solución de Problemas

### Error: "Puerto 3000 en uso"
```bash
# Verificar procesos
netstat -ano | findstr :3000

# Terminar proceso
taskkill /PID [número_del_pid] /F
```

### Error: "Migración fallida"
```bash
# Crear migración manual
npx prisma migrate dev --create-only --name add_collaborative_work

# Editar migración y aplicar
npx prisma migrate dev
```

### Error: "Cliente Prisma no generado"
```bash
# Regenerar cliente
npx prisma generate
```

## 📈 Próximas Mejoras

1. **Notificaciones**: Alertas cuando se agregan colaboradores
2. **Historial de Cambios**: Tracking de modificaciones
3. **Comentarios**: Sistema de comentarios entre colaboradores
4. **Auditoría**: Logs detallados de acciones colaborativas
5. **Permisos Granulares**: Control más específico por tipo de documento

## 🎯 Beneficios

- **Trazabilidad**: Siempre se sabe quién hizo qué
- **Integridad**: No se pierde información clínica
- **Colaboración**: Múltiples especialistas pueden contribuir
- **Control**: Sistema automático de bloqueo de edición
- **Visibilidad**: Cada doctor ve lo que necesita ver

---

**¿Necesitas ayuda?** Contacta al equipo de desarrollo para soporte técnico. 