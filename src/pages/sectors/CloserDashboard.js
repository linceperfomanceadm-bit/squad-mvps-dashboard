import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  LayoutDashboard, CalendarClock, MessageSquare, RotateCcw, Video, Plus,
  CheckSquare, Calendar, UserPlus, Trophy, Edit2, Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import { useDeals } from '../../hooks/useDeals';
import { useCollaborators } from '../../hooks/useCollaborators';
import {
  useCommercialGoals, useObjections,
  sumSalesThisMonth, countWonThisMonth, countCallsDoneThisMonth, countOpenFollowups,
} from '../../hooks/useCloserData';
import Sidebar from '../../components/shared/Sidebar';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';
import BriefingForm from '../../components/commercial/BriefingForm';
import { BANT_FIELDS } from '../../lib/firebase';
import {
  Overlay, ModalHeader, ConfirmModal, Field, Stat, Tag, Empty, Spinner, Section, RO, money,
  CARD, GRID, MODAL, LBL, INP, BTN_PRIMARY, BTN_CANCEL, ICON_BTN,
} from '../../components/commercial/ui';

const ACCENT = 'var(--neon)';

/*
 * Painel do Closer — reformulado.
 *
 * Clientes Agendados (todos os closers veem) → o closer confirma que
 * a call aconteceu → o card vira FOLLOW UP → dali sai Venda Ganha
 * (pré-formulário) ou MQ (motivo obrigatório). Se o cliente não
 * apareceu, No-Show devolve o card para o painel do SDR.
 */
export default function CloserDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    deals, loading, addManualCall, confirmCallDone, markNoShow,
    addSecondCloser, removeSecondCloser, addFollowupLog,
    closeMQ, closeWon, recoverDeal, deleteCall,
  } = useDeals();
  const { collaborators } = useCollaborators();
  const { goals } = useCommercialGoals();
  const { items: objections, addItem, updateItem, removeItem } = useObjections(user?.authUid);

  const [page, setPage] = useState('overview');
  const [openDeal, setOpenDeal] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [noShowTarget, setNoShowTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const me = user?.name;
  const closers = useMemo(
    () => collaborators.filter(c => c.sector === 'comercial' && c.commercialRole === 'closer' && c.active),
    [collaborators]
  );

  const buckets = useMemo(() => {
    const scheduled = deals
      .filter(d => d.status === 'scheduled')
      .sort((a, b) => new Date(a.callAt) - new Date(b.callAt));
    const followup = deals
      .filter(d => d.status === 'followup' && (d.closerName === me || d.secondCloser === me))
      .sort((a, b) => new Date(b.callDoneAt || 0) - new Date(a.callDoneAt || 0));
    const mq = deals
      .filter(d => d.status === 'mq' && (d.closerName === me || d.secondCloser === me))
      .sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0));
    return { scheduled, followup, mq };
  }, [deals, me]);

  const metrics = useMemo(() => ({
    revenue: sumSalesThisMonth(deals, me),
    teamRevenue: sumSalesThisMonth(deals),
    won: countWonThisMonth(deals, me),
    calls: countCallsDoneThisMonth(deals, me),
    followups: countOpenFollowups(deals, me),
  }), [deals, me]);

  // Live: o card aberto sempre vem da lista viva do Firestore.
  const liveDeal = openDeal ? deals.find(d => d.id === openDeal) || null : null;

  const NAV = [
    { key: 'overview',   label: 'Dashboard',          icon: LayoutDashboard },
    { key: 'scheduled',  label: 'Clientes Agendados', icon: CalendarClock, badge: buckets.scheduled.length, badgeDanger: buckets.scheduled.length > 0 },
    { key: 'followup',   label: 'Follow Up',          icon: RotateCcw, badge: buckets.followup.length },
    { key: 'mq',         label: 'Meus MQ',            icon: Trophy, badge: buckets.mq.length },
    { key: 'objections', label: 'Objeções',           icon: MessageSquare },
    { key: 'todo',       label: 'Meu Dia',            icon: CheckSquare },
    { key: 'agenda',     label: 'Agenda',             icon: Calendar },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="comercial" navItems={NAV} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 28, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? <Spinner /> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${ACCENT}1a`, color: ACCENT, border: `1px solid ${ACCENT}40`, fontFamily: 'var(--fm)' }}>💼 CLOSER</span>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 10, marginBottom: 4 }}>
                  {page === 'overview' ? 'Dashboard do Closer'
                    : page === 'scheduled' ? 'Clientes Agendados'
                    : page === 'followup' ? 'Follow Ups em Aberto'
                    : page === 'mq' ? 'Marcados como MQ'
                    : page === 'objections' ? 'Máquina de Objeções'
                    : page === 'todo' ? 'Meu Dia' : 'Agenda'}
                </h1>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {page === 'scheduled' ? 'Calls agendadas pelos SDRs — confirme quando a call acontecer'
                    : page === 'followup' ? 'Aguardando desfecho: Venda Ganha ou MQ'
                    : page === 'mq' ? 'Base dos seus leads mal qualificados'
                    : ''}
                </p>
              </div>
              {['overview', 'scheduled'].includes(page) && (
                <button onClick={() => setShowManual(true)} style={{ ...BTN_PRIMARY, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px' }}>
                  <Plus size={15} /> Call própria
                </button>
              )}
            </div>

            {page === 'overview' && <Overview metrics={metrics} goals={goals} me={me} />}

            {page === 'scheduled' && (
              buckets.scheduled.length === 0
                ? <Empty msg="Nenhuma call agendada no momento." />
                : (
                  <div style={GRID}>
                    {buckets.scheduled.map(d => (
                      <ScheduledCard
                        key={d.id}
                        deal={d}
                        me={me}
                        onOpen={() => setOpenDeal(d.id)}
                        onConfirm={async () => {
                          const r = await confirmCallDone(d.id, me);
                          if (r.success) { toast('Call confirmada! Card foi para Follow Up.'); setPage('followup'); }
                          else toast(r.error, 'e');
                        }}
                        onNoShow={() => setNoShowTarget(d)}
                      />
                    ))}
                  </div>
                )
            )}

            {page === 'followup' && (
              buckets.followup.length === 0
                ? <Empty msg="Nenhum follow up em aberto." />
                : (
                  <div style={GRID}>
                    {buckets.followup.map(d => (
                      <FollowupCard key={d.id} deal={d} onOpen={() => setOpenDeal(d.id)} />
                    ))}
                  </div>
                )
            )}

            {page === 'mq' && (
              buckets.mq.length === 0
                ? <Empty msg="Nenhum lead marcado como MQ." />
                : (
                  <div style={GRID}>
                    {buckets.mq.map(d => (
                      <div key={d.id} style={{ ...CARD, border: '1px solid var(--neon-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{d.leadName}</p>
                          <Tag text="MQ" color="var(--neon)" />
                        </div>
                        {d.company && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{d.company}</p>}
                        <p style={{ fontSize: 12, color: '#ddd', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 10, lineHeight: 1.5 }}>
                          {d.mqReason}
                        </p>
                        <button
                          style={{ ...BTN_CANCEL, width: '100%', marginTop: 10 }}
                          onClick={async () => {
                            const r = await recoverDeal(d.id, me);
                            if (r.success) { toast('Voltou para Follow Up.'); setPage('followup'); }
                            else toast(r.error, 'e');
                          }}
                        >
                          Recuperar para Follow Up
                        </button>
                      </div>
                    ))}
                  </div>
                )
            )}

            {page === 'objections' && (
              <Objections items={objections} onAdd={addItem} onUpdate={updateItem} onRemove={removeItem} toast={toast} />
            )}

            {page === 'todo' && <TodoView accent={ACCENT} />}
            {page === 'agenda' && <AgendaView />}
          </>
        )}
      </main>

      {/* Drawer do deal */}
      {liveDeal && ReactDOM.createPortal(
        <DealDrawer
          deal={liveDeal}
          me={me}
          closers={closers}
          onClose={() => setOpenDeal(null)}
          onConfirmCall={async () => {
            const r = await confirmCallDone(liveDeal.id, me);
            if (r.success) toast('Call confirmada!');
            else toast(r.error, 'e');
          }}
          onNoShow={() => { setNoShowTarget(liveDeal); setOpenDeal(null); }}
          onAddSecond={async (name) => {
            const r = await addSecondCloser(liveDeal.id, name);
            if (r.success) toast('2º closer adicionado — o valor da venda será dividido.');
            else toast(r.error, 'e');
          }}
          onRemoveSecond={async () => { await removeSecondCloser(liveDeal.id); toast('2º closer removido.'); }}
          onAddLog={async (text) => {
            const r = await addFollowupLog(liveDeal.id, me, text);
            if (!r.success) toast(r.error, 'e');
            return r;
          }}
          onMQ={async (reason) => {
            const r = await closeMQ(liveDeal.id, me, reason);
            if (r.success) { toast('Marcado como MQ.'); setOpenDeal(null); }
            else toast(r.error, 'e');
            return r;
          }}
          onWon={async (briefing) => {
            const r = await closeWon(liveDeal.id, me, briefing);
            if (r.success) { toast('Venda Ganha! 🎉 Enviado ao CS Comercial.'); setOpenDeal(null); }
            else toast(r.error, 'e');
            return r;
          }}
          onDelete={() => { setConfirmDel(liveDeal); setOpenDeal(null); }}
        />, document.body)}

      {showManual && ReactDOM.createPortal(
        <ManualCallModal
          onClose={() => setShowManual(false)}
          onSave={async (data) => {
            const r = await addManualCall(me, data);
            if (r.success) { toast('Call cadastrada!'); setShowManual(false); }
            else toast(r.error, 'e');
            return r;
          }}
        />, document.body)}

      {noShowTarget && ReactDOM.createPortal(
        <NoShowModal
          deal={noShowTarget}
          onClose={() => setNoShowTarget(null)}
          onConfirm={async (note) => {
            const r = await markNoShow(noShowTarget.id, me, note);
            if (r.success) toast('No-show registrado. O SDR foi avisado no painel dele.');
            else toast(r.error, 'e');
            setNoShowTarget(null);
          }}
        />, document.body)}

      {confirmDel && ReactDOM.createPortal(
        <ConfirmModal
          title="Excluir call"
          text={`Excluir o cadastro de ${confirmDel.leadName}?`}
          onClose={() => setConfirmDel(null)}
          onConfirm={async () => {
            const r = await deleteCall(confirmDel.id, user);
            if (r.success) toast('Call excluída.'); else toast(r.error, 'e');
            setConfirmDel(null);
          }}
        />, document.body)}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────
function Overview({ metrics, goals, me }) {
  const myGoal = Number(goals?.individual?.[me] || 0);
  const teamGoal = Number(goals?.teamGoal || 0);
  const pct = myGoal > 0 ? Math.min(100, Math.round((metrics.revenue / myGoal) * 100)) : 0;
  const teamPct = teamGoal > 0 ? Math.min(100, Math.round((metrics.teamRevenue / teamGoal) * 100)) : 0;

  return (
    <div className="fade-up">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <GoalCard label="MINHA META DE VENDAS" value={metrics.revenue} goal={myGoal} pct={pct} />
        <GoalCard label="META DA EQUIPE" value={metrics.teamRevenue} goal={teamGoal} pct={teamPct} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        <Stat label="Calls realizadas (mês)" value={metrics.calls} color="var(--blue)" />
        <Stat label="Vendas ganhas (mês)" value={metrics.won} color="var(--green)" />
        <Stat label="Follow ups em aberto" value={metrics.followups} color={metrics.followups > 0 ? 'var(--amber)' : 'var(--muted)'} />
      </div>
    </div>
  );
}

function GoalCard({ label, value, goal, pct }) {
  return (
    <div style={CARD}>
      <p style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{label}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '8px 0 12px' }}>
        <p style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>
          {money(value)}
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}> / {goal > 0 ? money(goal) : '—'}</span>
        </p>
        {goal > 0 && <span style={{ fontSize: 18, fontWeight: 800, color: pct >= 100 ? 'var(--green)' : ACCENT, fontFamily: 'var(--fm)' }}>{pct}%</span>}
      </div>
      <div style={{ height: 8, borderRadius: 6, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: pct >= 100 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : `linear-gradient(90deg,${ACCENT},#c41f4a)`, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

// ── Cards ──────────────────────────────────────────────────────
function ScheduledCard({ deal, onOpen, onConfirm, onNoShow }) {
  const when = deal.callAt ? new Date(deal.callAt) : null;
  const past = when && when < new Date();

  return (
    <div style={{ ...CARD, border: `1px solid ${past ? 'var(--amber-b)' : 'var(--border)'}` }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{deal.leadName}</p>
            {deal.company && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{deal.company}</p>}
          </div>
          {deal.manual ? <Tag text="MINHA" color="var(--blue)" /> : <Tag text={deal.sdrName || 'SDR'} color="var(--muted)" />}
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, color: past ? 'var(--amber)' : ACCENT, fontFamily: 'var(--fm)', marginTop: 10 }}>
          📅 {when ? when.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
        </p>
        {deal.niche && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>🏷 {deal.niche}</p>}
      </button>

      {deal.meetLink && (
        <a href={deal.meetLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, padding: '9px', borderRadius: 9, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          <Video size={14} /> Abrir call
        </a>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button style={{ ...BTN_PRIMARY, flex: 1, fontSize: 12 }} onClick={onConfirm}>Call realizada</button>
        <button style={BTN_CANCEL} onClick={onNoShow}>No-show</button>
      </div>
    </div>
  );
}

function FollowupCard({ deal, onOpen }) {
  const logs = deal.followupLogs || [];
  const last = logs[logs.length - 1];
  return (
    <button onClick={onOpen} style={{ ...CARD, border: '1px solid var(--amber-b)', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{deal.leadName}</p>
          {deal.company && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{deal.company}</p>}
        </div>
        <Tag text="FOLLOW UP" color="var(--amber)" />
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
        Call realizada em {deal.callDoneAt ? new Date(deal.callDoneAt).toLocaleDateString('pt-BR') : '—'}
      </p>
      {deal.secondCloser && <p style={{ fontSize: 11, color: ACCENT, fontFamily: 'var(--fm)', marginTop: 4 }}>+ {deal.secondCloser} (split)</p>}
      <p style={{ fontSize: 11, color: '#666', fontFamily: 'var(--fm)', marginTop: 8 }}>
        {logs.length} tentativa{logs.length !== 1 ? 's' : ''} de contato
      </p>
      {last && <p style={{ fontSize: 12, color: '#bbb', marginTop: 4, lineHeight: 1.5 }}>Última: {last.text}</p>}
    </button>
  );
}

// ── Drawer do deal ─────────────────────────────────────────────
function DealDrawer({ deal, me, closers, onClose, onConfirmCall, onNoShow, onAddSecond, onRemoveSecond, onAddLog, onMQ, onWon, onDelete }) {
  const [tab, setTab] = useState('info');
  const [logText, setLogText] = useState('');
  const [mqReason, setMqReason] = useState('');
  const [secondPick, setSecondPick] = useState('');

  const isFollowup = deal.status === 'followup';
  const isScheduled = deal.status === 'scheduled';

  const sendLog = async () => {
    if (!logText.trim()) return;
    const r = await onAddLog(logText);
    if (r?.success) setLogText('');
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'flex-end', zIndex: 1200 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ width: 'min(620px,100%)', height: '100%', background: 'rgba(14,14,28,.99)', borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 26 }}>
        <ModalHeader title={deal.leadName} onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8, marginBottom: 16 }}>
          {deal.company || 'Sem empresa'} · {deal.sdrName ? `agendado por ${deal.sdrName}` : 'call própria'}
        </p>

        {/* Abas do drawer */}
        {isFollowup && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {[
              { id: 'info', label: 'Dados' },
              { id: 'logs', label: `Tentativas (${(deal.followupLogs || []).length})` },
              { id: 'close', label: 'Desfecho' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '8px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tab === t.id ? `${ACCENT}20` : 'var(--surface)', color: tab === t.id ? ACCENT : 'var(--muted)', border: `1px solid ${tab === t.id ? `${ACCENT}55` : 'var(--border)'}` }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {(!isFollowup || tab === 'info') && (
          <>
            <Section title="Dados do lead">
              <RO label="Contato" value={deal.contact} />
              <RO label="Nicho" value={deal.niche} />
              <RO label="Redes sociais" value={deal.socials} />
              <RO label="Call agendada" value={deal.callAt ? new Date(deal.callAt).toLocaleString('pt-BR') : null} />
              <RO label="Observações do SDR" value={deal.notes} block />
            </Section>

            {(deal.bant && BANT_FIELDS.some(f => deal.bant[f.id])) && (
              <Section title="Qualificação BANT">
                {BANT_FIELDS.map(f => <RO key={f.id} label={f.label} value={deal.bant[f.id]} block />)}
              </Section>
            )}

            {deal.meetLink && (
              <a href={deal.meetLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 16 }}>
                <Video size={15} /> Abrir call
              </a>
            )}

            {isScheduled && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onConfirmCall}>Confirmar call realizada</button>
                <button style={BTN_CANCEL} onClick={onNoShow}>No-show</button>
                <button style={ICON_BTN} onClick={onDelete} title="Excluir"><Trash2 size={14} color="rgba(238,51,99,.7)" /></button>
              </div>
            )}

            {/* 2º closer — só faz sentido depois da call */}
            {isFollowup && (
              <Section title="Segundo closer (split do valor)">
                {deal.secondCloser ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, color: ACCENT, fontWeight: 600 }}>{deal.secondCloser}</span>
                    <button style={ICON_BTN} onClick={onRemoveSecond}><Trash2 size={13} color="rgba(238,51,99,.7)" /></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={secondPick} onChange={e => setSecondPick(e.target.value)} style={{ ...INP, cursor: 'pointer', flex: 1 }}>
                      <option value="">Selecionar closer...</option>
                      {closers.filter(c => c.name !== deal.closerName).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <button style={{ ...BTN_PRIMARY, display: 'flex', alignItems: 'center', gap: 6 }} disabled={!secondPick} onClick={() => { onAddSecond(secondPick); setSecondPick(''); }}>
                      <UserPlus size={14} /> Add
                    </button>
                  </div>
                )}
                <p style={{ fontSize: 11, color: '#666', marginTop: 8, lineHeight: 1.5 }}>
                  Com dois closers, o valor da venda é dividido pela metade na meta de cada um.
                </p>
              </Section>
            )}
          </>
        )}

        {isFollowup && tab === 'logs' && (
          <>
            <Section title="Tentativas de contato">
              {(deal.followupLogs || []).length === 0
                ? <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhuma tentativa registrada ainda.</p>
                : (deal.followupLogs || []).map(l => (
                    <div key={l.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, fontFamily: 'var(--fm)' }}>{l.by}</span>
                        <span style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)' }}>{new Date(l.at).toLocaleString('pt-BR')}</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#ddd', marginTop: 4, lineHeight: 1.5 }}>{l.text}</p>
                    </div>
                  ))}
            </Section>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={logText}
                onChange={e => setLogText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendLog()}
                placeholder="Ex: liguei, caiu na caixa postal"
                style={{ ...INP, flex: 1 }}
              />
              <button style={BTN_PRIMARY} onClick={sendLog} disabled={!logText.trim()}>Registrar</button>
            </div>
          </>
        )}

        {isFollowup && tab === 'close' && (
          <CloseSection deal={deal} me={me} mqReason={mqReason} setMqReason={setMqReason} onMQ={onMQ} onWon={onWon} />
        )}
      </div>
    </div>
  );
}

function CloseSection({ deal, mqReason, setMqReason, onMQ, onWon }) {
  const [mode, setMode] = useState(null); // 'won' | 'mq'

  if (mode === 'won') {
    return (
      <div>
        <button style={{ ...BTN_CANCEL, marginBottom: 14 }} onClick={() => setMode(null)}>← Voltar</button>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', marginBottom: 4 }}>Pré-Formulário — Venda Ganha</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          Estes dados vão direto para o CS Comercial gerar contrato e cobrança.
        </p>
        <BriefingForm callForm={deal} onSubmit={onWon} onCancel={() => setMode(null)} />
      </div>
    );
  }

  if (mode === 'mq') {
    return (
      <div>
        <button style={{ ...BTN_CANCEL, marginBottom: 14 }} onClick={() => setMode(null)}>← Voltar</button>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--neon)', marginBottom: 4 }}>Marcar como MQ</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
          O motivo é obrigatório. Este lead entra na base de MQ para análise do Líder Comercial.
        </p>
        <textarea
          value={mqReason}
          onChange={e => setMqReason(e.target.value)}
          rows={4}
          placeholder="Por que o lead foi mal qualificado? Seja específico — isso vira aprendizado para o SDR."
          style={{ ...INP, resize: 'vertical' }}
        />
        <button
          style={{ ...BTN_PRIMARY, width: '100%', marginTop: 12, opacity: mqReason.trim().length >= 20 ? 1 : .5 }}
          disabled={mqReason.trim().length < 20}
          onClick={() => onMQ(mqReason)}
        >
          Confirmar MQ
        </button>
        {mqReason.trim().length < 20 && <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>Mínimo de 20 caracteres ({mqReason.trim().length}).</p>}
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
        Qual foi o desfecho deste lead?
      </p>
      <button
        onClick={() => setMode('won')}
        style={{ width: '100%', padding: '16px', borderRadius: 12, border: '1px solid rgba(34,197,94,.4)', background: 'rgba(34,197,94,.08)', color: 'var(--green)', fontSize: 15, fontWeight: 800, cursor: 'pointer', marginBottom: 10 }}
      >
        ✓ Venda Ganha
      </button>
      <button
        onClick={() => setMode('mq')}
        style={{ width: '100%', padding: '16px', borderRadius: 12, border: '1px solid var(--neon-border)', background: 'var(--neon-dim)', color: 'var(--neon)', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
      >
        ✕ MQ — Mal Qualificado
      </button>
    </div>
  );
}

// ── Modais ─────────────────────────────────────────────────────
function ManualCallModal({ onClose, onSave }) {
  const [form, setForm] = useState({ leadName: '', company: '', contact: '', callAt: '', meetLink: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.leadName.trim() && form.callAt;

  return (
    <Overlay onClose={onClose}>
      <div style={MODAL}>
        <ModalHeader title="Cadastrar call própria" onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Para calls que você mesmo agendou, sem passar pelo SDR.</p>
        <Field label="Nome do lead *" value={form.leadName} onChange={v => set('leadName', v)} />
        <Field label="Empresa" value={form.company} onChange={v => set('company', v)} />
        <Field label="Contato" value={form.contact} onChange={v => set('contact', v)} />
        <div style={{ marginTop: 10 }}>
          <p style={LBL}>DATA E HORA *</p>
          <input type="datetime-local" value={form.callAt} onChange={e => set('callAt', e.target.value)} style={{ ...INP, marginTop: 6, colorScheme: 'dark' }} />
        </div>
        <Field label="Link da call" value={form.meetLink} onChange={v => set('meetLink', v)} />
        <Field label="Observações" value={form.notes} onChange={v => set('notes', v)} area />
        <button
          style={{ ...BTN_PRIMARY, width: '100%', marginTop: 16, opacity: (valid && !busy) ? 1 : .5 }}
          disabled={!valid || busy}
          onClick={async () => { setBusy(true); await onSave({ ...form, callAt: new Date(form.callAt).toISOString() }); setBusy(false); }}
        >
          {busy ? 'Salvando...' : 'Cadastrar'}
        </button>
      </div>
    </Overlay>
  );
}

function NoShowModal({ deal, onClose, onConfirm }) {
  const [note, setNote] = useState('');
  return (
    <Overlay onClose={onClose}>
      <div style={MODAL}>
        <ModalHeader title="Registrar no-show" onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
          <strong style={{ color: '#fff' }}>{deal.leadName}</strong> volta para o painel do SDR marcado como no-show, para reagendamento.
        </p>
        <p style={LBL}>OBSERVAÇÃO (opcional)</p>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Ex: entrou na sala e saiu, não atendeu no WhatsApp..." style={{ ...INP, marginTop: 6, resize: 'vertical' }} />
        <button style={{ ...BTN_PRIMARY, width: '100%', marginTop: 14 }} onClick={() => onConfirm(note)}>Confirmar no-show</button>
      </div>
    </Overlay>
  );
}

// ── Objeções ───────────────────────────────────────────────────
function Objections({ items, onAdd, onUpdate, onRemove, toast }) {
  const [objection, setObjection] = useState('');
  const [response, setResponse] = useState('');
  const [editing, setEditing] = useState(null);

  const save = async () => {
    if (!objection.trim() || !response.trim()) return;
    const r = editing
      ? await onUpdate(editing, { objection: objection.trim(), response: response.trim() })
      : await onAdd(objection, response);
    if (r?.success !== false) { setObjection(''); setResponse(''); setEditing(null); toast('Objeção salva!'); }
  };

  return (
    <div className="fade-up">
      <div style={{ ...CARD, marginBottom: 16 }}>
        <p style={LBL}>OBJEÇÃO</p>
        <input value={objection} onChange={e => setObjection(e.target.value)} placeholder="Ex: está caro" style={{ ...INP, marginTop: 6, marginBottom: 10 }} />
        <p style={LBL}>COMO CONTORNAR</p>
        <textarea value={response} onChange={e => setResponse(e.target.value)} rows={3} placeholder="Sua melhor resposta..." style={{ ...INP, marginTop: 6, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button style={{ ...BTN_PRIMARY, flex: 1, opacity: (objection.trim() && response.trim()) ? 1 : .5 }} disabled={!objection.trim() || !response.trim()} onClick={save}>
            {editing ? 'Salvar alterações' : 'Adicionar'}
          </button>
          {editing && <button style={BTN_CANCEL} onClick={() => { setEditing(null); setObjection(''); setResponse(''); }}>Cancelar</button>}
        </div>
      </div>

      {items.length === 0 ? <Empty msg="Nenhuma objeção cadastrada ainda." /> : (
        <div style={GRID}>
          {items.map(i => (
            <div key={i.id} style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>“{i.objection}”</p>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button style={ICON_BTN} onClick={() => { setEditing(i.id); setObjection(i.objection); setResponse(i.response); }}><Edit2 size={13} /></button>
                  <button style={ICON_BTN} onClick={() => onRemove(i.id)}><Trash2 size={13} color="rgba(238,51,99,.7)" /></button>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#ccc', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: 8 }}>{i.response}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
