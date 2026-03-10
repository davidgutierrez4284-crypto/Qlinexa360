# Verificación de despliegue en PROD - Qlinexa360

**Fecha de verificación:** 23 Feb 2026

---

## Estado confirmado

### Frontend (S3 + CloudFront) — DESPLEGADO

| Verificación | Estado |
|--------------|--------|
| Archivos en S3 `qlinexa360` | OK — index.html, assets/index-Ca008w52.js, etc. (22 Feb 19:09) |
| CloudFront distribución E2Z7077D2HRTFW | OK — sirve www.qlinexa360.com |
| DNS www.qlinexa360.com | OK — apunta a d2rstagx73rv11.cloudfront.net |
| Invalidación de caché | OK — ejecutada tras el deploy |

**Conclusión:** El frontend con las correcciones está en S3 y CloudFront sirve desde ahí.

---

### Backend (ECS) — NO DESPLEGADO

Las correcciones de **quejas y sugerencias** (ruta `/api/feedback` con `authenticateToken`) están en el código pero **el backend en ECS no se ha actualizado**.

Para que funcionen las quejas/sugerencias en PROD hay que desplegar el backend:

```powershell
# 1. Build y push de imagen Docker
.\scripts\deploy-backend-ecr.ps1

# 2. Actualizar servicio ECS
aws ecs update-service --cluster qlinexa360-prod-cluster --service qlinexa360-prod-backend --force-new-deployment --region us-east-2
```

---

## Por qué no ves los cambios

### 1. Caché del navegador / PWA

La app usa Service Worker (PWA), que puede seguir sirviendo una versión antigua.

**Qué hacer:**
- **Chrome/Edge:** F12 → Application → Service Workers → Unregister
- O: Ctrl+Shift+R (recarga forzada)
- O: Borrar datos del sitio para www.qlinexa360.com

### 2. Backend sin actualizar

- **Quejas y sugerencias:** Depende del backend. Sin redeploy del backend seguirá el error 403.
- **Menú hamburguesa (scroll):** Solo frontend. Debería verse si se carga la versión nueva.
- **Dashboard sin error de estadísticas (ADMIN):** Solo frontend. Debería verse si se carga la versión nueva.

---

## Cómo comprobar que usas la versión nueva

1. Abre https://www.qlinexa360.com
2. F12 → Network → marca "Disable cache"
3. Recarga (F5)
4. En Network, revisa el JS cargado: debe ser `index-Ca008w52.js` (no `index-lhfvcddK.js` ni otro hash antiguo)

Si ves `index-Ca008w52.js`, estás con la versión nueva del frontend.
