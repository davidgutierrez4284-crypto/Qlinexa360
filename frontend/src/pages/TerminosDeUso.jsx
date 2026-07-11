import React from 'react';
import { ReferralProgramTermsOfUseSection } from '../legal/referralProgramTermsOfUse';
import {
  MercadoPagoContractSection,
  MercadoPagoTermsOfUseSection,
} from '../legal/mercadoPagoTermsOfUse';

const TerminosDeUso = () => {
  return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-6">Términos de Uso</h1>
          <p className="text-gray-600 mb-8">Última actualización: Julio 2026</p>

          <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">1. Aceptación del usuario</h3>
              <p>Al registrarse y utilizar la plataforma Qlinexa360, el usuario acepta los presentes Términos de Uso, que regulan el acceso y uso de la plataforma web y móvil.</p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">2. Definiciones</h3>
              <p><strong>Plataforma:</strong> Sistema digital ofrecido por Qlinexa360. <strong>Profesional de la Salud:</strong> Usuario médico que gestiona pacientes. <strong>Paciente:</strong> Usuario que accede o es registrado con fines de consulta y seguimiento clínico.</p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">3. Uso permitido</h3>
              <p>El uso está limitado a la consulta, registro, edición y gestión de información médica, conforme a la legislación sanitaria aplicable en México.</p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">4. Registro y veracidad de información</h3>
              <p>El usuario se compromete a proporcionar información verdadera, completa y actualizada. Qlinexa360 se reserva el derecho de suspender cuentas que incumplan esta disposición.</p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">5. Responsabilidades del usuario</h3>
              <p>Mantener la confidencialidad de su acceso. Usar los datos de manera ética y legal. Informar a sus pacientes sobre el uso de sus datos personales.</p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">6. Propiedad intelectual</h3>
              <p>Todos los contenidos, diseños y elementos visuales son propiedad exclusiva de Qlinexa360 y no podrán ser reproducidos sin autorización.</p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">7. Suspensión y cancelación</h3>
              <p>La plataforma podrá suspender el acceso a usuarios que no cumplan los presentes términos, no cubran el pago mensual correspondiente o usen la plataforma de forma inapropiada.</p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">8. Limitación de responsabilidad</h3>
              <p>Qlinexa360 no se hace responsable de diagnósticos clínicos ni consecuencias médicas derivadas del uso de la información registrada por los usuarios.</p>
            </section>

            <ReferralProgramTermsOfUseSection sectionNumber={9} />

            <MercadoPagoTermsOfUseSection sectionNumber={10} />

            <section className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <h3 className="text-lg font-semibold text-amber-900 mb-2">Naturaleza de la plataforma</h3>
              <p className="mb-3">Qlinexa360 no presta servicios médicos, no realiza diagnósticos ni prescribe tratamientos. La plataforma actúa únicamente como intermediario tecnológico para la gestión de información clínica.</p>
              <p className="mb-3">Qlinexa360 es una plataforma tecnológica de gestión clínica. Las recetas, consultas, citas y seguimiento son emitidas exclusivamente por el profesional de la salud que la suscribe, quien es el único responsable del diagnóstico, tratamiento y prescripción.</p>
              <p>Qlinexa360 es una plataforma tecnológica de apoyo a la gestión clínica. No actúa como establecimiento médico, no sustituye el juicio profesional y no se ostenta como sistema certificado o autorizado por autoridad sanitaria salvo que expresamente se indique con el documento oficial correspondiente.</p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">11. Modificaciones</h3>
              <p>Los términos podrán modificarse y se notificarán a los usuarios registrados. El uso continuo implicará su aceptación.</p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">12. Legislación aplicable</h3>
              <p>Este documento se rige conforme a las leyes mexicanas, incluyendo la LFPDPPP y la NOM-004-SSA3-2012.</p>
            </section>

            <section className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Cláusula de Comunicación</h3>
              <p>El usuario acepta recibir comunicación a través de correo electrónico, WhatsApp y a través de la misma plataforma Qlinexa360 en la sesión de usuario registrado; acepta que esta comunicación es profesional y enfocada a fomentar una buena atención clínica y responsable entre Profesionales de la Salud, Pacientes y Asistentes de Profesionales de la Salud.</p>
            </section>

            <section id="contrato-plataforma" className="scroll-mt-24 pt-8 border-t border-gray-200">
              <h2 className="text-2xl font-bold text-blue-900 mb-2">Contrato de uso de la plataforma</h2>
              <p className="text-gray-600 text-sm mb-6">
                Documento aceptado en el registro y en formularios públicos (pre-consulta, consentimientos digitales).
              </p>
              <div className="space-y-4 text-gray-700">
                <p>
                  <strong>Contrato de Uso y Responsabilidad — Plataforma Qlinexa360</strong>
                </p>
                <p>
                  <strong>1. Objeto:</strong> Este contrato establece las condiciones legales de uso de la plataforma
                  Qlinexa360, la cual permite el registro, almacenamiento, consulta y gestión de información médica de
                  pacientes.
                </p>
                <p>
                  <strong>2. Acceso y uso:</strong> El paciente tendrá acceso a su información médica personal y podrá
                  compartirla con los profesionales de la salud autorizados dentro de la plataforma.
                </p>
                <p>
                  <strong>3. Conservación de datos:</strong> La plataforma se obliga a conservar los expedientes clínicos
                  conforme a la NOM-004-SSA3-2012, por un mínimo de 5 años desde el último acto médico registrado.
                </p>
                <p>
                  <strong>4. Protección de datos personales:</strong> La información del paciente está protegida bajo la
                  Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP). Los datos se
                  almacenan de forma cifrada y solo el profesional de la salud autorizado y el paciente acceden a ellos.
                </p>
                <p>
                  <strong>5. Consentimiento informado:</strong> El paciente deberá aceptar el presente contrato y firmar
                  de forma digital, registrando nombre completo, fecha y hora (timestamp). Este consentimiento forma parte
                  del proceso de registro o de la pre-consulta.
                </p>
                <p>
                  <strong>6. Responsabilidad del paciente:</strong> El paciente es responsable de proporcionar
                  información médica veraz, mantener la confidencialidad de su acceso y usar la plataforma de manera ética
                  y conforme a la ley.
                </p>
                <p>
                  <strong>7. Comunicación médica:</strong> La plataforma facilita la comunicación entre pacientes y
                  profesionales de la salud, pero no sustituye la consulta médica presencial cuando sea necesaria.
                </p>
                <p>
                  <strong>Naturaleza de la plataforma:</strong> Qlinexa360 no presta servicios médicos, no realiza
                  diagnósticos ni prescribe tratamientos. La plataforma actúa únicamente como intermediario tecnológico
                  para la gestión de información clínica.
                </p>
                <MercadoPagoContractSection sectionNumber={8} />
                <p>
                  <strong>9. Modificaciones:</strong> Este contrato podrá modificarse y se notificarán los cambios a los
                  usuarios registrados. El uso continuo implicará su aceptación.
                </p>
                <p>
                  <strong>10. Legislación aplicable:</strong> Este contrato se rige conforme a las leyes mexicanas
                  aplicables.
                </p>
                <p>
                  <strong>Cláusula de Comunicación:</strong> El usuario acepta recibir comunicación a través de correo
                  electrónico, WhatsApp y a través de la misma plataforma Qlinexa360 en la sesión de usuario registrado.
                </p>
              </div>
            </section>
          </div>

          <footer className="mt-10 pt-6 border-t border-gray-200 text-gray-700 text-sm space-y-2">
            <p>
              <span className="font-semibold">Contacto:</span>{' '}
              <a href="mailto:admin@qlinexa360.com" className="text-blue-600 hover:text-blue-800">admin@qlinexa360.com</a>
              {' · '}
              <a href="mailto:legal@qlinexa360.com" className="text-blue-600 hover:text-blue-800">legal@qlinexa360.com</a>
            </p>
            <p><span className="font-semibold">Última actualización:</span> Julio 2026</p>
          </footer>
        </div>
      </div>
  );
};

export default TerminosDeUso;
