import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';

const AvisoPrivacidad = () => {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-6">Aviso de Privacidad</h1>
          <p className="text-gray-600 mb-8">Última actualización: Qlinexa360</p>

          <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
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

export default AvisoPrivacidad;
