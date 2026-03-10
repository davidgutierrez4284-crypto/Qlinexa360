# Sistema de Consultas Divididas - Qlinexa360

## Descripción General

El sistema de consultas divididas permite separar el proceso de creación de consultas médicas en dos partes:

1. **Parte 1**: Información básica de la consulta (datos inmediatos)
2. **Parte 2**: Archivos y documentos asociados (datos posteriores)

Esta división permite mayor flexibilidad y mejor manejo del flujo de trabajo médico.

## Estructura del Formulario

### Parte 1: Datos Básicos (Imagen 1)
- **Fecha**: Fecha de la consulta
- **Motivo de la Consulta**: Razón de la visita
- **Evolución Clínica del Paciente**: Estado actual del paciente
- **Etiquetas**: Tags opcionales para categorización
- **Notas / Diagnóstico / Tratamiento**: Información clínica principal
- **Nota pública**: Visibilidad para el paciente

### Parte 2: Archivos y Documentos (Imágenes 2 y 3)
- **Recetas y Estudios Solicitados**: Documentos médicos
- **Fotos (Subidas por Doctor)**: Imágenes clínicas
- **Resultados de Estudios**: Reportes de laboratorio
- **Fotos Subidas por Paciente**: Imágenes del paciente
- **Links Asociados**: Enlaces relacionados

## Estructura de Base de Datos

### Campos Agregados a `MedicalRecord`
```sql
- isComplete: Boolean (default: false)
  -- Indica si la consulta está completa (con archivos)
- hasAttachments: Boolean (default: false)
  -- Indica si tiene archivos adjuntos
```

## API Endpoints

### 1. Crear Consulta Básica (Parte 1)

#### POST `/api/consultations/basic`
```json
{
  "clinicalCaseId": "uuid",
  "doctorPatientId": "uuid",
  "patientId": "uuid",
  "diagnosis": "Fractura de pierna derecha",
  "treatment": "Inmovilización con yeso por 6 semanas",
  "notes": "Paciente presenta dolor intenso en la pierna derecha",
  "reason": "Revisión de resultados",
  "tags": ["fractura", "trauma", "inmovilización"],
  "clinicalEvolution": "MEJORANDO",
  "formData": {
    "fecha": "2025-07-27",
    "motivoConsulta": "Revisión de resultados",
    "evolucionClinica": "MEJORANDO",
    "etiquetas": ["fractura", "trauma", "inmovilización"],
    "notas": "Paciente presenta dolor intenso en la pierna derecha",
    "notaPublica": true
  },
  "date": "2025-07-27",
  "isPublic": true
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "diagnosis": "Fractura de pierna derecha",
    "isComplete": false,
    "hasAttachments": false,
    "clinicalCase": {
      "id": "uuid",
      "padecimiento": "Fractura pierna"
    },
    "patient": {
      "id": "uuid",
      "firstName": "Blanks",
      "lastName": "Gutiérrez Grados"
    }
  },
  "message": "Consulta básica creada exitosamente. Puede agregar archivos y documentos después."
}
```

### 2. Agregar Archivos a Consulta (Parte 2)

#### POST `/api/consultations/:consultationId/attachments`
```json
{
  "fileIds": ["uuid1", "uuid2", "uuid3"],
  "links": [
    {
      "url": "https://ejemplo.com/guia_fracturas",
      "description": "Guía de tratamiento para fracturas"
    }
  ],
  "prescriptionIds": ["uuid1", "uuid2"],
  "studyDocumentIds": ["uuid1"]
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "hasAttachments": true,
    "files": [
      {
        "id": "uuid",
        "fileName": "receta_medicamentos.pdf",
        "category": "PRESCRIPTION"
      }
    ],
    "links": [
      {
        "id": "uuid",
        "url": "https://ejemplo.com/guia_fracturas",
        "description": "Guía de tratamiento para fracturas"
      }
    ]
  },
  "message": "Archivos y documentos agregados exitosamente a la consulta."
}
```

### 3. Marcar Consulta como Completa

#### PUT `/api/consultations/:consultationId/complete`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "isComplete": true,
    "hasAttachments": true
  },
  "message": "Consulta marcada como completa."
}
```

### 4. Obtener Consultas Pendientes

#### GET `/api/consultations/pending/:patientId?clinicalCaseId=uuid`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "diagnosis": "Fractura de pierna derecha",
      "isComplete": false,
      "hasAttachments": false,
      "createdAt": "2025-07-27T10:30:00Z",
      "clinicalCase": {
        "id": "uuid",
        "padecimiento": "Fractura pierna"
      }
    }
  ],
  "count": 1
}
```

### 5. Estadísticas de Consultas

#### GET `/api/consultations/stats/:patientId?clinicalCaseId=uuid`
```json
{
  "success": true,
  "data": {
    "total": 10,
    "complete": 7,
    "pending": 3,
    "withAttachments": 8,
    "byEvolution": [
      {
        "clinicalEvolution": "MEJORANDO",
        "_count": { "clinicalEvolution": 5 }
      },
      {
        "clinicalEvolution": "ESTABLE",
        "_count": { "clinicalEvolution": 3 }
      }
    ]
  }
}
```

## Flujo de Trabajo

### 1. Creación de Consulta Básica
1. El doctor llena el formulario básico (Parte 1)
2. Se guarda la información inmediatamente
3. La consulta queda marcada como `isComplete: false` y `hasAttachments: false`
4. Se puede continuar con archivos después

### 2. Agregar Archivos y Documentos
1. El doctor puede agregar archivos en cualquier momento
2. Se pueden subir:
   - Recetas y estudios solicitados
   - Fotos del doctor
   - Resultados de estudios
   - Fotos del paciente
   - Links asociados
3. La consulta se marca como `hasAttachments: true`

### 3. Marcar como Completa
1. Cuando todos los archivos están listos
2. Se marca como `isComplete: true`
3. La consulta queda completamente finalizada

## Estados de la Consulta

| Estado | isComplete | hasAttachments | Descripción |
|--------|------------|----------------|-------------|
| **Básica** | `false` | `false` | Solo datos básicos guardados |
| **Con Archivos** | `false` | `true` | Tiene archivos pero no está completa |
| **Completa** | `true` | `true` | Consulta completamente finalizada |

## Categorías de Archivos

### Recetas y Estudios Solicitados
- **Permisos**: Solo doctor/asistente puede subir
- **Tipos**: PDF, JPG, PNG, GIF, TXT, DOC, DOCX
- **Tamaño**: Máximo 10MB
- **Descripción**: "El paciente solo puede consultar"

### Fotos (Subidas por Doctor)
- **Permisos**: Solo doctor/asistente puede subir
- **Tipos**: PDF, JPG, PNG, GIF, TXT, DOC, DOCX
- **Tamaño**: Máximo 10MB
- **Descripción**: "El paciente solo puede consultar"

### Resultados de Estudios
- **Permisos**: Doctor/asistente Y paciente pueden subir
- **Tipos**: PDF, JPG, PNG, GIF, TXT, DOC, DOCX
- **Tamaño**: Máximo 10MB
- **Descripción**: "El paciente también puede subir archivos aquí"

### Fotos Subidas por Paciente
- **Permisos**: Paciente puede subir
- **Tipos**: PDF, JPG, PNG, GIF, TXT, DOC, DOCX
- **Tamaño**: Máximo 10MB
- **Descripción**: "Categoría para archivos que el paciente podría subir en su portal"

## Ventajas del Sistema Dividido

### 1. **Flexibilidad Temporal**
- Se puede guardar la consulta básica inmediatamente
- Los archivos se pueden agregar después
- No se pierde información por falta de archivos

### 2. **Mejor UX**
- Formulario más simple y rápido
- Menos campos obligatorios
- Proceso menos abrumador

### 3. **Trazabilidad**
- Se puede ver qué consultas están pendientes
- Estadísticas claras del estado de las consultas
- Control de calidad del proceso

### 4. **Colaboración**
- El paciente puede subir resultados de estudios
- Diferentes permisos por tipo de archivo
- Flujo de trabajo más natural

## Archivos y Estructura

### Backend
```
backend/
├── src/
│   ├── controllers/
│   │   └── consultation.controller.ts
│   ├── routes/
│   │   └── consultation.routes.ts
│   └── prisma/
│       └── schema.prisma
├── scripts/
│   └── test-divided-consultations.js
└── migrations/
    └── 20250728021559_add_consultation_status_fields/
```

### Base de Datos
- **Migración**: `20250728021559_add_consultation_status_fields`
- **Campos agregados**: `isComplete`, `hasAttachments` en `MedicalRecord`

## Pruebas

### Script de Pruebas
```bash
cd backend
node scripts/test-divided-consultations.js
```

### Casos de Prueba
1. Crear consulta básica
2. Verificar estado inicial
3. Agregar archivos de prueba
4. Conectar archivos a consulta
5. Marcar como completa
6. Obtener estadísticas
7. Verificar consultas pendientes

## Integración con Frontend

### Estados Visuales
- **Pendiente**: Icono de reloj o indicador visual
- **Con Archivos**: Icono de archivo adjunto
- **Completa**: Icono de check verde

### Notificaciones
- Alertas para consultas pendientes
- Recordatorios para agregar archivos
- Confirmación cuando se marca como completa

### Filtros
- Mostrar solo consultas pendientes
- Filtrar por estado de completitud
- Búsqueda por tipo de archivo

## Consideraciones Técnicas

### Validaciones
- Verificar permisos por tipo de archivo
- Validar tamaño y formato de archivos
- Control de acceso por rol de usuario

### Performance
- Carga diferida de archivos
- Paginación para consultas con muchos archivos
- Caché de archivos frecuentes

### Seguridad
- Validación de tipos de archivo
- Escaneo antivirus de archivos
- Control de acceso por consulta

## Roadmap

### Fase 1 (Actual)
- ✅ Estructura de base de datos
- ✅ API endpoints básicos
- ✅ Controladores y servicios
- ✅ Sistema de estados

### Fase 2 (Próxima)
- 🔄 Interfaz de usuario dividida
- 🔄 Indicadores visuales de estado
- 🔄 Notificaciones automáticas
- 🔄 Filtros avanzados

### Fase 3 (Futura)
- 📋 Integración con sistema de recetas
- 📋 Automatización de archivos
- 📋 IA para sugerencias de archivos
- 📋 Reportes de completitud 