import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, Trophy, Kanban, Calendar, ClipboardList, Palette, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useTasks } from '../../hooks/useTasks';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useRequests } from '../../hooks/useRequests';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import CreativeOverview from '../../components/sectors/creative/CreativeOverview';
import VaultPage from '../../components/sectors/creative/VaultPage';
import HallOfFame from '../../components/sectors/creative/HallOfFame';
import IdVisualBoard from '../../components/sectors/creative/IdVisualBoard';
import TaskKanban from '../../components/kanban/TaskKanban';
import OnboardingBoard from '../../components/commercial/OnboardingBoard';
import AgendaView from '../../components/shared/AgendaView';
import RequestsInbox from '../../components/shared/RequestsInbox';

// Responsável pode estar salvo como string (legado) ou array (multi).
const asArray = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

export default function CreativeDashboard({ sectorId }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    clients, loading: loadingClients, updateBrandbook, addBrandMaterial, removeBrandMaterial,
    idvMoveToProduction, idvMoveBackToOnboarding, idvUpdateChecklist, idvUpdateNotes, idvMoveStatus,
  } = useClients();
  const { collaborators, loading: loadingCollabs } = useCollaborators();
  const {
    tasks, loading: loadingTasks,
    createTask, moveToProduction, moveToApproval,
    approveTask, rejectTask, addComment, updateLinks, deleteTask, changeDeadline,
  } = useTasks();
  const { requests, markSeen, addReply } = useRequests();

  const [page, setPage] = useState('overview');

  const responsibleField = sectorId === 'design' ? 'design' : 'videomaker';

  // `c.active !== false` + responsável em array: o admin salva os
  // responsáveis como lista, então comparar com === deixava a carteira
  // vazia para quem foi cadastrado por lá.
  const myClients = clients.filter(
    c => c.active !== false && asArray(c.responsibles?.[responsibleField]).includes(user?.name)
  );

  // ID Visual é exclusivo do Design e só do designer responsável.
  const isDesign = sectorId === 'design';
  const myIdVisual = isDesign
    ? clients.filter(c => c.active !== false && c.idv?.responsible === user?.name)
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

  const loading = loadingClients || loadingCollabs || loadingTasks;

  const NAV = [
    { key: 'overview',  label: 'Visão Geral',   icon: LayoutDashboard },
    { key: 'kanban',    label: 'Tasks',          icon: Kanban },
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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId={sectorId} navItems={navItems} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 32, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
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
            allClients={clients.filter(c => c.active !== false)}
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
      </main>
    </div>
  );
}
