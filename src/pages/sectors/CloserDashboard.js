import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  LayoutDashboard, Briefcase, CheckSquare, Calendar, MessageSquare,
  Phone, Clock, Video, X, Plus, Trash2, Edit2, Check, ChevronDown, Bold, List,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import { SECTORS } from '../../lib/firebase';
import { useDeals } from '../../hooks/useDeals';
import { useCommercialGoals, useObjections, countWonThisMonth } from '../../hooks/useCloserData';
import BriefingForm from '../../components/commercial/BriefingForm';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';

const COLOR = SECTORS.comercial.color;

export default function CloserDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { deals, loading, claimDeal, closeNoShow, closeLost, closeStandby, closeWon, saveCallNotes } = useDeals();
  const { goals } = useCommercialGoals();
  const objections = useObjections(user?.authUid);

  const [page, setPage] = useState('cockpit');
  const [showtimeDealId, setShowtimeDealId] = useState(null);

  const me = user?.name;

  // Deals deste closer (ou ainda sem closer = disponíveis).
  const myDeals = useMemo(
    () => deals.filter(d => !d.closerName || d.closerName === me),
    [deals, me]
  );
  const todayCalls = useMemo(() => myDeals.filter(d => d.status === 'scheduled'), [myDeals]);
  const funnel = useMemo(() => myDeals.filter(d => ['scheduled', 'standby'].includes(d.status)), [myDeals]);

  const wonMe = countWonThisMonth(deals, me);
  const wonTeam = countWonThisMonth(deals);
  const goalMe = goals.individual?.[me] || 0;
  const goalTeam = goals.teamGoal || 0;

  const enterShowtime = async (dealId) => {
    await claimDeal(dealId, me);
    setShowtimeDealId(dealId);
  };

  const showtimeDeal = deals.find(d => d.id === showtimeDealId) || null;

  const NAV = [
    { key: 'cockpit', label: 'Cockpit',    icon: LayoutDashboard, badge: todayCalls.length },
    { key: 'funnel',  label: 'Meu Funil',  icon: Briefcase },
    { key: 'objections', label: 'Objeções', icon: MessageSquare },
    { key: 'todo',    label: 'Meu Dia',    icon: CheckSquare },
    { key: 'agenda',  label: 'Agenda',     icon: Calendar },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="comercial" navItems={NAV} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 28, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? <Spinner /> :
          page === 'cockpit' ? (
            <Cockpit
              me={me} todayCalls={todayCalls} funnel={funnel}
              wonMe={wonMe} goalMe={goalMe} wonTeam={wonTeam} goalTeam={goalTeam}
              onEnterCall={enterShowtime}
            />
          ) : page === 'funnel' ? (
            <FunnelView funnel={funnel} onEnterCall={enterShowtime} />
          ) : page === 'objections' ? (
            <ObjectionsView {...objections} toast={toast} />
          ) : page === 'todo' ? (
            <TodoView accent={COLOR} />
          ) : page === 'agenda' ? (
            <AgendaView />
          ) : (
            <StubView page={page} />
          )}
      </main>

      {/* Modo Showtime — sobrepõe tudo */}
      {showtimeDeal && ReactDOM.createPortal(
        <Showtime
          deal={showtimeDeal} me={me} objections={objections.items}
          onSaveNotes={saveCallNotes}
          onClose={() => setShowtimeDealId(null)}
          actions={{ closeNoShow, closeLost, closeStandby, closeWon }}
          toast={toast}
        />, document.body)}
    </div>
  );
}

function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner" style={{ width: 36, height: 36 }} /></div>;
}

function StubView({ page }) {
  const labels = { todo: 'Meu Dia', agenda: 'Agenda' };
  return (
    <div className="fade-up" style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{labels[page] || 'Em construção'}</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>Esta seção chega num bloco dedicado.</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COCKPIT
// ════════════════════════════════════════════════════════════════
function Cockpit({ me, todayCalls, funnel, wonMe, goalMe, wonTeam, goalTeam, onEnterCall }) {
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${COLOR}1a`, color: COLOR, border: `1px solid ${COLOR}40`, fontFamily: 'var(--fm)' }}>🤝 CLOSER</span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 10 }}>Olá, {me}</h1>
      </div>

      {/* Metas (sem R$) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 26 }}>
        <GoalBar label="Meta Individual (mês)" value={wonMe} goal={goalMe} color={COLOR} />
        <GoalBar label="Meta da Equipe (mês)" value={wonTeam} goal={goalTeam} color="#38bdf8" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Calls de hoje */}
        <div>
          <h2 style={SEC_TITLE}>Calls de Hoje</h2>
          {todayCalls.length === 0 ? <Empty msg="Nenhuma call agendada." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {todayCalls.map(d => (
                <div key={d.id} style={CARD}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{d.leadName}</span>
                    {d.callAt && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{new Date(d.callAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  {d.company && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{d.company}</p>}
                  <button onClick={() => onEnterCall(d.id)} style={{ ...BTN_BIG, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)` }}>
                    <Video size={18} /> Entrar na Call
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mini-funil */}
        <div>
          <h2 style={SEC_TITLE}>Meu Funil</h2>
          {funnel.length === 0 ? <Empty msg="Funil vazio." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {funnel.map(d => (
                <div key={d.id} style={{ ...CARD, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.leadName}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>{STATUS_PT[d.status] || d.status}</p>
                  </div>
                  {d.status === 'standby' && d.standbyAt && <span style={{ fontSize: 10, color: 'var(--amber)', fontFamily: 'var(--fm)' }}>⏰</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalBar({ label, value, goal, color }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'var(--fm)' }}>{value}<span style={{ fontSize: 13, color: 'var(--muted)' }}> / {goal || '—'}</span></span>
      </div>
      <div style={{ height: 10, borderRadius: 6, background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${color},${color}aa)`, borderRadius: 6, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

function FunnelView({ funnel, onEnterCall }) {
  return (
    <div className="fade-up">
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 18 }}>Meu Funil</h1>
      {funnel.length === 0 ? <Empty msg="Nenhum deal ativo." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
          {funnel.map(d => (
            <div key={d.id} style={CARD}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{d.leadName}</span>
              {d.company && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{d.company}</p>}
              <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--surface)', color: 'var(--muted)', fontFamily: 'var(--fm)', marginTop: 8 }}>{STATUS_PT[d.status] || d.status}</span>
              {d.status === 'scheduled' && (
                <button onClick={() => onEnterCall(d.id)} style={{ ...BTN_BIG, marginTop: 12, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)`, fontSize: 13, padding: '9px' }}><Video size={15} /> Entrar na Call</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_PT = { scheduled: 'Call agendada', standby: 'Stand-by', won: 'Ganho', lost: 'Perdido', noshow: 'No-show', awaiting_cs: 'Aguardando CS', active: 'Cliente ativo' };
const SEC_TITLE = { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 };
const CARD = { background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 };
const BTN_BIG = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff', width: '100%' };
function Empty({ msg }) { return <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>{msg}</p>; }

// ════════════════════════════════════════════════════════════════
// MODO SHOWTIME
// ════════════════════════════════════════════════════════════════
function Showtime({ deal, me, objections, onSaveNotes, onClose, actions, toast }) {
  const [elapsed, setElapsed] = useState(0);
  const [showClose, setShowClose] = useState(false);
  const notesRef = React.useRef(null);
  const savedRef = React.useRef(deal.callNotes || '');

  // Cronômetro.
  React.useEffect(() => {
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Autosave das anotações a cada 5s (se mudou).
  React.useEffect(() => {
    const id = setInterval(() => {
      const html = notesRef.current?.innerHTML || '';
      if (html !== savedRef.current) { savedRef.current = html; onSaveNotes(deal.id, html); }
    }, 5000);
    return () => clearInterval(id);
  }, [deal.id, onSaveNotes]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const exec = (cmd) => { document.execCommand(cmd, false, null); notesRef.current?.focus(); };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#07070e', zIndex: 1200, display: 'flex', flexDirection: 'column' }}>
      {/* Sticky header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: `1px solid ${COLOR}30`, background: 'rgba(12,12,24,.96)', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.leadName}</h2>
          {deal.company && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{deal.company}</p>}
        </div>
        {deal.meetLink && (
          <a href={deal.meetLink} target="_blank" rel="noopener noreferrer" style={{ ...BTN_BIG, width: 'auto', padding: '9px 16px', fontSize: 13, background: 'linear-gradient(135deg,#22c55e,#16a34a)', textDecoration: 'none' }}>
            <Video size={15} /> Abrir Meet
          </a>
        )}
        <div style={{ fontSize: 18, fontWeight: 800, color: COLOR, fontFamily: 'var(--fm)', minWidth: 70, textAlign: 'center' }}>{fmt(elapsed)}</div>
        <button onClick={() => setShowClose(true)} style={{ ...BTN_BIG, width: 'auto', padding: '9px 18px', fontSize: 13, background: 'linear-gradient(135deg,var(--neon),#c41f4a)' }}>
          Encerrar Call
        </button>
      </div>

      {/* Corpo: 3 colunas */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr 320px', overflow: 'hidden' }}>
        {/* Esquerda: dados do SDR (read-only) */}
        <div style={{ borderRight: '1px solid var(--border)', padding: 20, overflowY: 'auto' }}>
          <h3 style={ST_H}>Mapeado pelo SDR</h3>
          {deal.sdrName && <Info label="SDR" value={deal.sdrName} />}
          {deal.callAt && <Info label="Agendada para" value={new Date(deal.callAt).toLocaleString('pt-BR')} />}
          <div style={{ marginTop: 14 }}>
            <p style={ST_LBL}>DORES</p>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginTop: 4, whiteSpace: 'pre-wrap' }}>{deal.pains || '—'}</p>
          </div>
          {deal.sdrLogs?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={ST_LBL}>HISTÓRICO</p>
              {deal.sdrLogs.slice(-6).map((l, i) => (
                <p key={i} style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, fontFamily: 'var(--fm)' }}>· {logLabel(l)}</p>
              ))}
            </div>
          )}
        </div>

        {/* Centro: rich text */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <h3 style={{ ...ST_H, margin: 0 }}>Anotações da Call</h3>
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              <button onClick={() => exec('bold')} style={RT_BTN} title="Negrito"><Bold size={14} /></button>
              <button onClick={() => exec('italic')} style={{ ...RT_BTN, fontStyle: 'italic', fontWeight: 700 }} title="Itálico">I</button>
              <button onClick={() => exec('insertUnorderedList')} style={RT_BTN} title="Lista"><List size={14} /></button>
            </div>
          </div>
          <div
            ref={notesRef}
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: deal.callNotes || '' }}
            style={{ flex: 1, background: 'rgba(12,12,24,.6)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, color: 'var(--text)', fontSize: 14, lineHeight: 1.7, outline: 'none', overflowY: 'auto' }}
          />
        </div>

        {/* Direita: Máquina de Objeções (accordion) */}
        <div style={{ borderLeft: '1px solid var(--border)', padding: 20, overflowY: 'auto' }}>
          <h3 style={ST_H}>Máquina de Objeções</h3>
          {objections.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Cadastre objeções na aba "Objeções" do seu painel.</p>
            : objections.map(o => <Accordion key={o.id} item={o} />)}
        </div>
      </div>

      {showClose && (
        <CloseModal
          deal={deal} me={me} actions={actions} toast={toast}
          onClose={() => setShowClose(false)}
          onDone={() => { setShowClose(false); onClose(); }}
        />
      )}
    </div>
  );
}

function Info({ label, value }) {
  return <div style={{ marginBottom: 8 }}><p style={ST_LBL}>{label.toUpperCase()}</p><p style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>{value}</p></div>;
}
function Accordion({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 8 }}>
      <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '6px 0' }}>
        <ChevronDown size={14} color="var(--muted)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.objection}</span>
      </button>
      {open && <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, padding: '4px 0 6px 22px', whiteSpace: 'pre-wrap' }}>{item.response}</p>}
    </div>
  );
}
function logLabel(l) {
  const map = { message_sent: 'Mensagem enviada', followup: 'Follow-up agendado', cold: 'Marcado frio', call_scheduled: 'Call agendada', reopened: 'Reaberto', lost: 'Perdido' };
  return map[l.type] || l.type;
}

const ST_H = { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' };
const ST_LBL = { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' };
const RT_BTN = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center' };

// ════════════════════════════════════════════════════════════════
// MODAL DE ENCERRAMENTO (forçado)
// ════════════════════════════════════════════════════════════════
function CloseModal({ deal, me, actions, toast, onClose, onDone }) {
  const [outcome, setOutcome] = useState(null); // noshow | lost | standby | won
  const [lostReason, setLostReason] = useState('');
  const [standbyAt, setStandbyAt] = useState('');

  const confirm = async () => {
    let r;
    if (outcome === 'noshow') r = await actions.closeNoShow(deal.id, me);
    else if (outcome === 'lost') {
      if (!lostReason.trim()) { toast('Informe o motivo da perda.', 'e'); return; }
      r = await actions.closeLost(deal.id, me, lostReason);
    } else if (outcome === 'standby') {
      if (!standbyAt) { toast('Defina data/hora do retorno.', 'e'); return; }
      r = await actions.closeStandby(deal.id, me, new Date(standbyAt).toISOString());
    }
    if (r?.success) { toast('Call encerrada.'); onDone(); }
    else if (r) toast(r.error, 'e');
  };

  const submitBriefing = async (briefing) => {
    const r = await actions.closeWon(deal.id, me, briefing);
    if (r.success) { toast('Venda registrada! Enviado para o CS. 🎉'); onDone(); }
    else toast(r.error, 'e');
  };

  // Briefing ocupa o modal inteiro quando outcome = won.
  if (outcome === 'won') {
    return (
      <Overlay onClose={null}>
        <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.98)', border: `1px solid ${COLOR}40`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Briefing — {deal.leadName}</h3>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Preencha tudo para enviar ao CS. Campos obrigatórios travam o envio.</p>
          <BriefingForm
            initial={{ companyName: deal.company || '', contactName: deal.leadName || '', contactPhone: deal.leadPhone || '', pains: deal.pains || '' }}
            onSubmit={submitBriefing}
            onCancel={() => setOutcome(null)}
          />
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.98)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Resultado da Call</h3>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={15} color="var(--muted)" /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>Escolha um resultado para encerrar.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <OutcomeBtn active={outcome === 'won'} onClick={() => setOutcome('won')} color="#22c55e" label="✅ Ganho" />
          <OutcomeBtn active={outcome === 'lost'} onClick={() => setOutcome('lost')} color="var(--neon)" label="❌ Perdido" />
          <OutcomeBtn active={outcome === 'noshow'} onClick={() => setOutcome('noshow')} color="var(--muted)" label="👻 No-Show" />
          <OutcomeBtn active={outcome === 'standby'} onClick={() => setOutcome('standby')} color="var(--amber)" label="⏸ Stand-by" />
        </div>

        {outcome === 'lost' && (
          <div style={{ marginBottom: 16 }}>
            <label style={ST_LBL}>MOTIVO DA PERDA *</label>
            <input value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Ex: preço, timing, sem fit..." style={{ ...INP_M, marginTop: 6 }} />
          </div>
        )}
        {outcome === 'standby' && (
          <div style={{ marginBottom: 16 }}>
            <label style={ST_LBL}>RETOMAR EM *</label>
            <input type="datetime-local" value={standbyAt} onChange={e => setStandbyAt(e.target.value)} style={{ ...INP_M, marginTop: 6 }} />
          </div>
        )}

        {outcome && outcome !== 'won' && (
          <button onClick={confirm} style={{ ...BTN_BIG, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)` }}>Confirmar encerramento</button>
        )}
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }) {
  return <div onClick={onClose || undefined} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 20 }}>{children}</div>;
}
function OutcomeBtn({ active, onClick, color, label }) {
  return (
    <button onClick={onClick} style={{
      padding: '14px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
      background: active ? `${color}1f` : 'var(--surface)', color: active ? color : 'var(--text)',
      border: `1px solid ${active ? `${color}60` : 'var(--border)'}`, transition: 'all .15s',
    }}>{label}</button>
  );
}

// ════════════════════════════════════════════════════════════════
// OBJEÇÕES (CRUD do closer)
// ════════════════════════════════════════════════════════════════
function ObjectionsView({ items, addItem, updateItem, removeItem, toast }) {
  const [objection, setObjection] = useState('');
  const [response, setResponse] = useState('');
  const [editId, setEditId] = useState(null);

  const submit = async () => {
    if (!objection.trim() || !response.trim()) { toast('Preencha objeção e resposta.', 'e'); return; }
    if (editId) { await updateItem(editId, { objection, response }); setEditId(null); }
    else await addItem(objection, response);
    setObjection(''); setResponse('');
  };

  return (
    <div className="fade-up">
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Máquina de Objeções</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Suas respostas prontas — aparecem no Modo Showtime.</p>

      <div style={{ ...CARD, marginBottom: 20 }}>
        <label style={ST_LBL}>OBJEÇÃO</label>
        <input value={objection} onChange={e => setObjection(e.target.value)} placeholder='Ex: "Está caro"' style={{ ...INP_M, marginTop: 6, marginBottom: 12 }} />
        <label style={ST_LBL}>RESPOSTA SUGERIDA</label>
        <textarea value={response} onChange={e => setResponse(e.target.value)} rows={3} placeholder="Como contornar..." style={{ ...INP_M, marginTop: 6, resize: 'vertical', fontFamily: 'var(--f)' }} />
        <button onClick={submit} style={{ ...BTN_BIG, width: 'auto', padding: '9px 16px', fontSize: 13, marginTop: 12, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)` }}>
          {editId ? <><Check size={14} /> Salvar</> : <><Plus size={14} /> Adicionar</>}
        </button>
        {editId && <button onClick={() => { setEditId(null); setObjection(''); setResponse(''); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', marginLeft: 12, textDecoration: 'underline' }}>cancelar</button>}
      </div>

      {items.length === 0 ? <Empty msg="Nenhuma objeção cadastrada." /> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(o => (
            <div key={o.id} style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{o.objection}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditId(o.id); setObjection(o.objection); setResponse(o.response); }} style={ICON_BTN_M}><Edit2 size={13} /></button>
                  <button onClick={() => removeItem(o.id)} style={ICON_BTN_M}><Trash2 size={13} color="rgba(238,51,99,.6)" /></button>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{o.response}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const INP_M = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' };
const ICON_BTN_M = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' };
