console.log("RegisterDoctor wizard cargado");
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '@mui/material';
import PhoneInput from '../components/common/PhoneInput';
import { isValidE164 } from '../constants/countries';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { toast } from 'react-hot-toast';
import { getApiUrl } from '../utils/api';

const steps = [
  'Información Personal',
  'Datos Profesionales',
  'Facturación (opcional)',
  'Consentimientos Legales',
  'Pago y Activación',
];

const RegisterDoctor = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    profilePhoto: null,
    officeAddress: '',
    officeColony: '',
    officeCity: '',
    officeState: '',
    officeZip: '',
    licenseNumber: '',
    specialty: '',
    taxName: '',
    taxId: '',
    taxStreet: '',
    taxColony: '',
    taxCity: '',
    taxState: '',
    taxZip: '',
    taxCountry: '',
    taxCertificate: null,
    promoCode: '',
    acceptPrivacy: false,
    acceptTerms: false,
    acceptContract: false,
    signature: '',
    paypalSubscriptionId: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [legalError, setLegalError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [stepError, setStepError] = useState('');
  const [promoCodeStatus, setPromoCodeStatus] = useState('');
  const [promoCodeType, setPromoCodeType] = useState('');
  const [promoCodeLoading, setPromoCodeLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stepper visual - responsive: compacto en móvil (incl. landscape), completo en tablet/desktop
  const Stepper = () => (
    <div className="flex flex-col items-center mb-4 w-full overflow-hidden">
      {/* Móvil y móvil landscape: solo círculos + "Paso X de Y" (lg:1024px evita overflow en horizontal) */}
      <div className="flex flex-col items-center w-full lg:hidden">
        <p className="text-sm font-medium text-gray-700 mb-2">
          Paso {step + 1} de {steps.length}: <span className="text-blue-600 font-semibold">{steps[step]}</span>
        </p>
        <div className="flex items-center justify-center gap-1 w-full overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          {steps.map((label, idx) => (
            <React.Fragment key={label}>
              <div
                className={`flex-shrink-0 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold ${step === idx ? 'bg-blue-600 text-white' : step < idx ? 'bg-gray-200 text-gray-500' : 'bg-blue-400 text-white'}`}
                title={label}
              >
                {idx + 1}
              </div>
              {idx < steps.length - 1 && <div className={`flex-shrink-0 w-4 h-0.5 rounded ${idx < step ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>
      {/* Tablet y desktop (≥1024px): stepper completo con etiquetas */}
      <div className="hidden lg:flex flex-row justify-center w-full">
        {steps.map((label, idx) => (
          <div key={label} className="flex items-center">
            <div className={`rounded-full w-8 h-8 flex items-center justify-center font-bold text-white ${step === idx ? 'bg-blue-600' : 'bg-gray-300'}`}>{idx + 1}</div>
            <span className={`ml-2 mr-4 text-sm whitespace-nowrap ${step === idx ? 'text-blue-700 font-semibold' : 'text-gray-500'}`}>{label}</span>
            {idx < steps.length - 1 && <div className="w-8 h-1 bg-gray-200 mx-1 rounded flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );

  // Manejo de inputs
  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: checked }));
    } else if (type === 'file') {
      setForm((prev) => ({ ...prev, [name]: files[0] }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Validación de contraseñas
  const handlePasswordChange = (e) => {
    setForm((prev) => ({ ...prev, password: e.target.value }));
    if (form.confirmPassword && e.target.value !== form.confirmPassword) {
      setPasswordError('No coincide la contraseña');
    } else {
      setPasswordError('');
    }
  };
  const handleConfirmPasswordChange = (e) => {
    setForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
    if (form.password && e.target.value !== form.password) {
      setPasswordError('No coincide la contraseña');
    } else {
      setPasswordError('');
    }
  };

  // Validación de correo
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, email: value }));
    if (!value.includes('@')) {
      setEmailError('El correo debe contener una arroba (@)');
    } else {
      setEmailError('');
    }
  };

  // Validación de celular (formato E.164 internacional)
  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, phone: value }));
    if (!value) setPhoneError('');
    else if (!isValidE164(value)) setPhoneError('Ingresa un número con código de país (formato internacional)');
    else setPhoneError('');
  };

  // Navegación entre pasos con validación de campos obligatorios
  const nextStep = () => {
    setStepError('');
    if (step === 0) {
      if (!form.email || emailError) {
        setStepError('Debes ingresar un correo válido.');
        return;
      }
      if (!form.password || !form.confirmPassword || passwordError) {
        setStepError('Debes ingresar y confirmar la contraseña correctamente.');
        return;
      }
    }
    if (step === 1) {
      if (!form.licenseNumber) {
        setStepError('La cédula profesional es obligatoria.');
        return;
      }
    }
    setStep((s) => s + 1);
  };
  const prevStep = () => setStep((s) => (s > 0 ? s - 1 : 0));

  // Validación legal
  const handleLegalSubmit = (e) => {
    e.preventDefault();
    if (!form.acceptPrivacy || !form.acceptTerms || !form.acceptContract || !form.signature) {
      setLegalError('Debes aceptar todos los consentimientos y firmar con tu nombre completo.');
      return;
    }
    setLegalError('');
    // Aquí se enviaría el formulario completo al backend
    // ...
    alert('¡Registro completo! (Simulado)');
    navigate('/login');
  };

  // Validar código promocional
  const validatePromoCode = async () => {
    setPromoCodeStatus('');
    setPromoCodeType('');
    if (!form.promoCode) return;
    setPromoCodeLoading(true);
    try {
      const response = await axios.post('/api/promo/validate', {
        code: form.promoCode
      });
      setPromoCodeStatus(response.data?.message || '¡Código válido!');
      setPromoCodeType(response.data?.type || '');
    } catch (error) {
      setPromoCodeStatus(error.response?.data?.message || 'El código no es válido o ya fue usado.');
    } finally {
      setPromoCodeLoading(false);
    }
  };

  // Renderizado de cada paso
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6 w-full max-w-xl mx-auto">
            <div className="flex flex-col items-center">
              <div className="relative mb-2">
                <label htmlFor="profilePhoto">
                  <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center cursor-pointer border-4 border-white shadow">
                    {form.profilePhoto ? (
                      <img src={URL.createObjectURL(form.profilePhoto)} alt="Foto" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    )}
                  </div>
                  <div className="absolute bottom-2 right-2 bg-blue-600 rounded-full p-2 text-white cursor-pointer">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6-6m2 2l-6 6m-2 2h6" /></svg>
                  </div>
                  <input type="file" id="profilePhoto" name="profilePhoto" accept="image/*" className="hidden" onChange={handleChange} />
                </label>
              </div>
              <span className="text-gray-500 text-sm mb-4">Foto de perfil</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input type="text" name="firstName" value={form.firstName} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Apellidos</label>
                <input type="text" name="lastName" value={form.lastName} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                <input type="email" name="email" value={form.email} onChange={handleEmailChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
                {emailError && <span className="text-red-500 text-xs">{emailError}</span>}
              </div>
              <div>
                <PhoneInput
                  name="phone"
                  label="Celular"
                  value={form.phone}
                  onChange={handlePhoneChange}
                  required
                  error={phoneError}
                  placeholder="Ej: 55 1234 5678"
                  showTooltip
                  tooltipTitle="Es importante para que se envíen mensajes a través de Qlinexa360"
                  TooltipComponent={Tooltip}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                <input type="password" name="password" value={form.password} onChange={handlePasswordChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirmar Contraseña</label>
                <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleConfirmPasswordChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
                {passwordError && <span className="text-red-500 text-xs">{passwordError}</span>}
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center">
                Dirección de consultorio (opcional)
                <Tooltip title="Puedes dejar este campo vacío si no tienes consultorio fijo.">
                  <svg className="w-4 h-4 ml-1 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" /></svg>
                </Tooltip>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
                <input type="text" name="officeAddress" placeholder="Calle y número" value={form.officeAddress} onChange={handleChange} className="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                <input type="text" name="officeColony" placeholder="Colonia" value={form.officeColony} onChange={handleChange} className="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                <input type="text" name="officeCity" placeholder="Ciudad" value={form.officeCity} onChange={handleChange} className="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                <input type="text" name="officeState" placeholder="Estado" value={form.officeState} onChange={handleChange} className="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                <input type="text" name="officeZip" placeholder="Código Postal" value={form.officeZip} onChange={handleChange} className="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Número de Cédula Profesional</label>
                <input type="text" name="licenseNumber" value={form.licenseNumber} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Especialidad</label>
                <input type="text" name="specialty" value={form.specialty} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Título Profesional</label>
                <input type="text" name="professionalTitle" value={form.professionalTitle} onChange={handleChange} placeholder="como lo escribas aquí, aparecerá en las recetas" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400" required />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Razón Social</label>
                <input type="text" name="taxName" value={form.taxName} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">RFC</label>
                <input type="text" name="taxId" value={form.taxId} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Dirección Fiscal</label>
                <input type="text" name="taxStreet" value={form.taxStreet} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Colonia</label>
                <input type="text" name="taxColony" value={form.taxColony} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Ciudad</label>
                <input type="text" name="taxCity" value={form.taxCity} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Estado</label>
                <input type="text" name="taxState" value={form.taxState} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Código Postal</label>
                <input type="text" name="taxZip" value={form.taxZip} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">País</label>
                <input type="text" name="taxCountry" value={form.taxCountry} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Constancia de Situación Fiscal</label>
              <input type="file" name="taxCertificate" accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} className="mt-1 block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-50 file:text-indigo-700
                hover:file:bg-indigo-100" />
            </div>
            {stepError && <div className="text-red-500 text-sm mt-2">{stepError}</div>}
          </div>
        );
      case 3:
        // Consentimientos legales
        try {
          return (
            <div className="space-y-6">
              {/* Aviso de Privacidad */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-center mb-4">
                  <span className="font-semibold text-blue-700 text-lg">Aviso de Privacidad</span>
                </div>
                <div className="max-h-48 overflow-y-scroll bg-white p-4 rounded border border-gray-100 text-sm text-gray-700 mb-4" style={{ scrollbarGutter: 'stable' }}>
                  <div className="space-y-3">
                    <p><b>AVISO DE PRIVACIDAD INTEGRAL - Qlinexa360</b></p>
                    <p><b>1. Responsable del Tratamiento</b></p>
                    <p>Qlinexa360, plataforma digital de gestión médica, con domicilio digital en www.qlinexa360.com, es responsable del tratamiento de los datos personales recabados a través del sistema.</p>
                    <p><b>2. Finalidades del Tratamiento</b></p>
                    <p>Sus datos personales serán utilizados para: gestionar su registro en la plataforma; facilitar la comunicación entre profesionales de la salud y pacientes; mantener su historial clínico digital; enviar notificaciones relacionadas con su atención médica; cumplir con obligaciones legales y regulatorias.</p>
                    <p><b>3. Datos Personales Recopilados</b></p>
                    <p>Recopilamos: datos de identificación (nombre, email, teléfono); datos médicos (historial clínico, diagnósticos, tratamientos); datos de contacto de emergencia; datos fiscales (cuando aplique); datos de seguro médico (cuando aplique).</p>
                    <p><b>4. Transferencias</b></p>
                    <p>Sus datos pueden ser transferidos a profesionales de la salud autorizados, autoridades sanitarias cuando sea requerido por ley, y proveedores de servicios tecnológicos. No se realizarán transferencias a terceros salvo requerimiento de autoridad.</p>
                    <p><b>5. Medidas de Seguridad</b></p>
                    <p>Implementamos medidas técnicas, administrativas y físicas para proteger sus datos personales, incluyendo encriptación de datos, acceso restringido y auditorías regulares de seguridad. Los datos se almacenan en servidores cifrados.</p>
                    <p><b>6. Derechos ARCO</b></p>
                    <p>Usted tiene derecho a: Acceder a sus datos personales; Rectificar sus datos cuando sean inexactos; Cancelar el uso de sus datos; Oponerse al tratamiento de sus datos. Para ejercer estos derechos, envíe su solicitud a legal@qlinexa360.com.</p>
                    <p><b>7. Revocación del Consentimiento</b></p>
                    <p>Puede revocar su consentimiento en cualquier momento, sin embargo, esto puede limitar la funcionalidad de la plataforma.</p>
                    <p><b>8. Conservación de Datos</b></p>
                    <p>Sus datos se conservarán conforme a la normativa sanitaria mexicana (NOM-004-SSA3-2012) por un mínimo de 5 años desde el último acto médico.</p>
                    <p><b>9. Cambios al Aviso</b></p>
                    <p>Nos reservamos el derecho de modificar este aviso. Los cambios serán notificados a través de la plataforma.</p>
                    <p><b>10. Contacto</b></p>
                    <p>Para ejercer sus derechos ARCO o realizar consultas sobre este aviso, puede contactarnos a través de la plataforma o al correo electrónico legal@qlinexa360.com.</p>
                    <p className="mt-4"><i>El usuario manifiesta que ha leído y entendido el presente Aviso de Privacidad y otorga su consentimiento expreso para el tratamiento de sus datos personales conforme a lo aquí señalado al registrarse y proporcionar su información dentro de la plataforma.</i></p>
                  </div>
                </div>
                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    name="acceptPrivacy" 
                    checked={form.acceptPrivacy} 
                    onChange={handleChange} 
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
                <div className="max-h-48 overflow-y-auto bg-white p-4 rounded border border-gray-100 text-sm text-gray-700 mb-4">
                  <div className="space-y-3">
                    <p><b>1. Aceptación de los Términos</b></p>
                    <p>Al registrarse, acceder y utilizar la plataforma <b>Qlinexa360</b>, el usuario reconoce y acepta los presentes Términos y Condiciones, los cuales regulan el acceso y uso de la plataforma web y móvil. El uso continuado implica aceptación plena de los mismos.</p>
                    
                    <p><b>2. Definiciones</b></p>
                    <p><b>Plataforma:</b> Sistema digital propiedad de Qlinexa360, disponible en versión web y móvil.</p>
                    <p><b>Profesional de la Salud:</b> Usuario médico que utiliza la plataforma para gestionar pacientes y expedientes clínicos.</p>
                    <p><b>Paciente:</b> Usuario que accede directamente o que es registrado por un Profesional de la Salud para fines de consulta, diagnóstico y seguimiento.</p>
                    <p><b>Asistente del Profesional de la Salud:</b> Usuario autorizado por un médico para realizar tareas operativas dentro de la plataforma.</p>
                    <p><b>Administrador de la Plataforma:</b> Usuario con permisos especiales para soporte técnico y gestión de la infraestructura de Qlinexa360.</p>
                    
                    <p><b>3. Alcance del Servicio</b></p>
                    <p>Qlinexa360 es una <b>plataforma tecnológica de software como servicio (SaaS)</b> para la gestión clínica, administrativa y de comunicación médico–paciente. <b>No constituye</b> un servicio médico ni sustituye la consulta presencial. Qlinexa360 no realiza diagnósticos ni tratamientos médicos.</p>
                    
                    <p><b>4. Uso Permitido</b></p>
                    <p>Los usuarios solo podrán utilizar la plataforma para fines legítimos relacionados con la atención médica, conforme a la <b>legislación sanitaria aplicable en México</b> y en particular la <b>NOM-004-SSA3-2012</b> sobre expedientes clínicos.</p>
                    <p>Queda prohibido:</p>
                    <ul className="list-disc pl-5">
                      <li>Usar la plataforma con fines ilícitos.</li>
                      <li>Registrar información falsa o suplantar la identidad de terceros.</li>
                      <li>Acceder a expedientes o datos de pacientes sin autorización.</li>
                    </ul>
                    
                    <p><b>5. Registro y Veracidad de Información</b></p>
                    <p>El usuario se compromete a:</p>
                    <ul className="list-disc pl-5">
                      <li>Proporcionar datos veraces, completos y actualizados.</li>
                      <li>Mantener actualizada su información de contacto.</li>
                      <li>Informar a sus pacientes sobre el uso de sus datos personales y contar con el consentimiento correspondiente.</li>
                    </ul>
                    <p>Qlinexa360 se reserva el derecho de suspender o cancelar cuentas con información falsa, fraudulenta o que incumpla estos términos.</p>
                    
                    <p><b>6. Obligaciones del Usuario</b></p>
                    <p><b>Profesional de la Salud:</b> custodiar y usar de manera responsable los expedientes clínicos, conforme a la NOM-004-SSA3-2012.</p>
                    <p><b>Paciente:</b> proporcionar datos veraces y utilizar la plataforma solo para su consulta y seguimiento médico.</p>
                    <p><b>Asistente:</b> actuar bajo supervisión del médico tratante y dentro de los permisos otorgados.</p>
                    <p><b>Administrador:</b> usar sus accesos solo para soporte técnico y resolución de incidencias.</p>
                    
                    <p><b>7. Propiedad Intelectual</b></p>
                    <p>Todos los contenidos, diseños, software, logotipos y elementos gráficos son propiedad exclusiva de Qlinexa360. Queda prohibida su reproducción, distribución o modificación sin autorización expresa y por escrito.</p>
                    
                    <p><b>8. Propiedad de la Información Clínica</b></p>
                    <p>Los expedientes y datos clínicos son propiedad del "paciente". Qlinexa360 actúa como <b>responsable del tratamiento y custodio</b> de la información, conforme a la <b>Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)</b>.</p>
                    <p>El acceso está restringido al paciente y a los profesionales de la salud autorizados.</p>
                    
                    <p><b>9. Suspensión y Cancelación</b></p>
                    <p>Qlinexa360 podrá suspender o cancelar el acceso a usuarios que:</p>
                    <ul className="list-disc pl-5">
                      <li>Incumplan estos términos.</li>
                      <li>Realicen un uso indebido de la información.</li>
                      <li>Incumplan con sus obligaciones de pago.</li>
                    </ul>
                    <p>En caso de cancelación, los expedientes clínicos permanecerán accesibles para el Profesional de la Salud y el Paciente durante el plazo mínimo legal de <b>5 años</b>, conforme a la NOM-004-SSA3-2012.</p>
                    
                    <p><b>10. Limitación de Responsabilidad</b></p>
                    <ul className="list-disc pl-5">
                      <li>Qlinexa360 no es responsable de diagnósticos médicos ni de las decisiones clínicas de los profesionales de la salud.</li>
                      <li>Qlinexa360 no garantiza la disponibilidad ininterrumpida del servicio, aunque hará esfuerzos razonables para mantener su operación.</li>
                      <li>El uso de la plataforma es bajo el propio riesgo del usuario.</li>
                    </ul>
                    
                    <p><b>11. Comunicaciones Electrónicas</b></p>
                    <p>El usuario autoriza expresamente a Qlinexa360 a enviarle notificaciones y comunicaciones relacionadas con el servicio a través de:</p>
                    <ul className="list-disc pl-5">
                      <li>Correo electrónico</li>
                      <li>Mensajes de WhatsApp o equivalentes</li>
                      <li>Notificaciones internas en la plataforma</li>
                    </ul>
                    <p>Estas comunicaciones son de carácter profesional y necesarias para la operación del servicio.</p>
                    
                    <p><b>12. Modificaciones a los Términos</b></p>
                    <p>Qlinexa360 podrá modificar estos Términos en cualquier momento. Las actualizaciones se notificarán a los usuarios y se publicarán en la página oficial. El uso continuo de la plataforma implica la aceptación de los cambios.</p>
                    
                    <p><b>13. Legislación Aplicable y Jurisdicción</b></p>
                    <p>Este documento se rige por las leyes de los <b>Estados Unidos Mexicanos</b>, en particular la <b>LFPDPPP</b> y la <b>NOM-004-SSA3-2012</b>. Cualquier controversia se someterá a la jurisdicción de los tribunales competentes de la Ciudad de México.</p>
                  </div>
                </div>
                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    name="acceptTerms" 
                    checked={form.acceptTerms} 
                    onChange={handleChange} 
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
                    <p><b>Contrato de Uso y Responsabilidad de la Plataforma Qlinexa360</b></p>
                    
                    <p><b>1. Objeto</b></p>
                    <p>El presente contrato regula las condiciones de uso de la plataforma digital <b>Qlinexa360</b> (en lo sucesivo, la <i>Plataforma</i>), que permite el registro, almacenamiento, consulta y gestión de información médica de pacientes, así como la comunicación entre pacientes, profesionales de la salud y asistentes.</p>
                    
                    <p><b>2. Definiciones</b></p>
                    <p><b>Plataforma:</b> Sistema digital propiedad de Qlinexa360 disponible vía web y móvil.</p>
                    <p><b>Paciente:</b> Usuario titular de datos personales y clínicos, quien accede o es registrado por un Profesional de la Salud.</p>
                    <p><b>Profesional de la Salud:</b> Usuario médico que utiliza la Plataforma para gestionar pacientes y sus expedientes clínicos.</p>
                    <p><b>Asistente:</b> Usuario autorizado por un Profesional de la Salud para realizar tareas operativas bajo su supervisión.</p>
                    <p><b>Administrador de la Plataforma:</b> Usuario con permisos especiales para dar soporte técnico y gestionar la operación de Qlinexa360.</p>
                    
                    <p><b>3. Acceso y Uso</b></p>
                    <ul className="list-disc pl-5">
                      <li>El <b>Paciente</b> tendrá acceso a su información clínica personal y podrá compartirla únicamente con profesionales de la salud autorizados dentro de la Plataforma.</li>
                      <li>El <b>Profesional de la Salud</b> es responsable de la veracidad y actualización de los datos clínicos que registre.</li>
                      <li>El <b>Asistente</b> solo podrá actuar dentro de los permisos otorgados por el Profesional de la Salud.</li>
                      <li>Qlinexa360 podrá suspender cuentas que hagan uso indebido, ilegal o no autorizado de la Plataforma.</li>
                    </ul>
                    
                    <p><b>4. Conservación de Datos</b></p>
                    <p>La Plataforma se obliga a conservar los expedientes clínicos electrónicos conforme a la <b>NOM-004-SSA3-2012</b>, por un mínimo de <b>cinco (5) años</b> a partir del último acto médico registrado.</p>
                    <p>El paciente podrá solicitar acceso a su expediente en cualquier momento mediante los mecanismos de derechos ARCO previstos en la LFPDPPP.</p>
                    
                    <p><b>5. Protección de Datos Personales</b></p>
                    <p>El tratamiento de los datos personales recabados se ajusta a lo establecido en la <b>Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)</b>.</p>
                    <ul className="list-disc pl-5">
                      <li>Los datos se almacenan en servidores cifrados.</li>
                      <li>Solo el paciente y los profesionales de la salud autorizados tendrán acceso a la información.</li>
                      <li>Qlinexa360 actúa como <b>responsable del tratamiento</b> y custodio de la información, aplicando medidas administrativas, técnicas y físicas de seguridad.</li>
                    </ul>
                    
                    <p><b>6. Consentimiento Informado</b></p>
                    <p>El profesional de la salud deberá aceptar digitalmente el presente contrato, registrando nombre completo, fecha y hora (<b>timestamp</b>) como constancia de consentimiento informado.</p>
                    <p>El consentimiento forma parte obligatoria del proceso de registro en la Plataforma.</p>
                    
                    <p><b>7. Responsabilidades del Usuario</b></p>
                    <ul className="list-disc pl-5">
                      <li>Proporcionar información médica y personal veraz y actualizada.</li>
                      <li>Mantener la confidencialidad de su acceso (usuario y contraseña).</li>
                      <li>Usar la Plataforma de manera ética y conforme a la legislación mexicana.</li>
                      <li>El Profesional de la Salud es responsable de la correcta interpretación y uso de los datos clínicos.</li>
                    </ul>
                    
                    <p><b>8. Limitación de Responsabilidad</b></p>
                    <ul className="list-disc pl-5">
                      <li>Qlinexa360 <b>no proporciona servicios médicos</b>, ni diagnósticos ni tratamientos; únicamente facilita la gestión de información y comunicación.</li>
                      <li>Qlinexa360 no sustituye la consulta médica presencial ni asume responsabilidad por decisiones clínicas tomadas por los Profesionales de la Salud.</li>
                      <li>Qlinexa360 no será responsable por:</li>
                      <ul className="list-disc pl-8">
                        <li>Errores u omisiones en la información registrada por usuarios.</li>
                        <li>Fallas técnicas ajenas al control razonable de la Plataforma.</li>
                        <li>Uso indebido de los accesos por parte de terceros.</li>
                      </ul>
                    </ul>
                    
                    <p><b>9. Comunicación Médica</b></p>
                    <p>La Plataforma facilita la comunicación entre pacientes y profesionales de la salud, pero no garantiza disponibilidad inmediata ni constituye un canal de urgencias médicas.</p>
                    
                    <p><b>10. Pagos y Suscripciones (si aplica a médicos)</b></p>
                    <p>El acceso del Profesional de la Salud a la Plataforma podrá estar sujeto a una <b>suscripción mensual</b>, la cual se cobrará de manera recurrente mediante el método de pago autorizado (ej. PayPal).</p>
                    <p>La falta de pago podrá derivar en la suspensión del acceso, manteniéndose el derecho del paciente a consultar sus expedientes conforme a la NOM-004-SSA3-2012.</p>
                    
                    <p><b>11. Modificaciones al Contrato</b></p>
                    <p>Qlinexa360 podrá modificar este contrato en cualquier momento. Los cambios se notificarán a los usuarios y se publicarán en la Plataforma. El uso continuo implicará aceptación de las modificaciones.</p>
                    
                    <p><b>12. Legislación Aplicable y Jurisdicción</b></p>
                    <p>Este contrato se rige por las leyes de los <b>Estados Unidos Mexicanos</b>, incluyendo la <b>LFPDPPP</b> y la <b>NOM-004-SSA3-2012</b>.</p>
                    <p>Las partes se someten a la jurisdicción de los tribunales competentes de la Ciudad de México, renunciando a cualquier otro fuero que pudiera corresponderles.</p>
                    
                    <p><b>13. Cláusula de Comunicación</b></p>
                    <p>El usuario acepta recibir notificaciones y comunicaciones relacionadas con la Plataforma a través de:</p>
                    <ul className="list-disc pl-5">
                      <li>Correo electrónico</li>
                      <li>Mensajes de WhatsApp o equivalentes</li>
                      <li>Notificaciones internas en la Plataforma</li>
                    </ul>
                    <p>Estas comunicaciones serán de carácter <b>profesional y administrativo</b> y estarán orientadas a la correcta operación del servicio.</p>
                  </div>
                </div>
                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    name="acceptContract" 
                    checked={form.acceptContract} 
                    onChange={handleChange} 
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
                <p className="text-gray-700 text-base leading-relaxed mb-4">
                  Al escribir tu nombre completo en el campo de abajo, confirmas que has leído, comprendido y aceptas todos los documentos legales anteriores.
                </p>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    name="signature" 
                    value={form.signature} 
                    onChange={handleChange} 
                    className="block w-full text-base border border-gray-300 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                    placeholder="Escribe tu nombre completo"
                    required 
                  />
                </div>
              </div>

              {legalError && <div className="text-red-500 text-sm mt-2">{legalError}</div>}
            </div>
          );
        } catch (error) {
          console.error('Error en el renderizado del paso 4:', error);
          return <div style={{color: 'red'}}>Error en el renderizado del paso 4: {error.message}</div>;
        }
      case 4:
        // Pago y activación
        return (
          <div className="space-y-6 w-full max-w-xl mx-auto">
            <div className="mb-4">
              <label className="block text-lg font-bold text-gray-800 mb-2 text-center">Pago y Activación</label>
              <div className="text-center text-blue-700 font-semibold mb-2">$499 mxn/mes IVA incluido</div>
              <div className="bg-white rounded p-4 flex flex-col items-center">
                {/* Campo de código promocional */}
                <div className="mb-4 w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código promocional</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="promoCode"
                      value={form.promoCode}
                      onChange={handleChange}
                      className="block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ingresa tu código (opcional)"
                    />
                    <button
                      type="button"
                      onClick={validatePromoCode}
                      className="px-3 py-2 bg-blue-600 text-white rounded"
                      disabled={promoCodeLoading}
                    >
                      {promoCodeLoading ? 'Validando...' : 'Validar'}
                    </button>
                  </div>
                  {promoCodeStatus && (
                    <div className={`mt-1 text-sm ${promoCodeStatus.includes('válido') ? 'text-green-600' : 'text-red-500'}`}>{promoCodeStatus}</div>
                  )}
                </div>
                {/* Textos adicionales solicitados */}
                <ul className="text-sm text-gray-700 mb-4 list-disc pl-5 text-left">
                  <li>Se te cobrará $499 mxn/mes IVA incluido de forma automática</li>
                  <li>El cargo se realizará a la tarjeta registrada en tu cuenta PayPal</li>
                  <li>Puedes cancelar tu suscripción en cualquier momento desde tu cuenta de Paypal o desde esta plataforma</li>
                  <li>Tu acceso continuará hasta el final del periodo pagado con posibilidad de ocupar todas las funcionalidades</li>
                  <li>En caso de cancelar la suscripción, tu acceso continúa en modo lectura ya que por ley los historiales clínicos los mantenemos hasta por 5 años. Te invitamos a continuar con Qlinexa360</li>
                </ul>
                {/* PayPal: mostrado cuando no hay código, o cuando hay código de prueba (1M/3M) que requiere registrar método de pago */}
                {(promoCodeType === '' || promoCodeType === 'TRIAL_30D' || promoCodeType === 'DISCOUNT_50_3M' || promoCodeType === 'REACTIVATION_30D') && (() => {
                  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';
                  const planIdBase = import.meta.env.VITE_PAYPAL_PLAN_ID || '';
                  const planIdTrial1M = import.meta.env.VITE_PAYPAL_PLAN_ID_TRIAL_1M || planIdBase;
                  const planIdTrial3M = import.meta.env.VITE_PAYPAL_PLAN_ID_TRIAL_3M || planIdBase;
                  const planId = promoCodeType === 'DISCOUNT_50_3M' ? planIdTrial3M
                    : (promoCodeType === 'TRIAL_30D' || promoCodeType === 'REACTIVATION_30D') ? planIdTrial1M
                    : planIdBase;

                  if (!paypalClientId) {
                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
                        <p className="font-semibold mb-1">Configuración de PayPal pendiente</p>
                        <p>El botón de pago no está disponible porque falta la configuración de PayPal (VITE_PAYPAL_CLIENT_ID). Por favor contacta al administrador de la plataforma.</p>
                      </div>
                    );
                  }
                  if (!planId) {
                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
                        <p className="font-semibold mb-1">Configuración de planes PayPal pendiente</p>
                        <p>Falta la configuración del plan de suscripción (VITE_PAYPAL_PLAN_ID). Por favor contacta al administrador.</p>
                      </div>
                    );
                  }

                  return (
                    <PayPalScriptProvider
                      options={{
                        clientId: paypalClientId,
                        vault: true,
                        intent: 'subscription'
                      }}
                    >
                      <PayPalButtons
                        style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe' }}
                        createSubscription={(data, actions) => {
                          return actions.subscription.create({ plan_id: planId });
                        }}
                        onApprove={async (data) => {
                          try {
                            setForm(prev => ({
                              ...prev,
                              paypalSubscriptionId: data.subscriptionID
                            }));
                            toast.success('¡Suscripción de PayPal aprobada!');
                          } catch (error) {
                            console.error('PayPal onApprove error:', error);
                            toast.error('Error al procesar el pago. Por favor, intenta de nuevo.');
                          }
                        }}
                        onError={(err) => {
                          console.error('PayPal onError:', err);
                          const details = err?.details?.[0];
                          const isPlanNotFound = err?.name === 'RESOURCE_NOT_FOUND' ||
                            details?.issue === 'INVALID_RESOURCE_ID' ||
                            (err?.message && err.message.includes('resource'));
                          const msg = isPlanNotFound
                            ? 'El plan de suscripción no fue encontrado en PayPal. Por favor contacta al administrador para verificar la configuración de planes.'
                            : (err?.message || err?.err || 'Error desconocido');
                          toast.error(msg, { duration: 6000 });
                        }}
                        onCancel={() => {
                          toast('Pago cancelado. Puedes intentar de nuevo cuando estés listo.', { icon: 'ℹ️' });
                        }}
                      />
                    </PayPalScriptProvider>
                  );
                })()}
                {/* Mensaje de acceso de por vida o prueba gratuita */}
                {promoCodeType === 'LIFETIME' && (
                  <div className="text-green-700 font-semibold mt-2">¡Acceso de por vida activado! No se realizará ningún cobro.</div>
                )}
                {(promoCodeType === 'TRIAL_30D' || promoCodeType === 'REACTIVATION_30D') && (
                  <div className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4 text-sm">
                    <p className="font-semibold mb-1">¡Tienes 1 mes gratis!</p>
                    <p>Registra tu método de pago con PayPal arriba. <strong>No se te cobrará durante el primer mes.</strong> Al finalizar el periodo promocional, se te cobrará automáticamente $499 mxn/mes por tu suscripción.</p>
                  </div>
                )}
                {promoCodeType === 'DISCOUNT_50_3M' && (
                  <div className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4 text-sm">
                    <p className="font-semibold mb-1">¡Tienes 3 meses gratis!</p>
                    <p>Registra tu método de pago con PayPal arriba. <strong>No se te cobrará durante los primeros 3 meses.</strong> Al finalizar el periodo promocional, se te cobrará automáticamente $499 mxn/mes por tu suscripción.</p>
                  </div>
                )}
              </div>
            </div>
            {stepError && <div className="text-red-500 text-sm mt-2">{stepError}</div>}
          </div>
        );
      default:
        return null;
    }
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    if (isSubmitting) return;
    const needsPayPal = !promoCodeType || ['TRIAL_30D', 'DISCOUNT_50_3M', 'REACTIVATION_30D'].includes(promoCodeType);
    const hasPayPal = !!form.paypalSubscriptionId;
    const hasPromoOrPayPal = promoCodeType === 'LIFETIME' || hasPayPal;
    if (needsPayPal && !hasPayPal) {
      setStepError('Con tu código promocional debes registrar tu método de pago con PayPal. No se te cobrará durante el periodo gratuito; el cargo de $499/mes comenzará al finalizarlo.');
      return;
    }
    if (!hasPromoOrPayPal) {
      setStepError('Debes completar el pago con PayPal o ingresar un código válido antes de registrarte.');
      return;
    }
    try {
      setStepError('');
      setIsSubmitting(true);
      const registerUrl = getApiUrl('/api/auth/register');
      await axios.post(registerUrl, {
        ...form,
        role: 'DOCTOR'
      });
      toast.success('¡Registro completado exitosamente! Revisa tu correo para activar tu cuenta. Serás redirigido al inicio de sesión.', { duration: 5000 });
      setTimeout(() => navigate('/login'), 2500);
    } catch (error) {
      const message = error.response?.data?.message || 'Error al registrar. Intenta de nuevo.';
      setStepError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto w-full flex flex-col items-center">
        <Stepper />
        <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
          Registro profesional de la Salud
        </h2>
      </div>

      <div className="mt-8 w-full flex justify-center">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 w-full max-w-2xl md:max-w-2xl lg:max-w-2xl xl:max-w-3xl">
          {renderStep()}
          <div className="mt-4 space-x-2 flex justify-end">
            {step > 0 && <button type="button" onClick={prevStep} className="px-4 py-2 bg-gray-200 text-gray-700 rounded">Anterior</button>}
            {step < steps.length - 1 ? (
              <button type="button" onClick={nextStep} className="px-4 py-2 bg-blue-600 text-white rounded">Siguiente</button>
            ) : (
              <button
                type="button"
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  (promoCodeType === 'LIFETIME' ? false : !form.paypalSubscriptionId)
                }
              >
                {isSubmitting ? 'Registrando...' : 'Registrarse'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterDoctor; 