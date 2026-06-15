import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  collection, query, where, getDocs, updateDoc, doc, setDoc,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { db, auth, loginIdToEmail } from '../lib/firebase';

const AuthContext = createContext(null);

/*
 * ─── Modelo de autenticação ──────────────────────────────────
 * Login por loginId + senha, convertido para email sintético
 * (loginId@squadmvps.interno) no Firebase Auth.
 *
 * MIGRAÇÃO LAZY: colaboradores criados antes desta versão não
 * existem no Auth. No primeiro login pós-migração:
 *   1. Tenta signInWithEmailAndPassword.
 *   2. Se falhar com user-not-found, valida a senha contra o
 *      Firestore (senha antiga em texto puro) e, se bater, cria
 *      a conta no Auth com essa mesma senha (createUser...).
 *   3. Marca authMigrated:true no doc e limpa o campo password
 *      antigo (a senha agora vive só no Auth, com hash do Google).
 *
 * O perfil (sector, isAdmin, name...) continua no doc Firestore,
 * vinculado pelo authUid. O doc do Auth NÃO guarda senha.
 */

const ADMIN_ID = (process.env.REACT_APP_ADMIN_ID || 'admin').toLowerCase();
const ADMIN_PASS = process.env.REACT_APP_ADMIN_PASSWORD || 'Dash@2026';

// Garante que uma operação do Firestore nunca pendure a cadeia de login.
// Se passar do tempo, rejeita para o chamador tratar (em vez de travar).
function withTimeout(promise, ms = 6000, label = 'firestore') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout:${label}`)), ms)),
  ]);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Reidrata o perfil a partir do usuário autenticado no Auth.
  useEffect(() => {
    let settled = false;
    // Rede de segurança: se algo no Firestore pendurar, não deixa o
    // app preso no spinner para sempre.
    const safety = setTimeout(() => { if (!settled) setLoading(false); }, 8000);

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) { settled = true; clearTimeout(safety); setUser(null); setLoading(false); return; }
      try {
        const profile = await loadProfileByUid(fbUser.uid, fbUser.email);
        setUser(profile);
      } catch {
        setUser(null);
      } finally {
        settled = true;
        clearTimeout(safety);
        setLoading(false);
      }
    });
    return () => { clearTimeout(safety); unsub(); };
  }, []);

  // Busca o doc do colaborador vinculado a este authUid.
  // Fallback: por loginId derivado do email (contas recém-migradas
  // num tick em que authUid ainda não foi gravado).
  const loadProfileByUid = async (uid, email) => {
    const loginIdFromEmail = email ? email.split('@')[0] : null;

    let snap;
    try {
      snap = await withTimeout(getDocs(query(collection(db, 'collaborators'), where('authUid', '==', uid))), 6000, 'q-authUid');
    } catch {
      snap = { empty: true, docs: [] };
    }
    if (snap.empty && loginIdFromEmail) {
      try {
        snap = await withTimeout(getDocs(query(collection(db, 'collaborators'), where('loginId', '==', loginIdFromEmail))), 6000, 'q-loginId');
      } catch {
        snap = { empty: true, docs: [] };
      }
    }

    if (snap.empty) {
      // Conta admin master sem doc no Firestore.
      if (loginIdFromEmail === ADMIN_ID) {
        try { await withTimeout(setDoc(doc(db, 'userIndex', uid), { collabId: null, isAdmin: true, sector: null }, { merge: true }), 5000, 'idx-admin'); } catch {}
        return { id: uid, authUid: uid, name: 'Admin', loginId: ADMIN_ID, sector: null, role: 'superadmin', isAdmin: true, firstAccess: false };
      }
      throw new Error('Perfil não encontrado.');
    }

    const d = snap.docs[0];
    const c = { id: d.id, ...d.data() };
    // Vínculo authUid e índice são "best-effort": não podem travar o
    // login. Rodam com timeout e qualquer falha é ignorada.
    if (c.authUid !== uid) {
      try { await withTimeout(updateDoc(doc(db, 'collaborators', d.id), { authUid: uid }), 5000, 'upd-uid'); } catch {}
    }
    try {
      await withTimeout(setDoc(doc(db, 'userIndex', uid), {
        collabId: d.id,
        isAdmin: c.isAdmin || false,
        sector: c.sector || null,
      }, { merge: true }), 5000, 'idx');
    } catch {}

    return {
      id: d.id,
      authUid: uid,
      name: c.name,
      loginId: c.loginId,
      sector: c.sector,
      commercialRole: c.commercialRole || null,
      role: c.isAdmin ? 'admin' : 'collaborator',
      isAdmin: c.isAdmin || false,
      firstAccess: c.firstAccess || false,
    };
  };

  // ── Login unificado (setor é validado após autenticar) ───────
  const loginCollaborator = async (sectorId, loginId, password) => {
    const email = loginIdToEmail(loginId);
    try {
      // 1. Caminho normal: já existe no Auth.
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      // 2. Migração lazy: conta ainda não existe no Auth.
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        const migrated = await tryLazyMigration(loginId, password);
        if (!migrated.success) return migrated;
        // após migrar, o onAuthStateChanged já autenticou.
      } else if (err.code === 'auth/wrong-password') {
        return { success: false, error: 'Senha incorreta.' };
      } else if (err.code === 'auth/too-many-requests') {
        return { success: false, error: 'Muitas tentativas. Aguarde alguns minutos.' };
      } else {
        return { success: false, error: 'Falha no login. Tente novamente.' };
      }
    }

    // Validação de setor (apenas UX — a trava real são as regras do
    // Firestore). Best-effort: se falhar/expirar, deixa o login seguir
    // (o onAuthStateChanged carrega o perfil). Nunca trava aqui.
    try {
      const fbUser = auth.currentUser;
      if (fbUser) {
        const profile = await withTimeout(loadProfileByUid(fbUser.uid, fbUser.email), 6000, 'login-profile');
        if (!profile.isAdmin && sectorId && profile.sector !== sectorId) {
          await signOut(auth);
          return { success: false, error: 'ID não pertence a este setor.' };
        }
        setUser(profile);
        return { success: true, firstAccess: profile.firstAccess };
      }
    } catch {
      // Não bloqueia: o listener global resolve o perfil e o loading.
    }
    return { success: true };
  };

  // Cria a conta no Auth a partir das credenciais antigas do Firestore.
  const tryLazyMigration = async (loginId, password) => {
    const email = loginIdToEmail(loginId);

    // Admin master por env var — cria conta real no Auth no 1º uso.
    if (loginId.trim().toLowerCase() === ADMIN_ID && password === ADMIN_PASS) {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        return { success: true };
      } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
          try { await signInWithEmailAndPassword(auth, email, password); return { success: true }; }
          catch { return { success: false, error: 'Senha do admin incorreta.' }; }
        }
        return { success: false, error: 'Falha ao inicializar admin.' };
      }
    }

    // Colaborador comum: valida contra o doc do Firestore.
    const snap = await getDocs(query(
      collection(db, 'collaborators'),
      where('loginId', '==', loginId.trim()),
    ));
    if (snap.empty) return { success: false, error: 'ID não encontrado.' };

    const d = snap.docs[0];
    const c = d.data();
    if (c.active === false) return { success: false, error: 'Conta desativada.' };
    if (c.password == null) {
      // Já migrado mas senha não bateu no signIn acima.
      return { success: false, error: 'Senha incorreta.' };
    }
    if (c.password !== password) return { success: false, error: 'Senha incorreta.' };

    // Credenciais antigas conferem → cria no Auth.
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateDoc(doc(db, 'collaborators', d.id), {
        authUid: cred.user.uid,
        authMigrated: true,
        password: null, // remove a senha em texto puro do Firestore
      });
      return { success: true };
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        // Conta já existe no Auth mas a senha digitada não corresponde.
        return { success: false, error: 'Senha incorreta.' };
      }
      if (e.code === 'auth/weak-password') {
        return { success: false, error: 'Sua senha antiga é curta demais para o novo sistema (mín. 6). Peça um reset ao admin.' };
      }
      return { success: false, error: 'Falha na migração da conta.' };
    }
  };

  // Admin login usa o mesmo fluxo; setor não é exigido.
  const loginAdmin = (loginId, password) => loginCollaborator(null, loginId, password);

  // ── Troca de senha no 1º acesso ──────────────────────────────
  const changePassword = async (newPassword) => {
    const fbUser = auth.currentUser;
    if (!fbUser) return { success: false, error: 'Sessão expirada. Entre novamente.' };
    try {
      await updatePassword(fbUser, newPassword);
      // Atualiza firstAccess no doc de perfil (se houver — admin
      // master não tem doc).
      if (user?.id && user.id !== fbUser.uid) {
        try { await updateDoc(doc(db, 'collaborators', user.id), { firstAccess: false }); } catch {}
      }
      const updated = { ...user, firstAccess: false };
      setUser(updated);
      return { success: true };
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        return { success: false, error: 'Por segurança, entre novamente antes de trocar a senha.' };
      }
      return { success: false, error: 'Falha ao definir senha.' };
    }
  };

  const logout = async () => {
    try { await signOut(auth); } catch {}
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginCollaborator, loginAdmin, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
