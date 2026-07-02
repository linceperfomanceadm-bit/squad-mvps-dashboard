import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, getDoc, setDoc, serverTimestamp, query, orderBy, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export const DEFAULT_ATTEMPTS = 10;

// Tipos de contato que o SDR registra.
export const CONTACT_TYPES = [
  { id: 'ligacao',  label: 'Ligação' },
  { id: 'mensagem', label: 'Mensagem' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email',    label: 'E-mail' },
  { id: 'outro',    label: 'Outro' },
];

/*
 * Coleção `leads` — base de prospecção do SDR.
 *
 * Ciclo de vida (campo status):
 *   queue     → na fila compartilhada (qualquer SDR pode pegar)
 *   followup  → follow-up agendado; sai da fila e VOLTA sozinho
 *               quando followupAt <= agora
 *   cold      → "frio" manual; vai pra aba Frios do SDR que o trabalhou,
 *               reaberto manualmente
 *   scheduled → call agendada; gera um doc em `deals` (base do Closer)
 *   lost      → perdido/arquivado (tentativas esgotadas ou ignorado)
 *
 * Claim: ao agir num lead da fila, ele recebe claimedBy = nome do SDR.
 * A fila ativa de cada SDR mostra os não-reivindicados + os seus.
 */
export function useLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // ── Admin: inserir 1 lead ────────────────────────────────────
  const addLead = async ({ name, phone, company, notes }) => {
    try {
      await addDoc(collection(db, 'leads'), {
        name: (name || '').trim(),
        phone: normalizePhone(phone),
        company: (company || '').trim(),
        notes: (notes || '').trim(),
        status: 'queue',
        attemptsLeft: DEFAULT_ATTEMPTS,
        claimedBy: null,
        claimedAt: null,
        followupAt: null,
        logs: [],
        createdAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Admin: inserir em lote ───────────────────────────────────
  // rows: array de { name, phone, company?, notes? }
  const addLeadsBulk = async (rows, uploadedBy = null) => {
    try {
      const valid = rows.filter(r => (r.name || '').trim() || (r.phone || '').trim());
      if (!valid.length) return { success: false, error: 'Nenhum lead válido para importar.' };
      const now = new Date().toISOString();
      const batchId = `imp_${Date.now()}`; // agrupa a importação
      // writeBatch suporta até 500 ops; particiona se necessário.
      const chunks = [];
      for (let i = 0; i < valid.length; i += 450) chunks.push(valid.slice(i, i + 450));
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(r => {
          const ref = doc(collection(db, 'leads'));
          batch.set(ref, {
            name: (r.name || '').trim(),
            phone: normalizePhone(r.phone),
            company: (r.company || '').trim(),
            notes: (r.notes || '').trim(),
            status: 'queue',
            attemptsLeft: DEFAULT_ATTEMPTS,
            claimedBy: null,
            claimedAt: null,
            followupAt: null,
            logs: [],
            // Rastro de quem importou a planilha.
            importedBy: uploadedBy,
            importedAt: now,
            importBatchId: batchId,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
      return { success: true, count: valid.length };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const updateLead = async (id, data) => {
    try { await updateDoc(doc(db, 'leads', id), data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const deleteLead = async (id) => {
    try { await deleteDoc(doc(db, 'leads', id)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  // ── SDR: reivindicar lead (claim) ────────────────────────────
  const claimLead = async (leadId, sdrName) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead não encontrado');
      if (lead.claimedBy && lead.claimedBy !== sdrName) {
        return { success: false, error: 'Lead já está com outro SDR.' };
      }
      await updateDoc(doc(db, 'leads', leadId), {
        claimedBy: sdrName,
        claimedAt: lead.claimedAt || new Date().toISOString(),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── SDR: "Registrar Contato" (consome 1 tentativa) ───────────
  // Guarda tipo (ligação/mensagem/...), se houve retorno, e nota,
  // num histórico detalhado (contactHistory) além do log.
  const registerContact = async (leadId, sdrName, { contactType, hadReturn, note = '' }) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead não encontrado');
      if (!contactType) return { success: false, error: 'Informe o tipo de contato.' };
      const now = new Date().toISOString();
      const left = Math.max(0, (lead.attemptsLeft ?? DEFAULT_ATTEMPTS) - 1);
      const entry = {
        id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: contactType, hadReturn: !!hadReturn, note: note.trim(),
        by: sdrName, at: now,
      };
      const contactHistory = [...(lead.contactHistory || []), entry];
      const logs = appendLog(lead, { type: 'contact', by: sdrName, at: now, contactType, hadReturn: !!hadReturn });
      const patch = {
        claimedBy: lead.claimedBy || sdrName,
        claimedAt: lead.claimedAt || now,
        attemptsLeft: left,
        contactHistory, logs,
      };
      // Ao zerar as tentativas pela 1ª vez, libera "Sem Interação".
      if (left === 0) patch.attemptsExhausted = true;
      await updateDoc(doc(db, 'leads', leadId), patch);
      return { success: true, exhausted: left === 0 };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── SDR: "Sem Interação" → vai para Recuperáveis ─────────────
  // Só permitido depois de esgotar as tentativas ao menos uma vez.
  const markSemInteracao = async (leadId, sdrName) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead não encontrado');
      if ((lead.attemptsLeft ?? DEFAULT_ATTEMPTS) > 0 && !lead.attemptsExhausted) {
        return { success: false, error: 'Só é possível após esgotar as tentativas de contato.' };
      }
      const now = new Date().toISOString();
      const logs = appendLog(lead, { type: 'sem_interacao', by: sdrName, at: now });
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'recoverable', recoverReason: 'Sem interação', lostAt: now,
        claimedBy: lead.claimedBy || sdrName, logs,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── SDR: "Lead Frio" → aba Frios (exige motivo) ──────────────
  const markCold = async (leadId, sdrName, reason) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead não encontrado');
      if (!reason || !reason.trim()) return { success: false, error: 'Informe o motivo de marcar como frio.' };
      const now = new Date().toISOString();
      const logs = appendLog(lead, { type: 'cold', by: sdrName, at: now, reason: reason.trim() });
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'cold', coldReason: reason.trim(), coldAt: now,
        claimedBy: lead.claimedBy || sdrName, logs,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── SDR: agendar follow-up (sai da fila, volta na data) ──────
  const scheduleFollowup = async (leadId, sdrName, followupAtISO) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead não encontrado');
      const now = new Date().toISOString();
      const logs = appendLog(lead, { type: 'followup', by: sdrName, at: now, followupAt: followupAtISO });
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'followup',
        followupAt: followupAtISO,
        claimedBy: lead.claimedBy || sdrName,
        claimedAt: lead.claimedAt || now,
        logs,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── SDR: reabrir lead (qualquer estado) → volta para a fila ──
  // Restaura tentativas (senão um lead esgotado voltaria com 0 e não
  // poderia ser trabalhado) e limpa flags de no-show/perdido.
  const reopenLead = async (leadId, sdrName) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead não encontrado');
      const now = new Date().toISOString();
      const logs = appendLog(lead, { type: 'reopened', by: sdrName, at: now });
      // De onde está sendo recuperado (para a tag no card).
      const from = lead.status === 'cold' ? 'Frio' : (lead.status === 'recoverable' ? 'Recuperável' : 'Arquivado');
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'queue',
        followupAt: null,
        attemptsLeft: DEFAULT_ATTEMPTS, // recomeça com tentativas cheias
        attemptsExhausted: false,
        lostReason: null,
        lostAt: null,
        coldReason: null,
        recoverReason: null,
        noShowFlag: false,
        recoveredFrom: from, // tag: "recuperado de Frio/Recuperável"
        recoveredAt: now,
        logs,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Closer → SDR: no-show devolve o lead para a fila com flag ──
  const returnFromNoShow = async (leadId) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return { success: false, error: 'Lead não encontrado' };
      const now = new Date().toISOString();
      const logs = appendLog(lead, { type: 'noshow_return', by: 'Closer', at: now });
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'queue',
        noShowFlag: true, // SDR vê que precisa reagendar
        followupAt: null,
        dealId: null,
        logs,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── SDR: Call Agendada → cria deal e distribui via fila rotativa ──
  // closers: lista de nomes dos closers ativos (round-robin).
  const scheduleCall = async (leadId, sdrName, { datetime, meetLink, pains }, closers = []) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead não encontrado');
      if (!datetime) return { success: false, error: 'Defina a data/hora da call.' };
      if (!pains || pains.trim().length < 150) {
        return { success: false, error: `As dores mapeadas precisam ter ao menos 150 caracteres (tem ${(pains || '').trim().length}).` };
      }
      const now = new Date().toISOString();

      // Fila rotativa: pega o próximo closer da vez.
      let assignedCloser = null;
      let queueIndex = 0;
      if (closers.length > 0) {
        const cfgRef = doc(db, 'commercial_config', 'closerQueue');
        const cfgSnap = await getDoc(cfgRef);
        const lastIndex = cfgSnap.exists() ? (cfgSnap.data().lastIndex ?? -1) : -1;
        queueIndex = (lastIndex + 1) % closers.length;
        assignedCloser = closers[queueIndex];
        await setDoc(cfgRef, { lastIndex: queueIndex, updatedAt: now }, { merge: true });
      }

      const dealRef = await addDoc(collection(db, 'deals'), {
        leadId,
        leadName: lead.name,
        leadPhone: lead.phone || '',
        company: lead.company || '',
        sdrName,
        callAt: datetime,
        meetLink: (meetLink || '').trim(),
        pains: pains.trim(),
        sdrLogs: lead.logs || [],
        // Distribuição: já nasce atribuído ao closer da vez (fila).
        status: assignedCloser ? 'assigned' : 'available',
        assignedTo: assignedCloser,       // closer da vez
        queueIndex,                        // posição na fila quando criado
        closerName: null,                  // preenchido quando ACEITA
        secondCloser: null,                // segundo closer opcional
        passedBy: [],                      // closers que passaram a vez
        outcome: null,
        briefing: null,
        createdAt: serverTimestamp(),
      });

      const logs = appendLog(lead, { type: 'call_scheduled', by: sdrName, at: now, dealId: dealRef.id });
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'scheduled', dealId: dealRef.id,
        claimedBy: lead.claimedBy || sdrName, logs,
      });
      return { success: true, dealId: dealRef.id };
    } catch (err) { return { success: false, error: err.message }; }
  };

  return {
    leads, loading,
    addLead, addLeadsBulk, updateLead, deleteLead,
    claimLead, registerContact, markSemInteracao, scheduleFollowup,
    markCold, reopenLead, returnFromNoShow, scheduleCall,
  };
}

// ── Helpers ────────────────────────────────────────────────────
function appendLog(lead, entry) {
  return [...(lead.logs || []), { id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...entry }];
}

// Normaliza telefone para dígitos (formato wa.me). Mantém DDI se houver.
export function normalizePhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  return digits;
}
