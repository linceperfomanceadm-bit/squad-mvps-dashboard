import React, { useState } from 'react';
import { LayoutDashboard, Columns, Plus, Kanban, CheckSquare, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useTasks } from '../../hooks/useTasks';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import SMOverview from '../../components/sectors/socialMedia/SMOverview';
import SMKanban from '../../components/sectors/socialMedia/SMKanban';
import SMBulkInput from '../../components/sectors/socialMedia/SMBulkInput';
import TaskKanban from '../../components/kanban/TaskKanban';

const NAV = [
  { key: 'overview',  label: 'Visão Geral',  icon: LayoutDashboard },
  { key: 'smkanban',  label: 'Posts',         icon: Columns },
  { key: 'planning',  label: 'Planejamento',  icon: Plus },
  { key: 'kanban',    label: 'Tasks',          icon: Kanban },
  { key: 'todo',      label: 'Meu Dia',        icon: CheckSquare },
  { key: 'agenda',    label: 'Agenda',         icon: Calendar },
];

export default function SocialMediaDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, loading, smAddBulkPosts, smUpdatePostStatus } = useClients();
  const { collaborators } = useCollaborators();
  const { tasks, loading: loadingTasks, createTask, moveToProduction, moveToApproval, approveTask, rejectTask, addComment, updateLinks, deleteTask } = useTasks();
  const [page, setPage] = useState('overview');

  const myClients = clients.filter(c => c.active && c.responsibles?.socialmedia === user?.name);
  const myPosts = [];
  myClients.forEach(c => {
    (c.sm?.posts || []).forEach(p => {
      if (p.responsible === user?.name) myPosts.push({ ...p, clientName: c.name, clientId: c.id });
    });
  });

  const myTasks = tasks.filter(t => t.responsibleName === user?.name || t.requestedBy === user?.name);
  const pendingApproval = myTasks.filter(t => t.status === 'approval' && t.responsibleName === user?.name).length;

  const handleBulkSave = async (rows) => {
    const res = await smAddBulkPosts(rows);
    if (res.success) { toast(`${rows.length} post${rows.length > 1 ? 's' : ''} adicionado${rows.length > 1 ? 's' : ''}!`); setPage('smkanban'); }
    else toast(res.error, 'e');
    return res;
  };

  const handleCreateTask = async (data) => {
    const res = await createTask(data);
    if (res.success) toast('Task criada!');
    else toast(res.error, 'e');
    return res;
  };

  const navItems = NAV.map(n => ({
    ...n,
    badge: n.key === 'smkanban' ? myPosts.filter(p => p.status === 'client').length : n.key === 'kanban' ? pendingApproval : 0,
    badgeDanger: (n.key === 'smkanban') || (n.key === 'kanban' && pendingApproval > 0),
  }));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="socialmedia" navItems={navItems} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 32, minHeight: '100vh', overflow: 'auto' }}>
        {loading || loadingTasks ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : page === 'overview' ? (
          <SMOverview myPosts={myPosts} onNavigate={setPage} />
        ) : page === 'smkanban' ? (
          <SMKanban myPosts={myPosts} onStatusChange={smUpdatePostStatus} />
        ) : page === 'planning' ? (
          <SMBulkInput clients={myClients} responsible={user?.name} onSave={handleBulkSave} />
        ) : page === 'todo' ? (
          <TodoView accent="#38bdf8" />
        ) : page === 'agenda' ? (
          <AgendaView />
        ) : (
          <TaskKanban
            tasks={tasks}
            clients={myClients}
            collaborators={collaborators}
            currentUser={user?.name}
            currentUserSector="socialmedia"
            onCreateTask={handleCreateTask}
            onMoveToProduction={moveToProduction}
            onMoveToApproval={moveToApproval}
            onApprove={approveTask}
            onReject={rejectTask}
            onAddComment={addComment}
            onUpdateLinks={updateLinks}
            onDelete={deleteTask}
          />
        )}
      </main>
    </div>
  );
}
