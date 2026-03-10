# Guía de Integración Frontend - Sistema de Consultas Divididas

## 📋 Descripción General

Esta guía explica cómo integrar el sistema de consultas divididas en el frontend de Medilink360. El sistema permite dividir el proceso de creación de consultas en dos partes:

1. **Parte 1**: Datos básicos (fecha, motivo, evolución clínica, notas, etc.)
2. **Parte 2**: Archivos y documentos (recetas, fotos, resultados, links)

## 🏗️ Arquitectura del Sistema

### Componentes Principales

```
frontend/src/components/medical/
├── BasicConsultationForm.jsx          # Formulario Parte 1
├── ConsultationAttachmentsForm.jsx    # Formulario Parte 2
├── DividedConsultationManager.jsx     # Gestor principal
└── ConsultationStatusIndicator.jsx    # Indicadores de estado
```

### Servicios y Hooks

```
frontend/src/services/
└── consultationService.js             # API calls

frontend/src/hooks/
└── useDividedConsultations.js        # Hook personalizado
```

## 🚀 Instalación y Configuración

### 1. Verificar Dependencias

Asegúrate de tener las siguientes dependencias instaladas:

```bash
npm install @headlessui/react @heroicons/react react-toastify axios lodash
```

### 2. Configurar Variables de Entorno

En tu archivo `.env`:

```env
VITE_API_URL=http://localhost:3001
```

### 3. Importar Componentes

```javascript
// Componentes principales
import DividedConsultationManager from '../components/medical/DividedConsultationManager';
import { ConsultationStatusIndicator, ConsultationList, ConsultationStats, PendingConsultationsAlert } from '../components/medical/ConsultationStatusIndicator';

// Hook personalizado
import useDividedConsultations from '../hooks/useDividedConsultations';

// Servicio
import consultationService from '../services/consultationService';
```

## 📱 Uso Básico

### 1. Integración en una Página

```javascript
import React, { useState } from 'react';
import DividedConsultationManager from '../components/medical/DividedConsultationManager';
import useDividedConsultations from '../hooks/useDividedConsultations';

const MyPage = () => {
  const [showDividedManager, setShowDividedManager] = useState(false);
  const patientId = 'patient-123';
  const clinicalCaseId = 'case-456';

  const {
    consultations,
    pendingConsultations,
    stats,
    createBasicConsultation,
    addAttachmentsToConsultation,
    openDividedManager,
    closeDividedManager
  } = useDividedConsultations(patientId, clinicalCaseId);

  const handleConsultationCreated = (consultation) => {
    console.log('Consulta creada:', consultation);
    // Actualizar UI, mostrar notificación, etc.
  };

  return (
    <div>
      {/* Botón para abrir el gestor */}
      <button onClick={() => setShowDividedManager(true)}>
        Nueva Consulta
      </button>

      {/* Gestor de consultas divididas */}
      <DividedConsultationManager
        isOpen={showDividedManager}
        onClose={() => setShowDividedManager(false)}
        patientName="Juan Pérez"
        padecimiento="Diabetes"
        patientId={patientId}
        clinicalCaseId={clinicalCaseId}
        onConsultationCreated={handleConsultationCreated}
        onConsultationUpdated={handleConsultationUpdated}
      />
    </div>
  );
};
```

### 2. Uso del Hook Personalizado

```javascript
const {
  // Estados
  consultations,
  pendingConsultations,
  stats,
  loading,
  error,
  showDividedManager,
  isCreatingBasic,
  isAddingAttachments,

  // Consultas filtradas
  completeConsultations,
  consultationsWithAttachments,
  pendingConsultationsList,

  // Acciones
  createBasicConsultation,
  addAttachmentsToConsultation,
  markConsultationComplete,
  openDividedManager,
  closeDividedManager,
  refresh,

  // Utilidades
  getConsultationsByStatus
} = useDividedConsultations(patientId, clinicalCaseId);
```

## 🎨 Componentes de UI

### 1. Indicadores de Estado

```javascript
import { ConsultationStatusIndicator } from '../components/medical/ConsultationStatusIndicator';

// Mostrar estado de una consulta
<ConsultationStatusIndicator 
  consultation={consultation}
  onClick={() => handleConsultationClick(consultation)}
/>
```

### 2. Lista de Consultas

```javascript
import { ConsultationList } from '../components/medical/ConsultationStatusIndicator';

// Mostrar lista de consultas
<ConsultationList 
  consultations={consultations}
  onConsultationClick={handleConsultationClick}
  showStatus={true}
/>
```

### 3. Estadísticas

```javascript
import { ConsultationStats } from '../components/medical/ConsultationStatusIndicator';

// Mostrar estadísticas
<ConsultationStats stats={stats} />
```

### 4. Alerta de Consultas Pendientes

```javascript
import { PendingConsultationsAlert } from '../components/medical/ConsultationStatusIndicator';

// Mostrar alerta si hay consultas pendientes
<PendingConsultationsAlert 
  pendingCount={pendingConsultations.length}
  onClick={openDividedManager}
/>
```

## 🔧 API y Servicios

### 1. Servicio Principal

```javascript
import consultationService from '../services/consultationService';

// Crear consulta básica
const consultation = await consultationService.createBasicConsultation(data);

// Agregar archivos
await consultationService.addAttachmentsToConsultation(consultationId, data);

// Marcar como completa
await consultationService.markConsultationComplete(consultationId);

// Obtener consultas pendientes
const pending = await consultationService.getPendingConsultations(patientId);

// Obtener estadísticas
const stats = await consultationService.getConsultationStats(patientId);
```

### 2. Validaciones

```javascript
// Validar datos básicos
const errors = consultationService.validateBasicConsultation(data);
if (errors.length > 0) {
  console.error('Errores de validación:', errors);
}

// Validar archivos
const attachmentErrors = consultationService.validateAttachments(data);
if (attachmentErrors.length > 0) {
  console.error('Errores de archivos:', attachmentErrors);
}
```

## 📊 Estados del Sistema

### Estados de Consulta

| Estado | Descripción | Color | Icono |
|--------|-------------|-------|-------|
| `pending` | Sin archivos adjuntos | Amarillo | Clock |
| `with-attachments` | Con archivos pero no completa | Azul | Document |
| `complete` | Consulta completa | Verde | CheckCircle |

### Flujo de Trabajo

1. **Crear consulta básica** → Estado: `pending`
2. **Agregar archivos** → Estado: `with-attachments`
3. **Marcar como completa** → Estado: `complete`

## 🎯 Ejemplos de Integración

### 1. Página de Registros Médicos

```javascript
// Ver ejemplo completo en: MedicalRecordsWithDividedConsultations.jsx
```

### 2. Dashboard del Doctor

```javascript
const DoctorDashboard = () => {
  const { stats, pendingConsultations } = useDividedConsultations(patientId);

  return (
    <div>
      <ConsultationStats stats={stats} />
      <PendingConsultationsAlert 
        pendingCount={pendingConsultations.length}
        onClick={openDividedManager}
      />
    </div>
  );
};
```

### 3. Vista de Paciente

```javascript
const PatientView = () => {
  const { consultations } = useDividedConsultations(patientId);

  return (
    <div>
      <ConsultationList 
        consultations={consultations}
        onConsultationClick={handleConsultationClick}
      />
    </div>
  );
};
```

## 🔄 Actualización de Datos

### Refrescar Datos

```javascript
const { refresh } = useDividedConsultations(patientId);

// Refrescar manualmente
await refresh();

// Refrescar después de una acción
const handleConsultationCreated = async (consultation) => {
  await refresh();
  toast.success('Consulta creada exitosamente');
};
```

### Actualización Automática

El hook maneja automáticamente la actualización de datos cuando:

- Se crea una nueva consulta básica
- Se agregan archivos a una consulta
- Se marca una consulta como completa
- Cambia el `patientId` o `clinicalCaseId`

## 🎨 Personalización

### 1. Estilos CSS

Los componentes usan Tailwind CSS. Puedes personalizar los estilos:

```css
/* Personalizar colores de estado */
.consultation-pending {
  @apply bg-yellow-50 border-yellow-200 text-yellow-600;
}

.consultation-complete {
  @apply bg-green-50 border-green-200 text-green-600;
}
```

### 2. Configuración de Componentes

```javascript
// Personalizar validaciones
const customValidation = (data) => {
  const errors = [];
  // Tu lógica de validación personalizada
  return errors;
};

// Personalizar mensajes
const customMessages = {
  consultationCreated: 'Consulta guardada exitosamente',
  filesAdded: 'Archivos agregados correctamente',
  error: 'Error al procesar la consulta'
};
```

## 🐛 Solución de Problemas

### Errores Comunes

1. **Error de CORS**
   ```javascript
   // Verificar configuración del backend
   app.use(cors({
     origin: 'http://localhost:5173',
     credentials: true
   }));
   ```

2. **Error de Autenticación**
   ```javascript
   // Verificar token en localStorage
   const token = localStorage.getItem('token');
   if (!token) {
     // Redirigir a login
   }
   ```

3. **Error de API**
   ```javascript
   // Verificar URL de la API
   const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
   ```

### Debug

```javascript
// Habilitar logs de debug
const DEBUG = true;

if (DEBUG) {
  console.log('Consultations:', consultations);
  console.log('Stats:', stats);
  console.log('Pending:', pendingConsultations);
}
```

## 📈 Próximos Pasos

1. **Integrar con el sistema existente**
   - Conectar con el endpoint de `medicalRecords`
   - Migrar datos existentes

2. **Agregar funcionalidades avanzadas**
   - Filtros por fecha
   - Búsqueda de consultas
   - Exportar datos

3. **Optimizaciones**
   - Lazy loading de archivos
   - Caché de consultas
   - Paginación

## 📞 Soporte

Para dudas o problemas:

1. Revisar los logs del navegador
2. Verificar la configuración del backend
3. Comprobar la conectividad de la API
4. Validar los datos de entrada

---

**Nota**: Esta integración está diseñada para trabajar con el backend que implementamos anteriormente. Asegúrate de que el servidor esté ejecutándose y las rutas estén disponibles. 