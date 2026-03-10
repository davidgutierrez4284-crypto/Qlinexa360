# Sistema de Recetas Médicas - Qlinexa360

## Descripción General

El sistema de recetas médicas de Qlinexa360 permite al personal de salud generar, emitir, consultar y compartir recetas médicas en formato digital. Las recetas están asociadas a cada paciente y se pueden guardar como evidencia clínica, cumpliendo con los estándares legales y normativos aplicables.

## Características Principales

### 1. Templates Personalizados
- Los doctores pueden subir sus propios formatos PDF
- Sistema de zonas editables (similar a DocuSign)
- Campos sugeridos: nombre del paciente, edad/sexo, fecha, medicamentos, dosis, frecuencia, observaciones, estudios, firma del médico

### 2. Creación de Recetas
- Selección de paciente y cita
- Elección de formato (genérico o personalizado)
- Captura de campos en zonas editables
- Generación automática de PDF
- Asociación al expediente clínico

### 3. Tipos de Recetas
- **Recetas de Medicamentos**: Incluyen medicamentos, dosis, frecuencia y duración
- **Solicitudes de Estudios**: Incluyen estudios clínicos con indicaciones

### 4. Visualización y Compartir
- Visualización como PDF en perfil del paciente
- Envío por WhatsApp o correo electrónico
- Marcado como favorita para reutilización
- Anexión a consultas correspondientes

## Estructura de Base de Datos

### Tabla: `doctor_recipe_templates`
```sql
- id: UUID (PK)
- doctor_id: UUID (FK a tabla de doctores)
- pdf_url: string (Ubicación del PDF prediseñado)
- campos_editables: JSON (Lista de coordenadas o zonas seleccionadas para editar)
- creado_en: timestamp
```

### Tabla: `recetas_medicas`
```sql
- id: UUID (PK)
- doctor_id: UUID (FK a tabla de doctores)
- paciente_id: UUID (FK a tabla de pacientes)
- cita_id: UUID (FK con tabla de citas)
- archivo_pdf: string (Link del PDF generado)
- fecha_emision: datetime
- observaciones: text
- es_receta_medicamento: boolean
- es_solicitud_estudios: boolean
- realizado_por: string (ID del usuario que realizó la acción)
- vinculado_a_doctor: string (ID del doctor al que está vinculado el asistente)
```

### Tabla: `receta_detalle_medicamentos`
```sql
- id: UUID (PK)
- receta_id: UUID (FK receta)
- medicamento: string
- dosis: string
- frecuencia: string
- duracion: string (opcional)
```

### Tabla: `receta_estudios_solicitados`
```sql
- id: UUID (PK)
- receta_id: UUID (FK receta)
- nombre_estudio: string
- indicaciones: text (opcional)
```

## API Endpoints

### Templates de Recetas

#### POST `/api/recipes/templates/:doctorId`
Subir template de receta personalizado del doctor
```json
{
  "pdfUrl": "https://example.com/template.pdf",
  "camposEditables": {
    "nombrePaciente": { "x": 100, "y": 150, "width": 200, "height": 30 },
    "fechaEmision": { "x": 100, "y": 200, "width": 150, "height": 30 },
    "medicamentos": { "x": 100, "y": 250, "width": 400, "height": 200 },
    "observaciones": { "x": 100, "y": 500, "width": 400, "height": 100 },
    "firmaMedico": { "x": 100, "y": 650, "width": 200, "height": 50 }
  }
}
```

#### GET `/api/recipes/templates/:doctorId`
Obtener templates de recetas de un doctor

### Recetas Médicas

#### POST `/api/recipes`
Crear nueva receta médica
```json
{
  "doctorId": "uuid",
  "pacienteId": "uuid",
  "citaId": "uuid",
  "archivoPdf": "receta_generada.pdf",
  "observaciones": "Paciente debe tomar medicamento con las comidas",
  "esRecetaMedicamento": true,
  "esSolicitudEstudios": false,
  "medicamentos": [
    {
      "medicamento": "Paracetamol 500mg",
      "dosis": "1 tableta",
      "frecuencia": "Cada 8 horas",
      "duracion": "5 días"
    }
  ],
  "estudios": [
    {
      "nombreEstudio": "Hemograma completo",
      "indicaciones": "Ayuno de 8 horas"
    }
  ],
  "realizadoPor": "uuid",
  "vinculadoADoctor": "uuid"
}
```

#### GET `/api/recipes/patient/:pacienteId`
Obtener recetas de un paciente
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fechaEmision": "2024-01-15T10:30:00Z",
      "esRecetaMedicamento": true,
      "esSolicitudEstudios": false,
      "observaciones": "Paciente debe tomar medicamento con las comidas",
      "detalleMedicamentos": [...],
      "estudiosSolicitados": [...],
      "doctor": {
        "id": "uuid",
        "user": {
          "firstName": "Dr. Juan",
          "lastName": "Pérez"
        }
      },
      "cita": {
        "id": "uuid",
        "date": "2024-01-15T09:00:00Z",
        "notes": "Consulta de rutina"
      }
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 50,
    "offset": 0
  }
}
```

#### GET `/api/recipes/doctor/:doctorId`
Obtener recetas de un doctor

#### GET `/api/recipes/:id`
Obtener receta específica

#### PUT `/api/recipes/:id`
Actualizar receta médica

#### DELETE `/api/recipes/:id`
Eliminar receta médica

#### GET `/api/recipes/stats/:doctorId`
Obtener estadísticas de recetas para un doctor
```json
{
  "success": true,
  "data": {
    "totalRecetas": 150,
    "recetasMedicamentos": 120,
    "solicitudesEstudios": 30,
    "medicamentosMasUsados": [
      {
        "medicamento": "Paracetamol 500mg",
        "_count": { "medicamento": 45 }
      }
    ],
    "estudiosMasSolicitados": [
      {
        "nombreEstudio": "Hemograma completo",
        "_count": { "nombreEstudio": 25 }
      }
    ]
  }
}
```

## Flujo de Trabajo

### 1. Configuración Inicial
1. El doctor sube su template PDF personalizado
2. Define las zonas editables con coordenadas
3. El sistema valida los campos requeridos

### 2. Creación de Receta
1. Seleccionar paciente y cita
2. Elegir template (genérico o personalizado)
3. Llenar campos editables:
   - Información del paciente
   - Medicamentos y dosis
   - Estudios solicitados
   - Observaciones
4. Generar PDF automáticamente
5. Guardar en base de datos
6. Asociar al expediente clínico

### 3. Gestión y Consulta
1. Visualizar recetas en perfil del paciente
2. Filtrar por tipo (medicamentos/estudios)
3. Buscar por fecha o doctor
4. Compartir por WhatsApp/email
5. Marcar como favorita

## Validaciones y Seguridad

### Validaciones
- Solo personal médico autorizado puede emitir recetas
- Cada receta debe tener timestamp
- Validación de campos requeridos
- Verificación de permisos por rol

### Seguridad
- Autenticación requerida para todas las operaciones
- Validación de suscripción activa
- Logging de todas las operaciones
- Firma digital automática con nombre del médico, fecha y hora

## Integración con Otros Módulos

### Historial Clínico
- Toda receta se asocia al historial del paciente
- Se vincula al padecimiento activo
- Muestra historial de recetas previas relacionadas

### Agenda/Citas
- Las recetas se asocian a citas específicas
- Permite seguimiento temporal de tratamientos

### Dashboard del Doctor
- Estadísticas de prescripciones
- Medicamentos más usados por especialidad
- Estudios más solicitados
- Tiempos promedio entre diagnóstico y prescripción

## Estadísticas y Reportes

### Métricas Disponibles
- Total de recetas por doctor
- Recetas de medicamentos vs solicitudes de estudios
- Medicamentos más prescritos
- Estudios más solicitados
- Tendencias temporales

### Futuras Mejoras
- Normalización con Cuadro Básico de Medicamentos del IMSS/SSA
- Integración con Power BI para análisis avanzado
- Detección de patrones de prescripción
- Alertas de interacciones medicamentosas

## Archivos y Estructura

### Backend
```
backend/
├── src/
│   ├── controllers/
│   │   └── recipe.controller.ts
│   ├── routes/
│   │   └── recipe.routes.ts
│   ├── services/
│   │   └── recipePdf.service.ts
│   └── prisma/
│       └── schema.prisma
├── scripts/
│   └── test-recipe-system.js
└── uploads/
    └── recipes/
```

### Base de Datos
- Migración: `20250728015810_add_recipe_system`
- Nuevas tablas: `doctor_recipe_templates`, `recetas_medicas`, `receta_detalle_medicamentos`, `receta_estudios_solicitados`

## Pruebas

### Script de Pruebas
```bash
cd backend
node scripts/test-recipe-system.js
```

### Casos de Prueba
1. Crear template personalizado
2. Crear receta de medicamentos
3. Crear receta de estudios
4. Consultar recetas del paciente
5. Obtener estadísticas
6. Validar relaciones entre tablas

## Consideraciones Técnicas

### Generación de PDFs
- Actualmente usa archivos de texto como placeholder
- Integración futura con librerías como PDFKit
- Soporte para templates personalizados con coordenadas

### Escalabilidad
- Paginación en consultas
- Índices en base de datos
- Caché para templates frecuentes

### Mantenimiento
- Logging detallado de operaciones
- Backup automático de recetas
- Versionado de templates

## Roadmap

### Fase 1 (Actual)
- ✅ Estructura de base de datos
- ✅ API endpoints básicos
- ✅ Controladores y servicios
- ✅ Sistema de templates

### Fase 2 (Próxima)
- 🔄 Integración con librería PDF
- 🔄 Interfaz de usuario
- 🔄 Sistema de firmas digitales
- 🔄 Envío por WhatsApp/email

### Fase 3 (Futura)
- 📋 Integración con Power BI
- 📋 Normalización de medicamentos
- 📋 Alertas de interacciones
- 📋 IA para sugerencias de medicamentos 