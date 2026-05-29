# Prompt accionable: Agenda + Calendarios + Teleconsulta + Pre-registro para PawCarePlus

> **Propósito:** Prompt autocontenido para pegar **directo en el asistente de IA del repo de PawCarePlus**. Replica lo afinado y probado en producción en Medilink360/Qlinexa360 (mayo 2026): agenda compartida con **step de agendar**, gestión **presencial vs teleconsulta**, liga de video condicionada al **aviso de privacidad firmado**, sincronización **Google Calendar + Outlook** (solo esos dos), y **pre-registro** con enlaces legales.
>
> Documento técnico complementario (detalle de implementación + snippets): `REPLICAR_PAWCAREPLUS_CALENDARIOS_AGENDA_TELECONSULTA_PREREGISTRO.md`.

---

## Prompt completo para el asistente de IA (copiar todo el bloque)

```
Implementa/ajusta en PawCarePlus (plataforma veterinaria; backend Node/TypeScript + Prisma + Express, frontend React) las siguientes funcionalidades. PawCarePlus ya tiene calendarios/citas parciales; el foco principal es AÑADIR EL STEP DE AGENDAR y completar las reglas de presencial vs teleconsulta. Dominio: "propietario" + "mascota" (no "paciente"). Calendarios soportados: ÚNICAMENTE Google Calendar (Google Meet) y Microsoft Outlook (Teams). No Apple ni Notion.

============================================================
0) FUENTE DE VERDAD Y REGLAS GLOBALES
============================================================
- Appointment es la fuente de verdad de fecha/hora y modalidad (appointmentType: 'presencial' | 'teleconsulta').
- InternalCalendarEvent es el espejo interno que se empuja a Google/Outlook.
- REGLA DE VIDEO (crítica): la videollamada (Meet/Teams) SOLO existe si appointmentType === 'teleconsulta' Y el consentimiento de la teleconsulta está firmado (Teleconsultation.consentSigned === true). Una cita 'presencial' NUNCA debe mostrar liga, aunque el proveedor la agregue automáticamente.
- Para presencial (o teleconsulta sin firmar) se envía a los servicios de sync el flag disableConference: true para ELIMINAR cualquier liga existente.
- Push a calendarios externos SIEMPRE con el propietario como invitado (attendee) y con fecha/hora LOCAL del veterinario + timeZone explícito (no ISO UTC con timeZone distinto; Microsoft Graph lo interpreta mal).

============================================================
1) CRITERIOS DE ACEPTACIÓN (deben cumplirse todos)
============================================================
C1. La cita SIEMPRE se ve en la agenda in-app del propietario y en el calendario del veterinario (vía invitación de correo).
C2. El propietario recibe correo con archivo .ics al agendar.
C3. Confirmar la cita sincroniza el evento interno + Google/Outlook.
C4. Reagendar muestra SOLO los slots disponibles de la agenda compartida del veterinario.
C5. Al reagendar, los cambios se reflejan en ambos calendarios (propietario y veterinario) con notificación.
C6. Las citas presenciales NO llevan liga de videollamada.
C7. Las citas virtuales requieren firmar el aviso de privacidad; una vez firmado se activa la liga.
C8. El propietario recibe por correo la solicitud de FIRMA del aviso (enlace a /teleconsulta/{token}), NO la liga directa de video.

============================================================
2) MODELOS PRISMA (migraciones ADITIVAS; respetar datos existentes)
============================================================
- Appointment: añadir/confirmar campos: appointmentType String @default("presencial"), confirmationStatus enum (PENDING|CONFIRMED|RESCHEDULED|CANCELLED), rescheduledFrom DateTime?, rescheduledTo DateTime?, relación a Teleconsultation.
- Teleconsultation: id, appointmentId @unique, videoProvider ('google_meet'|'teams'), externalEventId?, meetingUrl?, consentSigned Boolean @default(false), consentPdfUrl?, consentDocumentHash?, consentSignedAt?, consentIp?, timestamps. Relación onDelete: Cascade a Appointment.
- TeleconsultationAuditLog: action (CONSENT_REQUESTED|CONSENT_SIGNED|PDF_GENERATED|PDF_SENT|MEETING_ACCESS), userId?, ip?, userAgent?, metadata Json?, createdAt.
- CalendarSyncConfig: doctorId, provider ('google'|'outlook'), isConnected, accessToken?, refreshToken?, expiresAt?, lastSync?, error?, @@unique([doctorId, provider]). (Sin calendarId: Google usa 'primary'.)
- DoctorScheduleConfig: doctorId @unique, appointmentDuration Int @default(30), bufferTime Int @default(15), weeklySchedule Json (por día: [{ startTime:"09:00", endTime:"13:00", isAvailable:true }]).
- AgendaPacientesLink (agenda compartida pública): link @unique (slug), doctor_id, esta_activo Boolean @default(false), mensaje_custom?.
- ClinicalIntake (pre-registro): token @unique, doctorId, patientId?, appointmentId?, status enum (DRAFT|SUBMITTED_PENDING_VALIDATION|APPROVED|REJECTED|CONVERTED), formData Json?, consultationReason?, consentPrivacy/consentTreatment/consentPlatform Boolean, consentSignerName?, consentSignedAt?, consentIp?, consentFileId?, consentPdfUrl?, consentDocumentHash?, staffNotes?, expiresAt?, linkNeverExpires Boolean @default(false), convertedClinicalCaseId?, convertedMedicalRecordId?.
- Doctor (veterinario): añadir intakePortalToken String? @unique, intakePortalSlug String? @unique.

============================================================
3) OAUTH CALENDARIOS (multi-tenant; cada veterinario conecta su cuenta)
============================================================
Rutas (montar en /api/calendar-sync, sin auth middleware; doctorId viaja en state):
  GET /api/calendar-sync/auth/google
  GET /api/calendar-sync/auth/google/callback
  GET /api/calendar-sync/auth/outlook
  GET /api/calendar-sync/auth/outlook/callback
Scopes:
  Google:  https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events
           (authUrl con access_type=offline, prompt=consent, include_granted_scopes=true)
  Outlook: offline_access Calendars.ReadWrite OnlineMeetings.ReadWrite
Variables de entorno (configurar una vez; tokens por veterinario en CalendarSyncConfig):
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI=https://api.pawcareplus.com/api/calendar-sync/auth/google/callback
  OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_REDIRECT_URI=https://api.pawcareplus.com/api/calendar-sync/auth/outlook/callback
  FRONTEND_URL=https://www.pawcareplus.com
Refresh de tokens: refrescar si expiresAt <= ahora+60s; reintentar una vez en 401/403 (executeWithRetry).
NOTA: la cuenta Microsoft debe tener buzón Exchange Online (sin buzón, /me/calendar y /me/events devuelven 401). Para pruebas usar Microsoft 365 Developer Program (Exchange + Teams).

============================================================
4) SERVICIOS DE SYNC (Google + Outlook) Y LIGA CONDICIONAL
============================================================
Helper de gating (utils):
  function shouldAllowVideoConferenceForAppointment(appointmentType, consentSigned) {
    return appointmentType === 'teleconsulta' && consentSigned === true;
  }
googleCalendarSync.service.ts -> upsertEvent(doctorId, payload):
  - payload incluye: conferenceType?: 'google-meet'|null, googleMeetEnabled?, conferenceLink?, disableConference?, sendUpdates?, attendees[], timezone.
  - shouldCreateConference = (conferenceType==='google-meet' || googleMeetEnabled) && !yaTieneMeet  -> conferenceData.createRequest { conferenceSolutionKey:{type:'hangoutsMeet'} } con conferenceDataVersion:1.
  - shouldStripConference = disableConference===true -> events.update (full replace) eliminando conferenceData y hangoutLink, sendUpdates:'all'.
  - fechas: dateTime local + timeZone explícito.
outlookCalendarSync.service.ts -> upsertEvent(doctorId, payload):
  - buildEventBody: const wantsTeams = !disableConference && (teamsEnabled || conferenceType==='teams'); devolver isOnlineMeeting: wantsTeams, onlineMeetingProvider: wantsTeams ? 'teamsForBusiness' : undefined.
  - conferenceLink = data.onlineMeeting?.joinUrl.
reconcileCalendarEventWithAppointment: si appointmentType !== 'teleconsulta', limpiar linkMeeting.
Controladores:
  - Al CREAR evento (UI veterinario): video según meetingPlatform; teleconsulta nace con meetingUrl:null. disableConference: !wantsConference.
  - Al ACTUALIZAR / confirmar / reagendar / aprobar: allowVideo = shouldAllowVideoConferenceForAppointment(...); Google { conferenceType: allowVideo?'google-meet':null, googleMeetEnabled: allowVideo, disableConference: !allowVideo }; Outlook { teamsEnabled: allowVideo, disableConference: !allowVideo }.

============================================================
5) STEP DE AGENDAR (agenda compartida pública)  <-- PRIORIDAD
============================================================
ScheduleService:
  - generateAvailableSlots(doctorId, date, tz): recorre weeklySchedule del día, genera slots cada (appointmentDuration + bufferTime) min.
  - getBookableSlotsForDate(doctorId, date, {excludeAppointmentId?, excludeEventId?, timezone}): genera slots y RESTA citas activas (status != CANCELLED y confirmationStatus in [PENDING,CONFIRMED,RESCHEDULED]) + internalCalendarEvent ocupados, con buffer. Devuelve [{ id, startTime, endTime, displayTime }].
  - isSlotBookable(...): delega a getBookableSlotsForDate.
Endpoints públicos (/api/agenda-pacientes):
  GET  /doctor/:doctorUsername                  -> info del veterinario + agenda
  GET  /doctor/:doctorUsername/slots?fecha=YYYY-MM-DD  -> slots reservables (USAR getBookableSlotsForDate)
  POST /doctor/:doctorUsername/appointment      -> body { slotId, ownerName, ownerEmail, ownerPhone, petName, motivoConsulta }
Crear cita: prisma.appointment.create({ status:'SCHEDULED', confirmationStatus:'PENDING', date:slotTime, ... }); crear internalCalendarEvent; enviar correo con .ics; NO sincronizar calendarios externos hasta que el veterinario apruebe.
Frontend: página /agendar/:doctorUsername (selector de fecha -> lista de slots -> formulario propietario+mascota -> confirmación).
IMPORTANTE: usar getBookableSlotsForDate también en el endpoint público para evitar doble reserva (no solo bloquear CONFIRMED).

============================================================
6) CONFIRMAR / CANCELAR / REAGENDAR (por token)
============================================================
Rutas (/api/appointment-confirmation), token = AppointmentConfirmationRequest.confirmationToken:
  GET  /info/:token                                  -> incluir appointmentType en la respuesta
  POST /confirm/:token                               -> confirmationStatus CONFIRMED + syncAppointmentCalendars(appointmentId)
  POST /cancel/:token
  GET  /reschedule/:token/available-slots?date=YYYY-MM-DD  -> ScheduleService.getBookableSlotsForDate(doctorId, date, { excludeAppointmentId, timezone })
  POST /reschedule/:token                            -> validar con isSlotBookable; update Appointment { date, status:'SCHEDULED', confirmationStatus:'RESCHEDULED', rescheduledFrom, rescheduledTo }; luego syncAppointmentCalendars.
syncAppointmentCalendars(appointmentId): busca/crea InternalCalendarEvent, alinea fechaHoraInicio/Fin con appointment.date, upsertEvent a Google/Outlook con el propietario como attendee y sendUpdates:'all' (Google)/notificación (Outlook); si teleconsulta firmada, propaga meetingUrl.
Frontend público /confirm-appointment/:token: al cargar /info/:token, si appointmentType==='teleconsulta' redirigir a /teleconsulta/:token (replace) para que cualquier enlace lleve al flujo de firma.

============================================================
7) AGENDA IN-APP DEL PROPIETARIO (C1)
============================================================
GET /api/owners/my/appointments (auth rol OWNER): findMany where OR:[{patientId},{userId}], confirmationStatus in [PENDING,CONFIRMED,RESCHEDULED], date>=hace 14 días, include teleconsultation { meetingUrl, consentSigned }. Respuesta con manageLink (/teleconsulta/{token} o /confirm-appointment/{token}), meetingUrl, consentSigned, rescheduledFrom/To.

============================================================
8) TELECONSULTA + CONSENTIMIENTO (C7, C8)
============================================================
Endpoints públicos (/api/teleconsultation, token = confirmationToken):
  GET  /info/:token         -> exponer meetingUrl SOLO si consentSigned && meetingUrl.
  POST /sign-consent/:token -> body { signature } (min 3 chars).
Flujo de firma: validar firma y que sea teleconsulta; si ya firmado devolver meetingUrl; generar PDF (Puppeteer + plantilla Handlebars teleconsultation-consent-template.html, con AVISO DE PRIVACIDAD integrado, datos propietario+mascota, datos veterinario, fecha/hora, firma=nombre, IP, hash SHA-256); subir a S3/local; update Teleconsultation { consentSigned:true, consentPdfUrl, consentDocumentHash, consentIp, consentSignedAt }; llamar syncAppointmentCalendars(appointmentId, { responseStatus:'accepted' }) para crear Meet/Teams y guardar meetingUrl; audit logs + correos (veterinario + legal@pawcareplus.com con PDF); responder meetingUrl.
Frontend: ruta /teleconsulta/:token (TeleconsultationConsent): cargar info, formulario de firma; botón "Unirse" solo si el API devuelve meetingUrl (post-firma).
Correos (notification.service): cita teleconsulta -> bloque destacado con enlace a /teleconsulta/{token} (NO la liga de video) + descargo legal inline. Tras firmar -> PDF adjunto a veterinario y legal.

============================================================
9) PRE-REGISTRO (ClinicalIntake) + ENLACE AL STEP DE AGENDAR
============================================================
Rutas (/api/clinical-intakes):
  Públicas: GET /public/doctor/:doctorSlug ; POST /public/doctor/:doctorSlug/start (crea DRAFT, devuelve token) ; GET /public/:token ; PUT /public/:token (guardar borrador) ; POST /public/:token/submit ; POST /public/:token/upload.
  Staff (JWT): GET /portal-link ; POST /portal-link/regenerate ; GET / ; GET /:id ; PATCH /:id (APPROVED|REJECTED + staffNotes) ; POST /:id/convert ; POST /send-link.
Catálogos: motivos de consulta (incluir veterinarios: consulta general, vacunación, desparasitación, grooming, urgencia, teleconsulta) y categorías de archivo (cartilla de vacunación, estudios previos, recetas, fotos de lesiones, identificación, póliza). Expiración de enlace temporal: 14 días.
Formulario multi-paso: (0) datos del propietario, (1) DATOS DE LA MASCOTA + antecedentes (especie, raza, peso, alergias, padecimientos), (2) archivos, (3) Agenda / Enviar.
submit: exigir consentPrivacy && consentTreatment && consentPlatform y consentSignerName (>=3 chars); generar PDF con los 3 documentos legales (PRIVACY_POLICY, TERMS_OF_SERVICE, PLATFORM_CONTRACT); status -> SUBMITTED_PENDING_VALIDATION.
convert (staff): crea/vincula Owner+Pet+User+DoctorPatient, ClinicalCase, MedicalRecord con formData fusionado, vincula archivos + PDF; status -> CONVERTED. (convert NO crea la cita.)
VÍNCULO CON EL STEP DE AGENDAR: en el paso 3 del formulario, botón que guarda el borrador y abre la agenda compartida en pestaña nueva con el token del intake:  /agendar/{slug}?clinicalIntake={token}. La página /agendar lee ?clinicalIntake={token} -> GET /api/clinical-intakes/public/{token} para precargar nombre/email/teléfono del propietario y datos de la mascota.

============================================================
10) PÁGINAS Y ENLACES LEGALES
============================================================
Rutas frontend públicas: /aviso-privacidad (AvisoPrivacidad) y /terminos (TerminosDeUso, con ancla #contrato-plataforma). Con y sin barra final.
Fuentes backend para PDFs/correos: legal/privacyPolicyPdfHtml.ts y consentPdf.service.ts (CONSENT_CONTENT con PRIVACY_POLICY, TERMS_OF_SERVICE, PLATFORM_CONTRACT).
Mostrar los enlaces legales en: step de consentimiento del pre-registro (3 checkboxes con links a /aviso-privacidad y /terminos), registro de propietario, header/footer. URLs absolutas en correos a partir de FRONTEND_URL.

============================================================
11) ORDEN DE IMPLEMENTACIÓN
============================================================
1) Migraciones aditivas de los modelos. 2) OAuth + CalendarSyncConfig. 3) Servicios sync con disableConference + helper. 4) ScheduleService + agenda compartida (/api/agenda-pacientes) + página /agendar (PRIORIDAD). 5) confirm/cancel/reschedule por token. 6) agenda in-app del propietario. 7) teleconsulta + consentimiento + redirect /teleconsulta/:token. 8) pre-registro + vínculo ?clinicalIntake. 9) páginas legales + 3 consentimientos.

============================================================
12) CONSIDERACIONES PAWCAREPLUS
============================================================
- Adaptar nomenclatura: propietario + mascota (no paciente). PDF y formularios deben incluir datos de la mascota (especie, raza, peso).
- Aviso de privacidad y términos = los oficiales de PawCarePlus; correo legal = legal@pawcareplus.com.
- Solo Google Calendar y Outlook (no Apple/Notion).
- Todas las migraciones aditivas (no perder datos de propietarios/mascotas existentes).
- Verificar cuenta Microsoft de prueba con buzón Exchange + Teams.
```

---

## Texto de aviso de privacidad (ejemplo para el consentimiento de teleconsulta)

```
Aviso de privacidad: Al firmar este documento, el propietario consiente la realización de una consulta veterinaria a distancia mediante videollamada para su mascota. Los datos personales del propietario y los datos de la mascota serán tratados conforme al Aviso de Privacidad de PawCarePlus (LFPDPPP). La teleconsulta no sustituye la valoración presencial cuando sea necesaria. No se realizará grabación de video ni audio de la sesión.
```

---

## Adenda — Fixes afinados (29 mayo 2026), replicar también

```
============================================================
FIXES ADICIONALES DE CALENDARIO (ya en producción en Medilink360)
============================================================

1) LIGA DE VIDEO NO DUPLICADA
   - Problema: tras reprogramar una teleconsulta, el calendario del paciente
     mostraba 2 ligas (la nueva nativa + una vieja en el campo "location").
   - Regla de oro: la liga vive SOLO en el campo nativo de conferencia
     (conferenceData en Google / onlineMeeting en Teams). "location" NUNCA
     debe contener una URL de video.
   - Implementación: en buildEventBody de AMBOS servicios de sync, si
     location trae una URL (meet.google.com|teams.microsoft.com|zoom.us),
     enviar '' para borrarla. En Outlook location es objeto: { displayName: '' }.

2) EL PACIENTE PUEDE REPROGRAMAR/CANCELAR TELECONSULTAS
   - La página /teleconsulta/{token} debe reutilizar los MISMOS endpoints
     por token del flujo presencial:
       GET  /api/appointment-confirmation/reschedule/:token/available-slots?date=
       POST /api/appointment-confirmation/reschedule/:token
       POST /api/appointment-confirmation/cancel/:token
   - Mostrar "Reprogramar/Cancelar" antes y después de firmar.
   - El backend de reagenda es agnóstico al tipo (no filtra appointmentType):
     no dupliques lógica de servidor.

3) FIRMAR EL CONSENTIMIENTO = CONFIRMAR LA CITA
   - signTeleconsultationConsent debe marcar también:
       appointment.confirmationStatus = 'CONFIRMED', confirmedAt = now()
       confirmationRequest.status = 'RESPONDED', patientResponse = 'CONFIRMED'
   - UI: botón "Confirmar asistencia y firmar consentimiento" y estado
     posterior "Cita confirmada". NO agregar un botón "confirmar" separado.

4) CUALQUIER CITA REQUIERE CALENDARIO ENLAZADO
   - Motivo: la invitación al dispositivo del paciente se envía a través del
     calendario externo del doctor. Sin enlace -> el paciente solo recibe correo.
   - CREAR (createCalendarEvent): bloquear (HTTP 400 + mensaje claro) si el
     origenEvento (google/outlook) NO está conectado (CalendarSyncConfig.isConnected).
   - EDITAR/REPROGRAMAR (updateCalendarEvent): bloquear si el proveedor al que
     está vinculado el evento se desconectó. CANCELAR no se bloquea. Eventos
     internos (sin proveedor externo) no se bloquean.
   - FRONTEND: el modal de creación lee /api/calendar-sync/sync-status; si el
     calendario elegido no está enlazado, muestra aviso rojo y DESHABILITA
     "Crear Cita". En edición, mostrar el mensaje del backend por toast.
   - Veterinaria: el invitado del calendario es el email del PROPIETARIO.

5) VINCULO DURO CITA<->EVENTO (FIN DEL COLAPSO DE CITAS) — CRITICO
   - Sintoma del bug: crear una cita nueva ARRASTRABA todas las citas previas
     del mismo paciente a la misma fecha/hora; ligas "Gestiona tu cita"
     duplicadas; confirmaciones de citas hermanas; tormenta de PATCH -> 403
     Rate Limit en Google.
   - Causa: NO habia FK entre Appointment <-> InternalCalendarEvent <-> evento
     externo. Todo se emparejaba por heuristica (doctor+paciente+ventana de
     tiempo). Con 2+ citas cercanas del mismo paciente, colapsaban en 1 evento.
   - FIX (replicar las 4 partes):
     a) SCHEMA (migracion ADITIVA): InternalCalendarEvent.appointmentId String?
        @unique con FK a Appointment, onDelete: SetNull. Nullable => multi-NULL
        permitido, no rompe datos existentes.
     b) createCalendarEvent: setear appointmentId al crear; si la cita reutilizada
        ya tenia evento, ACTUALIZAR ese evento (no crear otro, por el @unique).
     c) syncAppointmentCalendars: emparejar 1) por appointmentId (findUnique);
        2) fallback por ventana de tiempo SOLO sobre eventos con appointmentId=null
        (no robar el evento de otra cita). Al crear/actualizar, RECLAMAR el vinculo.
     d) Sync inverso (proveedor->app, confirmacion por responseStatus del invitado):
        resolver la cita de forma DETERMINISTA via el FK del evento interno
        (matcheado por externalEventId), NO por paciente+ventana. Fallback por
        tiempo solo si no hay vinculo duro.
   - La ventana de tiempo queda SOLO como fallback para datos legados (appointmentId
     null). Sin esto, en cuanto un propietario tenga 2+ citas proximas, vuelve el bug.
   - Datos legados: appointmentId=NULL es inofensivo. Para limpiar data de prueba
     encimada, script tipo cleanup-test-patient-appointments.js (dry-run; --apply).
============================================================
```

---

*Prompt generado a partir del estado de Medilink360 / Qlinexa360 (mayo 2026). El asistente del repo de PawCarePlus debe revisar los textos legales y la nomenclatura veterinaria antes de producción.*
