import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, updateDoc, doc, query, orderBy, serverTimestamp, addDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/*
 * Coleção `deals` — calls do funil comercial.
 *
 * status (fluxo do Closer):
 *   available    → call agendada pelo SDR, disponível para qualquer closer puxar
 *   claimed      → puxada por um closer (vai para a agenda interna dele)
 *   won          → ganho → vira awaiting_cs (CS)
 *   lost         → perdido (recuperável)
 *   standby      → retomar no futuro (recuperável)
 *   noshow       → cliente não compareceu (lead volta ao SDR com flag)
 *   awaiting_cs  → ganho + briefing → fila do CS
 *   active       → CS concluiu o setup
 *
 * Calls manuais do closer (sem SDR) nascem já com status 'claimed'.
 */
export function useDeals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'deals'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setDeals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const updateDeal = async (dealId, data) => {
    try { await updateDoc(doc(db, 'deals', dealId), data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  // ── Closer puxa uma call disponível para a agenda dele ───────
  const claimCall = async (dealId, closerName) => {
    const d = deals.find(x => x.id === dealId);
    if (d && d.status === 'claimed' && d.closerName && d.closerName !== closerName) {
      return { success: false, error: 'Essa call já foi puxada por outro closer.' };
    }
    return updateDeal(dealId, {
      status: 'claimed', closerName, claimedAt: new Date().toISOString(),
    });
  };

  // ── Closer devolve a call para "disponíveis" (exige justificativa) ──
  const releaseCall = async (dealId, closerName, reason) => {
    if (!reason || !reason.trim()) return { success: false, error: 'Justifique a devolução.' };
    const d = deals.find(x => x.id === dealId);
    const releaseLog = [...(d?.releaseLog || []), { by: closerName, reason: reason.trim(), at: new Date().toISOString() }];
    return updateDeal(dealId, {
      status: 'available', closerName: null, claimedAt: null, releaseLog,
    });
  };

  // ── Closer cadastra call manual (não veio do SDR) ────────────
  const addManualCall = async (closerName, { leadName, company, callAt, meetLink, pains }) => {
    try {
      const ref = await addDoc(collection(db, 'deals'), {
        leadId: null, leadName: (leadName || '').trim(), leadPhone: '',
        company: (company || '').trim(),
        sdrName: null, manual: true,
        callAt, meetLink: (meetLink || '').trim(), pains: (pains || '').trim(),
        sdrLogs: [],
        status: 'claimed', closerName, claimedAt: new Date().toISOString(),
        outcome: null, briefing: null,
        createdAt: serverTimestamp(),
      });
      return { success: true, id: ref.id };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Encerramento da call ─────────────────────────────────────

  // No-show: devolve o lead ao SDR com flag e marca o deal.
  const closeNoShow = async (dealId, closerName) => {
    const d = deals.find(x => x.id === dealId);
    if (d?.leadId) {
      try {
        await updateDoc(doc(db, 'leads', d.leadId), {
          status: 'queue', noShowFlag: true, followupAt: null, dealId: null,
        });
      } catch {}
    }
    return updateDeal(dealId, {
      status: 'noshow', closerName, outcome: 'noshow',
      closedAt: new Date().toISOString(),
    });
  };

  const closeLost = async (dealId, closerName, reason) => {
    return updateDeal(dealId, {
      status: 'lost', closerName, outcome: 'lost',
      lostReason: (reason || '').trim(),
      closedAt: new Date().toISOString(),
    });
  };

  const closeStandby = async (dealId, closerName, standbyAtISO) => {
    return updateDeal(dealId, {
      status: 'standby', closerName, outcome: 'standby',
      standbyAt: standbyAtISO,
      closedAt: new Date().toISOString(),
    });
  };

  // Ganho: grava briefing (com valor da venda) e manda para o CS.
  const closeWon = async (dealId, closerName, briefing) => {
    return updateDeal(dealId, {
      status: 'awaiting_cs', closerName, outcome: 'won',
      briefing,
      saleValue: briefing?.saleMonthly ? Number(briefing.saleMonthly) : null,
      saleMonths: briefing?.saleMonths ? Number(briefing.saleMonths) : null,
      saleTotal: (briefing?.saleMonthly && briefing?.saleMonths)
        ? Number(briefing.saleMonthly) * Number(briefing.saleMonths) : null,
      wonAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
    });
  };

  // ── Recuperar deal encerrado (standby/lost/noshow) → agenda do closer ──
  const recoverDeal = async (dealId, closerName) => {
    return updateDeal(dealId, {
      status: 'claimed', closerName, outcome: null,
      lostReason: null, standbyAt: null, closedAt: null,
      recoveredAt: new Date().toISOString(),
    });
  };

  const saveCallNotes = async (dealId, notesHtml) => {
    return updateDeal(dealId, { callNotes: notesHtml });
  };

  return {
    deals, loading, updateDeal,
    claimCall, releaseCall, addManualCall,
    closeNoShow, closeLost, closeStandby, closeWon,
    recoverDeal, saveCallNotes,
  };
}

// Detecta conflito de horário (janela de 1h) entre uma call candidata
// e as calls que o closer já tem na agenda.
export function hasConflict(candidateCallAt, closerDeals, windowMs = 60 * 60 * 1000) {
  if (!candidateCallAt) return null;
  const t = new Date(candidateCallAt).getTime();
  for (const d of closerDeals) {
    if (!d.callAt) continue;
    const dt = new Date(d.callAt).getTime();
    if (Math.abs(dt - t) < windowMs) return d;
  }
  return null;
}
