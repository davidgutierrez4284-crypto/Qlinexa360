# Configuración de zona horaria - Medilink360

Esta guía explica cómo configurar las zonas horarias para que la plataforma funcione correctamente con doctores en diferentes países de Latinoamérica y en zonas fronterizas de México.

## Escenarios soportados

| Escenario | Ejemplo | Solución |
|-----------|---------|----------|
| Doctor en otro país | Colombia, Argentina | El doctor configura su zona en **Configuración del Perfil** |
| Doctor en zona fronteriza México | Tijuana (Pacífico), Matamoros (Noreste) | Selecciona la zona correspondiente en el perfil |
| Servidor en AWS | ECS, Lambda, EC2 | Configurar `TZ` y `PRACTICE_TIMEZONE` según abajo |

---

## 1. Configuración por doctor (UI)

Cada doctor puede configurar su zona horaria en:

**Menú Doctor → Configuración del Perfil para Recetas → Zona horaria del consultorio**

Zonas disponibles incluyen:
- **México**: Centro (CDMX), Noroeste (Tijuana), Pacífico (Hermosillo), Sureste (Cancún), Frontera noreste (Matamoros)
- **Latinoamérica**: Colombia, Argentina, Chile, Perú, Ecuador

Esta configuración afecta:
- Formato de fecha/hora en emails de confirmación y recordatorios
- Mensajes de WhatsApp
- Visualización en confirmaciones de cita

---

## 2. Variables de entorno

### `PRACTICE_TIMEZONE` (opcional)

- **Uso**: Zona horaria por defecto cuando un doctor no tiene `timezone` configurado
- **Valor recomendado**: `America/Mexico_City` (si la mayoría de doctores están en México centro)
- **Ejemplo en `.env`**:
  ```
  PRACTICE_TIMEZONE=America/Mexico_City
  ```

### `TZ` (sistema / contenedor)

- **Uso**: Zona horaria del proceso Node.js (cron, logs, fechas sin timezone explícito)
- **Importante**: En AWS, los contenedores suelen usar UTC por defecto

---

## 3. Configuración en AWS

### ECS (Fargate / EC2)

En la **Task Definition** del backend, añade o verifica las variables de entorno:

```json
{
  "name": "TZ",
  "value": "America/Mexico_City"
},
{
  "name": "PRACTICE_TIMEZONE",
  "value": "America/Mexico_City"
}
```

**Recomendación**: Usa `America/Mexico_City` si la mayoría de tus doctores están en México. Si tienes muchos en otros países, `America/Mexico_City` sigue siendo un buen fallback porque cada doctor puede sobrescribirlo en su perfil.

### Lambda (si usas funciones serverless)

En la configuración de la función Lambda:

- **Variables de entorno**: `TZ=America/Mexico_City`, `PRACTICE_TIMEZONE=America/Mexico_City`
- O en el **Dockerfile** si usas imagen personalizada:
  ```dockerfile
  ENV TZ=America/Mexico_City
  ENV PRACTICE_TIMEZONE=America/Mexico_City
  ```

### EC2 (instancia directa)

```bash
# Temporal (solo esta sesión)
export TZ=America/Mexico_City

# Permanente: en /etc/environment o en el servicio systemd
echo 'TZ=America/Mexico_City' >> /etc/environment
```

---

## 4. Cron y recordatorios

El cron de recordatorios (`appointmentReminder.cron.ts`) usa la zona horaria del doctor al enviar emails y WhatsApp. No depende de `TZ` del servidor para el contenido del mensaje.

La **ejecución** del cron (cuándo corre) sí usa la zona del servidor. Si el cron está configurado para correr a las 08:00, asegúrate de que `TZ` del servidor coincida con la zona en la que quieres esa hora (por ejemplo, México).

---

## 5. Base de datos

Las citas se guardan en **UTC** en PostgreSQL (tipo `timestamp`). La conversión a la zona del doctor se hace al formatear (emails, API, UI).

No es necesario cambiar la configuración de la base de datos.

---

## 6. Resumen de pasos

1. **Migración**: Ejecutar `npx prisma migrate deploy` para añadir el campo `timezone` a la tabla `doctors`.
2. **Backend**: Configurar `TZ` y `PRACTICE_TIMEZONE` en la Task Definition de ECS (o equivalente).
3. **Doctores**: Pedir a cada doctor que configure su zona en **Configuración del Perfil** si no están en México centro.
4. **Verificación**: Enviar una cita de prueba y revisar que la hora en el email coincida con la zona del doctor.

---

## 7. Zonas horarias de México (referencia)

| Zona | IANA | Regiones |
|------|------|----------|
| Centro | America/Mexico_City | CDMX, Monterrey, Guadalajara |
| Noroeste | America/Tijuana | Tijuana, Mexicali |
| Pacífico | America/Hermosillo | Hermosillo, Mazatlán |
| Sureste | America/Cancun | Cancún, Mérida |
| Frontera noreste | America/Matamoros | Matamoros, Reynosa |
