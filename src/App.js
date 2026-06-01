import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastContainer } from './components/shared/Toast';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import FirstAccessPage from './pages/FirstAccessPage';
import WebDesignDashboard from './pages/sectors/WebDesignDashboard';
import SocialMediaDashboard from './pages/sectors/SocialMediaDashboard';
import CreativeDashboard from './pages/sectors/CreativeDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

function ProtectedRoute({ children, requireSector, requireAdmin }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#07070e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  if (user.firstAccess) return <Navigate to="/first-access" replace />;
  if (requireAdmin && !user.isAdmin) return <Navigate to={`/${user.sector}`} replace />;
  if (requireSector && user.sector !== requireSector && !user.isAdmin) return <Navigate to={`/${user.sector}`} replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login/:sectorId" element={<LoginPage />} />
      <Route path="/first-access" element={<FirstAccessPage />} />
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
      <Route path="/admin" element={
        <ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer />
      </BrowserRouter>
    </AuthProvider>
  );
}
