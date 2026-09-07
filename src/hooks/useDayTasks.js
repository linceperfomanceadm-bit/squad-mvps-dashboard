import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// ─── Tarefas do Dia ───────────────────────────────────────────
// Agenda pessoal de cada pessoa. Nada aqui é compartilhado: a query
// filtra por `ownerId` (o loginId de quem está logado), então duas
// pessoas nunca veem a lista uma da outra.
//
// Três tipos, como no "Meu Dia" antigo:
//   nota     → texto solto, sem check
//   card     → tarefa com check
//   lembrete → tarefa com horário; o horário é só exibição, o
//              disparo de notificação fica a cargo do navegador
//
// Coleção: dayTasks/{id}
//   { ownerId, type, text, done, at, doneAt, createdAt }
// `at` é 'YYYY-MM-DD' (+ 'HH:mm' no lembrete) — string, não Timestamp,
// para o filtro do dia ser comparação direta, sem fuso no meio.

export const DAY_TYPES = {
  nota:     { id: 'nota',     label: 'Anotação', color: 'var(--blue)' },
  card:     { id: 'card',     label: 'Tarefa',   color: 'var(--c)' },
  lembrete: { id: 'lembrete', label: 'Lembrete', color: 'var(--amber)' },
};

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function useDayTasks(ownerId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) { setItems([]); setLoading(false); return; }
    const q = query(collection(db, 'dayTasks'), where('ownerId', '==', ownerId));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ordena no cliente: sem índice composto no Firestore para manter.
      list.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')) || String(a.time || '').localeCompare(String(b.time || '')));
      setItems(list);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [ownerId]);

  const addItem = async ({ type, text, at, time }) => {
    if (!ownerId) return { success: false, error: 'Sessão expirada.' };
    if (!String(text || '').trim()) return { success: false, error: 'Escreva alguma coisa.' };
    try {
      await addDoc(collection(db, 'dayTasks'), {
        ownerId,
        type: DAY_TYPES[type] ? type : 'card',
        text: String(text).trim(),
        at: at || todayKey(),
        time: time || '',
        done: false,
        doneAt: null,
        createdAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const toggleItem = async (id, done) => {
    try {
      await updateDoc(doc(db, 'dayTasks', id), { done: !done, doneAt: !done ? new Date().toISOString() : null });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const updateItem = async (id, patch) => {
    try {
      await updateDoc(doc(db, 'dayTasks', id), patch);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const removeItem = async (id) => {
    try {
      await deleteDoc(doc(db, 'dayTasks', id));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Cai para hoje o que ficou aberto em dias anteriores — o "arrastar
  // para hoje" que a pessoa faria na mão toda manhã.
  const pullOverdue = async () => {
    const hoje = todayKey();
    const atrasados = items.filter(i => !i.done && i.at && i.at < hoje);
    await Promise.all(atrasados.map(i => updateDoc(doc(db, 'dayTasks', i.id), { at: hoje })));
    return atrasados.length;
  };

  return { items, loading, addItem, toggleItem, updateItem, removeItem, pullOverdue };
}
