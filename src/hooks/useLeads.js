import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export const DEFAULT_ATTEMPTS = 5;

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
  const addLeadsBulk = async (rows) => {
    try {
      const valid = rows.filter(r => (r.name || '').trim() || (r.phone || '').trim());
      if (!valid.length) return { success: false, error: 'Nenhum lead válido para importar.' };
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

  // ── SDR: log "Mensagem Enviada" (consome 1 tentativa) ────────
  const logMessageSent = async (leadId, sdrName) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead não encontrado');
      const now = new Date().toISOString();
      const left = Math.max(0, (lead.attemptsLeft ?? DEFAULT_ATTEMPTS) - 1);
      const logs = appendLog(lead, { type: 'message_sent', by: sdrName, at: now });
      const patch = {
        claimedBy: lead.claimedBy || sdrName,
        claimedAt: lead.claimedAt || now,
        attemptsLeft: left,
        logs,
      };
      // Esgotou tentativas → perdido (arquivado).
      if (left === 0) { patch.status = 'lost'; patch.lostReason = 'Tentativas esgotadas'; patch.lostAt = now; }
      await updateDoc(doc(db, 'leads', leadId), patch);
      return { success: true, exhausted: left === 0 };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── SDR: "Ignorou / Frio" → perdido ──────────────────────────
  const markLost = async (leadId, sdrName, reason = 'Ignorou / Frio') => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead não encontrado');
      const now = new Date().toISOString();
      const logs = appendLog(lead, { type: 'lost', by: sdrName, reason, at: now });
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'lost', lostReason: reason, lostAt: now,
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

  // ── SDR: marcar frio manual (aba Frios, reabre manualmente) ──
  const markCold = async (leadId, sdrName) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead não encontrado');
      const now = new Date().toISOString();
      const logs = appendLog(lead, { type: 'cold', by: sdrName, at: now });
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'cold', claimedBy: lead.claimedBy || sdrName, logs,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── SDR: reabrir lead (followup vencido ou frio) → fila ──────
  const reopenLead = async (leadId, sdrName) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead não encontrado');
      const now = new Date().toISOString();
      const logs = appendLog(lead, { type: 'reopened', by: sdrName, at: now });
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'queue', followupAt: null, logs,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── SDR: Call Agendada → cria deal (base do Closer) ──────────
  const scheduleCall = async (leadId, sdrName, { datetime, meetLink, pains }) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead não encontrado');
      const now = new Date().toISOString();

      // 1. Cria o deal que o Closer vai consumir.
      const dealRef = await addDoc(collection(db, 'deals'), {
        leadId,
        leadName: lead.name,
        leadPhone: lead.phone || '',
        company: lead.company || '',
        sdrName,
        // Dados mapeados pelo SDR (read-only para o Closer no Showtime).
        callAt: datetime,
        meetLink: (meetLink || '').trim(),
        pains: (pains || '').trim(),
        sdrLogs: lead.logs || [],
        // Estado do Closer (preenchido nos blocos seguintes).
        status: 'scheduled', // scheduled → won/lost/noshow/standby (Closer)
        closerName: null,
        outcome: null,
        briefing: null,
        createdAt: serverTimestamp(),
      });

      // 2. Marca o lead como agendado (sai das filas do SDR).
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
    claimLead, logMessageSent, markLost, scheduleFollowup,
    markCold, reopenLead, scheduleCall,
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
