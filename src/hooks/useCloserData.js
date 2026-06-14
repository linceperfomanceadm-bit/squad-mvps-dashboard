import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/*
 * Metas comerciais (definidas pelo admin).
 * Documento: commercial_config/goals = {
 *   teamGoal: number,
 *   individual: { [closerName]: number }
 * }
 * Mensais, sem valores em R$ — apenas contagem de vendas.
 */
export function useCommercialGoals() {
  const [goals, setGoals] = useState({ teamGoal: 0, individual: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, 'commercial_config', 'goals');
    return onSnapshot(ref, snap => {
      if (snap.exists()) setGoals({ teamGoal: 0, individual: {}, ...snap.data() });
      setLoading(false);
    });
  }, []);

  const saveGoals = async (next) => {
    try {
      await setDoc(doc(db, 'commercial_config', 'goals'), next, { merge: true });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  return { goals, loading, saveGoals };
}

/*
 * "Máquina de Objeções" — cada closer cria as suas.
 * Documento: closer_objections/{authUid} = { items: [{id,objection,response}] }
 */
export function useObjections(authUid) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUid) { setLoading(false); return; }
    const ref = doc(db, 'closer_objections', authUid);
    return onSnapshot(ref, snap => {
      setItems(snap.exists() ? (snap.data().items || []) : []);
      setLoading(false);
    });
  }, [authUid]);

  const save = async (next) => {
    try {
      await setDoc(doc(db, 'closer_objections', authUid), { items: next }, { merge: true });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const addItem = (objection, response) =>
    save([...items, { id: `o_${Date.now()}`, objection: objection.trim(), response: response.trim() }]);
  const updateItem = (id, patch) =>
    save(items.map(i => i.id === id ? { ...i, ...patch } : i));
  const removeItem = (id) =>
    save(items.filter(i => i.id !== id));

  return { items, loading, addItem, updateItem, removeItem };
}

// Conta vendas ganhas no mês corrente.
export function countWonThisMonth(deals, closerName = null) {
  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();
  return deals.filter(d => {
    if (d.outcome !== 'won') return false;
    if (closerName && d.closerName !== closerName) return false;
    const ts = d.wonAt || d.closedAt;
    if (!ts) return false;
    const dt = new Date(ts);
    return dt.getMonth() === m && dt.getFullYear() === y;
  }).length;
}
