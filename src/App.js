import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastContainer } from './components/shared/Toast';
import PatchNotesPopup from './components/shared/PatchNotesPopup';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import FirstAccessPage from './pages/FirstAccessPage';
import WebDesignDashboard from './pages/sectors/WebDesignDashboard';
import SocialMediaDashboard from './pages/sectors/SocialMediaDashboard';
import CreativeDashboard from './pages/sectors/CreativeDashboard';
import GenericSectorDashboard from './pages/sectors/GenericSectorDashboard';
import SDRDashboard from './pages/sectors/SDRDashboard';
import CloserDashboard from './pages/sectors/CloserDashboard';
import CSDashboard from './pages/sectors/CSDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import { PortalAuthProvider, usePortalAuth } from './contexts/PortalAuthContext';
import PortalLoginPage from './pages/PortalLoginPage';
import PortalDashboard from './pages/PortalDashboard';

// Destino do usuário comercial conforme o subpapel.
function commercialHome(user) {
  if (user?.commercialRole === 'sdr') return '/sdr';
  if (user?.commercialRole === 'closer') return '/closer';
  return '/comercial'; // sem subpapel definido — cai no genérico
}

// Rota base de qualquer usuário (usada em redirecionamentos).
function homeFor(user) {
  if (!user) return '/';
  if (user.isAdmin) return '/admin';
  if (user.sector === 'comercial') return commercialHome(user);
  return `/${user.sector}`;
}

function ProtectedRoute({ children, requireSector, requireAdmin, requireCommercialRole }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#07070e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  if (!user) return <Navigate to="/" replace />;
  if (user.firstAccess) return <Navigate to="/first-access" replace />;

  // Admin sempre vai para /admin, exceto quando a rota já é a de admin.
  if (user.isAdmin && !requireAdmin) return <Navigate to="/admin" replace />;

  if (requireAdmin && !user.isAdmin) return <Navigate to={homeFor(user)} replace />;

  // Rota que exige um subpapel comercial específico (sdr/closer).
  if (requireCommercialRole) {
    if (user.sector !== 'comercial') return <Navigate to={homeFor(user)} replace />;
    if (user.commercialRole !== requireCommercialRole) return <Navigate to={homeFor(user)} replace />;
    return children;
  }

  if (requireSector && user.sector !== requireSector && !user.isAdmin) {
    return <Navigate to={homeFor(user)} replace />;
  }

  return children;
}

// Redireciona /comercial para o painel certo conforme o subpapel.
function CommercialRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (user.firstAccess) return <Navigate to="/first-access" replace />;
  if (user.isAdmin) return <Navigate to="/admin" replace />;
  if (user.sector !== 'comercial') return <Navigate to={homeFor(user)} replace />;
  // Comercial com subpapel definido vai para o painel específico;
  // sem subpapel, mostra o dashboard genérico (fallback seguro).
  if (user.commercialRole === 'sdr') return <Navigate to="/sdr" replace />;
  if (user.commercialRole === 'closer') return <Navigate to="/closer" replace />;
  return <GenericSectorDashboard sectorId="comercial" />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      {user && !user.firstAccess && <PatchNotesPopup user={user} />}
      <Routes>
        <Route path="/" element={<HomePage />} />
      <Route path="/login/:sectorId" element={<LoginPage />} />
      <Route path="/first-access" element={<FirstAccessPage />} />

      {/* Sector dashboards */}
      <Route path="/webdesign" element={
        <ProtectedRoute requireSector="webdesign"><WebDesignDashboard /></ProtectedRoute>
      } />
      <Route path="/socialmedia" element={
        <ProtectedRoute requireSector="socialmedia"><SocialMediaDashboard /></ProtectedRoute>
      } />
      <Route path="/design" element={
        <ProtectedRoute requireSector="design"><CreativeDashboard sectorId="design" /></ProtectedRoute>
      } />
      <Route path="/videomaker" element={
        <ProtectedRoute requireSector="videomaker"><CreativeDashboard sectorId="videomaker" /></ProtectedRoute>
      } />
      <Route path="/cs" element={
        <ProtectedRoute requireSector="cs"><CSDashboard /></ProtectedRoute>
      } />
      <Route path="/trafego" element={
        <ProtectedRoute requireSector="trafego"><GenericSectorDashboard sectorId="trafego" /></ProtectedRoute>
      } />

      {/* Comercial — redireciona para SDR ou Closer conforme subpapel */}
      <Route path="/comercial" element={<CommercialRedirect />} />
      <Route path="/sdr" element={
        <ProtectedRoute requireCommercialRole="sdr"><SDRDashboard /></ProtectedRoute>
      } />
      <Route path="/closer" element={
        <ProtectedRoute requireCommercialRole="closer"><CloserDashboard /></ProtectedRoute>
      } />

      {/* Admin */}
      <Route path="/admin" element={
        <ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>
      } />

      {/* Portal de Coleta (clientes externos — auth próprio) */}
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/portal" element={
        <PortalProtectedRoute><PortalDashboard /></PortalProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

// Proteção das rotas do cliente do portal (isolada da agência).
function PortalProtectedRoute({ children }) {
  const { client, loading } = usePortalAuth();
  if (loading) return null;
  if (!client) return <Navigate to="/portal/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <PortalAuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <ToastContainer />
        </BrowserRouter>
      </PortalAuthProvider>
    </AuthProvider>
  );
}
