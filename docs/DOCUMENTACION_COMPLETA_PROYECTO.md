# Documentación Completa del Proyecto Qlinexa360 / Medilink360

**Versión:** 1.0  
**Última actualización:** Febrero 2026  
**Estado:** Producción  
**Dominio:** qlinexa360.com / api.qlinexa360.com

---

## ⚠️ IMPORTANTE – PLATAFORMA DE SALUD

Esta plataforma es utilizada por **profesionales de la salud** y **pacientes**. Una gestión incorrecta puede afectar vidas. Toda modificación debe:

- Probarse en entorno de desarrollo antes de desplegar
- Verificar que no se rompan flujos críticos (consultas, recetas, citas)
- Respetar permisos por rol y confidencialidad de datos médicos

---

## 1. ARQUITECTURA GENERAL

### 1.1 Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | React 18, Vite, TailwindCSS, React Router, Axios |
| **Backend** | Node.js, Express, TypeScript |
| **Base de datos** | PostgreSQL (Prisma ORM) |
| **Almacenamiento** | AWS S3 (archivos, PDFs, fotos de perfil) |
| **Infraestructura** | AWS ECS (backend), S3 + CloudFront (frontend) |
| **Autenticación** | JWT (jsonwebtoken), bcrypt para contraseñas |
| **Pagos** | PayPal (suscripciones) |
| **Email** | Nodemailer (SMTP) |
| **Calendarios** | Google Calendar, Outlook, Apple, Notion (OAuth2) |

### 1.2 Estructura del Proyecto

```
medilink360/
├── backend/                 # API Node/Express
│   ├── src/
│   │   ├── config/          # env, database
│   │   ├── controllers/     # Lógica de negocio
│   │   ├── middlewares/     # auth, assistant, subscription, upload
│   │   ├── routes/          # Definición de rutas API
│   │   ├── services/        # notification, schedule, recipePdf, etc.
│   │   └── utils/           # file, error, logger, encryption
│   ├── prisma/
│   │   ├── schema.prisma    # Modelos de datos
│   │   └── migrations/
│   └── dist/                # Compilado (npm run build)
├── frontend/                # React SPA
│   ├── src/
│   │   ├── components/      # Layout, medical, common, assistant
│   │   ├── context/         # AuthContext, SelectedDoctorContext, SubscriptionContext
│   │   ├── pages/           # Páginas principales
│   │   ├── hooks/
│   │   └── utils/           # api.js (getApiUrl, getApiHeaders)
│   └── dist/                # Build (npm run build)
├── aws/                     # Configuración AWS (ECS, S3, IAM)
├── docs/                    # Documentación
└── scripts/                # Scripts de despliegue
```

### 1.3 Flujo de Datos

1. **Frontend** → Vite dev o build estático en S3/CloudFront
2. **API** → `https://api.qlinexa360.com` (ECS)
3. **Base de datos** → PostgreSQL (RDS o externo)
4. **Archivos** → S3 bucket `qlinexa360` (recipes/, doctor-profile-photos/, etc.)
5. **Asistentes** → Header `X-Selected-Doctor-Id` para operaciones en nombre del doctor

---

## 2. ROLES Y PERMISOS

### 2.1 Roles Definidos

| Rol | Descripción | Acceso principal |
|-----|-------------|------------------|
| **DOCTOR** | Profesional de la salud titular | Pacientes, consultas, recetas, calendario, facturación, configuración |
| **ASISTENTE** | Personal de apoyo del doctor | Según permisos por módulo (vinculado a uno o más doctores) |
| **PATIENT** | Paciente | Historial propio, citas propias, documentos compartidos |
| **ADMIN** | Administrador de plataforma | Reportes, seed, gestión global |

### 2.2 Permisos del ASISTENTE (AsistenteDoctorVinculo)

El asistente está vinculado a uno o más doctores. Por cada vínculo tiene:

| Permiso | Campo en BD | Módulo |
|---------|-------------|--------|
| Citas | `permisosCitas` | Calendario, citas, confirmaciones, lista de espera, cancelaciones |
| Historial clínico | `permisosHistorial` | Mis Pacientes, historial, consultas |
| Recetas | `permisosRecetas` | Sistema de recetas médicas |
| Notas | `permisosNotas` | Notas clínicas |
| Estudios | `permisosEstudios` | Estudios y documentos |
| Evolución visual | `permisosEvolucion` | Evolución del paciente |
| Facturación | `permisosFacturacion` | Facturación |

**Header obligatorio para ASISTENTE:** `X-Selected-Doctor-Id` (ID del doctor seleccionado en el selector del header).

### 2.3 Trabajo Colaborativo (Entre Doctores)

- **PadecimientoDoctorColaborador**: Un doctor puede invitar a otro doctor como colaborador de un caso clínico específico (padecimiento).
- **Colaboradores** pueden ver consultas, archivos adjuntos y datos del caso compartido.
- Los archivos adjuntos a consultas son accesibles tanto por el doctor titular como por los colaboradores (ver `doctorCanAccessFileAsCollaborator` en file.controller.ts).

---

## 3. SEGURIDAD

### 3.1 Autenticación

- **JWT** en header `Authorization: Bearer <token>`
- Expiración: 24h (configurable en `JWT_EXPIRES_IN`)
- 2FA opcional (Speakeasy TOTP)
- Recuperación de contraseña por token con expiración

### 3.2 Autorización

- `authMiddleware(['DOCTOR', 'ASISTENTE'])` – solo esos roles
- `AssistantMiddleware.checkAssistantModulePermission('prescriptions')` – verifica permiso del módulo
- `subscriptionAccess('edit')` – verifica suscripción activa para operaciones de escritura

### 3.3 Archivos y S3

- **URLs firmadas** (presigned) para acceso temporal a S3
- No se exponen URLs directas de S3
- Validación de permisos antes de generar URL: titular, colaborador, asistente (con doctor seleccionado)

### 3.4 Datos Sensibles

- Contraseñas hasheadas con bcrypt
- `DATA_ENCRYPTION_KEY` para cifrado de datos sensibles
- Variables sensibles en AWS Secrets Manager (producción)

### 3.5 Rate Limiting y Helmet

- express-rate-limit para limitar peticiones
- Helmet para headers HTTP seguros

---

## 4. MÓDULOS PRINCIPALES

### 4.1 Pacientes (Mis Pacientes)

- **Rutas:** `/api/doctors`, `/api/patients`
- **Funcionalidad:** CRUD pacientes, vinculación doctor-paciente, datos adicionales (RFC, contacto emergencia, etc.)
- **Asistente:** Requiere `permisosHistorial` y `X-Selected-Doctor-Id`

### 4.2 Historial Clínico / Consultas

- **Rutas:** `/api/consultations`, `/api/clinical-cases`
- **Modelos:** MedicalRecord, ClinicalCase, Link, File
- **Funcionalidad:** Consultas básicas, adjuntos (archivos, fotos, enlaces), evolución clínica
- **Trabajo colaborativo:** Colaboradores acceden a archivos vía `doctorCanAccessFileAsCollaborator`

### 4.3 Recetas Médicas

- **Rutas:** `/api/recipes`
- **Modelo:** RecetaMedica
- **Funcionalidad:** Crear receta, generar PDF (Puppeteer/Chromium), enviar por email al paciente
- **PDF público:** `GET /api/recipes/:id/pdf-view?temp=<hash>&t=<timestamp>` – válido 7 días
- **Asistente:** Requiere `permisosRecetas`, envía `X-Selected-Doctor-Id` en Prescriptions.jsx

### 4.4 Calendario

- **Rutas:** `/api/calendar`, `/api/schedule`, `/api/agenda-pacientes`, `/api/appointment-confirmations`
- **Funcionalidad:**
  - Citas internas
  - Configuración de horarios (duración, buffer, disponibilidad semanal)
  - Configuración de recordatorios
  - Agenda compartida (link público para que pacientes agenden)
  - Confirmaciones, lista de espera, cancelaciones
- **Asistente:** Horarios y recordatorios usan `X-Selected-Doctor-Id` para actualizar la config del doctor

### 4.5 Facturación

- **Rutas:** `/api/invoices`, `/api/subscription`
- **PayPal:** Suscripciones, webhooks
- **Asistente:** Requiere `permisosFacturacion`

### 4.6 Notificaciones

- **Rutas:** `/api/notifications`
- **Funcionalidad:** Notificaciones internas (campanita), emails, WhatsApp (recordatorios)

---

## 5. VARIABLES DE ENTORNO CRÍTICAS

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | Conexión PostgreSQL |
| `JWT_SECRET` | Firma de tokens |
| `AWS_S3_BUCKET_NAME` | Bucket S3 |
| `AWS_REGION` | Región AWS |
| `BASE_URL` | URL de la API (ej. https://api.qlinexa360.com) |
| `FRONTEND_URL` | URL del frontend |
| `SMTP_*` | Envío de emails |
| `ADMIN_REPORT_TOKEN` | Token para reportes admin |
| `PAYPAL_*` | Integración PayPal |

---

## 6. DESPLIEGUE

### Backend (ECS)

1. `npm run build` en backend
2. Crear imagen Docker, subir a ECR
3. Actualizar servicio ECS (Force new deployment)

### Frontend

1. `npm run build` en frontend
2. `aws s3 sync dist/ s3://qlinexa360/` (sin `--delete` para no borrar archivos de usuario)
3. Invalidar caché CloudFront si aplica

### Scripts de referencia

- `scripts/deploy-backend-ecr.ps1`
- `scripts/deploy-ecs-service.ps1`
- `scripts/deploy-frontend-s3.ps1`

---

## 7. ARCHIVOS CLAVE PARA CONTEXTO

| Archivo | Propósito |
|---------|-----------|
| `backend/prisma/schema.prisma` | Modelos de datos |
| `backend/src/routes/index.ts` | Rutas API |
| `backend/src/middlewares/auth.middleware.ts` | Autenticación JWT |
| `backend/src/middlewares/assistant.middleware.ts` | Permisos asistente |
| `frontend/src/utils/api.js` | getApiUrl, getApiHeaders (incluye X-Selected-Doctor-Id) |
| `frontend/src/context/SelectedDoctorContext.jsx` | Estado doctor seleccionado (asistentes) |

---

## 8. CONSIDERACIONES PARA IA / RETOMAR TRABAJO

1. **Asistentes** siempre deben enviar `X-Selected-Doctor-Id` en peticiones que afecten datos del doctor.
2. **Trabajo colaborativo** permite a doctores colaboradores ver archivos de consultas compartidas.
3. **Recetas PDF** usan hash + timestamp; validez 7 días para el link del email.
4. **Configuración de horarios** usa `??` (no `||`) para preservar `bufferTime: 0` (Sin buffer).
5. **specialization** en DoctorPatient puede ser null; usar `?? 'General'` al crear.
