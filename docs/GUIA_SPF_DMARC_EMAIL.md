# Guía: Configurar SPF y DMARC para evitar que los emails vayan a spam

Esta guía te ayuda a configurar los registros DNS **SPF** y **DMARC** para el dominio **qlinexa360.com**, de modo que los correos enviados desde la plataforma (recordatorios, confirmaciones, notificaciones) lleguen a la bandeja de entrada y no a spam.

---

## Datos de tu configuración actual

| Dato | Valor |
|------|-------|
| **Dominio** | `qlinexa360.com` |
| **Proveedor de correo** | Zoho Mail |
| **Servidor SMTP** | `smtppro.zoho.com` |
| **Direcciones que envían** | `no-reply@qlinexa360.com`, `admin@qlinexa360.com`, `legal@qlinexa360.com` |

---

## Dónde configurar los registros DNS

Los registros SPF y DMARC se configuran en el **panel DNS de tu dominio**. Según tu setup:

- Si el dominio está en **Squarespace**: Squarespace → Configuración → Dominios → DNS
- Si está en **Cloudflare**: Cloudflare → Tu dominio → DNS
- Si está en **GoDaddy, Namecheap, etc.**: Panel de control → Administrar dominio → DNS / Registros DNS

---

## 1. Registro SPF (Sender Policy Framework)

El SPF indica qué servidores están autorizados a enviar correo en nombre de `@qlinexa360.com`.

### Registro a crear

| Campo | Valor |
|-------|-------|
| **Tipo** | `TXT` |
| **Nombre / Host** | `@` (o `qlinexa360.com` si piden el dominio completo) |
| **Valor / Contenido** | `v=spf1 include:zoho.com ~all` |
| **TTL** | 3600 (o el valor por defecto) |

### Explicación

- `v=spf1` — Versión del protocolo SPF
- `include:zoho.com` — Autoriza a los servidores de Zoho a enviar correo por tu dominio
- `~all` — Los correos de otros servidores se marcan como "soft fail" (pueden llegar pero con menor confianza)

### Si ya tienes un registro SPF

Si ya existe un registro TXT con `v=spf1`, **no crees otro**. Combínalo en uno solo. Ejemplo si usas también otro servicio:

```
v=spf1 include:zoho.com include:otro-servicio.com ~all
```

---

## 2. Registro DMARC (Domain-based Message Authentication)

DMARC indica qué hacer con los correos que no pasan SPF o DKIM y reduce el riesgo de que vayan a spam.

### Registro a crear

| Campo | Valor |
|-------|-------|
| **Tipo** | `TXT` |
| **Nombre / Host** | `_dmarc` |
| **Valor / Contenido** | `v=DMARC1; p=quarantine; rua=mailto:admin@qlinexa360.com; pct=100; adkim=r; aspf=r` |
| **TTL** | 3600 |

### Explicación de los parámetros

| Parámetro | Valor | Significado |
|-----------|-------|-------------|
| `v=DMARC1` | Obligatorio | Versión del protocolo |
| `p=quarantine` | Recomendado al inicio | Los correos que fallen van a cuarentena (spam) en lugar de rechazarse |
| `rua=mailto:admin@qlinexa360.com` | Opcional | Envía reportes agregados a este correo |
| `pct=100` | Opcional | Aplica la política al 100% de los mensajes |
| `adkim=r` | Opcional | Alineación relajada para DKIM |
| `aspf=r` | Opcional | Alineación relajada para SPF |

### Políticas posibles para `p`

- `p=none` — Solo monitorear, no aplicar acción
- `p=quarantine` — Enviar a spam los que fallen (recomendado al inicio)
- `p=reject` — Rechazar los que fallen (solo cuando estés seguro de que todo funciona)

---

## 3. DKIM (opcional pero muy recomendado)

DKIM firma los correos para que los receptores verifiquen que son legítimos. Zoho permite configurarlo desde su panel.

### Pasos en Zoho

1. Entra a [Zoho Mail Admin](https://mailadmin.zoho.com) o al panel de administración de tu cuenta Zoho.
2. Ve a **Dominios** → selecciona `qlinexa360.com`.
3. Busca la sección **DKIM** o **Autenticación**.
4. Zoho te dará un registro TXT con un nombre tipo `zoho._domainkey` y un valor largo.
5. Crea ese registro TXT en tu DNS (en el mismo lugar donde configuraste SPF y DMARC).

---

## 4. Resumen de registros DNS

| Tipo | Nombre | Valor |
|------|--------|-------|
| TXT | `@` | `v=spf1 include:zoho.com ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:admin@qlinexa360.com; pct=100; adkim=r; aspf=r` |
| TXT | `zoho._domainkey` | *(Lo proporciona Zoho en su panel)* |

---

## 5. Verificación

### Comprobar SPF

```bash
nslookup -type=TXT qlinexa360.com
```

O usa: [mxtoolbox.com/spf.aspx](https://mxtoolbox.com/spf.aspx) — introduce `qlinexa360.com`.

### Comprobar DMARC

```bash
nslookup -type=TXT _dmarc.qlinexa360.com
```

O usa: [mxtoolbox.com/dmarc.aspx](https://mxtoolbox.com/dmarc.aspx) — introduce `qlinexa360.com`.

### Herramientas útiles

- [mail-tester.com](https://www.mail-tester.com) — Envía un correo de prueba y obtén una puntuación de deliverability.
- [dmarcian.com/dmarc-inspector](https://dmarcian.com/dmarc-inspector/) — Inspecciona la configuración DMARC.

---

## 6. Tiempos de propagación

Los cambios DNS pueden tardar entre **15 minutos y 48 horas** en propagarse. Si no ves los registros de inmediato, espera unas horas y vuelve a verificar.

---

## 7. Checklist final

- [ ] Registro SPF creado para `qlinexa360.com`
- [ ] Registro DMARC creado para `_dmarc.qlinexa360.com`
- [ ] DKIM configurado en Zoho y registro TXT añadido en DNS
- [ ] Verificación con mxtoolbox o mail-tester
- [ ] Envío de correo de prueba desde la plataforma

---

## Referencias

- [Zoho: Configurar SPF](https://www.zoho.com/mail/help/adminconsole/spf-configuration.html)
- [Zoho: Configurar DKIM](https://www.zoho.com/mail/help/adminconsole/dkim-configuration.html)
- [DMARC.org - Guía rápida](https://dmarc.org/)
