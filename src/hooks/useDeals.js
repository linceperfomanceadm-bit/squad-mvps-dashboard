import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, updateDoc, doc, query, orderBy, serverTimestamp, addDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/*
 * Coleção `deals` — contratos do CS Comercial.
 *
 * O funil de prospecção (SDR → Closer) saiu do app. A negociação
 * acontece fora daqui; quando a venda fecha, o próprio CS Comercial
 * cadastra o contrato no painel dele preenchendo o formulário.
 *
 * status:
 *   won    → contrato cadastrado, em tratativa no CS Comercial
 *   active → onboarding concluído e o cliente foi criado em `clients`
 *
 * Dentro de `won`, o CS Comercial trabalha com csStage:
 *   contract   → card em Novos Contratos (checklist)
 *   onboarding → call de onboarding agendada
 *   done       → onboarding concluído (o deal vira status 'active')
 *
 * Documentos antigos do funil (scheduled/followup/mq/noshow) continuam
 * salvos no Firestore, mas nenhuma tela do app lê esses status — eles
 * simplesmente não aparecem em lugar nenhum.
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

  // ── CS Comercial: cadastra um contrato fechado ───────────────
  // Nasce direto em "Novos Contratos", com a mesma estrutura que o
  // pré-formulário gerava antes — nada mudou para quem lê o card.
  const addContract = async (byName, briefing) => {
    if (!briefing?.companyName?.trim()) {
      return { success: false, error: 'Informe o nome da empresa.' };
    }
    const total = briefing.saleTotal != null ? Number(briefing.saleTotal) : null;
    try {
      const ref = await addDoc(collection(db, 'deals'), {
        leadName: String(briefing.companyName).trim(),
        company: String(briefing.companyName).trim(),
        contact: String(briefing.contactPhone || '').trim(),
        status: 'won',
        outcome: 'venda_ganha',
        briefing,
        saleTotal: total,
        createdBy: byName || null,
        wonAt: new Date().toISOString(),
        csStage: 'contract',
        csChecklist: { contract: emptyCheck(), payment: emptyCheck() },
        signature: emptyCheck(),
        paymentConfirmed: emptyCheck(),
        onboardingCall: null,
        clientId: null,
        clientName: null,
        createdAt: serverTimestamp(),
      });
      return { success: true, id: ref.id };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── CS Comercial / Admin: exclui um contrato cadastrado errado ─
  // Só antes de qualquer confirmação — depois disso o histórico vale.
  const deleteContract = async (dealId, requester) => {
    const d = deals.find(x => x.id === dealId);
    if (!d) return { success: false, error: 'Contrato não encontrado.' };
    const allowed = requester?.isAdmin || !d.createdBy || d.createdBy === requester?.name;
    if (!allowed) return { success: false, error: 'Sem permissão para excluir este contrato.' };
    if (d.status !== 'won' || (d.csStage || 'contract') !== 'contract') {
      return { success: false, error: 'Só dá para excluir contratos que ainda estão em Novos Contratos.' };
    }
    if (d.signature?.done || d.paymentConfirmed?.done) {
      return { success: false, error: 'Já existe assinatura ou pagamento confirmado — não dá para excluir.' };
    }
    try { await deleteDoc(doc(db, 'deals', dealId)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  // ── Checklist do card em "Novos Contratos" ───────────────────
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
    addContract, deleteContract,
    toggleCsChecklist, confirmSignature, confirmPayment,
    moveToOnboarding, rescheduleOnboardingCall, finishOnboarding,
  };
}

// ─── Helpers de leitura ───────────────────────────────────────

// Habilitado só quando assinatura E pagamento foram confirmados.
export const canMoveToOnboarding = (d) => !!(d?.signature?.done && d?.paymentConfirmed?.done);
