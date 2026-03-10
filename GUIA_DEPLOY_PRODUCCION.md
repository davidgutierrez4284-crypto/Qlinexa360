# Guía paso a paso: Desplegar cambios a PRODUCCIÓN

Esta guía cubre el despliegue de los cambios recientes: formularios ampliados y correcciones en el formulario de consulta básica.

---

## Resumen de cambios a desplegar

- **Backend**: Formularios de especialidad ampliados a ~20 campos (Psiquiatría, Radiología, Traumatología, Odontología, Cardiología, etc.)
- **Frontend**: Corrección de saltos al escribir en formularios (BasicConsultationForm)
- **Seed**: Nuevas plantillas de formularios que deben cargarse en la base de datos de producción

---

## PASO 1: Verificar que todo funciona en local

Antes de desplegar, ejecuta en tu máquina:

```powershell
# En la raíz del proyecto
cd e:\proyectos\medilink360

# Backend: probar el seed de formularios (usa tu .env local)
cd backend
npm run db:seed:forms
```

Deberías ver mensajes como `✅ Creada: [nombre del formulario]` para cada especialidad.

```powershell
# Volver a la raíz y probar frontend + backend
cd ..
# Iniciar backend y frontend según tu flujo habitual
```

---

## PASO 2: Subir el código a Git

```powershell
cd e:\proyectos\medilink360

git status
git add .
git commit -m "feat: ampliar formularios de especialidad a ~20 campos y corregir saltos en BasicConsultationForm"
git push origin main
```

*(Ajusta `main` si tu rama principal tiene otro nombre)*

---

## PASO 3: Desplegar el backend a producción

Según tu infraestructura (ECS en AWS):

- Si usas **CI/CD** (GitHub Actions, CodePipeline, etc.): el push suele disparar el deploy automáticamente.
- Si es **manual**: despliega la nueva imagen/contenedor según tu proceso habitual.

**Importante**: El backend debe estar desplegado **antes** de ejecutar el seed, para que el código del script esté actualizado en el servidor.

---

## PASO 4: Ejecutar el seed de formularios en producción

Tienes **dos opciones** según cómo accedas a producción:

### Opción A: Desde tu PC (conectándote a la BD de producción)

1. Obtén la `DATABASE_URL` de producción (desde AWS Secrets Manager o tu gestor de secretos).

2. Ejecuta el seed apuntando a producción:

```powershell
cd e:\proyectos\medilink360\backend

# Windows PowerShell - establecer variable solo para esta sesión
$env:DATABASE_URL = "postgresql://usuario:contraseña@host:5432/nombre_db"

npm run db:seed:forms
```

3. Verifica la salida: deben aparecer mensajes `✅ Creada:` para cada formulario.

4. **Borra la variable** al terminar (o cierra la terminal):

```powershell
Remove-Item Env:DATABASE_URL
```

---

### Opción B: Desde el servidor de producción (SSH o ECS Exec)

1. Conéctate al servidor donde corre el backend (o al contenedor ECS):

```bash
# Ejemplo SSH
ssh usuario@tu-servidor

# O ECS Exec (si usas AWS)
aws ecs execute-command --cluster nombre-cluster --task id-tarea --container nombre-contenedor --interactive --command "/bin/bash"
```

2. Navega al directorio del backend y ejecuta:

```bash
cd /ruta/al/backend   # Ajusta según tu estructura
npm run db:seed:forms
```

La variable `DATABASE_URL` ya debe estar configurada en el entorno de producción.

---

## PASO 5: Desplegar el frontend

Si el frontend está en Vercel, Netlify u otro:

- Con **CI/CD**: el push suele desplegar automáticamente.
- **Manual**: ejecuta el deploy según tu plataforma (ej. `vercel --prod`).

---

## PASO 6: Verificación en producción

1. **Formularios**:
   - Entra a una consulta y selecciona "Formularios especiales".
   - Comprueba que aparecen Heridas, Quemaduras, Estomas y las especialidades ampliadas (Psiquiatría, Radiología, etc.) con más campos.

2. **Formulario de consulta básica**:
   - Crea o edita una consulta y escribe en Motivo, Notas o Etiquetas.
   - Verifica que ya no hay saltos de pantalla al escribir.

---

## Resumen rápido (checklist)

- [ ] Paso 1: Probar `npm run db:seed:forms` en local
- [ ] Paso 2: `git add`, `commit`, `push`
- [ ] Paso 3: Desplegar backend (CI/CD o manual)
- [ ] Paso 4: Ejecutar `npm run db:seed:forms` en producción (Opción A o B)
- [ ] Paso 5: Desplegar frontend
- [ ] Paso 6: Verificar formularios y consulta básica en producción

---

## Notas importantes

- El script `db:seed:forms` **elimina y recrea** todas las plantillas de especialidad (`FormTemplate`). Los formularios personalizados de doctores (`DoctorFormTemplate`) **no se modifican**.
- Nunca expongas `DATABASE_URL` de producción en logs ni en el código.
- Si usas ECS sin SSH, la Opción A (ejecutar desde tu PC con `DATABASE_URL` de prod) suele ser la más sencilla.
