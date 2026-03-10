# Prompt e Instrucción Completa: Mejoras 2FA (Tooltip y Recordar Dispositivo 30 días)

## Objetivo
Mejorar la experiencia de autenticación en dos factores (2FA) con:
1. **Tooltip explicativo** que guíe al usuario sobre cómo usar el código 2FA
2. **Opción "Recordar este dispositivo"** para no pedir 2FA cada vez que el usuario ingresa, durante 30 días

---

## PROMPT COMPLETO PARA CURSOR / DESARROLLADOR

```
Necesito mejorar la autenticación 2FA (autenticación en dos factores) con dos cambios:

1. TOOLTIP MEJORADO EN EL PASO DE VERIFICACIÓN 2FA
   - Añadir un enlace/texto "¿Cómo usar el código?" junto al campo de código de verificación
   - Al hacer clic (o hover), mostrar un tooltip con instrucciones claras:
     * Paso 1: Abre tu app de autenticación (Google Authenticator o Microsoft Authenticator)
     * Paso 2: Copia el código de 6 dígitos vigente
     * Paso 3: Pégalo aquí y presiona "Verificar 2FA"
     * Si no tienes acceso, usa "Enviar código por email"
     * Mensaje de seguridad: "La autenticación en dos pasos es la mejor protección contra hackeo de cuentas"
   - El tooltip debe cerrarse al hacer clic fuera
   - Usar atributo title nativo como fallback para accesibilidad

2. RECORDAR DISPOSITIVO (30 DÍAS)
   - Añadir un checkbox "Recordar este dispositivo (30 días)" en el paso de verificación 2FA
   - Por defecto debe estar marcado (checked)
   - Cuando el usuario marca el checkbox y verifica 2FA correctamente:
     * El backend debe generar un "trustedDeviceToken" (JWT con purpose: 'trustedDevice', expiración 30 días)
     * El frontend debe guardar en localStorage: { email, token } bajo la clave 'trustedDevice'
   - En el siguiente login:
     * Si existe trustedDevice en localStorage y el email coincide con el que está intentando loguear, enviar el trustedDeviceToken en el body del login
     * El backend, si recibe trustedDeviceToken válido y corresponde al usuario, debe omitir el paso 2FA y devolver el token de sesión directamente
   - El token de dispositivo confiable debe expirar en 30 días
   - Si el token expira o es inválido, el backend debe pedir 2FA normalmente

Implementa esto en backend (auth controller, jwt utils) y frontend (LoginForm, AuthContext, auth API).
```

---

## DETALLE TÉCNICO DE IMPLEMENTACIÓN

### Backend

#### 1. `jwt.utils.ts` – Token de dispositivo confiable
```typescript
const TRUSTED_DEVICE_EXPIRY = '30d';

export const generateTrustedDeviceToken = (userId: string): string => {
  return jwt.sign(
    { userId, purpose: 'trustedDevice' },
    JWT_SECRET,
    { expiresIn: TRUSTED_DEVICE_EXPIRY }
  );
};

export const verifyTrustedDeviceToken = (token: string): { userId: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; purpose?: string };
    if (decoded.purpose !== 'trustedDevice') return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
};
```

#### 2. `auth.controller.ts` – Login
- En el handler de login, después de validar email/password y antes de pedir 2FA:
- Si `req.body.trustedDeviceToken` existe, llamar a `verifyTrustedDeviceToken(token)`
- Si el token es válido y `decoded.userId === user.id`, devolver `buildAuthResponse(user)` directamente (omitir 2FA)

#### 3. `auth.controller.ts` – Verify 2FA
- En el handler de verify 2FA, leer `req.body.rememberDevice` (boolean)
- Si `rememberDevice === true`, generar `trustedDeviceToken = generateTrustedDeviceToken(user.id)`
- Incluir `trustedDeviceToken` en la respuesta JSON

### Frontend

#### 4. `auth.js` (API)
- `login(email, password, trustedDeviceToken?)`: si hay trustedDeviceToken, incluirlo en el body
- `verifyTwoFactor(tempToken, code, rememberDevice)`: incluir `rememberDevice` en el body

#### 5. `AuthContext.jsx`
- En `login`: antes de llamar al API, leer `localStorage.getItem('trustedDevice')`, parsear JSON, si el email coincide con el que se está logueando, extraer `token` y pasarlo como tercer argumento a `loginService`
- En `verifyTwoFactor`: después de verificar exitosamente, si `data.trustedDeviceToken` existe y tenemos el email, guardar en localStorage: `localStorage.setItem('trustedDevice', JSON.stringify({ email: email.toLowerCase(), token: data.trustedDeviceToken }))`

#### 6. `LoginForm.jsx`
- Estado: `rememberDevice` (useState(true))
- En el paso de verificación 2FA:
  - Tooltip: enlace "¿Cómo usar el código?" junto al campo, con tooltip expandible al clic
  - Texto del tooltip: instrucciones paso a paso + mensaje de seguridad
  - Checkbox: "Recordar este dispositivo (30 días)" con `checked={rememberDevice}` y `onChange`
  - Al llamar a `verifyTwoFactor`, pasar `rememberDevice` y el email del formulario

---

## TEXTO DE LOS TOOLTIPS

**Tooltip principal (expandible):**
```
Paso 1: Abre tu app de autenticación (Google Authenticator o Microsoft Authenticator son las más usadas).
Paso 2: Copia el código de 6 dígitos vigente.
Paso 3: Pégalo aquí y presiona "Verificar 2FA".
Si no tienes acceso, usa "Enviar código por email".
La autenticación en dos pasos es la mejor protección contra hackeo de cuentas y protege tus datos clínicos.
```

**Atributo title (fallback):**
```
Paso 1: Abre tu app de autenticación.
Paso 2: Copia el código de 6 dígitos vigente.
Paso 3: Pégalo aquí y presiona "Verificar 2FA".
Si no tienes acceso, usa "Enviar código por email".
```

---

## FLUJO RESUMIDO

1. **Primer login con 2FA:** Usuario ingresa email/password → backend pide 2FA → usuario ingresa código, marca "Recordar este dispositivo" → backend devuelve token + trustedDeviceToken → frontend guarda en localStorage
2. **Siguientes logins (mismo dispositivo):** Usuario ingresa email/password → frontend envía trustedDeviceToken del localStorage → backend valida y devuelve token directamente (sin 2FA)
3. **Después de 30 días o en otro dispositivo:** trustedDeviceToken expirado o inexistente → backend pide 2FA normalmente
