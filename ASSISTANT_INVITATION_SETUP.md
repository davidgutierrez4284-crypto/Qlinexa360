# Sistema de Invitación de Asistentes - Qlinexa360

## Descripción General

El sistema de invitación de asistentes permite a los doctores (Personal de la Salud) invitar a asistentes para que les ayuden con las tareas administrativas. Los asistentes reciben un email con un enlace para completar su registro y acceder a la plataforma.

## Estructura de la Base de Datos

### Modelo AssistantInvitation

```sql
model AssistantInvitation {
  id          String   @id @default(uuid())
  token       String   @unique
  email       String
  firstName   String
  lastName    String
  doctorId    String
  doctor      Doctor   @relation(fields: [doctorId], references: [id])
  status      String   @default("PENDING") // PENDING, COMPLETED, EXPIRED
  expiresAt   DateTime
  createdAt   DateTime @default(now())
  completedAt DateTime?

  @@map("assistant_invitations")
}
```

### Relación en el modelo Doctor

```sql
model Doctor {
  // ... otros campos
  assistantInvitations   AssistantInvitation[]
}
```

## Endpoints del Backend

### 1. Crear Invitación de Asistente
- **URL**: `POST /api/assistant-invitations/create`
- **Autenticación**: Requerida
- **Body**:
  ```json
  {
    "firstName": "string",
    "lastName": "string", 
    "email": "string"
  }
  ```
- **Respuesta**:
  ```json
  {
    "message": "Invitación enviada exitosamente",
    "invitation": {
      "id": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "expiresAt": "datetime"
    },
    "notifications": {
      "emailSent": true
    }
  }
  ```

### 2. Validar Token de Invitación
- **URL**: `GET /api/assistant-invitations/validate/:token`
- **Autenticación**: No requerida
- **Respuesta**:
  ```json
  {
    "invitation": {
      "id": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "doctorName": "string",
      "expiresAt": "datetime"
    }
  }
  ```

### 3. Completar Registro de Asistente
- **URL**: `POST /api/assistant-invitations/complete`
- **Autenticación**: No requerida
- **Body**:
  ```json
  {
    "token": "string",
    "password": "string"
  }
  ```
- **Respuesta**:
  ```json
  {
    "message": "Registro completado exitosamente",
    "user": {
      "id": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "role": "ASISTENTE"
    }
  }
  ```

### 4. Obtener Invitaciones del Doctor
- **URL**: `GET /api/assistant-invitations/doctor`
- **Autenticación**: Requerida
- **Respuesta**:
  ```json
  {
    "invitations": [
      {
        "id": "string",
        "email": "string",
        "firstName": "string",
        "lastName": "string",
        "status": "string",
        "createdAt": "datetime",
        "expiresAt": "datetime",
        "completedAt": "datetime"
      }
    ]
  }
  ```

## Componentes del Frontend

### 1. InviteAssistantModal
- **Ubicación**: `frontend/src/components/assistant/InviteAssistantModal.jsx`
- **Funcionalidad**: Modal para que el doctor invite a un asistente
- **Campos**: Nombre, Apellido, Email
- **Validaciones**: Campos requeridos, email válido

### 2. ActivateAssistantInvitation
- **Ubicación**: `frontend/src/pages/ActivateAssistantInvitation.jsx`
- **Ruta**: `/activate-assistant/:token`
- **Funcionalidad**: Página para que el asistente complete su registro
- **Campos**: Contraseña, Confirmar Contraseña
- **Validaciones**: Contraseñas coinciden, mínimo 6 caracteres

## Servicios de Notificación

### EmailService - sendAssistantInvitationEmail
- **Función**: Envía email de invitación al asistente
- **Asunto**: "Invitación para unirte como Asistente en Qlinexa360"
- **Contenido**: HTML con información del doctor y enlace de registro
- **Nota**: Incluye información sobre permisos y responsabilidades

### NotificationService - sendAssistantInvitation
- **Función**: Orquesta el envío de invitaciones
- **Retorna**: `{ emailSent: boolean }`

## Flujo de Usuario

### 1. Doctor Invita Asistente
1. El doctor accede a "Mi perfil"
2. Hace clic en "Invitar Asistente"
3. Completa el formulario (nombre, apellido, email)
4. Sistema envía email de invitación
5. Se crea registro en `AssistantInvitation`

### 2. Asistente Recibe Invitación
1. Asistente recibe email con enlace
2. Hace clic en el enlace
3. Sistema valida el token
4. Asistente completa formulario de contraseña
5. Sistema crea usuario con rol `ASISTENTE`
6. Sistema crea vínculo en `AsistenteDoctorVinculo`
7. Sistema marca invitación como `COMPLETED`

### 3. Gestión de Permisos
1. Doctor puede gestionar permisos del asistente
2. Asistente tiene acceso solo a secciones habilitadas
3. Todas las acciones quedan registradas con nombre del asistente

## Variables de Entorno Requeridas

```env
# Email Service (SendGrid, Mailgun, etc.)
EMAIL_API_KEY=your_email_api_key

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## Seguridad

### Tokens
- Tokens generados con `crypto.randomBytes(32)`
- Expiración de 7 días
- Tokens únicos por invitación

### Validaciones
- Verificación de email único
- Verificación de invitaciones pendientes
- Validación de expiración de tokens
- Verificación de contraseñas

### Logging
- Todas las acciones se registran con `securityLogger`
- Incluye información de usuario y contexto

## Próximos Pasos

### 1. Configuración de Credenciales
- [ ] Configurar credenciales de email (SendGrid, Mailgun, etc.)
- [ ] Probar envío de emails
- [ ] Configurar variables de entorno

### 2. Mejoras de Seguridad
- [ ] Implementar hash de contraseñas
- [ ] Agregar rate limiting
- [ ] Implementar validación de email más robusta

### 3. Funcionalidades Adicionales
- [ ] Sistema de permisos granular
- [ ] Historial de acciones del asistente
- [ ] Notificaciones de expiración
- [ ] Reenvío de invitaciones

### 4. Testing
- [ ] Tests unitarios para controladores
- [ ] Tests de integración para endpoints
- [ ] Tests de frontend para componentes
- [ ] Tests de flujo completo

## Notas de Implementación

### Base de Datos
- Ejecutar migración de Prisma para crear tabla `assistant_invitations`
- Verificar relaciones en modelo `Doctor`

### Backend
- Verificar que todas las rutas estén registradas en `index.ts`
- Confirmar que `NotificationService` esté configurado correctamente

### Frontend
- Verificar que las rutas estén registradas en `App.jsx`
- Confirmar que los componentes estén importados correctamente
- Probar flujo completo de invitación

## Troubleshooting

### Problemas Comunes

1. **Error de validación de token**
   - Verificar que el token existe en la base de datos
   - Confirmar que no ha expirado
   - Verificar que no ha sido usado

2. **Error de envío de email**
   - Verificar credenciales de email
   - Confirmar configuración de variables de entorno
   - Revisar logs del servicio de email

3. **Error de creación de usuario**
   - Verificar que el email no esté duplicado
   - Confirmar que el rol `ASISTENTE` existe
   - Revisar permisos de base de datos

### Logs Importantes
- `securityLogger.info()` para acciones exitosas
- `securityLogger.error()` para errores
- `securityLogger.warn()` para advertencias de configuración
