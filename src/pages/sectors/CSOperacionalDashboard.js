import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  LayoutDashboard, Rocket, Activity, HeartPulse, Calendar, X,
  Kanban, MessageSquare, Clock, Video,
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
import ClientOnboardingModal from '../../components/commercial/ClientOnboardingModal';
import StaffingModal from '../../components/commercial/StaffingModal';
import { SECTORS } from '../../lib/firebase';
import {
  computeOpsHealth, resolveClientHealth, isCritical,
  HEALTH_LEVELS_4, HEALTH_ORDER_4,
} from '../../hooks/useClientHealth';
import {
  Overlay, ModalHeader, ScheduleModal, Stat, Tag, Empty, Spinner, Section, RO,
  fmtDate, fmtDateTime, toLocalInput, money,
  CARD, GRID, MODAL, LBL, INP, BTN_PRIMARY, BTN_GREEN, BTN_CANCEL,
} from '../../components/commercial/ui';

const COLOR = SECTORS.cs.color;

/*
 * CS OPERACIONAL — 3 abas, como no fluxograma:
 *
 *  1. Onboarding de Clientes → todo cliente novo cai aqui já no
 *                        cadastro da CS Comercial. O card fica
 *                        bloqueado enquanto algum setor não tiver
 *                        responsável indicado. Com o quadro completo,
 *                        a CS agenda a call e depois confirma que ela
 *                        aconteceu — aí o cliente sai desta aba.
 *  2. Saúde Operacional→ farol AUTOMÁTICO por tasks em atraso:
 *                        0 verde · 1 amarelo · 2 laranja · 3+ vermelho
 *  3. Saúde do Cliente → farol MANUAL, alimentado pela CS com base no
 *                        relacionamento e nas pendências do cliente.
 */
export default function CSOperacionalDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, loading, confirmKickoff, scheduleOnboarding, setClientHealth, pendingSectorsOf, setSectorResponsibles } = useClients();
  const { collaborators } = useCollaborators();
  const {
    tasks, moveToProduction, moveToApproval, approveTask, rejectTask,
    addComment, updateLinks, deleteTask, changeDeadline,
  } = useTasks();
  const {
    requests, createRequest, addReply, closeRequest, deleteRequest,
  } = useRequests();

  const [page, setPage] = useState('kickoff');
  const [onlyMine, setOnlyMine] = useState(false);
  const [opsFilter, setOpsFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [healthTarget, setHealthTarget] = useState(null);
  const [onboardingId, setOnboardingId] = useState(null);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [staffingTarget, setStaffingTarget] = useState(null);

  const me = user?.name;
  // Setores que esta pessoa pode preencher: os que ela lidera (e todos,
  // se for admin). Sem isso, o card em staffing é só leitura.
  const mySectors = user?.isAdmin
    ? Object.keys(SECTORS)
    : (Array.isArray(user?.leaderOf) ? user.leaderOf : []);

  const activeClients = useMemo(
    () => clients.filter(c => c.active !== false),
    [clients]
  );

  // Responsável pode estar salvo como string (legado) ou array (multi).
  const isMine = (c) => {
    const r = c.responsibles?.cs;
    return Array.isArray(r) ? r.includes(me) : r === me;
  };
  const mineFilter = (c) => (onlyMine ? isMine(c) : true);

  // Carteira da pessoa — alimenta o filtro "Meus clientes" do Kanban.
  const myClientIds = useMemo(
    () => activeClients.filter(isMine).map(c => c.id),
    [activeClients, me] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Clientes ainda em staffing: já aparecem aqui, mas bloqueados.
  // Não estão em `activeClients` porque gravam `active: false`.
  const staffingClients = useMemo(
    () => clients
      .filter(c => c.stage === 'staffing')
      .sort((a, b) => new Date(a.staffing?.startedAt || 0) - new Date(b.staffing?.startedAt || 0)),
    [clients]
  );

  // Quadro completo, aguardando agendamento ou a call acontecer.
  const kickoffPending = useMemo(
    () => activeClients
      .filter(c => c.kickoff?.pending)
      .sort((a, b) => {
        const aa = a.kickoff?.at ? new Date(a.kickoff.at).getTime() : Infinity;
        const bb = b.kickoff?.at ? new Date(b.kickoff.at).getTime() : Infinity;
        return aa - bb;
      }),
    [activeClients]
  );

  const onboardingTotal = staffingClients.length + kickoffPending.length;
  const semAgenda = kickoffPending.filter(c => !c.kickoff?.at).length;

  const liveClients = useMemo(
    () => activeClients.filter(c => !c.kickoff?.pending).filter(mineFilter),
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

  const openClient = openId ? liveClients.find(c => c.id === openId) || null : null;
  const onboardingClient = onboardingId ? clients.find(c => c.id === onboardingId) || null : null;

  // Solicitações que o colaborador já respondeu e esperam a CS encerrar.
  const requestsToClose = requests.filter(r => r.status === 'answered').length;

  const NAV = [
    { key: 'kickoff',  label: 'Onboarding de Clientes', icon: Rocket, badge: onboardingTotal, badgeDanger: semAgenda > 0 },
    { key: 'ops',      label: 'Saúde Operacional', icon: Activity,   badge: opsCounts.red, badgeDanger: opsCounts.red > 0 },
    { key: 'client',   label: 'Saúde do Cliente',  icon: HeartPulse },
    { key: 'kanban',   label: 'Produção',          icon: Kanban },
    { key: 'requests', label: 'Solicitações',      icon: MessageSquare, badge: requestsToClose, badgeDanger: requestsToClose > 0 },
    { key: 'overview', label: 'Visão Geral',       icon: LayoutDashboard },
    { key: 'agenda',   label: 'Agenda',            icon: Calendar },
  ];

  const HEAD = {
    kickoff:  ['Onboarding de Clientes', 'Clientes novos entrando na agência, do cadastro até a call realizada'],
    ops:      ['Saúde Operacional', 'Farol automático pelas tasks em atraso de cada cliente'],
    client:   ['Saúde do Cliente', 'Farol manual — relacionamento e pendências por parte do cliente'],
    kanban:   ['Produção dos Clientes', 'Acompanhamento em tempo real — leitura e comentário, sem mover card'],
    requests: ['Reporte da CS', 'Solicitações abertas para os times de produção'],
    overview: ['Visão Geral', 'Sua carteira em números'],
    agenda:   ['Agenda', ''],
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="cs" navItems={NAV} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 28, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? <Spinner /> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 12 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${COLOR}1a`, color: COLOR, border: `1px solid ${COLOR}40`, fontFamily: 'var(--fm)' }}>🎧 CS OPERACIONAL</span>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 10, marginBottom: 4 }}>{HEAD[page][0]}</h1>
                {HEAD[page][1] && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{HEAD[page][1]}</p>}
              </div>
              {['ops', 'client', 'overview'].includes(page) && (
                <button
                  onClick={() => setOnlyMine(v => !v)}
                  style={{ background: onlyMine ? `${COLOR}20` : 'var(--surface)', border: `1px solid ${onlyMine ? `${COLOR}55` : 'var(--border)'}`, borderRadius: 9, padding: '9px 14px', color: onlyMine ? COLOR : 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {onlyMine ? '✓ Meus clientes' : 'Meus clientes'}
                </button>
              )}
            </div>

            {page === 'overview' && (
              <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
                <Stat label="Clientes ativos" value={liveClients.length} color={COLOR} />
                <Stat label="Saúde crítica" value={criticalCount} color={criticalCount > 0 ? '#ef4444' : 'var(--muted)'} hint="Vermelho no farol operacional ou no farol do cliente" />
                <Stat label="Em onboarding" value={onboardingTotal} color="var(--amber)" />
                <Stat label="Em dia (operacional)" value={opsCounts.green} color="var(--green)" />
              </div>
            )}

            {page === 'kickoff' && (
              onboardingTotal === 0
                ? <Empty msg="Nenhum cliente em onboarding. ✨" />
                : (
                  <>
                    {staffingClients.length > 0 && (
                      <div style={{ marginBottom: 30 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ width: 3, height: 15, background: 'var(--amber)', borderRadius: 2 }} />
                          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Aguardando responsáveis</h2>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
                          Cadastrados pela CS Comercial. Destravam quando o líder de cada setor indicar quem fica com o cliente.
                        </p>
                        <div style={GRID}>
                          {staffingClients.map(c => {
                            const pendentes = pendingSectorsOf(c);
                            const meus = pendentes.filter(sid => mySectors.includes(sid));
                            return (
                              <LockedCard
                                key={c.id}
                                client={c}
                                pendentes={pendentes}
                                meus={meus}
                                onStaff={meus.length ? () => setStaffingTarget({ client: c, sectors: meus }) : null}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {kickoffPending.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ width: 3, height: 15, background: COLOR, borderRadius: 2 }} />
                          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Prontos para a call</h2>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
                          Quadro de responsáveis completo. Marque a data da call de onboarding e confirme quando ela acontecer.
                        </p>
                        <div style={GRID}>
                          {kickoffPending.map(c => (
                            <KickoffCard
                              key={c.id}
                              client={c}
                              onOpen={() => setOnboardingId(c.id)}
                              onSchedule={() => setScheduleTarget(c)}
                              onConfirm={async () => {
                                const r = await confirmKickoff(c.id, me);
                                if (r.success) toast(`Onboarding de ${c.name} concluído! 🚀`);
                                else toast(r.error, 'e');
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
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

      {openClient && ReactDOM.createPortal(
        <ClientDrawer
          client={openClient}
          health={computeOpsHealth(openClient.id, tasks)}
          manual={resolveClientHealth(openClient)}
          onClose={() => setOpenId(null)}
          onSetHealth={() => { setHealthTarget(openClient); setOpenId(null); }}
        />, document.body)}

      {onboardingClient && (
        <ClientOnboardingModal
          client={onboardingClient}
          onClose={() => setOnboardingId(null)}
          onSchedule={() => { setScheduleTarget(onboardingClient); setOnboardingId(null); }}
          onReschedule={() => { setScheduleTarget(onboardingClient); setOnboardingId(null); }}
          onConfirm={async () => {
            const r = await confirmKickoff(onboardingClient.id, me);
            if (r.success) toast(`Onboarding de ${onboardingClient.name} concluído! 🚀`);
            else toast(r.error, 'e');
            setOnboardingId(null);
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

      {scheduleTarget && ReactDOM.createPortal(
        <ScheduleModal
          title={scheduleTarget.kickoff?.at ? 'Reagendar call de onboarding' : 'Agendar call de onboarding'}
          subtitle={`Defina quando será a call de onboarding com ${scheduleTarget.name}. Ela aparece na aba de onboarding de todos os responsáveis.`}
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
    </div>
  );
}

// ── Onboarding: card bloqueado (aguardando responsáveis) ───────
function LockedCard({ client, pendentes, meus = [], onStaff }) {
  const exigidos = client.staffing?.sectors || [];
  const dias = client.staffing?.startedAt
    ? Math.floor((Date.now() - new Date(client.staffing.startedAt).getTime()) / 86400000)
    : null;
  const atrasado = dias != null && dias >= 3;

  return (
    <div style={{ ...CARD, border: `1px solid ${atrasado ? 'var(--neon-border)' : 'var(--border)'}`, opacity: .82 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{client.name}</p>
        <Tag text="BLOQUEADO" color={atrasado ? 'var(--neon)' : 'var(--muted)'} />
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, lineHeight: 1.55 }}>
        Aguardando indicação de responsável em {pendentes.length} de {exigidos.length} setor{exigidos.length !== 1 ? 'es' : ''}.
      </p>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        {exigidos.map(sid => {
          const nomes = client.responsibles?.[sid];
          const lista = Array.isArray(nomes) ? nomes : nomes ? [nomes] : [];
          const ok = lista.length > 0;
          return (
            <div key={sid} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: ok ? (SECTORS[sid]?.color || 'var(--text)') : 'var(--muted)' }}>
                {ok ? '✓' : '○'} {SECTORS[sid]?.emoji} {SECTORS[sid]?.label || sid}
              </span>
              <span style={{ fontSize: 11, color: ok ? '#bbb' : 'var(--amber)', fontFamily: 'var(--fm)', textAlign: 'right' }}>
                {ok ? lista.join(', ') : 'pendente'}
              </span>
            </div>
          );
        })}
      </div>

      {dias != null && (
        <p style={{ fontSize: 11, color: atrasado ? 'var(--neon)' : '#666', fontFamily: 'var(--fm)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> cadastrado há {dias} dia{dias !== 1 ? 's' : ''}
          {atrasado ? ' · vale cobrar o líder' : ''}
        </p>
      )}

      {onStaff && meus.length > 0 && (
        <button style={{ ...BTN_PRIMARY, width: '100%', marginTop: 12 }} onClick={onStaff}>
          Indicar responsáveis ({meus.length} setor{meus.length !== 1 ? 'es' : ''})
        </button>
      )}
    </div>
  );
}

// ── Onboarding: card liberado ──────────────────────────────────
function KickoffCard({ client, onOpen, onSchedule, onConfirm }) {
  const contrato = client.contrato || {};
  const at = client.kickoff?.at;
  const when = at ? new Date(at) : null;
  const passou = when && when < new Date();
  const sectors = Object.entries(client.responsibles || {}).filter(([, v]) => v && (Array.isArray(v) ? v.length : true));

  return (
    <div style={{ ...CARD, border: `1px solid ${at ? (passou ? 'var(--amber-b)' : `${COLOR}40`) : 'var(--amber-b)'}` }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{client.name}</p>
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
            Time definido. Falta marcar a data e a hora da call de onboarding.
          </p>
        )}

        {(contrato.contactName || client.contactName) && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>👤 {contrato.contactName || client.contactName}</p>
        )}

        {sectors.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)', marginBottom: 6 }}>TIME DO PROJETO</p>
            {sectors.map(([sid, v]) => (
              <div key={sid} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: SECTORS[sid]?.color || 'var(--text)' }}>{SECTORS[sid]?.emoji} {SECTORS[sid]?.label || sid}</span>
                <span style={{ fontSize: 11, color: '#bbb', fontFamily: 'var(--fm)', textAlign: 'right' }}>{Array.isArray(v) ? v.join(', ') : v}</span>
              </div>
            ))}
          </div>
        )}
      </button>

      {client.kickoff?.meetLink && (
        <a href={client.kickoff.meetLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, padding: '9px', borderRadius: 9, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          <Video size={14} /> Abrir call
        </a>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {at ? (
          <>
            <button style={{ ...BTN_GREEN, flex: 1, fontSize: 12 }} onClick={onConfirm}>✓ Call realizada</button>
            <button style={BTN_CANCEL} onClick={onSchedule}>Reagendar</button>
          </>
        ) : (
          <button style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onSchedule}>Agendar call</button>
        )}
      </div>
    </div>
  );
}

// ── Saúde Operacional ──────────────────────────────────────────
function OpsCard({ client, health, onClick }) {
  const lv = HEALTH_LEVELS_4[health.level];
  return (
    <button onClick={onClick} style={{ ...CARD, textAlign: 'left', cursor: 'pointer', width: '100%', border: `1px solid ${lv.color}44`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: lv.color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, paddingLeft: 6 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{client.name}</p>
        <Tag text={`${lv.emoji} ${lv.label.toUpperCase()}`} color={lv.color} />
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingLeft: 6 }}>
        <Mini label="Ativas" value={health.stats.active} color="var(--blue)" />
        <Mini label="Atrasadas" value={health.stats.overdue} color={health.stats.overdue > 0 ? lv.color : 'var(--muted)'} />
        <Mini label="Ajustes" value={health.stats.reworks} color={health.stats.reworks > 0 ? 'var(--amber)' : 'var(--muted)'} />
      </div>
      <p style={{ fontSize: 11, color: '#777', marginTop: 10, paddingLeft: 6, lineHeight: 1.5 }}>{health.reasons.join(' · ')}</p>
    </button>
  );
}

function Mini({ label, value, color }) {
  return (
    <div>
      <p style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 20, fontWeight: 800, color }}>{value}</p>
    </div>
  );
}

// ── Saúde do Cliente (manual) ──────────────────────────────────
function ClientHealthCard({ client, health, onSet }) {
  const lv = health.level ? HEALTH_LEVELS_4[health.level] : null;
  return (
    <div style={{ ...CARD, border: `1px solid ${lv ? `${lv.color}44` : 'var(--border)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{client.name}</p>
        {lv
          ? <Tag text={`${lv.emoji} ${lv.label.toUpperCase()}`} color={lv.color} />
          : <Tag text="SEM AVALIAÇÃO" color="var(--muted)" />}
      </div>
      {health.note && (
        <p style={{ fontSize: 12, color: '#ddd', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {health.note}
        </p>
      )}
      {health.set && (
        <p style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)', marginTop: 8 }}>
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
              style={{ flex: '1 1 45%', padding: '10px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: level === l.id ? `${l.color}22` : 'var(--surface)', color: level === l.id ? l.color : 'var(--muted)', border: `1px solid ${level === l.id ? `${l.color}66` : 'var(--border)'}` }}
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
function ClientDrawer({ client, health, manual, onClose, onSetHealth }) {
  const lv = HEALTH_LEVELS_4[health.level];
  const mlv = manual.level ? HEALTH_LEVELS_4[manual.level] : null;
  const sectors = Object.entries(client.responsibles || {}).filter(([, v]) => v && (Array.isArray(v) ? v.length : true));

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 560 }}>
        <ModalHeader title={client.name} onClose={onClose} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div style={{ background: `${lv.color}12`, border: `1px solid ${lv.color}40`, borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>SAÚDE OPERACIONAL</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: lv.color, marginTop: 4 }}>{lv.emoji} {lv.label}</p>
          </div>
          <div style={{ background: mlv ? `${mlv.color}12` : 'var(--surface)', border: `1px solid ${mlv ? `${mlv.color}40` : 'var(--border)'}`, borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>SAÚDE DO CLIENTE</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: mlv ? mlv.color : 'var(--muted)', marginTop: 4 }}>
              {mlv ? `${mlv.emoji} ${mlv.label}` : '— sem avaliação'}
            </p>
          </div>
        </div>

        <button style={{ ...BTN_CANCEL, width: '100%', marginBottom: 18 }} onClick={onSetHealth}>
          Avaliar saúde do cliente
        </button>

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
                <span style={{ fontSize: 11, color: '#bbb', fontFamily: 'var(--fm)', textAlign: 'right' }}>{Array.isArray(v) ? v.join(', ') : v}</span>
              </div>
            ))}
          </Section>
        )}

        <Section title="Contrato" color={COLOR}>
          <RO label="Responsável" value={client.contactName} />
          <RO label="Telefone" value={client.contactPhone} />
          <RO label="E-mail" value={client.contactEmail} />
          <RO label="CNPJ" value={client.cnpj} />
          <RO label="Valor" value={client.saleTotal != null ? money(client.saleTotal) : null} />
          <RO label="Duração" value={client.contractMonths ? `${client.contractMonths} meses` : null} />
          <RO label="Kickoff" value={client.kickoff?.confirmedAt ? `realizado em ${fmtDate(client.kickoff.confirmedAt)} por ${client.kickoff.confirmedBy || '—'}` : null} />
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

function Chip({ active, onClick, label, color = COLOR }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: active ? `${color}20` : 'var(--surface)', color: active ? color : 'var(--muted)', border: `1px solid ${active ? `${color}55` : 'var(--border)'}` }}
    >
      {label}
    </button>
  );
}
