import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  LayoutDashboard, ClipboardList, CheckSquare, Calendar, X, Check, FileText, Activity,
} from 'lucide-react';
import { useToast } from '../../components/shared/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useDeals } from '../../hooks/useDeals';
import { useTasks } from '../../hooks/useTasks';
import Sidebar from '../../components/shared/Sidebar';
import { SECTORS } from '../../lib/firebase';
import CSActivateModal from '../../components/commercial/CSActivateModal';
import CSHealth from '../../components/commercial/CSHealth';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';

const COLOR = SECTORS.cs.color;

export default function CSDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, addClient, updateClient } = useClients();
  const { collaborators } = useCollaborators();
  const { deals, loading, updateDeal, returnToCloser } = useDeals();
  const { tasks } = useTasks();

  const [page, setPage] = useState('contracts');
  const [openDeal, setOpenDeal] = useState(null);
  const [activateDeal, setActivateDeal] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);

  const me = user?.name;
  // Novos contratos: vendas fechadas aguardando o CS conferir e ativar.
  const queue = useMemo(() => deals.filter(d => d.status === 'awaiting_cs'), [deals]);
  // Em onboarding: já ativados, kanban rodando (nem todos os setores ok).
  const inOnboarding = useMemo(() => clients.filter(c => c.onboarding && c.onboarding.status === 'running'), [clients]);
  // Prontos para call de onboarding: todos os setores deram ok.
  const readyForCall = useMemo(() => clients.filter(c => c.onboarding && c.onboarding.status === 'ready'), [clients]);

  const NAV = [
    { key: 'contracts',  label: 'Novos Contratos', icon: ClipboardList, badge: queue.length, badgeDanger: queue.length > 0 },
    { key: 'onboarding', label: 'Onboarding',      icon: Activity, badge: readyForCall.length },
    { key: 'health',     label: 'Saúde',           icon: Activity },
    { key: 'overview',   label: 'Visão Geral',     icon: LayoutDashboard },
    { key: 'todo',       label: 'Meu Dia',         icon: CheckSquare },
    { key: 'agenda',     label: 'Agenda',          icon: Calendar },
  ];

  const handleActivated = async (clientData, deal, setupResponsibles) => {
    // 1. Cria o cliente com estrutura de onboarding (kanban por setor).
    const sectorsInvolved = Object.keys(setupResponsibles).filter(s => (setupResponsibles[s] || []).length > 0);
    const checklist = {};
    sectorsInvolved.forEach(s => { checklist[s] = { ok: false, by: null, at: null }; });
    const withOnboarding = {
      ...clientData,
      responsibles: setupResponsibles,
      onboarding: {
        status: 'running',        // running → ready (todos ok)
        sectors: sectorsInvolved,
        checklist,                 // { setor: { ok, by, at } }
        startedAt: new Date().toISOString(),
        dealId: deal.id,
      },
    };
    const res = await addClient(withOnboarding);
    if (!res.success) { toast(res.error, 'e'); return; }
    await updateDeal(deal.id, { status: 'active', activatedAt: new Date().toISOString(), clientName: clientData.name });
    toast(`${clientData.name} ativado! Enviado ao kanban de onboarding dos setores. 🎉`);
    setActivateDeal(null);
    setOpenDeal(null);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="cs" navItems={NAV} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 28, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? <Spinner /> :
          page === 'contracts' ? (
            <Onboarding queue={queue} onOpen={setOpenDeal} />
          ) : page === 'onboarding' ? (
            <OnboardingTracking inOnboarding={inOnboarding} readyForCall={readyForCall} />
          ) : page === 'health' ? (
            <CSHealth clients={clients} tasks={tasks} onUpdateClient={updateClient} toast={toast} />
          ) : page === 'overview' ? (
            <Overview queue={queue} activated={readyForCall} />
          ) : page === 'todo' ? (
            <TodoView accent={COLOR} />
          ) : page === 'agenda' ? (
            <AgendaView />
          ) : (
            <StubView page={page} />
          )}
      </main>

      {/* Contrato + conferência */}
      {openDeal && ReactDOM.createPortal(
        <DealDrawer
          deal={openDeal}
          onClose={() => setOpenDeal(null)}
          onConcludeSetup={() => setActivateDeal(openDeal)}
          onReturnToCloser={() => setReturnTarget(openDeal)}
        />, document.body)}

      {/* Modal de conclusão de setup (responsáveis por setor) */}
      {activateDeal && ReactDOM.createPortal(
        <CSActivateModal
          deal={activateDeal}
          collaborators={collaborators}
          onClose={() => setActivateDeal(null)}
          onActivate={(clientData, responsibles) => handleActivated(clientData, activateDeal, responsibles)}
        />, document.body)}

      {/* Devolver ao closer */}
      {returnTarget && ReactDOM.createPortal(
        <ReturnToCloserModal
          deal={returnTarget}
          onClose={() => setReturnTarget(null)}
          onConfirm={async (reason) => {
            const r = await returnToCloser(returnTarget.id, me, reason);
            if (r.success) { toast('Contrato devolvido ao closer.'); setReturnTarget(null); setOpenDeal(null); }
            else toast(r.error, 'e');
          }} />, document.body)}
    </div>
  );
}

function Spinner() { return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner" style={{ width: 36, height: 36 }} /></div>; }
function StubView({ page }) {
  const labels = { todo: 'Meu Dia', agenda: 'Agenda' };
  return (
    <div className="fade-up" style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{labels[page] || 'Em construção'}</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>Esta seção chega num bloco dedicado.</p>
    </div>
  );
}

// ── Fila de onboarding ─────────────────────────────────────────
function Onboarding({ queue, onOpen }) {
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${COLOR}1a`, color: COLOR, border: `1px solid ${COLOR}40`, fontFamily: 'var(--fm)' }}>🎧 CUSTOMER SUCCESS</span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 10, marginBottom: 4 }}>Novos Contratos</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Vendas fechadas aguardando conferência e ativação · {queue.length}</p>
      </div>
      {queue.length === 0 ? (
        <Empty msg="Nenhum cliente aguardando onboarding. ✨" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {queue.map(d => {
            const b = d.briefing || {};
            return (
              <button key={d.id} onClick={() => onOpen(d)} style={{ ...CARD, textAlign: 'left', cursor: 'pointer', border: `1px solid ${COLOR}30` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{b.companyName || d.leadName}</span>
                  <FileText size={15} color={COLOR} />
                </div>
                {b.contactName && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>👤 {b.contactName}</p>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {(b.servicesSummary || []).map(s => (
                    <span key={s.id} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: `${COLOR}1a`, color: COLOR, fontFamily: 'var(--fm)' }}>{s.label}</span>
                  ))}
                </div>
                {b.saleTotal && <p style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, marginTop: 10 }}>{Number(b.saleTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Drawer: contrato + conferência ─────────────────────────────
function DealDrawer({ deal, onClose, onConcludeSetup, onReturnToCloser }) {
  const b = deal.briefing || {};
  const money = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ width: 'min(560px,100%)', height: '100%', background: 'rgba(14,14,28,.99)', borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{b.companyName || deal.leadName}</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Contrato · fechado por {deal.closerName}{deal.secondCloser ? ` + ${deal.secondCloser}` : ''}</p>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer', display: 'flex' }}><X size={15} color="var(--muted)" /></button>
        </div>

        {deal.returnedByCs && (
          <div style={{ background: '#ef444415', border: '1px solid #ef444444', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#fca5a5' }}>
            Este contrato já foi devolvido ao closer uma vez e voltou.
          </div>
        )}

        {/* Ações do CS */}
        <div style={{ background: `${COLOR}10`, border: `1px solid ${COLOR}30`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 11, letterSpacing: '.1em', color: COLOR, fontWeight: 700, fontFamily: 'var(--fm)', marginBottom: 12 }}>CONFERÊNCIA DO CS</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
            Confira os dados do contrato. Se estiver tudo certo, conclua o setup e defina os responsáveis por setor. Se faltar algo, devolva ao closer.
          </p>
          <button onClick={onConcludeSetup} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', boxShadow: '0 4px 16px rgba(34,197,94,.3)' }}>
            <Check size={16} /> Concluir Setup
          </button>
          <button onClick={onReturnToCloser} style={{ width: '100%', marginTop: 8, padding: '11px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--surface)', color: 'var(--neon)' }}>
            <X size={14} /> Devolver ao closer (falta informação)
          </button>
        </div>

        {/* Dados do contrato */}
        <Section title="Cliente">
          <RO label="Empresa" value={b.companyName} />
          <RO label="CNPJ/CPF" value={b.docId} />
          <RO label="Responsável" value={b.contactName} />
          <RO label="Telefone" value={b.contactPhone} />
          <RO label="E-mail" value={b.contactEmail} />
        </Section>
        <Section title="Serviços vendidos">
          {(b.servicesSummary || []).length === 0
            ? <p style={{ fontSize: 13, color: 'var(--muted)' }}>—</p>
            : b.servicesSummary.map(s => (
                <div key={s.id} style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2, whiteSpace: 'pre-wrap' }}>{s.desc}</p>
                </div>
              ))}
        </Section>
        <Section title="Financeiro">
          <RO label="Valor total" value={b.saleTotal ? money(b.saleTotal) : null} />
          <RO label="Pagamento" value={
            b.payment?.type === 'avista' ? 'À vista'
            : b.payment?.custom ? `A prazo — ${b.payment.plan}`
            : b.payment ? `${b.payment.installments}x de ${money(b.payment.installmentValue)}` : null
          } />
          <RO label="Prazo de contrato" value={b.contractMonths ? `${b.contractMonths} meses` : null} />
        </Section>
      </div>
    </div>
  );
}

// ── Acompanhamento do onboarding (kanban dos setores) ──────────
function OnboardingTracking({ inOnboarding, readyForCall }) {
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${COLOR}1a`, color: COLOR, border: `1px solid ${COLOR}40`, fontFamily: 'var(--fm)' }}>🎧 CUSTOMER SUCCESS</span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 10, marginBottom: 4 }}>Onboarding</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Acompanhe o ok dos setores. Quando todos confirmam, o cliente fica pronto para a call.</p>
      </div>

      {/* Prontos para a call */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 10 }}>✓ Prontos para call de onboarding ({readyForCall.length})</h3>
      {readyForCall.length === 0 ? <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>Nenhum cliente pronto ainda.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10, marginBottom: 28 }}>
          {readyForCall.map(c => (
            <div key={c.id} style={{ ...CARD, border: '1px solid var(--green-b)' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{c.name}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                {(c.onboarding?.sectors || []).map(s => (
                  <span key={s} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: 'var(--green-dim)', color: 'var(--green)', fontFamily: 'var(--fm)' }}>{SECTORS[s]?.label || s} ✓</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Em andamento */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)', marginBottom: 10 }}>⏳ Em onboarding ({inOnboarding.length})</h3>
      {inOnboarding.length === 0 ? <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum cliente em onboarding.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {inOnboarding.map(c => {
            const cl = c.onboarding?.checklist || {};
            const sectors = c.onboarding?.sectors || [];
            const done = sectors.filter(s => cl[s]?.ok).length;
            return (
              <div key={c.id} style={CARD}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{c.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{done}/{sectors.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  {sectors.map(s => {
                    const ok = cl[s]?.ok;
                    return (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 12, color: SECTORS[s]?.color || 'var(--text)' }}>{SECTORS[s]?.emoji} {SECTORS[s]?.label || s}</span>
                        {ok
                          ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--fm)' }}>✓ {cl[s].by || 'ok'}</span>
                          : <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>pendente</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Devolver ao closer (motivo obrigatório) ────────────────────
function ReturnToCloserModal({ deal, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.99)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Devolver ao closer</h3>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={15} color="var(--muted)" /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
          O contrato de <strong>{deal.briefing?.companyName || deal.leadName}</strong> volta para a agenda do closer. Descreva o que ficou faltando.
        </p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Ex: falta CNPJ, telefone incorreto, descrição do serviço incompleta..." style={{ width: '100%', background: '#12121f', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'var(--f)' }} />
        <button disabled={!reason.trim()} onClick={() => onConfirm(reason)} style={{ width: '100%', marginTop: 14, padding: '12px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: reason.trim() ? 'pointer' : 'not-allowed', opacity: reason.trim() ? 1 : .5, background: 'linear-gradient(135deg,var(--neon),#c41f4a)', color: '#fff' }}>
          Devolver ao closer
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: COLOR, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{title}</h3>
      <div style={{ background: 'rgba(12,12,24,.6)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>{children}</div>
    </div>
  );
}
function RO({ label, value, block }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)', marginBottom: 2 }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: block ? 'pre-wrap' : 'normal' }}>{value}</p>
    </div>
  );
}

function Overview({ queue, activated }) {
  return (
    <div className="fade-up">
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 18 }}>Visão Geral</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        <Stat label="Aguardando onboarding" value={queue.length} color={COLOR} />
        <Stat label="Clientes ativados" value={activated.length} color="var(--green)" />
      </div>
    </div>
  );
}
function Stat({ label, value, color }) {
  return (
    <div style={{ ...CARD, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 800, color }}>{value}</p>
    </div>
  );
}

function Empty({ msg }) { return <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>{msg}</p>; }
const CARD = { background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 };
