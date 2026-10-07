import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, MARCACAO_TIPOS } from '../lib/firebase';

// ─────────────────────────────────────────────────────────────
// Agenda manual do Videomaker — coleção `vm_marcacoes`.
//
// Captação, treinamento, reunião. Cada um vê as próprias marcações no
// calendário; a captação com cliente também aparece para a social
// media no detalhe do reel daquele cliente. Só equipe lê e escreve.
//
//   { tipo, data: 'AAAA-MM-DD', hora: 'HH:mm', clientId | null,
//     clientName, obs, autorName, createdAt }
// ─────────────────────────────────────────────────────────────

// `ativo: false` não abre o listener (ver usePlanejamentos).
export function useMarcacoes({ ativo = true } = {}) {
  const [marcacoes, setMarcacoes] = useState([]);
  const [loading, setLoading] = useState(ativo);

  useEffect(() => {
    if (!ativo) { setLoading(false); return undefined; }
    return onSnapshot(collection(db, 'vm_marcacoes'), (snap) => {
      setMarcacoes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, [ativo]);

  const criarMarcacao = async ({ tipo, data, hora, clientId, clientName, obs }, autorName) => {
    try {
      if (!MARCACAO_TIPOS[tipo]) return { success: false, error: 'Escolha o tipo.' };
      if (!data) return { success: false, error: 'Escolha o dia.' };
      await addDoc(collection(db, 'vm_marcacoes'), {
        tipo,
        data,
        hora: hora || '09:00',
        clientId: clientId || null,
        clientName: clientId ? (clientName || '') : '',
        obs: String(obs || '').trim(),
        autorName: autorName || null,
        createdAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const excluirMarcacao = async (id) => {
    try { await deleteDoc(doc(db, 'vm_marcacoes', id)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  return { marcacoes, loading, criarMarcacao, excluirMarcacao };
}
