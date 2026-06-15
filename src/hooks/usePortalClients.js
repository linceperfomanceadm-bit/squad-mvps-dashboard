import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { hashPassword } from '../contexts/PortalAuthContext';

/*
 * Gestão dos acessos de cliente ao Portal de Coleta (lado da agência:
 * admin e WebDesign). Coleção `portal_clients`.
 *
 * Campos: clientName, username, passwordHash, productLimit, platform,
 *   platformOther, crmClientId (vínculo opcional ao CRM), status,
 *   active, createdBy, createdAt, lastLoginAt.
 */
export function usePortalClients() {
  const [portalClients, setPortalClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'portal_clients'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setPortalClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const createPortalClient = async ({
    clientName, username, password, productLimit, platform, platformOther = '', crmClientId = null, createdBy,
  }) => {
    try {
      const uname = String(username).trim().toLowerCase();
      if (!clientName?.trim()) return { success: false, error: 'Informe o nome do cliente.' };
      if (!uname) return { success: false, error: 'Informe o usuário de acesso.' };
      if (!password || password.length < 4) return { success: false, error: 'A senha deve ter ao menos 4 caracteres.' };
      if (!Number(productLimit) || Number(productLimit) < 1) return { success: false, error: 'Defina a quantidade de produtos.' };
      if (!platform) return { success: false, error: 'Selecione a plataforma.' };
      if (platform === 'outro' && !platformOther.trim()) return { success: false, error: 'Especifique a plataforma.' };

      // username único
      const exists = portalClients.some(c => c.username === uname);
      if (exists) return { success: false, error: 'Esse usuário já existe. Escolha outro.' };

      const passwordHash = await hashPassword(password);
      await addDoc(collection(db, 'portal_clients'), {
        clientName: clientName.trim(),
        username: uname,
        passwordHash,
        productLimit: Number(productLimit),
        platform,
        platformOther: platform === 'outro' ? platformOther.trim() : '',
        crmClientId: crmClientId || null,
        status: 'collecting',
        active: true,
        createdBy: createdBy || null,
        createdAt: serverTimestamp(),
        lastLoginAt: null,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const updatePortalClient = async (id, patch) => {
    try {
      // se trocar senha, re-hash
      if (patch.password) {
        patch.passwordHash = await hashPassword(patch.password);
        delete patch.password;
      }
      if (patch.username) patch.username = String(patch.username).trim().toLowerCase();
      await updateDoc(doc(db, 'portal_clients', id), patch);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const deletePortalClient = async (id) => {
    try { await deleteDoc(doc(db, 'portal_clients', id)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  return { portalClients, loading, createPortalClient, updatePortalClient, deletePortalClient };
}
