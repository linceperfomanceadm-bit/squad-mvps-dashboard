import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, updateDoc, doc, query, orderBy, serverTimestamp, addDoc, deleteDoc,
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
  // Aceitar a call. Se veio da fila (assigned), só o closer da vez
  // aceita. Vira 'claimed' (na agenda do closer).
  const claimCall = async (dealId, closerName) => {
    const d = deals.find(x => x.id === dealId);
    if (d && d.status === 'assigned' && d.assignedTo && d.assignedTo !== closerName) {
      return { success: false, error: 'Essa call foi atribuída a outro closer da fila.' };
    }
    if (d && d.status === 'claimed' && d.closerName && d.closerName !== closerName) {
      return { success: false, error: 'Essa call já foi aceita por outro closer.' };
    }
    return updateDeal(dealId, {
      status: 'claimed', closerName, claimedAt: new Date().toISOString(),
    });
  };

  // ── Passar a vez: recusa e envia ao próximo closer da fila ────
  // closers: lista de nomes ativos (mesma ordem da distribuição).
  const passTurn = async (dealId, closerName, reason, closers = []) => {
    if (!reason || !reason.trim()) return { success: false, error: 'Descreva o motivo de passar a vez.' };
    const d = deals.find(x => x.id === dealId);
    if (!d) return { success: false, error: 'Call não encontrada.' };
    const passedBy = [...(d.passedBy || []), { by: closerName, reason: reason.trim(), at: new Date().toISOString() }];

    // Descobre o próximo closer que ainda não passou (evita loop infinito).
    let next = null;
    if (closers.length > 0) {
      const already = new Set(passedBy.map(p => p.by));
      const startIdx = closers.indexOf(closerName);
      for (let i = 1; i <= closers.length; i++) {
        const cand = closers[(startIdx + i) % closers.length];
        if (!already.has(cand)) { next = cand; break; }
      }
    }
    if (!next) {
      // Todos passaram → volta para pool disponível a qualquer um.
      return updateDeal(dealId, { status: 'available', assignedTo: null, closerName: null, passedBy });
    }
    return updateDeal(dealId, { status: 'assigned', assignedTo: next, closerName: null, passedBy });
  };

  // ── Adicionar 2º closer (split de comissão na venda) ─────────
  const addSecondCloser = async (dealId, secondCloserName) => {
    if (!secondCloserName) return { success: false, error: 'Selecione o segundo closer.' };
    return updateDeal(dealId, { secondCloser: secondCloserName });
  };

  const removeSecondCloser = async (dealId) => {
    return updateDeal(dealId, { secondCloser: null });
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

  // MQ (mal qualificado) — antigo "Perdido". Vira métrica do SDR.
  const closeLost = async (dealId, closerName, reason) => {
    return updateDeal(dealId, {
      status: 'mq', closerName, outcome: 'mq',
      mqReason: (reason || '').trim(),
      closedAt: new Date().toISOString(),
    });
  };

  // Venda Fechada — antigo "Ganho". Grava briefing (com valor) e vai
  // para o CS. Se houver 2º closer, o valor é dividido por 2 (split).
  const closeWon = async (dealId, closerName, briefing) => {
    const d = deals.find(x => x.id === dealId);
    const total = briefing?.saleTotal != null ? Number(briefing.saleTotal)
      : (briefing?.saleMonthly && briefing?.saleMonths)
        ? Number(briefing.saleMonthly) * Number(briefing.saleMonths)
        : (briefing?.saleMonthly ? Number(briefing.saleMonthly) : null);
    const hasSecond = !!d?.secondCloser;
    const perCloser = (total != null && hasSecond) ? total / 2 : total;
    return updateDeal(dealId, {
      status: 'awaiting_cs', closerName, outcome: 'venda_fechada',
      briefing,
      saleTotal: total,
      // valor que conta para a meta de CADA closer (split se 2 closers)
      saleValuePerCloser: perCloser,
      splitCount: hasSecond ? 2 : 1,
      wonAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
    });
  };

  // ── Recuperar deal encerrado (mq/noshow) → agenda do closer ──
  const recoverDeal = async (dealId, closerName) => {
    return updateDeal(dealId, {
      status: 'claimed', closerName, outcome: null,
      mqReason: null, closedAt: null,
      recoveredAt: new Date().toISOString(),
    });
  };

  // ── Excluir call manual (só o closer que criou OU admin) ─────
  const deleteManualCall = async (dealId, requester) => {
    const d = deals.find(x => x.id === dealId);
    if (!d) return { success: false, error: 'Call não encontrada.' };
    if (!d.manual) return { success: false, error: 'Só calls manuais podem ser excluídas.' };
    const allowed = requester?.isAdmin || d.closerName === requester?.name;
    if (!allowed) return { success: false, error: 'Sem permissão para excluir esta call.' };
    try { await deleteDoc(doc(db, 'deals', dealId)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const saveCallNotes = async (dealId, notesHtml) => {
    return updateDeal(dealId, { callNotes: notesHtml });
  };

  // Salva o mini-formulário preenchido durante a call.
  const saveCallForm = async (dealId, callForm) => {
    return updateDeal(dealId, { callForm });
  };

  // ── CS devolve o contrato ao Closer (falta informação) ───────
  const returnToCloser = async (dealId, csName, reason) => {
    if (!reason || !reason.trim()) return { success: false, error: 'Justifique o que ficou faltando.' };
    const d = deals.find(x => x.id === dealId);
    const returns = [...(d?.csReturns || []), { by: csName, reason: reason.trim(), at: new Date().toISOString() }];
    // Volta para a agenda do closer que fechou (status claimed de novo).
    return updateDeal(dealId, {
      status: 'claimed', outcome: null, csReturns: returns, returnedByCs: true,
    });
  };

  return {
    deals, loading, updateDeal,
    claimCall, releaseCall, addManualCall,
    passTurn, addSecondCloser, removeSecondCloser,
    closeNoShow, closeLost, closeWon,
    recoverDeal, saveCallNotes, saveCallForm, returnToCloser, deleteManualCall,
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
