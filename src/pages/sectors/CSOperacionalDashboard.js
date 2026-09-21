import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  LayoutDashboard, Rocket, Activity, HeartPulse, Calendar, X, UserPlus,
  Kanban, MessageSquare, Clock, Video, Bell, ListTodo, Trash2, Briefcase,
  ClipboardCheck, UsersRound, Target,
} from 'lucide-react';
import DayTasks from '../../components/shared/DayTasks';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useTasks } from '../../hooks/useTasks';
import { useRequests } from '../../hooks/useRequests';
import AppShell from '../../components/shared/AppShell';
import AgendaView from '../../components/shared/AgendaView';
import TaskKanban from '../../components/kanban/TaskKanban';
import TaskModal from '../../components/kanban/TaskModal';
import CSCarteira from '../../components/commercial/CSCarteira';
import CSRequests from '../../components/commercial/CSRequests';
import ClientRegisterForm from '../../components/commercial/ClientRegisterForm';
import ClientOnboardingModal from '../../components/commercial/ClientOnboardingModal';
import StaffingModal from '../../components/commercial/StaffingModal';
import ContractBlock from '../../components/commercial/ContractBlock';
import CSLiderPanel from '../../components/commercial/CSLiderPanel';
import ComercialPage from '../../components/commercial/ComercialPage';
import EntregasPainel from '../../components/entregas/EntregasPainel';
import ClienteFicha from '../../components/entregas/ClienteFicha';
import { acoesDeEntregas } from '../../components/entregas/acoes';
import { cadastroPendencias, entregasDoMes, resumoMes, mesChave } from '../../lib/entregas';
import { Aderencia } from '../../components/entregas/EntregasKit';
import { SECTORS, STAFFING_ALERT_DAYS, CADASTRO_PENDENCIAS, stageOf } from '../../lib/firebase';
import {
  computeOpsHealth, resolveClientHealth, isCritical,
  HEALTH_LEVELS_4, HEALTH_ORDER_4,
} from '../../hooks/useClientHealth';
import {
  Overlay, ModalHeader, ConfirmModal, ScheduleModal, Stat, Tag, Empty, Spinner, Section, RO,
  fmtDate, fmtDateTime, toLocalInput, money,
  CARD, GRID, MODAL, LBL, INP, BTN_PRIMARY, BTN_GREEN, BTN_CANCEL,
} from '../../components/commercial/ui';

const COLOR = 'var(--c)';
const KICKOFF_COLOR = 'var(--purple)';
const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const diasDesde = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);

/*
 * CS — painel único.
 *
 * A CS era dividida em Comercial e Operacional. Agora é um time só e
 * toda CS conduz o fluxo inteiro do cliente:
 *
 *  1. Cadastrar Cliente → formulário completo. O cliente nasce em
 *                         `kickoff`, invisível para os setores.
 *  2. Kick Off          → a CS agenda a call e marca quando ela
 *                         acontece. Enquanto nenhum setor indicou
 *                         ninguém, dá para cancelar o cadastro.
 *  3. Onboarding        → Kick Off realizado. Duas coisas correm em
 *                         paralelo no mesmo card:
 *                           · os líderes indicam os responsáveis (a
 *                             CS cobra quem está demorando);
 *                           · a CS agenda a call de onboarding — é o
 *                             agendamento que mostra o cliente ao time.
 *                         "Call realizada" só destrava com o quadro
 *                         completo. Aí o cliente entra na base.
 *  4. Carteira         → de quais clientes cada CS cuida: time, faróis,
 *                         contrato e tasks em aberto. Abre na carteira
 *                         de quem está logado, com filtro por CS.
 *  5. Saúde Operacional → farol AUTOMÁTICO por tasks em atraso.
 *  6. Saúde do Cliente  → farol MANUAL, alimentado pela CS.
 */
export default function CSOperacionalDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    clients, loading, addClient, cancelStaffing, uploadClientFile,
    scheduleKickoffCall, cancelKickoffCall, confirmKickoffCall,
    confirmKickoff, scheduleOnboarding, setClientHealth, pendingSectorsOf,
    setSectorResponsibles, nudgeSectorLeader,
    renameClient, addClientAttachment, removeClientAttachment,
    renewContract, closeContract, reopenContract,
    saveCadastro, saveEscopo, marcarEntrega, ajustarMesEntregas, transferirCS,
  } = useClients();
  const { collaborators } = useCollaborators();
  const {
    tasks, moveToProduction, moveToApproval, approveTask, rejectTask,
    addComment, updateLinks, deleteTask, changeDeadline,
  } = useTasks();
  const {
    requests, createRequest, addReply, closeRequest, deleteRequest,
  } = useRequests();

  const [page, setPage] = useState('onboarding');
  const [onlyMine, setOnlyMine] = useState(false);
  const [opsFilter, setOpsFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [healthTarget, setHealthTarget] = useState(null);
  const [flowId, setFlowId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [kickoffSchedule, setKickoffSchedule] = useState(null);
  const [kickoffCancel, setKickoffCancel] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [staffingTarget, setStaffingTarget] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [fichaId, setFichaId] = useState(null);

  const me = user?.name;
  // Líder da CS (que é o líder do comercial): entra pelo mesmo acesso da
  // CS e ganha a gestão do time e o comercial. O admin também vê.
  const isLider = !!user?.isAdmin || (Array.isArray(user?.leaderOf) && user.leaderOf.includes('cs'));

  // CS completa cadastro, define escopo, ajusta o mês e corrige marcação.
  const acoesEntregas = acoesDeEntregas(
    { saveCadastro, saveEscopo, uploadClientFile, marcarEntrega, ajustarMesEntregas },
    me, toast
  );
  // Setores que esta pessoa pode preencher: os que ela lidera (e todos,
  // se for admin). Sem isso, o quadro do card é só leitura.
  const mySectors = user?.isAdmin
    ? Object.keys(SECTORS)
    : (Array.isArray(user?.leaderOf) ? user.leaderOf : []);

  const activeClients = useMemo(
    () => clients.filter(c => c.active !== false),
    [clients]
  );

  // Responsável pode estar salvo como string (legado) ou array (multi).
  const isMine = (c) => asArray(c.responsibles?.cs).includes(me);
  const mineFilter = (c) => (onlyMine ? isMine(c) : true);

  // Carteira da pessoa — alimenta o filtro "Meus clientes" do Kanban.
  const myClientIds = useMemo(
    () => activeClients.filter(isMine).map(c => c.id),
    [activeClients, me] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 1ª etapa: recém-cadastrados, esperando a call de Kick Off.
  const kickoffClients = useMemo(
    () => clients
      .filter(c => stageOf(c) === 'kickoff')
      .sort((a, b) => {
        const aa = a.kickoffCall?.at ? new Date(a.kickoffCall.at).getTime() : Infinity;
        const bb = b.kickoffCall?.at ? new Date(b.kickoffCall.at).getTime() : Infinity;
        return aa - bb;
      }),
    [clients]
  );

  // 2ª etapa: Kick Off realizado. Staffing e agendamento do onboarding
  // correm juntos, então os dois estágios viram uma lista só. Primeiro
  // os que têm call marcada (pela data), depois os sem agenda (pelo
  // tempo desde o Kick Off).
  const flowClients = useMemo(
    () => clients
      .filter(c => ['staffing', 'onboarding'].includes(stageOf(c)))
      .sort((a, b) => {
        const aa = a.kickoff?.at ? new Date(a.kickoff.at).getTime() : Infinity;
        const bb = b.kickoff?.at ? new Date(b.kickoff.at).getTime() : Infinity;
        if (aa !== bb) return aa - bb;
        return new Date(a.staffing?.startedAt || 0) - new Date(b.staffing?.startedAt || 0);
      }),
    [clients]
  );

  const kickoffSemAgenda = kickoffClients.filter(c => !c.kickoffCall?.at).length;
  const onboardingSemAgenda = flowClients.filter(c => !c.kickoff?.at).length;
  const staffingAtrasado = flowClients.filter(c =>
    pendingSectorsOf(c).length > 0 && (diasDesde(c.staffing?.startedAt) ?? 0) >= STAFFING_ALERT_DAYS
  ).length;

  const ativadosNoMes = useMemo(() => {
    const now = new Date();
    return clients.filter(c => {
      const at = c.kickoff?.confirmedAt;
      if (!at) return false;
      const d = new Date(at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [clients]);

  const liveClients = useMemo(
    () => activeClients.filter(c => stageOf(c) === 'live').filter(mineFilter),
    [activeClients, onlyMine, me] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const withOps = useMemo(() => liveClients
    .map(c => ({ client: c, health: computeOpsHealth(c.id, tasks) }))
    .sort((a, b) => HEALTH_ORDER_4[a.health.level] - HEALTH_ORDER_4[b.health.level]),
    [liveClients, tasks]);

  const withManual = useMemo(() => liveClients
    .map(c => ({ client: c, health: resolveClientHealth(c) }))
    .sort((a, b) => {
      const ao = a.health.level ? HEALTH_ORDER_4[a.health.level] : 9;
      const bo = b.health.level ? HEALTH_ORDER_4[b.health.level] : 9;
      return ao - bo;
    }),
    [liveClients]);

  const opsCounts = useMemo(() => {
    const c = { green: 0, yellow: 0, orange: 0, red: 0 };
    withOps.forEach(w => { c[w.health.level]++; });
    return c;
  }, [withOps]);

  const criticalCount = useMemo(
    () => liveClients.filter(c => isCritical(c, tasks)).length,
    [liveClients, tasks]
  );

  const visibleOps = opsFilter === 'all' ? withOps : withOps.filter(w => w.health.level === opsFilter);

  // Busca em activeClients (e não em liveClients): a Carteira abre
  // clientes de outras CSs mesmo com "Meus clientes" ligado.
  const openClient = openId ? activeClients.find(c => c.id === openId && stageOf(c) === 'live') || null : null;
  // Task aberta pela Carteira — sempre do array vivo, para o chat
  // atualizar em tempo real.
  const openTask = taskId ? tasks.find(t => t.id === taskId) || null : null;
  const flowClient = flowId ? clients.find(c => c.id === flowId) || null : null;
  const flowStage = flowClient ? stageOf(flowClient) : null;
  const flowPosKickoff = flowStage === 'staffing' || flowStage === 'onboarding';

  // Solicitações que o colaborador já respondeu e esperam a CS encerrar.
  const requestsToClose = requests.filter(r => r.status === 'answered').length;

  // Clientes na base com cadastro incompleto (antigos, em geral).
  const cadastrosIncompletos = activeClients.filter(c => stageOf(c) === 'live' && cadastroPendencias(c).length > 0).length;
  const fichaClient = fichaId ? clients.find(c => c.id === fichaId) || null : null;

  const NAV = [
    { key: 'register',   label: 'Cadastrar Cliente', icon: UserPlus },
    { key: 'kickoff',    label: 'Kick Off', icon: Rocket, badge: kickoffClients.length, badgeDanger: kickoffSemAgenda > 0 },
    { key: 'onboarding', label: 'Onboarding de Clientes', icon: Rocket, badge: flowClients.length, badgeDanger: onboardingSemAgenda > 0 || staffingAtrasado > 0 },
    { key: 'carteira', label: 'Carteira de Clientes', icon: Briefcase },
    { key: 'entregas', label: 'Entregas × Contrato', icon: ClipboardCheck, badge: cadastrosIncompletos },
    { key: 'ops',      label: 'Saúde Operacional', icon: Activity,   badge: opsCounts.red, badgeDanger: opsCounts.red > 0 },
    { key: 'client',   label: 'Saúde do Cliente',  icon: HeartPulse },
    { key: 'kanban',   label: 'Produção',          icon: Kanban },
    { key: 'day',      label: 'Tarefas do Dia',   icon: ListTodo },
    { key: 'requests', label: 'Solicitações',      icon: MessageSquare, badge: requestsToClose, badgeDanger: requestsToClose > 0 },
    { key: 'overview', label: 'Visão Geral',       icon: LayoutDashboard },
    ...(isLider ? [
      { key: 'time',      label: 'Gestão do Time', icon: UsersRound },
      { key: 'comercial', label: 'Comercial',      icon: Target },
    ] : []),
    { key: 'agenda',   label: 'Agenda',            icon: Calendar },
  ];

  const HEAD = {
    register:    ['Cadastrar Cliente', 'A entrada do cliente na agência. Depois de salvar, ele vai para o Kick Off.'],
    kickoff:     ['Kick Off', 'Agende a call de Kick Off e marque quando ela acontecer'],
    onboarding:  ['Onboarding de Clientes', 'Agende a call de onboarding enquanto os líderes indicam o time'],
    carteira: ['Carteira de Clientes', 'Quem você atende, com o time, a saúde e as tasks em aberto de cada cliente'],
    ops:      ['Saúde Operacional', 'Farol automático pelas tasks em atraso de cada cliente'],
    client:   ['Saúde do Cliente', 'Farol manual — relacionamento e pendências por parte do cliente'],
    kanban:   ['Produção dos Clientes', 'Acompanhamento em tempo real — leitura e comentário, sem mover card'],
    requests: ['Reporte da CS', 'Solicitações abertas para os times de produção'],
    overview: ['Visão Geral', 'Carteira e entrada de clientes em números'],
    entregas: ['Entregas × Contrato', 'O que cada contrato prevê no mês contra o que já foi entregue'],
    time:     ['', ''],   // o painel do líder desenha o próprio título
    comercial: ['', ''],
    day:      ['', ''],   // o DayTasks desenha o próprio título
    agenda:   ['Agenda', ''],
  };

  const handleAdd = async (clientData) => {
    const res = await addClient({ ...clientData, staffing: { ...clientData.staffing, by: me } });
    if (!res.success) { toast(res.error, 'e'); return res; }
    toast(`${clientData.name} cadastrado! Agora é agendar o Kick Off.`);
    setShowForm(false);
    setPage('kickoff');
    return res;
  };

  const confirmarKickoff = async (c) => {
    const r = await confirmKickoffCall(c.id, me);
    if (r.success) toast(`Kick Off de ${c.name} concluído! Os líderes já podem indicar o time. 🚀`);
    else toast(r.error, 'e');
    return r;
  };

  const confirmarOnboarding = async (c) => {
    const r = await confirmKickoff(c.id, me);
    if (r.success) toast(`${c.name} entrou na base! 🚀`);
    else toast(r.error, 'e');
    return r;
  };

  const cobrar = async (c, sid) => {
    const r = await nudgeSectorLeader(c.id, sid, me);
    if (r.success) toast(`Líder de ${SECTORS[sid]?.label || sid} cobrado.`);
    else toast(r.error, 'e');
  };

  return (
    <AppShell sectorId="cs" navItems={NAV} activeKey={page} onNav={setPage}>
        {loading ? <Spinner /> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 12 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `color-mix(in srgb, ${COLOR} 10%, transparent)`, color: COLOR, border: `1px solid color-mix(in srgb, ${COLOR} 25%, transparent)`, fontFamily: 'var(--fm)' }}>🎧 CS OPERACIONAL</span>
                {HEAD[page]?.[0] && <h1 style={{ fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em', marginTop: 10, marginBottom: 4 }}>{HEAD[page][0]}</h1>}
                {HEAD[page]?.[1] && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{HEAD[page][1]}</p>}
              </div>
              {['ops', 'client', 'overview'].includes(page) && (
                <button
                  onClick={() => setOnlyMine(v => !v)}
                  style={{ background: onlyMine ? `color-mix(in srgb, ${COLOR} 13%, transparent)` : 'var(--surface)', border: `1px solid ${onlyMine ? `color-mix(in srgb, ${COLOR} 33%, transparent)` : 'var(--border)'}`, borderRadius: 9, padding: '9px 14px', color: onlyMine ? COLOR : 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {onlyMine ? '✓ Meus clientes' : 'Meus clientes'}
                </button>
              )}
            </div>

            {page === 'overview' && (
              <div className="fade-up">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
                  <Stat label="Clientes ativos" value={liveClients.length} color={COLOR} />
                  <Stat label="Saúde crítica" value={criticalCount} color={criticalCount > 0 ? 'var(--red)' : 'var(--muted)'} hint="Vermelho no farol operacional ou no farol do cliente" />
                  <Stat label="Aguardando Kick Off" value={kickoffClients.length} color={KICKOFF_COLOR} />
                  <Stat label="Em onboarding" value={flowClients.length} color="var(--amber)" />
                  <Stat label="Entraram no mês" value={ativadosNoMes} color="var(--green)" />
                  <Stat label="Em dia (operacional)" value={opsCounts.green} color="var(--green)" />
                </div>
                <div style={CARD}>
                  <p style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>VALOR EM CONTRATOS ENTRANDO</p>
                  <p style={{ fontSize: 30, fontWeight: 600, color: 'var(--green)', marginTop: 8 }}>
                    {money([...kickoffClients, ...flowClients].reduce((sum, c) => sum + (Number(c.contrato?.saleTotal ?? c.saleTotal) || 0), 0))}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    Soma dos clientes que ainda não concluíram a call de onboarding.
                  </p>
                </div>
              </div>
            )}

            {page === 'register' && (
              <div className="fade-up" style={{ ...CARD, maxWidth: 560 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>Novo cliente</p>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 16 }}>
                  Preencha os dados do contrato fechado, escolha a CS responsável e marque os setores
                  envolvidos. O cliente entra invisível para os times e cai na aba Kick Off. Depois da
                  call de Kick Off, os líderes indicam os responsáveis enquanto você agenda o onboarding.
                </p>
                <button style={{ ...BTN_PRIMARY, width: '100%' }} onClick={() => setShowForm(true)}>
                  + Cadastrar cliente
                </button>
              </div>
            )}

            {page === 'kickoff' && (
              kickoffClients.length === 0
                ? <Empty msg="Nenhum cliente aguardando Kick Off. ✨" />
                : (
                  <Bloco
                    title="Aguardando Kick Off"
                    sub="Recém-cadastrados. Agende a call e marque quando ela acontecer — aí os líderes já podem indicar o time."
                    color={KICKOFF_COLOR}
                  >
                    <div style={GRID}>
                      {kickoffClients.map(c => (
                        <KickoffCallCard
                          key={c.id}
                          client={c}
                          onOpen={() => setFlowId(c.id)}
                          onSchedule={() => setKickoffSchedule(c)}
                          onCancel={() => setKickoffCancel(c)}
                          onDelete={() => setDeleteTarget(c)}
                          onConfirm={() => confirmarKickoff(c)}
                        />
                      ))}
                    </div>
                  </Bloco>
                )
            )}

            {page === 'onboarding' && (
              flowClients.length === 0
                ? <Empty msg="Nenhum cliente aguardando onboarding. ✨" />
                : (
                  <Bloco
                    title="Kick Off realizado"
                    sub="Agende a call de onboarding — é o agendamento que mostra o cliente ao time. Enquanto isso, os líderes indicam os responsáveis. A call só pode ser dada como realizada com o quadro completo."
                    color={COLOR}
                  >
                    <div style={GRID}>
                      {flowClients.map(c => {
                        const pendentes = pendingSectorsOf(c);
                        const meus = pendentes.filter(sid => mySectors.includes(sid));
                        return (
                          <FlowCard
                            key={c.id}
                            client={c}
                            pendentes={pendentes}
                            meus={meus}
                            onOpen={() => setFlowId(c.id)}
                            onSchedule={() => setScheduleTarget(c)}
                            onConfirm={() => confirmarOnboarding(c)}
                            onStaff={meus.length ? () => setStaffingTarget({ client: c, sectors: meus }) : null}
                            onNudge={(sid) => cobrar(c, sid)}
                          />
                        );
                      })}
                    </div>
                  </Bloco>
                )
            )}

            {page === 'carteira' && (
              <CSCarteira
                clients={clients}
                tasks={tasks}
                collaborators={collaborators}
                me={me}
                onOpenClient={(c) => (stageOf(c) === 'live' ? setOpenId(c.id) : setFlowId(c.id))}
                onOpenTask={setTaskId}
              />
            )}

            {page === 'ops' && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                  <Chip active={opsFilter === 'all'} onClick={() => setOpsFilter('all')} label={`Todos (${withOps.length})`} />
                  {['red', 'orange', 'yellow', 'green'].map(l => (
                    <Chip
                      key={l}
                      active={opsFilter === l}
                      onClick={() => setOpsFilter(l)}
                      color={HEALTH_LEVELS_4[l].color}
                      label={`${HEALTH_LEVELS_4[l].emoji} ${HEALTH_LEVELS_4[l].label} (${opsCounts[l]})`}
                    />
                  ))}
                </div>
                {visibleOps.length === 0
                  ? <Empty msg="Nenhum cliente nesse filtro." />
                  : (
                    <div style={GRID}>
                      {visibleOps.map(({ client, health }) => (
                        <OpsCard key={client.id} client={client} health={health} onClick={() => setOpenId(client.id)} />
                      ))}
                    </div>
                  )}
              </>
            )}

            {page === 'client' && (
              liveClients.length === 0
                ? <Empty msg="Nenhum cliente ativo na sua visão." />
                : (
                  <div style={GRID}>
                    {withManual.map(({ client, health }) => (
                      <ClientHealthCard
                        key={client.id}
                        client={client}
                        health={health}
                        onSet={() => setHealthTarget(client)}
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

            {page === 'day' && <DayTasks toast={toast} />}

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

            {page === 'entregas' && (
              <EntregasPainel clients={clients} acoes={acoesEntregas} toast={toast} />
            )}

            {page === 'time' && isLider && (
              <CSLiderPanel
                clients={clients}
                tasks={tasks}
                requests={requests}
                collaborators={collaborators}
                acoes={acoesEntregas}
                toast={toast}
                onTransferir={(ids, de, para) => transferirCS(ids, de, para, me)}
              />
            )}

            {page === 'comercial' && isLider && (
              <ComercialPage clients={clients} me={me} toast={toast} />
            )}

            {page === 'agenda' && <AgendaView />}
          </>
        )}

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

      {openClient && ReactDOM.createPortal(
        <ClientDrawer
          client={openClient}
          health={computeOpsHealth(openClient.id, tasks)}
          manual={resolveClientHealth(openClient)}
          onClose={() => setOpenId(null)}
          onSetHealth={() => { setHealthTarget(openClient); setOpenId(null); }}
          onOpenFicha={() => { setFichaId(openClient.id); setOpenId(null); }}
          onRenewContract={async (meses, obs) => {
            const r = await renewContract(openClient.id, meses, me, obs);
            if (r.success) toast(`Contrato renovado por ${meses} ${Number(meses) === 1 ? 'mês' : 'meses'}.`);
            else toast(r.error, 'e');
            return r;
          }}
          onCloseContract={async (motivo) => {
            const r = await closeContract(openClient.id, me, motivo);
            if (r.success) toast(`Contrato de ${openClient.name} encerrado.`);
            else toast(r.error, 'e');
            return r;
          }}
          onReopenContract={async () => {
            const r = await reopenContract(openClient.id);
            if (r.success) toast('Contrato reaberto.');
            else toast(r.error, 'e');
            return r;
          }}
        />, document.body)}

      {/* Detalhe do cliente em fluxo (Kick Off e Onboarding). A CS tem
          todas as ações; cada botão só aparece no estágio em que vale. */}
      {flowClient && (
        <ClientOnboardingModal
          client={flowClient}
          onClose={() => setFlowId(null)}
          onScheduleKickoff={flowStage === 'kickoff'
            ? () => { setKickoffSchedule(flowClient); setFlowId(null); }
            : undefined}
          onCancelKickoff={flowStage === 'kickoff' && flowClient.kickoffCall?.at
            ? () => { setKickoffCancel(flowClient); setFlowId(null); }
            : undefined}
          onConfirmKickoffCall={flowStage === 'kickoff' && flowClient.kickoffCall?.at
            ? async () => { await confirmarKickoff(flowClient); setFlowId(null); }
            : undefined}
          onSchedule={flowPosKickoff
            ? () => { setScheduleTarget(flowClient); setFlowId(null); }
            : undefined}
          onReschedule={flowPosKickoff
            ? () => { setScheduleTarget(flowClient); setFlowId(null); }
            : undefined}
          onConfirm={flowPosKickoff && flowClient.kickoff?.at
            ? async () => {
              const r = await confirmarOnboarding(flowClient);
              if (r.success) setFlowId(null);
            }
            : undefined}
          onRename={async (nome) => {
            const r = await renameClient(flowClient.id, nome, me);
            if (r.success) toast(r.warning || `Cliente renomeado para ${nome}.`, r.warning ? 'e' : undefined);
            else toast(r.error, 'e');
            return r;
          }}
          onAddAttachment={async (file) => {
            const r = await addClientAttachment(flowClient.id, file, me);
            if (r.success) toast('Arquivo anexado!');
            else toast(r.error, 'e');
            return r;
          }}
          onRemoveAttachment={async (anexo) => {
            const r = await removeClientAttachment(flowClient.id, anexo);
            if (r.success) toast('Anexo removido.');
            else toast(r.error, 'e');
            return r;
          }}
          onRenewContract={async (meses, obs) => {
            const r = await renewContract(flowClient.id, meses, me, obs);
            if (r.success) toast(`Contrato renovado por ${meses} ${Number(meses) === 1 ? 'mês' : 'meses'}.`);
            else toast(r.error, 'e');
            return r;
          }}
          onCloseContract={async (motivo) => {
            const r = await closeContract(flowClient.id, me, motivo);
            if (r.success) toast(`Contrato de ${flowClient.name} encerrado.`);
            else toast(r.error, 'e');
            return r;
          }}
          onReopenContract={async () => {
            const r = await reopenContract(flowClient.id);
            if (r.success) toast('Contrato reaberto.');
            else toast(r.error, 'e');
            return r;
          }}
        />
      )}

      {staffingTarget && (
        <StaffingModal
          client={clients.find(c => c.id === staffingTarget.client.id) || staffingTarget.client}
          sectors={staffingTarget.sectors}
          collaborators={collaborators}
          toast={toast}
          onClose={() => setStaffingTarget(null)}
          onConfirm={(sector, nomes, opts) => setSectorResponsibles(staffingTarget.client.id, sector, nomes, me, opts)}
        />
      )}

      {/* Agendar / reagendar Kick Off */}
      {kickoffSchedule && ReactDOM.createPortal(
        <ScheduleModal
          title={kickoffSchedule.kickoffCall?.at ? 'Reagendar Kick Off' : 'Agendar Kick Off'}
          subtitle={`Call de Kick Off com ${kickoffSchedule.name}. Depois de salvar, use o botão "Adicionar à agenda" no detalhe do cliente para lançar o evento no Google Agenda.`}
          initialAt={toLocalInput(kickoffSchedule.kickoffCall?.at)}
          initialLink={kickoffSchedule.kickoffCall?.meetLink || ''}
          confirmLabel={kickoffSchedule.kickoffCall?.at ? 'Reagendar' : 'Agendar call'}
          onClose={() => setKickoffSchedule(null)}
          onConfirm={async (at, link) => {
            const r = await scheduleKickoffCall(kickoffSchedule.id, me, at, link);
            if (r.success) toast('Kick Off agendado!');
            else toast(r.error, 'e');
            setKickoffSchedule(null);
          }}
        />, document.body)}

      {/* Desmarcar Kick Off */}
      {kickoffCancel && ReactDOM.createPortal(
        <ConfirmModal
          title="Cancelar agendamento"
          text={`Desmarcar a call de Kick Off de ${kickoffCancel.name}? O cliente volta para "aguardando agendamento" — o cadastro não é apagado.`}
          confirmLabel="Desmarcar call"
          onClose={() => setKickoffCancel(null)}
          onConfirm={async () => {
            const r = await cancelKickoffCall(kickoffCancel.id);
            if (r.success) toast('Agendamento desmarcado.');
            else toast(r.error, 'e');
            setKickoffCancel(null);
          }}
        />, document.body)}

      {/* Cancelar cadastro */}
      {deleteTarget && ReactDOM.createPortal(
        <ConfirmModal
          title="Cancelar cadastro"
          text={`Apagar o cadastro de ${deleteTarget.name}? Não dá para desfazer.`}
          confirmLabel="Cancelar cadastro"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const r = await cancelStaffing(deleteTarget.id);
            if (r.success) toast('Cadastro cancelado.');
            else toast(r.error, 'e');
            setDeleteTarget(null);
          }}
        />, document.body)}

      {/* Agendar / reagendar onboarding */}
      {scheduleTarget && ReactDOM.createPortal(
        <ScheduleModal
          title={scheduleTarget.kickoff?.at ? 'Reagendar call de onboarding' : 'Agendar call de onboarding'}
          subtitle={`Defina quando será a call de onboarding com ${scheduleTarget.name}. Ao salvar, o cliente aparece na aba de onboarding de cada responsável — inclusive de quem for indicado depois.`}
          initialAt={toLocalInput(scheduleTarget.kickoff?.at)}
          initialLink={scheduleTarget.kickoff?.meetLink || ''}
          confirmLabel={scheduleTarget.kickoff?.at ? 'Reagendar' : 'Agendar call'}
          onClose={() => setScheduleTarget(null)}
          onConfirm={async (at, link) => {
            const r = await scheduleOnboarding(scheduleTarget.id, me, at, link);
            if (r.success) toast('Call de onboarding agendada!');
            else toast(r.error, 'e');
            setScheduleTarget(null);
          }}
        />, document.body)}

      {/* Task aberta pela Carteira — leitura e comentário, como no
          Kanban da CS. */}
      {openTask && (
        <TaskModal
          task={openTask}
          currentUser={me}
          currentUserSector="cs"
          collaborators={collaborators}
          readOnly
          onClose={() => setTaskId(null)}
          onMoveToProduction={moveToProduction}
          onMoveToApproval={moveToApproval}
          onApprove={approveTask}
          onReject={rejectTask}
          onAddComment={addComment}
          onUpdateLinks={updateLinks}
          onChangeDeadline={changeDeadline}
          onDelete={async (...args) => { await deleteTask(...args); setTaskId(null); }}
        />
      )}

      {/* Contrato, cadastro e entregas do cliente (aberto pelo drawer). */}
      {fichaClient && (
        <ClienteFicha client={fichaClient} acoes={acoesEntregas} toast={toast} onClose={() => setFichaId(null)} />
      )}

      {healthTarget && ReactDOM.createPortal(
        <ClientHealthModal
          client={healthTarget}
          onClose={() => setHealthTarget(null)}
          onSave={async (level, note) => {
            const r = await setClientHealth(healthTarget.id, level, note, me);
            if (r.success) toast(level ? 'Saúde do cliente atualizada.' : 'Marcação removida.');
            else toast(r.error, 'e');
            setHealthTarget(null);
          }}
        />, document.body)}
    </AppShell>
  );
}

function Bloco({ title, sub, color, children }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ width: 3, height: 15, background: color, borderRadius: 2 }} />
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>{sub}</p>
      {children}
    </div>
  );
}

// ── Kick Off: card de ação ─────────────────────────────────────
// Primeira etapa. Agenda, reagenda, desmarca e confirma a call. Como
// ninguém foi indicado ainda, o cadastro pode ser cancelado daqui.
function KickoffCallCard({ client, onOpen, onSchedule, onCancel, onDelete, onConfirm }) {
  const contrato = client.contrato || {};
  const call = client.kickoffCall || {};
  const agendada = !!call.at;
  const passou = agendada && new Date(call.at) < new Date();
  const dias = !agendada ? diasDesde(client.staffing?.startedAt) : null;
  const parado = dias != null && dias >= STAFFING_ALERT_DAYS;

  return (
    <div style={{ ...CARD, border: `1px solid ${agendada ? (passou ? 'var(--amber-b)' : `color-mix(in srgb, ${KICKOFF_COLOR} 25%, transparent)`) : parado ? 'var(--neon-border)' : 'var(--border)'}` }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{client.name}</p>
          {agendada
            ? <Tag text={passou ? 'CALL PASSOU' : 'AGENDADO'} color={passou ? 'var(--amber)' : KICKOFF_COLOR} />
            : <Tag text="AGUARDANDO AGENDAMENTO" color={parado ? 'var(--neon)' : 'var(--muted)'} />}
        </div>

        {agendada ? (
          <p style={{ fontSize: 13, fontWeight: 700, color: passou ? 'var(--amber)' : KICKOFF_COLOR, fontFamily: 'var(--fm)', marginTop: 10 }}>
            📅 {fmtDateTime(call.at)}
          </p>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
            Defina data e hora da call de Kick Off.
          </p>
        )}

        {contrato.contactName && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>👤 {contrato.contactName}</p>}
        {contrato.saleTotal != null && (
          <p style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700, marginTop: 6 }}>{money(contrato.saleTotal)}</p>
        )}
        {asArray(client.responsibles?.cs).length > 0 && (
          <p style={{ fontSize: 11, color: COLOR, fontFamily: 'var(--fm)', marginTop: 6 }}>
            🎧 CS: {asArray(client.responsibles.cs).join(', ')}
          </p>
        )}
        {dias != null && (
          <p style={{ fontSize: 11, color: parado ? 'var(--neon)' : 'var(--dim)', fontFamily: 'var(--fm)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> cadastrado há {dias} dia{dias !== 1 ? 's' : ''}
          </p>
        )}
      </button>

      {call.meetLink && (
        <a href={call.meetLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, padding: '9px', borderRadius: 9, background: 'var(--green)', color: 'var(--text)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          <Video size={14} /> Abrir call
        </a>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {!agendada ? (
          <button style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onSchedule}>Agendar call</button>
        ) : (
          <>
            <button style={{ ...BTN_GREEN, width: '100%', fontSize: 12 }} onClick={onConfirm}>✓ Kick Off realizado</button>
            <button style={{ ...BTN_CANCEL, flex: 1 }} onClick={onSchedule}>Reagendar</button>
            <button style={BTN_CANCEL} onClick={onCancel}>Desmarcar</button>
          </>
        )}
      </div>

      <button
        onClick={onDelete}
        style={{ background: 'none', border: 'none', width: '100%', marginTop: 10, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}
      >
        <Trash2 size={11} /> Cancelar cadastro
      </button>
    </div>
  );
}

// ── Onboarding: card do fluxo pós Kick Off ─────────────────────
// Junta as duas frentes que agora correm em paralelo: o quadro de
// responsáveis (líderes indicam, CS cobra) e a call de onboarding
// (CS agenda). "Call realizada" só libera com o quadro completo.
function FlowCard({ client, pendentes, meus = [], onOpen, onSchedule, onConfirm, onStaff, onNudge }) {
  const contrato = client.contrato || {};
  const exigidos = client.staffing?.sectors || [];
  const completo = pendentes.length === 0;
  const call = client.kickoff || {};
  const at = call.at;
  const passou = at && new Date(at) < new Date();
  const dias = diasDesde(client.staffing?.startedAt || client.kickoffCall?.confirmedAt);
  const atrasado = !completo && dias != null && dias >= STAFFING_ALERT_DAYS;

  const borda = atrasado ? 'var(--neon-border)'
    : !at ? 'var(--amber-b)'
    : passou ? 'var(--amber-b)'
    : `color-mix(in srgb, ${COLOR} 25%, transparent)`;

  return (
    <div style={{ ...CARD, border: `1px solid ${borda}` }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{client.name}</p>
          {at
            ? <Tag text={passou ? 'CALL PASSOU' : 'AGENDADO'} color={passou ? 'var(--amber)' : COLOR} />
            : <Tag text="SEM AGENDA" color="var(--amber)" />}
        </div>

        {at ? (
          <p style={{ fontSize: 13, fontWeight: 700, color: passou ? 'var(--amber)' : COLOR, fontFamily: 'var(--fm)', marginTop: 10 }}>
            📅 {fmtDateTime(at)}
          </p>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
            Marque a call de onboarding — é o agendamento que libera o cliente para o time.
          </p>
        )}

        {(contrato.contactName || client.contactName) && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>👤 {contrato.contactName || client.contactName}</p>
        )}

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <p style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>QUADRO DE RESPONSÁVEIS</p>
            <span style={{ fontSize: 10, fontWeight: 700, color: completo ? 'var(--green)' : (atrasado ? 'var(--neon)' : 'var(--amber)'), fontFamily: 'var(--fm)' }}>
              {exigidos.length - pendentes.length}/{exigidos.length}
            </span>
          </div>
          {exigidos.map(sid => {
            const nomes = asArray(client.responsibles?.[sid]);
            const ok = nomes.length > 0;
            const indicacao = client.staffing?.log?.[sid];
            return (
              <div key={sid} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: ok ? (SECTORS[sid]?.color || 'var(--text)') : 'var(--muted)' }}>
                  {ok ? '✓' : '○'} {SECTORS[sid]?.emoji} {SECTORS[sid]?.label || sid}
                </span>
                <span style={{ fontSize: 11, color: ok ? 'var(--muted)' : 'var(--amber)', fontFamily: 'var(--fm)', textAlign: 'right' }}>
                  {ok ? nomes.join(', ') : 'pendente'}
                  {ok && indicacao?.at && (
                    <>
                      <br />
                      <span style={{ fontSize: 10, color: 'var(--dim)' }}>
                        em {fmtDate(indicacao.at)}{indicacao.by ? ` por ${indicacao.by}` : ''}
                      </span>
                    </>
                  )}
                </span>
              </div>
            );
          })}
          {asArray(client.responsibles?.cs).length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: COLOR }}>🎧 CS</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{asArray(client.responsibles.cs).join(', ')}</span>
            </div>
          )}
        </div>

        {!completo && dias != null && (
          <p style={{ fontSize: 11, color: atrasado ? 'var(--neon)' : 'var(--dim)', fontFamily: 'var(--fm)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> Kick Off há {dias} dia{dias !== 1 ? 's' : ''}
            {atrasado ? ' · vale cobrar o líder' : ''}
          </p>
        )}
      </button>

      {pendentes.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {pendentes.map(sid => {
            const cobrado = client.staffing?.nudges?.[sid];
            const quando = cobrado?.at ? fmtDate(cobrado.at) : null;
            return (
              <button
                key={sid}
                onClick={() => onNudge(sid)}
                title={quando ? `Última cobrança em ${quando}` : 'Avisar o líder deste setor'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 99,
                  background: cobrado ? 'var(--soft)' : 'var(--amber-dim)',
                  border: `1px solid ${cobrado ? 'var(--border-h)' : 'var(--amber-b)'}`,
                  color: cobrado ? 'var(--muted)' : 'var(--amber)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Bell size={11} /> {cobrado ? 'Cobrado' : 'Cobrar'} · {SECTORS[sid]?.label || sid}
              </button>
            );
          })}
        </div>
      )}

      {onStaff && meus.length > 0 && (
        <button style={{ ...BTN_PRIMARY, width: '100%', marginTop: 12 }} onClick={onStaff}>
          Indicar responsáveis ({meus.length} setor{meus.length !== 1 ? 'es' : ''})
        </button>
      )}

      {call.meetLink && (
        <a href={call.meetLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, padding: '9px', borderRadius: 9, background: 'var(--green)', color: 'var(--text)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          <Video size={14} /> Abrir call
        </a>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {at ? (
          <>
            <button
              style={{ ...BTN_GREEN, flex: 1, fontSize: 12, opacity: completo ? 1 : .45, cursor: completo ? 'pointer' : 'not-allowed' }}
              disabled={!completo}
              title={completo ? undefined : 'Falta responsável em algum setor'}
              onClick={onConfirm}
            >
              ✓ Call realizada
            </button>
            <button style={BTN_CANCEL} onClick={onSchedule}>Reagendar</button>
          </>
        ) : (
          <button style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onSchedule}>Agendar call</button>
        )}
      </div>
      {at && !completo && (
        <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.45 }}>
          O cliente só entra na base com todos os responsáveis indicados.
        </p>
      )}
    </div>
  );
}

// ── Saúde Operacional ──────────────────────────────────────────
function OpsCard({ client, health, onClick }) {
  const lv = HEALTH_LEVELS_4[health.level];
  return (
    <button onClick={onClick} style={{ ...CARD, textAlign: 'left', cursor: 'pointer', width: '100%', border: `1px solid color-mix(in srgb, ${lv.color} 27%, transparent)`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: lv.color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, paddingLeft: 6 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{client.name}</p>
        <Tag text={`${lv.emoji} ${lv.label.toUpperCase()}`} color={lv.color} />
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingLeft: 6 }}>
        <Mini label="Ativas" value={health.stats.active} color="var(--blue)" />
        <Mini label="Atrasadas" value={health.stats.overdue} color={health.stats.overdue > 0 ? lv.color : 'var(--muted)'} />
        <Mini label="Ajustes" value={health.stats.reworks} color={health.stats.reworks > 0 ? 'var(--amber)' : 'var(--muted)'} />
      </div>
      <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 10, paddingLeft: 6, lineHeight: 1.5 }}>{health.reasons.join(' · ')}</p>
    </button>
  );
}

function Mini({ label, value, color }) {
  return (
    <div>
      <p style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 20, fontWeight: 600, color }}>{value}</p>
    </div>
  );
}

// ── Saúde do Cliente (manual) ──────────────────────────────────
function ClientHealthCard({ client, health, onSet }) {
  const lv = health.level ? HEALTH_LEVELS_4[health.level] : null;
  return (
    <div style={{ ...CARD, border: `1px solid ${lv ? `color-mix(in srgb, ${lv.color} 27%, transparent)` : 'var(--border)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{client.name}</p>
        {lv
          ? <Tag text={`${lv.emoji} ${lv.label.toUpperCase()}`} color={lv.color} />
          : <Tag text="SEM AVALIAÇÃO" color="var(--muted)" />}
      </div>
      {health.note && (
        <p style={{ fontSize: 12, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {health.note}
        </p>
      )}
      {health.set && (
        <p style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', marginTop: 8 }}>
          {health.by || '—'} · {fmtDate(health.at)}
        </p>
      )}
      <button style={{ ...BTN_CANCEL, width: '100%', marginTop: 12 }} onClick={onSet}>
        {health.set ? 'Atualizar avaliação' : 'Avaliar cliente'}
      </button>
    </div>
  );
}

function ClientHealthModal({ client, onClose, onSave }) {
  const current = resolveClientHealth(client);
  const [level, setLevel] = useState(current.level || '');
  const [note, setNote] = useState(current.note || '');

  return (
    <Overlay onClose={onClose}>
      <div style={MODAL}>
        <ModalHeader title={`Saúde de ${client.name}`} onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Avaliação manual, baseada no relacionamento e nas pendências por parte do cliente.
          Não substitui o farol operacional (que é automático pelas tasks).
        </p>

        <p style={LBL}>NÍVEL</p>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {Object.values(HEALTH_LEVELS_4).map(l => (
            <button
              key={l.id}
              onClick={() => setLevel(l.id)}
              style={{ flex: '1 1 45%', padding: '10px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: level === l.id ? `color-mix(in srgb, ${l.color} 13%, transparent)` : 'var(--surface)', color: level === l.id ? l.color : 'var(--muted)', border: `1px solid ${level === l.id ? `color-mix(in srgb, ${l.color} 40%, transparent)` : 'var(--border)'}` }}
            >
              {l.emoji} {l.label}
            </button>
          ))}
        </div>

        <p style={LBL}>OBSERVAÇÃO</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={4}
          placeholder="O que está acontecendo com esse cliente? Pendências dele, clima da relação, risco de churn..."
          style={{ ...INP, marginTop: 6, resize: 'vertical' }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button style={{ ...BTN_PRIMARY, flex: 1, opacity: level ? 1 : .5 }} disabled={!level} onClick={() => onSave(level, note)}>
            Salvar avaliação
          </button>
          {current.set && (
            <button style={BTN_CANCEL} onClick={() => onSave(null, '')}>
              <X size={13} style={{ verticalAlign: 'middle' }} /> Limpar
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// ── Drawer do cliente ──────────────────────────────────────────
function ClientDrawer({ client, health, manual, onClose, onSetHealth, onOpenFicha, onRenewContract, onCloseContract, onReopenContract }) {
  const lv = HEALTH_LEVELS_4[health.level];
  const mlv = manual.level ? HEALTH_LEVELS_4[manual.level] : null;
  const sectors = Object.entries(client.responsibles || {}).filter(([, v]) => v && (Array.isArray(v) ? v.length : true));

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 560 }}>
        <ModalHeader title={client.name} onClose={onClose} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div style={{ background: `color-mix(in srgb, ${lv.color} 7%, transparent)`, border: `1px solid color-mix(in srgb, ${lv.color} 25%, transparent)`, borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>SAÚDE OPERACIONAL</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: lv.color, marginTop: 4 }}>{lv.emoji} {lv.label}</p>
          </div>
          <div style={{ background: mlv ? `color-mix(in srgb, ${mlv.color} 7%, transparent)` : 'var(--surface)', border: `1px solid ${mlv ? `color-mix(in srgb, ${mlv.color} 25%, transparent)` : 'var(--border)'}`, borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>SAÚDE DO CLIENTE</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: mlv ? mlv.color : 'var(--muted)', marginTop: 4 }}>
              {mlv ? `${mlv.emoji} ${mlv.label}` : '— sem avaliação'}
            </p>
          </div>
        </div>

        <button style={{ ...BTN_CANCEL, width: '100%', marginBottom: 18 }} onClick={onSetHealth}>
          Avaliar saúde do cliente
        </button>

        {onOpenFicha && <ResumoEntregas client={client} onOpen={onOpenFicha} />}

        {health.overdueTasks.length > 0 && (
          <Section title={`Tasks em atraso (${health.overdueTasks.length})`} color={lv.color}>
            {health.overdueTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{t.name}</span>
                <span style={{ fontSize: 10, color: lv.color, fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>
                  {t.deadline} · {t.responsibleName || '—'}
                </span>
              </div>
            ))}
          </Section>
        )}

        {sectors.length > 0 && (
          <Section title="Time do projeto" color={COLOR}>
            {sectors.map(([sid, v]) => (
              <div key={sid} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: SECTORS[sid]?.color || 'var(--text)' }}>{SECTORS[sid]?.emoji} {SECTORS[sid]?.label || sid}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)', textAlign: 'right' }}>{Array.isArray(v) ? v.join(', ') : v}</span>
              </div>
            ))}
          </Section>
        )}

        {(onRenewContract || onCloseContract) && (
          <ContractBlock
            client={client}
            color={COLOR}
            onRenew={onRenewContract}
            onClose={onCloseContract}
            onReopen={onReopenContract}
          />
        )}

        <Section title="Dados do cliente" color={COLOR}>
          <RO label="Responsável" value={client.contactName} />
          <RO label="Telefone" value={client.contactPhone} />
          <RO label="E-mail" value={client.contactEmail} />
          <RO label="CNPJ" value={client.cnpj} />
          <RO label="Valor" value={client.saleTotal != null ? money(client.saleTotal) : null} />
          <RO label="Onboarding" value={client.kickoff?.confirmedAt ? `realizado em ${fmtDate(client.kickoff.confirmedAt)} por ${client.kickoff.confirmedBy || '—'}` : null} />
        </Section>

        {client.briefing && (
          <Section title="Briefing" color={COLOR}>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{client.briefing}</p>
          </Section>
        )}
      </div>
    </Overlay>
  );
}

// Resumo de contrato e entregas no drawer do cliente: aderência do mês
// e o que falta no cadastro, com o atalho para a ficha completa.
function ResumoEntregas({ client, onOpen }) {
  const pend = cadastroPendencias(client);
  const resumo = resumoMes(entregasDoMes(client, mesChave()));
  return (
    <Section title="Contrato e entregas" color={COLOR}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: pend.length ? 10 : 12 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text)', flex: 1 }}>
          {resumo.combinado ? `Entregas do mês: ${resumo.entregue} de ${resumo.combinado}` : 'Sem entregas mensais combinadas'}
        </span>
        <Aderencia pct={resumo.pct} />
      </div>
      {pend.length > 0 && (
        <p style={{ fontSize: 11.5, color: 'var(--amber)', marginBottom: 12, lineHeight: 1.5 }}>
          Cadastro incompleto — falta: {pend.map(p => CADASTRO_PENDENCIAS[p]?.label || p).join(', ')}.
        </p>
      )}
      <button style={{ ...(pend.length ? BTN_PRIMARY : BTN_CANCEL), width: '100%' }} onClick={onOpen}>
        {pend.length ? 'Completar cadastro e ver entregas' : 'Ver contrato e entregas'}
      </button>
    </Section>
  );
}

function Chip({ active, onClick, label, color = COLOR }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: active ? `color-mix(in srgb, ${color} 13%, transparent)` : 'var(--surface)', color: active ? color : 'var(--muted)', border: `1px solid ${active ? `color-mix(in srgb, ${color} 33%, transparent)` : 'var(--border)'}` }}
    >
      {label}
    </button>
  );
}
