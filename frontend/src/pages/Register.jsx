import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '@mui/material';
import { toast } from 'react-hot-toast';
import RegisterDoctor from './RegisterDoctor';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import PhoneInput from '../components/common/PhoneInput';
import { isValidE164 } from '../constants/countries';

const steps = [
  'Información Personal',
  'Vincular Profesional de la Salud',
  'Datos Adicionales',
  'Consentimientos Legales',
];

const assistantSteps = [
  'Información Personal',
  'Vincular Profesional de la Salud',
  'Consentimientos Legales',
];

const RegisterPatient = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
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
    emergencyContact1Name: '',
    emergencyContact1LastName: '',
    emergencyContact1Phone: '',
    emergencyContact1Email: '',
    emergencyContact1Relationship: '',
    emergencyContact2Name: '',
    emergencyContact2LastName: '',
    emergencyContact2Phone: '',
    emergencyContact2Email: '',
    emergencyContact2Relationship: '',
    gender: '',
    birthDate: '',
    bloodType: '',
    allergies: '',
    chronicDiseases: '',
    // Datos fiscales
    taxName: '',
    taxId: '',
    taxAddress: '',
    taxCertificate: null,
    // Seguro de Gastos Médicos
    insuranceCompany: '',
    insurancePolicyNumber: '',
    insurancePolicyHolder: '',
    insuranceStartDate: '',
    insuranceEndDate: '',
    acceptPrivacy: false,
    acceptTerms: false,
    acceptContract: false,
    signature: '',
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
    <div className="flex flex-col items-center mb-4 w-full overflow-hidden">
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
        setStepError('Debes seleccionar un profesional de la salud.');
        return;
      }
    }
    if (step === 3) {
      if (!form.acceptPrivacy || !form.acceptTerms || !form.acceptContract || !form.signature) {
        setStepError('Debes aceptar todos los consentimientos legales y firmar digitalmente.');
        return;
      }
    }
    setStep((s) => s + 1);
  };
  const prevStep = () => setStep((s) => (s > 0 ? s - 1 : 0));

  // Búsqueda real de doctores usando la API
  const searchDoctors = async (term) => {
    try {
      const response = await fetch(`http://localhost:3000/api/doctors/search?q=${encodeURIComponent(term)}`);
      if (response.ok) {
        const data = await response.json();
        return data.doctors || [];
      }
    } catch (error) {
      console.error('Error buscando doctores:', error);
    }
    return [];
  };

  const handleDoctorSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(async () => {
      if (value.length > 2) {
        const results = await searchDoctors(value);
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
    toast.success(`Quedarás vinculado en este registro al profesional de la salud ${doctor.name}, posteriormente si te atiende otro profesional de la red Qlinexa360, te podrá localizar con tu Nombre, Apellidos o email`);
  };

  // Función para registrar al paciente
  const handleSubmit = async (e) => {
    console.log('=== INICIO HANDLE SUBMIT ===');
    console.log('Evento recibido:', e);
    e.preventDefault();
    
    console.log('Paso actual:', step);
    console.log('Total de pasos:', steps.length);
    console.log('Formulario:', form);
    
    // Validar que estemos en el último paso y que todos los consentimientos estén aceptados
    if (step !== steps.length - 1) {
      console.log('ERROR: No estamos en el último paso');
      setStepError('Por favor completa todos los pasos del registro');
      return;
    }
    
    if (!form.acceptPrivacy || !form.acceptTerms || !form.acceptContract || !form.signature) {
      console.log('ERROR: Faltan consentimientos legales');
      console.log('acceptPrivacy:', form.acceptPrivacy);
      console.log('acceptTerms:', form.acceptTerms);
      console.log('acceptContract:', form.acceptContract);
      console.log('signature:', form.signature);
      setStepError('Debes aceptar todos los consentimientos legales y firmar digitalmente');
      return;
    }

    const formData = new FormData();
    formData.append('firstName', form.firstName);
    formData.append('lastName', form.lastName);
    formData.append('email', form.email);
    formData.append('password', form.password);
    formData.append('phone', form.phone);
    formData.append('doctorId', form.doctorId);
    // Contactos de emergencia 1
    formData.append('emergencyContact1Name', form.emergencyContact1Name);
    formData.append('emergencyContact1LastName', form.emergencyContact1LastName);
    formData.append('emergencyContact1Phone', form.emergencyContact1Phone);
    formData.append('emergencyContact1Email', form.emergencyContact1Email);
    formData.append('emergencyContact1Relationship', form.emergencyContact1Relationship);
    
    // Contactos de emergencia 2
    formData.append('emergencyContact2Name', form.emergencyContact2Name);
    formData.append('emergencyContact2LastName', form.emergencyContact2LastName);
    formData.append('emergencyContact2Phone', form.emergencyContact2Phone);
    formData.append('emergencyContact2Email', form.emergencyContact2Email);
    formData.append('emergencyContact2Relationship', form.emergencyContact2Relationship);
    formData.append('gender', form.gender);
    formData.append('birthDate', form.birthDate);
    formData.append('bloodType', form.bloodType);
    formData.append('allergies', form.allergies);
    formData.append('chronicDiseases', form.chronicDiseases);
    
    // Datos fiscales
    formData.append('taxName', form.taxName);
    formData.append('taxId', form.taxId);
    formData.append('taxAddress', form.taxAddress);
    if (form.taxCertificate) formData.append('taxCertificate', form.taxCertificate);
    
    // Seguro de Gastos Médicos
    formData.append('insuranceCompany', form.insuranceCompany);
    formData.append('insurancePolicyNumber', form.insurancePolicyNumber);
    formData.append('insurancePolicyHolder', form.insurancePolicyHolder);
    formData.append('insuranceStartDate', form.insuranceStartDate);
    formData.append('insuranceEndDate', form.insuranceEndDate);
    
    formData.append('acceptPrivacy', form.acceptPrivacy);
    formData.append('acceptTerms', form.acceptTerms);
    formData.append('acceptContract', form.acceptContract);
    formData.append('signature', form.signature);
    if (form.profilePhoto) formData.append('profilePhoto', form.profilePhoto);

    try {
      const response = await fetch('http://localhost:3000/api/patients/register-frontend', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        // Mostrar mensaje de éxito más prominente
        toast.success('¡Registro exitoso! Ya puedes iniciar sesión en la plataforma.');
        
        // Establecer estado de éxito
        setRegistrationSuccess(true);
        
        // Esperar un momento para que se vea el mensaje
        setTimeout(() => {
          // Redirigir al login
          navigate('/login');
        }, 2000);
      } else {
        console.log('Respuesta del servidor:', response.status, response.statusText);
        const data = await response.json();
        console.log('Datos de error del servidor:', data);
        toast.error(data.message || 'Error al registrar paciente');
      }
    } catch (error) {
      console.error('Error en el registro:', error);
      toast.error('Error de red o del servidor. Por favor, intenta de nuevo.');
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
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700">Buscar Profesional de la Salud</label>
              <input
                type="text"
                value={searchTerm}
                onChange={handleDoctorSearch}
                placeholder="Ingresa el nombre del profesional de la salud..."
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
                <p className="text-green-700">Profesional de la Salud seleccionado: {form.doctorName}</p>
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            {/* Contacto de Emergencia 1 */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-lg font-semibold text-blue-800 mb-4">Contacto de Emergencia 1</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre *</label>
                  <input type="text" name="emergencyContact1Name" value={form.emergencyContact1Name} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Apellido *</label>
                  <input type="text" name="emergencyContact1LastName" value={form.emergencyContact1LastName} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
                </div>
                <div>
                  <PhoneInput name="emergencyContact1Phone" label="Teléfono *" value={form.emergencyContact1Phone} onChange={handleChange} required placeholder="Número con código de país" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input type="email" name="emergencyContact1Email" value={form.emergencyContact1Email} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Parentesco o Relación *</label>
                  <input type="text" name="emergencyContact1Relationship" value={form.emergencyContact1Relationship} onChange={handleChange} placeholder="Ej: Padre, Madre, Hermano, Esposo, etc." className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
                </div>
              </div>
            </div>

            {/* Contacto de Emergencia 2 */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="text-lg font-semibold text-green-800 mb-4">Contacto de Emergencia 2</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input type="text" name="emergencyContact2Name" value={form.emergencyContact2Name} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Apellido</label>
                  <input type="text" name="emergencyContact2LastName" value={form.emergencyContact2LastName} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <PhoneInput name="emergencyContact2Phone" label="Teléfono" value={form.emergencyContact2Phone} onChange={handleChange} placeholder="Número con código de país" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input type="email" name="emergencyContact2Email" value={form.emergencyContact2Email} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Parentesco o Relación</label>
                  <input type="text" name="emergencyContact2Relationship" value={form.emergencyContact2Relationship} onChange={handleChange} placeholder="Ej: Padre, Madre, Hermano, Esposo, etc." className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
            </div>

            {/* Datos Personales */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Datos Personales</h4>
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
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Alergias</label>
                  <textarea name="allergies" value={form.allergies} onChange={handleChange} placeholder="Describa las alergias conocidas..." className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" rows="3" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Enfermedades Crónicas</label>
                  <textarea name="chronicDiseases" value={form.chronicDiseases} onChange={handleChange} placeholder="Describa las enfermedades crónicas..." className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" rows="3" />
                </div>
              </div>
            </div>

            {/* Datos Fiscales */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="text-lg font-semibold text-yellow-800 mb-4">Datos Fiscales (Para Facturación)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Razón Social o Nombre Fiscal *</label>
                  <input type="text" name="taxName" value={form.taxName} onChange={handleChange} placeholder="Nombre completo o razón social" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">RFC *</label>
                  <input type="text" name="taxId" value={form.taxId} onChange={handleChange} placeholder="RFC del paciente" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Domicilio Fiscal *</label>
                  <textarea name="taxAddress" value={form.taxAddress} onChange={handleChange} placeholder="Dirección completa para facturación" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" rows="3" required />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Constancia de Situación Fiscal *</label>
                  <input type="file" name="taxCertificate" onChange={handleChange} accept=".pdf,.jpg,.jpeg,.png" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
                  <p className="text-sm text-gray-500 mt-1">Sube el documento PDF o imagen de tu constancia de situación fiscal</p>
                </div>
              </div>
            </div>

            {/* Seguro de Gastos Médicos */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-lg font-semibold text-blue-800 mb-4">Seguro de Gastos Médicos (Opcional)</h4>
              <p className="text-sm text-blue-600 mb-4">Esta información nos ayudará para futuras integraciones con compañías de seguros. Todos los campos son opcionales.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Compañía de Seguros</label>
                  <select name="insuranceCompany" value={form.insuranceCompany} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    <option value="">Selecciona una compañía...</option>
                    <option value="AXA">AXA</option>
                    <option value="GNP">GNP</option>
                    <option value="MetLife">MetLife</option>
                    <option value="Allianz">Allianz</option>
                    <option value="Mapfre">Mapfre</option>
                    <option value="Zurich">Zurich</option>
                    <option value="Quálitas">Quálitas</option>
                    <option value="Seguros Monterrey">Seguros Monterrey</option>
                    <option value="Seguros Banorte">Seguros Banorte</option>
                    <option value="Seguros Inbursa">Seguros Inbursa</option>
                    <option value="Otra">Otra</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Número de Póliza</label>
                  <input type="text" name="insurancePolicyNumber" value={form.insurancePolicyNumber} onChange={handleChange} placeholder="Número de póliza" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Titular de la Póliza</label>
                  <input type="text" name="insurancePolicyHolder" value={form.insurancePolicyHolder} onChange={handleChange} placeholder="Nombre completo del titular de la póliza" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                  <p className="text-sm text-gray-500 mt-1">Puede ser el paciente o un familiar (ej. esposo, padre, empleador)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha de Inicio de Vigencia</label>
                  <input type="date" name="insuranceStartDate" value={form.insuranceStartDate} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha de Fin de Vigencia</label>
                  <input type="date" name="insuranceEndDate" value={form.insuranceEndDate} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-8 w-full max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Consentimientos Legales</h3>
              <p className="text-base text-gray-600">Revise y acepte nuestras políticas para completar el registro</p>
            </div>
            
            {/* Aviso de Privacidad */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div className="flex items-center mb-4">
                <span className="font-semibold text-blue-700 text-lg">Aviso de Privacidad</span>
              </div>
              <div className="max-h-48 overflow-y-auto bg-white p-4 rounded border border-gray-100 text-sm text-gray-700 mb-4">
                <div className="space-y-3">
                  <p><b>AVISO DE PRIVACIDAD INTEGRAL - Qlinexa360</b></p>
                  <p><b>1. Responsable del Tratamiento:</b> Qlinexa360, plataforma digital de gestión médica, es responsable del tratamiento de sus datos personales.</p>
                  <p><b>2. Finalidades del Tratamiento:</b> Sus datos personales serán utilizados para: (a) Gestionar su registro en la plataforma; (b) Facilitar la comunicación entre profesionales de la salud y pacientes; (c) Mantener su historial clínico digital; (d) Enviar notificaciones relacionadas con su atención médica; (e) Cumplir con obligaciones legales y regulatorias.</p>
                  <p><b>3. Datos Personales Recopilados:</b> Recopilamos: (a) Datos de identificación (nombre, email, teléfono); (b) Datos médicos (historial clínico, diagnósticos, tratamientos); (c) Datos de contacto de emergencia; (d) Datos fiscales (cuando aplique); (e) Datos de seguro médico (cuando aplique).</p>
                  <p><b>4. Transferencias:</b> Sus datos pueden ser transferidos a: (a) Profesionales de la salud autorizados; (b) Autoridades sanitarias cuando sea requerido por ley; (c) Proveedores de servicios tecnológicos que nos apoyan en la operación de la plataforma.</p>
                  <p><b>5. Medidas de Seguridad:</b> Implementamos medidas técnicas, administrativas y físicas para proteger sus datos personales, incluyendo encriptación de datos, acceso restringido y auditorías regulares de seguridad.</p>
                  <p><b>6. Derechos ARCO:</b> Usted tiene derecho a: (a) Acceder a sus datos personales; (b) Rectificar sus datos cuando sean inexactos; (c) Cancelar el uso de sus datos; (d) Oponerse al tratamiento de sus datos para fines específicos.</p>
                  <p><b>7. Revocación del Consentimiento:</b> Puede revocar su consentimiento en cualquier momento, sin embargo, esto puede limitar la funcionalidad de la plataforma.</p>
                  <p><b>8. Conservación de Datos:</b> Sus datos se conservarán conforme a la normativa sanitaria mexicana (NOM-004-SSA3-2012) por un mínimo de 5 años desde el último acto médico.</p>
                  <p><b>9. Cambios al Aviso:</b> Nos reservamos el derecho de modificar este aviso. Los cambios serán notificados a través de la plataforma.</p>
                  <p><b>10. Contacto:</b> Para ejercer sus derechos ARCO o realizar consultas sobre este aviso, puede contactarnos a través de la plataforma o al correo electrónico de soporte.</p>
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
                  <p><b>1. Aceptación del usuario:</b> Al registrarse y utilizar la plataforma Qlinexa360, el usuario acepta los presentes Términos de Uso, que regulan el acceso y uso de la plataforma web y móvil.</p>
                  <p><b>2. Definiciones:</b> Plataforma: Sistema digital ofrecido por Qlinexa360. Profesional de la Salud: Usuario médico que gestiona pacientes. Paciente: Usuario que accede o es registrado con fines de consulta y seguimiento clínico.</p>
                  <p><b>3. Uso permitido:</b> El uso está limitado a la consulta, registro, edición y gestión de información médica, conforme a la legislación sanitaria aplicable en México.</p>
                  <p><b>4. Registro y veracidad de información:</b> El usuario se compromete a proporcionar información verdadera, completa y actualizada. Qlinexa360 se reserva el derecho de suspender cuentas que incumplan esta disposición.</p>
                  <p><b>5. Responsabilidades del usuario:</b> Mantener la confidencialidad de su acceso. Usar los datos de manera ética y legal. Informar a sus profesionales de la salud sobre el uso de sus datos personales.</p>
                  <p><b>6. Propiedad intelectual:</b> Todos los contenidos, diseños y elementos visuales son propiedad exclusiva de Qlinexa360 y no podrán ser reproducidos sin autorización.</p>
                  <p><b>7. Suspensión y cancelación:</b> La plataforma podrá suspender el acceso a usuarios que no cumplan los presentes términos o usen la plataforma de forma inapropiada.</p>
                  <p><b>8. Limitación de responsabilidad:</b> Qlinexa360 no se hace responsable de diagnósticos clínicos ni consecuencias médicas derivadas del uso de la información registrada por los usuarios.</p>
                  <p><b>9. Modificaciones:</b> Los términos podrán modificarse y se notificarán a los usuarios registrados. El uso continuo implicará su aceptación.</p>
                  <p><b>10. Legislación aplicable:</b> Este documento se rige conforme a las leyes mexicanas, incluyendo la LFPDPPP y la NOM-004-SSA3-2012.</p>
                </div>
                <p className="text-gray-700 text-base leading-relaxed mt-4 font-semibold">
                  <strong>Cláusula de Comunicación:</strong> El usuario acepta recibir comunicación a través de correo electrónico, WhatsApp y a través de la misma plataforma Qlinexa360 en la sesión de usuario registrado; acepta que esta comunicación es profesional y enfocada a fomentar una buena atención Clínica y responsable entre Profesionales de la Salud, Pacientes y Asistentes de Profesionales de la Salud.
                </p>
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
                  <p><b>Contrato de Uso y Responsabilidad - Plataforma Qlinexa360</b></p>
                  <p><b>1. Objeto:</b> Este contrato establece las condiciones legales de uso de la plataforma Qlinexa360, la cual permite el registro, almacenamiento, consulta y gestión de información médica de pacientes.</p>
                  <p><b>2. Acceso y uso:</b> El paciente tendrá acceso a su información médica personal y podrá compartirla con los profesionales de la salud autorizados dentro de la plataforma.</p>
                  <p><b>3. Conservación de datos:</b> La Plataforma se obliga a conservar los expedientes clínicos conforme a la NOM-004-SSA3-2012, por un mínimo de 5 años desde el último acto médico registrado.</p>
                  <p className="text-blue-700 font-semibold">Tu información clínica se conserva por 5 años por normativa sanitaria mexicana. Puedes solicitarla en cualquier momento.</p>
                  <p><b>4. Protección de datos personales:</b> La información del paciente está protegida bajo la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP). Los datos se almacenan de forma cifrada y solo el profesional de la salud autorizado y el paciente acceden a ellos.</p>
                  <p><b>5. Consentimiento informado:</b> El paciente deberá aceptar el presente contrato y firmar de forma digital, registrando nombre completo, fecha y hora (timestamp). Este consentimiento forma parte del proceso de registro.</p>
                  <p><b>6. Responsabilidad del paciente:</b> El paciente es responsable de proporcionar información médica veraz, mantener la confidencialidad de su acceso y usar la plataforma de manera ética y conforme a la ley.</p>
                  <p><b>7. Comunicación médica:</b> La plataforma facilita la comunicación entre pacientes y profesionales de la salud, pero no sustituye la consulta médica presencial cuando sea necesaria.</p>
                  <p><b>8. Modificaciones:</b> Este contrato podrá modificarse y se notificarán los cambios a los usuarios registrados. El uso continuo implicará su aceptación.</p>
                  <p><b>9. Legislación aplicable:</b> Este contrato se rige conforme a las leyes mexicanas aplicables.</p>
                </div>
                <p className="text-gray-700 text-base leading-relaxed mt-4 font-semibold">
                  <strong>Cláusula de Comunicación:</strong> El usuario acepta recibir comunicación a través de correo electrónico, WhatsApp y a través de la misma plataforma Qlinexa360 en la sesión de usuario registrado; acepta que esta comunicación es profesional y enfocada a fomentar una buena atención Clínica y responsable entre Profesionales de la Salud, Pacientes y Asistentes de Profesionales de la Salud.
                </p>
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

            {/* Campo de firma digital */}
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
                  onChange={handleChange}
                  placeholder="Escribe tu nombre completo"
                  className="w-full text-base border border-gray-300 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Mostrar pantalla de éxito si el registro fue exitoso
  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-6 sm:px-6 lg:px-8">
        <div className="bg-white py-12 px-8 shadow-xl sm:rounded-xl sm:px-12 w-full max-w-2xl text-center">
          <div className="mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">¡Registro Exitoso!</h2>
            <p className="text-lg text-gray-600 mb-6">
              Tu cuenta de paciente ha sido creada correctamente
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 font-medium">
                Serás redirigido automáticamente a la página de inicio de sesión en unos segundos...
              </p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 font-medium transition-colors"
            >
              Ir al Login Ahora
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          {renderStep()}
          <div className="mt-4 space-x-2 flex justify-end">
            {step > 0 && <button type="button" onClick={prevStep} className="px-4 py-2 bg-gray-200 text-gray-700 rounded">Anterior</button>}
            {step < steps.length - 1 ? (
              <button type="button" onClick={nextStep} className="px-4 py-2 bg-blue-600 text-white rounded">Siguiente</button>
            ) : (
              <button 
                type="button" 
                onClick={(e) => {
                  console.log('Botón Registrarse clickeado');
                  console.log('Paso actual:', step);
                  console.log('Total de pasos:', steps.length);
                  handleSubmit(e);
                }} 
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Registrarse
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const RegisterAssistant = () => {
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
    gender: '',
    birthDate: '',
    acceptPrivacy: false,
    acceptTerms: false,
    signature: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [stepError, setStepError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Stepper visual
  const [legalError, setLegalError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const Stepper = () => (
    <div className="flex flex-col items-center mb-4 md:mb-8 w-full overflow-hidden">
      <div className="flex flex-col items-center w-full md:hidden">
        <p className="text-sm font-medium text-gray-700 mb-2">
          Paso {step + 1} de {assistantSteps.length}: <span className="text-blue-600 font-semibold">{assistantSteps[step]}</span>
        </p>
        <div className="flex items-center justify-center gap-1 w-full overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          {assistantSteps.map((stepName, idx) => (
            <React.Fragment key={stepName}>
              <div
                className={`flex-shrink-0 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold ${step === idx ? 'bg-blue-600 text-white' : step < idx ? 'bg-gray-200 text-gray-500' : 'bg-blue-400 text-white'}`}
                title={stepName}
              >
                {idx + 1}
              </div>
              {idx < assistantSteps.length - 1 && <div className={`flex-shrink-0 w-4 h-0.5 rounded ${idx < step ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="hidden md:flex flex-col items-center">
        <div className="flex items-center justify-center space-x-4 mb-6">
          {assistantSteps.map((stepName, index) => (
            <div key={index} className="flex items-center">
              <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full text-lg font-semibold ${
                index <= step ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-600'
              }`}>
                {index + 1}
              </div>
              {index < assistantSteps.length - 1 && (
                <div className={`flex-shrink-0 w-16 h-2 mx-3 rounded-full ${index < step ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
              )}
            </div>
          ))}
        </div>
        <div className="text-center">
          <span className="text-lg font-semibold text-gray-800">{assistantSteps[step]}</span>
        </div>
      </div>
    </div>
  );

  const handleChange = (e) => {
    const { name, value, type, files, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'file' ? files[0] : type === 'checkbox' ? checked : value
    }));

    // Validaciones en tiempo real
    if (name === 'password') {
      if (value.length < 8) {
        setPasswordError('La contraseña debe tener al menos 8 caracteres');
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        setPasswordError('La contraseña debe contener al menos una mayúscula, una minúscula y un número');
      } else {
        setPasswordError('');
      }
    }

    if (name === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        setEmailError('Ingresa un email válido');
      } else {
        setEmailError('');
      }
    }

    if (name === 'phone') {
      if (value && !isValidE164(value)) {
        setPhoneError('Ingresa un número con código de país (formato internacional)');
      } else {
        setPhoneError('');
      }
    }
  };

  const validateStep = () => {
    setStepError('');
    
    switch (step) {
      case 0:
        if (!form.firstName || !form.lastName || !form.email || !form.password || !form.confirmPassword || !form.phone) {
          setStepError('Por favor completa todos los campos obligatorios');
          return false;
        }
        if (form.password !== form.confirmPassword) {
          setStepError('Las contraseñas no coinciden');
          return false;
        }
        if (passwordError || emailError || phoneError) {
          setStepError('Por favor corrige los errores en el formulario');
          return false;
        }
        break;
      case 1:
        if (!form.doctorId) {
          setStepError('Debes seleccionar un doctor');
          return false;
        }
        break;
      case 2:
        if (!form.acceptPrivacy || !form.acceptTerms || !form.signature) {
          setStepError('Debes aceptar todos los consentimientos legales y firmar digitalmente');
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(prev => Math.min(prev + 1, assistantSteps.length - 1));
    }
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 0));
  };

  // Búsqueda de doctores
  const searchDoctors = async (term) => {
    if (term.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/doctors/search?q=${encodeURIComponent(term)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.doctors || []);
      } else {
        console.error('Error en la búsqueda:', response.status);
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error buscando doctores:', error);
      setSuggestions([]);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowSuggestions(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchDoctors(value);
    }, 300);
  };

  const handleDoctorSelect = (doctor) => {
    setForm((prev) => ({ ...prev, doctorId: doctor.id, doctorName: doctor.name }));
    setSearchTerm('');
    setShowSuggestions(false);
    toast.success(`Quedarás vinculado en este registro al profesional de la salud ${doctor.name}, posteriormente si te atiende otro profesional de la red Qlinexa360, te podrá localizar con tu Nombre, Apellidos o email`);
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Nombre *</label>
                <input type="text" name="firstName" value={form.firstName} onChange={handleChange} className="block w-full text-base border border-gray-300 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Apellidos *</label>
                <input type="text" name="lastName" value={form.lastName} onChange={handleChange} className="block w-full text-base border border-gray-300 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2">Correo Electrónico *</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} className="block w-full text-base border border-gray-300 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
              {emailError && <p className="mt-2 text-sm text-red-600">{emailError}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Contraseña *</label>
                <input type="password" name="password" value={form.password} onChange={handleChange} className="block w-full text-base border border-gray-300 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                {passwordError && <p className="mt-2 text-sm text-red-600">{passwordError}</p>}
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Confirmar Contraseña *</label>
                <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} className="block w-full text-base border border-gray-300 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
              </div>
            </div>
            <div>
              <PhoneInput name="phone" label="Teléfono *" value={form.phone} onChange={handleChange} required error={phoneError} placeholder="Ej: 55 1234 5678" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Género</label>
                <select name="gender" value={form.gender} onChange={handleChange} className="block w-full text-base border border-gray-300 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                  <option value="">Selecciona...</option>
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Fecha de Nacimiento</label>
                <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange} className="block w-full text-base border border-gray-300 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-8 w-full max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Buscar Profesional de la Salud</h3>
              <p className="text-base text-gray-600">Encuentre al doctor que lo invitó a colaborar o busque por nombre</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-3">Buscar Profesional de la Salud *</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Busca por nombre, especialidad o email..."
                  className="w-full text-base border border-gray-300 rounded-lg py-4 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-xl max-h-64 overflow-auto">
                    {suggestions.map((doctor) => (
                      <div
                        key={doctor.id}
                        onClick={() => handleDoctorSelect(doctor)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-200 last:border-b-0 transition-colors"
                      >
                        <div className="font-semibold text-gray-900">{doctor.name}</div>
                        {doctor.specialty && <div className="text-sm text-gray-600 mt-1">{doctor.specialty}</div>}
                        <div className="text-xs text-gray-500 mt-1">{doctor.email}</div>
                      </div>
                    ))}
                  </div>
                )}
                {showSuggestions && suggestions.length === 0 && searchTerm.length >= 3 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-xl p-4">
                    <div className="text-gray-500 text-center">No se encontraron profesionales de la salud con ese criterio</div>
                  </div>
                )}
              </div>
            </div>
            {form.doctorName && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-5">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-800 font-semibold text-base">Vinculado al Profesional de la Salud: {form.doctorName}</span>
                </div>
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-8 w-full max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Consentimientos Legales</h3>
              <p className="text-base text-gray-600">Revise y acepte nuestras políticas para completar el registro</p>
            </div>
            
            {/* Aviso de Privacidad */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div className="flex items-center mb-4">
                <span className="font-semibold text-blue-700 text-lg">Aviso de Privacidad</span>
              </div>
              <div className="max-h-48 overflow-y-auto bg-white p-4 rounded border border-gray-100 text-sm text-gray-700 mb-4">
                <div className="space-y-3">
                  <p><b>AVISO DE PRIVACIDAD INTEGRAL - Qlinexa360</b></p>
                  <p><b>1. Responsable del Tratamiento:</b> Qlinexa360, plataforma digital de gestión médica, es responsable del tratamiento de sus datos personales.</p>
                  <p><b>2. Finalidades del Tratamiento:</b> Sus datos personales serán utilizados para: (a) Gestionar su registro como profesional de la salud; (b) Facilitar la gestión de pacientes y expedientes clínicos; (c) Mantener su perfil profesional; (d) Enviar notificaciones relacionadas con su práctica médica; (e) Cumplir con obligaciones legales y regulatorias.</p>
                  <p><b>3. Datos Personales Recopilados:</b> Recopilamos: (a) Datos de identificación (nombre, email, teléfono); (b) Datos profesionales (cédula, especialidad, dirección de consultorio); (c) Datos fiscales (RFC, razón social, dirección fiscal); (d) Datos de pacientes bajo su cuidado (con consentimiento previo).</p>
                  <p><b>4. Transferencias:</b> Sus datos pueden ser transferidos a: (a) Pacientes bajo su cuidado (solo información autorizada); (b) Autoridades sanitarias cuando sea requerido por ley; (c) Proveedores de servicios tecnológicos que nos apoyan en la operación de la plataforma.</p>
                  <p><b>5. Medidas de Seguridad:</b> Implementamos medidas técnicas, administrativas y físicas para proteger sus datos personales, incluyendo encriptación de datos, acceso restringido y auditorías regulares de seguridad.</p>
                  <p><b>6. Derechos ARCO:</b> Usted tiene derecho a: (a) Acceder a sus datos personales; (b) Rectificar sus datos cuando sean inexactos; (c) Cancelar el uso de sus datos; (d) Oponerse al tratamiento de sus datos para fines específicos.</p>
                  <p><b>7. Revocación del Consentimiento:</b> Puede revocar su consentimiento en cualquier momento, sin embargo, esto puede limitar la funcionalidad de la plataforma.</p>
                  <p><b>8. Conservación de Datos:</b> Sus datos se conservarán conforme a la normativa sanitaria mexicana (NOM-004-SSA3-2012) por un mínimo de 5 años desde el último acto médico.</p>
                  <p><b>9. Cambios al Aviso:</b> Nos reservamos el derecho de modificar este aviso. Los cambios serán notificados a través de la plataforma.</p>
                  <p><b>10. Contacto:</b> Para ejercer sus derechos ARCO o realizar consultas sobre este aviso, puede contactarnos a través de la plataforma o al correo electrónico de soporte.</p>
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
                  <p>El asistente deberá aceptar digitalmente el presente contrato, registrando nombre completo, fecha y hora (<b>timestamp</b>) como constancia de consentimiento informado.</p>
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
                  <p>Qlinexa360 podrá modificar este contrato en cualquier momento. Los cambios se notificarán a los usuarios y se publicarán en la Plataforma. El uso continuado implicará aceptación de las modificaciones.</p>
                  
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
          </div>
        );
      default:
        return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar que estemos en el último paso y que todos los consentimientos estén aceptados
    if (step !== assistantSteps.length - 1) {
      setStepError('Por favor completa todos los pasos del registro');
      return;
    }
    
    if (!form.acceptPrivacy || !form.acceptTerms || !form.signature) {
      setStepError('Debes aceptar todos los consentimientos legales y firmar digitalmente');
      return;
    }

    const formData = new FormData();
    formData.append('firstName', form.firstName);
    formData.append('lastName', form.lastName);
    formData.append('email', form.email);
    formData.append('password', form.password);
    formData.append('phone', form.phone);
    formData.append('doctorId', form.doctorId);
    formData.append('acceptPrivacy', form.acceptPrivacy);
    formData.append('acceptTerms', form.acceptTerms);
    formData.append('signature', form.signature);
    if (form.profilePhoto) formData.append('profilePhoto', form.profilePhoto);

    // Debug: mostrar qué campos se están enviando
    console.log('Campos del formulario:', {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      password: form.password ? '***' : 'undefined',
      phone: form.phone,
      doctorId: form.doctorId,
      acceptPrivacy: form.acceptPrivacy,
      acceptTerms: form.acceptTerms,
      signature: form.signature
    });

    // Debug: mostrar el FormData que se va a enviar
    for (let [key, value] of formData.entries()) {
      console.log(`FormData - ${key}:`, value);
    }

    try {
      const response = await fetch('http://localhost:3000/api/assistants/register', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        // Mostrar mensaje de éxito más prominente
        toast.success('¡Registro exitoso! Ya puedes iniciar sesión en la plataforma.');
        
        // Establecer estado de éxito
        setRegistrationSuccess(true);
        
        // Esperar un momento para que se vea el mensaje
        setTimeout(() => {
          // Redirigir al login
          navigate('/login');
        }, 2000);
      } else {
        console.log('Respuesta del servidor:', response.status, response.statusText);
        const data = await response.json();
        console.log('Datos de error del servidor:', data);
        toast.error(data.message || 'Error al registrar asistente');
      }
    } catch (error) {
      console.error('Error en el registro:', error);
      toast.error('Error de red o del servidor. Por favor, intenta de nuevo.');
    }
  };

  // Mostrar pantalla de éxito si el registro fue exitoso
  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-6 sm:px-6 lg:px-8">
        <div className="bg-white py-12 px-8 shadow-xl sm:rounded-xl sm:px-12 w-full max-w-2xl text-center">
          <div className="mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">¡Registro Exitoso!</h2>
            <p className="text-lg text-gray-600 mb-6">
              Tu cuenta de asistente ha sido creada correctamente
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 font-medium">
                Serás redirigido automáticamente a la página de inicio de sesión en unos segundos...
              </p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 font-medium transition-colors"
            >
              Ir al Login Ahora
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col py-6 sm:px-6 lg:px-8" style={{ paddingTop: '2rem' }}>
      <div className="sm:mx-auto w-full flex flex-col items-center">
        <Stepper />
        <h2 className="mt-4 text-center text-4xl font-extrabold text-gray-900">
          Registro de Asistente
        </h2>
        <p className="mt-2 text-center text-lg text-gray-600">
          Complete los siguientes pasos para registrarse como asistente
        </p>
      </div>

      <div className="mt-8 w-full flex justify-center">
        <div className="bg-white py-10 px-8 shadow-xl sm:rounded-xl sm:px-12 w-full max-w-4xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {renderStep()}
            
            {stepError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-800">{stepError}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6">
              <button
                type="button"
                onClick={prevStep}
                disabled={step === 0}
                className={`px-6 py-3 border border-gray-300 rounded-lg text-base font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                  step === 0 ? 'opacity-50 cursor-not-allowed' : 'shadow-sm'
                }`}
              >
                ← Anterior
              </button>
              
              {step < assistantSteps.length - 1 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-8 py-3 border border-transparent rounded-lg shadow-sm text-base font-semibold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                >
                  ✓ Completar Registro
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const RegisterRouter = () => {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const navigate = useNavigate();

  if (type === 'doctor' || type === 'nurse' || type === 'health_staff') return <RegisterDoctor />;
  if (type === 'patient') return <RegisterPatient />;
  if (type === 'assistant') return <RegisterAssistant />;

  return (
    <div className="flex flex-col items-center mt-24">
      <h2 className="text-4xl font-bold mb-8">Selecciona tipo de registro</h2>
      
      {/* Información: pacientes y asistentes se registran por invitación del profesional */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center space-x-3 bg-blue-50 border border-blue-200 rounded-lg px-6 py-4">
          <InformationCircleIcon className="h-6 w-6 text-blue-500" />
          <div className="text-lg text-blue-700">
            <span className="font-medium">Información importante:</span> El único usuario de paga es el Profesional de la Salud. 
            Los pacientes y asistentes se registran mediante invitación del profesional.
          </div>
        </div>
      </div>
      
      <div className="flex justify-center mb-6">
        <button
          className="px-8 py-5 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 w-64 text-xl font-semibold transition-all duration-200 hover:shadow-xl"
          onClick={() => navigate('/register?type=health_staff')}
        >
          Profesional de la Salud
        </button>
      </div>
      {/* Opciones de auto-registro (actualmente deshabilitadas - pacientes/asistentes por invitación).
          Para restaurar: descomentar los botones y actualizar el texto del banner si aplica. */}
      {/* <div className="flex justify-center mb-6">
        <button
          className="px-8 py-5 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 w-64 text-xl font-semibold transition-all duration-200 hover:shadow-xl"
          onClick={() => navigate('/register?type=patient')}
        >
          Soy Paciente
        </button>
      </div>
      <div className="flex justify-center">
        <button
          className="px-8 py-5 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 w-64 text-xl font-semibold transition-all duration-200 hover:shadow-xl"
          onClick={() => navigate('/register?type=assistant')}
        >
          Soy Asistente
        </button>
      </div> */}
    </div>
  );
};

export default RegisterRouter;