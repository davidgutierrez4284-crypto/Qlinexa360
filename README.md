 cree el archivo del middleware automáticamente y lo integre en un endpoint de ejemplo en tu backend# Medilink360

Plataforma de gestión Doctor-Paciente que facilita la comunicación y gestión de información médica de manera segura y eficiente.

## Descripción

Medilink360 es una plataforma integral que conecta doctores y pacientes, proporcionando herramientas para la gestión de información médica, citas, recetas y documentación, todo esto manteniendo los más altos estándares de seguridad y privacidad.

## Características Principales

- Sistema de roles (Admin, Doctor, Paciente)
- Gestión segura de información médica
- Sistema de consentimientos y contratos legales
- Facturación y suscripciones
- Relación doctor-paciente
- Sistema de notificaciones y recordatorios
- Panel de administración
- Integración con WhatsApp (opcional)

## Tecnologías Utilizadas

### Frontend
- React
- TypeScript
- Material-UI
- React Router
- Redux Toolkit

### Backend
- Node.js
- Express
- TypeScript
- Prisma (ORM)
- PostgreSQL
- JWT para autenticación

### Infraestructura
- AWS S3 para almacenamiento de documentos
- PayPal para procesamiento de pagos
- Sistema de notificaciones por email y WhatsApp

## Requisitos del Sistema

- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm >= 8.x

## Instalación

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

## Configuración

1. Crear archivo `.env` en el directorio backend basado en `.env.example`
2. Configurar las variables de entorno necesarias
3. Ejecutar las migraciones de la base de datos

## Desarrollo

### Backend
```bash
cd backend
npm run dev
```

### Frontend
```bash
cd frontend
npm start
```

## Licencia

Todos los derechos reservados © Medilink360 

model DoctorPatient {
  id                String   @id @default(uuid())
  doctorId          String
  patientId         String
  doctor            Doctor   @relation(fields: [doctorId], references: [id])
  patient           Patient  @relation(fields: [patientId], references: [id])
  status            String   // activo, alta, referido
  referredByDoctorId String? // doctor que refiere (opcional)
  createdAt         DateTime @default(now())

  @@unique([doctorId, patientId])
} 

model Appointment {
  id          String   @id @default(uuid())
  doctorId    String
  patientId   String
  doctor      Doctor   @relation(fields: [doctorId], references: [id])
  patient     Patient  @relation(fields: [patientId], references: [id])
  date        DateTime
  status      String   // pendiente, confirmada, cancelada, etc.
  notes       String?
  createdAt   DateTime @default(now())
} 

model PrescriptionTemplate {
  id        String   @id @default(uuid())
  doctorId  String
  doctor    Doctor   @relation(fields: [doctorId], references: [id])
  content   String
  createdAt DateTime @default(now())
}

model Prescription {
  id              String   @id @default(uuid())
  appointmentId   String
  doctorId        String
  patientId       String
  doctor          Doctor   @relation(fields: [doctorId], references: [id])
  patient         Patient  @relation(fields: [patientId], references: [id])
  appointment     Appointment @relation(fields: [appointmentId], references: [id])
  content         String
  createdAt       DateTime @default(now())
} 