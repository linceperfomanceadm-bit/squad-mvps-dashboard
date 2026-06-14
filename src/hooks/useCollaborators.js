import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, loginIdToEmail } from '../lib/firebase';

/*
 * Criar um usuário com createUserWithEmailAndPassword loga
 * automaticamente como o novo usuário na instância padrão — o que
 * derrubaria o admin que está cadastrando. Para evitar isso,
 * criamos a conta numa instância SECUNDÁRIA e descartável do app,
 * deixando a sessão do admin intacta.
 */
async function createAuthUserIsolated(email, password) {
  const secondary = initializeApp(
    {
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
      storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.REACT_APP_FIREBASE_APP_ID,
    },
    `secondary-${Date.now()}`
  );
  const secondaryAuth = getAuth(secondary);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondary);
  }
}

export function useCollaborators(sectorFilter = null) {
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'collaborators'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (sectorFilter) data = data.filter(c => c.sector === sectorFilter);
      setCollaborators(data);
      setLoading(false);
    });
  }, [sectorFilter]);

  const addCollaborator = async (data) => {
    const { password, loginId, ...rest } = data;
    if (!password || password.length < 6) {
      return { success: false, error: 'A senha provisória deve ter pelo menos 6 caracteres.' };
    }
    try {
      // 1. Cria a conta no Auth (sem derrubar a sessão do admin).
      const uid = await createAuthUserIsolated(loginIdToEmail(loginId), password);
      // 2. Cria o doc de perfil — sem senha em texto puro.
      await addDoc(collection(db, 'collaborators'), {
        ...rest,
        loginId: loginId.trim(),
        authUid: uid,
        authMigrated: true,
        active: true,
        firstAccess: true,
        createdAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') return { success: false, error: 'Este ID já está em uso.' };
      if (err.code === 'auth/weak-password') return { success: false, error: 'Senha muito fraca (mín. 6 caracteres).' };
      return { success: false, error: err.message || 'Falha ao cadastrar.' };
    }
  };

  const updateCollaborator = async (id, data) => {
    try { await updateDoc(doc(db, 'collaborators', id), data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const deleteCollaborator = async (id) => {
    // NOTA: isto remove apenas o doc de perfil. A conta no Firebase Auth
    // não pode ser apagada pelo cliente (exige Admin SDK). O acesso fica
    // bloqueado porque sem doc não há perfil; para apagar a conta do Auth
    // de fato, remova-a no console do Firebase ou via script (Bloco extra).
    try { await deleteDoc(doc(db, 'collaborators', id)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  return { collaborators, loading, addCollaborator, updateCollaborator, deleteCollaborator };
}
