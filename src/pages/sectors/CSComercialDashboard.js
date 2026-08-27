import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  LayoutDashboard, FileText, PenTool, CreditCard, Activity,
  CheckSquare, Calendar, Check, Video, Clock, Kanban, MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useDeals, canMoveToOnboarding } from '../../hooks/useDeals';
import { useTasks } from '../../hooks/useTasks';
import { useRequests } from '../../hooks/useRequests';
import Sidebar from '../../components/shared/Sidebar';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';
import TaskKanban from '../../components/kanban/TaskKanban';
import CSRequests from '../../components/commercial/CSRequests';
import CSResponsiblesModal from '../../components/commercial/CSResponsiblesModal';
import { SECTORS } from '../../lib/firebase';
import {
  Overlay, ModalHeader, ScheduleModal, Stat, Tag, Empty, Spinner, Section, RO,
  money, fmtDateTime, toLocalInput,
  CARD, GRID, MODAL, BTN_PRIMARY, BTN_GREEN, BTN_CANCEL,
} from '../../components/commercial/ui';

const COLOR = SECTORS.cs.color;

/*
 * CS COMERCIAL — 4 abas, exatamente como o fluxograma:
 *
 *  1. Novos Contratos    → card com checklist (Gerar Contrato /
 *                          Gerar link de Pagamento). Ao marcar cada
 *                          item, o cliente aparece no painel
 *                          correspondente. Com assinatura E pagamento
 *                          confirmados, o botão "Mover para
 *                          Onboarding" habilita e pede data/hora.
 *  2. Painel de Assinatura → contratos pendentes de assinatura
 *  3. Painel de Pagamento  → contratos pendentes de pagamento
 *  4. Onboarding           → calls de onboarding agendadas. Ao
 *                          confirmar a call realizada, o CS define os
 *                          responsáveis, o cliente é criado e vai para
 *                          o CS Operacional (Kickoff).
 */
export default function CSComercialDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, addClient } = useClients();
  const { collaborators } = useCollaborators();
  const {
    deals, loading, toggleCsChecklist, confirmSignature, confirmPayment,
    moveToOnboarding, rescheduleOnboardingCall, finishOnboarding,
  } = useDeals();
  const {
    tasks, moveToProduction, moveToApproval, approveTask, rejectTask,
    addComment, updateLinks, deleteTask, changeDeadline,
  } = useTasks();
  const {
    requests, createRequest, addReply, closeRequest, deleteRequest,
  } = useRequests();

  const [page, setPage] = useState('contracts');
  const [openDeal, setOpenDeal] = useState(null);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [responsiblesTarget, setResponsiblesTarget] = useState(null);

  const me = user?.name;

  const buckets = useMemo(() => {
    const won = deals.filter(d => d.status === 'won');
    const contracts = won.filter(d => (d.csStage || 'contract') === 'contract');
    const signature = won.filter(d => d.csChecklist?.contract?.done && !d.signature?.done);
    const payment   = won.filter(d => d.csChecklist?.payment?.done && !d.paymentConfirmed?.done);
    const onboarding = won
      .filter(d => d.csStage === 'onboarding')
      .sort((a, b) => new Date(a.onboardingCall?.at || 0) - new Date(b.onboardingCall?.at || 0));
    return { contracts, signature, payment, onboarding };
  }, [deals]);

  const liveDeal = openDeal ? deals.find(d => d.id === openDeal) || null : null;

  // Clientes ativos e carteira desta pessoa (responsável salvo como
  // string em docs antigos e como array nos novos).
  const activeClients = useMemo(() => clients.filter(c => c.active !== false), [clients]);
  const myClientIds = useMemo(() => activeClients.filter(c => {
    const r = c.responsibles?.cs;
    return Array.isArray(r) ? r.includes(me) : r === me;
  }).map(c => c.id), [activeClients, me]);

  const requestsToClose = requests.filter(r => r.status === 'answered').length;

  const NAV = [
    { key: 'contracts',  label: 'Novos Contratos', icon: FileText,   badge: buckets.contracts.length, badgeDanger: buckets.contracts.length > 0 },
    { key: 'signature',  label: 'Assinatura',      icon: PenTool,    badge: buckets.signature.length },
    { key: 'payment',    label: 'Pagamento',       icon: CreditCard, badge: buckets.payment.length },
    { key: 'onboarding', label: 'Onboarding',      icon: Activity,   badge: buckets.onboarding.length },
    { key: 'kanban',     label: 'Produção',        icon: Kanban },
    { key: 'requests',   label: 'Solicitações',    icon: MessageSquare, badge: requestsToClose, badgeDanger: requestsToClose > 0 },
    { key: 'overview',   label: 'Visão Geral',     icon: LayoutDashboard },
    { key: 'todo',       label: 'Meu Dia',         icon: CheckSquare },
    { key: 'agenda',     label: 'Agenda',          icon: Calendar },
  ];

  const HEAD = {
    contracts:  ['Novos Contratos', 'Vendas ganhas aguardando contrato e cobrança'],
    signature:  ['Painel de Assinatura', 'Contratos pendentes de assinatura'],
    payment:    ['Painel de Pagamento', 'Contratos pendentes de pagamento'],
    onboarding: ['Onboarding', 'Calls de onboarding agendadas'],
    kanban:     ['Produção dos Clientes', 'Acompanhamento em tempo real — leitura e comentário, sem mover card'],
    requests:   ['Reporte da CS', 'Solicitações abertas para os times de produção'],
    overview:   ['Visão Geral', 'Seu funil de contratos no mês'],
    todo:       ['Meu Dia', ''],
    agenda:     ['Agenda', ''],
  };

  // Conclui o onboarding: cria o cliente e fecha o deal.
  const handleFinishOnboarding = async (clientData) => {
    const res = await addClient(clientData);
    if (!res.success) { toast(res.error, 'e'); return res; }
    await finishOnboarding(responsiblesTarget.id, me, res.id, clientData.name);
    toast(`${clientData.name} está ativo! Foi para o Kickoff do CS Operacional. 🎉`);
    setResponsiblesTarget(null);
    setOpenDeal(null);
    return { success: true };
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="cs" navItems={NAV} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 28, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? <Spinner /> : (
          <>
            <div style={{ marginBottom: 22 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${COLOR}1a`, color: COLOR, border: `1px solid ${COLOR}40`, fontFamily: 'var(--fm)' }}>🎧 CS COMERCIAL</span>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 10, marginBottom: 4 }}>{HEAD[page][0]}</h1>
              {HEAD[page][1] && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{HEAD[page][1]}</p>}
            </div>

            {page === 'overview' && <Overview buckets={buckets} deals={deals} />}

            {page === 'contracts' && (
              buckets.contracts.length === 0
                ? <Empty msg="Nenhum contrato novo aguardando. ✨" />
                : (
                  <div style={GRID}>
                    {buckets.contracts.map(d => (
                      <ContractCard
                        key={d.id}
                        deal={d}
                        onOpen={() => setOpenDeal(d.id)}
                        onToggle={async (item, done) => {
                          const r = await toggleCsChecklist(d.id, item, me, done);
                          if (!r.success) toast(r.error, 'e');
                          else toast(done
                            ? `Enviado para o painel de ${item === 'contract' ? 'assinatura' : 'pagamento'}.`
                            : 'Item desmarcado.');
                        }}
                        onMove={() => setScheduleTarget(d)}
                      />
                    ))}
                  </div>
                )
            )}

            {page === 'signature' && (
              buckets.signature.length === 0
                ? <Empty msg="Nenhum contrato pendente de assinatura." />
                : (
                  <div style={GRID}>
                    {buckets.signature.map(d => (
                      <PendingCard
                        key={d.id}
                        deal={d}
                        label="Aguardando assinatura"
                        since={d.csChecklist?.contract?.at}
                        actionLabel="Contrato assinado"
                        onOpen={() => setOpenDeal(d.id)}
                        onConfirm={async () => {
                          const r = await confirmSignature(d.id, me);
                          if (r.success) toast('Assinatura confirmada.');
                          else toast(r.error, 'e');
                        }}
                      />
                    ))}
                  </div>
                )
            )}

            {page === 'payment' && (
              buckets.payment.length === 0
                ? <Empty msg="Nenhum contrato pendente de pagamento." />
                : (
                  <div style={GRID}>
                    {buckets.payment.map(d => (
                      <PendingCard
                        key={d.id}
                        deal={d}
                        label="Aguardando pagamento"
                        since={d.csChecklist?.payment?.at}
                        actionLabel="Pagamento confirmado"
                        onOpen={() => setOpenDeal(d.id)}
                        onConfirm={async () => {
                          const r = await confirmPayment(d.id, me);
                          if (r.success) toast('Pagamento confirmado.');
                          else toast(r.error, 'e');
                        }}
                      />
                    ))}
                  </div>
                )
            )}

            {page === 'onboarding' && (
              buckets.onboarding.length === 0
                ? <Empty msg="Nenhuma call de onboarding agendada." />
                : (
                  <div style={GRID}>
                    {buckets.onboarding.map(d => (
                      <OnboardingCard
                        key={d.id}
                        deal={d}
                        onOpen={() => setOpenDeal(d.id)}
                        onReschedule={() => setRescheduleTarget(d)}
                        onDone={() => setResponsiblesTarget(d)}
                      />
                    ))}
                  </div>
                )
            )}

            {page === 'kanban' && (
              <TaskKanban
                tasks={tasks}
                clients={activeClients}
                allClients={activeClients}
                collaborators={collaborators}
                currentUser={me}
                currentUserSector="cs"
                readOnly
                myClientIds={myClientIds}
                title="Produção dos Clientes"
                subtitle="Somente leitura"
                onCreateTask={async () => ({ success: false })}
                onMoveToProduction={moveToProduction}
                onMoveToApproval={moveToApproval}
                onApprove={approveTask}
                onReject={rejectTask}
                onAddComment={addComment}
                onUpdateLinks={updateLinks}
                onChangeDeadline={changeDeadline}
                onDelete={deleteTask}
              />
            )}

            {page === 'requests' && (
              <CSRequests
                requests={requests}
                clients={clients}
                collaborators={collaborators}
                currentUser={me}
                currentUserSector="cs"
                onCreate={(data) => createRequest(data, me, 'cs')}
                onReply={addReply}
                onCloseRequest={closeRequest}
                onDelete={deleteRequest}
                toast={toast}
              />
            )}

            {page === 'todo' && <TodoView accent={COLOR} />}
            {page === 'agenda' && <AgendaView />}
          </>
        )}
      </main>

      {/* Detalhe do contrato */}
      {liveDeal && ReactDOM.createPortal(
        <ContractDrawer deal={liveDeal} onClose={() => setOpenDeal(null)} />, document.body)}

      {/* Mover para onboarding → agenda a call */}
      {scheduleTarget && ReactDOM.createPortal(
        <ScheduleModal
          title="Agendar call de onboarding"
          subtitle={`Defina quando será a call de onboarding com ${scheduleTarget.briefing?.companyName || scheduleTarget.leadName}.`}
          confirmLabel="Mover para Onboarding"
          onClose={() => setScheduleTarget(null)}
          onConfirm={async (at, link) => {
            const r = await moveToOnboarding(scheduleTarget.id, me, at, link);
            if (r.success) { toast('Call de onboarding agendada!'); setScheduleTarget(null); setPage('onboarding'); }
            else toast(r.error, 'e');
          }}
        />, document.body)}

      {/* Reagendar a call de onboarding */}
      {rescheduleTarget && ReactDOM.createPortal(
        <ScheduleModal
          title="Reagendar call de onboarding"
          initialAt={toLocalInput(rescheduleTarget.onboardingCall?.at)}
          initialLink={rescheduleTarget.onboardingCall?.meetLink || ''}
          confirmLabel="Reagendar"
          onClose={() => setRescheduleTarget(null)}
          onConfirm={async (at, link) => {
            const r = await rescheduleOnboardingCall(rescheduleTarget.id, me, at, link);
            if (r.success) { toast('Call reagendada.'); setRescheduleTarget(null); }
            else toast(r.error, 'e');
          }}
        />, document.body)}

      {/* Call realizada → define responsáveis e cria o cliente */}
      {responsiblesTarget && ReactDOM.createPortal(
        <CSResponsiblesModal
          deal={responsiblesTarget}
          collaborators={collaborators}
          onClose={() => setResponsiblesTarget(null)}
          onConfirm={handleFinishOnboarding}
        />, document.body)}
    </div>
  );
}

// ── Visão geral ────────────────────────────────────────────────
function Overview({ buckets, deals }) {
  const now = new Date();
  const activeMonth = deals.filter(d =>
    d.status === 'active' && d.onboardingDoneAt &&
    new Date(d.onboardingDoneAt).getMonth() === now.getMonth() &&
    new Date(d.onboardingDoneAt).getFullYear() === now.getFullYear()
  );
  const pipelineValue = deals
    .filter(d => d.status === 'won')
    .reduce((sum, d) => sum + (Number(d.saleTotal) || 0), 0);

  return (
    <div className="fade-up">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
        <Stat label="Novos contratos" value={buckets.contracts.length} color={COLOR} />
        <Stat label="Pend. assinatura" value={buckets.signature.length} color="var(--amber)" />
        <Stat label="Pend. pagamento" value={buckets.payment.length} color="var(--amber)" />
        <Stat label="Em onboarding" value={buckets.onboarding.length} color="var(--blue)" />
        <Stat label="Ativados no mês" value={activeMonth.length} color="var(--green)" />
      </div>
      <div style={CARD}>
        <p style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>VALOR EM CONTRATOS ABERTOS</p>
        <p style={{ fontSize: 30, fontWeight: 800, color: 'var(--green)', marginTop: 8 }}>{money(pipelineValue)}</p>
        <p style={{ fontSize: 11, color: '#666', marginTop: 6 }}>Soma dos contratos que ainda não concluíram o onboarding.</p>
      </div>
    </div>
  );
}

// ── Card de Novos Contratos (checklist) ────────────────────────
function ContractCard({ deal, onOpen, onToggle, onMove }) {
  const b = deal.briefing || {};
  const cl = deal.csChecklist || {};
  const ready = canMoveToOnboarding(deal);

  const items = [
    {
      id: 'contract',
      label: 'Gerar Contrato',
      done: !!cl.contract?.done,
      confirmed: !!deal.signature?.done,
      confirmedLabel: 'assinado',
    },
    {
      id: 'payment',
      label: 'Gerar link de Pagamento',
      done: !!cl.payment?.done,
      confirmed: !!deal.paymentConfirmed?.done,
      confirmedLabel: 'pago',
    },
  ];

  return (
    <div style={{ ...CARD, border: `1px solid ${ready ? 'var(--green-b)' : `${COLOR}30`}` }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{b.companyName || deal.leadName}</p>
            {b.contactName && <p style={{ fontSize: 12, color: 'var(--muted)' }}>👤 {b.contactName}</p>}
          </div>
          <FileText size={15} color={COLOR} style={{ flexShrink: 0 }} />
        </div>
        {b.saleTotal != null && (
          <p style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700, marginTop: 8 }}>{money(b.saleTotal)}</p>
        )}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
          {(b.servicesSummary || []).map(s => <Tag key={s.id} text={s.label} color={COLOR} />)}
        </div>
      </button>

      {/* Checklist */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(it => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <button
              onClick={() => onToggle(it.id, !it.done)}
              disabled={it.confirmed}
              title={it.confirmed ? 'Já confirmado no painel' : ''}
              style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                border: `1px solid ${it.done ? 'var(--green-b)' : 'var(--border)'}`,
                background: it.done ? 'var(--green-dim)' : 'var(--surface)',
                color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: it.confirmed ? 'not-allowed' : 'pointer', opacity: it.confirmed ? .6 : 1,
              }}
            >
              {it.done && <Check size={13} />}
            </button>
            <span style={{ fontSize: 13, color: it.done ? 'var(--text)' : 'var(--muted)', flex: 1 }}>{it.label}</span>
            {it.confirmed && <Tag text={it.confirmedLabel.toUpperCase()} color="var(--green)" />}
          </div>
        ))}
      </div>

      <button
        onClick={onMove}
        disabled={!ready}
        style={{
          ...BTN_GREEN, width: '100%', marginTop: 14,
          opacity: ready ? 1 : .4, cursor: ready ? 'pointer' : 'not-allowed',
          background: ready ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'var(--surface)',
          color: ready ? '#fff' : 'var(--muted)',
          border: ready ? 'none' : '1px solid var(--border)',
        }}
      >
        Mover para Onboarding
      </button>
      {!ready && (
        <p style={{ fontSize: 10, color: '#666', marginTop: 6, textAlign: 'center', lineHeight: 1.4 }}>
          Libera quando assinatura e pagamento forem confirmados nos painéis.
        </p>
      )}
    </div>
  );
}

// ── Card dos painéis de Assinatura / Pagamento ─────────────────
function PendingCard({ deal, label, since, actionLabel, onOpen, onConfirm }) {
  const b = deal.briefing || {};
  const days = since ? Math.floor((Date.now() - new Date(since).getTime()) / 86400000) : null;

  return (
    <div style={{ ...CARD, border: '1px solid var(--amber-b)' }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{b.companyName || deal.leadName}</p>
          <Tag text={label.toUpperCase()} color="var(--amber)" />
        </div>
        {b.contactName && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>👤 {b.contactName}</p>}
        {b.contactPhone && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>📞 {b.contactPhone}</p>}
        {b.saleTotal != null && <p style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700, marginTop: 8 }}>{money(b.saleTotal)}</p>}
        {days != null && (
          <p style={{ fontSize: 11, color: days >= 3 ? 'var(--neon)' : '#666', fontFamily: 'var(--fm)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> há {days} dia{days !== 1 ? 's' : ''}
          </p>
        )}
      </button>
      <button style={{ ...BTN_GREEN, width: '100%', marginTop: 12 }} onClick={onConfirm}>
        ✓ {actionLabel}
      </button>
    </div>
  );
}

// ── Card do Onboarding ─────────────────────────────────────────
function OnboardingCard({ deal, onOpen, onReschedule, onDone }) {
  const b = deal.briefing || {};
  const at = deal.onboardingCall?.at;
  const when = at ? new Date(at) : null;
  const past = when && when < new Date();

  return (
    <div style={{ ...CARD, border: `1px solid ${past ? 'var(--amber-b)' : `${COLOR}30`}` }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{b.companyName || deal.leadName}</p>
          {past && <Tag text="CALL PASSOU" color="var(--amber)" />}
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, color: past ? 'var(--amber)' : COLOR, fontFamily: 'var(--fm)', marginTop: 10 }}>
          📅 {fmtDateTime(at)}
        </p>
        {b.contactName && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>👤 {b.contactName}</p>}
      </button>

      {deal.onboardingCall?.meetLink && (
        <a href={deal.onboardingCall.meetLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, padding: '9px', borderRadius: 9, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          <Video size={14} /> Abrir call
        </a>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button style={{ ...BTN_PRIMARY, flex: 1, fontSize: 12 }} onClick={onDone}>Call realizada</button>
        <button style={BTN_CANCEL} onClick={onReschedule}>Reagendar</button>
      </div>
    </div>
  );
}

// ── Drawer com o contrato completo ─────────────────────────────
function ContractDrawer({ deal, onClose }) {
  const b = deal.briefing || {};
  const pay = b.payment || {};

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 620 }}>
        <ModalHeader title={b.companyName || deal.leadName} onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8, marginBottom: 16 }}>
          Fechado por {deal.closerName || '—'}{deal.secondCloser ? ` + ${deal.secondCloser}` : ''}
          {deal.wonAt ? ` · ${fmtDateTime(deal.wonAt)}` : ''}
        </p>

        <Section title="Cliente" color={COLOR}>
          <RO label="Nome Fantasia / Empresa" value={b.companyName} />
          <RO label="CNPJ" value={b.companyCnpj || b.docId} />
          <RO label="Nome do Responsável" value={b.contactName} />
          <RO label="CPF" value={b.contactCpf} />
          <RO label="Telefone" value={b.contactPhone} />
          <RO label="E-mail" value={b.contactEmail} />
          <RO label="Endereço" value={b.address} block />
        </Section>

        <Section title="Serviços contratados" color={COLOR}>
          {(b.servicesSummary || []).length === 0
            ? <p style={{ fontSize: 13, color: 'var(--muted)' }}>—</p>
            : b.servicesSummary.map(s => (
                <div key={s.id} style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginTop: 3, whiteSpace: 'pre-wrap' }}>{s.desc}</p>
                </div>
              ))}
        </Section>

        <Section title="Financeiro" color={COLOR}>
          <RO label="Valor total" value={b.saleTotal != null ? money(b.saleTotal) : null} />
          <RO label="Forma de pagamento" value={pay.method} />
          <RO label="Condição" value={
            pay.type === 'avista' ? 'À vista'
            : pay.custom ? `A prazo — ${pay.plan}`
            : pay.installments ? `${pay.installments}x de ${money(pay.installmentValue)}` : null
          } />
          <RO label="Duração do contrato" value={b.contractMonths ? `${b.contractMonths} meses` : null} />
        </Section>

        {b.briefing && (
          <Section title="Briefing" color={COLOR}>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{b.briefing}</p>
          </Section>
        )}
        {b.observations && (
          <Section title="Observações" color={COLOR}>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{b.observations}</p>
          </Section>
        )}

        <Section title="Progresso no CS" color={COLOR}>
          <Progress label="Contrato gerado" done={deal.csChecklist?.contract?.done} by={deal.csChecklist?.contract?.by} at={deal.csChecklist?.contract?.at} />
          <Progress label="Contrato assinado" done={deal.signature?.done} by={deal.signature?.by} at={deal.signature?.at} />
          <Progress label="Link de pagamento gerado" done={deal.csChecklist?.payment?.done} by={deal.csChecklist?.payment?.by} at={deal.csChecklist?.payment?.at} />
          <Progress label="Pagamento confirmado" done={deal.paymentConfirmed?.done} by={deal.paymentConfirmed?.by} at={deal.paymentConfirmed?.at} />
          <Progress label="Call de onboarding" done={!!deal.onboardingCall?.at} by={deal.onboardingCall?.by} at={deal.onboardingCall?.at} />
        </Section>
      </div>
    </Overlay>
  );
}

function Progress({ label, done, by, at }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: done ? 'var(--text)' : 'var(--muted)' }}>
        {done ? '✓' : '○'} {label}
      </span>
      <span style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)' }}>
        {done ? `${by || ''} ${at ? fmtDateTime(at) : ''}` : 'pendente'}
      </span>
    </div>
  );
}
