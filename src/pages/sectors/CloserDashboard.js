import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  CalendarClock, CheckSquare, Calendar, MessageSquare,
  Video, X, Plus, Trash2, Edit2, Check, ChevronDown, Bold, List,
  AlertTriangle, RotateCcw, Inbox, Undo2, Columns, UserPlus, SkipForward,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import { SECTORS } from '../../lib/firebase';
import { useDeals, hasConflict } from '../../hooks/useDeals';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useCommercialGoals, useObjections, sumSalesThisMonth } from '../../hooks/useCloserData';
import BriefingForm from '../../components/commercial/BriefingForm';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';
 
const COLOR = SECTORS.comercial.color;
// O comercial é quase-preto (emblema); para destaque na UI usamos um
// tom de apoio legível no fundo escuro.
const ACCENT = '#7C5CFF';
 
export default function CloserDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    deals, loading,
    claimCall, releaseCall, addManualCall,
    passTurn, addSecondCloser, removeSecondCloser,
    closeNoShow, closeLost, closeWon, recoverDeal, saveCallNotes, saveCallForm, deleteManualCall,
  } = useDeals();
  const { collaborators } = useCollaborators();
  const { goals } = useCommercialGoals();
  const objections = useObjections(user?.authUid);
 
  const [page, setPage] = useState('available');
  const [showtimeDealId, setShowtimeDealId] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [passTarget, setPassTarget] = useState(null); // deal a passar a vez
  const [conflictPrompt, setConflictPrompt] = useState(null);
  const [startPrompt, setStartPrompt] = useState(null);
 
  const me = user?.name;
 
  // Lista de closers ativos (para fila e 2º closer).
  const closerNames = useMemo(() => {
    const closers = collaborators.filter(c => c.sector === 'comercial' && c.active && c.commercialRole === 'closer').map(c => c.name);
    return closers.length > 0 ? closers : collaborators.filter(c => c.sector === 'comercial' && c.active).map(c => c.name);
  }, [collaborators]);
 
  // ── Partição dos deals ───────────────────────────────────────
  // Disponíveis para MIM: as atribuídas a mim pela fila (assigned) +
  // as que estão no pool aberto (available, quando todos passaram).
  const available = useMemo(
    () => deals.filter(d => (d.status === 'assigned' && d.assignedTo === me) || d.status === 'available'),
    [deals, me]
  );
  const myAgenda = useMemo(
    () => deals.filter(d => d.status === 'claimed' && (d.closerName === me || d.secondCloser === me)),
    [deals, me]
  );
  const recoverable = useMemo(
    () => deals.filter(d => ['mq', 'noshow'].includes(d.status) && d.closerName === me),
    [deals, me]
  );
 
  // metas — agora por VALOR de venda (não contagem de calls)
  const salesMe = useMemo(() => sumSalesThisMonth(deals, me), [deals, me]);
  const salesTeam = useMemo(() => sumSalesThisMonth(deals), [deals]);
  const goalMe = goals?.individual?.[me] || 0;
  const goalTeam = goals?.teamGoal || 0;
 
  const tryClaim = (deal) => {
    const conflict = hasConflict(deal.callAt, myAgenda);
    if (conflict) { setConflictPrompt({ deal, conflictsWith: conflict }); return; }
    doClaim(deal);
  };
  const doClaim = async (deal) => {
    const r = await claimCall(deal.id, me);
    if (r.success) toast('Call aceita e adicionada à sua agenda!');
    else toast(r.error, 'e');
    setConflictPrompt(null);
  };
 
  const tryStart = (deal) => {
    if (!deal.callAt) { setShowtimeDealId(deal.id); return; }
    const diff = Math.abs(new Date(deal.callAt).getTime() - Date.now());
    if (diff > 60 * 60 * 1000) { setStartPrompt(deal); return; }
    setShowtimeDealId(deal.id);
  };
 
  const NAV = [
    { key: 'available', label: 'Calls Disponíveis', icon: Inbox, badge: available.length, badgeDanger: available.length > 0 },
    { key: 'agenda-int', label: 'Minha Agenda', icon: CalendarClock, badge: myAgenda.length },
    { key: 'recover', label: 'Recuperar', icon: RotateCcw, badge: recoverable.length },
    { key: 'objections', label: 'Objeções', icon: MessageSquare },
    { key: 'todo', label: 'Meu Dia', icon: CheckSquare },
    { key: 'agenda', label: 'Agenda', icon: Calendar },
  ];
 
  const showtimeDeal = deals.find(d => d.id === showtimeDealId) || null;
 
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="comercial" navItems={NAV} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 28, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? <Spinner /> :
          page === 'available' ? (
            <AvailableView list={available} me={me} goalMe={goalMe} salesMe={salesMe} goalTeam={goalTeam} salesTeam={salesTeam} onClaim={tryClaim} onPass={setPassTarget} />
          ) : page === 'agenda-int' ? (
            <InternalAgenda list={myAgenda} me={me} closers={closerNames}
              onStart={tryStart} onRelease={setReleaseTarget} onAddManual={() => setShowManual(true)}
              onAddSecond={async (id, name) => { const r = await addSecondCloser(id, name); if (r.success) toast('Segundo closer adicionado (comissão dividida).'); else toast(r.error, 'e'); }}
              onRemoveSecond={async (id) => { await removeSecondCloser(id); toast('Segundo closer removido.'); }}
              onDelete={async (id) => { const r = await deleteManualCall(id, user); if (r.success) toast('Call manual excluída.'); else toast(r.error, 'e'); }} />
          ) : page === 'recover' ? (
            <RecoverView list={recoverable} onRecover={async (id) => { const r = await recoverDeal(id, me); if (r.success) toast('Call recuperada para sua agenda.'); else toast(r.error, 'e'); }} />
          ) : page === 'objections' ? (
            <ObjectionsView items={objections.items} addItem={objections.addItem} updateItem={objections.updateItem} removeItem={objections.removeItem} toast={toast} />
          ) : page === 'todo' ? (
            <TodoView accent={ACCENT} />
          ) : page === 'agenda' ? (
            <AgendaView />
          ) : (
            <StubView page={page} />
          )}
      </main>
 
      {/* Showtime */}
      {showtimeDeal && ReactDOM.createPortal(
        <Showtime
          deal={showtimeDeal} me={me} objections={objections.items}
          onSaveNotes={saveCallNotes}
          onClose={() => setShowtimeDealId(null)}
          actions={{ closeNoShow, closeLost, closeWon, saveCallForm }}
          toast={toast}
        />, document.body)}
 
      {/* Passar a vez */}
      {passTarget && ReactDOM.createPortal(
        <PassTurnModal deal={passTarget} onClose={() => setPassTarget(null)} onConfirm={async (reason) => {
          const r = await passTurn(passTarget.id, me, reason, closerNames);
          setPassTarget(null);
          if (r.success) toast('Vez passada ao próximo closer da fila.');
          else toast(r.error, 'e');
        }} />, document.body)}
 
      {/* Modal de call manual */}
      {showManual && ReactDOM.createPortal(
        <ManualCallModal
          onClose={() => setShowManual(false)}
          onSave={async (data) => {
            const r = await addManualCall(me, data);
            if (r.success) { toast('Call manual adicionada à sua agenda!'); setShowManual(false); }
            else toast(r.error, 'e');
          }}
          myAgenda={myAgenda}
        />, document.body)}
 
      {/* Devolução com justificativa */}
      {releaseTarget && ReactDOM.createPortal(
        <ReleaseModal
          deal={releaseTarget}
          onClose={() => setReleaseTarget(null)}
          onConfirm={async (reason) => {
            const r = await releaseCall(releaseTarget.id, me, reason);
            if (r.success) { toast('Call devolvida às disponíveis.'); setReleaseTarget(null); }
            else toast(r.error, 'e');
          }}
        />, document.body)}
 
      {/* Alerta de conflito ao puxar */}
      {conflictPrompt && ReactDOM.createPortal(
        <ConfirmModal
          icon={<AlertTriangle size={28} color="var(--amber)" />}
          title="Conflito de agenda"
          message={`Você já tem "${conflictPrompt.conflictsWith.leadName}" em horário próximo (janela de 1h). Deseja puxar esta call mesmo assim?`}
          confirmLabel="Puxar mesmo assim"
          confirmColor="var(--amber)"
          onConfirm={() => doClaim(conflictPrompt.deal)}
          onClose={() => setConflictPrompt(null)}
        />, document.body)}
 
      {/* Confirmação de início fora de hora */}
      {startPrompt && ReactDOM.createPortal(
        <ConfirmModal
          icon={<AlertTriangle size={28} color={ACCENT} />}
          title="Iniciar fora do horário?"
          message={`Esta call estava marcada para ${fmtDateTime(startPrompt.callAt)}. Você está iniciando em um horário diferente. Confirmar início?`}
          confirmLabel="Iniciar call"
          confirmColor={ACCENT}
          onConfirm={() => { setShowtimeDealId(startPrompt.id); setStartPrompt(null); }}
          onClose={() => setStartPrompt(null)}
        />, document.body)}
    </div>
  );
}
 
function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner" style={{ width: 36, height: 36 }} /></div>;
}
function StubView({ page }) {
  return <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '60px 0' }}>Seção "{page}" em breve.</p>;
}
 
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
 
// ── Calls Disponíveis (tela inicial) ───────────────────────────
function AvailableView({ list, me, goalMe, salesMe, goalTeam, salesTeam, onClaim, onPass }) {
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${ACCENT}1a`, color: ACCENT, border: `1px solid ${ACCENT}40`, fontFamily: 'var(--fm)' }}>💼 CLOSER</span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 10, marginBottom: 4 }}>Calls Disponíveis</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Calls distribuídas para você pela fila. Aceite para adicionar à agenda, ou passe a vez ao próximo closer.</p>
      </div>
 
      {/* Metas do mês por VALOR (sempre visíveis) */}
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', fontFamily: 'var(--fm)', letterSpacing: '.08em', marginBottom: 10 }}>📊 METAS DO MÊS (R$)</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <GoalBar label="Minhas vendas" value={salesMe} goal={goalMe} color="#22c55e" money />
        <GoalBar label="Vendas do time" value={salesTeam} goal={goalTeam} color={ACCENT} money />
      </div>
 
      {list.length === 0 ? (
        <Empty msg="Nenhuma call disponível no momento." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {list.map(d => {
            const assignedToMe = d.status === 'assigned' && d.assignedTo === me;
            return (
              <div key={d.id} style={{ background: 'rgba(12,12,24,.9)', border: `1px solid ${assignedToMe ? `${ACCENT}55` : 'var(--border)'}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{d.leadName}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: `${ACCENT}1a`, color: ACCENT, fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>{fmtDateTime(d.callAt)}</span>
                </div>
                {assignedToMe
                  ? <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#22c55e20', color: '#22c55e', fontFamily: 'var(--fm)', marginTop: 6 }}>➤ SUA VEZ NA FILA</span>
                  : <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'var(--surface)', color: 'var(--muted)', fontFamily: 'var(--fm)', marginTop: 6 }}>POOL ABERTO</span>}
                {d.company && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>🏢 {d.company}</p>}
                {d.sdrName && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, fontFamily: 'var(--fm)' }}>SDR: {d.sdrName}</p>}
                {d.pains && <p style={{ fontSize: 12, color: 'var(--text)', marginTop: 8, lineHeight: 1.5, maxHeight: 60, overflow: 'hidden' }}>{d.pains}</p>}
                <button onClick={() => onClaim(d)} style={{ ...BTN_BIG, marginTop: 12, background: `linear-gradient(135deg,${ACCENT},${ACCENT}cc)` }}>
                  <Check size={15} /> Aceitar call
                </button>
                {assignedToMe && (
                  <button onClick={() => onPass(d)} style={{ ...BTN_BIG, marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                    <SkipForward size={14} /> Passar a vez
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
 
// ── Agenda interna (lista OU colunas por dia) ──────────────────
function InternalAgenda({ list, me, closers, onStart, onRelease, onAddManual, onAddSecond, onRemoveSecond, onDelete }) {
  const [view, setView] = useState('list'); // 'list' | 'columns'
 
  const days = useMemo(() => {
    const map = {};
    list.forEach(d => {
      const key = d.callAt ? new Date(d.callAt).toISOString().slice(0, 10) : 'sem-data';
      (map[key] = map[key] || []).push(d);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => new Date(a.callAt || 0) - new Date(b.callAt || 0)));
    return Object.entries(map).sort(([a], [b]) => (a === 'sem-data' ? 1 : b === 'sem-data' ? -1 : a.localeCompare(b)));
  }, [list]);
 
  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Minha Agenda</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Suas calls da semana. Só você vê esta agenda.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Toggle de visualização */}
          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: 3 }}>
            <button onClick={() => setView('list')} title="Lista" style={{ display: 'flex', alignItems: 'center', gap: 5, background: view === 'list' ? `${ACCENT}22` : 'transparent', color: view === 'list' ? ACCENT : 'var(--muted)', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              <List size={14} /> Lista
            </button>
            <button onClick={() => setView('columns')} title="Colunas" style={{ display: 'flex', alignItems: 'center', gap: 5, background: view === 'columns' ? `${ACCENT}22` : 'transparent', color: view === 'columns' ? ACCENT : 'var(--muted)', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              <Columns size={14} /> Colunas
            </button>
          </div>
          <button onClick={onAddManual} style={{ display: 'flex', alignItems: 'center', gap: 6, background: `linear-gradient(135deg,${ACCENT},${ACCENT}cc)`, border: 'none', borderRadius: 10, padding: '10px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={15} /> Call manual
          </button>
        </div>
      </div>
 
      {list.length === 0 ? (
        <Empty msg="Nenhuma call na sua agenda. Puxe uma das disponíveis ou cadastre manualmente." />
      ) : view === 'list' ? (
        // ── Modo LISTA ──
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {days.map(([day, items]) => (
            <div key={day}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{dayLabel(day)}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{items.length} call{items.length > 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 16, borderLeft: `2px solid ${ACCENT}30` }}>
                {items.map(d => <CallCard key={d.id} d={d} me={me} closers={closers} onStart={onStart} onRelease={onRelease} onAddSecond={onAddSecond} onRemoveSecond={onRemoveSecond} onDelete={onDelete} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // ── Modo COLUNAS (cada dia uma coluna) ──
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {days.map(([day, items]) => (
            <div key={day} style={{ minWidth: 240, flex: '0 0 240px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${ACCENT}40` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{dayLabel(day)}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', marginLeft: 'auto' }}>{items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(d => <CallCard key={d.id} d={d} me={me} closers={closers} onStart={onStart} onRelease={onRelease} onAddSecond={onAddSecond} onRemoveSecond={onRemoveSecond} onDelete={onDelete} compact />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
 
// Card de call reutilizado nos dois modos.
function CallCard({ d, me, closers = [], onStart, onRelease, onAddSecond, onRemoveSecond, onDelete, compact }) {
  const [pickSecond, setPickSecond] = useState(false);
  const isOwner = d.closerName === me;
  const others = closers.filter(n => n !== me && n !== d.secondCloser);
  return (
    <div style={{ background: 'rgba(12,12,24,.9)', border: '1px solid var(--border)', borderRadius: 12, padding: compact ? '10px 12px' : '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: compact ? 'flex-start' : 'center', gap: 12, flexDirection: compact ? 'column' : 'row' }}>
        {!compact && (
          <div style={{ textAlign: 'center', minWidth: 52 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: ACCENT, fontFamily: 'var(--fm)' }}>{fmtTime(d.callAt)}</p>
            {d.manual && <span style={{ fontSize: 8, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>MANUAL</span>}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, width: compact ? '100%' : 'auto' }}>
          {compact && <p style={{ fontSize: 13, fontWeight: 800, color: ACCENT, fontFamily: 'var(--fm)' }}>{fmtTime(d.callAt)}{d.manual && <span style={{ fontSize: 8, color: 'var(--muted)', marginLeft: 6 }}>MANUAL</span>}</p>}
          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{d.leadName}</p>
          {d.company && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{d.company}</p>}
          {d.secondCloser && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: ACCENT, background: `${ACCENT}1a`, padding: '2px 8px', borderRadius: 10, marginTop: 4, fontFamily: 'var(--fm)' }}>
              <UserPlus size={10} /> + {d.secondCloser} (÷2)
              {isOwner && <X size={10} style={{ cursor: 'pointer' }} onClick={() => onRemoveSecond(d.id)} />}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, width: compact ? '100%' : 'auto', marginTop: compact ? 8 : 0 }}>
          <button onClick={() => onStart(d)} style={{ flex: compact ? 1 : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: `linear-gradient(135deg,${ACCENT},${ACCENT}cc)`, border: 'none', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Video size={13} /> Iniciar
          </button>
          {isOwner && !d.secondCloser && others.length > 0 && (
            <button onClick={() => setPickSecond(v => !v)} title="Adicionar 2º closer" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: ACCENT, cursor: 'pointer', display: 'flex' }}>
              <UserPlus size={13} />
            </button>
          )}
          <button onClick={() => onRelease(d)} title="Devolver para disponíveis" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}>
            <Undo2 size={13} />
          </button>
          {d.manual && (
            <button onClick={() => onDelete(d.id)} title="Excluir call manual" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      {pickSecond && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Adicionar 2º closer (a comissão da venda será dividida por 2):</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {others.map(n => (
              <button key={n} onClick={() => { onAddSecond(d.id, n); setPickSecond(false); }} style={{ fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 14, cursor: 'pointer', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>{n}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
 
// ── Recuperar (mq / noshow) ────────────────────────────────────
function RecoverView({ list, onRecover }) {
  const label = { mq: 'MQ (mal qualif.)', noshow: 'No-show' };
  const col = { mq: 'var(--neon)', noshow: 'var(--muted)' };
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Recuperar Calls</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>MQ e no-show — clique para retomar na sua agenda.</p>
      </div>
      {list.length === 0 ? <Empty msg="Nada para recuperar." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
          {list.map(d => (
            <div key={d.id} style={{ background: 'rgba(12,12,24,.9)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{d.leadName}</span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, fontFamily: 'var(--fm)', color: col[d.status], background: `${col[d.status]}1a`, whiteSpace: 'nowrap' }}>{label[d.status]}</span>
              </div>
              {d.company && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{d.company}</p>}
              {d.mqReason && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>{d.mqReason}</p>}
              <button onClick={() => onRecover(d.id)} style={{ ...BTN_BIG, marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                <RotateCcw size={13} /> Recuperar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
 
function dayLabel(key) {
  if (key === 'sem-data') return 'Sem data definida';
  const d = new Date(key + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  const wd = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  if (diff === 0) return `Hoje · ${wd}`;
  if (diff === 1) return `Amanhã · ${wd}`;
  return wd.charAt(0).toUpperCase() + wd.slice(1);
}
 
// ── Modais ─────────────────────────────────────────────────────
function ManualCallModal({ onClose, onSave, myAgenda }) {
  const [leadName, setLeadName] = useState('');
  const [company, setCompany] = useState('');
  const [callAt, setCallAt] = useState('');
  const [meetLink, setMeetLink] = useState('');
  const [pains, setPains] = useState('');
  const [warn, setWarn] = useState(null);
 
  const submit = () => {
    if (!leadName.trim()) { setWarn('Informe o nome do lead.'); return; }
    if (!callAt) { setWarn('Defina data e hora.'); return; }
    const iso = new Date(callAt).toISOString();
    const conflict = hasConflict(iso, myAgenda);
    if (conflict && !warn?.startsWith('Conflito')) {
      setWarn(`Conflito: você já tem "${conflict.leadName}" em horário próximo. Clique em salvar de novo para confirmar.`);
      return;
    }
    onSave({ leadName, company, callAt: iso, meetLink, pains });
  };
 
  return (
    <Overlay onClose={onClose}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.98)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Nova call manual</h3>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={15} color="var(--muted)" /></button>
        </div>
        <label style={ST_LBL}>NOME DO LEAD *</label>
        <input value={leadName} onChange={e => setLeadName(e.target.value)} style={{ ...INP_M, marginTop: 6, marginBottom: 12 }} />
        <label style={ST_LBL}>EMPRESA</label>
        <input value={company} onChange={e => setCompany(e.target.value)} style={{ ...INP_M, marginTop: 6, marginBottom: 12 }} />
        <label style={ST_LBL}>DATA E HORA *</label>
        <input type="datetime-local" value={callAt} onChange={e => setCallAt(e.target.value)} style={{ ...INP_M, marginTop: 6, marginBottom: 12, colorScheme: 'dark' }} />
        <label style={ST_LBL}>LINK DA REUNIÃO</label>
        <input value={meetLink} onChange={e => setMeetLink(e.target.value)} placeholder="https://meet..." style={{ ...INP_M, marginTop: 6, marginBottom: 12 }} />
        <label style={ST_LBL}>NOTAS / DORES</label>
        <textarea value={pains} onChange={e => setPains(e.target.value)} rows={3} style={{ ...INP_M, marginTop: 6, marginBottom: 12, resize: 'vertical', fontFamily: 'var(--f)' }} />
        {warn && <p style={{ fontSize: 12, color: warn.startsWith('Conflito') ? 'var(--amber)' : 'var(--neon)', marginBottom: 12 }}>{warn}</p>}
        <button onClick={submit} style={{ ...BTN_BIG, background: `linear-gradient(135deg,${ACCENT},${ACCENT}cc)` }}>Salvar na agenda</button>
      </div>
    </Overlay>
  );
}
 
function ReleaseModal({ deal, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <Overlay onClose={onClose}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.98)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Devolver call</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>"{deal.leadName}" voltará para as disponíveis. Justifique a devolução.</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Motivo (ex: conflito de agenda, fora do meu perfil...)" style={{ ...INP_M, resize: 'vertical', fontFamily: 'var(--f)', marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onConfirm(reason)} style={{ ...BTN_BIG, background: `linear-gradient(135deg,var(--amber),#d97706)`, flex: 1 }}>Devolver</button>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 18px', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </Overlay>
  );
}
 
function ConfirmModal({ icon, title, message, confirmLabel, confirmColor, onConfirm, onClose }) {
  return (
    <Overlay onClose={onClose}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.98)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
        <div style={{ marginBottom: 12 }}>{icon}</div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onConfirm} style={{ ...BTN_BIG, flex: 1, background: `linear-gradient(135deg,${confirmColor},${confirmColor}cc)` }}>{confirmLabel}</button>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 18px', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </Overlay>
  );
}
 
function GoalBar({ label, value, goal, color, money = false }) {
  const hasGoal = goal > 0;
  const pct = hasGoal ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  const fmt = (n) => money
    ? (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : n;
  return (
    <div style={{ background: 'rgba(12,12,24,.88)', border: `1px solid ${color}33`, borderRadius: 14, padding: 18, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 22, fontWeight: 800, color }}>
          {fmt(value)}
          {hasGoal
            ? <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}> / {fmt(goal)}</span>
            : <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginLeft: 6 }}>sem meta</span>}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width .4s', boxShadow: pct > 0 ? `0 0 10px ${color}88` : 'none' }} />
      </div>
      {hasGoal && pct >= 100 && <p style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, fontFamily: 'var(--fm)', marginTop: 6 }}>🎉 Meta batida!</p>}
    </div>
  );
}
 
function Empty({ msg }) { return <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>{msg}</p>; }
const BTN_BIG = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff', width: '100%' };
const CARD = { background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 };
 
// ════════════════════════════════════════════════════════════════
// MODO SHOWTIME
// ════════════════════════════════════════════════════════════════
function Showtime({ deal, me, objections, onSaveNotes, onClose, actions, toast }) {
  const [elapsed, setElapsed] = useState(0);
  const [showClose, setShowClose] = useState(false);
  // Mini-formulário obrigatório da call (persistido no deal.callForm).
  const [form, setForm] = useState(deal.callForm || {
    clientCompany: deal.company || '', responsibleName: '', whatSells: '', niche: '',
    servicesOffered: '', investAmount: '', hasBrand: null, hasSite: null, siteLink: '',
    hasDomainAccess: null, hasInstagram: null, hasInstagramAccess: null,
    didPaidTraffic: null, awareOfInvestment: null,
  });
  const notesRef = React.useRef(null);
  const savedRef = React.useRef(deal.callNotes || '');
  const formSavedRef = React.useRef(JSON.stringify(deal.callForm || {}));
 
  React.useEffect(() => {
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, []);
 
  React.useEffect(() => {
    const id = setInterval(() => {
      const html = notesRef.current?.innerHTML || '';
      if (html !== savedRef.current) { savedRef.current = html; onSaveNotes(deal.id, html); }
      const fj = JSON.stringify(form);
      if (fj !== formSavedRef.current) { formSavedRef.current = fj; actions.saveCallForm?.(deal.id, form); }
    }, 5000);
    return () => clearInterval(id);
  }, [deal.id, onSaveNotes, form, actions]);
 
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const exec = (cmd) => { document.execCommand(cmd, false, null); notesRef.current?.focus(); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
 
  // Validação do mini-formulário (todos obrigatórios).
  const formComplete = (
    form.clientCompany?.trim() && form.responsibleName?.trim() && form.whatSells?.trim() &&
    form.niche?.trim() && form.servicesOffered?.trim() && form.investAmount?.trim() &&
    form.hasBrand !== null && form.hasSite !== null && form.hasDomainAccess !== null &&
    form.hasInstagram !== null && form.didPaidTraffic !== null && form.awareOfInvestment !== null &&
    (form.hasSite !== true || form.siteLink?.trim()) &&
    (form.hasInstagram !== true || form.hasInstagramAccess !== null)
  );
 
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#07070e', zIndex: 1200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: `1px solid ${COLOR}30`, background: 'rgba(12,12,24,.96)', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.leadName}</h2>
          {deal.company && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{deal.company}</p>}
        </div>
        {deal.secondCloser && <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, background: `${ACCENT}1a`, padding: '4px 10px', borderRadius: 12, fontFamily: 'var(--fm)' }}>+ {deal.secondCloser}</span>}
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
 
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '360px 1fr 320px', overflow: 'hidden' }}>
        {/* Esquerda: dados do SDR + MINI-FORMULÁRIO OBRIGATÓRIO */}
        <div style={{ borderRight: '1px solid var(--border)', padding: 20, overflowY: 'auto' }}>
          <h3 style={ST_H}>Mapeado pelo SDR</h3>
          {deal.sdrName && <Info label="SDR" value={deal.sdrName} />}
          {deal.callAt && <Info label="Agendada para" value={new Date(deal.callAt).toLocaleString('pt-BR')} />}
          <div style={{ marginTop: 8, marginBottom: 16 }}>
            <p style={ST_LBL}>DORES</p>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginTop: 4, whiteSpace: 'pre-wrap' }}>{deal.pains || '—'}</p>
          </div>
 
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <h3 style={{ ...ST_H, marginBottom: 4 }}>Formulário da Call *</h3>
            <p style={{ fontSize: 11, color: formComplete ? '#22c55e' : 'var(--amber)', marginBottom: 12 }}>
              {formComplete ? '✓ Completo' : 'Obrigatório para encerrar'}
            </p>
            <MiniField label="Nome do Cliente (Empresa)" value={form.clientCompany} onChange={v => setF('clientCompany', v)} />
            <MiniField label="Nome do Responsável" value={form.responsibleName} onChange={v => setF('responsibleName', v)} />
            <MiniField label="O que vende / faz" value={form.whatSells} onChange={v => setF('whatSells', v)} />
            <MiniField label="Nicho" value={form.niche} onChange={v => setF('niche', v)} />
            <MiniField label="Serviços ofertados" value={form.servicesOffered} onChange={v => setF('servicesOffered', v)} area />
            <MiniField label="Valor disposto a investir" value={form.investAmount} onChange={v => setF('investAmount', v)} />
            <MiniBool label="Já possui marca?" value={form.hasBrand} onChange={v => setF('hasBrand', v)} />
            <MiniBool label="Já possui site?" value={form.hasSite} onChange={v => setF('hasSite', v)} />
            {form.hasSite && <MiniField label="Link do site" value={form.siteLink} onChange={v => setF('siteLink', v)} />}
            <MiniBool label="Tem acesso ao domínio?" value={form.hasDomainAccess} onChange={v => setF('hasDomainAccess', v)} />
            <MiniBool label="Já possui Instagram?" value={form.hasInstagram} onChange={v => setF('hasInstagram', v)} />
            {form.hasInstagram && <MiniBool label="Tem acesso ao Instagram?" value={form.hasInstagramAccess} onChange={v => setF('hasInstagramAccess', v)} />}
            <MiniBool label="Já fez tráfego pago?" value={form.didPaidTraffic} onChange={v => setF('didPaidTraffic', v)} />
            <MiniBool label="Ciente do investimento?" value={form.awareOfInvestment} onChange={v => setF('awareOfInvestment', v)} />
          </div>
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
 
        {/* Direita: Máquina de Objeções */}
        <div style={{ borderLeft: '1px solid var(--border)', padding: 20, overflowY: 'auto' }}>
          <h3 style={ST_H}>Máquina de Objeções</h3>
          {objections.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Cadastre objeções na aba "Objeções" do seu painel.</p>
            : objections.map(o => <Accordion key={o.id} item={o} />)}
        </div>
      </div>
 
      {showClose && (
        <CloseModal
          deal={deal} me={me} actions={actions} toast={toast} callForm={form} formComplete={!!formComplete}
          onClose={() => setShowClose(false)}
          onDone={() => { setShowClose(false); onClose(); }}
        />
      )}
    </div>
  );
}
 
// Campo de texto do mini-formulário.
function MiniField({ label, value, onChange, area = false }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ ...ST_LBL, display: 'block', marginBottom: 4 }}>{label}</label>
      {area
        ? <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={2} style={{ ...INP_M, resize: 'vertical', fontFamily: 'var(--f)' }} />
        : <input value={value || ''} onChange={e => onChange(e.target.value)} style={INP_M} />}
    </div>
  );
}
// Campo booleano (Sim/Não) do mini-formulário.
function MiniBool({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ ...ST_LBL, display: 'block', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => onChange(true)} style={{ flex: 1, padding: '6px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: value === true ? '#22c55e' : 'var(--surface)', color: value === true ? '#08110a' : 'var(--muted)', border: `1px solid ${value === true ? '#22c55e' : 'var(--border)'}` }}>Sim</button>
        <button type="button" onClick={() => onChange(false)} style={{ flex: 1, padding: '6px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: value === false ? 'var(--neon)' : 'var(--surface)', color: value === false ? '#fff' : 'var(--muted)', border: `1px solid ${value === false ? 'var(--neon)' : 'var(--border)'}` }}>Não</button>
      </div>
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
const ST_H = { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' };
const ST_LBL = { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' };
const RT_BTN = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center' };
 
// ════════════════════════════════════════════════════════════════
// MODAL DE ENCERRAMENTO (forçado)
// ════════════════════════════════════════════════════════════════
function CloseModal({ deal, me, actions, toast, callForm, formComplete, onClose, onDone }) {
  const [outcome, setOutcome] = useState(null); // noshow | mq | venda_fechada
  const [mqReason, setMqReason] = useState('');
 
  const confirm = async () => {
    let r;
    if (outcome === 'noshow') r = await actions.closeNoShow(deal.id, me);
    else if (outcome === 'mq') {
      if (!mqReason.trim()) { toast('Informe o motivo do MQ.', 'e'); return; }
      r = await actions.closeLost(deal.id, me, mqReason);
    }
    if (r?.success) { toast('Call encerrada.'); onDone(); }
    else if (r) toast(r.error, 'e');
  };
 
  const submitBriefing = async (briefing) => {
    const r = await actions.closeWon(deal.id, me, briefing);
    if (r.success) { toast('Venda registrada! Enviado para o CS. 🎉'); onDone(); }
    else toast(r.error, 'e');
  };
 
  // Trava: o mini-formulário da call precisa estar completo para encerrar.
  if (!formComplete) {
    return (
      <Overlay onClose={onClose}>
        <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.98)', border: '1px solid var(--amber)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <AlertTriangle size={20} color="var(--amber)" />
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Formulário incompleto</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.5 }}>
            Antes de encerrar a call, preencha todos os campos do <strong>Formulário da Call</strong> (coluna esquerda). Isso é obrigatório para registrar o resultado.
          </p>
          <button onClick={onClose} style={{ ...BTN_BIG, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)` }}>Voltar e preencher</button>
        </div>
      </Overlay>
    );
  }
 
  // Briefing (Venda Fechada) ocupa o modal inteiro.
  if (outcome === 'venda_fechada') {
    return (
      <Overlay onClose={null}>
        <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.98)', border: `1px solid ${COLOR}40`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 760, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Venda Fechada — {deal.leadName}</h3>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Preencha tudo para enviar ao CS. Campos obrigatórios travam o envio.</p>
          <BriefingForm
            callForm={callForm}
            initial={{ companyName: deal.company || callForm?.clientCompany || '', contactName: callForm?.responsibleName || deal.leadName || '', contactPhone: deal.leadPhone || '', pains: deal.pains || '' }}
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
          <OutcomeBtn active={outcome === 'venda_fechada'} onClick={() => setOutcome('venda_fechada')} color="#22c55e" label="Venda Fechada" />
          <OutcomeBtn active={outcome === 'mq'} onClick={() => setOutcome('mq')} color="var(--neon)" label="MQ (mal qualif.)" />
          <OutcomeBtn active={outcome === 'noshow'} onClick={() => setOutcome('noshow')} color="var(--muted)" label="No-Show" />
        </div>
 
        {outcome === 'mq' && (
          <div style={{ marginBottom: 16 }}>
            <label style={ST_LBL}>MOTIVO DO MQ *</label>
            <input value={mqReason} onChange={e => setMqReason(e.target.value)} placeholder="Por que o lead foi mal qualificado..." style={{ ...INP_M, marginTop: 6 }} />
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Isso conta como métrica de MQ para o SDR que agendou.</p>
          </div>
        )}
        {outcome === 'noshow' && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>O lead volta para o painel do SDR com a marcação de No-Show, para reagendamento.</p>
        )}
 
        {outcome && outcome !== 'venda_fechada' && (
          <button onClick={confirm} style={{ ...BTN_BIG, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)` }}>Confirmar encerramento</button>
        )}
      </div>
    </Overlay>
  );
}
 
function Overlay({ children, onClose }) {
  return <div onClick={onClose || undefined} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 20 }}>{children}</div>;
}
 
// Passar a vez ao próximo closer da fila (motivo obrigatório).
function PassTurnModal({ deal, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <Overlay onClose={onClose}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.98)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Passar a vez</h3>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={15} color="var(--muted)" /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
          A call <strong>{deal.leadName}</strong> vai para o próximo closer da fila. Descreva o motivo.
        </p>
        <label style={ST_LBL}>MOTIVO *</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Ex: conflito de horário, conhço o lead, sem fit com meu perfil..." style={{ ...INP_M, marginTop: 6, resize: 'vertical', fontFamily: 'var(--f)' }} />
        <button disabled={!reason.trim()} onClick={() => onConfirm(reason)} style={{ ...BTN_BIG, marginTop: 16, opacity: reason.trim() ? 1 : .5, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)` }}>
          <SkipForward size={15} /> Passar ao próximo closer
        </button>
      </div>
    </Overlay>
  );
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
