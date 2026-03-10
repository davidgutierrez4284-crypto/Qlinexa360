# TODO List - Qlinexa360 Platform

## ✅ COMPLETADAS

### Sistema de Confirmación de Citas
- [x] Implementar backend del sistema de confirmación de citas
- [x] Crear migración de base de datos para confirmaciones
- [x] Crear rutas API para confirmaciones de citas
- [x] Implementar servicio de emails de confirmación
- [x] Crear componente Dashboard de Confirmaciones
- [x] Crear componente de gestión de Lista de Espera
- [x] Crear página de confirmación para pacientes
- [x] Agregar rutas del frontend para confirmaciones
- [x] Integrar componentes en la página de perfil del doctor
- [x] Corregir componentes para evitar loading infinito
- [x] Reorganizar interfaz: mover funcionalidades de calendario a sección "Calendario"

### Funcionalidades Principales
- [x] Sistema de invitaciones por email (pacientes y asistentes)
- [x] Registro de pacientes y asistentes
- [x] Sistema de password reset
- [x] Integración de calendarios externos (Google, Outlook)
- [x] Configuración de agenda (Calendly-like)
- [x] Sistema de recordatorios de citas
- [x] Envío de recetas por email

## 🔄 EN PROGRESO

## 📋 PENDIENTES

### Sistema de Confirmación de Citas
- [ ] Probar el sistema completo de confirmaciones
- [ ] Implementar endpoints reales de la API
- [ ] Conectar con base de datos real

### Funcionalidades Adicionales
- [ ] Implementar límite de 20 archivos por doctor en "Zona de Estudio"
- [ ] Implementar PWA icon para www.qlinexa360.com
- [ ] Corregir typo "Diabebets" a "Diabetes"
- [ ] Implementar renombrado de casos clínicos
- [ ] Implementar eliminación de casos clínicos (solo si no hay consultas)

### Mejoras de UI/UX
- [ ] Mostrar doctor invitador como primera opción en búsqueda
- [ ] Mejorar diseño de formularios de registro
- [ ] Optimizar experiencia móvil

## 🐛 PROBLEMAS IDENTIFICADOS

### Resueltos
- [x] Error EADDRINUSE en puerto 3000
- [x] Emails de invitación no se enviaban
- [x] Componentes de confirmación en loading infinito
- [x] Errores de TypeScript en backend
- [x] Falta de coherencia en organización de funcionalidades de calendario

### Por Resolver
- [ ] Configuración de Apple Calendar y Notion Calendar
- [ ] Backend para ReminderConfig (reminder24h y reminder4h)
