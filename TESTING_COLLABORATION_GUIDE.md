# 🏥 Guía de Testing - Colaboración en Historial Clínico

## 📋 Usuarios de Prueba Creados

Se han creado **15 usuarios** para testing completo de la colaboración en historial clínico:

### 👨‍⚕️ **10 Doctores** (Especialidades Médicas)

| # | Email | Nombre | Especialidad | Contraseña |
|---|-------|--------|--------------|------------|
| 1 | dr.garcia@qlinexa360.com | Dr. Carlos García | Cardiología | password123 |
| 2 | dr.rodriguez@qlinexa360.com | Dra. Ana Rodríguez | Dermatología | password123 |
| 3 | dr.martinez@qlinexa360.com | Dr. Luis Martínez | Ortopedia | password123 |
| 4 | dr.lopez@qlinexa360.com | Dra. María López | Ginecología | password123 |
| 5 | dr.gonzalez@qlinexa360.com | Dr. Roberto González | Neurología | password123 |
| 6 | dr.perez@qlinexa360.com | Dra. Patricia Pérez | Pediatría | password123 |
| 7 | dr.sanchez@qlinexa360.com | Dr. Fernando Sánchez | Oftalmología | password123 |
| 8 | dr.torres@qlinexa360.com | Dra. Carmen Torres | Endocrinología | password123 |
| 9 | dr.vega@qlinexa360.com | Dr. Alejandro Vega | Urología | password123 |
| 10 | dr.morales@qlinexa360.com | Dra. Isabel Morales | Psiquiatría | password123 |

### 👩‍⚕️ **5 Enfermeras** (Personal de Salud)

| # | Email | Nombre | Especialidad | Contraseña |
|---|-------|--------|--------------|------------|
| 1 | enfermera.gutierrez@qlinexa360.com | Enf. Laura Gutiérrez | Enfermería General | password123 |
| 2 | enfermera.ramirez@qlinexa360.com | Enf. Jorge Ramírez | Enfermería Intensiva | password123 |
| 3 | enfermera.silva@qlinexa360.com | Enf. Rosa Silva | Enfermería Pediátrica | password123 |
| 4 | enfermera.mendoza@qlinexa360.com | Enf. Diego Mendoza | Enfermería Quirúrgica | password123 |
| 5 | enfermera.cruz@qlinexa360.com | Enf. Adriana Cruz | Enfermería Obstétrica | password123 |

## 🎯 Escenarios de Testing

### **Escenario 1: Colaboración Básica**
1. **Login como**: `dr.garcia@qlinexa360.com`
2. **Crear caso clínico** para un paciente
3. **Agregar colaborador**: `dr.rodriguez@qlinexa360.com`
4. **Login como**: `dr.rodriguez@qlinexa360.com`
5. **Verificar acceso** al caso clínico
6. **Agregar consulta** al historial

### **Escenario 2: Colaboración Múltiple**
1. **Login como**: `dr.martinez@qlinexa360.com`
2. **Crear caso clínico** complejo
3. **Agregar múltiples colaboradores**:
   - `enfermera.gutierrez@qlinexa360.com`
   - `dr.lopez@qlinexa360.com`
   - `enfermera.silva@qlinexa360.com`
4. **Verificar edición colaborativa** entre todos

### **Escenario 3: Colaboración Interdisciplinaria**
1. **Login como**: `dr.perez@qlinexa360.com` (Pediatra)
2. **Crear caso pediátrico**
3. **Agregar colaboradores especializados**:
   - `enfermera.silva@qlinexa360.com` (Enfermería Pediátrica)
   - `dr.gonzalez@qlinexa360.com` (Neurólogo)
   - `enfermera.ramirez@qlinexa360.com` (Enfermería Intensiva)

### **Escenario 4: Colaboración Hospitalaria**
1. **Login como**: `dr.torres@qlinexa360.com` (Endocrinóloga)
2. **Crear caso de diabetes**
3. **Agregar equipo completo**:
   - `enfermera.cruz@qlinexa360.com` (Obstétrica)
   - `dr.vega@qlinexa360.com` (Urólogo)
   - `enfermera.mendoza@qlinexa360.com` (Quirúrgica)

## 🔄 Flujo de Testing Detallado

### **Paso 1: Preparación**
```bash
# Iniciar backend
cd backend
npm run dev

# Iniciar frontend (en otra terminal)
cd frontend
npm run dev
```

### **Paso 2: Login y Creación de Caso**
1. **Abrir navegador**: `http://localhost:5173`
2. **Login con**: `dr.garcia@qlinexa360.com` / `password123`
3. **Ir a**: "Pacientes" → "Nuevo Paciente"
4. **Crear paciente** con datos de prueba
5. **Ir a**: "Historial Clínico"
6. **Crear caso clínico** con diagnóstico inicial

### **Paso 3: Agregar Colaboradores**
1. **En el caso clínico**, hacer clic en botón "Colaborativo"
2. **Buscar colaboradores** por nombre o email
3. **Seleccionar** múltiples profesionales
4. **Confirmar** agregado de colaboradores

### **Paso 4: Testing de Colaboración**
1. **Login con otro usuario** (ej: `dr.rodriguez@qlinexa360.com`)
2. **Ir al mismo caso clínico**
3. **Verificar** que aparece como colaborador
4. **Agregar nueva consulta** al historial
5. **Verificar** que se registra correctamente

### **Paso 5: Verificar Restricciones**
1. **Login con usuario no colaborador** (ej: `dr.morales@qlinexa360.com`)
2. **Intentar acceder** al caso clínico
3. **Verificar** que no tiene acceso
4. **Verificar** que no aparece en lista de colaboradores

## 🧪 Casos de Prueba Específicos

### **Caso 1: Colaboración Cardiología + Enfermería**
- **Doctor principal**: `dr.garcia@qlinexa360.com` (Cardiólogo)
- **Colaboradores**: 
  - `enfermera.gutierrez@qlinexa360.com` (General)
  - `enfermera.ramirez@qlinexa360.com` (Intensiva)
- **Escenario**: Paciente con arritmia cardíaca

### **Caso 2: Colaboración Pediátrica Compleja**
- **Doctor principal**: `dr.perez@qlinexa360.com` (Pediatra)
- **Colaboradores**:
  - `enfermera.silva@qlinexa360.com` (Pediátrica)
  - `dr.gonzalez@qlinexa360.com` (Neurólogo)
  - `dr.sanchez@qlinexa360.com` (Oftalmólogo)
- **Escenario**: Niño con problemas neurológicos y visuales

### **Caso 3: Colaboración Obstétrica**
- **Doctor principal**: `dr.lopez@qlinexa360.com` (Ginecóloga)
- **Colaboradores**:
  - `enfermera.cruz@qlinexa360.com` (Obstétrica)
  - `dr.torres@qlinexa360.com` (Endocrinóloga)
- **Escenario**: Embarazo de alto riesgo con diabetes

## 🔍 Verificaciones a Realizar

### **Funcionalidad de Colaboración**
- ✅ [ ] Botón "Colaborativo" aparece en casos clínicos
- ✅ [ ] Búsqueda de colaboradores funciona
- ✅ [ ] Agregar colaboradores funciona
- ✅ [ ] Colaboradores pueden acceder al caso
- ✅ [ ] Colaboradores pueden agregar consultas
- ✅ [ ] Distinción visual entre consultas propias y de otros

### **Seguridad y Permisos**
- ✅ [ ] Usuarios no colaboradores no pueden acceder
- ✅ [ ] Solo el doctor principal puede agregar colaboradores
- ✅ [ ] Colaboradores no pueden agregar más colaboradores
- ✅ [ ] Rastreo correcto de autoría en consultas

### **UI/UX**
- ✅ [ ] Tooltip del botón colaborativo se muestra correctamente
- ✅ [ ] Búsqueda con autocompletado funciona
- ✅ [ ] Feedback visual con toasts
- ✅ [ ] Estados de carga apropiados
- ✅ [ ] Diseño responsive

## 📊 Métricas de Testing

### **Usuarios Creados**
- **Total**: 15 usuarios
- **Doctores**: 10 (diferentes especialidades)
- **Enfermeras**: 5 (diferentes especialidades)
- **Suscripciones**: Todas activas
- **Roles**: Todos DOCTOR (para colaboración)

### **Especialidades Cubiertas**
- **Médicas**: Cardiología, Dermatología, Ortopedia, Ginecología, Neurología, Pediatría, Oftalmología, Endocrinología, Urología, Psiquiatría
- **Enfermería**: General, Intensiva, Pediátrica, Quirúrgica, Obstétrica

## 🚀 Comandos para Testing

```bash
# 1. Iniciar backend
cd backend
npm run dev

# 2. Iniciar frontend (nueva terminal)
cd frontend
npm run dev

# 3. Crear usuarios de prueba (si es necesario)
cd backend
node scripts/createTestUsers.js
```

## 📝 Notas Importantes

1. **Todos los usuarios tienen rol DOCTOR** para poder colaborar
2. **Todas las suscripciones están activas** por 1 año
3. **Contraseña universal**: `password123`
4. **Emails siguen patrón**: `dr.nombre@qlinexa360.com` y `enfermera.nombre@qlinexa360.com`

---

## 🎉 ¡Listo para Testing!

Con estos **15 usuarios de prueba**, puedes realizar testing completo de:

- ✅ Colaboración entre doctores
- ✅ Colaboración entre doctores y enfermeras
- ✅ Colaboración interdisciplinaria
- ✅ Restricciones de acceso
- ✅ Rastreo de autoría
- ✅ UI/UX de la funcionalidad

¡Empieza con el **Escenario 1** y ve probando todos los casos! 🚀 