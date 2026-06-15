import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, Trophy, Kanban, CheckSquare, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useTasks } from '../../hooks/useTasks';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import CreativeOverview from '../../components/sectors/creative/CreativeOverview';
import VaultPage from '../../components/sectors/creative/VaultPage';
import HallOfFame from '../../components/sectors/creative/HallOfFame';
import TaskKanban from '../../components/kanban/TaskKanban';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';

const NAV = [
  { key: 'overview',  label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'kanban',    label: 'Tasks',        icon: Kanban },
  { key: 'vault',     label: 'O Cofre',      icon: BookOpen },
  { key: 'hallofame', label: 'Hall da Fama', icon: Trophy },
  { key: 'todo',      label: 'Meu Dia',      icon: CheckSquare },
  { key: 'agenda',    label: 'Agenda',       icon: Calendar },
];

export default function CreativeDashboard({ sectorId }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, loading: loadingClients, updateBrandbook } = useClients();
  const { collaborators, loading: loadingCollabs } = useCollaborators();
  const {
    tasks, loading: loadingTasks,
    createTask, moveToProduction, moveToApproval,
    approveTask, rejectTask, addComment, updateLinks, deleteTask,
  } = useTasks();

  const [page, setPage] = useState('overview');

  const responsibleField = sectorId === 'design' ? 'design' : 'videomaker';

  // Only clients where this collaborator is responsible
  const myClients = clients.filter(
    c => c.active && c.responsibles?.[responsibleField] === user?.name
  );

  // Hall of Fame uses tasks from BOTH design and videomaker
  const hallTasks = tasks.filter(
    t => (t.responsibleSector === 'design' || t.responsibleSector === 'videomaker')
  );

  const handleUpdateBrandbook = async (clientId, brandbook) => {
    const res = await updateBrandbook(clientId, brandbook);
    if (res.success) toast('Brandbook atualizado!');
    else toast(res.error, 'e');
  };

  const handleCreateTask = async (data) => {
    const res = await createTask(data);
    if (res.success) toast('Task criada!');
    else toast(res.error, 'e');
    return res;
  };

  const loading = loadingClients || loadingCollabs || loadingTasks;

  const navItems = NAV.map(n => {
    const myTasks = tasks.filter(t => t.responsibleName === user?.name || t.requestedBy === user?.name);
    const pendingApproval = myTasks.filter(t => t.status === 'approval' && t.responsibleName === user?.name).length;
    return { ...n, badge: n.key === 'kanban' ? pendingApproval : 0, badgeDanger: n.key === 'kanban' && pendingApproval > 0 };
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
            onDelete={deleteTask}
          />
        ) : page === 'vault' ? (
          <VaultPage clients={clients} sectorId={sectorId} onUpdateBrandbook={handleUpdateBrandbook} />
        ) : page === 'todo' ? (
          <TodoView accent={sectorId === 'design' ? '#a78bfa' : '#fb923c'} />
        ) : page === 'agenda' ? (
          <AgendaView />
        ) : (
          <HallOfFame tasks={hallTasks} />
        )}
      </main>
    </div>
  );
}
