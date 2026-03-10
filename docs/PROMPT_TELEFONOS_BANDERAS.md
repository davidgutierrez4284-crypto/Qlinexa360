# Prompt: Teléfonos con formato E.164 y banderas de países hispanohablantes

> **Propósito:** Documento de contexto para implementar campos de teléfono con selector de país, banderas nacionales y formato internacional en proyectos como Qlinexa360 y PawCarePlus.

---

## Prompt completo para el asistente de IA

```
Implementa un componente de teléfono internacional para formularios con las siguientes especificaciones:

## Requisitos funcionales

1. **Formato de almacenamiento:** E.164 (ej: +5215512345678)
   - Compatible con WhatsApp, notificaciones SMS y envío internacional
   - El valor guardado en base de datos debe ser siempre el número completo con + y código de país

2. **Banderas nacionales:** Usar imágenes reales de banderas (no emojis)
   - Fuente recomendada: FlagCDN (https://flagcdn.com)
   - URL: `https://flagcdn.com/w40/{code}.png` donde {code} es el código ISO 3166-1 alpha-2 en minúsculas (ej: mx, es, ar)
   - Las banderas se renderizan de forma consistente en todos los dispositivos

3. **Países de habla hispana:** Incluir solo los siguientes países:
   - México (MX) +52
   - España (ES) +34
   - Argentina (AR) +54
   - Bolivia (BO) +591
   - Chile (CL) +56
   - Colombia (CO) +57
   - Costa Rica (CR) +506
   - Cuba (CU) +53
   - República Dominicana (DO) +1809
   - Ecuador (EC) +593
   - El Salvador (SV) +503
   - Guatemala (GT) +502
   - Honduras (HN) +504
   - Nicaragua (NI) +505
   - Panamá (PA) +507
   - Paraguay (PY) +595
   - Perú (PE) +51
   - Puerto Rico (PR) +1787
   - Uruguay (UY) +598
   - Venezuela (VE) +58

4. **País por defecto:** México (primero en la lista)

5. **UI del componente:**
   - Mostrar imagen de la bandera del país seleccionado (izquierda)
   - Selector desplegable con: país + código +XX (ej: "México +52")
   - Campo de texto para el número local (solo dígitos)
   - Validación: solo números en el input
   - Al cambiar país o número, emitir el valor completo en E.164

6. **Parseo bidireccional:**
   - Si el valor llega como +5215512345678, parsear y mostrar: país México, número local 15512345678
   - Si el valor llega como número local sin código, asumir país por defecto
   - Al buscar el país por dialCode, ordenar de más largo a más corto para evitar falsos positivos (ej: 1809 vs 1)

## Estructura técnica sugerida

- **Archivo:** `constants/countries.js`
  - `SPANISH_SPEAKING_COUNTRIES`: array de { code, name, dialCode }
  - `DEFAULT_COUNTRY`: primer país
  - `getFlagUrl(code)`: retorna URL de FlagCDN
  - `parseE164(phone)`: retorna { country, localNumber }
  - `toE164(country, localNumber)`: retorna string "+XX..."

- **Componente:** `PhoneInput.jsx` (o similar)
  - Props: value, onChange, name, label, required, error, placeholder, disabled
  - onChange recibe el valor E.164 completo
  - Layout: bandera | selector país | input número

## Integración en formularios

- El componente debe emitir el valor E.164 directamente al onChange
- No usar librerías pesadas como react-phone-input si se puede lograr con HTML nativo
- Asegurar accesibilidad: aria-label en selector de país, aria-invalid si hay error
```

---

## Resumen de implementación (referencia)

| Elemento | Ubicación | Descripción |
|----------|-----------|-------------|
| `countries.js` | `frontend/src/constants/` | Lista de países, getFlagUrl, parseE164, toE164 |
| `PhoneInput.jsx` | `frontend/src/components/common/` | Componente reutilizable |
| FlagCDN | Externo | `https://flagcdn.com/w40/{code}.png` |

## Uso del componente

```jsx
<PhoneInput
  label="Teléfono *"
  name="phone"
  value={form.phone}
  onChange={(e164) => setForm(prev => ({ ...prev, phone: e164 }))}
  required
  error={phoneError}
/>
```

## Notas para Qlinexa360

- Si el proyecto usa otro stack (Vue, Angular, etc.), adaptar la estructura manteniendo la misma lógica.
- Mantener la lista de países hispanohablantes y el formato E.164 para consistencia entre plataformas.
- FlagCDN no requiere API key y es gratuito para uso estándar.
