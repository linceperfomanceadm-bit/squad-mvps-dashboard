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

// Soma o VALOR das vendas fechadas no mês corrente.
// Para um closer específico, considera o split: se ele foi 2º closer
// ou dividiu com outro, conta apenas a parte dele (saleValuePerCloser).
export function sumSalesThisMonth(deals, closerName = null) {
  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();
  let total = 0;
  for (const d of deals) {
    if (d.outcome !== 'venda_fechada') continue;
    const ts = d.wonAt || d.closedAt;
    if (!ts) continue;
    const dt = new Date(ts);
    if (dt.getMonth() !== m || dt.getFullYear() !== y) continue;

    const full = d.saleTotal != null ? Number(d.saleTotal) : 0;
    const per = d.saleValuePerCloser != null ? Number(d.saleValuePerCloser) : full;

    if (!closerName) {
      total += full; // visão de equipe: valor cheio da venda
    } else if (d.closerName === closerName || d.secondCloser === closerName) {
      total += per;  // visão individual: parte do closer (split se houver)
    }
  }
  return total;
}

// Conta o NÚMERO de vendas fechadas no mês (para exibição auxiliar).
export function countWonThisMonth(deals, closerName = null) {
  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();
  return deals.filter(d => {
    if (d.outcome !== 'venda_fechada') return false;
    if (closerName && d.closerName !== closerName && d.secondCloser !== closerName) return false;
    const ts = d.wonAt || d.closedAt;
    if (!ts) return false;
    const dt = new Date(ts);
    return dt.getMonth() === m && dt.getFullYear() === y;
  }).length;
}

// Conta MQ (mal qualificado) de um SDR no mês — métrica de KPI do SDR.
export function countMQThisMonth(deals, sdrName = null) {
  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();
  return deals.filter(d => {
    if (d.outcome !== 'mq') return false;
    if (sdrName && d.sdrName !== sdrName) return false;
    const ts = d.closedAt;
    if (!ts) return false;
    const dt = new Date(ts);
    return dt.getMonth() === m && dt.getFullYear() === y;
  }).length;
}
