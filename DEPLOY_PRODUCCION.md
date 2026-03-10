# Guía de despliegue a producción - Qlinexa360

## Estado actual

- **Backend**: Compilado correctamente (`backend/dist/`)
- **Frontend**: Compilado correctamente (`frontend/dist/`)

## Pasos para subir a producción

### 1. Subir cambios a Git (si usas Git para deploy)

```bash
cd e:\proyectos\medilink360

git add .
git status
git commit -m "feat: fecha histórica en consultas, orden cronológico, corrección saltos en formularios"
git push origin main
```

> Si tu rama principal es `master`, usa `git push origin master`.

### 2. Si usas despliegue automático (Vercel, Netlify, etc.)

- El `git push` suele disparar el deploy automáticamente.
- Asegúrate de que la configuración de build apunte a:
  - **Frontend**: `frontend` como directorio raíz, comando `npm run build`, carpeta de salida `dist`
  - **Backend**: `backend` como directorio raíz, comando `npm run build`, ejecutar `node dist/server.js`

### 3. Si despliegas manualmente

**Frontend (qlinexa360.com):**
- Sube el contenido de `frontend/dist/` al servidor/hosting del frontend.
- La carpeta `dist` incluye `index.html` y la carpeta `assets/`.

**Backend (api.qlinexa360.com):**
- Sube la carpeta `backend/dist/` y `backend/node_modules/` (o ejecuta `npm install --production` en el servidor).
- Ejecuta `npm run db:migrate` si hay migraciones de Prisma.
- Reinicia el proceso del backend (PM2, systemd, etc.).

### 4. Migraciones de base de datos

Si hay cambios en el esquema de Prisma:

```bash
cd backend
npm run db:migrate
```

> En este despliegue **no hay migraciones nuevas**; solo cambios de lógica.

## Cambios incluidos en este deploy

1. **Fecha histórica en consultas**: La fecha seleccionada en el formulario se guarda y usa correctamente.
2. **Orden cronológico**: Consultas y fotos de evolución visual ordenadas por fecha de consulta.
3. **Reducción de saltos en formularios**: Debounce, `overflow-anchor: none` y `contain: layout` para evitar saltos al escribir.

## Verificación post-deploy

1. Crear una consulta con fecha pasada (ej. 2024) y comprobar que se guarda con esa fecha.
2. Verificar que el historial de consultas y evolución visual se muestran en orden cronológico.
3. Escribir en los formularios y comprobar que la pantalla no salta.
