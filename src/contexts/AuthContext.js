import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const AuthContext = createContext(null);
const SESSION_KEY = 'agency_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
    setLoading(false);
  }, []);

  // Login for collaborators (by sector)
  const loginCollaborator = async (sectorId, loginId, password) => {
    try {
      const q = query(
        collection(db, 'collaborators'),
        where('loginId', '==', loginId),
        where('sector', '==', sectorId),
        where('active', '==', true)
      );
      const snap = await getDocs(q);
      if (snap.empty) return { success: false, error: 'ID ou setor incorreto.' };

      const docData = snap.docs[0];
      const collab = { id: docData.id, ...docData.data() };

      if (collab.password !== password) return { success: false, error: 'Senha incorreta.' };

      const sessionUser = {
        id: collab.id,
        name: collab.name,
        loginId: collab.loginId,
        sector: collab.sector,
        role: collab.isAdmin ? 'admin' : 'collaborator',
        isAdmin: collab.isAdmin || false,
        firstAccess: collab.firstAccess || false,
      };

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      setUser(sessionUser);
      return { success: true, firstAccess: collab.firstAccess };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Admin login (separate)
  const loginAdmin = async (loginId, password) => {
    const ADMIN_ID = process.env.REACT_APP_ADMIN_ID || 'admin';
    const ADMIN_PASS = process.env.REACT_APP_ADMIN_PASSWORD || 'Dash@2026';

    // Check env-based admin first
    if (loginId === ADMIN_ID && password === ADMIN_PASS) {
      const sessionUser = { id: 'admin', name: 'Admin', loginId, sector: null, role: 'superadmin', isAdmin: true };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      setUser(sessionUser);
      return { success: true };
    }

    // Check Firestore admins
    try {
      const q = query(collection(db, 'collaborators'), where('loginId', '==', loginId), where('isAdmin', '==', true));
      const snap = await getDocs(q);
      if (snap.empty) return { success: false, error: 'Credenciais inválidas.' };
      const docData = snap.docs[0];
      const collab = { id: docData.id, ...docData.data() };
      if (collab.password !== password) return { success: false, error: 'Senha incorreta.' };
      const sessionUser = { id: collab.id, name: collab.name, loginId: collab.loginId, sector: collab.sector, role: 'admin', isAdmin: true, firstAccess: collab.firstAccess || false };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      setUser(sessionUser);
      return { success: true, firstAccess: collab.firstAccess };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Change password on first access
  const changePassword = async (newPassword) => {
    if (!user) return { success: false };
    try {
      await updateDoc(doc(db, 'collaborators', user.id), { password: newPassword, firstAccess: false });
      const updated = { ...user, firstAccess: false };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      setUser(updated);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginCollaborator, loginAdmin, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
