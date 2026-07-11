import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  UserGroupIcon, 
  CalendarIcon, 
  DocumentTextIcon,
  FolderIcon,
  DocumentDuplicateIcon,
  UserCircleIcon,
  ChartBarIcon,
  QuestionMarkCircleIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { isSmartLabEnabled } from '../../config/featureFlags';
import { useSelectedDoctor } from '../../context/SelectedDoctorContext';
import ModuleDoctorSelector from '../assistant/ModuleDoctorSelector';

const Sidebar = ({ onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectDoctor, hasPermission } = useSelectedDoctor();
  const isLoggedIn = !!user && !!localStorage.getItem('token');

  // Si no está logueado, no mostrar el sidebar
  if (!isLoggedIn) return null;

  // Definir las rutas donde se debe mostrar el sidebar
  const showSidebarRoutes = [
    '/benefits',
    '/dashboard', // mantener para que el sidebar se muestre en todas las rutas bajo /dashboard
    '/calendario',
    '/prescriptions',
    '/medical-records',
    '/documents',
    '/billing',
    '/patients',
    '/profile'
  ];

  // Si la ruta actual no está en la lista, no mostrar el sidebar
  const matchesSidebarRoute = showSidebarRoutes.some(route => location.pathname.startsWith(route));
  if (!matchesSidebarRoute) return null;

  // Mapeo de módulos a permisos
  const modulePermissionMap = {
    '/dashboard': 'appointments',
    '/dashboard/patients': 'appointments',
    '/dashboard/calendario': 'appointments',
    '/dashboard/medical-records': 'clinicalHistory',
    '/dashboard/prescriptions': 'prescriptions',
    '/dashboard/documents': 'studies',
    '/dashboard/billing': 'billing',
    '/dashboard/profile': null, // Perfil siempre accesible
    '/dashboard/help': null // Ayuda siempre accesible
  };

  // Todos los menús disponibles
  const allMenuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: ChartBarIcon, module: 'appointments' },
    { name: 'Mis Pacientes', href: '/dashboard/patients', icon: UserGroupIcon, module: 'appointments' },
    { name: 'Calendario', href: '/dashboard/calendario', icon: CalendarIcon, module: 'appointments' },
    { name: 'Historial Clínico', href: '/dashboard/medical-records', icon: DocumentTextIcon, module: 'clinicalHistory' },
    { name: 'Recetas', href: '/dashboard/prescriptions', icon: DocumentTextIcon, module: 'prescriptions' },
    { name: 'Zona de estudio', href: '/dashboard/documents', icon: FolderIcon, module: 'studies' },
    { name: 'Relación de facturación', href: '/dashboard/billing', icon: DocumentDuplicateIcon, module: 'billing' },
    ...(isSmartLabEnabled()
      ? [{ name: 'Laboratorio Inteligente', href: '/dashboard/laboratorio-inteligente', icon: BeakerIcon, module: 'studies' }]
      : []),
    { name: 'Mi perfil', href: '/dashboard/profile', icon: UserCircleIcon, module: null },
    { name: 'Ayuda y tutoriales', href: '/dashboard/help', icon: QuestionMarkCircleIcon, module: null },
  ];

  // Doctor que también es paciente: enlace para ver su historial como paciente

  const adminLabCatalogItem = isSmartLabEnabled()
    ? {
        name: 'Catálogo de parámetros de laboratorio',
        href: '/dashboard/admin/lab-catalogo',
        icon: BeakerIcon,
        module: null,
      }
    : null;

  const doctorAsPatientLink = user?.role === 'DOCTOR' && user?.patientId
    ? { name: 'Mi historial como paciente', href: `/dashboard/medical-records?patientId=${user.patientId}`, icon: UserCircleIcon, module: 'clinicalHistory' }
    : null;

  // Filtrar navegación según el rol
  const navigation = user?.role === 'DOCTOR' 
    ? [...allMenuItems, ...(doctorAsPatientLink ? [doctorAsPatientLink] : [])]
    : user?.role === 'ADMIN'
    ? [...(adminLabCatalogItem ? [adminLabCatalogItem] : []), ...allMenuItems]
    : user?.role === 'ASISTENTE'
    ? allMenuItems // Los asistentes ven todos los menús
    : user?.role === 'PATIENT'
    ? [
        { name: 'Historial clínico', href: '/dashboard/medical-records', icon: DocumentTextIcon, module: null },
        { name: 'Zona de estudio', href: '/dashboard/documents', icon: FolderIcon, module: null },
        ...(isSmartLabEnabled() ? [{ name: 'Laboratorio Inteligente', href: '/dashboard/laboratorio-inteligente', icon: BeakerIcon, module: null }] : []),
        { name: 'Relación de facturación', href: '/dashboard/billing', icon: DocumentDuplicateIcon, module: null },
        { name: 'Mi perfil', href: '/dashboard/profile', icon: UserCircleIcon, module: null },
        { name: 'Ayuda y tutoriales', href: '/dashboard/help', icon: QuestionMarkCircleIcon, module: null },
      ]
    : [];

  const handleSelectDoctor = (doctor, module) => {
    selectDoctor(doctor);
    // Guardar el doctor seleccionado para este módulo específico
    localStorage.setItem(`selectedDoctorId_${module}`, doctor.doctorId);
  };

  const handleNavClick = (e, item) => {
    // Si es asistente y el módulo requiere permisos, verificar
    if (user?.role === 'ASISTENTE' && item.module) {
      if (!hasPermission(item.module)) {
        e.preventDefault();
        // Mostrar mensaje o redirigir
        return;
      }
    }
  };

  return (
    <div className="fixed left-0 top-16 h-[calc(100vh-4rem)] max-h-screen w-64 bg-white shadow-lg z-50 flex flex-col overflow-hidden">
      <nav className="mt-5 px-2 flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div className="space-y-1">
          {navigation.map((item) => {
            // Para Dashboard, solo activar si es exactamente /dashboard, no rutas hijas
            let isActive;
            if (item.href === '/dashboard') {
              isActive = location.pathname === '/dashboard' || location.pathname === '/dashboard/';
            } else {
              isActive = location.pathname.startsWith(item.href);
            }

            // Para asistentes, verificar si tienen permiso para este módulo
            const canAccess = user?.role === 'DOCTOR' || !item.module || hasPermission(item.module);
            const isAssistant = user?.role === 'ASISTENTE';

            return (
              <div key={item.name} className="mb-1">
                <NavLink
                  to={item.href}
                  onClick={(e) => { handleNavClick(e, item); onClose?.(); }}
                  className={`group flex flex-col px-2 py-2 text-base font-medium rounded-md ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : canAccess
                      ? 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      : 'text-gray-400 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="flex items-center">
                    <item.icon
                      className="mr-4 h-6 w-6 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="flex-1">{item.name}</span>
                  </div>
                  {/* Selector de profesional de la salud para asistentes */}
                  {isAssistant && item.module && canAccess && (
                    <ModuleDoctorSelector 
                      module={item.module} 
                      onSelectDoctor={handleSelectDoctor}
                    />
                  )}
                </NavLink>
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Sidebar; 