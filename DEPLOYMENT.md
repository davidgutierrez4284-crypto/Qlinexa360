# Guía de Deployment a Producción - Qlinexa360

## Pre-deployment checklist

### 1. Verificar builds locales

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

### 2. Migraciones de base de datos (si hay nuevas)

```bash
cd backend
npm run db:migrate
```

### 3. Actualizar etiquetas de Pediatría (nuevo en este release)

Si ya tienes datos en producción, ejecuta el script para actualizar las etiquetas de unidades de medida:

```bash
cd backend
node scripts/update-pediatrics-field-labels.js
```

### 4. Variables de entorno

Asegúrate de tener configuradas en producción:

- `DATABASE_URL` - PostgreSQL
- `JWT_SECRET`
- Variables de AWS S3 (si aplica)
- Variables de email (Nodemailer)
- Cualquier otra variable usada en `.env.example`

---

## Pasos de deployment

### Backend (Node.js/Express)

1. Subir código al servidor
2. `npm install --production`
3. `npm run build`
4. `npm run db:migrate` (si hay migraciones pendientes)
5. Reiniciar el proceso (PM2, systemd, etc.)

### Frontend (Vite/React)

1. `npm run build` genera la carpeta `dist/`
2. Desplegar el contenido de `dist/` al servidor web (Nginx, Apache, CDN, etc.)
3. Configurar el proxy/rewrite para que `/api` apunte al backend

---

## Cambios incluidos en este release

- **Header**: Logo más grande en móvil, link a /benefits cuando no logueado
- **Consultas**: Edición de consultas guardadas (guardados parciales)
- **loadMedicalRecords**: Corrección del error "loadMedicalRecords is not defined"
- **Pediatría**: Unidades en etiquetas (Peso kg, Peso al nacer g, etc.)
- **Edad**: Campo homologado en años y meses con tooltip explicativo

---

## Rollback

En caso de problemas, revertir al commit anterior y re-desplegar.
