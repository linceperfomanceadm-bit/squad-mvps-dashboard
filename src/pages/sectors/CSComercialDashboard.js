import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  LayoutDashboard, UserPlus, ClipboardList, Kanban, MessageSquare,
  Calendar, Clock, Trash2, Rocket, Lock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useTasks } from '../../hooks/useTasks';
import { useRequests } from '../../hooks/useRequests';
import Sidebar from '../../components/shared/Sidebar';
import AgendaView from '../../components/shared/AgendaView';
import TaskKanban from '../../components/kanban/TaskKanban';
import CSRequests from '../../components/commercial/CSRequests';
import ClientRegisterForm from '../../components/commercial/ClientRegisterForm';
import ClientOnboardingModal from '../../components/commercial/ClientOnboardingModal';
import { SECTORS, STAFFING_ALERT_DAYS, stageOf } from '../../lib/firebase';
import {
  Overlay, ModalHeader, ConfirmModal, ScheduleModal, Stat, Tag, Empty, Spinner,
  money, fmtDate, fmtDateTime, toLocalInput,
  CARD, GRID, MODAL, BTN_PRIMARY, BTN_CANCEL,
} from '../../components/commercial/ui';

const COLOR = SECTORS.cs.color;
const KICKOFF_COLOR = '#a78bfa';
const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/*
 * CS COMERCIAL — a porta de entrada do cliente no app.
 *
 *  1. Cadastrar Cliente → formulário completo. Ao salvar, o cliente
 *     nasce em `staffing`, invisível para os setores, já com o CS
 *     Operacional responsável definido.
 *  2. Acompanhamento   → clientes em staffing, com o que falta em
 *     cada um. É daqui que a CS cobra os líderes que estão travando.
 *  3. Kick Off         → clientes com o quadro fechado. É aqui que a
 *     CS Comercial agenda a call de Kick Off, feita junto com a CS
 *     Operacional, e marca quando ela acontece. Depois disso o
 *     cliente segue acompanhado, em leitura, até entrar de vez na
 *     base.
 *  4. Produção         → leitura do Kanban de todos os clientes.
 *  5. Solicitações     → Reporte da CS para os times.
 */
export default function CSComercialDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    clients, loading, addClient, cancelStaffing, pendingSectorsOf, uploadClientFile,
    scheduleKickoffCall, cancelKickoffCall, confirmKickoffCall,
  } = useClients();
  const { collaborators } = useCollaborators();
  const {
    tasks, moveToProduction, moveToApproval, approveTask, rejectTask,
    addComment, updateLinks, deleteTask, changeDeadline,
  } = useTasks();
  const {
    requests, createRequest, addReply, closeRequest, deleteRequest,
  } = useRequests();

  const [page, setPage] = useState('register');
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const me = user?.name;

  const activeClients = useMemo(() => clients.filter(c => c.active !== false), [clients]);

  // Clientes cadastrados que ainda esperam os líderes.
  const emStaffing = useMemo(() => clients
    .filter(c => stageOf(c) === 'staffing')
    .sort((a, b) => new Date(a.staffing?.startedAt || 0) - new Date(b.staffing?.startedAt || 0)),
    [clients]);

  // Quadro fechado: a call de Kick Off é responsabilidade desta tela.
  const emKickoff = useMemo(() => clients
    .filter(c => stageOf(c) === 'kickoff')
    .sort((a, b) => {
      const aa = a.kickoffCall?.at ? new Date(a.kickoffCall.at).getTime() : Infinity;
      const bb = b.kickoffCall?.at ? new Date(b.kickoffCall.at).getTime() : Infinity;
      return aa - bb;
    }),
    [clients]);

  // Kick Off já feito: a CS Comercial acompanha em leitura até o
  // cliente entrar definitivamente na base.
  const emOnboarding = useMemo(() => clients
    .filter(c => stageOf(c) === 'onboarding')
    .sort((a, b) => {
      const aa = a.kickoff?.at ? new Date(a.kickoff.at).getTime() : Infinity;
      const bb = b.kickoff?.at ? new Date(b.kickoff.at).getTime() : Infinity;
      return aa - bb;
    }),
    [clients]);

  const kickoffSemAgenda = emKickoff.filter(c => !c.kickoffCall?.at).length;
  const staffingAtrasado = emStaffing.filter(c => {
    const at = c.staffing?.startedAt;
    if (!at) return false;
    return Math.floor((Date.now() - new Date(at).getTime()) / 86400000) >= STAFFING_ALERT_DAYS;
  }).length;

  const ativadosNoMes = useMemo(() => {
    const now = new Date();
    return clients.filter(c => {
      const at = c.kickoff?.confirmedAt;
      if (!at) return false;
      const d = new Date(at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [clients]);

  const requestsToClose = requests.filter(r => r.status === 'answered').length;
  const openClient = openId ? clients.find(c => c.id === openId) || null : null;

  const NAV = [
    { key: 'register',  label: 'Cadastrar Cliente', icon: UserPlus },
    { key: 'staffing',  label: 'Acompanhamento',    icon: ClipboardList, badge: emStaffing.length, badgeDanger: staffingAtrasado > 0 },
    { key: 'kickoff',   label: 'Kick Off',          icon: Rocket, badge: emKickoff.length + emOnboarding.length, badgeDanger: kickoffSemAgenda > 0 },
    { key: 'kanban',    label: 'Produção',          icon: Kanban },
    { key: 'requests',  label: 'Solicitações',      icon: MessageSquare, badge: requestsToClose, badgeDanger: requestsToClose > 0 },
    { key: 'overview',  label: 'Visão Geral',       icon: LayoutDashboard },
    { key: 'agenda',    label: 'Agenda',            icon: Calendar },
  ];

  const HEAD = {
    register: ['Cadastrar Cliente', 'A entrada do cliente na agência. Depois de salvar, os líderes indicam os responsáveis.'],
    staffing: ['Acompanhamento', 'Clientes cadastrados aguardando os líderes indicarem os responsáveis'],
    kickoff:  ['Kick Off', 'Agende e realize a call de Kick Off com a CS Operacional'],
    kanban:   ['Produção dos Clientes', 'Acompanhamento em tempo real — leitura e comentário, sem mover card'],
    requests: ['Reporte da CS', 'Solicitações abertas para os times de produção'],
    overview: ['Visão Geral', 'Entrada de clientes no mês'],
    agenda:   ['Agenda', ''],
  };

  const handleAdd = async (clientData) => {
    const res = await addClient({ ...clientData, staffing: { ...clientData.staffing, by: me } });
    if (!res.success) { toast(res.error, 'e'); return res; }
    toast(`${clientData.name} cadastrado! Aguardando os líderes indicarem os responsáveis.`);
    setShowForm(false);
    setPage('staffing');
    return res;
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

            {page === 'overview' && (
              <div className="fade-up">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
                  <Stat label="Aguardando responsáveis" value={emStaffing.length} color="var(--amber)" />
                  <Stat label="Aguardando Kick Off" value={emKickoff.length} color={KICKOFF_COLOR} />
                  <Stat label="Em onboarding" value={emOnboarding.length} color="var(--blue)" />
                  <Stat label="Entraram no mês" value={ativadosNoMes} color="var(--green)" />
                </div>
                <div style={CARD}>
                  <p style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>VALOR EM CONTRATOS ENTRANDO</p>
                  <p style={{ fontSize: 30, fontWeight: 800, color: 'var(--green)', marginTop: 8 }}>
                    {money([...emStaffing, ...emKickoff, ...emOnboarding].reduce((sum, c) => sum + (Number(c.contrato?.saleTotal ?? c.saleTotal) || 0), 0))}
                  </p>
                  <p style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
                    Soma dos clientes que ainda não concluíram a call de onboarding.
                  </p>
                </div>
              </div>
            )}

            {page === 'register' && (
              <div className="fade-up" style={{ ...CARD, maxWidth: 560 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Novo cliente</p>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 16 }}>
                  Preencha os dados do contrato fechado, escolha o CS Operacional responsável e marque
                  os setores envolvidos. O cliente entra invisível para os times até que o líder de
                  cada setor marcado indique um responsável. Com o quadro fechado, ele aparece aqui na
                  aba Kick Off para você agendar a call.
                </p>
                <button style={{ ...BTN_PRIMARY, width: '100%' }} onClick={() => setShowForm(true)}>
                  + Cadastrar cliente
                </button>
              </div>
            )}

            {page === 'staffing' && (
              emStaffing.length === 0
                ? <Empty msg="Nenhum cliente aguardando indicação. ✨" />
                : (
                  <div style={GRID}>
                    {emStaffing.map(c => (
                      <StaffingWatchCard
                        key={c.id}
                        client={c}
                        pendentes={pendingSectorsOf(c)}
                        onOpen={() => setOpenId(c.id)}
                        onDelete={() => setDeleteTarget(c)}
                      />
                    ))}
                  </div>
                )
            )}

            {page === 'kickoff' && (
              (emKickoff.length === 0 && emOnboarding.length === 0)
                ? <Empty msg="Nenhum cliente aguardando Kick Off. ✨" />
                : (
                  <>
                    {emKickoff.length > 0 && (
                      <Bloco
                        title="Aguardando Kick Off"
                        sub="Quadro de responsáveis fechado. Agende a call com a CS Operacional e marque quando ela acontecer."
                        color={KICKOFF_COLOR}
                      >
                        <div style={GRID}>
                          {emKickoff.map(c => (
                            <KickoffCard
                              key={c.id}
                              client={c}
                              onOpen={() => setOpenId(c.id)}
                              onSchedule={() => setScheduleTarget(c)}
                              onCancel={() => setCancelTarget(c)}
                              onConfirm={async () => {
                                const r = await confirmKickoffCall(c.id, me);
                                if (r.success) toast(`Kick Off de ${c.name} concluído! Agora é com a CS Operacional. 🚀`);
                                else toast(r.error, 'e');
                              }}
                            />
                          ))}
                        </div>
                      </Bloco>
                    )}

                    {emOnboarding.length > 0 && (
                      <Bloco
                        title="Em onboarding com a CS Operacional"
                        sub="Kick Off realizado. Acompanhamento em leitura até o cliente entrar definitivamente na base."
                        color={COLOR}
                      >
                        <div style={GRID}>
                          {emOnboarding.map(c => (
                            <OnboardingWatchCard key={c.id} client={c} onOpen={() => setOpenId(c.id)} />
                          ))}
                        </div>
                      </Bloco>
                    )}
                  </>
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

            {page === 'agenda' && <AgendaView />}
          </>
        )}
      </main>

      {/* Cadastro de cliente */}
      {showForm && ReactDOM.createPortal(
        <Overlay onClose={() => setShowForm(false)}>
          <div style={{ ...MODAL, maxWidth: 660 }}>
            <ModalHeader title="Cadastrar Cliente" onClose={() => setShowForm(false)} />
            <ClientRegisterForm
              onSubmit={handleAdd}
              onUpload={uploadClientFile}
              onCancel={() => setShowForm(false)}
              collaborators={collaborators}
            />
          </div>
        </Overlay>, document.body)}

      {/* Detalhe do cliente. Só ganha botão de ação quando está no
          estágio de Kick Off — no resto é leitura. */}
      {openClient && (
        <ClientOnboardingModal
          client={openClient}
          onClose={() => setOpenId(null)}
          onScheduleKickoff={stageOf(openClient) === 'kickoff'
            ? () => { setScheduleTarget(openClient); setOpenId(null); }
            : undefined}
          onCancelKickoff={stageOf(openClient) === 'kickoff' && openClient.kickoffCall?.at
            ? () => { setCancelTarget(openClient); setOpenId(null); }
            : undefined}
          onConfirmKickoffCall={stageOf(openClient) === 'kickoff' && openClient.kickoffCall?.at
            ? async () => {
              const r = await confirmKickoffCall(openClient.id, me);
              if (r.success) toast(`Kick Off de ${openClient.name} concluído! 🚀`);
              else toast(r.error, 'e');
              setOpenId(null);
            }
            : undefined}
        />
      )}

      {/* Agendar / reagendar Kick Off */}
      {scheduleTarget && ReactDOM.createPortal(
        <ScheduleModal
          title={scheduleTarget.kickoffCall?.at ? 'Reagendar Kick Off' : 'Agendar Kick Off'}
          subtitle={`Call de Kick Off com ${scheduleTarget.name}, feita em conjunto com a CS Operacional. Depois de salvar, use o botão "Adicionar à agenda" no card para lançar o evento no Google Agenda.`}
          initialAt={toLocalInput(scheduleTarget.kickoffCall?.at)}
          initialLink={scheduleTarget.kickoffCall?.meetLink || ''}
          confirmLabel={scheduleTarget.kickoffCall?.at ? 'Reagendar' : 'Agendar call'}
          onClose={() => setScheduleTarget(null)}
          onConfirm={async (at, link) => {
            const r = await scheduleKickoffCall(scheduleTarget.id, me, at, link);
            if (r.success) toast('Kick Off agendado!');
            else toast(r.error, 'e');
            setScheduleTarget(null);
          }}
        />, document.body)}

      {/* Cancelar agendamento do Kick Off */}
      {cancelTarget && ReactDOM.createPortal(
        <ConfirmModal
          title="Cancelar agendamento"
          text={`Desmarcar a call de Kick Off de ${cancelTarget.name}? O cliente volta para "aguardando agendamento" — o cadastro não é apagado.`}
          confirmLabel="Desmarcar call"
          onClose={() => setCancelTarget(null)}
          onConfirm={async () => {
            const r = await cancelKickoffCall(cancelTarget.id);
            if (r.success) toast('Agendamento desmarcado.');
            else toast(r.error, 'e');
            setCancelTarget(null);
          }}
        />, document.body)}

      {/* Cancelar cadastro */}
      {deleteTarget && ReactDOM.createPortal(
        <ConfirmModal
          title="Cancelar cadastro"
          text={`Apagar o cadastro de ${deleteTarget.name}? Só é possível enquanto nenhum setor indicou responsável.`}
          confirmLabel="Cancelar cadastro"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const r = await cancelStaffing(deleteTarget.id);
            if (r.success) toast('Cadastro cancelado.');
            else toast(r.error, 'e');
            setDeleteTarget(null);
          }}
        />, document.body)}

    </div>
  );
}

function Bloco({ title, sub, color, children }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ width: 3, height: 15, background: color, borderRadius: 2 }} />
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{title}</h2>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>{sub}</p>
      {children}
    </div>
  );
}

// ── Card de acompanhamento do staffing ─────────────────────────
function StaffingWatchCard({ client, pendentes, onOpen, onDelete }) {
  const contrato = client.contrato || {};
  const exigidos = client.staffing?.sectors || [];
  const prontos = exigidos.filter(s => !pendentes.includes(s));
  const dias = client.staffing?.startedAt
    ? Math.floor((Date.now() - new Date(client.staffing.startedAt).getTime()) / 86400000)
    : null;
  const atrasado = dias != null && dias >= STAFFING_ALERT_DAYS;
  const semIndicacao = prontos.length === 0;

  return (
    <div style={{ ...CARD, border: `1px solid ${atrasado ? 'var(--neon-border)' : 'var(--amber-b)'}` }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{client.name}</p>
          <Tag text={`${prontos.length}/${exigidos.length} SETORES`} color={atrasado ? 'var(--neon)' : 'var(--amber)'} />
        </div>

        {contrato.contactName && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>👤 {contrato.contactName}</p>}
        {contrato.saleTotal != null && (
          <p style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700, marginTop: 8 }}>{money(contrato.saleTotal)}</p>
        )}

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)', marginBottom: 7 }}>QUADRO DE RESPONSÁVEIS</p>
          {exigidos.map(sid => {
            const nomes = asArray(client.responsibles?.[sid]);
            const ok = nomes.length > 0;
            return (
              <div key={sid} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: ok ? (SECTORS[sid]?.color || 'var(--text)') : 'var(--muted)' }}>
                  {ok ? '✓' : '○'} {SECTORS[sid]?.emoji} {SECTORS[sid]?.label || sid}
                </span>
                <span style={{ fontSize: 11, color: ok ? '#bbb' : 'var(--amber)', fontFamily: 'var(--fm)', textAlign: 'right' }}>
                  {ok ? nomes.join(', ') : 'pendente'}
                </span>
              </div>
            );
          })}
          {asArray(client.responsibles?.cs).length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: COLOR }}>🎧 CS Operacional</span>
              <span style={{ fontSize: 11, color: '#bbb', fontFamily: 'var(--fm)' }}>{asArray(client.responsibles.cs).join(', ')}</span>
            </div>
          )}
        </div>

        {dias != null && (
          <p style={{ fontSize: 11, color: atrasado ? 'var(--neon)' : '#666', fontFamily: 'var(--fm)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> cadastrado há {dias} dia{dias !== 1 ? 's' : ''}
            {client.staffing?.startedAt ? ` · ${fmtDate(client.staffing.startedAt)}` : ''}
          </p>
        )}
      </button>

      {semIndicacao && (
        <button
          onClick={onDelete}
          style={{ ...BTN_CANCEL, width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
        >
          <Trash2 size={13} color="rgba(238,51,99,.7)" /> Cancelar cadastro
        </button>
      )}
    </div>
  );
}

// ── Card do Kick Off (ação da CS Comercial) ────────────────────
function KickoffCard({ client, onOpen, onSchedule, onCancel, onConfirm }) {
  const contrato = client.contrato || {};
  const call = client.kickoffCall || {};
  const agendada = !!call.at;
  const passou = agendada && new Date(call.at) < new Date();

  return (
    <div style={{ ...CARD, border: `1px solid ${agendada ? (passou ? 'var(--amber-b)' : `${KICKOFF_COLOR}40`) : 'var(--border)'}` }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{client.name}</p>
          {agendada
            ? <Tag text={passou ? 'CALL PASSOU' : 'AGENDADO'} color={passou ? 'var(--amber)' : KICKOFF_COLOR} />
            : <Tag text="AGUARDANDO AGENDAMENTO" color="var(--muted)" />}
        </div>

        {agendada ? (
          <p style={{ fontSize: 13, fontWeight: 700, color: passou ? 'var(--amber)' : KICKOFF_COLOR, fontFamily: 'var(--fm)', marginTop: 10 }}>
            📅 {fmtDateTime(call.at)}
          </p>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
            Quadro de responsáveis completo. Defina data e hora da call.
          </p>
        )}

        {contrato.contactName && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>👤 {contrato.contactName}</p>}
        {asArray(client.responsibles?.cs).length > 0 && (
          <p style={{ fontSize: 11, color: COLOR, fontFamily: 'var(--fm)', marginTop: 6 }}>
            🎧 CS: {asArray(client.responsibles.cs).join(', ')}
          </p>
        )}
      </button>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {!agendada && (
          <button style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onSchedule}>Agendar call</button>
        )}
        {agendada && (
          <>
            <button style={{ ...BTN_CANCEL, flex: 1 }} onClick={onSchedule}>Reagendar</button>
            <button style={BTN_CANCEL} onClick={onCancel}>Desmarcar</button>
            <button
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: 10, padding: '11px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' }}
              onClick={onConfirm}
            >
              ✓ Call realizada
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Card de acompanhamento pós Kick Off (leitura) ──────────────
function OnboardingWatchCard({ client, onOpen }) {
  const contrato = client.contrato || {};
  const call = client.kickoff || {};
  const agendada = !!call.at;

  return (
    <button onClick={onOpen} style={{ ...CARD, textAlign: 'left', width: '100%', cursor: 'pointer', border: `1px solid ${agendada ? `${COLOR}40` : 'var(--border)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{client.name}</p>
        <Tag text={agendada ? 'ONBOARDING AGENDADO' : 'AGUARDANDO CS OPERACIONAL'} color={agendada ? COLOR : 'var(--muted)'} />
      </div>

      {agendada ? (
        <p style={{ fontSize: 13, fontWeight: 700, color: COLOR, fontFamily: 'var(--fm)', marginTop: 10 }}>
          📅 {fmtDateTime(call.at)}
        </p>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lock size={11} /> A CS Operacional ainda vai agendar a call de onboarding.
        </p>
      )}

      {contrato.contactName && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>👤 {contrato.contactName}</p>}
      {client.kickoffCall?.confirmedAt && (
        <p style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)', marginTop: 8 }}>
          Kick Off realizado em {fmtDate(client.kickoffCall.confirmedAt)}
        </p>
      )}
    </button>
  );
}
