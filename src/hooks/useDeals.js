import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, updateDoc, doc, query, orderBy, serverTimestamp, addDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/*
 * Coleção `deals` — o funil inteiro: SDR → Closer → CS Comercial.
 *
 * A prospecção NÃO acontece mais no app (é feita no Kommo). O SDR só
 * cadastra a call que conseguiu agendar; esse cadastro nasce como um
 * deal com status 'scheduled' e aparece para TODOS os closers no
 * painel "Clientes Agendados".
 *
 * status:
 *   scheduled → call agendada pelo SDR, aguardando acontecer
 *   followup  → closer confirmou a call realizada; aguarda desfecho
 *   won       → Venda Ganha (pré-formulário preenchido) → CS Comercial
 *   mq        → Mal Qualificado (motivo obrigatório) → base do admin
 *   noshow    → cliente não compareceu; volta ao painel do SDR
 *   active    → CS concluiu o onboarding e o cliente foi criado
 *
 * Dentro de `won`, o CS Comercial trabalha com csStage:
 *   contract   → card em Novos Contratos (checklist)
 *   onboarding → call de onboarding agendada
 *   done       → onboarding concluído (o deal vira status 'active')
 */

const emptyCheck = () => ({ done: false, by: null, at: null });

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

  // ── SDR: cadastra uma call já agendada (veio do Kommo) ───────
  const addScheduledCall = async (sdrName, data) => {
    const {
      leadName, company, contact, niche, socials, bant, callAt, meetLink, notes,
    } = data || {};
    if (!String(leadName || '').trim()) return { success: false, error: 'Informe o nome do lead.' };
    if (!callAt) return { success: false, error: 'Defina a data e a hora da call.' };
    try {
      const ref = await addDoc(collection(db, 'deals'), {
        leadName: String(leadName).trim(),
        company: String(company || '').trim(),
        contact: String(contact || '').trim(),
        niche: String(niche || '').trim(),
        socials: String(socials || '').trim(),
        bant: {
          budget: String(bant?.budget || '').trim(),
          authority: String(bant?.authority || '').trim(),
          need: String(bant?.need || '').trim(),
          timing: String(bant?.timing || '').trim(),
        },
        notes: String(notes || '').trim(),
        callAt,
        meetLink: String(meetLink || '').trim(),
        sdrName,
        status: 'scheduled',
        outcome: null,
        closerName: null,
        secondCloser: null,
        followupLogs: [],
        briefing: null,
        noShowCount: 0,
        createdAt: serverTimestamp(),
      });
      return { success: true, id: ref.id };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── SDR: edita uma call ainda agendada (corrigir dados/horário) ──
  const updateScheduledCall = async (dealId, data) => {
    const d = deals.find(x => x.id === dealId);
    if (!d) return { success: false, error: 'Call não encontrada.' };
    if (d.status !== 'scheduled') return { success: false, error: 'Só é possível editar calls ainda agendadas.' };
    return updateDeal(dealId, {
      leadName: String(data.leadName || d.leadName).trim(),
      company: String(data.company || '').trim(),
      contact: String(data.contact || '').trim(),
      niche: String(data.niche || '').trim(),
      socials: String(data.socials || '').trim(),
      bant: {
        budget: String(data.bant?.budget || '').trim(),
        authority: String(data.bant?.authority || '').trim(),
        need: String(data.bant?.need || '').trim(),
        timing: String(data.bant?.timing || '').trim(),
      },
      notes: String(data.notes || '').trim(),
      callAt: data.callAt || d.callAt,
      meetLink: String(data.meetLink || '').trim(),
    });
  };

  // ── SDR: reagenda uma call que deu no-show ───────────────────
  const rescheduleCall = async (dealId, sdrName, newCallAt, meetLink) => {
    if (!newCallAt) return { success: false, error: 'Defina a nova data e hora.' };
    const d = deals.find(x => x.id === dealId);
    return updateDeal(dealId, {
      status: 'scheduled',
      callAt: newCallAt,
      meetLink: meetLink != null ? String(meetLink).trim() : (d?.meetLink || ''),
      rescheduledAt: new Date().toISOString(),
      rescheduledBy: sdrName,
      noShowAt: null,
      noShowBy: null,
      outcome: null,
    });
  };

  // ── SDR/Admin: exclui uma call agendada (ainda não trabalhada) ──
  const deleteCall = async (dealId, requester) => {
    const d = deals.find(x => x.id === dealId);
    if (!d) return { success: false, error: 'Call não encontrada.' };
    const allowed = requester?.isAdmin || d.sdrName === requester?.name || d.closerName === requester?.name;
    if (!allowed) return { success: false, error: 'Sem permissão para excluir esta call.' };
    if (!['scheduled', 'noshow'].includes(d.status)) {
      return { success: false, error: 'Só é possível excluir calls agendadas ou com no-show.' };
    }
    try { await deleteDoc(doc(db, 'deals', dealId)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  // ── Closer: cadastra call própria (não veio do SDR) ──────────
  const addManualCall = async (closerName, { leadName, company, contact, callAt, meetLink, notes }) => {
    if (!String(leadName || '').trim()) return { success: false, error: 'Informe o nome do lead.' };
    if (!callAt) return { success: false, error: 'Defina a data e a hora da call.' };
    try {
      const ref = await addDoc(collection(db, 'deals'), {
        leadName: String(leadName).trim(),
        company: String(company || '').trim(),
        contact: String(contact || '').trim(),
        niche: '', socials: '',
        bant: { budget: '', authority: '', need: '', timing: '' },
        notes: String(notes || '').trim(),
        callAt,
        meetLink: String(meetLink || '').trim(),
        sdrName: null,
        manual: true,
        status: 'scheduled',
        outcome: null,
        closerName,
        secondCloser: null,
        followupLogs: [],
        briefing: null,
        noShowCount: 0,
        createdAt: serverTimestamp(),
      });
      return { success: true, id: ref.id };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Closer: confirma que a call aconteceu → vira Follow Up ───
  const confirmCallDone = async (dealId, closerName) => {
    const d = deals.find(x => x.id === dealId);
    if (!d) return { success: false, error: 'Call não encontrada.' };
    if (d.status !== 'scheduled') return { success: false, error: 'Essa call já foi confirmada por outro closer.' };
    return updateDeal(dealId, {
      status: 'followup',
      closerName,
      callDoneAt: new Date().toISOString(),
    });
  };

  // ── Closer: no-show — volta para o painel do SDR marcado ─────
  const markNoShow = async (dealId, closerName, note) => {
    const d = deals.find(x => x.id === dealId);
    if (!d) return { success: false, error: 'Call não encontrada.' };
    return updateDeal(dealId, {
      status: 'noshow',
      outcome: 'noshow',
      noShowAt: new Date().toISOString(),
      noShowBy: closerName,
      noShowNote: String(note || '').trim(),
      noShowCount: (d.noShowCount || 0) + 1,
      closedAt: new Date().toISOString(),
    });
  };

  // ── 2º closer (call feita em dupla → split do valor) ─────────
  const addSecondCloser = async (dealId, secondCloserName) => {
    if (!secondCloserName) return { success: false, error: 'Selecione o segundo closer.' };
    const d = deals.find(x => x.id === dealId);
    if (d?.closerName === secondCloserName) return { success: false, error: 'O 2º closer precisa ser outra pessoa.' };
    return updateDeal(dealId, { secondCloser: secondCloserName });
  };

  const removeSecondCloser = (dealId) => updateDeal(dealId, { secondCloser: null });

  // ── Follow Up: registro de tentativas de contato ─────────────
  const addFollowupLog = async (dealId, byName, text) => {
    if (!String(text || '').trim()) return { success: false, error: 'Descreva a tentativa de contato.' };
    const d = deals.find(x => x.id === dealId);
    if (!d) return { success: false, error: 'Call não encontrada.' };
    const logs = [...(d.followupLogs || []), {
      id: `f_${Date.now()}`,
      by: byName,
      text: String(text).trim(),
      at: new Date().toISOString(),
    }];
    return updateDeal(dealId, { followupLogs: logs });
  };

  // ── Desfecho: MQ (motivo obrigatório) ────────────────────────
  const closeMQ = async (dealId, closerName, reason) => {
    if (!String(reason || '').trim()) return { success: false, error: 'O motivo do MQ é obrigatório.' };
    const d = deals.find(x => x.id === dealId);
    return updateDeal(dealId, {
      status: 'mq',
      outcome: 'mq',
      closerName: closerName || d?.closerName || null,
      mqReason: String(reason).trim(),
      closedAt: new Date().toISOString(),
    });
  };

  // ── Desfecho: Venda Ganha (pré-formulário) ───────────────────
  // Segue para o CS Comercial já na etapa "Novos Contratos".
  const closeWon = async (dealId, closerName, briefing) => {
    const d = deals.find(x => x.id === dealId);
    const total = briefing?.saleTotal != null ? Number(briefing.saleTotal) : null;
    const hasSecond = !!d?.secondCloser;
    const perCloser = (total != null && hasSecond) ? total / 2 : total;
    return updateDeal(dealId, {
      status: 'won',
      outcome: 'venda_ganha',
      closerName: closerName || d?.closerName || null,
      briefing,
      saleTotal: total,
      saleValuePerCloser: perCloser,
      splitCount: hasSecond ? 2 : 1,
      wonAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      csStage: 'contract',
      csChecklist: { contract: emptyCheck(), payment: emptyCheck() },
      signature: emptyCheck(),
      paymentConfirmed: emptyCheck(),
      onboardingCall: null,
    });
  };

  // ── Recuperar deal marcado como MQ → volta para Follow Up ────
  const recoverDeal = async (dealId, byName) => updateDeal(dealId, {
    status: 'followup',
    outcome: null,
    mqReason: null,
    closedAt: null,
    recoveredAt: new Date().toISOString(),
    recoveredBy: byName,
  });

  // ════════════════════════════════════════════════════════════
  //  CS COMERCIAL
  // ════════════════════════════════════════════════════════════

  // Checklist do card em "Novos Contratos".
  // item: 'contract' (Gerar Contrato) | 'payment' (Gerar link de Pagamento)
  // Ao marcar, o cliente passa a aparecer no painel correspondente.
  const toggleCsChecklist = async (dealId, item, byName, done = true) => {
    const d = deals.find(x => x.id === dealId);
    if (!d) return { success: false, error: 'Contrato não encontrado.' };
    if (!['contract', 'payment'].includes(item)) return { success: false, error: 'Item inválido.' };

    const current = { contract: emptyCheck(), payment: emptyCheck(), ...(d.csChecklist || {}) };
    // Desmarcar só é permitido enquanto o painel correspondente ainda
    // não foi confirmado (senão a etapa já avançou).
    const confirmedKey = item === 'contract' ? 'signature' : 'paymentConfirmed';
    if (!done && d[confirmedKey]?.done) {
      return { success: false, error: 'Já confirmado no painel — não dá para desmarcar.' };
    }
    current[item] = done
      ? { done: true, by: byName, at: new Date().toISOString() }
      : emptyCheck();
    return updateDeal(dealId, { csChecklist: current });
  };

  // Confirmação nos painéis de Assinatura / Pagamento. Ao confirmar,
  // o card some daquele painel.
  const confirmSignature = (dealId, byName) => updateDeal(dealId, {
    signature: { done: true, by: byName, at: new Date().toISOString() },
  });

  const confirmPayment = (dealId, byName) => updateDeal(dealId, {
    paymentConfirmed: { done: true, by: byName, at: new Date().toISOString() },
  });

  // Mover para Onboarding: exige data/hora da call de onboarding.
  const moveToOnboarding = async (dealId, byName, callAt, meetLink) => {
    const d = deals.find(x => x.id === dealId);
    if (!d) return { success: false, error: 'Contrato não encontrado.' };
    if (!canMoveToOnboarding(d)) {
      return { success: false, error: 'Confirme a assinatura e o pagamento antes de mover.' };
    }
    if (!callAt) return { success: false, error: 'Defina a data e a hora da call de onboarding.' };
    return updateDeal(dealId, {
      csStage: 'onboarding',
      onboardingCall: {
        at: callAt,
        meetLink: String(meetLink || '').trim(),
        by: byName,
        setAt: new Date().toISOString(),
      },
    });
  };

  // Reagendar a call de onboarding.
  const rescheduleOnboardingCall = async (dealId, byName, callAt, meetLink) => {
    if (!callAt) return { success: false, error: 'Defina a nova data e hora.' };
    const d = deals.find(x => x.id === dealId);
    return updateDeal(dealId, {
      onboardingCall: {
        ...(d?.onboardingCall || {}),
        at: callAt,
        meetLink: String(meetLink || '').trim(),
        by: byName,
        setAt: new Date().toISOString(),
      },
    });
  };

  // Onboarding concluído: o cliente já foi criado em `clients` e a
  // partir daqui ele vive no CS Operacional (aba Kickoff).
  const finishOnboarding = async (dealId, byName, clientId, clientName) => updateDeal(dealId, {
    status: 'active',
    csStage: 'done',
    clientId,
    clientName,
    onboardingDoneAt: new Date().toISOString(),
    onboardingDoneBy: byName,
  });

  return {
    deals, loading, updateDeal,
    addScheduledCall, updateScheduledCall, rescheduleCall, deleteCall,
    addManualCall, confirmCallDone, markNoShow,
    addSecondCloser, removeSecondCloser, addFollowupLog,
    closeMQ, closeWon, recoverDeal,
    toggleCsChecklist, confirmSignature, confirmPayment,
    moveToOnboarding, rescheduleOnboardingCall, finishOnboarding,
  };
}

// ─── Helpers de leitura (usados pelos painéis e pelo admin) ────

// Habilitado só quando assinatura E pagamento foram confirmados.
export const canMoveToOnboarding = (d) => !!(d?.signature?.done && d?.paymentConfirmed?.done);

// Uma venda é "ganha" tanto no formato novo quanto no antigo.
export const isWonDeal = (d) => d?.outcome === 'venda_ganha' || d?.outcome === 'venda_fechada';

// Deals que o CS Comercial precisa tratar (venda ganha, ainda não ativa).
export const isCsDeal = (d) => d?.status === 'won';
