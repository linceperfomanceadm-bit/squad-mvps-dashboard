import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Target, Snowflake, CalendarCheck, XCircle, MessageSquare,
  CheckSquare, Calendar, Phone, Clock, Send, X, Plus, Trash2, Edit2, Check,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import { SECTORS } from '../../lib/firebase';
import { useLeads } from '../../hooks/useLeads';
import { useSDRScripts, fillScript, waLink } from '../../hooks/useSDRScripts';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';

const COLOR = SECTORS.comercial.color; // #e879f9

export default function SDRDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    leads, loading,
    claimLead, logMessageSent, markLost, scheduleFollowup,
    markCold, reopenLead, scheduleCall,
  } = useLeads();
  const { scripts, addScript, updateScript, removeScript } = useSDRScripts(user?.authUid);

  const [page, setPage] = useState('queue');
  const [selectedId, setSelectedId] = useState(null);
  const [tick, setTick] = useState(0);

  // Reavalia follow-ups vencidos a cada minuto (faz o lead "voltar
  // sozinho" para a fila quando chega a hora, sem recarregar a página).
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const me = user?.name;
  const now = Date.now();

  // ── Particiona os leads por destino ─────────────────────────
  const buckets = useMemo(() => {
    const queue = [];   // fila ativa: não reivindicados OU meus, com tentativas
    const cold = [];    // meus frios manuais
    const scheduled = []; // meus agendados (viraram deals)
    const lost = [];    // meus perdidos
    for (const l of leads) {
      const mine = !l.claimedBy || l.claimedBy === me;
      // Follow-up vencido volta para a fila automaticamente.
      const followupDue = l.status === 'followup' && l.followupAt && new Date(l.followupAt).getTime() <= now;
      if ((l.status === 'queue' || followupDue) && mine && (l.attemptsLeft ?? 0) > 0) {
        queue.push({ ...l, _followupDue: followupDue });
      } else if (l.status === 'followup' && l.claimedBy === me) {
        // agendado para o futuro — aparece em "Frios/Agendados SDR" como follow-up pendente
        cold.push({ ...l, _pendingFollowup: true });
      } else if (l.status === 'cold' && l.claimedBy === me) {
        cold.push(l);
      } else if (l.status === 'scheduled' && l.claimedBy === me) {
        scheduled.push(l);
      } else if (l.status === 'lost' && l.claimedBy === me) {
        lost.push(l);
      }
    }
    // Ordena a fila: follow-ups vencidos primeiro, depois mais antigos.
    queue.sort((a, b) => (b._followupDue ? 1 : 0) - (a._followupDue ? 1 : 0));
    return { queue, cold, scheduled, lost };
  }, [leads, me, now, tick]);

  const selected = leads.find(l => l.id === selectedId) || null;

  const NAV = [
    { key: 'queue',     label: 'Fila de Leads', icon: Target,        badge: buckets.queue.length },
    { key: 'cold',      label: 'Frios / Follow-up', icon: Snowflake, badge: buckets.cold.length },
    { key: 'scheduled', label: 'Agendados',     icon: CalendarCheck, badge: buckets.scheduled.length },
    { key: 'lost',      label: 'Perdidos',      icon: XCircle },
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
            actions={{ claimLead, logMessageSent, markLost, scheduleFollowup, markCold, scheduleCall }}
            toast={toast}
            emptyMsg="Nenhum lead na fila agora. 🎯"
          />
        ) : page === 'cold' ? (
          <ColdView list={buckets.cold} onReopen={async (id) => { const r = await reopenLead(id, me); r.success ? toast('Lead reaberto na fila.') : toast(r.error, 'e'); }} now={now} />
        ) : page === 'scheduled' ? (
          <ScheduledView list={buckets.scheduled} />
        ) : page === 'lost' ? (
          <LostView list={buckets.lost} />
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
function SplitView({ title, subtitle, list, selected, onSelect, me, scripts, actions, toast, emptyMsg }) {
  return (
    <div className="fade-up">
      <Header title={title} subtitle={subtitle} count={list.length} />
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Fila */}
        <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
          {list.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '32px 16px' }}>{emptyMsg}</p>
          ) : list.map(lead => (
            <LeadRow key={lead.id} lead={lead} active={selected?.id === lead.id} onClick={() => onSelect(lead.id)} />
          ))}
        </div>
        {/* Detalhe */}
        <div>
          {selected
            ? <LeadDetail key={selected.id} lead={selected} me={me} scripts={scripts} actions={actions} toast={toast} onDone={() => onSelect(null)} />
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
        {lead._followupDue && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--amber)', fontFamily: 'var(--fm)', flexShrink: 0 }}>⏰ RETOMAR</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
        {lead.company && <span style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.company}</span>}
        <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', marginLeft: 'auto', flexShrink: 0 }}>
          {lead.attemptsLeft ?? 0} tent.
        </span>
      </div>
    </button>
  );
}

// ── Detalhe do lead: WhatsApp + logs rápidos ───────────────────
function LeadDetail({ lead, me, scripts, actions, toast, onDone }) {
  const [scriptId, setScriptId] = useState('');
  const [showFollowup, setShowFollowup] = useState(false);
  const [showCall, setShowCall] = useState(false);

  const phone = lead.phone || '';
  const activeScript = scripts.find(s => s.id === scriptId);
  const message = activeScript ? fillScript(activeScript.text, { leadName: lead.name, sdrName: me }) : '';

  const openWhatsApp = async () => {
    if (!phone) { toast('Lead sem telefone cadastrado.', 'e'); return; }
    window.open(waLink(phone, message), '_blank', 'noopener');
    // Abrir o WhatsApp já reivindica o lead (sem consumir tentativa).
    await actions.claimLead(lead.id, me);
  };

  const doMessageSent = async () => {
    const r = await actions.logMessageSent(lead.id, me);
    if (!r.success) { toast(r.error, 'e'); return; }
    if (r.exhausted) { toast('Tentativas esgotadas — lead movido para Perdidos.'); onDone(); }
    else toast('Mensagem registrada (−1 tentativa).');
  };

  const doLost = async () => {
    const r = await actions.markLost(lead.id, me);
    r.success ? (toast('Lead marcado como perdido.'), onDone()) : toast(r.error, 'e');
  };

  return (
    <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
      {/* Cabeçalho do lead */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>{lead.name || 'Sem nome'}</h2>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            {lead.company && <span style={{ fontSize: 12, color: 'var(--muted)' }}>🏢 {lead.company}</span>}
            {phone && <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>📱 {phone}</span>}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: `${COLOR}1a`, color: COLOR, fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>
          {lead.attemptsLeft ?? 0} tentativas
        </span>
      </div>

      {lead.notes && (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
          📝 {lead.notes}
        </div>
      )}

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

      {/* Logs rápidos */}
      <label style={LBL}>AÇÕES RÁPIDAS</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <button onClick={doMessageSent} style={{ ...BTN, ...BTN_SOFT }}><Send size={14} /> Mensagem Enviada</button>
        <button onClick={doLost} style={{ ...BTN, ...BTN_SOFT }}><XCircle size={14} /> Ignorou / Frio</button>
        <button onClick={() => setShowFollowup(true)} style={{ ...BTN, ...BTN_SOFT }}><Clock size={14} /> Aguardando Retorno</button>
        <button onClick={() => setShowCall(true)} style={{ ...BTN, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)`, color: '#fff' }}><CalendarCheck size={14} /> Call Agendada</button>
      </div>

      {showFollowup && ReactDOM.createPortal(
        <FollowupModal onClose={() => setShowFollowup(false)} onConfirm={async (iso) => {
          const r = await actions.scheduleFollowup(lead.id, me, iso);
          setShowFollowup(false);
          r.success ? (toast('Follow-up agendado.'), onDone()) : toast(r.error, 'e');
        }} />, document.body)}

      {showCall && ReactDOM.createPortal(
        <CallModal onClose={() => setShowCall(false)} onConfirm={async (data) => {
          const r = await actions.scheduleCall(lead.id, me, data);
          setShowCall(false);
          r.success ? (toast('Call agendada e enviada ao Closer! 🤝'), onDone()) : toast(r.error, 'e');
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
  const valid = datetime && pains.trim();
  return (
    <ModalShell title="Agendar call (enviar ao Closer)" onClose={onClose}>
      <label style={LBL}>DATA / HORA DA CALL *</label>
      <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} style={{ ...INP, marginTop: 6, marginBottom: 14 }} />
      <label style={LBL}>LINK DO MEET</label>
      <input value={meetLink} onChange={e => setMeetLink(e.target.value)} placeholder="https://meet.google.com/..." style={{ ...INP, marginTop: 6, marginBottom: 14 }} />
      <label style={LBL}>DORES MAPEADAS *</label>
      <textarea value={pains} onChange={e => setPains(e.target.value)} rows={4} placeholder="O que o lead trouxe de dor/necessidade..." style={{ ...INP, marginTop: 6, resize: 'vertical', fontFamily: 'var(--f)' }} />
      <button disabled={!valid} onClick={() => onConfirm({ datetime: new Date(datetime).toISOString(), meetLink, pains })} style={{ ...BTN, width: '100%', marginTop: 16, opacity: valid ? 1 : .5, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)`, color: '#fff' }}>
        <CalendarCheck size={15} /> Enviar para o Closer
      </button>
    </ModalShell>
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

function ScheduledView({ list }) {
  return (
    <div className="fade-up">
      <Header title="Agendados" subtitle="Calls que você enviou ao Closer" count={list.length} />
      {list.length === 0 ? <Empty msg="Nenhuma call agendada ainda." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
          {list.map(l => (
            <div key={l.id} style={CARD}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{l.name}</span>
              {l.company && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{l.company}</p>}
              <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--green-dim)', color: 'var(--green)', fontFamily: 'var(--fm)', marginTop: 8 }}>✓ ENVIADO AO CLOSER</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LostView({ list }) {
  return (
    <div className="fade-up">
      <Header title="Perdidos" subtitle="Leads arquivados" count={list.length} />
      {list.length === 0 ? <Empty msg="Nenhum lead perdido." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
          {list.map(l => (
            <div key={l.id} style={{ ...CARD, opacity: .6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{l.name}</span>
              {l.lostReason && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{l.lostReason}</p>}
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
