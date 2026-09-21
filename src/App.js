import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastContainer } from './components/shared/Toast';
import PatchNotesPopup from './components/shared/PatchNotesPopup';
import NotificationCenter from './components/shared/NotificationCenter';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import FirstAccessPage from './pages/FirstAccessPage';
import WebDesignDashboard from './pages/sectors/WebDesignDashboard';
import SocialMediaDashboard from './pages/sectors/SocialMediaDashboard';
import CreativeDashboard from './pages/sectors/CreativeDashboard';
import GenericSectorDashboard from './pages/sectors/GenericSectorDashboard';
import CSOperacionalDashboard from './pages/sectors/CSOperacionalDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import DocEditorPage from './pages/sectors/DocEditorPage';
import DocPrintPage from './pages/sectors/DocPrintPage';
import { PortalAuthProvider, usePortalAuth } from './contexts/PortalAuthContext';
import PortalLoginPage from './pages/PortalLoginPage';
import PortalDashboard from './pages/PortalDashboard';

// Painel de parede: carregado sob demanda para não pesar o bundle de
// quem só usa o dashboard normal.
const TVPanel = lazy(() => import('./pages/TVPanel'));
// TV da sala comercial (Hunters) — mesma lógica: pública, anônima, sob demanda.
const TVComercial = lazy(() => import('./pages/TVComercial'));

// Destino do usuário de CS. A CS virou um time só — quem ainda está
// cadastrado como 'comercial' cai no mesmo painel.
function csHome() {
  return '/cs-operacional';
}

// Rota base de qualquer usuário (usada em redirecionamentos).
function homeFor(user) {
  if (!user) return '/';
  if (user.isAdmin) return '/admin';
  if (user.sector === 'cs') return csHome();
  return `/${user.sector}`;
}

function ProtectedRoute({ children, requireSector, requireAdmin, requireCsRole, allowAdmin }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  if (!user) return <Navigate to="/" replace />;
  if (user.firstAccess) return <Navigate to="/first-access" replace />;

  // Admin sempre vai para /admin, exceto quando a rota já é a de admin
  // ou quando ela é compartilhada — o editor de documentos é usado
  // tanto pelo social media quanto pelo admin.
  if (user.isAdmin && allowAdmin) return children;

  if (user.isAdmin && !requireAdmin) return <Navigate to="/admin" replace />;

  if (requireAdmin && !user.isAdmin) return <Navigate to={homeFor(user)} replace />;

  // Rota da CS. Não olha mais o subpapel: todo colaborador de CS
  // usa o mesmo painel.
  if (requireCsRole) {
    if (user.sector !== 'cs') return <Navigate to={homeFor(user)} replace />;
    return children;
  }

  if (requireSector && user.sector !== requireSector && !user.isAdmin) {
    return <Navigate to={homeFor(user)} replace />;
  }

  return children;
}

// Redireciona /cs para o painel certo conforme a função do colaborador.
function CSRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (user.firstAccess) return <Navigate to="/first-access" replace />;
  if (user.isAdmin) return <Navigate to="/admin" replace />;
  if (user.sector !== 'cs') return <Navigate to={homeFor(user)} replace />;
  return <Navigate to={csHome()} replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      {user && !user.firstAccess && <PatchNotesPopup user={user} />}
      {/* Notificações de desktop — válidas em qualquer tela, por isso
          montadas aqui e não dentro de cada painel. */}
      {user && !user.firstAccess && <NotificationCenter />}
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
      {/* CS — um painel só. /cs-comercial fica como redirecionamento
          para quem tinha o endereço salvo. */}
      <Route path="/cs" element={<CSRedirect />} />
      <Route path="/cs-comercial" element={<CSRedirect />} />
      <Route path="/cs-operacional" element={
        <ProtectedRoute requireCsRole="operacional"><CSOperacionalDashboard /></ProtectedRoute>
      } />
      <Route path="/trafego" element={
        <ProtectedRoute requireSector="trafego"><GenericSectorDashboard sectorId="trafego" /></ProtectedRoute>
      } />

      {/* Lince Docs — editor e rota de impressão.
          Compartilhadas entre social media e admin, por isso allowAdmin. */}
      <Route path="/documentos/:docId" element={
        <ProtectedRoute requireSector="socialmedia" allowAdmin><DocEditorPage /></ProtectedRoute>
      } />
      <Route path="/documentos/:docId/imprimir" element={
        <ProtectedRoute requireSector="socialmedia" allowAdmin><DocPrintPage /></ProtectedRoute>
      } />

      {/* Admin */}
      <Route path="/admin" element={
        <ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>
      } />

      {/* Painel de parede da agência — rota pública, sem login.
          Autentica sozinho como anônimo e só mostra dado operacional. */}
      <Route path="/tv" element={
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#050508' }} />}>
          <TVPanel />
        </Suspense>
      } />

      {/* TV da sala comercial — pública e anônima como a /tv, mas mostra
          meta e vendas em R$ (fica na sala do comercial). O modo visita
          esconde todo valor. */}
      <Route path="/tv/comercial" element={
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#08090b' }} />}>
          <TVComercial />
        </Suspense>
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
    <ThemeProvider>
      <AuthProvider>
        <PortalAuthProvider>
          <BrowserRouter>
            <AppRoutes />
            <ToastContainer />
          </BrowserRouter>
        </PortalAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
