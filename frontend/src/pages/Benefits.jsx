import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Tooltip } from '@mui/material';
import axios from 'axios';
import { styled } from '@mui/material/styles';
import { useAuth } from '../context/AuthContext';

// Iconos para las tarjetas de beneficios (Heroicons outline, viewBox 0 0 24 24)
const BENEFIT_ICONS = {
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  video: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  document: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  creditCard: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
  banknotes: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375a1.125 1.125 0 011.125 1.125v1.5c0 .414-.336.75-.75.75h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.375M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
  link: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244',
  folder: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
  chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  pill: 'M10.5 4.5a.75.75 0 00-.75.75v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5a.75.75 0 00-.75-.75z',
  bell: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  cog: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z',
  shield: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  userGroup: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
  chat: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
  heart: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
  lock: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
  sparkles: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
  beaker: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
};

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

const DEMO_CALENDAR_URL = 'https://calendar.app.google/XTioZCzqHfEGcegG7';

const ScheduleDemoLink = ({ className = '' }) => (
  <a
    href={DEMO_CALENDAR_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={`inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
  >
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={BENEFIT_ICONS.calendar} />
    </svg>
    Agendar demo
  </a>
);

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

  const benefitCards = [
    { title: 'Gestión integral', desc: 'Pacientes y profesionales en un solo lugar. Administra tu consultorio de forma eficiente.', icon: 'users', gradient: 'from-blue-500 to-indigo-600' },
    { title: 'Telemedicina', desc: 'Videollamadas con Google Meet o Teams, consentimiento digital incluido. Expande tu consulta sin límites.', icon: 'video', gradient: 'from-cyan-500 to-blue-600' },
    {
      title: 'Cobros con Mercado Pago',
      desc: 'Si lo deseas, enlaza tu cuenta de Mercado Pago en «Mi Perfil» y genera enlaces de cobro a pacientes (ideal para teleconsultas). Los fondos se acreditan en tu cuenta; Mercado Pago aplica su comisión de procesamiento y Qlinexa360 una comisión mínima de plataforma para mantener la integración. No es obligatorio: puedes seguir cobrando por tu cuenta.',
      icon: 'banknotes',
      gradient: 'from-sky-400 to-blue-700',
      optional: true,
    },
    { title: 'Consentimientos digitales', desc: 'Firma electrónica y avisos de privacidad listos para cumplir con la normativa.', icon: 'document', gradient: 'from-emerald-500 to-teal-600' },
    { title: 'Suscripciones automatizadas', desc: 'Gestiona las suscripciones de tus pacientes sin esfuerzo manual.', icon: 'creditCard', gradient: 'from-violet-500 to-purple-600' },
    { title: 'Relación de facturación', desc: 'Vincula profesional-paciente para búsquedas y trazabilidad. Distinto del cobro opcional con Mercado Pago: aquí no se procesan pagos de consultas.', icon: 'link', gradient: 'from-amber-500 to-orange-600' },
    { title: 'Pre-consultas', desc: 'Envía un formulario previo para que el paciente capture su información antes de la consulta. Llegas con contexto, reduces tiempos de captura y enfocas la consulta en lo clínico.', icon: 'sparkles', gradient: 'from-blue-600 to-sky-500' },
    { title: 'Historial clínico', desc: 'Expediente completo de cada paciente. Acceso desde cualquier dispositivo.', icon: 'folder', gradient: 'from-sky-500 to-blue-600' },
    { title: 'Dashboards avanzados', desc: 'Métricas clave para tomar decisiones y mejorar la operación de tu consultorio.', icon: 'chart', gradient: 'from-rose-500 to-pink-600' },
    { title: 'Recetas digitales', desc: 'Genera y comparte recetas de forma rápida y profesional.', icon: 'pill', gradient: 'from-lime-500 to-green-600' },
    { title: 'Notificaciones por email', desc: 'Recordatorios que reducen inasistencias y mantienen a tus pacientes informados.', icon: 'bell', gradient: 'from-fuchsia-500 to-purple-600' },
    { title: 'Panel de administración', desc: 'Control total sobre la configuración de tu práctica.', icon: 'cog', gradient: 'from-slate-500 to-gray-600' },
    { title: 'Seguridad y privacidad', desc: 'Datos protegidos conforme a la normativa vigente.', icon: 'shield', gradient: 'from-green-500 to-emerald-600' },
    { title: 'Gestión de citas', desc: 'Agenda, reprograma y confirma. Integración con Google y Outlook Calendar.', icon: 'calendar', gradient: 'from-indigo-500 to-blue-600' },
    { title: 'Asistentes', desc: 'Personal de apoyo con acceso controlado a las funciones que necesiten.', icon: 'userGroup', gradient: 'from-cyan-500 to-teal-600' },
    { title: 'Colaboración entre profesionales', desc: 'Comparte y consulta historiales clínicos con otros colegas.', icon: 'chat', gradient: 'from-blue-500 to-cyan-600' },
    {
      title: 'Laboratorio Inteligente',
      desc: 'PDF de laboratorio → indicadores listos en segundos. Semáforos, tendencias y comparativos en una vista profesional — interpretación del profesional.',
      icon: 'beaker',
      gradient: 'from-teal-600 to-emerald-700',
    },
    {
      title: 'Beneficios en mensualidad por plan de referidos',
      desc: 'Invita colegas con tu código: acumulas beneficio aplicable a tu mensualidad y ellos pueden obtener tiempo extra al activar la suscripción, según las reglas vigentes del programa en tu perfil.',
      icon: 'sparkles',
      gradient: 'from-amber-500 to-rose-600',
    },
    { title: 'Compromiso Qlinexa360', desc: 'Mejoras constantes para ser la mejor plataforma de gestión al mismo precio ($499 mxn/mes IVA incluido).', icon: 'heart', gradient: 'from-red-500 to-rose-600' },
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
      <div className="mt-8 sm:mt-10 w-full max-w-2xl px-4 sm:px-0">
        <section className="mb-5" aria-labelledby="app-title-benefits">
          <h1
            id="app-title-benefits"
            className="text-3xl sm:text-4xl font-extrabold text-blue-900 tracking-tight text-center"
          >
            Qlinexa360
          </h1>
          <p className="mt-2 text-base sm:text-lg font-semibold text-blue-800 leading-snug text-center">
            Plataforma médica para gestión médico-paciente y sincronización de agenda médica.
          </p>
          <p className="mt-3 text-sm sm:text-base text-gray-700 leading-relaxed text-left sm:text-center max-w-3xl mx-auto">
            Qlinexa360 ayuda a profesionales de la salud a gestionar pacientes, agenda médica, expediente clínico,
            recetas, citas y comunicación operativa desde una plataforma web segura.
          </p>
          <p
            lang="en"
            className="mt-3 text-xs sm:text-sm text-gray-600 leading-relaxed text-left max-w-3xl mx-auto border-l-4 border-blue-300 pl-3 sm:pl-4"
          >
            Qlinexa360 is a medical practice management platform for healthcare professionals, including appointment
            scheduling, patient management, clinical records, prescriptions, and Google Calendar synchronization.
          </p>
        </section>

        <section
          className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-left"
          aria-labelledby="gcal-benefits-heading"
        >
          <h2 id="gcal-benefits-heading" className="text-sm sm:text-base font-bold text-green-900 leading-snug">
            Integración con Google Calendar / Google Calendar Integration
          </h2>
          <p className="mt-2 text-sm text-gray-800 leading-relaxed">
            Qlinexa360 utiliza la integración con Google Calendar para sincronizar citas médicas entre la plataforma y
            el calendario de Google del profesional de la salud. La integración permite reflejar altas, cambios o
            cancelaciones de citas iniciadas por el profesional dentro de Qlinexa360.
          </p>
          <p
            lang="en"
            className="mt-2 text-xs sm:text-sm text-gray-600 leading-relaxed border-l-4 border-green-400 pl-3"
          >
            Qlinexa360 uses Google Calendar integration to synchronize medical appointments between the platform and
            the healthcare professional&apos;s Google Calendar. The integration supports appointment creation, updates,
            and cancellations initiated by the professional inside Qlinexa360.
          </p>
        </section>

        {/* Enlace a privacidad visible sin desplazarse (requisitos OAuth / verificación Google) */}
        <nav
          className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm text-blue-900"
          aria-label="Enlaces legales"
        >
          <span className="font-medium">Qlinexa360 — </span>
          <a
            href="/aviso-privacidad"
            className="font-semibold text-blue-700 underline hover:text-blue-900"
          >
            Aviso de Privacidad / Privacy Policy
          </a>
          <span className="text-blue-800"> · </span>
          <a
            href="/terminos"
            className="font-medium text-blue-700 underline hover:text-blue-900"
          >
            Términos de Uso
          </a>
        </nav>

        <div
          className="mb-4 flex flex-col gap-3 rounded-lg border border-indigo-200/90 bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50/80 px-4 py-3 text-sm sm:text-[0.9375rem] leading-snug text-indigo-950 shadow-sm ring-1 ring-indigo-100/70 sm:flex-row sm:items-center sm:justify-between"
          role="note"
        >
          <strong className="font-semibold tracking-tight text-indigo-950 text-center sm:text-left">
            Plataforma Qlinexa360 alineada para cumplir con la NOM-004-SSA3-2012
          </strong>
          <ScheduleDemoLink className="w-full sm:w-auto shrink-0" />
        </div>

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

          <p className="mt-6 text-gray-700 text-sm sm:text-base text-center max-w-2xl mx-auto">
            La suscripción a la plataforma se paga con PayPal. El cobro de consultas es independiente: puedes usar tu propio medio o, de forma opcional, enlazar Mercado Pago en «Mi Perfil» para generar enlaces de pago a pacientes.
          </p>

          {/* Pago seguro con PayPal - Destacado */}
          <div className="mt-8 pt-6 border-t-2 border-blue-200">
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 flex flex-col sm:flex-row items-start gap-5">
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={BENEFIT_ICONS.lock} />
                </svg>
              </div>
              <div className="text-left min-w-0 flex-1">
                <h3 className="font-bold text-blue-900 text-xl">Pago seguro de tu suscripción con PayPal</h3>
                <p className="text-gray-700 text-base mt-2 max-w-md">
                  El pago mensual de la plataforma se realiza con PayPal.{' '}
                  <strong className="text-blue-800">Solo cubre tu suscripción</strong> — el cobro de consultas es aparte: por tu cuenta o, si lo prefieres, con la integración opcional de Mercado Pago.
                </p>
              </div>
            </div>
          </div>

          {/* 15 días gratis antes del cobro recurrente */}
          <div className="mt-6 pt-6 border-t-2 border-emerald-100">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-6 flex flex-col sm:flex-row items-start gap-5">
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={BENEFIT_ICONS.calendar} />
                </svg>
              </div>
              <div className="text-left min-w-0 flex-1">
                <h3 className="font-bold text-emerald-900 text-xl">15 días gratis para conocer la plataforma</h3>
                <p className="text-gray-700 text-base mt-2 max-w-lg">
                  Al registrarte como profesional de la salud tienes <strong className="text-emerald-800">15 días completos de acceso gratuito</strong> para comprobar que Qlinexa360 cubre tus necesidades. <strong className="text-emerald-800">A partir del día 16</strong> inicia el cobro recurrente de la suscripción mediante PayPal.
                </p>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-blue-800 mb-1 text-center">Funcionalidades principales</h2>
        <p className="text-center text-gray-600 text-sm sm:text-base mb-5">
          Precios, funcionalidades y material informativo.
        </p>

        <div className="mb-8 mx-auto max-w-3xl rounded-xl border border-blue-200/80 bg-gradient-to-br from-white via-sky-50/50 to-blue-50/60 px-5 py-5 text-center shadow-md ring-1 ring-blue-100/70">
          <p className="text-base sm:text-lg font-semibold text-blue-950 leading-snug">
            Un solo plan,{' '}
            <span className="text-blue-700">todo incluido</span>: lo que ves en esta lista forma parte del mismo
            acceso mensual — sin módulos de pago adicionales ni costos ocultos por funcionalidad.
          </p>
          <p
            className="mt-3 text-sm sm:text-[0.9375rem] font-semibold text-indigo-950/95 leading-snug border-t border-indigo-100/80 pt-3"
            role="note"
          >
            Plataforma Qlinexa360 alineada para cumplir con la NOM-004-SSA3-2012
          </p>
        </div>

        <div className="space-y-6 mb-10">
          {benefitCards.map((card, idx) => (
            <div
              key={idx}
              className={`rounded-xl shadow-lg p-6 flex flex-col sm:flex-row items-start gap-5 transition-all ${
                card.optional
                  ? 'bg-gradient-to-r from-sky-50 via-white to-blue-50 border-2 border-dashed border-sky-300 hover:border-sky-400 hover:shadow-xl ring-1 ring-sky-100'
                  : 'bg-gradient-to-r from-gray-50 via-white to-gray-50 border-2 border-gray-200 hover:border-blue-200 hover:shadow-xl'
              }`}
            >
              <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg`}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={BENEFIT_ICONS[card.icon]} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-gray-900">{card.title}</h2>
                  {card.optional && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-900 ring-2 ring-amber-300">
                      Opcional
                    </span>
                  )}
                </div>
                <p className="text-gray-700 leading-relaxed">{card.desc}</p>
                {card.optional && (
                  <p className="mt-3 text-sm font-medium text-sky-800 bg-sky-100/80 border border-sky-200 rounded-lg px-3 py-2">
                    Actívalo solo si te conviene. Sin Mercado Pago conectado, la plataforma funciona igual; no hay cargo extra en tu mensualidad por tenerlo disponible.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-10 rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 via-white to-sky-50 p-6 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <h2 className="text-xl font-bold text-blue-900">¿Quieres ver Qlinexa360 en acción?</h2>
            <p className="mt-1 text-gray-700 text-sm sm:text-base">
              Reserva una demo personalizada en mi calendario y te muestro la plataforma en vivo.
            </p>
          </div>
          <ScheduleDemoLink className="w-full sm:w-auto px-6 py-3 text-base" />
        </div>

        {/* Sección de videos/tutoriales */}
        <div className="bg-white rounded-lg shadow p-6 mb-10">
          <h2 className="text-xl font-semibold mb-4">Videos y Tutoriales de la Plataforma</h2>

          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
            <div className="font-semibold text-blue-900">Pre-consultas</div>
            <div className="text-sm text-blue-900/80 mt-1 leading-snug">
              Comparte un enlace para que el paciente complete su información antes de la cita. Así optimizas el tiempo,
              reduces tareas administrativas y llegas a consulta con un panorama más claro.
            </div>
          </div>
          
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
            <a
              href="/aviso-privacidad"
              className="text-blue-600 hover:text-blue-800 font-medium underline"
            >
              Aviso de Privacidad
            </a>
            <span className="text-gray-400">|</span>
            <a
              href="/terminos"
              className="text-blue-600 hover:text-blue-800 font-medium underline"
            >
              Términos de Uso
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Benefits;
