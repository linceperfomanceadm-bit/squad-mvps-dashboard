import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/*
 * Metas comerciais (definidas pelo admin).
 * Documento: commercial_config/goals = {
 *   teamGoal:   number,                  // meta de VALOR (R$) da equipe/mês
 *   individual: { [closerName]: number },// meta de VALOR (R$) por closer
 *   sdrTeamGoal: number,                 // meta de calls agendadas da equipe
 *   sdrIndividual: { [sdrName]: number },// meta de calls agendadas por SDR
 * }
 * Mensais — resetam naturalmente na virada do mês.
 */
const EMPTY_GOALS = { teamGoal: 0, individual: {}, sdrTeamGoal: 0, sdrIndividual: {} };

export function useCommercialGoals() {
  const [goals, setGoals] = useState(EMPTY_GOALS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, 'commercial_config', 'goals');
    return onSnapshot(ref, snap => {
      if (snap.exists()) setGoals({ ...EMPTY_GOALS, ...snap.data() });
      setLoading(false);
    }, () => setLoading(false));
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
    }, () => setLoading(false));
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

// ─── Helpers de período ────────────────────────────────────────
const isThisMonth = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

// Aceita o formato novo ('venda_ganha') e o antigo ('venda_fechada').
const won = (d) => d?.outcome === 'venda_ganha' || d?.outcome === 'venda_fechada';

// ─── Métricas do Closer ────────────────────────────────────────

// Soma o VALOR das vendas ganhas no mês corrente.
// Na visão individual considera o split (saleValuePerCloser).
export function sumSalesThisMonth(deals, closerName = null) {
  let total = 0;
  for (const d of deals) {
    if (!won(d)) continue;
    if (!isThisMonth(d.wonAt || d.closedAt)) continue;

    const full = d.saleTotal != null ? Number(d.saleTotal) : 0;
    const per  = d.saleValuePerCloser != null ? Number(d.saleValuePerCloser) : full;

    if (!closerName) total += full;
    else if (d.closerName === closerName || d.secondCloser === closerName) total += per;
  }
  return total;
}

// Nº de vendas ganhas no mês.
export function countWonThisMonth(deals, closerName = null) {
  return deals.filter(d => {
    if (!won(d)) return false;
    if (closerName && d.closerName !== closerName && d.secondCloser !== closerName) return false;
    return isThisMonth(d.wonAt || d.closedAt);
  }).length;
}

// Calls REALIZADAS no mês (o closer confirmou que aconteceu).
export function countCallsDoneThisMonth(deals, closerName = null) {
  return deals.filter(d => {
    if (!d.callDoneAt) return false;
    if (closerName && d.closerName !== closerName && d.secondCloser !== closerName) return false;
    return isThisMonth(d.callDoneAt);
  }).length;
}

// Follow Ups em aberto (aguardando desfecho do closer).
export function countOpenFollowups(deals, closerName = null) {
  return deals.filter(d => {
    if (d.status !== 'followup') return false;
    if (closerName && d.closerName !== closerName && d.secondCloser !== closerName) return false;
    return true;
  }).length;
}

// ─── Métricas do SDR ───────────────────────────────────────────

// Calls AGENDADAS no mês por um SDR (data da call dentro do mês).
export function countScheduledThisMonth(deals, sdrName = null) {
  return deals.filter(d => {
    if (!d.sdrName) return false;
    if (sdrName && d.sdrName !== sdrName) return false;
    return isThisMonth(d.callAt);
  }).length;
}

// Calls BEM QUALIFICADAS: agendadas no mês que aconteceram e NÃO
// foram marcadas como MQ nem deram no-show.
export function countQualifiedThisMonth(deals, sdrName = null) {
  return deals.filter(d => {
    if (!d.sdrName) return false;
    if (sdrName && d.sdrName !== sdrName) return false;
    if (!isThisMonth(d.callAt)) return false;
    if (!d.callDoneAt) return false;
    return d.outcome !== 'mq' && d.outcome !== 'noshow';
  }).length;
}

// MQ no mês — KPI de qualidade do SDR que agendou.
export function countMQThisMonth(deals, sdrName = null) {
  return deals.filter(d => {
    if (d.outcome !== 'mq') return false;
    if (sdrName && d.sdrName !== sdrName) return false;
    return isThisMonth(d.closedAt);
  }).length;
}

// No-shows no mês — também é KPI do SDR.
export function countNoShowThisMonth(deals, sdrName = null) {
  return deals.filter(d => {
    if (!d.noShowAt) return false;
    if (sdrName && d.sdrName !== sdrName) return false;
    return isThisMonth(d.noShowAt);
  }).length;
}
