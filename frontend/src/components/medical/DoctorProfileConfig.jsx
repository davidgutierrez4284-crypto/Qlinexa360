import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getApiUrl, getApiHeaders } from '../../utils/api';
import { 
  UserIcon, 
  BuildingOfficeIcon, 
  AcademicCapIcon,
  PhotoIcon,
  TrashIcon,
  EyeIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import PhoneInput from '../common/PhoneInput';

// Resuelve logoUrl: S3 devuelve URL completa; ruta local (uploads/logos/...) necesita base de API
const resolveLogoUrl = (logoUrl, getApiUrlFn) => {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('http')) return logoUrl;
  return getApiUrlFn(logoUrl.startsWith('/') ? logoUrl : '/' + logoUrl);
};

const DoctorProfileConfig = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    consultorioDireccion: '',
    consultorioTelefono: '',
    certificadoProfesional: '',
    certificadoEspecialidad: '',
    certificadoMaestria: '',
    universidad: '',
    primaryColor: '#ffffff',
    secondaryColor: '#ffffff',
    socialMediaFacebook: '',
    socialMediaInstagram: '',
    socialMediaX: '',
    socialMediaOther: ''
  });
  const [logoFile, setLogoFile] = useState(null);
  const [currentLogo, setCurrentLogo] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchProfileConfig();
  }, []);

  const fetchProfileConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl('/api/doctor-profile/config'), {
        headers: getApiHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProfileData({
            consultorioDireccion: data.data.consultorioDireccion || '',
            consultorioTelefono: data.data.consultorioTelefono || '',
            certificadoProfesional: data.data.certificadoProfesional || '',
            certificadoEspecialidad: data.data.certificadoEspecialidad || '',
            certificadoMaestria: data.data.certificadoMaestria || '',
            universidad: data.data.universidad || '',
            primaryColor: data.data.primaryColor || '#ffffff',
            secondaryColor: data.data.secondaryColor || '#ffffff',
            socialMediaFacebook: data.data.socialMediaFacebook || '',
            socialMediaInstagram: data.data.socialMediaInstagram || '',
            socialMediaX: data.data.socialMediaX || '',
            socialMediaOther: data.data.socialMediaOther || ''
          });
          setCurrentLogo(resolveLogoUrl(data.data.logoUrl, getApiUrl));
        }
      }
    } catch (error) {
      console.error('Error fetching profile config:', error);
      toast.error('Error al cargar la configuración del perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogoChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validar tipo de archivo
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
        toast.error('Solo se permiten archivos JPG, PNG y GIF');
        return;
      }
      
      // Validar tamaño (máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('El archivo es demasiado grande. Máximo 2MB');
        return;
      }

      // Subir automáticamente el logo
      try {
        setSaving(true);
        const formData = new FormData();
        formData.append('logo', file);

        const response = await fetch(getApiUrl('/api/doctor-profile/logo'), {
          method: 'POST',
          headers: getApiHeaders(),
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCurrentLogo(resolveLogoUrl(data.data.logoUrl, getApiUrl));
            setLogoFile(null);
            toast.success('Logo subido exitosamente');
          }
        } else {
          const errorData = await response.json();
          toast.error(errorData.message || 'Error al subir el logo');
        }
      } catch (error) {
        console.error('Error uploading logo:', error);
        toast.error('Error al subir el logo');
      } finally {
        setSaving(false);
      }
    }
  };

  const uploadLogo = async () => {
    if (!logoFile) return;

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('logo', logoFile);

      const response = await fetch(getApiUrl('/api/doctor-profile/logo'), {
        method: 'POST',
        headers: getApiHeaders(),
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCurrentLogo(resolveLogoUrl(data.data.logoUrl, getApiUrl));
          setLogoFile(null);
          toast.success('Logo subido exitosamente');
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error al subir el logo');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Error al subir el logo');
    } finally {
      setSaving(false);
    }
  };

  const deleteLogo = async () => {
    if (!currentLogo) return;

    if (!window.confirm('¿Estás seguro de que quieres eliminar el logo?')) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(getApiUrl('/api/doctor-profile/logo'), {
        method: 'DELETE',
        headers: getApiHeaders()
      });

      if (response.ok) {
        setCurrentLogo(null);
        toast.success('Logo eliminado exitosamente');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error al eliminar el logo');
      }
    } catch (error) {
      console.error('Error deleting logo:', error);
      toast.error('Error al eliminar el logo');
    } finally {
      setSaving(false);
    }
  };

  const saveProfileConfig = async () => {
    try {
      setSaving(true);
      const response = await fetch(getApiUrl('/api/doctor-profile/config'), {
        method: 'PUT',
        headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Configuración guardada exitosamente');
        }
      } else {
        let errorMessage = 'Error al guardar la configuración';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.details || errorMessage;
        } catch (_) {
          if (response.status === 401) errorMessage = 'Sesión expirada. Inicia sesión nuevamente.';
          else if (response.status === 403) errorMessage = 'Sin permiso. Verifica tu suscripción.';
        }
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error saving profile config:', error);
      toast.error(error.message || 'Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const getRecipePreview = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl('/api/doctor-profile/recipe-preview'), {
        headers: getApiHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPreviewData(data.data);
          setShowPreview(true);
        }
      }
    } catch (error) {
      console.error('Error getting recipe preview:', error);
      toast.error('Error al obtener la vista previa');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <UserIcon className="h-8 w-8 text-blue-600 mr-3" />
          Configuración del Perfil para Recetas
        </h2>
        
        <p className="text-gray-600 mb-6">
          Personaliza el diseño de tus recetas médicas con tu información de consultorio, 
          certificaciones profesionales y colores corporativos.
        </p>

        {/* Información del Consultorio */}
        <div className="space-y-6">
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BuildingOfficeIcon className="h-5 w-5 text-blue-600 mr-2" />
              Información del Consultorio
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dirección del Consultorio
                </label>
                <input
                  type="text"
                  value={profileData.consultorioDireccion}
                  onChange={(e) => handleInputChange('consultorioDireccion', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Av. Principal 123, Ciudad"
                />
              </div>
              
              <div>
                <PhoneInput
                  name="consultorioTelefono"
                  label="Teléfono del Consultorio"
                  value={profileData.consultorioTelefono}
                  onChange={(e) => handleInputChange('consultorioTelefono', e.target.value)}
                  placeholder="Ej: 55 1234 5678"
                />
              </div>
            </div>
          </div>

          {/* Certificaciones Profesionales */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <AcademicCapIcon className="h-5 w-5 text-blue-600 mr-2" />
              Certificaciones Profesionales
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cédula Profesional
                </label>
                <input
                  type="text"
                  value={profileData.certificadoProfesional}
                  onChange={(e) => handleInputChange('certificadoProfesional', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="12345678"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Certificado de Especialidad
                </label>
                <input
                  type="text"
                  value={profileData.certificadoEspecialidad}
                  onChange={(e) => handleInputChange('certificadoEspecialidad', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ESP-12345"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Certificado de Maestría
                </label>
                <input
                  type="text"
                  value={profileData.certificadoMaestria}
                  onChange={(e) => handleInputChange('certificadoMaestria', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="MAE-67890"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Universidad
                </label>
                <input
                  type="text"
                  value={profileData.universidad}
                  onChange={(e) => handleInputChange('universidad', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: UNAM, IPN, UAM"
                />
              </div>
            </div>
          </div>

          {/* Redes Sociales */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ShareIcon className="h-5 w-5 text-blue-600 mr-2" />
              Redes Sociales
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Opcional. Aparecerán en el pie de página de tus recetas.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Facebook
                </label>
                <input
                  type="url"
                  value={profileData.socialMediaFacebook}
                  onChange={(e) => handleInputChange('socialMediaFacebook', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://facebook.com/tu-perfil"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instagram
                </label>
                <input
                  type="url"
                  value={profileData.socialMediaInstagram}
                  onChange={(e) => handleInputChange('socialMediaInstagram', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://instagram.com/tu-perfil"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  X (Twitter)
                </label>
                <input
                  type="url"
                  value={profileData.socialMediaX}
                  onChange={(e) => handleInputChange('socialMediaX', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://x.com/tu-perfil"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Otra (Web, LinkedIn, etc.)
                </label>
                <input
                  type="url"
                  value={profileData.socialMediaOther}
                  onChange={(e) => handleInputChange('socialMediaOther', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Colores Corporativos */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Colores Corporativos
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Primario
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={profileData.primaryColor}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={profileData.primaryColor}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Secundario
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={profileData.secondaryColor}
                    onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={profileData.secondaryColor}
                    onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setProfileData(prev => ({
                    ...prev,
                    primaryColor: '#ffffff',
                    secondaryColor: '#ffffff'
                  }));
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Resetear Colores a Blanco
              </button>
            </div>
          </div>

          {/* Logo del Consultorio */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <PhotoIcon className="h-5 w-5 text-blue-600 mr-2" />
              Logo del Consultorio
            </h3>
            
            <div className="space-y-4">
              {/* Logo actual */}
              {currentLogo && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo actual
                  </label>
                  <div className="flex items-center space-x-4">
                    <img 
                      src={currentLogo} 
                      alt="Logo actual" 
                      className="w-20 h-20 object-contain border border-gray-300 rounded-md"
                    />
                    <button
                      onClick={deleteLogo}
                      disabled={saving}
                      className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4 mr-2" />
                      Eliminar Logo
                    </button>
                  </div>
                </div>
              )}
              
              {/* Subir nuevo logo */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {currentLogo ? 'Cambiar logo' : 'Subir logo'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {saving && (
                  <p className="text-sm text-blue-600 mt-2">Subiendo logo...</p>
                )}
              </div>
              
              <p className="text-sm text-gray-500">
                Formatos permitidos: JPG, PNG, GIF. Tamaño máximo: 2MB
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-wrap gap-4 pt-6">
          <button
            onClick={saveProfileConfig}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
          
          <button
            onClick={getRecipePreview}
            disabled={loading}
            className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
          >
            <EyeIcon className="h-4 w-4 mr-2" />
            Ver Vista Previa
          </button>
        </div>
      </div>

      {/* Modal de Vista Previa */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Vista Previa de tu Receta
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                <div className="text-center mb-6">
                  <h4 className="text-lg font-semibold text-gray-900">
                    {previewData.doctor.professionalTitle} {previewData.doctor.firstName} {previewData.doctor.lastName}
                  </h4>
                  <p className="text-gray-600">{previewData.doctor.specialization}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {previewData.doctor.consultorioDireccion}
                  </p>
                  <p className="text-sm text-gray-500">
                    Tel: {previewData.doctor.consultorioTelefono}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-white rounded border">
                    <p className="text-sm font-medium text-gray-700">Cédula Profesional</p>
                    <p className="text-lg font-semibold text-blue-600">{previewData.doctor.certificadoProfesional}</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded border">
                    <p className="text-sm font-medium text-gray-700">Especialidad</p>
                    <p className="text-lg font-semibold text-blue-600">{previewData.doctor.certificadoEspecialidad}</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded border">
                    <p className="text-sm font-medium text-gray-700">Maestría</p>
                    <p className="text-lg font-semibold text-blue-600">{previewData.doctor.certificadoMaestria}</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded border">
                    <p className="text-sm font-medium text-gray-700">Universidad</p>
                    <p className="text-lg font-semibold text-blue-600">{previewData.doctor.universidad || '—'}</p>
                  </div>
                </div>
                {(previewData.doctor.socialMediaFacebook || previewData.doctor.socialMediaInstagram || previewData.doctor.socialMediaX || previewData.doctor.socialMediaOther) && (
                  <div className="mb-4 p-3 bg-white rounded border">
                    <p className="text-sm font-medium text-gray-700 mb-2">Redes Sociales</p>
                    <div className="flex flex-wrap gap-2">
                      {previewData.doctor.socialMediaFacebook && <a href={previewData.doctor.socialMediaFacebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline">Facebook</a>}
                      {previewData.doctor.socialMediaInstagram && <a href={previewData.doctor.socialMediaInstagram} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline">Instagram</a>}
                      {previewData.doctor.socialMediaX && <a href={previewData.doctor.socialMediaX} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline">X</a>}
                      {previewData.doctor.socialMediaOther && <a href={previewData.doctor.socialMediaOther} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline">Web</a>}
                    </div>
                  </div>
                )}
                
                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    Esta es una vista previa de cómo se verá tu receta personalizada
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Los colores, logo y datos se aplicarán automáticamente a todas tus recetas
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorProfileConfig;
