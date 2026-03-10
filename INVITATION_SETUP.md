# Sistema de Invitaciones - Configuración

## Descripción
El sistema de invitaciones permite a los doctores invitar pacientes a la plataforma Qlinexa360 mediante WhatsApp y email. Los pacientes reciben un enlace único para completar su registro.

## Flujo del Sistema

### 1. Doctor invita paciente
- Doctor ingresa datos del paciente (nombre, apellidos, email, teléfono)
- Sistema genera token único de invitación
- Sistema envía notificaciones por WhatsApp y email

### 2. Paciente completa registro
- Paciente hace clic en el enlace de invitación
- Sistema valida el token
- Paciente completa formulario con contraseña y datos adicionales
- Sistema crea usuario y perfil de paciente
- Paciente puede acceder inmediatamente

## Configuración de Credenciales

### Variables de Entorno Requeridas

Agregar al archivo `.env` del backend:

```env
# WhatsApp Business API
WHATSAPP_API_KEY=tu_api_key_de_whatsapp
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id

# Email Service (SendGrid)
EMAIL_API_KEY=tu_api_key_de_sendgrid
SENDGRID_FROM_EMAIL=noreply@qlinexa360.com

# Frontend URL
FRONTEND_URL=https://tu-dominio.com
```

### 1. Configuración de WhatsApp Business API

#### Opción A: WhatsApp Business API Cloud
1. Crear cuenta en [Meta for Developers](https://developers.facebook.com/)
2. Crear aplicación para WhatsApp Business API
3. Obtener:
   - **Access Token** (WHATSAPP_API_KEY)
   - **Phone Number ID** (WHATSAPP_PHONE_NUMBER_ID)

#### Opción B: Servicios de terceros
- **Twilio WhatsApp API**
- **MessageBird**
- **360dialog**

### 2. Configuración de Email

#### Opción A: SendGrid (Recomendado)
1. Crear cuenta en [SendGrid](https://sendgrid.com/)
2. Verificar dominio de email
3. Obtener API Key
4. Configurar `SENDGRID_FROM_EMAIL`

#### Opción B: Otros servicios
- **Mailgun**
- **Amazon SES**
- **Postmark**

## Estructura de Base de Datos

### Nueva tabla: `patient_invitations`

```sql
CREATE TABLE patient_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  status VARCHAR(50) DEFAULT 'PENDING',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

## Endpoints del Backend

### Crear invitación
```
POST /api/invitations/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Juan",
  "lastName": "Pérez",
  "email": "juan@ejemplo.com",
  "phone": "5512345678",
  "doctorId": "uuid-del-doctor"
}
```

### Validar token
```
GET /api/invitations/validate/:token
```

### Completar registro
```
POST /api/invitations/complete
Content-Type: application/json

{
  "token": "token-de-invitacion",
  "password": "contraseña-segura",
  "additionalData": {
    "birthDate": "1990-01-01",
    "gender": "MALE",
    "bloodType": "O+",
    "allergies": "Penicilina",
    "chronicDiseases": "Diabetes"
  }
}
```

## Frontend

### Rutas
- `/activate/:token` - Página para completar registro

### Componentes
- `ActivateInvitation.jsx` - Página de activación
- `InvitePatientModal.jsx` - Modal para invitar pacientes

## Mensajes de Notificación

### WhatsApp
```
Hola! El Dr. [Nombre Doctor] te ha registrado en Qlinexa360. 

Para completar tu registro y acceder a tu historial médico, haz clic en este enlace:
[URL_DE_INVITACION]

Este enlace expira en 7 días.

Saludos,
Equipo Qlinexa360
```

### Email
- Asunto: "Invitación para registrarte en Qlinexa360"
- Contenido HTML con diseño profesional
- Botón de acción para completar registro

## Seguridad

### Tokens de Invitación
- Generados con `crypto.randomBytes(32)`
- Expiran en 7 días
- Únicos por invitación
- Invalidados después del uso

### Validaciones
- Email único por paciente
- Contraseña mínima 6 caracteres
- Validación de formato de email
- Verificación de doctor autorizado

## Testing

### Sin credenciales
El sistema funciona en modo simulación:
- WhatsApp: Log en consola
- Email: Log en consola
- No se envían notificaciones reales

### Con credenciales
- Notificaciones reales enviadas
- Logs de éxito/error
- Métricas de envío

## Monitoreo

### Logs
- `securityLogger.info()` para invitaciones exitosas
- `securityLogger.error()` para errores
- `securityLogger.warn()` para credenciales faltantes

### Métricas sugeridas
- Tasa de aceptación de invitaciones
- Tiempo promedio de registro
- Errores de envío por canal

## Próximos Pasos

1. **Obtener credenciales** de WhatsApp Business API y SendGrid
2. **Configurar variables de entorno** en el backend
3. **Probar envío** de notificaciones
4. **Implementar métricas** de uso
5. **Optimizar plantillas** de mensajes
6. **Agregar notificaciones push** (opcional)

## Soporte

Para problemas técnicos:
- Revisar logs del backend
- Verificar credenciales
- Comprobar formato de teléfonos (WhatsApp requiere formato internacional)
- Validar dominio de email (SendGrid)
