# Módulo de recetas: configuración, modelo de datos y diseño del PDF (Qlinexa360)

Documento de referencia para replicar en **Paw Care Plus** el módulo de recetas médicas: campos configurables del profesional, entidades de receta, variables del motor de plantillas (Handlebars) y textos legales del PDF.

**Archivos fuente en este proyecto:**

| Archivo | Uso |
|---------|-----|
| `backend/prisma/schema.prisma` | Modelos `Doctor`, `RecetaMedica`, detalle de medicamentos, estudios |
| `backend/src/services/recipePdf.service.ts` | Carga de datos, QR, logo en base64, compilación HTML → PDF (Puppeteer) |
| `backend/src/templates/recipe-template.html` | Layout y textos legales |
| `backend/src/controllers/doctorProfile.controller.ts` | API `GET/PATCH` configuración recetas, vista previa |
| `frontend/src/components/medical/DoctorProfileConfig.jsx` | Formulario “Configuración del Perfil para Recetas” |

---

## 1. Configuración del profesional (impacta el PDF)

Estos campos viven en el modelo **`Doctor`** y se editan en la UI **Configuración del Perfil para Recetas** (`DoctorProfileConfig`). El endpoint de lectura expone `GET /api/doctor-profile/config`; la actualización usa el cuerpo del `PATCH` equivalente (mismos nombres de campo).

### 1.1 Tabla de campos

| Campo (API / Prisma) | Tipo | Uso en el PDF |
|----------------------|------|----------------|
| `user.firstName`, `user.lastName` | vía relación `User` | Nombre del profesional (cabecera “Emitido por”, firma) |
| `professionalTitle` | `String` | Título (ej. Dr., Dra.) junto al nombre |
| `specialization` | `String` | Especialidad junto al título |
| `consultorioDireccion` | `String?` | Bloque “Consultorio:” bajo el nombre |
| `consultorioTelefono` | `String?` | Teléfono del consultorio |
| `certificadoProfesional` | `String?` | Certificaciones: cédula profesional |
| `certificadoEspecialidad` | `String?` | Certificado de especialidad |
| `certificadoMaestria` | `String?` | Certificado de maestría |
| `universidad` | `String?` | Línea opcional “Universidad:” (solo si hay valor) |
| `logoUrl` | `String?` | Imagen del consultorio; en PDF se convierte a **data URL base64** (HTTP o ruta local `uploads/...`) |
| `primaryColor` | `String?` | Borde del logo, color de títulos de medicamentos; default servicio `#2563eb` |
| `secondaryColor` | `String?` | Reservado en modelo; en plantilla actual el acento principal es azul fijo en varios bloques |
| `socialMediaFacebook` | `String?` | URL; icono SVG en pie si existe |
| `socialMediaInstagram` | `String?` | Idem |
| `socialMediaX` | `String?` | Idem (X/Twitter) |
| `socialMediaOther` | `String?` | Idem (web u otra red); icono “globo” |

**Derivado en el servicio PDF (no es columna en BD):**

| Campo Handlebars | Origen |
|------------------|--------|
| `doctor.hasSocialMedia` | `true` si cualquiera de las cuatro URLs de redes está definida |

**Campos del doctor no usados directamente en esta plantilla** (pero existen en registro): `officeAddress`, `officePhone`, `licenseNumber`, datos fiscales, etc. La vista previa del perfil puede usar `officeAddress` / `officePhone` como respaldo si faltan `consultorio*`.

### 1.2 Logo (reglas de producto)

- Tipos admitidos en UI: JPEG, PNG, GIF.
- Tamaño máximo referencia en frontend: **2 MB**.
- Subida: `POST /api/doctor-profile/logo` (multipart `logo`).
- En generación del PDF, URLs `http(s)://` se descargan; rutas relativas se leen del disco del servidor.

---

## 2. Datos de la receta (modelo y líneas)

### 2.1 `RecetaMedica` (`recetas_medicas`)

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | UUID | Folio en el PDF |
| `doctorId` | FK | Emisor |
| `pacienteId` | FK | Paciente |
| `citaId` | `String?` | Opcional; vínculo a `MedicalRecord` |
| `archivoPdf` | `String` | Tras generar: URL S3 o nombre de archivo local |
| `fechaEmision` | `DateTime` | Fecha y timestamp en metadatos / QR |
| `observaciones` | `String?` | Bloque “OBSERVACIONES MÉDICAS” si no vacío |
| `esRecetaMedicamento` | `Boolean` | Si `true`, sección medicamentos |
| `esSolicitudEstudios` | `Boolean` | Si `true`, sección estudios |
| `realizadoPor` | `String?` | Auditoría (no sale en plantilla estándar) |
| `vinculadoADoctor` | `String?` | Auditoría (no sale en plantilla estándar) |

### 2.2 `RecetaDetalleMedicamento` (`receta_detalle_medicamentos`)

| Campo | En plantilla |
|-------|----------------|
| `medicamento` | Nombre |
| `dosis` | “Dosis:” |
| `frecuencia` | “Frecuencia:” |
| `duracion` | “Duración:” (opcional, `{{#if duracion}}`) |

### 2.3 `RecetaEstudioSolicitado` (`receta_estudios_solicitados`)

| Campo | En plantilla |
|-------|----------------|
| `nombreEstudio` | “Estudio:” |
| `indicaciones` | “Indicaciones:” (opcional) |

### 2.4 Objeto `patient` en el PDF (servicio)

| Campo | Origen actual | Nota para Paw Care Plus |
|-------|----------------|-------------------------|
| `firstName`, `lastName` | `patient.user` | |
| `email` | `patient.user.email` | No mostrado en plantilla HTML actual |
| `fechaNacimiento` | En código: literal **`'No especificada'`** | El modelo `Patient` tiene `dateOfBirth`; conviene mapear fecha real al portar |
| `id` | `patient.id` | Etiquetado como “Expediente” en humanos; es el UUID del paciente |

---

## 3. Objeto que recibe la plantilla (`recipePdf.service.ts`)

Estructura lógica enviada a Handlebars (nombres exactos):

```text
doctor: {
  firstName, lastName, professionalTitle, specialization,
  consultorioDireccion, consultorioTelefono,
  certificadoProfesional, certificadoEspecialidad, certificadoMaestria,
  universidad | null,
  logoUrl,              // data URL base64 en PDF real
  primaryColor, secondaryColor,
  socialMediaFacebook | null, socialMediaInstagram | null,
  socialMediaX | null, socialMediaOther | null,
  hasSocialMedia       // boolean
}
patient: {
  firstName, lastName, email, fechaNacimiento, id
}
recipe: {
  id, fechaEmision (string local es-ES), timestamp (ISO),
  observaciones,
  esRecetaMedicamento, esSolicitudEstudios,
  detalleMedicamentos[], estudiosSolicitados[]
}
qrCode                 // solo payload base64 PNG (sin prefijo data:)
```

**Código QR:** URL de verificación:

```text
{BASE_URL}/api/recipes/verify/{recipe.id}?hash={generateProductionHash(recipe.id, doctorId, fechaEmision)}
```

`BASE_URL` = variable de entorno; el hash usa timestamp en segundos de la fecha de emisión.

**PDF:** Puppeteer, formato **A4**, márgenes **20 mm** en los cuatro lados, `printBackground: true`. Opcional: `PUPPETEER_EXECUTABLE_PATH` en contenedor.

**Persistencia del archivo:** si hay bucket S3 (`AWS_S3_BUCKET_NAME` o `AWS_BUCKET_NAME`), subcarpeta `recipes/` y se guarda URL en `archivoPdf`; si no, `uploads/recipes/` y nombre de archivo.

---

## 4. Diseño del PDF (secciones y orden)

Orden vertical en `recipe-template.html`:

1. **Cabecera del doctor**  
   - Columna izquierda: logo (o placeholder “LOGO DEL CONSULTORIO” con borde `primaryColor`).  
   - Columna central:  
     - Etiqueta pequeña **“Emitido por:”**  
     - Nombre completo (clase `doctor-name`, azul `#2563eb`)  
     - Línea `professionalTitle` + `specialization`  
     - **Consultorio:** dirección y **Tel:** teléfono.  
   - Columna derecha: caja **“Certificaciones Profesionales”** con cédula, especialidad, maestría y universidad condicional.

2. **Barra “RECETA MÉDICA”** (fondo `#2563eb`, texto blanco)  
   - Folio = `recipe.id`  
   - Fecha = `recipe.fechaEmision`

3. **DATOS DEL PACIENTE** (fondo gris claro)  
   - Nombre, fecha de nacimiento, expediente (`patient.id`).

4. **MEDICAMENTOS PRESCRITOS** (si `esRecetaMedicamento`)  
   - Lista: medicamento, dosis, frecuencia, duración opcional.

5. **ESTUDIOS SOLICITADOS** (si `esSolicitudEstudios`)  
   - Nombre e indicaciones opcionales.

6. **OBSERVACIONES MÉDICAS** (si `recipe.observaciones`)  
   - Fondo amarillo suave, borde izquierdo `#ffc107`.

7. **Pie**  
   - QR + texto “Código QR de Verificación” + ID y timestamp.  
   - Línea de firma + nombre + título + cédula.  
   - **Términos y condiciones** (bloque `.terms`).  
   - **URL** `www.qlinexa360.com` (enlace).  
   - **Redes del profesional** (si `hasSocialMedia`): iconos en fila.  
   - **Aviso legal / disclaimer** (bloque `.disclaimer`).

---

## 5. Textos legales y de marca (copiar/adaptar para Paw Care Plus)

Sustituir **Qlinexa360** y **www.qlinexa360.com** por la marca y dominio de Paw Care Plus. Revisar con asesoría legal en veterinaria.

### 5.1 “Emitido por” (etiqueta, no es leyenda larga)

Texto fijo encima del nombre del profesional:

```text
Emitido por:
```

### 5.2 Términos y condiciones (pie, clase `.terms`)

```text
TÉRMINOS Y CONDICIONES:
Esta receta es válida por 30 días a partir de la fecha de emisión.
Solo puede ser dispensada por farmacias autorizadas.
Para verificar la autenticidad, escanee el código QR o consulte en el sistema.
```

*(En veterinaria: sustituir “farmacias autorizadas” por dispensación / uso según normativa local.)*

### 5.3 Aviso legal principal (`.disclaimer`, primer párrafo)

```text
Aviso legal: Qlinexa360 es una plataforma tecnológica para la gestión clínica. La presente receta es emitida exclusivamente por el profesional de la salud que la suscribe, quien es el único responsable del diagnóstico, tratamiento, indicaciones y cumplimiento regulatorio aplicable. Qlinexa360 no presta servicios médicos ni valida por sí misma la prescripción.
```

### 5.4 Restricción COFEPRIS (`.disclaimer`, segundo párrafo)

```text
Restricción: Esta funcionalidad no sustituye los recetarios especiales ni autorizaciones exigidas por COFEPRIS para medicamentos sujetos a control sanitario especial.
```

*(En Paw Care Plus México veterinario: adaptar a **SENASICA**/normativa de medicamentos de uso veterinario; si el producto opera fuera de MX, sustituir por la autoridad correspondiente o eliminar si no aplica.)*

### 5.5 Pie de página web

```text
www.qlinexa360.com
```

Enlace `href="https://www.qlinexa360.com"`.

### 5.6 Leyenda redes sociales

```text
Redes del Profesional de la Salud:
```

---

## 6. Estilos visuales relevantes

- Contenedor máximo ~800px lógico; fuente base Arial.  
- Acentos: azul `#2563eb` en títulos de sección y barra de receta; nombre doctor en cabecera también `#2563eb`.  
- `primaryColor` del doctor: borde del logo y encabezados de ítems de medicamento.  
- Disclaimer: fondo `#f9fafb`, borde `#e5e7eb`, texto gris `#6b7280`, tamaño ~8px.

---

## 7. API relacionada (resumen)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/doctor-profile/config` | Devuelve campos de personalización de recetas + datos básicos del doctor |
| PATCH | `/api/doctor-profile/config` | Actualiza consultorio, certificaciones, universidad, colores, redes, timezone |
| POST | `/api/doctor-profile/logo` | Sube logo |
| DELETE | `/api/doctor-profile/logo` | Elimina logo |
| GET | `/api/doctor-profile/recipe-preview` | JSON con estructura de ejemplo para pintar vista previa en frontend (QR dummy) |

La generación real del PDF se dispara desde la lógica de recetas (p. ej. tras crear receta) llamando a `RecipePdfService.generateRecipePdf(recipeId)`.

---

## 8. Nota sobre `DoctorRecipeTemplate`

En `schema.prisma` existe el modelo **`DoctorRecipeTemplate`** (`doctorId`, `pdfUrl`, `camposEditables` JSON). En el flujo actual documentado, la receta impresa usa **solo** `recipe-template.html` + datos del doctor y de la receta; si en el futuro se usa plantilla PDF subida por el doctor, habría que alinear ese modelo con el mismo conjunto de campos o con un mapeo explícito.

---

*Última referencia a código: plantilla `backend/src/templates/recipe-template.html` y servicio `backend/src/services/recipePdf.service.ts`.*
