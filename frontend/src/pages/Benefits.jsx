import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Tooltip } from '@mui/material';
import axios from 'axios';
import { styled } from '@mui/material/styles';
import { useAuth } from '../context/AuthContext';

const greenCheck = (
  <svg className="w-5 h-5 text-green-600 inline mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
);

// Crear un Tooltip personalizado con mayor tamaño de letra
const LargeTooltip = styled(({ className, ...props }) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(() => ({
  [`& .MuiTooltip-tooltip`]: {
    fontSize: '1.1rem',
    padding: '12px 16px',
    maxWidth: 320,
  },
}));

// Mapeo de secciones a nombres legibles
// Obtener tipo MIME del video según la extensión en la URL
const getVideoMimeType = (videoUrl) => {
  if (!videoUrl) return 'video/mp4';
  const ext = videoUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || 'mp4';
  const types = { mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', mov: 'video/quicktime', avi: 'video/x-msvideo' };
  return types[ext] || 'video/mp4';
};

const SECTION_NAMES = {
  'dashboard': 'Dashboard',
  'patients': 'Mis Pacientes',
  'calendar': 'Calendario',
  'medical-records': 'Historial Clínico',
  'prescriptions': 'Recetas',
  'documents': 'Zona de estudio',
  'billing': 'Relación de facturación',
  'profile': 'Mi perfil',
  'help': 'Ayuda y tutoriales',
  'general': 'General',
  'sales': 'Videos de ventas',
};

const Benefits = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isLoggedIn = !!user?.role;
  
  const [feedbackType, setFeedbackType] = useState('sugerencia');
  const [feedback, setFeedback] = useState('');
  const [reporterEmail, setReporterEmail] = useState(''); // Solo se usa cuando NO está logeado
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState('all');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDesc, setVideoDesc] = useState('');
  const [videoSection, setVideoSection] = useState('general');
  const [videoFile, setVideoFile] = useState(null);
  const [videoUploadMsg, setVideoUploadMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const tooltipText = feedbackType === 'sugerencia'
    ? 'Gracias a tus recomendaciones mantendremos Qlinexa360 a la vanguardia para que sea la mejor opción para la gestión de Personal de la Salud con Pacientes.'
    : 'Lamentamos mucho los inconvenientes que tengas, por favor danos tu observación con el mayor detalle posible para que podamos ayudar en cuanto antes. Priorizaremos esta queja, esperamos darte una solución muy pronto.';

  const handleSend = async () => {
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      // Sin sesión: requerir correo electrónico
      if (!isLoggedIn) {
        const emailTrimmed = (reporterEmail || '').trim();
        if (!emailTrimmed || !emailTrimmed.includes('@')) {
          setError('Ingresa tu correo electrónico para poder enviar sugerencias o quejas.');
          setLoading(false);
          return;
        }
      }

      const token = localStorage.getItem('token');
      const payload = { type: feedbackType, message: feedback };
      if (!isLoggedIn) {
        payload.email = reporterEmail.trim();
      }

      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      };
      await axios.post('/api/feedback', payload, config);

      setSuccess('¡Tu mensaje ha sido enviado!');
      setFeedback('');
      if (!isLoggedIn) setReporterEmail('');
    } catch (e) {
      setError(e.response?.data?.message || 'Hubo un error al enviar tu mensaje. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    'Gestión integral de pacientes y profesionales de la salud',
    'Consentimientos y documentos digitales',
    'Suscripciones automatizadas',
    'Relación de facturación profesional de la salud - paciente. No es un portal de facturación, únicamente se relacionan o vinculan para una búsqueda fácil.',
    'Historial clínico de todos tus pacientes',
    'Dashboards avanzados para tomar decisiones',
    'Recetas digitales.',
    'Notificaciones y recordatorios por email',
    'Panel de administración avanzado',
    'Seguridad y privacidad de datos',
    'Gestión de citas avanzado',
    'Posibilidad de añadir asistentes para apoyar a los profesionales de la salud',
    'Interacción con otros profesionales de salud sobre un historial clínico',
    'Compromiso de Qlinexa360 de mejorar constantemente las funcionalidades para ser la mejor plataforma de gestión al mismo precio ($499 mxn/mes IVA incluido)',
  ];

  const internalSections = Object.fromEntries(
    Object.entries(SECTION_NAMES).filter(([key]) => key !== 'sales')
  );
  const publicSections = { all: 'Todos', general: SECTION_NAMES.general, sales: SECTION_NAMES.sales };
  const sectionOptions = isLoggedIn ? { all: 'Todas las secciones', ...internalSections } : publicSections;
  const uploadSectionOptions = isAdmin ? SECTION_NAMES : internalSections;

  useEffect(() => {
    if (!isLoggedIn) {
      setSelectedSection('all'); // Mostrar todos los videos públicos (general + sales)
    } else {
      setSelectedSection('all');
    }
  }, [isLoggedIn]);

  // Cargar videos desde la API
  useEffect(() => {
    const loadVideos = async () => {
      try {
        setLoadingVideos(true);
        const token = localStorage.getItem('token');
        const response = isLoggedIn
          ? await axios.get('/api/tutorial-videos', {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            })
          : await axios.get('/api/tutorial-videos/public');
        setVideos(response.data);
      } catch (error) {
        console.error('Error cargando videos:', error);
      } finally {
        setLoadingVideos(false);
      }
    };

    loadVideos();
  }, [isLoggedIn]);

  // Organizar videos por sección
  const videosBySection = videos.reduce((acc, video) => {
    if (!acc[video.section]) {
      acc[video.section] = [];
    }
    acc[video.section].push(video);
    return acc;
  }, {});

  // Filtrar videos por búsqueda y sección
  const filteredVideos = videos.filter(v => {
    const matchesSearch = !search || 
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(search.toLowerCase()));
    const matchesSection = selectedSection === 'all' || v.section === selectedSection;
    return matchesSearch && matchesSection;
  });

  // Subir video a la plataforma
  const handleVideoUpload = async (e) => {
    e.preventDefault();
    if (!videoTitle || !videoFile) {
      setVideoUploadMsg('Título y video son requeridos.');
      return;
    }

    try {
      setUploading(true);
      setVideoUploadMsg('');
      const token = localStorage.getItem('token');
      if (!token) {
        setVideoUploadMsg('Debes iniciar sesión para subir videos.');
        return;
      }

      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('title', videoTitle);
      formData.append('description', videoDesc || '');
      formData.append('section', videoSection);

      const response = await axios.post('/api/tutorial-videos/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setVideoUploadMsg('¡Video subido exitosamente!');
      setVideoTitle('');
      setVideoDesc('');
      setVideoFile(null);
      setVideoSection('general');

      // Recargar videos
      const videosResponse = await axios.get('/api/tutorial-videos', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      setVideos(videosResponse.data);

      setTimeout(() => setVideoUploadMsg(''), 3000);
    } catch (error) {
      console.error('Error subiendo video:', error);
      setVideoUploadMsg(error.response?.data?.message || 'Error al subir el video. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!isAdmin || deletingId) return;
    const confirmed = window.confirm('¿Deseas eliminar este video? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    try {
      setDeletingId(videoId);
      const token = localStorage.getItem('token');
      if (!token) {
        setVideoUploadMsg('Debes iniciar sesión para eliminar videos.');
        return;
      }

      await axios.delete(`/api/tutorial-videos/${videoId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setVideos(prev => prev.filter(video => video.id !== videoId));
      setVideoUploadMsg('Video eliminado exitosamente.');
      setTimeout(() => setVideoUploadMsg(''), 3000);
    } catch (error) {
      console.error('Error eliminando video:', error);
      setVideoUploadMsg(error.response?.data?.message || 'Error al eliminar el video. Intenta de nuevo.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="mt-12 w-full max-w-2xl">
        <div className="bg-green-100 border border-green-400 text-green-800 text-lg font-bold rounded-lg px-6 py-4 mb-6 text-center shadow">
          <div className="mb-2">
            Único plan, todas las funcionalidades y todo lo nuevo que se incorpore para mejorar la plataforma por
          </div>
          <div className="font-extrabold text-green-700">
            $499 mxn/mes IVA incluido
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-6 mb-8">
          <div className="text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold mb-3">
              Modelo de pago claro y transparente
            </div>
            <h2 className="text-2xl font-extrabold text-blue-900">
              Solo paga el Profesional de la Salud
            </h2>
            <p className="mt-2 text-gray-700">
              Los usuarios de tipo Asistente y Paciente son gratuitos, ilimitados y siempre dependen de un Profesional de la Salud activo.
            </p>
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="text-sm font-semibold text-green-700">Profesional de la Salud</div>
              <div className="mt-1 text-2xl font-extrabold text-green-800">$499/mes</div>
              <div className="mt-1 text-xs text-green-700">IVA incluido</div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="text-sm font-semibold text-blue-700">Asistentes</div>
              <div className="mt-1 text-2xl font-extrabold text-blue-900">Gratis</div>
              <div className="mt-1 text-xs text-blue-700">Ilimitados con un profesional activo</div>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <div className="text-sm font-semibold text-purple-700">Pacientes</div>
              <div className="mt-1 text-2xl font-extrabold text-purple-900">Gratis</div>
              <div className="mt-1 text-xs text-purple-700">Ilimitados con un profesional activo</div>
            </div>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-blue-800 mb-6 text-center">Beneficios de Qlinexa360</h1>
        <div className="text-lg text-gray-700 space-y-3 mb-10">
          {benefits.map((text, idx) => (
            <div key={idx} className="flex items-start">
              <span className="flex-shrink-0 mt-1">{greenCheck}</span>
              <span className="ml-2 break-words text-left">{text}</span>
            </div>
          ))}
        </div>

        {/* Sección de videos/tutoriales */}
        <div className="bg-white rounded-lg shadow p-6 mb-10">
          <h2 className="text-xl font-semibold mb-4">Videos y Tutoriales de la Plataforma</h2>
          
          {/* Formulario de subida (solo administrador de la plataforma) */}
          {isAdmin && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3">Subir nuevo video tutorial</h3>
              <form onSubmit={handleVideoUpload}>
                <div className="space-y-3">
                  <input
                    type="text"
                    className="border border-gray-300 rounded px-3 py-2 w-full"
                    placeholder="Título del video *"
                    value={videoTitle}
                    onChange={e => setVideoTitle(e.target.value)}
                    required
                  />
                  <textarea
                    className="border border-gray-300 rounded px-3 py-2 w-full"
                    placeholder="Descripción (opcional)"
                    value={videoDesc}
                    onChange={e => setVideoDesc(e.target.value)}
                    rows={2}
                  />
                  <select
                    className="border border-gray-300 rounded px-3 py-2 w-full"
                    value={videoSection}
                    onChange={e => setVideoSection(e.target.value)}
                    required
                  >
                    <option value="">Selecciona una sección *</option>
                  {Object.entries(uploadSectionOptions).map(([key, name]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                  </select>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo"
                    onChange={e => setVideoFile(e.target.files[0])}
                    className="w-full"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                  disabled={uploading}
                >
                  {uploading ? 'Subiendo...' : 'Subir video'}
                </button>
                {videoUploadMsg && (
                  <div className={`mt-2 ${videoUploadMsg.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                    {videoUploadMsg}
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Filtros de búsqueda y sección */}
          <div className="mb-4 space-y-3">
            <input
              type="text"
              className="border border-gray-300 rounded px-3 py-2 w-full"
              placeholder="Buscar videos o tutoriales..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="border border-gray-300 rounded px-3 py-2 w-full"
              value={selectedSection}
              onChange={e => setSelectedSection(e.target.value)}
            >
              {isLoggedIn && <option value="all">Todas las secciones</option>}
              {Object.entries(sectionOptions).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>

          {/* Lista de videos */}
          {loadingVideos ? (
            <div className="text-center py-8 text-gray-500">Cargando videos...</div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {search || selectedSection !== 'all' 
                ? 'No se encontraron videos con los filtros seleccionados.' 
                : 'No hay videos tutoriales disponibles.'}
            </div>
          ) : (
            <div className="space-y-6">
              {selectedSection === 'all' ? (
                // Mostrar organizados por sección
                Object.entries(videosBySection).map(([section, sectionVideos]) => {
                  const filteredSectionVideos = sectionVideos.filter(v => 
                    !search || 
                    v.title.toLowerCase().includes(search.toLowerCase()) ||
                    (v.description && v.description.toLowerCase().includes(search.toLowerCase()))
                  );
                  
                  if (filteredSectionVideos.length === 0) return null;

                  return (
                    <div key={section} className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                        {SECTION_NAMES[section] || section}
                      </h3>
                      <div className="space-y-4">
                        {filteredSectionVideos.map(video => (
                          <div key={video.id} className="bg-gray-50 rounded-lg p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <h4 className="font-bold text-lg">{video.title}</h4>
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="text-red-600 text-sm font-semibold hover:underline disabled:opacity-50"
                                  onClick={() => handleDeleteVideo(video.id)}
                                  disabled={deletingId === video.id}
                                >
                                  {deletingId === video.id ? 'Eliminando...' : 'Eliminar'}
                                </button>
                              )}
                            </div>
                            {video.description && (
                              <p className="text-gray-700 mb-3 text-sm">{video.description}</p>
                            )}
                            <video 
                              controls 
                              className="w-full rounded shadow"
                              preload="metadata"
                              playsInline
                            >
                              <source src={video.videoUrl} type={getVideoMimeType(video.videoUrl)} />
                              Tu navegador no soporta el video.
                            </video>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                // Mostrar solo videos de la sección seleccionada
                filteredVideos.map(video => (
                  <div key={video.id} className="bg-gray-50 rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="font-bold text-lg">{video.title}</h4>
                      {isAdmin && (
                        <button
                          type="button"
                          className="text-red-600 text-sm font-semibold hover:underline disabled:opacity-50"
                          onClick={() => handleDeleteVideo(video.id)}
                          disabled={deletingId === video.id}
                        >
                          {deletingId === video.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      )}
                    </div>
                    {video.description && (
                      <p className="text-gray-700 mb-3 text-sm">{video.description}</p>
                    )}
                    <video 
                      controls 
                      className="w-full rounded shadow"
                      preload="metadata"
                      playsInline
                    >
                      <source src={video.videoUrl} type={getVideoMimeType(video.videoUrl)} />
                      Tu navegador no soporta el video.
                    </video>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sección de feedback */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">¿Tienes sugerencias o quejas?</h2>
          {!isLoggedIn && (
            <div className="mb-4">
              <label className="block font-medium text-gray-700 mb-1">Correo electrónico (requerido para usuarios sin sesión)</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="tu@correo.com"
                value={reporterEmail}
                onChange={e => setReporterEmail(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center mb-2">
            <label className="mr-2 font-medium">Tipo:</label>
            <select
              className="border border-gray-300 rounded px-2 py-1"
              value={feedbackType}
              onChange={e => setFeedbackType(e.target.value)}
            >
              <option value="sugerencia">Sugerencias o recomendaciones</option>
              <option value="queja">Quejas</option>
            </select>
            <LargeTooltip title={tooltipText} placement="right">
              <svg className="w-5 h-5 ml-2 text-blue-500 cursor-pointer" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" /></svg>
            </LargeTooltip>
          </div>
          <textarea
            className="w-full border border-gray-300 rounded p-2 mt-2 mb-2"
            maxLength={500}
            rows={4}
            placeholder="Escribe aquí tu mensaje (máx. 500 caracteres)"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSend}
              disabled={loading || feedback.length === 0 || (!isLoggedIn && !reporterEmail.trim())}
            >
              {loading ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
          {success && <div className="text-green-600 mt-2">{success}</div>}
          {error && <div className="text-red-600 mt-2">{error}</div>}
        </div>

        {/* Enlaces legales - Aviso de Privacidad y Términos de Uso */}
        <div className="mt-10 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600 mb-3">Documentos legales de la plataforma</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/aviso-privacidad"
              className="text-blue-600 hover:text-blue-800 font-medium underline"
            >
              Aviso de Privacidad
            </Link>
            <span className="text-gray-400">|</span>
            <Link
              to="/terminos"
              className="text-blue-600 hover:text-blue-800 font-medium underline"
            >
              Términos de Uso
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Benefits;
