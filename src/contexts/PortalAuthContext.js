import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/*
 * Autenticação do CLIENTE do Portal de Coleta — isolada do mundo da
 * agência. O cliente loga com usuário + senha próprios, validados
 * contra a coleção `portal_clients`. Sessão guardada em sessionStorage
 * com chave dedicada (não compartilha nada com o login da equipe).
 *
 * Segurança (MVP): a senha é guardada com hash SHA-256 (Web Crypto).
 * Não é bcrypt, mas evita senha em texto puro. Para produção robusta,
 * o ideal futuro é validar server-side — registrado como melhoria.
 */

const PortalAuthContext = createContext(null);
const SESSION_KEY = 'portal_client_session';

// Hash SHA-256 da senha (hex).
export async function hashPassword(password) {
  const data = new TextEncoder().encode(String(password));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function PortalAuthProvider({ children }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) { try { setClient(JSON.parse(saved)); } catch {} }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const snap = await getDocs(query(
        collection(db, 'portal_clients'),
        where('username', '==', String(username).trim().toLowerCase()),
      ));
      if (snap.empty) return { success: false, error: 'Usuário ou senha inválidos.' };

      const docSnap = snap.docs[0];
      const data = docSnap.data();
      if (data.active === false) return { success: false, error: 'Acesso desativado. Fale com a agência.' };

      const hash = await hashPassword(password);
      if (hash !== data.passwordHash) return { success: false, error: 'Usuário ou senha inválidos.' };

      const session = {
        id: docSnap.id,
        username: data.username,
        clientName: data.clientName,
        productLimit: data.productLimit || 0,
        platform: data.platform,
        platformOther: data.platformOther || '',
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setClient(session);

      // registra último acesso (best-effort)
      try { await updateDoc(doc(db, 'portal_clients', docSnap.id), { lastLoginAt: new Date().toISOString() }); } catch {}

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Falha ao entrar. Tente novamente.' };
    }
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setClient(null);
  };

  return (
    <PortalAuthContext.Provider value={{ client, loading, login, logout }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export const usePortalAuth = () => useContext(PortalAuthContext);
