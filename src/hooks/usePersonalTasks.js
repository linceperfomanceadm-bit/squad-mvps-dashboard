import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/*
 * To-Do pessoal ("Meu Dia"). Coleção `personal_tasks`, isolada por
 * userId = authUid. Estes dados NÃO entram em nenhum dashboard
 * gerencial nem afetam KPIs do Kanban — coleção totalmente separada.
 *
 * Campos: { userId, title, dueDate (ISO|null), status: 'open'|'done', createdAt }
 */
export function usePersonalTasks(userId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    // Sem orderBy para evitar exigência de índice composto;
    // ordenamos no cliente.
    const q = query(collection(db, 'personal_tasks'), where('userId', '==', userId));
    return onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, [userId]);

  const addTask = async (title, dueDate = null) => {
    if (!title.trim() || !userId) return { success: false };
    try {
      await addDoc(collection(db, 'personal_tasks'), {
        userId, title: title.trim(), dueDate: dueDate || null,
        status: 'open', createdAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const completeTask = async (id) => {
    try { await updateDoc(doc(db, 'personal_tasks', id), { status: 'done', completedAt: new Date().toISOString() }); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const removeTask = async (id) => {
    try { await deleteDoc(doc(db, 'personal_tasks', id)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  return { tasks, loading, addTask, completeTask, removeTask };
}
