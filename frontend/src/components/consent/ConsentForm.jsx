import React from 'react';
import PrivacyPolicyFullBody from '../../legal/PrivacyPolicyFullBody';
import { ReferralProgramTermsOfUseSection } from '../../legal/referralProgramTermsOfUse';
import {
  MercadoPagoContractSection,
  MercadoPagoTermsOfUseSection,
} from '../../legal/mercadoPagoTermsOfUse';

/**
 * Formulario de consentimientos legales (Aviso de Privacidad, Términos, Contrato, Firma Digital).
 * Reutilizable para paciente (tras configurar contraseña) y asistente (tras completar registro).
 */
const ConsentForm = ({ form, onChange, onSubmit, isLoading, error }) => {
  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Consentimientos Legales</h3>
        <p className="text-base text-gray-600">Revise y acepte nuestras políticas para completar su registro</p>
      </div>

      {/* Aviso de Privacidad */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <div className="flex items-center mb-4">
          <span className="font-semibold text-blue-700 text-lg">Aviso de Privacidad</span>
        </div>
        <div className="max-h-[min(70vh,28rem)] overflow-y-auto bg-white p-4 rounded border border-gray-100 text-sm mb-4">
          <PrivacyPolicyFullBody className="space-y-4 text-gray-700 [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-semibold" />
        </div>
        <label className="flex items-center">
          <input
            type="checkbox"
            name="acceptPrivacy"
            checked={form.acceptPrivacy}
            onChange={(e) => onChange({ ...form, acceptPrivacy: e.target.checked })}
            className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-base font-medium">He leído y acepto el Aviso de Privacidad *</span>
        </label>
      </div>

      {/* Términos de Uso */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <div className="flex items-center mb-4">
          <span className="font-semibold text-blue-700 text-lg">Términos de Uso</span>
        </div>
        <div className="max-h-[min(70vh,28rem)] overflow-y-auto bg-white p-4 rounded border border-gray-100 text-sm text-gray-700 mb-4">
          <div className="space-y-3">
            <p><b>1. Aceptación del usuario:</b> Al registrarse y utilizar la plataforma Qlinexa360, el usuario acepta los presentes Términos de Uso, que regulan el acceso y uso de la plataforma web y móvil.</p>
            <p><b>2. Definiciones:</b> Plataforma: Sistema digital ofrecido por Qlinexa360. Profesional de la Salud: Usuario médico que gestiona pacientes. Paciente: Usuario que accede o es registrado con fines de consulta y seguimiento clínico.</p>
            <p><b>3. Uso permitido:</b> El uso está limitado a la consulta, registro, edición y gestión de información médica, conforme a la legislación sanitaria aplicable en México.</p>
            <p><b>4. Registro y veracidad de información:</b> El usuario se compromete a proporcionar información verdadera, completa y actualizada. Qlinexa360 se reserva el derecho de suspender cuentas que incumplan esta disposición.</p>
            <p><b>5. Responsabilidades del usuario:</b> Mantener la confidencialidad de su acceso. Usar los datos de manera ética y legal. Informar a sus profesionales de la salud sobre el uso de sus datos personales.</p>
            <p><b>6. Propiedad intelectual:</b> Todos los contenidos, diseños y elementos visuales son propiedad exclusiva de Qlinexa360 y no podrán ser reproducidos sin autorización.</p>
            <p><b>7. Suspensión y cancelación:</b> La plataforma podrá suspender el acceso a usuarios que no cumplan los presentes términos o usen la plataforma de forma inapropiada.</p>
            <p><b>8. Limitación de responsabilidad:</b> Qlinexa360 no se hace responsable de diagnósticos clínicos ni consecuencias médicas derivadas del uso de la información registrada por los usuarios.</p>
            <ReferralProgramTermsOfUseSection sectionNumber={9} />
            <MercadoPagoTermsOfUseSection sectionNumber={10} />
            <p><b>Naturaleza de la plataforma:</b> Qlinexa360 no presta servicios médicos, no realiza diagnósticos ni prescribe tratamientos. La plataforma actúa únicamente como intermediario tecnológico para la gestión de información clínica. Qlinexa360 es una plataforma tecnológica de gestión clínica. Las recetas, consultas, citas y seguimiento son emitidas exclusivamente por el profesional de la salud que la suscribe, quien es el único responsable del diagnóstico, tratamiento y prescripción.</p>
            <p>Qlinexa360 es una plataforma tecnológica de apoyo a la gestión clínica. No actúa como establecimiento médico, no sustituye el juicio profesional y no se ostenta como sistema certificado o autorizado por autoridad sanitaria salvo que expresamente se indique con el documento oficial correspondiente.</p>
            <p><b>11. Modificaciones:</b> Los términos podrán modificarse y se notificarán a los usuarios registrados. El uso continuo implicará su aceptación.</p>
            <p><b>12. Legislación aplicable:</b> Este documento se rige conforme a las leyes mexicanas, incluyendo la LFPDPPP y la NOM-004-SSA3-2012.</p>
            <p><b>Cláusula de Comunicación:</b> El usuario acepta recibir comunicación a través de correo electrónico, WhatsApp y a través de la misma plataforma Qlinexa360 en la sesión de usuario registrado; acepta que esta comunicación es profesional y enfocada a fomentar una buena atención Clínica y responsable entre Profesionales de la Salud, Pacientes y Asistentes de Profesionales de la Salud.</p>
          </div>
        </div>
        <label className="flex items-center">
          <input
            type="checkbox"
            name="acceptTerms"
            checked={form.acceptTerms}
            onChange={(e) => onChange({ ...form, acceptTerms: e.target.checked })}
            className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-base font-medium">Acepto los Términos de Uso de Qlinexa360 *</span>
        </label>
      </div>

      {/* Contrato de Uso de Plataforma */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <div className="flex items-center mb-4">
          <span className="font-semibold text-blue-700 text-lg">Contrato de Uso de Plataforma</span>
        </div>
        <div className="max-h-48 overflow-y-auto bg-white p-4 rounded border border-gray-100 text-sm text-gray-700 mb-4">
          <div className="space-y-3">
            <p><b>Contrato de Uso y Responsabilidad - Plataforma Qlinexa360</b></p>
            <p><b>1. Objeto:</b> Este contrato establece las condiciones legales de uso de la plataforma Qlinexa360, la cual permite el registro, almacenamiento, consulta y gestión de información médica de pacientes.</p>
            <p><b>2. Acceso y uso:</b> El paciente tendrá acceso a su información médica personal y podrá compartirla con los profesionales de la salud autorizados dentro de la plataforma.</p>
            <p><b>3. Conservación de datos:</b> La Plataforma se obliga a conservar los expedientes clínicos conforme a la NOM-004-SSA3-2012, por un mínimo de 5 años desde el último acto médico registrado.</p>
            <p><b>4. Protección de datos personales:</b> La información del paciente está protegida bajo la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP). Los datos se almacenan de forma cifrada y solo el profesional de la salud autorizado y el paciente acceden a ellos.</p>
            <p><b>5. Consentimiento informado:</b> El paciente deberá aceptar el presente contrato y firmar de forma digital, registrando nombre completo, fecha y hora (timestamp). Este consentimiento forma parte del proceso de registro.</p>
            <p><b>6. Responsabilidad del paciente:</b> El paciente es responsable de proporcionar información médica veraz, mantener la confidencialidad de su acceso y usar la plataforma de manera ética y conforme a la ley.</p>
            <p><b>7. Comunicación médica:</b> La plataforma facilita la comunicación entre pacientes y profesionales de la salud, pero no sustituye la consulta médica presencial cuando sea necesaria.</p>
            <p><b>Naturaleza de la plataforma:</b> Qlinexa360 no presta servicios médicos, no realiza diagnósticos ni prescribe tratamientos. La plataforma actúa únicamente como intermediario tecnológico para la gestión de información clínica. Qlinexa360 es una plataforma tecnológica de gestión clínica. Las recetas, consultas, citas y seguimiento son emitidas exclusivamente por el profesional de la salud que la suscribe, quien es el único responsable del diagnóstico, tratamiento y prescripción.</p>
            <p>Qlinexa360 es una plataforma tecnológica de apoyo a la gestión clínica. No actúa como establecimiento médico, no sustituye el juicio profesional y no se ostenta como sistema certificado o autorizado por autoridad sanitaria salvo que expresamente se indique con el documento oficial correspondiente.</p>
            <MercadoPagoContractSection sectionNumber={8} />
            <p><b>9. Modificaciones:</b> Este contrato podrá modificarse y se notificarán los cambios a los usuarios registrados. El uso continuo implicará su aceptación.</p>
            <p><b>10. Legislación aplicable:</b> Este contrato se rige conforme a las leyes mexicanas aplicables.</p>
            <p><b>Cláusula de Comunicación:</b> El usuario acepta recibir comunicación a través de correo electrónico, WhatsApp y a través de la misma plataforma Qlinexa360 en la sesión de usuario registrado; acepta que esta comunicación es profesional y enfocada a fomentar una buena atención Clínica y responsable entre Profesionales de la Salud, Pacientes y Asistentes de Profesionales de la Salud.</p>
          </div>
        </div>
        <label className="flex items-center">
          <input
            type="checkbox"
            name="acceptContract"
            checked={form.acceptContract}
            onChange={(e) => onChange({ ...form, acceptContract: e.target.checked })}
            className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-base font-medium">Acepto el Contrato de Uso de Plataforma *</span>
        </label>
      </div>

      {/* Firma Digital */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <div className="flex items-center mb-4">
          <span className="font-semibold text-blue-700 text-lg">Firma Digital</span>
        </div>
        <div className="mb-4">
          <p className="text-gray-700 text-base mb-2">
            Al escribir tu nombre completo en el campo de abajo, confirmas que has leído, comprendido y aceptas todos los documentos legales anteriores.
          </p>
          <input
            type="text"
            name="signature"
            value={form.signature}
            onChange={(e) => onChange({ ...form, signature: e.target.value })}
            placeholder="Escribe tu nombre completo"
            className="w-full text-base border border-gray-300 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || !form.acceptPrivacy || !form.acceptTerms || !form.acceptContract || !form.signature?.trim()}
        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Registrando consentimientos...' : 'Aceptar y Continuar'}
      </button>
    </div>
  );
};

export default ConsentForm;
