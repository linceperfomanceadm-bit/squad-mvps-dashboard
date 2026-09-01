import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  LayoutDashboard, UserPlus, ClipboardList, Kanban, MessageSquare,
  Calendar, Clock, Trash2,
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
import { SECTORS } from '../../lib/firebase';
import {
  Overlay, ModalHeader, ConfirmModal, Stat, Tag, Empty, Spinner,
  money, fmtDate,
  CARD, GRID, MODAL, BTN_PRIMARY, BTN_CANCEL,
} from '../../components/commercial/ui';

const COLOR = SECTORS.cs.color;
const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/*
 * CS COMERCIAL — a porta de entrada do cliente no app.
 *
 *  1. Cadastrar Cliente → formulário completo (dados cadastrais,
 *     serviços, setores envolvidos, financeiro, briefing e anexos).
 *     Ao salvar, o cliente nasce em `staffing`, invisível para os
 *     setores, e cai no painel dos líderes.
 *  2. Acompanhamento   → clientes em staffing, com o que falta em
 *     cada um. É daqui que a CS cobra os líderes que estão travando.
 *  3. Produção         → leitura do Kanban de todos os clientes.
 *  4. Solicitações     → Reporte da CS para os times.
 *
 * A CS Comercial não agenda mais a call de onboarding: isso é do CS
 * Operacional, depois que o quadro de responsáveis fecha.
 */
export default function CSComercialDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    clients, loading, addClient, cancelStaffing, pendingSectorsOf, uploadClientFile,
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

  const me = user?.name;

  const activeClients = useMemo(() => clients.filter(c => c.active !== false), [clients]);

  // Clientes cadastrados que ainda esperam os líderes.
  const emStaffing = useMemo(() => clients
    .filter(c => c.stage === 'staffing')
    .sort((a, b) => new Date(a.staffing?.startedAt || 0) - new Date(b.staffing?.startedAt || 0)),
    [clients]);

  // Ativos que ainda não fizeram a call de onboarding.
  const aguardandoCall = useMemo(
    () => clients.filter(c => c.active !== false && c.stage !== 'staffing' && c.kickoff?.pending),
    [clients]
  );

  const ativadosNoMes = useMemo(() => {
    const now = new Date();
    return clients.filter(c => {
      const at = c.staffing?.completedAt;
      if (!at) return false;
      const d = new Date(at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [clients]);

  const requestsToClose = requests.filter(r => r.status === 'answered').length;
  const openClient = openId ? clients.find(c => c.id === openId) || null : null;

  const NAV = [
    { key: 'register',  label: 'Cadastrar Cliente', icon: UserPlus },
    { key: 'staffing',  label: 'Acompanhamento',    icon: ClipboardList, badge: emStaffing.length, badgeDanger: emStaffing.length > 0 },
    { key: 'kanban',    label: 'Produção',          icon: Kanban },
    { key: 'requests',  label: 'Solicitações',      icon: MessageSquare, badge: requestsToClose, badgeDanger: requestsToClose > 0 },
    { key: 'overview',  label: 'Visão Geral',       icon: LayoutDashboard },
    { key: 'agenda',    label: 'Agenda',            icon: Calendar },
  ];

  const HEAD = {
    register: ['Cadastrar Cliente', 'A entrada do cliente na agência. Depois de salvar, os líderes indicam os responsáveis.'],
    staffing: ['Acompanhamento', 'Clientes cadastrados aguardando os líderes indicarem os responsáveis'],
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
                  <Stat label="Aguardando call" value={aguardandoCall.length} color="var(--blue)" />
                  <Stat label="Ativados no mês" value={ativadosNoMes} color="var(--green)" />
                  <Stat label="Clientes ativos" value={activeClients.length} color={COLOR} />
                </div>
                <div style={CARD}>
                  <p style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>VALOR EM CONTRATOS ENTRANDO</p>
                  <p style={{ fontSize: 30, fontWeight: 800, color: 'var(--green)', marginTop: 8 }}>
                    {money([...emStaffing, ...aguardandoCall].reduce((sum, c) => sum + (Number(c.contrato?.saleTotal ?? c.saleTotal) || 0), 0))}
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
                  Preencha os dados do contrato fechado e marque os setores envolvidos. O cliente entra
                  invisível para os times até que o líder de cada setor marcado indique um responsável.
                  Quando o quadro fecha, ele vira ativo e cai no Onboarding do CS Operacional.
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
            />
          </div>
        </Overlay>, document.body)}

      {/* Detalhe do cliente */}
      {openClient && (
        <ClientOnboardingModal client={openClient} onClose={() => setOpenId(null)} />
      )}

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

// ── Card de acompanhamento do staffing ─────────────────────────
function StaffingWatchCard({ client, pendentes, onOpen, onDelete }) {
  const contrato = client.contrato || {};
  const exigidos = client.staffing?.sectors || [];
  const prontos = exigidos.filter(s => !pendentes.includes(s));
  const dias = client.staffing?.startedAt
    ? Math.floor((Date.now() - new Date(client.staffing.startedAt).getTime()) / 86400000)
    : null;
  const atrasado = dias != null && dias >= 3;
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
