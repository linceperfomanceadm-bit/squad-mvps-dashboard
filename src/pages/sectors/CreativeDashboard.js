import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, Trophy, Kanban, Calendar, CalendarDays, ClipboardList, Palette, MessageSquare, ListChecks } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { naCarteira } from '../../lib/firebase';
import { useClients } from '../../hooks/useClients';
import { useTasks } from '../../hooks/useTasks';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useRequests } from '../../hooks/useRequests';
import { usePlanejamentos } from '../../hooks/usePlanejamentos';
import { useMarcacoes } from '../../hooks/useMarcacoes';
import { useToast } from '../../components/shared/Toast';
import AppShell from '../../components/shared/AppShell';
import CreativeOverview from '../../components/sectors/creative/CreativeOverview';
import VMOverview from '../../components/sectors/creative/VMOverview';
import CalendarioConteudo from '../../components/planejamento/CalendarioConteudo';
import ConteudoModais from '../../components/planejamento/ConteudoModais';
import VaultPage from '../../components/sectors/creative/VaultPage';
import HallOfFame from '../../components/sectors/creative/HallOfFame';
import IdVisualBoard from '../../components/sectors/creative/IdVisualBoard';
import TaskKanban from '../../components/kanban/TaskKanban';
import OnboardingBoard from '../../components/commercial/OnboardingBoard';
import AgendaView from '../../components/shared/AgendaView';
import RequestsInbox from '../../components/shared/RequestsInbox';
import EntregasSetor from '../../components/entregas/EntregasSetor';
import { acoesDeEntregas } from '../../components/entregas/acoes';

// Responsável pode estar salvo como string (legado) ou array (multi).
const asArray = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

export default function CreativeDashboard({ sectorId }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    clients, loading: loadingClients, updateBrandbook, addBrandMaterial, removeBrandMaterial,
    idvMoveToProduction, idvMoveBackToOnboarding, idvUpdateChecklist, idvUpdateNotes, idvMoveStatus,
    marcarEntrega,
  } = useClients();
  const { collaborators, loading: loadingCollabs } = useCollaborators();
  const {
    tasks, loading: loadingTasks,
    createTask, moveToProduction, moveToApproval,
    approveTask, rejectTask, addComment, updateLinks, deleteTask, changeDeadline,
  } = useTasks();
  const { requests, markSeen, addReply } = useRequests();
  // Calendário de conteúdo: só o Videomaker usa (os reels saem dos
  // planejamentos das Socials). O Design não abre os listeners.
  const isVM = sectorId === 'videomaker';
  const planejamento = usePlanejamentos({ ativo: isVM });
  const { marcacoes, loading: loadingMarcacoes, criarMarcacao, excluirMarcacao } = useMarcacoes({ ativo: isVM });

  const [page, setPage] = useState('overview');
  const [modal, setModal] = useState(null);
  const [calInicial, setCalInicial] = useState(null);
  // Quem produz só marca entregas — escopo e cadastro são da CS.
  const acoesEntregas = acoesDeEntregas({ marcarEntrega }, user?.name, toast, { soMarcar: true });

  const responsibleField = sectorId === 'design' ? 'design' : 'videomaker';

  // `naCarteira` e não `active !== false`: o cliente entra na carteira
  // assim que o líder indica o responsável, sem esperar a call de
  // onboarding. Responsável em array porque o admin salva lista —
  // comparar com === deixava a carteira vazia nesses casos.
  const myClients = clients.filter(
    c => naCarteira(c) && asArray(c.responsibles?.[responsibleField]).includes(user?.name)
  );

  const myClientIds = myClients.map(c => c.id);
  const myPlanos = planejamento.planejamentos.filter(p => myClientIds.includes(p.clientId));
  const minhasMarcacoes = marcacoes.filter(m => m.autorName === user?.name);
  const abrirPost = (planoId, postId) => setModal({ t: 'post', planoId, postId });
  const abrirCalendario = (iso) => { setCalInicial(iso); setPage('calendario'); };

  // ID Visual é exclusivo do Design e só do designer responsável.
  const isDesign = sectorId === 'design';
  const myIdVisual = isDesign
    ? clients.filter(c => naCarteira(c) && c.idv?.responsible === user?.name)
    : [];
  const idvOpen = myIdVisual.filter(c => c.idv?.status === 'onboarding' || c.idv?.status === 'production').length;

  // Hall of Fame uses tasks from BOTH design and videomaker
  const hallTasks = tasks.filter(
    t => (t.responsibleSector === 'design' || t.responsibleSector === 'videomaker')
  );

  const openRequests = requests.filter(r => r.toName === user?.name && r.status === 'open').length;

  const handleUpdateBrandbook = async (clientId, brandbook, byName, bySector) => {
    const res = await updateBrandbook(clientId, brandbook, byName, bySector);
    if (res.success) toast('Brandbook atualizado!');
    else toast(res.error, 'e');
    return res;
  };

  const handleCreateTask = async (data) => {
    const res = await createTask(data);
    if (res.success) toast('Task criada!');
    else toast(res.error, 'e');
    return res;
  };

  const wrap = (fn, msg) => async (...args) => {
    const res = await fn(...args);
    if (res.success && msg) toast(msg);
    else if (!res.success) toast(res.error, 'e');
    return res;
  };

  const loading = loadingClients || loadingCollabs || loadingTasks || planejamento.loading || loadingMarcacoes;

  const NAV = [
    { key: 'overview',  label: 'Visão Geral',   icon: LayoutDashboard },
    ...(isVM ? [{ key: 'calendario', label: 'Calendário', icon: CalendarDays }] : []),
    { key: 'kanban',    label: 'Tasks',          icon: Kanban },
    { key: 'entregas',  label: 'Entregas do Mês', icon: ListChecks },
    { key: 'requests',  label: 'Reporte da CS',  icon: MessageSquare },
    ...(isDesign ? [{ key: 'idvisual', label: 'ID Visual', icon: Palette }] : []),
    { key: 'onboarding', label: 'Onboarding de Clientes', icon: ClipboardList },
    { key: 'vault',     label: 'Brand Hub',      icon: BookOpen },
    { key: 'hallofame', label: 'Hall da Fama',   icon: Trophy },
    { key: 'agenda',    label: 'Agenda',         icon: Calendar },
  ];

  const navItems = NAV.map(n => {
    const myTasks = tasks.filter(t => t.responsibleName === user?.name || t.requestedBy === user?.name);
    const pendingApproval = myTasks.filter(t => t.status === 'approval' && t.responsibleName === user?.name).length;
    const badge = n.key === 'kanban' ? pendingApproval
      : n.key === 'requests' ? openRequests
      : n.key === 'idvisual' ? idvOpen
      : 0;
    return {
      ...n,
      badge,
      badgeDanger: (n.key === 'kanban' && pendingApproval > 0) || (n.key === 'requests' && openRequests > 0),
    };
  });

  return (
    <AppShell sectorId={sectorId} navItems={navItems} activeKey={page} onNav={(k) => { if (k === 'calendario') setCalInicial(null); setPage(k); }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : page === 'overview' && isVM ? (
          <VMOverview
            me={user?.name}
            clientes={myClients}
            planos={myPlanos}
            marcacoes={minhasMarcacoes}
            myTasks={tasks.filter(t => t.responsibleName === user?.name || t.requestedBy === user?.name)}
            onNavigate={setPage}
            onAbrirPost={abrirPost}
            onAbrirMarcacao={(m) => setModal({ t: 'marca', id: m.id })}
            onNovaMarcacao={(data) => setModal({ t: 'novaMarca', data })}
            onAbrirCalendario={abrirCalendario}
          />
        ) : page === 'calendario' && isVM ? (
          <CalendarioConteudo
            key={calInicial || 'cal'}
            modo="vm"
            clientes={myClients}
            planos={myPlanos}
            marcacoes={minhasMarcacoes}
            inicial={calInicial}
            onAbrirPost={abrirPost}
            onAbrirMarcacao={(m) => setModal({ t: 'marca', id: m.id })}
            onNovaMarcacao={(data) => setModal({ t: 'novaMarca', data })}
          />
        ) : page === 'overview' ? (
          <CreativeOverview
            tasks={tasks.filter(t => t.responsibleSector === responsibleField)}
            myTasks={tasks.filter(t => t.responsibleName === user?.name || t.requestedBy === user?.name)}
            sectorId={sectorId}
          />
        ) : page === 'kanban' ? (
          <TaskKanban
            tasks={tasks}
            clients={myClients}
            allClients={clients}
            collaborators={collaborators}
            currentUser={user?.name}
            currentUserSector={sectorId}
            onCreateTask={handleCreateTask}
            onMoveToProduction={moveToProduction}
            onMoveToApproval={moveToApproval}
            onApprove={approveTask}
            onReject={rejectTask}
            onAddComment={addComment}
            onUpdateLinks={updateLinks}
            onChangeDeadline={changeDeadline}
            onDelete={deleteTask}
          />
        ) : page === 'requests' ? (
          <RequestsInbox
            requests={requests}
            currentUser={user?.name}
            currentUserSector={sectorId}
            accent={sectorId === 'design' ? '#a78bfa' : '#fb923c'}
            onMarkSeen={markSeen}
            onReply={addReply}
            toast={toast}
          />
        ) : (page === 'idvisual' && isDesign) ? (
          <IdVisualBoard
            clients={myIdVisual}
            onMoveToProduction={wrap(idvMoveToProduction, 'ID Visual movido para Produção.')}
            onMoveBackToOnboarding={wrap(idvMoveBackToOnboarding)}
            onUpdateChecklist={idvUpdateChecklist}
            onUpdateNotes={idvUpdateNotes}
            onMoveStatus={wrap(idvMoveStatus, 'Status do ID Visual atualizado.')}
          />
        ) : page === 'entregas' ? (
          <EntregasSetor clients={clients} sectorId={sectorId} me={user?.name} acoes={acoesEntregas} />
        ) : page === 'onboarding' ? (
          <OnboardingBoard sectorId={sectorId} />
        ) : page === 'vault' ? (
          <VaultPage
            clients={clients}
            sectorId={sectorId}
            onUpdateBrandbook={handleUpdateBrandbook}
            onAddMaterial={(clientId, data) => addBrandMaterial(clientId, data, user?.name, sectorId)}
            onRemoveMaterial={removeBrandMaterial}
          />
        ) : page === 'agenda' ? (
          <AgendaView />
        ) : (
          <HallOfFame tasks={hallTasks} />
        )}
        {isVM && (
          <ConteudoModais
            modal={modal}
            onClose={() => setModal(null)}
            modo="vm"
            planos={myPlanos}
            clientes={myClients}
            marcacoes={minhasMarcacoes}
            me={user?.name}
            acoes={planejamento}
            acoesMarcacao={{ criarMarcacao, excluirMarcacao }}
            toast={toast}
          />
        )}
    </AppShell>
  );
}
