console.log("RegisterPatient wizard cargado"); 
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '@mui/material';
import PhoneInput from '../components/common/PhoneInput';
import { isValidE164 } from '../constants/countries';
import { toast } from 'react-hot-toast';

const steps = [
  'Información Personal',
  'Vincular profesional',
  'Datos Adicionales',
  'Consentimientos Legales',
];

const RegisterPatient = () => {
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
    doctorId: '',
    doctorName: '',
    emergencyContact1: '',
    emergencyContact2: '',
    gender: '',
    birthDate: '',
    bloodType: '',
    allergies: '',
    chronicDiseases: '',
    acceptPrivacy: false,
    acceptTerms: false,
    taxName: '',
    taxId: '',
    taxAddress: '',
    taxCertificate: null,
  });
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [stepError, setStepError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Stepper visual - responsive: compacto en móvil, completo en desktop
  const Stepper = () => (
    <div className="flex flex-col items-center mb-4 md:mb-8 w-full overflow-hidden">
      <div className="flex flex-col items-center w-full md:hidden">
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
      <div className="hidden md:flex flex-row justify-center w-full">
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
      if (!form.doctorId) {
        setStepError('Debes seleccionar un profesional.');
        return;
      }
    }
    setStep((s) => s + 1);
  };
  const prevStep = () => setStep((s) => (s > 0 ? s - 1 : 0));

  // Simulación de búsqueda de doctores
  const searchDoctors = (term) => {
    // Aquí iría la lógica real de búsqueda de doctores
    const mockDoctors = [
      { id: '1', name: 'Dr. Juan Pérez', specialty: 'Cardiología' },
      { id: '2', name: 'Dra. María García', specialty: 'Pediatría' },
      { id: '3', name: 'Dr. Carlos López', specialty: 'Dermatología' },
    ];
    return mockDoctors.filter(doctor => doctor.name.toLowerCase().includes(term.toLowerCase()));
  };

  const handleDoctorSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      if (value.length > 2) {
        const results = searchDoctors(value);
        setSuggestions(results);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  };

  const handleDoctorSelect = (doctor) => {
    setForm((prev) => ({ ...prev, doctorId: doctor.id, doctorName: doctor.name }));
    setSearchTerm('');
    setShowSuggestions(false);
    toast.success(`Quedarás vinculado en este registro a ${doctor.name}, posteriormente si te atiende otro profesional de la red Qlinexa360, te podrá localizar con tu Nombre, Apellidos o email`);
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
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700">Buscar profesional</label>
              <input
                type="text"
                value={searchTerm}
                onChange={handleDoctorSearch}
                placeholder="Ingresa el nombre del profesional..."
                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm">
                  {suggestions.map((doctor) => (
                    <div
                      key={doctor.id}
                      className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50"
                      onClick={() => handleDoctorSelect(doctor)}
                    >
                      <div className="flex items-center">
                        <span className="font-medium text-indigo-600">{doctor.name}</span>
                        <span className="ml-2 text-gray-900">{doctor.specialty}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {form.doctorName && (
              <div className="mt-4 p-4 bg-green-50 rounded-md">
                <p className="text-green-700">Profesional seleccionado: {form.doctorName}</p>
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Contacto de Emergencia 1</label>
                <input type="text" name="emergencyContact1" value={form.emergencyContact1} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contacto de Emergencia 2</label>
                <input type="text" name="emergencyContact2" value={form.emergencyContact2} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Género</label>
                <select name="gender" value={form.gender} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Selecciona...</option>
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha de Nacimiento</label>
                <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo de Sangre</label>
                <select name="bloodType" value={form.bloodType} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Selecciona...</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Alergias</label>
              <textarea name="allergies" value={form.allergies} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" rows="3" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Enfermedades Crónicas</label>
              <textarea name="chronicDiseases" value={form.chronicDiseases} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" rows="3" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Razón Social (opcional)</label>
                <input type="text" name="taxName" value={form.taxName} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">RFC (opcional)</label>
                <input type="text" name="taxId" value={form.taxId} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Dirección Fiscal (opcional)</label>
              <input type="text" name="taxAddress" value={form.taxAddress} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Cédula de Situación Fiscal (opcional)</label>
              <input type="file" name="taxCertificate" accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} className="mt-1 block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-50 file:text-indigo-700
                hover:file:bg-indigo-100" />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded border border-gray-200">
              <div className="flex items-center mb-2">
                <span className="font-semibold text-blue-700 mr-2">Aviso de Privacidad</span>
                <a href="https://www.qlinexa360.com/aviso-privacidad" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">Ver en sitio</a>
              </div>
              <div className="max-h-40 overflow-y-auto bg-white p-2 rounded border border-gray-100 text-xs text-gray-700">
                <p className="text-gray-700 text-sm mb-2">
                  Qlinexa360, plataforma de propiedad privada, con domicilio digital en www.qlinexa360.com, es responsable del tratamiento de los datos personales recabados a través del sistema. Los datos personales serán utilizados para registro y administración de usuarios, creación y consulta de expedientes clínicos electrónicos, comunicaciones internas y cumplimiento de obligaciones legales. No se realizarán transferencias de datos a terceros salvo requerimiento de autoridad. Los datos se almacenan en servidores cifrados y el usuario puede ejercer derechos ARCO enviando solicitud a legal@qlinexa360.com. El usuario acepta este aviso al registrarse y proporcionar sus datos dentro de la plataforma.
                </p>
                <label className="flex items-center mt-2">
                  <input type="checkbox" name="acceptPrivacy" checked={form.acceptPrivacy} onChange={handleChange} className="mr-2" />
                  <span className="text-sm">He leído y acepto el Aviso de Privacidad</span>
                </label>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded border border-gray-200">
              <div className="flex items-center mb-2">
                <span className="font-semibold text-blue-700 mr-2">Términos de Uso</span>
                <a href="https://www.qlinexa360.com/terminos" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">Ver en sitio</a>
              </div>
              <div className="max-h-40 overflow-y-auto bg-white p-2 rounded border border-gray-100 text-xs text-gray-700 mb-2">
                <b>1. Aceptación del usuario:</b> Al registrarse y utilizar la plataforma Qlinexa360, el usuario acepta los presentes Términos de Uso, que regulan el acceso y uso de la plataforma web y móvil.<br/>
                <b>2. Definiciones:</b> Plataforma: Sistema digital ofrecido por Qlinexa360. Doctor: Usuario profesional de la salud que gestiona pacientes. Paciente: Usuario que accede o es registrado con fines de consulta y seguimiento clínico.<br/>
                <b>3. Uso permitido:</b> El uso está limitado a la consulta, registro, edición y gestión de información médica, conforme a la legislación sanitaria aplicable en México.<br/>
                <b>4. Registro y veracidad de información:</b> El usuario se compromete a proporcionar información verdadera, completa y actualizada. Qlinexa360 se reserva el derecho de suspender cuentas que incumplan esta disposición.<br/>
                <b>5. Responsabilidades del usuario:</b> Mantener la confidencialidad de su acceso. Usar los datos de manera ética y legal. Informar a sus pacientes sobre el uso de sus datos personales.<br/>
                <b>6. Propiedad intelectual:</b> Todos los contenidos, diseños y elementos visuales son propiedad exclusiva de Qlinexa360 y no podrán ser reproducidos sin autorización.<br/>
                <b>7. Suspensión y cancelación:</b> La plataforma podrá suspender el acceso a usuarios que no cumplan los presentes términos, no cubran el pago mensual correspondiente o usen la plataforma de forma inapropiada.<br/>
                <b>8. Limitación de responsabilidad:</b> Qlinexa360 no se hace responsable de diagnósticos clínicos ni consecuencias médicas derivadas del uso de la información registrada por los usuarios.<br/>
                <b>9. Modificaciones:</b> Los términos podrán modificarse y se notificarán a los usuarios registrados. El uso continuo implicará su aceptación.<br/>
                <b>10. Legislación aplicable:</b> Este documento se rige conforme a las leyes mexicanas, incluyendo la LFPDPPP y la NOM-004-SSA3-2012.
              </div>
              <label className="flex items-center mt-2">
                <input type="checkbox" name="acceptTerms" checked={form.acceptTerms} onChange={handleChange} className="mr-2" />
                <span className="text-sm">He leído y acepto los Términos de Uso</span>
              </label>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('firstName', form.firstName);
    formData.append('lastName', form.lastName);
    formData.append('email', form.email);
    formData.append('password', form.password);
    formData.append('phone', form.phone);
    formData.append('gender', form.gender);
    formData.append('birthDate', form.birthDate);
    formData.append('bloodType', form.bloodType);
    formData.append('allergies', form.allergies);
    formData.append('chronicDiseases', form.chronicDiseases);
    formData.append('doctorId', form.doctorId);
    formData.append('emergencyContact1', form.emergencyContact1);
    formData.append('emergencyContact2', form.emergencyContact2);
    if (form.taxName) formData.append('taxName', form.taxName);
    if (form.taxId) formData.append('taxId', form.taxId);
    if (form.taxAddress) formData.append('taxAddress', form.taxAddress);
    if (form.taxCertificate) formData.append('taxCertificate', form.taxCertificate);

    try {
      const response = await fetch('http://localhost:3000/patients/register', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        toast.success('Registro exitoso. Ahora puedes iniciar sesión.');
        navigate('/login');
      } else {
        const data = await response.json();
        toast.error(data.message || 'Error al registrar paciente');
      }
    } catch (error) {
      toast.error('Error de red o del servidor');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto w-full flex flex-col items-center">
        <Stepper />
        <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
          Registro de Paciente
        </h2>
      </div>

      <div className="mt-8 w-full flex justify-center">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 w-full max-w-2xl md:max-w-2xl lg:max-w-2xl xl:max-w-3xl">
          <form onSubmit={handleSubmit} encType="multipart/form-data">
            {renderStep()}
            <div className="mt-4 space-x-2 flex justify-end">
              {step > 0 && <button type="button" onClick={prevStep} className="px-4 py-2 bg-gray-200 text-gray-700 rounded">Anterior</button>}
              {step < steps.length - 1 ? <button type="button" onClick={nextStep} className="px-4 py-2 bg-blue-600 text-white rounded">Siguiente</button> : <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Registrarse</button>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPatient;