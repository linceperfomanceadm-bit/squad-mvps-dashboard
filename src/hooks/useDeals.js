import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, updateDoc, doc, query, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/*
 * Coleção `deals` — criada pelo SDR (Bloco 3) ao agendar uma call.
 *
 * status:
 *   scheduled    → call marcada, aguardando o Closer
 *   won          → ganho (briefing preenchido) → segue para CS
 *   lost         → perdido (com motivo)
 *   noshow       → cliente não apareceu
 *   standby      → retomar no futuro (standbyAt)
 *   awaiting_cs  → ganho + briefing enviado, na fila do CS
 *   active       → CS concluiu o setup, virou cliente
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

  // Closer assume o deal (claim leve).
  const claimDeal = async (dealId, closerName) => {
    try {
      const d = deals.find(x => x.id === dealId);
      await updateDoc(doc(db, 'deals', dealId), {
        closerName: d?.closerName || closerName,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const updateDeal = async (dealId, data) => {
    try { await updateDoc(doc(db, 'deals', dealId), data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  // ── Encerramento da call ─────────────────────────────────────
  const closeNoShow = async (dealId, closerName) => {
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

  // Ganho: grava o briefing e manda para o CS.
  const closeWon = async (dealId, closerName, briefing) => {
    return updateDeal(dealId, {
      status: 'awaiting_cs', closerName, outcome: 'won',
      briefing,
      wonAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
    });
  };

  // Anotações da call (rich text) — salvas no deal.
  const saveCallNotes = async (dealId, notesHtml) => {
    return updateDeal(dealId, { callNotes: notesHtml });
  };

  return {
    deals, loading,
    claimDeal, updateDeal,
    closeNoShow, closeLost, closeStandby, closeWon, saveCallNotes,
  };
}
