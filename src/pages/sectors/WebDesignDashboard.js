import React, { useState } from 'react';
import { LayoutDashboard, UserCheck, AlertCircle, RefreshCw, CheckCircle, Kanban, CheckSquare, Calendar, Package } from 'lucide-react';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import WDOverview from '../../components/sectors/webdesign/WDOverview';
import WDClientList from '../../components/sectors/webdesign/WDClientList';
import WDAddClientModal from '../../components/sectors/webdesign/WDAddClientModal';
import TaskKanban from '../../components/kanban/TaskKanban';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';
import AdminPortalClients from '../../components/admin/AdminPortalClients';

const NAV = [
  { key: 'overview',   label: 'Visão Geral',  icon: LayoutDashboard },
  { key: 'onboarding', label: 'Onboarding',   icon: UserCheck },
  { key: 'production', label: 'Produção',      icon: AlertCircle },
  { key: 'inactive',   label: 'Inativos',      icon: AlertCircle },
  { key: 'recurrence', label: 'Recorrência',   icon: RefreshCw },
  { key: 'finished',   label: 'Finalizados',   icon: CheckCircle },
  { key: 'kanban',     label: 'Tasks',          icon: Kanban },
  { key: 'portal',     label: 'Portal de Produtos', icon: Package },
  { key: 'todo',       label: 'Meu Dia',        icon: CheckSquare },
  { key: 'agenda',     label: 'Agenda',         icon: Calendar },
];

export default function WebDesignDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, loading, addClient, wdMoveToProduction, wdMoveBackToOnboarding, wdUpdateChecklist, wdUpdateNotes, wdMoveStatus, deleteClient } = useClients();
  const { collaborators } = useCollaborators();
  const { tasks, loading: loadingTasks, createTask, moveToProduction, moveToApproval, approveTask, rejectTask, addComment, updateLinks, deleteTask } = useTasks();

  const [page, setPage] = useState('overview');
  const [prodSubTab, setProdSubTab] = useState('ecommerce');
  const [showAddModal, setShowAddModal] = useState(false);

  const wdClients = clients.filter(c => c.wd?.status);

  const counts = {
    onboarding: wdClients.filter(c => c.wd.status === 'onboarding').length,
    production: wdClients.filter(c => c.wd.status === 'production').length,
    inactive: wdClients.filter(c => c.wd.status === 'inactive').length,
    recurrence: wdClients.filter(c => c.wd.status === 'recurrence').length,
    finished: wdClients.filter(c => c.wd.status === 'finished').length,
  };

  const overdueOnboarding = wdClients.filter(c => {
    if (c.wd.status !== 'onboarding' || !c.wd.onboardingStartedAt) return false;
    return (Date.now() - new Date(c.wd.onboardingStartedAt)) / 86400000 > 7;
  }).length;

  const myTasks = tasks.filter(t => t.responsibleName === user?.name || t.requestedBy === user?.name);
  const pendingApproval = myTasks.filter(t => t.status === 'approval' && t.responsibleName === user?.name).length;

  const navItems = NAV.map(n => ({
    ...n,
    badge: n.key === 'kanban' ? pendingApproval : (counts[n.key] || 0),
    badgeDanger: (n.key === 'onboarding' && overdueOnboarding > 0) || (n.key === 'kanban' && pendingApproval > 0),
  }));

  const handleAdd = async (data) => {
    const res = await addClient(data);
    if (res.success) toast(`${data.name} cadastrado!`);
    return res;
  };

  const handleCreateTask = async (data) => {
    const res = await createTask(data);
    if (res.success) toast('Task criada!');
    else toast(res.error, 'e');
    return res;
  };

  const wrap = (fn, successMsg) => async (...args) => {
    const res = await fn(...args);
    if (res.success && successMsg) toast(successMsg);
    else if (!res.success) toast(res.error, 'e');
    return res;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="webdesign" navItems={navItems} activeKey={page} onNav={setPage} onAddClient={() => setShowAddModal(true)} />
      <main style={{ flex: 1, marginLeft: 224, padding: 32, minHeight: '100vh', overflow: 'auto' }}>
        {loading || loadingTasks ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : page === 'overview' ? (
          <WDOverview clients={wdClients} collaborators={collaborators.filter(c => c.sector === 'webdesign')} onNavigate={setPage} />
        ) : page === 'kanban' ? (
          <TaskKanban
            tasks={tasks}
            clients={clients.filter(c => c.active)}
            collaborators={collaborators}
            currentUser={user?.name}
            currentUserSector="webdesign"
            onCreateTask={handleCreateTask}
            onMoveToProduction={moveToProduction}
            onMoveToApproval={moveToApproval}
            onApprove={approveTask}
            onReject={rejectTask}
            onAddComment={addComment}
            onUpdateLinks={updateLinks}
            onDelete={deleteTask}
          />
        ) : page === 'todo' ? (
          <TodoView accent="var(--neon)" />
        ) : page === 'agenda' ? (
          <AgendaView />
        ) : page === 'portal' ? (
          <AdminPortalClients clients={clients} currentUser={user} toast={toast} />
        ) : (
          <WDClientList
            clients={wdClients}
            collaborators={collaborators.filter(c => c.sector === 'webdesign')}
            page={page}
            prodSubTab={prodSubTab}
            setProdSubTab={setProdSubTab}
            onMoveToProduction={wrap(wdMoveToProduction)}
            onMoveBackToOnboarding={wrap(wdMoveBackToOnboarding)}
            onUpdateChecklist={wdUpdateChecklist}
            onUpdateNotes={wdUpdateNotes}
            onMoveStatus={(id, status, extra) => wrap(wdMoveStatus)(id, status, extra)}
            onDelete={wrap(deleteClient, 'Cliente removido.')}
            onAddClient={() => setShowAddModal(true)}
          />
        )}
      </main>
      {showAddModal && (
        <WDAddClientModal onClose={() => setShowAddModal(false)} onAdd={handleAdd} collaborators={collaborators.filter(c => c.sector === 'webdesign')} />
      )}
    </div>
  );
}
