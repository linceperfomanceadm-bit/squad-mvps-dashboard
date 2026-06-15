import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/*
 * To-Do pessoal ("Meu Dia"), estilo Trello. Coleção `personal_tasks`,
 * isolada por userId = authUid. NÃO entra em dashboards gerenciais nem
 * afeta KPIs — coleção totalmente separada.
 *
 * Campos:
 *   userId, title, note (texto livre), dueDate (ISO|null),
 *   checklist: [{ id, text, done }],
 *   status: 'open' | 'done', createdAt, completedAt
 */
export function usePersonalTasks(userId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const q = query(collection(db, 'personal_tasks'), where('userId', '==', userId));
    return onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, [userId]);

  const addTask = async ({ title, note = '', dueDate = null, checklist = [] }) => {
    if (!title?.trim() || !userId) return { success: false };
    try {
      await addDoc(collection(db, 'personal_tasks'), {
        userId, title: title.trim(), note: note.trim(),
        dueDate: dueDate || null, checklist,
        status: 'open', createdAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const updateTask = async (id, patch) => {
    try { await updateDoc(doc(db, 'personal_tasks', id), patch); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const completeTask = async (id) => {
    try { await updateDoc(doc(db, 'personal_tasks', id), { status: 'done', completedAt: new Date().toISOString() }); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const removeTask = async (id) => {
    try { await deleteDoc(doc(db, 'personal_tasks', id)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  return { tasks, loading, addTask, updateTask, completeTask, removeTask };
}
