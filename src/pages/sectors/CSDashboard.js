import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  LayoutDashboard, ClipboardList, CheckSquare, Calendar, X, Check, FileText, Activity,
} from 'lucide-react';
import { useToast } from '../../components/shared/Toast';
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
  const { toast } = useToast();
  const { clients, addClient, updateClient } = useClients();
  const { collaborators } = useCollaborators();
  const { deals, loading, updateDeal } = useDeals();
  const { tasks } = useTasks();

  const [page, setPage] = useState('onboarding');
  const [openDeal, setOpenDeal] = useState(null);   // deal aberto (briefing)
  const [activateDeal, setActivateDeal] = useState(null); // deal em ativação

  const queue = useMemo(() => deals.filter(d => d.status === 'awaiting_cs'), [deals]);
  const activated = useMemo(() => deals.filter(d => d.status === 'active'), [deals]);

  const NAV = [
    { key: 'onboarding', label: 'Onboarding', icon: ClipboardList, badge: queue.length, badgeDanger: queue.length > 0 },
    { key: 'health',     label: 'Saúde',       icon: Activity },
    { key: 'overview',   label: 'Visão Geral', icon: LayoutDashboard },
    { key: 'todo',       label: 'Meu Dia',     icon: CheckSquare },
    { key: 'agenda',     label: 'Agenda',      icon: Calendar },
  ];

  const handleActivated = async (clientData, deal) => {
    // 1. Cria o cliente no sistema (estrutura completa via useClients).
    const res = await addClient(clientData);
    if (!res.success) { toast(res.error, 'e'); return; }
    // 2. Marca o deal como ativo.
    await updateDeal(deal.id, { status: 'active', activatedAt: new Date().toISOString(), clientName: clientData.name });
    toast(`${clientData.name} ativado e cadastrado! 🎉`);
    setActivateDeal(null);
    setOpenDeal(null);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="cs" navItems={NAV} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 28, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? <Spinner /> :
          page === 'onboarding' ? (
            <Onboarding queue={queue} onOpen={setOpenDeal} />
          ) : page === 'health' ? (
            <CSHealth clients={clients} tasks={tasks} onUpdateClient={updateClient} toast={toast} />
          ) : page === 'overview' ? (
            <Overview queue={queue} activated={activated} />
          ) : page === 'todo' ? (
            <TodoView accent={COLOR} />
          ) : page === 'agenda' ? (
            <AgendaView />
          ) : (
            <StubView page={page} />
          )}
      </main>

      {/* Briefing read-only + trava */}
      {openDeal && ReactDOM.createPortal(
        <DealDrawer
          deal={openDeal}
          onClose={() => setOpenDeal(null)}
          onUpdateChecks={async (patch) => { await updateDeal(openDeal.id, patch); setOpenDeal(d => ({ ...d, ...patch })); }}
          onConcludeSetup={() => setActivateDeal(openDeal)}
        />, document.body)}

      {/* Modal de ativação (cadastro de cliente) */}
      {activateDeal && ReactDOM.createPortal(
        <CSActivateModal
          deal={activateDeal}
          collaborators={collaborators}
          onClose={() => setActivateDeal(null)}
          onActivate={(clientData) => handleActivated(clientData, activateDeal)}
        />, document.body)}
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
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 10, marginBottom: 4 }}>Fila de Onboarding</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Vendas ganhas aguardando ativação · {queue.length}</p>
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
                  {(b.services || []).map(s => {
                    const sec = SECTORS[s];
                    return sec ? <span key={s} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: `${sec.color}1a`, color: sec.color, fontFamily: 'var(--fm)' }}>{sec.emoji} {sec.label}</span> : null;
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <CheckPill on={d.hasSignedContract} label="Contrato" />
                  <CheckPill on={d.hasPaid} label="Pagamento" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckPill({ on, label }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, fontFamily: 'var(--fm)', background: on ? 'var(--green-dim)' : 'var(--surface)', color: on ? 'var(--green)' : 'var(--muted)', border: `1px solid ${on ? 'var(--green-b)' : 'var(--border)'}` }}>
      {on ? '✓' : '○'} {label}
    </span>
  );
}

// ── Drawer: briefing read-only + checklist de trava ────────────
function DealDrawer({ deal, onClose, onUpdateChecks, onConcludeSetup }) {
  const b = deal.briefing || {};
  const canConclude = deal.hasSignedContract && deal.hasPaid;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ width: 'min(560px,100%)', height: '100%', background: 'rgba(14,14,28,.99)', borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{b.companyName || deal.leadName}</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Briefing · fechado por {deal.closerName}</p>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer', display: 'flex' }}><X size={15} color="var(--muted)" /></button>
        </div>

        {/* Checklist de trava */}
        <div style={{ background: `${COLOR}10`, border: `1px solid ${COLOR}30`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 11, letterSpacing: '.1em', color: COLOR, fontWeight: 700, fontFamily: 'var(--fm)', marginBottom: 12 }}>VALIDAÇÕES OBRIGATÓRIAS</p>
          <CheckRow checked={deal.hasSignedContract} label="Contrato assinado" onToggle={() => onUpdateChecks({ hasSignedContract: !deal.hasSignedContract })} />
          <CheckRow checked={deal.hasPaid} label="Pagamento confirmado" onToggle={() => onUpdateChecks({ hasPaid: !deal.hasPaid })} />
          <button
            disabled={!canConclude}
            onClick={onConcludeSetup}
            style={{ width: '100%', marginTop: 14, padding: '12px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: canConclude ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: canConclude ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'var(--surface)', color: canConclude ? '#fff' : 'var(--muted)', boxShadow: canConclude ? '0 4px 16px rgba(34,197,94,.3)' : 'none' }}
          >
            <Check size={16} /> Concluir Setup
          </button>
          {!canConclude && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>Marque as duas validações para liberar.</p>}
        </div>

        {/* Briefing read-only */}
        <Section title="Cadastral">
          <RO label="Empresa" value={b.companyName} />
          <RO label="CNPJ" value={b.cnpj} />
          <RO label="Contato" value={b.contactName} />
          <RO label="Telefone" value={b.contactPhone} />
          <RO label="E-mail" value={b.contactEmail} />
        </Section>
        <Section title="Escopo">
          <RO label="Serviços" value={(b.services || []).map(s => SECTORS[s]?.label || s).join(', ')} />
          <RO label="Escopo" value={b.scope} block />
          <RO label="Verba" value={b.budget} />
        </Section>
        <Section title="Inteligência">
          <RO label="Dores" value={b.pains} block />
          <RO label="Objetivos" value={b.goals} block />
          <RO label="Concorrentes" value={b.competitors} />
          <RO label="Decisor" value={b.decisionMaker} />
        </Section>
        <Section title="Técnico">
          <RO label="Site" value={b.hasWebsite} />
          <RO label="Ferramentas" value={b.currentTools} />
          <RO label="Assets" value={b.assetsLink} />
          <RO label="Observações" value={b.observations} block />
        </Section>
      </div>
    </div>
  );
}

function CheckRow({ checked, label, onToggle }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
      <span onClick={onToggle} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${checked ? 'var(--green)' : 'var(--border)'}`, background: checked ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {checked && <Check size={14} color="#07070e" />}
      </span>
      <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
    </label>
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
