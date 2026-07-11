import React from 'react';

/**
 * Integración Mercado Pago (Términos de Uso y Contrato).
 * Mantener alineado con backend/src/legal/mercadoPagoTermsPdfHtml.ts
 *
 * @param {{ sectionNumber?: number }} props — En /terminos suele ser 10; en RegisterDoctor términos, 13.
 */
export function MercadoPagoTermsOfUseSection({ sectionNumber = 10 }) {
  const s = sectionNumber;
  return (
    <section className="space-y-3 text-gray-800">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        {s}. Cobros con Mercado Pago (integración opcional)
      </h3>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.1 Naturaleza del servicio.</strong> Qlinexa360 ofrece, de forma{' '}
        <strong>opcional</strong>, una integración tecnológica con <strong>Mercado Pago</strong> para que el
        Profesional de la Salud pueda generar enlaces de cobro (Checkout Pro) a pacientes, principalmente por
        teleconsultas u otros servicios que el profesional habilite. Qlinexa360 actúa como{' '}
        <strong>integrador tecnológico y marketplace</strong>; no es parte del contrato de prestación de servicios
        médicos entre paciente y profesional.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.2 Cuenta del profesional.</strong> Para usar esta función, el Profesional de la Salud debe
        contar con una cuenta válida en Mercado Pago, enlazarla mediante OAuth en «Mi Perfil» y aceptar que
        Qlinexa360 cree preferencias de cobro en su nombre conforme a la configuración que defina (montos,
        condiciones y política de reembolsos).
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.3 Destino de los fondos.</strong> Los importes pagados por el paciente se acreditan en la
        cuenta de Mercado Pago del Profesional de la Salud, sujeto a las reglas, plazos y retenciones de Mercado
        Pago.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.4 Comisiones.</strong> <strong>Mercado Pago</strong> cobra su propia comisión de procesamiento,
        independiente de Qlinexa360. <strong>Qlinexa360</strong> cobra una{' '}
        <strong>comisión mínima de plataforma</strong> (marketplace_fee) sobre cada cobro procesado a través de
        esta integración, con el fin de operar, dar soporte y mantener la conexión técnica con Mercado Pago. El
        porcentaje o monto aplicable será el publicado en la plataforma o en la regla vigente al momento del cobro.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.5 Divulgación al conectar.</strong> Al activar Mercado Pago, el profesional reconoce que
        autoriza a Qlinexa360 a operar la integración, registrar transacciones en «Cobros Mercado Pago» y aplicar
        la comisión de plataforma indicada. El paciente, cuando corresponda, verá el monto a pagar y la política de
        reembolsos definida por el profesional antes de completar el pago.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.6 Facturación y responsabilidad.</strong> El cobro vía Mercado Pago no sustituye la emisión de
        comprobantes fiscales (CFDI) cuando la legislación lo exija; esa obligación corresponde al Profesional de
        la Salud. Reembolsos, contracargos y disputas entre paciente y profesional se rigen por la política del
        profesional, por Mercado Pago y por la ley aplicable; Qlinexa360 puede facilitar solicitudes y registro,
        sin asumir la relación médico-paciente.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.7 Exclusión de responsabilidad de Qlinexa360.</strong> La integración con Mercado Pago es{' '}
        <strong>opcional</strong>; el Profesional de la Salud puede usar Qlinexa360 sin activar cobros a pacientes.
        Qlinexa360 no es institución de crédito, procesador de pagos ni parte del contrato de prestación de servicios
        médicos entre profesional y paciente. No garantiza la aprobación, liquidación ni disponibilidad inmediata de
        fondos en Mercado Pago. Qlinexa360 <strong>no será responsable</strong> por fallas técnicas, demoras,
        retenciones, contracargos, rechazos, errores de terceros ni disputas económicas o médicas derivadas de cobros
        procesados mediante la integración, salvo dolo o culpa grave directamente imputable a Qlinexa360 conforme a la
        ley aplicable.
      </p>
    </section>
  );
}

/**
 * Cláusula breve para el Contrato de Uso de Plataforma.
 * @param {{ sectionNumber?: number }} props — En contrato corto suele ser 8; en RegisterDoctor contrato, 11.
 */
export function MercadoPagoContractSection({ sectionNumber = 8 }) {
  return (
    <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
      <strong>{sectionNumber}. Cobros opcionales con Mercado Pago.</strong> Cuando el Profesional de la Salud lo
      habilite, Qlinexa360 puede facilitar cobros a pacientes mediante Mercado Pago. El profesional debe enlazar su
      cuenta de Mercado Pago y autoriza a Qlinexa360 a crear preferencias de pago en su nombre. Los fondos se
      acreditan al profesional; Mercado Pago aplica su comisión de procesamiento y Qlinexa360 aplica una{' '}
      <strong>comisión mínima de plataforma</strong> para mantener la integración, conforme a la regla vigente.
      Qlinexa360 no es responsable de la relación de prestación de servicios médicos ni sustituye la facturación
      fiscal del profesional. Qlinexa360 no garantiza la operación de Mercado Pago ni responde por disputas de cobro
      entre profesional y paciente.
    </p>
  );
}
