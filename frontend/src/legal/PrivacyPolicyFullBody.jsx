import React from 'react';

/**
 * Texto único del Aviso de Privacidad (web, registro, consentimientos y referencia al PDF por correo).
 * Mantener alineado con frontend/aviso-privacidad/index.html y backend/src/legal/privacyPolicyPdfHtml.ts (PDF por correo).
 */
export default function PrivacyPolicyFullBody({ className = 'space-y-6 text-gray-700' }) {
  return (
    <div className={className}>
      <section>
        <h2 className="text-xl font-semibold text-blue-800 mb-3">AVISO DE PRIVACIDAD INTEGRAL - Qlinexa360</h2>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">1. Responsable del Tratamiento</h3>
        <p>Qlinexa360, plataforma digital de gestión médica, con domicilio digital en www.qlinexa360.com, es responsable del tratamiento de los datos personales recabados a través del sistema.</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">2. Finalidades del Tratamiento</h3>
        <p>Sus datos personales serán utilizados para: gestionar su registro en la plataforma; facilitar la comunicación entre profesionales de la salud y pacientes; mantener su historial clínico digital; enviar notificaciones relacionadas con su atención médica; cumplir con obligaciones legales y regulatorias.</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">3. Datos Personales Recopilados</h3>
        <p>Recopilamos: datos de identificación (nombre, email, teléfono); datos médicos (historial clínico, diagnósticos, tratamientos); datos de contacto de emergencia; datos fiscales (cuando aplique); datos de seguro médico (cuando aplique).</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">4. Transferencias</h3>
        <p>Sus datos pueden ser transferidos a profesionales de la salud autorizados, autoridades sanitarias cuando sea requerido por ley, y proveedores de servicios tecnológicos. No se realizarán transferencias a terceros salvo requerimiento de autoridad.</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">5. Medidas de Seguridad</h3>
        <p>Implementamos medidas técnicas, administrativas y físicas para proteger sus datos personales, incluyendo encriptación de datos, acceso restringido y auditorías regulares de seguridad. Los datos se almacenan en servidores cifrados.</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">6. Derechos ARCO</h3>
        <p>Usted tiene derecho a: Acceder a sus datos personales; Rectificar sus datos cuando sean inexactos; Cancelar el uso de sus datos; Oponerse al tratamiento de sus datos. Para ejercer estos derechos, envíe su solicitud a legal@qlinexa360.com.</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">7. Revocación del Consentimiento</h3>
        <p>Puede revocar su consentimiento en cualquier momento, sin embargo, esto puede limitar la funcionalidad de la plataforma.</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">8. Conservación de Datos</h3>
        <p>Sus datos se conservarán conforme a la normativa sanitaria mexicana (NOM-004-SSA3-2012) por un mínimo de 5 años desde el último acto médico.</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">9. Cambios al Aviso</h3>
        <p>Nos reservamos el derecho de modificar este aviso. Los cambios serán notificados a través de la plataforma.</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">10. Contacto</h3>
        <p>Para ejercer sus derechos ARCO o realizar consultas sobre este aviso, puede contactarnos a través de la plataforma o al correo electrónico legal@qlinexa360.com.</p>
      </section>

      <section className="border-t border-gray-200 pt-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">11. Integraciones con Google (Google Calendar y datos de cuenta Google)</h3>
        <p className="text-gray-800">
          La vinculación y sincronización con <strong>Google Calendar</strong> descrita en esta sección está disponible únicamente para cuentas con el rol <strong>Profesional de la Salud</strong>{' '}
          (por ejemplo, <strong>médico</strong> o <strong>enfermera</strong>, según el tipo de perfil habilitado en Qlinexa360). Pacientes, asistentes, administración u otros roles no tienen acceso a esta integración.
        </p>
        <p>
          Cuando un <strong>profesional de la salud</strong> elige vincular su calendario de Google, Qlinexa360 utiliza el protocolo <strong>OAuth 2.0</strong> de Google.
          La contraseña de Google <strong>no</strong> se recopila ni almacena; el usuario autoriza el acceso en el sitio de Google.
        </p>
        <p className="mt-3">
          <strong>Datos a los que accede la aplicación (Google):</strong> exactamente los indicados en la <strong>pantalla de consentimiento de Google</strong> al vincular el calendario.
          En la configuración actual de Qlinexa360 esto corresponde a datos de <strong>Google Calendar</strong> (incluidos eventos y la información necesaria para leer y mantener sincronizadas las citas),
          según los alcances OAuth aprobados por el usuario. La contraseña de Google no se recopila.
        </p>
        <p className="mt-3">
          <strong>Finalidad del uso:</strong> sincronizar citas y disponibilidad entre Qlinexa360 y el calendario de Google del profesional (crear, leer, actualizar o eliminar eventos según las acciones que el usuario realice en la plataforma),
          de modo que la agenda del consultorio y el calendario personal o laboral del profesional permanezcan alineados.
        </p>
        <p className="mt-3">
          <strong>Almacenamiento:</strong> los <strong>tokens de acceso y actualización</strong> que Google emite tras la autorización se almacenan en la base de datos de la aplicación,
          asociados únicamente a la cuenta del profesional que realizó la vinculación, para poder renovar el acceso y ejecutar la sincronización de forma segura.
          El tránsito de datos entre el navegador, nuestros servidores y Google utiliza <strong>HTTPS</strong>.
        </p>
        <p className="mt-3">
          <strong>Compartición:</strong> los datos obtenidos de Google <strong>no</strong> se venden. No utilizamos datos de Google Calendar para publicidad.
          Solo el personal y sistemas necesarios para operar Qlinexa360 procesan esta información, en la medida necesaria para prestar el servicio de sincronización de calendario.
        </p>
        <p className="mt-3">
          El profesional puede <strong>revocar</strong> el acceso en cualquier momento desde su cuenta de Google (seguridad de la cuenta / aplicaciones con acceso) y/o desconectando la integración en la configuración de calendario de Qlinexa360.
        </p>
        <p className="mt-4 text-gray-800">
          Qlinexa360 no utiliza los datos obtenidos mediante integraciones con Google, Microsoft u otros proveedores para entrenar modelos de inteligencia artificial, machine learning o sistemas automatizados de publicidad. La información accedida a través de APIs autorizadas se utiliza exclusivamente para proporcionar las funcionalidades solicitadas por el usuario, como sincronización de calendarios, gestión de citas y operación normal de la plataforma.
        </p>
        <p className="mt-3 text-gray-800">
          Qlinexa360 no vende, comparte ni transfiere datos de usuarios a terceros con fines comerciales o publicitarios. El acceso a la información se limita estrictamente a las funcionalidades autorizadas explícitamente por el usuario mediante procesos seguros de autenticación OAuth.
        </p>
      </section>

      <section className="border-t border-gray-200 pt-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">12. Integraciones con Microsoft (Outlook Calendar y Microsoft Graph)</h3>
        <p className="text-gray-800">
          La integración con <strong>Outlook</strong> y <strong>Microsoft Graph</strong> descrita en esta sección está sujeta a la misma regla de rol: solo puede activarla un usuario con rol <strong>Profesional de la Salud</strong>{' '}
          (<strong>médico</strong> o <strong>enfermera</strong>, según corresponda en la plataforma); los demás roles no pueden sincronizar calendarios externos con Microsoft.
        </p>
        <p>
          Cuando un <strong>profesional de la salud</strong> elige vincular su calendario de <strong>Outlook</strong> (Microsoft 365 / cuenta Microsoft personal o laboral), Qlinexa360 utiliza <strong>Microsoft Entra ID</strong> y el protocolo <strong>OAuth 2.0</strong> sobre <strong>Microsoft Graph</strong>.
          La contraseña de Microsoft <strong>no</strong> se recopila ni almacena; el usuario autoriza el acceso en el inicio de sesión de Microsoft.
        </p>
        <p className="mt-3">
          <strong>Servicios involucrados:</strong> integración con <strong>Microsoft Graph</strong> para acceder a <strong>Outlook Calendar</strong> y, cuando la configuración de la aplicación y el consentimiento lo permitan, funcionalidades relacionadas con reuniones en línea (por ejemplo Microsoft Teams) para telemedicina o videoconferencia, según los permisos delegados mostrados en la pantalla de consentimiento de Microsoft.
        </p>
        <p className="mt-3">
          <strong>Sincronización de agenda:</strong> los datos de calendario se utilizan para alinear citas y disponibilidad entre Qlinexa360 y el calendario de Outlook del profesional (lectura y, según las acciones del usuario en la plataforma, creación, actualización o eliminación de eventos), conforme a los alcances aceptados por el usuario.
        </p>
        <p className="mt-3">
          <strong>Almacenamiento de tokens:</strong> los <strong>tokens de acceso y actualización</strong> que Microsoft emite tras la autorización se almacenan en la base de datos de la aplicación, asociados únicamente a la cuenta del profesional que realizó la vinculación, para renovar el acceso y ejecutar la sincronización de forma segura. Las comunicaciones utilizan <strong>HTTPS (TLS)</strong>.
        </p>
        <p className="mt-3">
          <strong>Revocación:</strong> el profesional puede <strong>revocar</strong> el acceso desde su cuenta Microsoft (permisos de aplicaciones / consentimientos) y/o desconectando la integración en la configuración de calendario de Qlinexa360.
        </p>
        <p className="mt-4 text-gray-800">
          Qlinexa360 no utiliza los datos obtenidos mediante integraciones con Google, Microsoft u otros proveedores para entrenar modelos de inteligencia artificial, machine learning o sistemas automatizados de publicidad. La información accedida a través de APIs autorizadas se utiliza exclusivamente para proporcionar las funcionalidades solicitadas por el usuario, como sincronización de calendarios, gestión de citas y operación normal de la plataforma.
        </p>
        <p className="mt-3 text-gray-800">
          Qlinexa360 no vende, comparte ni transfiere datos de usuarios a terceros con fines comerciales o publicitarios. El acceso a la información se limita estrictamente a las funcionalidades autorizadas explícitamente por el usuario mediante procesos seguros de autenticación OAuth.
        </p>
      </section>

      <section className="border-t border-gray-200 pt-6 mt-6" lang="en" aria-labelledby="google-api-disclosure-heading">
        <h3 id="google-api-disclosure-heading" className="text-lg font-semibold text-blue-900 mb-2">
          Disclosure for Google API Services User Data Policy
        </h3>
        <p className="text-sm text-gray-600 mb-3" lang="es">
          <em>Apartado 13 del aviso.</em> La versión en español sobre Google Calendar y OAuth está en la sección 11; Microsoft Outlook/Graph en la sección 12.
        </p>
        <p className="text-gray-800">
          Qlinexa360 accesses Google Calendar data only when a healthcare professional connects their Google account through OAuth. The data accessed is limited to calendar information required to synchronize medical appointments, including creating, reading, updating, and deleting calendar events when the professional performs scheduling actions inside Qlinexa360.
        </p>
        <p className="mt-3 text-gray-800">
          Qlinexa360 uses Google Calendar data solely to provide calendar synchronization functionality between Qlinexa360 and the healthcare professional&apos;s Google Calendar.
        </p>
        <p className="mt-3 text-gray-800">
          Qlinexa360 does not sell Google user data, does not use Google user data for advertising, and does not use Google user data to develop, improve, or train generalized AI or machine learning models.
        </p>
        <p className="mt-3 text-gray-800">
          OAuth access and refresh tokens are stored securely and are used only to maintain the calendar synchronization authorized by the user.
        </p>
        <p className="mt-3 text-gray-800">
          Users may disconnect the Google Calendar integration from Qlinexa360 and revoke access from their Google Account security settings at any time.
        </p>
      </section>

      <section className="border-t border-gray-200 pt-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">14. Vigencia uniforme del aviso, registro y envío por correo</h3>
        <p>
          El presente <strong>Aviso de Privacidad</strong> es el mismo que se muestra en la plataforma en la ruta pública de aviso de privacidad, en los flujos de registro y consentimiento (incluidos todos los roles: profesional de la salud, paciente, asistente y administración, según aplique), y constituye la versión oficial aceptada por el usuario al registrarse por primera vez o al formalizar su consentimiento según el flujo correspondiente.
        </p>
        <p className="mt-3">
          Tras la aceptación registrada (incluida la firma o confirmación digital cuando el flujo lo requiera), Qlinexa360 puede enviar por <strong>correo electrónico</strong> un <strong>PDF</strong> que reproduce este aviso como constancia; dicho documento corresponde al mismo contenido del aviso descrito en esta página y en los flujos de la aplicación.
        </p>
      </section>
    </div>
  );
}
