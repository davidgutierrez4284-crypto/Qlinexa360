import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';

const TerminosDeUso = () => {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-6">Términos de Uso</h1>
          <p className="text-gray-600 mb-8">Última actualización: Qlinexa360</p>

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

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">9. Modificaciones</h3>
              <p>Los términos podrán modificarse y se notificarán a los usuarios registrados. El uso continuo implicará su aceptación.</p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">10. Legislación aplicable</h3>
              <p>Este documento se rige conforme a las leyes mexicanas, incluyendo la LFPDPPP y la NOM-004-SSA3-2012.</p>
            </section>

            <section className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Cláusula de Comunicación</h3>
              <p>El usuario acepta recibir comunicación a través de correo electrónico, WhatsApp y a través de la misma plataforma Qlinexa360 en la sesión de usuario registrado; acepta que esta comunicación es profesional y enfocada a fomentar una buena atención clínica y responsable entre Profesionales de la Salud, Pacientes y Asistentes de Profesionales de la Salud.</p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-gray-200">
            <Link to="/benefits" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Volver a beneficios
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default TerminosDeUso;
