# Cargar formularios de especialidad en PRODUCCIÓN

Los formularios **Evaluación de Heridas**, **Evaluación de Quemaduras** y **Evaluación de Estomas** (junto con el resto de plantillas) están definidos en el código pero deben cargarse en la base de datos de producción.

## Pasos para cargar en producción

1. **Conectarse al servidor de producción** donde está el backend.

2. **Configurar la variable de entorno** `DATABASE_URL` apuntando a la base de datos de producción:
   ```bash
   export DATABASE_URL="postgresql://usuario:contraseña@host:5432/nombre_db"
   ```

3. **Ejecutar el script de seed de formularios**:
   ```bash
   cd backend
   npm run db:seed:forms
   ```

4. **Verificar** que el script muestre:
   - `✅ Creada: Evaluación de Heridas`
   - `✅ Creada: Evaluación de Quemaduras`
   - `✅ Creada: Evaluación de Estomas`
   - Y el resto de plantillas.

## Importante

- El script **elimina todas las plantillas existentes** y las recrea con los datos del archivo `scripts/seed-form-templates-only.js`.
- Si hay formularios personalizados creados por doctores, estos **no se ven afectados** (son `DoctorFormTemplate`, distintos de `FormTemplate`).
- Las plantillas de especialidad (`FormTemplate`) son las que aparecen en "Formularios especiales" al crear una consulta.

## Formularios incluidos

Entre otros, el seed carga:
- Evaluación de Heridas
- Evaluación de Quemaduras
- Evaluación de Estomas
- Datos médicos generales
- Esquema de vacunación
- Formularios de laboratorio (orina, biometría, química, etc.)
- Y todas las especialidades médicas estándar.
