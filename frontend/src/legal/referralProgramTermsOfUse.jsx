import React from 'react';

/**
 * Política de programa de referidos (Términos de Uso).
 * Mantener alineada con backend/src/legal/referralProgramTermsPdfHtml.ts
 *
 * @param {{ sectionNumber?: number }} props — En registro de doctor suele ser 12; en /terminos y PDF, 9.
 */
export function ReferralProgramTermsOfUseSection({ sectionNumber = 9 }) {
  const s = sectionNumber;
  return (
    <section className="space-y-3 text-gray-800">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        {s}. Programa de referidos (Qlinexa360)
      </h3>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.1 Ámbito.</strong> El programa de referidos está disponible únicamente para usuarios registrados
        como <strong>Profesional de la Salud (Doctor)</strong> y sujetos a las funcionalidades que Qlinexa360 habilite
        por configuración técnica o de producto. Qlinexa360 podrá activar, desactivar o limitar el programa sin afectar
        los beneficios ya acreditados conforme a las reglas vigentes al momento de cada acreditación.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.2 Código de referidor.</strong> Qlinexa360 puede asignar al doctor un <strong>código alfanumérico</strong>{' '}
        e invitación mediante enlace para que otros profesionales se registren indicando dicho código cuando el flujo
        de registro lo permita.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.3 Beneficio del profesional invitado (referido).</strong> Si el colega completa el registro y la
        suscripción de pago según el proceso habilitado (incluido el cobro recurrente con <strong>PayPal</strong> cuando
        aplique) y utiliza un código de referidor válido, podrá obtener, según las reglas técnicas vigentes en la
        plataforma, un <strong>periodo adicional de acceso sin el costo de suscripción de ese periodo</strong> (p. ej.
        un mes adicional) más los <strong>días de bienvenida o gracia</strong> que Qlinexa360 defina para el primer
        ciclo. Dichos periodos pueden <strong>acumularse</strong> con un <strong>código promocional válido</strong>{' '}
        distinto del código de referidor cuando las reglas del sistema lo permitan. <strong>No aplican</strong>{' '}
        beneficios de referido incompatibles con el tipo de acceso contratado (p. ej. promociones de acceso de por vida
        u otras modalidades que Qlinexa360 excluya expresamente en el registro). Los días exactos se calculan conforme
        a la lógica de registro y suscripción publicada en la aplicación.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.4 Beneficio del referidor (quien invita).</strong> Por cada colega que se registre con su código y
        mantenga una <strong>suscripción de pago activa</strong> según los criterios técnicos de Qlinexa360 (p. ej.
        suscripción activa con PayPal u otra modalidad calificada en la base de datos), Qlinexa360{' '}
        <strong>acreditará al referidor un crédito equivalente al 20% (veinte por ciento) de un mes</strong> de la
        suscripción de referencia, expresado como puntos porcentuales hacia un mes sin cargo de suscripción. Los
        créditos son <strong>acumulables</strong>: al alcanzar{' '}
        <strong>100% (cinco referidos acreditados en la modalidad 20% por referido)</strong>, la plataforma aplicará, en
        la medida técnicamente posible y sin requerir aceptaciones adicionales por cada ocurrencia,{' '}
        <strong>un (1) mes</strong> en el que, mediante la <strong>suspensión temporal de cargos en PayPal</strong> u
        otro mecanismo equivalente, el referidor <strong>no devengará el cargo recurrente habitual</strong> (p. ej.
        $499 MXN/mes IVA incluido o la tarifa vigente). El <strong>excedente</strong> por encima de 100%{' '}
        <strong>sigue acumulándose</strong> para el siguiente mes canjeado en bloques de 100%. No existe descuento
        fraccionario en cada recibo salvo lo que Qlinexa360 publique expresamente de forma distinta.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.5 Reanudación de cobros.</strong> Concluido el periodo de beneficio (incluidas las fechas de
        reanudación registradas y la reactivación en PayPal u otro proveedor), los{' '}
        <strong>cargos recurrentes vuelven al esquema estándar</strong> del plan (precio de lista) salvo otras
        promociones contratadas.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.6 Idempotencia y control.</strong> Cada colega referido genera, como máximo,{' '}
        <strong>una acreditación</strong> de referidor, para evitar duplicados. Qlinexa360 conservará evidencia razonable
        conforme a sus políticas de seguridad y datos.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.7 Conductas prohibidas.</strong> Autoreferencias, cuentas falsas, manipulación de pagos o cualquier
        abuso del programa. Qlinexa360 podrá <strong>denegar, revocar o ajustar</strong> beneficios y aplicar las medidas
        contractuales y legales procedentes.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.8 Fiscalidad e información.</strong> Los beneficios pueden tener implicaciones fiscales; cada
        usuario es responsable de consultar a su asesor. El programa es de <strong>fidelización comercial</strong>;
        Qlinexa360 no garantiza un número mínimo de referidos ni un resultado económico determinado.
      </p>
      <p className="text-sm leading-relaxed md:text-base md:leading-relaxed">
        <strong>{s}.9 Modificación del programa.</strong> Qlinexa360 podrá ajustar porcentajes, umbrales, duraciones,
        elegibilidad y compatibilidad con promociones, actualizando estos Términos y la interfaz. Los cambios no
        reducirán retroactivamente el valor de los créditos ya acreditados salvo imperativo legal o corrección de error
        demostrable.
      </p>
    </section>
  );
}
