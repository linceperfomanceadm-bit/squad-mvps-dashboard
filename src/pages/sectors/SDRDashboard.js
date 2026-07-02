import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Target, Snowflake, CalendarCheck, XCircle, MessageSquare,
  CheckSquare, Calendar, Phone, Clock, Send, X, Plus, Trash2, Edit2, Check, RotateCcw,
  RefreshCw, Upload, Download, History, Eye,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import { SECTORS } from '../../lib/firebase';
import { useLeads, CONTACT_TYPES } from '../../hooks/useLeads';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useSDRScripts, fillScript, waLink } from '../../hooks/useSDRScripts';
import { parseCSV, mapRowsToLeads, LEADS_CSV_TEMPLATE } from '../../lib/csv';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';
 
const COLOR = SECTORS.comercial.color; // #e879f9
 
export default function SDRDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    leads, loading,
    claimLead, registerContact, markSemInteracao, scheduleFollowup,
    markCold, reopenLead, scheduleCall, addLeadsBulk,
  } = useLeads();
  const { collaborators } = useCollaborators();
  const { scripts, addScript, updateScript, removeScript } = useSDRScripts(user?.authUid);
 
  const [page, setPage] = useState('queue');
  const [selectedId, setSelectedId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showImport, setShowImport] = useState(false);
 
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
 
  const me = user?.name;
 
  // Closers ativos (para a fila rotativa ao agendar a call).
  const activeClosers = useMemo(
    () => collaborators.filter(c => c.sector === 'comercial' && c.active && c.commercialRole === 'closer').map(c => c.name),
    [collaborators]
  );
  const closersForQueue = activeClosers.length > 0
    ? activeClosers
    : collaborators.filter(c => c.sector === 'comercial' && c.active).map(c => c.name);
 
  // ── Particiona os leads por destino ─────────────────────────
  const buckets = useMemo(() => {
    const queue = [];
    const followupCold = [];
    const scheduled = [];
    const recoverable = [];
    const cold = [];
    for (const l of leads) {
      const mine = !l.claimedBy || l.claimedBy === me;
      const followupDue = l.status === 'followup' && l.followupAt && new Date(l.followupAt).getTime() <= now;
 
      if ((l.status === 'queue' || followupDue) && mine) {
        queue.push({ ...l, _followupDue: followupDue });
      } else if (l.status === 'followup' && l.claimedBy === me) {
        followupCold.push({ ...l, _pendingFollowup: true });
      } else if (l.status === 'recoverable' && (l.claimedBy === me || !l.claimedBy)) {
        recoverable.push(l);
      } else if (l.status === 'cold' && (l.claimedBy === me || !l.claimedBy)) {
        cold.push(l);
      } else if (l.status === 'scheduled' && l.claimedBy === me) {
        scheduled.push(l);
      }
    }
    queue.sort((a, b) => {
      const pa = (a.noShowFlag ? 2 : 0) + (a._followupDue ? 1 : 0);
      const pb = (b.noShowFlag ? 2 : 0) + (b._followupDue ? 1 : 0);
      return pb - pa;
    });
    return { queue, followupCold, scheduled, recoverable, cold };
  }, [leads, me, now]);
 
  const selected = leads.find(l => l.id === selectedId) || null;
 
  const NAV = [
    { key: 'queue',     label: 'Fila de Leads', icon: Target,        badge: buckets.queue.length },
    { key: 'followup',  label: 'Follow-up',     icon: Snowflake,     badge: buckets.followupCold.length },
    { key: 'scheduled', label: 'Agendados',     icon: CalendarCheck, badge: buckets.scheduled.length },
    { key: 'recoverable', label: 'Recuperáveis', icon: RefreshCw,    badge: buckets.recoverable.length },
    { key: 'cold',      label: 'Frios',         icon: XCircle,       badge: buckets.cold.length },
    { key: 'scripts',   label: 'Meus Scripts',  icon: MessageSquare },
    { key: 'todo',      label: 'Meu Dia',       icon: CheckSquare },
    { key: 'agenda',    label: 'Agenda',        icon: Calendar },
  ];
 
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="comercial" navItems={NAV} activeKey={page} onNav={(k) => { setPage(k); }} />
      <main style={{ flex: 1, marginLeft: 224, padding: 28, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? (
          <Spinner />
        ) : page === 'queue' ? (
          <SplitView
            title="Fila de Leads"
            subtitle="Leads disponíveis para prospecção"
            list={buckets.queue}
            selected={selected}
            onSelect={setSelectedId}
            me={me}
            scripts={scripts}
            closers={closersForQueue}
            actions={{ claimLead, registerContact, markSemInteracao, scheduleFollowup, markCold, scheduleCall }}
            toast={toast}
            emptyMsg="Nenhum lead na fila agora. 🎯"
            onImport={() => setShowImport(true)}
          />
        ) : page === 'followup' ? (
          <ColdView list={buckets.followupCold} onReopen={async (id) => { const r = await reopenLead(id, me); if (r.success) toast('Lead reaberto na fila.'); else toast(r.error, 'e'); }} now={now} />
        ) : page === 'scheduled' ? (
          <ScheduledView list={buckets.scheduled} onSelect={setSelectedId} selected={selected} me={me} scripts={scripts} />
        ) : page === 'recoverable' ? (
          <LostView list={buckets.recoverable} title="Recuperáveis" subtitle="Leads sem interação — recupere para a fila" onReopen={async (id) => { const r = await reopenLead(id, me); if (r.success) toast('Lead recuperado para a fila!'); else toast(r.error, 'e'); }} />
        ) : page === 'cold' ? (
          <LostView list={buckets.cold} title="Leads Frios" subtitle="Marcados como frios — recupere para a fila" showReason onReopen={async (id) => { const r = await reopenLead(id, me); if (r.success) toast('Lead recuperado para a fila!'); else toast(r.error, 'e'); }} />
        ) : page === 'scripts' ? (
          <ScriptsView scripts={scripts} addScript={addScript} updateScript={updateScript} removeScript={removeScript} toast={toast} />
        ) : page === 'todo' ? (
          <TodoView accent={COLOR} />
        ) : page === 'agenda' ? (
          <AgendaView />
        ) : (
          <StubView page={page} />
        )}
      </main>
      {showImport && (
        <ImportLeadsModal
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            const r = await addLeadsBulk(rows, me);
            if (r.success) { toast(`${r.count} leads importados!`); setShowImport(false); }
            else toast(r.error, 'e');
          }}
        />
      )}
    </div>
  );
}
 
function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );
}
 
function StubView({ page }) {
  const labels = { todo: 'Meu Dia', agenda: 'Agenda' };
  return (
    <div className="fade-up" style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{labels[page] || 'Em construção'}</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
        Esta seção chega num bloco dedicado ({page === 'todo' ? 'To-Do “Meu Dia”' : 'Agenda Google'}).
      </p>
    </div>
  );
}
 
// ════════════════════════════════════════════════════════════════
// SPLIT VIEW — fila à esquerda, detalhe do lead à direita
// ════════════════════════════════════════════════════════════════
function SplitView({ title, subtitle, list, selected, onSelect, me, scripts, actions, toast, emptyMsg, closers, onImport }) {
  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <Header title={title} subtitle={subtitle} count={list.length} />
        {onImport && (
          <button onClick={onImport} style={{ ...BTN, ...BTN_SOFT, whiteSpace: 'nowrap' }}>
            <Upload size={14} /> Importar planilha
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
          {list.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '32px 16px' }}>{emptyMsg}</p>
          ) : list.map(lead => (
            <LeadRow key={lead.id} lead={lead} active={selected?.id === lead.id} onClick={() => onSelect(lead.id)} />
          ))}
        </div>
        <div>
          {selected
            ? <LeadDetail key={selected.id} lead={selected} me={me} scripts={scripts} actions={actions} toast={toast} closers={closers} onDone={() => onSelect(null)} />
            : <div style={{ background: 'rgba(12,12,24,.6)', border: '1px dashed var(--border)', borderRadius: 14, padding: '60px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                Selecione um lead na fila para começar.
              </div>}
        </div>
      </div>
    </div>
  );
}
 
function Header({ title, subtitle, count }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-.5px' }}>{title}</h1>
        {typeof count === 'number' && (
          <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: `${COLOR}1a`, color: COLOR, fontFamily: 'var(--fm)' }}>{count}</span>
        )}
      </div>
      {subtitle && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</p>}
    </div>
  );
}
 
function LeadRow({ lead, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
      background: active ? `${COLOR}14` : 'transparent',
      borderLeft: active ? `2px solid ${COLOR}` : '2px solid transparent',
      borderBottom: '1px solid var(--border)', borderTop: 'none', borderRight: 'none',
      padding: '12px 14px', transition: 'background .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name || 'Sem nome'}</span>
        {lead.noShowFlag && <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', fontFamily: 'var(--fm)', flexShrink: 0 }}>🔁 REAGENDAR</span>}
        {!lead.noShowFlag && lead._followupDue && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--amber)', fontFamily: 'var(--fm)', flexShrink: 0 }}>⏰ RETOMAR</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
        {lead.company && <span style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.company}</span>}
        <span style={{ marginLeft: 'auto', flexShrink: 0 }}><AttemptsBadge left={lead.attemptsLeft ?? 0} compact /></span>
      </div>
    </button>
  );
}
 
// Sinalização forte das tentativas: verde → amarelo → vermelho.
function AttemptsBadge({ left, total = 10, compact = false }) {
  const ratio = left / total;
  const color = left <= 1 ? '#ef4444' : ratio <= 0.5 ? '#f59e0b' : '#22c55e';
  const label = left === 0 ? 'ESGOTADO' : `${left}/${total}`;
  if (compact) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, fontFamily: 'var(--fm)', color, padding: '2px 7px', borderRadius: 8, background: `${color}1f`, border: `1px solid ${color}55` }}>
        <span style={{ display: 'flex', gap: 2 }}>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} style={{ width: 4, height: 10, borderRadius: 2, background: i < left ? color : 'var(--border)' }} />
          ))}
        </span>
        {label}
      </span>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: `${color}14`, border: `1px solid ${color}44` }}>
      <span style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{ width: 8, height: 22, borderRadius: 3, background: i < left ? color : 'var(--border)', boxShadow: i < left ? `0 0 8px ${color}66` : 'none' }} />
        ))}
      </span>
      <div>
        <p style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{label === 'ESGOTADO' ? 'Esgotado' : `${left} de ${total}`}</p>
        <p style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', letterSpacing: '.08em', marginTop: 2 }}>TENTATIVAS RESTANTES</p>
      </div>
    </div>
  );
}
 
// ── Detalhe do lead: WhatsApp + ações ──────────────────────────
function LeadDetail({ lead, me, scripts, actions, toast, onDone, closers = [], readOnly = false }) {
  const [scriptId, setScriptId] = useState('');
  const [showFollowup, setShowFollowup] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showCold, setShowCold] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
 
  const phone = lead.phone || '';
  const activeScript = scripts.find(s => s.id === scriptId);
  const message = activeScript ? fillScript(activeScript.text, { leadName: lead.name, sdrName: me }) : '';
  const attemptsLeft = lead.attemptsLeft ?? 0;
  // "Sem Interação" só libera depois de esgotar as tentativas 1x.
  const canSemInteracao = attemptsLeft === 0 || lead.attemptsExhausted;
 
  const openWhatsApp = async () => {
    if (!phone) { toast('Lead sem telefone cadastrado.', 'e'); return; }
    window.open(waLink(phone, message), '_blank', 'noopener');
    await actions.claimLead(lead.id, me);
  };
 
  const doSemInteracao = async () => {
    const r = await actions.markSemInteracao(lead.id, me);
    if (r.success) { toast('Lead movido para Recuperáveis.'); onDone(); }
    else toast(r.error, 'e');
  };
 
  return (
    <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>{lead.name || 'Sem nome'}</h2>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            {lead.company && <span style={{ fontSize: 12, color: 'var(--muted)' }}>🏢 {lead.company}</span>}
            {phone && <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>📱 {phone}</span>}
          </div>
          {lead.recoveredFrom && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 10, fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.3)', borderRadius: 12, padding: '3px 9px' }}>
              <RefreshCw size={10} /> Recuperado de {lead.recoveredFrom}
            </span>
          )}
        </div>
        <AttemptsBadge left={attemptsLeft} />
      </div>
 
      {lead.noShowFlag && (
        <div style={{ background: '#ef444415', border: '1px solid #ef444444', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#fca5a5', lineHeight: 1.5 }}>
          🔁 Este lead voltou por <strong>no-show</strong> (não compareceu à call). Reagende uma nova call.
        </div>
      )}
 
      {lead.notes && (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
          📝 {lead.notes}
        </div>
      )}
 
      {/* Histórico de contatos */}
      {(lead.contactHistory?.length > 0) && (
        <button onClick={() => setShowHistory(true)} style={{ ...BTN, ...BTN_SOFT, width: '100%', marginBottom: 16, justifyContent: 'center' }}>
          <History size={14} /> Ver histórico de contatos ({lead.contactHistory.length})
        </button>
      )}
 
      {readOnly ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          📅 Call agendada para {lead.dealId ? 'este lead' : ''}. Este lead está agendado — sem ações disponíveis.
        </div>
      ) : (
        <>
          {/* 1-Click WhatsApp */}
          <div style={{ marginBottom: 18 }}>
            <label style={LBL}>SCRIPT (variáveis: {'{nome_lead}'}, {'{nome_sdr}'})</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <select value={scriptId} onChange={e => setScriptId(e.target.value)} style={{ ...SEL, flex: 1 }}>
                <option value="">Sem script (mensagem em branco)</option>
                {scripts.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            {message && (
              <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '10px 12px', marginTop: 8, fontSize: 12, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {message}
              </div>
            )}
            <button onClick={openWhatsApp} style={{ ...BTN, width: '100%', marginTop: 10, background: 'linear-gradient(135deg,#25D366,#128C7E)', boxShadow: '0 4px 16px rgba(37,211,102,.3)' }}>
              <Phone size={15} /> Abrir WhatsApp
            </button>
          </div>
 
          <label style={LBL}>AÇÕES RÁPIDAS</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <button onClick={() => setShowContact(true)} style={{ ...BTN, ...BTN_SOFT }}><Send size={14} /> Registrar Contato</button>
            <button onClick={canSemInteracao ? doSemInteracao : undefined} disabled={!canSemInteracao} title={canSemInteracao ? '' : 'Disponível após esgotar as tentativas'} style={{ ...BTN, ...BTN_SOFT, opacity: canSemInteracao ? 1 : .4, cursor: canSemInteracao ? 'pointer' : 'not-allowed' }}><XCircle size={14} /> Sem Interação</button>
            <button onClick={() => setShowCold(true)} style={{ ...BTN, ...BTN_SOFT }}><Snowflake size={14} /> Lead Frio</button>
            <button onClick={() => setShowCall(true)} style={{ ...BTN, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)`, color: '#fff' }}><CalendarCheck size={14} /> Call Agendada</button>
          </div>
        </>
      )}
 
      {showContact && ReactDOM.createPortal(
        <RegisterContactModal onClose={() => setShowContact(false)} onConfirm={async (data) => {
          const r = await actions.registerContact(lead.id, me, data);
          setShowContact(false);
          if (!r.success) { toast(r.error, 'e'); return; }
          if (r.exhausted) toast('Tentativas esgotadas — já pode marcar "Sem Interação".');
          else toast('Contato registrado (−1 tentativa).');
        }} />, document.body)}
 
      {showCold && ReactDOM.createPortal(
        <ColdReasonModal onClose={() => setShowCold(false)} onConfirm={async (reason) => {
          const r = await actions.markCold(lead.id, me, reason);
          setShowCold(false);
          if (r.success) { toast('Lead marcado como frio.'); onDone(); }
          else toast(r.error, 'e');
        }} />, document.body)}
 
      {showHistory && ReactDOM.createPortal(
        <HistoryModal lead={lead} onClose={() => setShowHistory(false)} />, document.body)}
 
      {showFollowup && ReactDOM.createPortal(
        <FollowupModal onClose={() => setShowFollowup(false)} onConfirm={async (iso) => {
          const r = await actions.scheduleFollowup(lead.id, me, iso);
          setShowFollowup(false);
          if (r.success) { toast('Follow-up agendado.'); onDone(); }
          else toast(r.error, 'e');
        }} />, document.body)}
 
      {showCall && ReactDOM.createPortal(
        <CallModal onClose={() => setShowCall(false)} onConfirm={async (data) => {
          const r = await actions.scheduleCall(lead.id, me, data, closers);
          setShowCall(false);
          if (r.success) { toast('Call agendada e enviada ao Closer! 🤝'); onDone(); }
          else toast(r.error, 'e');
        }} />, document.body)}
    </div>
  );
}
 
// ════════════════════════════════════════════════════════════════
// MODAIS
// ════════════════════════════════════════════════════════════════
function ModalShell({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.98)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={15} color="var(--muted)" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
 
function FollowupModal({ onClose, onConfirm }) {
  const [dt, setDt] = useState('');
  return (
    <ModalShell title="Agendar follow-up" onClose={onClose}>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
        O lead sai da fila e volta automaticamente na data/hora escolhida.
      </p>
      <label style={LBL}>QUANDO RETOMAR</label>
      <input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)} style={{ ...INP, marginTop: 6 }} />
      <button disabled={!dt} onClick={() => onConfirm(new Date(dt).toISOString())} style={{ ...BTN, width: '100%', marginTop: 16, opacity: dt ? 1 : .5, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)`, color: '#fff' }}>
        <Clock size={15} /> Agendar
      </button>
    </ModalShell>
  );
}
 
function CallModal({ onClose, onConfirm }) {
  const [datetime, setDatetime] = useState('');
  const [meetLink, setMeetLink] = useState('');
  const [pains, setPains] = useState('');
  const painsLen = pains.trim().length;
  const valid = datetime && painsLen >= 150;
  return (
    <ModalShell title="Agendar call (enviar ao Closer)" onClose={onClose}>
      <label style={LBL}>DATA / HORA DA CALL *</label>
      <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} style={{ ...INP, marginTop: 6, marginBottom: 14 }} />
      <label style={LBL}>LINK DO MEET</label>
      <input value={meetLink} onChange={e => setMeetLink(e.target.value)} placeholder="https://meet.google.com/..." style={{ ...INP, marginTop: 6, marginBottom: 14 }} />
      <label style={LBL}>DORES MAPEADAS * <span style={{ color: painsLen >= 150 ? 'var(--green)' : 'var(--muted)', fontWeight: 400 }}>({painsLen}/150 mín.)</span></label>
      <textarea value={pains} onChange={e => setPains(e.target.value)} rows={5} placeholder="Descreva em detalhe as dores e necessidades do lead (mínimo 150 caracteres). Isso ajuda o Closer a se preparar para a call..." style={{ ...INP, marginTop: 6, resize: 'vertical', fontFamily: 'var(--f)' }} />
      <button disabled={!valid} onClick={() => onConfirm({ datetime: new Date(datetime).toISOString(), meetLink, pains })} style={{ ...BTN, width: '100%', marginTop: 16, opacity: valid ? 1 : .5, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)`, color: '#fff' }}>
        <CalendarCheck size={15} /> Enviar para o Closer
      </button>
    </ModalShell>
  );
}
 
// Registrar contato: tipo + se teve retorno + nota.
function RegisterContactModal({ onClose, onConfirm }) {
  const [contactType, setContactType] = useState('');
  const [hadReturn, setHadReturn] = useState(false);
  const [note, setNote] = useState('');
  return (
    <ModalShell title="Registrar contato" onClose={onClose}>
      <label style={LBL}>TIPO DE CONTATO *</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 14 }}>
        {CONTACT_TYPES.map(t => (
          <button key={t.id} type="button" onClick={() => setContactType(t.id)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 16, cursor: 'pointer', background: contactType === t.id ? `${COLOR}22` : 'var(--surface)', color: contactType === t.id ? COLOR : 'var(--muted)', border: `1px solid ${contactType === t.id ? `${COLOR}66` : 'var(--border)'}` }}>{t.label}</button>
        ))}
      </div>
      <label style={LBL}>TEVE RETORNO DO LEAD?</label>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 14 }}>
        <button type="button" onClick={() => setHadReturn(true)} style={{ flex: 1, ...BTN, ...(hadReturn ? { background: 'var(--green)', color: '#08110a' } : BTN_SOFT) }}>Sim</button>
        <button type="button" onClick={() => setHadReturn(false)} style={{ flex: 1, ...BTN, ...(!hadReturn ? { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' } : BTN_SOFT) }}>Não</button>
      </div>
      <label style={LBL}>OBSERVAÇÃO (opcional)</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Detalhe do contato..." style={{ ...INP, marginTop: 6, resize: 'vertical', fontFamily: 'var(--f)' }} />
      <button disabled={!contactType} onClick={() => onConfirm({ contactType, hadReturn, note })} style={{ ...BTN, width: '100%', marginTop: 16, opacity: contactType ? 1 : .5, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)`, color: '#fff' }}>
        <Send size={15} /> Registrar (−1 tentativa)
      </button>
    </ModalShell>
  );
}
 
// Lead frio: motivo obrigatório.
function ColdReasonModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <ModalShell title="Marcar como Lead Frio" onClose={onClose}>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
        O lead vai para a aba "Frios". Informe por que está esfriando este lead.
      </p>
      <label style={LBL}>MOTIVO *</label>
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Ex: sem orçamento no momento, fora do perfil, pediu para retornar em 6 meses..." style={{ ...INP, marginTop: 6, resize: 'vertical', fontFamily: 'var(--f)' }} />
      <button disabled={!reason.trim()} onClick={() => onConfirm(reason)} style={{ ...BTN, width: '100%', marginTop: 16, opacity: reason.trim() ? 1 : .5, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)`, color: '#fff' }}>
        <Snowflake size={15} /> Marcar como Frio
      </button>
    </ModalShell>
  );
}
 
// Histórico de contatos do lead.
function HistoryModal({ lead, onClose }) {
  const hist = [...(lead.contactHistory || [])].reverse();
  const typeLabel = (id) => (CONTACT_TYPES.find(t => t.id === id)?.label || id);
  return (
    <ModalShell title={`Histórico — ${lead.name}`} onClose={onClose}>
      {hist.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum contato registrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflow: 'auto' }}>
          {hist.map((h, i) => (
            <div key={h.id || i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{typeLabel(h.type)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: h.hadReturn ? 'var(--green)' : 'var(--muted)' }}>{h.hadReturn ? '✓ teve retorno' : 'sem retorno'}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>
                {h.by} · {new Date(h.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              {h.note && <p style={{ fontSize: 12, color: 'var(--text)', marginTop: 6, lineHeight: 1.5 }}>{h.note}</p>}
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
 
// Importar leads via planilha (CSV).
function ImportLeadsModal({ onClose, onImport }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
 
  const handleFile = (e) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCSV(String(reader.result));
        const mapped = mapRowsToLeads(parsed.rows);
        if (mapped.length === 0) { setError('Nenhum lead válido encontrado. Confira se há colunas nome e telefone.'); setRows([]); return; }
        setRows(mapped);
      } catch {
        setError('Não consegui ler o arquivo. Salve como CSV e tente de novo.');
        setRows([]);
      }
    };
    reader.readAsText(file, 'utf-8');
  };
 
  const downloadTemplate = () => {
    const blob = new Blob([LEADS_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modelo-leads.csv'; a.click();
    URL.revokeObjectURL(url);
  };
 
  return ReactDOM.createPortal(
    <ModalShell title="Importar leads por planilha" onClose={onClose}>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Monte sua planilha no Excel ou Google Sheets com as colunas <strong>nome, telefone, empresa, observacao</strong> e salve como <strong>CSV</strong>. Depois envie aqui.
      </p>
      <button onClick={downloadTemplate} style={{ ...BTN, ...BTN_SOFT, width: '100%', marginBottom: 12, justifyContent: 'center' }}>
        <Download size={14} /> Baixar modelo de planilha
      </button>
      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '22px', border: '1px dashed var(--border)', borderRadius: 12, cursor: 'pointer' }}>
        <Upload size={22} color={COLOR} />
        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{fileName || 'Escolher arquivo CSV'}</span>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
      </label>
      {error && <p style={{ fontSize: 12, color: 'var(--neon)', marginTop: 12 }}>{error}</p>}
      {rows.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>{rows.length} leads prontos para importar</p>
          <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {rows.slice(0, 20).map((r, i) => (
              <div key={i} style={{ padding: '7px 11px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text)' }}>
                <strong>{r.name || '(sem nome)'}</strong> <span style={{ color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{r.phone}</span>{r.company ? ` · ${r.company}` : ''}
              </div>
            ))}
            {rows.length > 20 && <div style={{ padding: '7px 11px', fontSize: 11, color: 'var(--muted)' }}>+{rows.length - 20} outros...</div>}
          </div>
          <button onClick={() => onImport(rows)} style={{ ...BTN, width: '100%', marginTop: 14, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)`, color: '#fff' }}>
            <Upload size={15} /> Importar {rows.length} leads
          </button>
        </div>
      )}
    </ModalShell>,
    document.body
  );
}
 
// ════════════════════════════════════════════════════════════════
// VIEWS AUXILIARES
// ════════════════════════════════════════════════════════════════
function ColdView({ list, onReopen, now }) {
  return (
    <div className="fade-up">
      <Header title="Frios / Follow-up" subtitle="Leads parados ou aguardando retorno futuro" count={list.length} />
      {list.length === 0 ? <Empty msg="Nada por aqui." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
          {list.map(l => {
            const future = l._pendingFollowup && l.followupAt;
            return (
              <div key={l.id} style={CARD}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{l.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, fontFamily: 'var(--fm)', background: future ? 'var(--amber-dim)' : 'var(--surface)', color: future ? 'var(--amber)' : 'var(--muted)' }}>
                    {future ? 'AGENDADO' : 'FRIO'}
                  </span>
                </div>
                {l.company && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{l.company}</p>}
                {future && <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 6, fontFamily: 'var(--fm)' }}>⏰ {new Date(l.followupAt).toLocaleString('pt-BR')}</p>}
                <button onClick={() => onReopen(l.id)} style={{ ...BTN, ...BTN_SOFT, width: '100%', marginTop: 12, fontSize: 12 }}>Reabrir na fila</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
 
function ScheduledView({ list, onSelect, selected, me, scripts }) {
  return (
    <div className="fade-up">
      <Header title="Agendados" subtitle="Calls que você enviou ao Closer — clique para ver o lead completo" count={list.length} />
      {list.length === 0 ? <Empty msg="Nenhuma call agendada ainda." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
            {list.map(l => (
              <div key={l.id} onClick={() => onSelect(l.id)} style={{ padding: '13px 15px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selected?.id === l.id ? 'rgba(255,255,255,.04)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{l.name}</span>
                  <Eye size={13} color="var(--muted)" />
                </div>
                {l.company && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{l.company}</p>}
                <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: 'var(--green-dim)', color: 'var(--green)', fontFamily: 'var(--fm)', marginTop: 6 }}>✓ AGENDADO</span>
              </div>
            ))}
          </div>
          <div>
            {selected
              ? <LeadDetail key={selected.id} lead={selected} me={me} scripts={scripts} actions={{}} toast={() => {}} onDone={() => onSelect(null)} readOnly />
              : <div style={{ background: 'rgba(12,12,24,.6)', border: '1px dashed var(--border)', borderRadius: 14, padding: '60px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Clique num lead agendado para visualizar os detalhes.
                </div>}
          </div>
        </div>
      )}
    </div>
  );
}
 
function LostView({ list, onReopen, title = 'Recuperáveis', subtitle = '', showReason = false }) {
  return (
    <div className="fade-up">
      <Header title={title} subtitle={subtitle} count={list.length} />
      {list.length === 0 ? <Empty msg="Nenhum lead aqui." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
          {list.map(l => (
            <div key={l.id} style={{ ...CARD }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{l.name}</span>
                {l.recoveredFrom && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, fontFamily: 'var(--fm)', background: 'rgba(56,189,248,.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,.3)' }}>RECUP.</span>
                )}
              </div>
              {l.company && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{l.company}</p>}
              {showReason && l.coldReason && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>❄ {l.coldReason}</p>}
              <button onClick={() => onReopen(l.id)} style={{ ...BTN, width: '100%', marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}>
                <RotateCcw size={13} /> Recuperar para a fila
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
 
function ScriptsView({ scripts, addScript, updateScript, removeScript, toast }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [editId, setEditId] = useState(null);
 
  const submit = async () => {
    if (!title.trim() || !text.trim()) { toast('Preencha título e texto.', 'e'); return; }
    if (editId) { await updateScript(editId, { title, text }); setEditId(null); }
    else { await addScript(title, text); }
    setTitle(''); setText('');
  };
 
  return (
    <div className="fade-up">
      <Header title="Meus Scripts" subtitle="Modelos de mensagem com variáveis {nome_lead} e {nome_sdr}" />
      <div style={{ ...CARD, marginBottom: 20 }}>
        <label style={LBL}>TÍTULO</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Primeira abordagem" style={{ ...INP, marginTop: 6, marginBottom: 12 }} />
        <label style={LBL}>MENSAGEM</label>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Oi {nome_lead}, aqui é o {nome_sdr} da agência..." style={{ ...INP, marginTop: 6, resize: 'vertical', fontFamily: 'var(--f)' }} />
        <button onClick={submit} style={{ ...BTN, marginTop: 12, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)`, color: '#fff' }}>
          {editId ? <><Check size={14} /> Salvar alterações</> : <><Plus size={14} /> Adicionar script</>}
        </button>
        {editId && <button onClick={() => { setEditId(null); setTitle(''); setText(''); }} style={{ ...BTN, ...BTN_SOFT, marginTop: 8 }}>Cancelar edição</button>}
      </div>
 
      {scripts.length === 0 ? <Empty msg="Você ainda não criou scripts." /> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {scripts.map(s => (
            <div key={s.id} style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{s.title}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditId(s.id); setTitle(s.title); setText(s.text); }} style={ICON_BTN}><Edit2 size={13} /></button>
                  <button onClick={() => removeScript(s.id)} style={ICON_BTN}><Trash2 size={13} color="rgba(238,51,99,.6)" /></button>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{s.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
 
function Empty({ msg }) {
  return <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>{msg}</p>;
}
 
// ── Estilos compartilhados ─────────────────────────────────────
const LBL = { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' };
const INP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' };
const SEL = { ...INP, background: '#12121f', cursor: 'pointer' };
const BTN = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 9, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff', width: '100%' };
const BTN_SOFT = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' };
const CARD = { background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 };
const ICON_BTN = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' };
