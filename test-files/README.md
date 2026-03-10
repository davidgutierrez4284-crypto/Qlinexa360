# Archivos de Prueba para Medilink360

Este directorio contiene archivos de prueba para verificar las medidas de seguridad implementadas.

## 📁 Archivos Incluidos

### ✅ Archivos Válidos (deben pasar todas las validaciones)
- `test-image.jpg` - Imagen JPEG válida
- `test-document.pdf` - Documento PDF válido
- `test-image.png` - Imagen PNG válida

### ❌ Archivos de Prueba de Seguridad (deben ser bloqueados)
- `malicious.js` - Archivo JavaScript (debe ser bloqueado)
- `test.exe` - Archivo ejecutable (debe ser bloqueado)
- `suspicious.pdf` - PDF con JavaScript embebido (debe ser bloqueado)

## 🧪 Cómo Usar

1. **Iniciar el servidor**:
   ```bash
   npm run dev
   ```

2. **Probar uploads válidos**:
   - Subir `test-image.jpg` → Debe funcionar
   - Subir `test-document.pdf` → Debe funcionar
   - Subir `test-image.png` → Debe funcionar

3. **Probar archivos maliciosos**:
   - Subir `malicious.js` → Debe ser bloqueado
   - Subir `test.exe` → Debe ser bloqueado
   - Subir `suspicious.pdf` → Debe ser bloqueado

## 📊 Verificar Logs

Después de cada prueba, verificar los logs:

```bash
# Logs de upload
tail -f logs/upload.log

# Logs de seguridad
tail -f logs/security.log

# Logs de antivirus
tail -f logs/antivirus.log
```

## 🔍 Medidas de Seguridad a Verificar

1. **Validación de MIME Type** ✅
2. **Verificación de Extensiones** ✅
3. **Escaneo Antivirus** ✅
4. **Rate Limiting** ✅
5. **Sanitización de Nombres** ✅
6. **Logging Detallado** ✅ 