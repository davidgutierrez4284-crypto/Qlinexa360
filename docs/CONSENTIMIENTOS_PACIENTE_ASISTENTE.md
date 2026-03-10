# Consentimientos Legales - Pacientes, Asistentes y Doctores

## Resumen

Se implementó la captura de consentimientos legales (Aviso de Privacidad, Términos de Uso, Contrato de Uso de Plataforma y Firma Digital) para **nuevos** pacientes, asistentes y doctores.

**Orden de pasos:** Contraseña primero → Consentimientos después (pacientes/asistentes). Doctores firman en el mismo formulario de registro.

## Flujos

### Paciente (configura contraseña)
1. El doctor crea un paciente y se envía el email "Configura una contraseña"
2. El paciente hace clic en el enlace → `/reset-password?token=...`
3. **Paso 1:** Configura su contraseña
4. **Paso 2:** Firma los consentimientos legales (si es paciente nuevo)
5. Redirección a login

### Asistente (completar registro)
1. El doctor invita a un asistente y se envía el email "Completar Registro"
2. El asistente hace clic en el enlace → `/activate-assistant/:token`
3. **Paso 1:** Configura su contraseña
4. **Paso 2:** Firma los consentimientos legales
5. Redirección a login

## Base de datos

**Migración:** `20260225000000_add_consent_pdf_and_token_purpose`

- `ConsentHistory.pdfUrl` (nullable): URL del PDF firmado en S3
- `password_reset_tokens.purpose` (default: 'password_reset'): distingue "configura contraseña" (`patient_setup`) de "olvidé contraseña" (`password_reset`)

**Antes de desplegar:** Ejecutar la migración:
```bash
cd backend
npx prisma migrate deploy
```

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/consent/submit-after-setup` | Paciente: enviar consentimientos tras configurar contraseña |
| POST | `/api/consent/submit-assistant` | Asistente: enviar consentimientos tras completar registro |
| GET | `/api/consent/admin/:userId` | Admin: listar consentimientos de un usuario (auditoría) |
| GET | `/api/consent/doctor/patient/:patientId/aviso-privacidad` | Doctor: obtener Aviso de Privacidad firmado de su paciente |

## Almacenamiento de PDFs

- Los 3 documentos (Aviso, Términos, Contrato) se generan como PDF con firma, nombre, email y timestamp
- Se suben a S3 en `consent_documents/`
- Las URLs se guardan en `ConsentHistory.pdfUrl`

## Notificación a Legal

Cada vez que un nuevo paciente o asistente firma los consentimientos, se envía automáticamente un correo a **legal@qlinexa360.com** con:
- Nombre del usuario
- Email del usuario
- Rol (PATIENT o ASISTENTE)
- Los 3 PDFs adjuntos: Aviso de Privacidad, Términos de Uso, Contrato de Uso de Plataforma

## Datos existentes

- **No se borra ninguna información**
- Los registros actuales en `ConsentHistory` permanecen (pdfUrl será NULL para los existentes)
- Los tokens existentes en `password_reset_tokens` tendrán `purpose = 'password_reset'` por defecto
