import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './utils/axiosConfig'; // Importar interceptor de axios
import { SubscriptionProvider } from './context/SubscriptionContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SelectedDoctorProvider } from './context/SelectedDoctorContext';
import SubscriptionBanner from './components/SubscriptionBanner';
import MainLayout from './components/layout/MainLayout';
import PrivateRoute from './components/ProtectedRoute';
import PublicLayout from './components/layout/PublicLayout';
import Loader from './components/common/Loader';
import PWAInstallPrompt from './components/common/PWAInstallPrompt';

// Páginas
import Login from './pages/auth/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Benefits from './pages/Benefits';
import AvisoPrivacidad from './pages/AvisoPrivacidad';
import TerminosDeUso from './pages/TerminosDeUso';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import MedicalRecords from './pages/MedicalRecords';
import Patients from './pages/Patients';
import Documents from './pages/Documents';
import Billing from './pages/Billing';
import Calendar from './pages/Calendar';
import Prescriptions from './pages/Prescriptions';
import AgendarCita from './pages/AgendarCita';
import ActivateInvitation from './pages/ActivateInvitation';
import ActivateAssistantInvitation from './pages/ActivateAssistantInvitation';
import ConfirmAppointment from './pages/ConfirmAppointment';
import ResumeSubscriptionPayment from './pages/ResumeSubscriptionPayment';
import PreConsultation from './pages/PreConsultation';
import NewConsultationPage from './pages/NewConsultationPage';
import LaboratorioInteligente from './pages/smartLab/LaboratorioInteligente';
import LabUploadPage from './pages/smartLab/LabUploadPage';
import LabReportReview from './pages/smartLab/LabReportReview';
import LabReportDetail from './pages/smartLab/LabReportDetail';
import LabPatientDashboardPage from './pages/smartLab/LabPatientDashboardPage';
import LabCompareStudies from './pages/smartLab/LabCompareStudies';
import LabAnalyteHistory from './pages/smartLab/LabAnalyteHistory';
import LabCatalogAdmin from './pages/admin/LabCatalogAdmin';
import { isSmartLabEnabled } from './config/featureFlags';


// Pacientes no deben acceder a "Mis Pacientes" (solo doctores/asistentes)
const PatientsRoute = () => {
  const { user } = useAuth();
  if (user?.role === 'PATIENT') {
    return <Navigate to="/dashboard/medical-records" replace />;
  }
  return <Patients />;
};

const PlaceholderPage = ({ title }) => (
  <div className="w-full bg-white p-8 rounded-lg shadow-md">
    <h2 className="text-2xl font-semibold text-gray-900 mb-4">{title}</h2>
    <p>Esta sección está en desarrollo.</p>
  </div>
);

// Evita que un usuario autenticado acceda a rutas públicas como /login
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) {
    return <Loader />;
  }
  if (!isAuthenticated) return children;
  // Redirigir según rol (pacientes no deben ir a /dashboard/patients)
  const defaultPath = user?.role === 'PATIENT' ? '/dashboard/medical-records' : '/dashboard/dashboard';
  return <Navigate to={defaultPath} replace />;
};

const AppRoutes = () => (
    <>
      <SubscriptionBanner />
      <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* Rutas Públicas con Layout Público */}
      <Route 
        path="/login" 
        element={<PublicRoute><PublicLayout><Login /></PublicLayout></PublicRoute>} 
      />
      <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
      <Route path="/forgot-password" element={<PublicLayout><ForgotPassword /></PublicLayout>} />
      <Route path="/reset-password" element={<PublicLayout><ResetPassword /></PublicLayout>} />
      <Route path="/activate/:token" element={<ActivateInvitation />} />
      <Route path="/activate-assistant/:token" element={<ActivateAssistantInvitation />} />
      <Route path="/confirm-appointment/:token" element={<ConfirmAppointment />} />
      <Route path="/pre-consulta/:token" element={<PreConsultation />} />
      <Route path="/benefits" element={<PublicLayout><Benefits /></PublicLayout>} />
      <Route path="/aviso-privacidad" element={<PublicLayout><AvisoPrivacidad /></PublicLayout>} />
      <Route path="/terminos" element={<PublicLayout><TerminosDeUso /></PublicLayout>} />
      <Route path="/agendar/:doctorUsername" element={<AgendarCita />} />

      {/* Rutas Privadas con Layout Principal */}
      <Route 
        path="/dashboard/*"
        element={
          <PrivateRoute>
            <MainLayout>
              <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="profile" element={<Profile />} />
                <Route path="patients" element={<PatientsRoute />} />
                <Route path="calendario" element={<Calendar />} />
                <Route path="medical-records" element={<MedicalRecords />} />
                <Route path="medical-records/:patientId" element={<MedicalRecords />} />
                <Route path="nueva-consulta" element={<NewConsultationPage />} />
                <Route path="prescriptions" element={<Prescriptions />} />
                <Route path="documents" element={<Documents />} />
                <Route path="billing" element={<Billing />} />
                <Route path="help" element={<Benefits />} />
                <Route path="resume-subscription" element={<ResumeSubscriptionPayment />} />
                {isSmartLabEnabled() && (
                  <>
                    <Route path="laboratorio-inteligente" element={<LaboratorioInteligente />} />
                    <Route path="laboratorio-inteligente/subir" element={<LabUploadPage />} />
                    <Route path="laboratorio-inteligente/reportes/:id/revision" element={<LabReportReview />} />
                    <Route path="laboratorio-inteligente/reportes/:id" element={<LabReportDetail />} />
                    <Route path="laboratorio-inteligente/paciente/:patientId/dashboard" element={<LabPatientDashboardPage />} />
                    <Route path="laboratorio-inteligente/paciente/:patientId/comparar" element={<LabCompareStudies />} />
                    <Route path="laboratorio-inteligente/analitos/:analyteId/historial" element={<LabAnalyteHistory />} />
                    <Route path="admin/lab-catalogo" element={<LabCatalogAdmin />} />
                  </>
                )}
                <Route index element={<Navigate to="/dashboard/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard/dashboard" replace />} />
              </Routes>
            </MainLayout>
          </PrivateRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    <ToastContainer position="top-right" autoClose={5000} />
    <PWAInstallPrompt />
  </>
);

const App = () => (
  <AuthProvider>
    <SelectedDoctorProvider>
      <SubscriptionProvider>
        <AppRoutes />
      </SubscriptionProvider>
    </SelectedDoctorProvider>
  </AuthProvider>
);

export default App;
