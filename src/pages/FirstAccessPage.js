import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from './LoginPage';

// ─── Primeiro acesso ──────────────────────────────────────────
// A troca de senha agora acontece dentro do próprio card de login.
// Esta rota fica para quem já está logado com firstAccess e
// recarregou a página: abre o card direto no estado "first".
export default function FirstAccessPage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (!user.firstAccess) return <Navigate to={user.isAdmin ? '/admin' : `/${user.sector}`} replace />;
  return <LoginPage forceFirst />;
}
