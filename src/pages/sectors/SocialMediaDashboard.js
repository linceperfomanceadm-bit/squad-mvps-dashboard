import React, { useState } from 'react';
import { LayoutDashboard, Columns, Plus, Kanban, CheckSquare, Calendar, ClipboardList, BookOpen, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';
import RequestsInbox from '../../components/shared/RequestsInbox';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useTasks } from '../../hooks/useTasks';
import { useRequests } from '../../hooks/useRequests';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import SMOverview from '../../components/sectors/socialMedia/SMOverview';
import SMKanban from '../../components/sectors/socialMedia/SMKanban';
import OnboardingBoard from '../../components/commercial/OnboardingBoard';
import SMBulkInput from '../../components/sectors/socialMedia/SMBulkInput';
import VaultPage from '../../components/sectors/creative/VaultPage';
import TaskKanban from '../../components/kanban/TaskKanban';

// Responsável pode estar salvo como string (legado) ou array (multi).
const asArray = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

const NAV = [
  { key: 'overview',   label: 'Visão Geral',   icon: LayoutDashboard },
  { key: 'smkanban',   label: 'Posts',          icon: Columns },
  { key: 'planning',   label: 'Planejamento',   icon: Plus },
  { key: 'kanban',     label: 'Tasks',           icon: Kanban },
  { key: 'requests',   label: 'Reporte da CS',   icon: MessageSquare },
  { key: 'onboarding', label: 'Onboarding',      icon: ClipboardList },
  { key: 'vault',      label: 'Brand Hub',       icon: BookOpen },
  { key: 'todo',       label: 'Meu Dia',         icon: CheckSquare },
  { key: 'agenda',     label: 'Agenda',          icon: Calendar },
];

export default function SocialMediaDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    clients, loading, smAddBulkPosts, smUpdatePostStatus,
    updateBrandbook, addBrandMaterial, removeBrandMaterial,
  } = useClients();
  const { collaborators } = useCollaborators();
  const { tasks, loading: loadingTasks, createTask, moveToProduction, moveToApproval, approveTask, rejectTask, addComment, updateLinks, deleteTask, changeDeadline } = useTasks();
  const { requests, markSeen, addReply } = useRequests();
  const [page, setPage] = useState('overview');

  // `c.active !== false` e responsável em array: cliente antigo ou
  // cadastrado pelo admin (que salva array) continua aparecendo.
  const myClients = clients.filter(
    c => c.active !== false && asArray(c.responsibles?.socialmedia).includes(user?.name)
  );

  const myPosts = [];
  myClients.forEach(c => {
    (c.sm?.posts || []).forEach(p => {
      if (p.responsible === user?.name) myPosts.push({ ...p, clientName: c.name, clientId: c.id });
    });
  });

  const myTasks = tasks.filter(t => t.responsibleName === user?.name || t.requestedBy === user?.name);
  const pendingApproval = myTasks.filter(t => t.status === 'approval' && t.responsibleName === user?.name).length;

  // Solicitação da CS que ainda não foi respondida por esta pessoa.
  const openRequests = requests.filter(r => r.toName === user?.name && r.status === 'open').length;

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

  const handleUpdateBrandbook = async (clientId, brandbook, byName, bySector) => {
    const res = await updateBrandbook(clientId, brandbook, byName, bySector);
    if (res.success) toast('Brandbook atualizado!');
    else toast(res.error, 'e');
    return res;
  };

  const navItems = NAV.map(n => ({
    ...n,
    badge: n.key === 'smkanban'
      ? myPosts.filter(p => p.status === 'client').length
      : n.key === 'kanban' ? pendingApproval
      : n.key === 'requests' ? openRequests
      : 0,
    badgeDanger: (n.key === 'smkanban')
      || (n.key === 'kanban' && pendingApproval > 0)
      || (n.key === 'requests' && openRequests > 0),
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
        ) : page === 'onboarding' ? (
          <OnboardingBoard sectorId="socialmedia" />
        ) : page === 'requests' ? (
          <RequestsInbox
            requests={requests}
            currentUser={user?.name}
            currentUserSector="socialmedia"
            accent="#E91E63"
            onMarkSeen={markSeen}
            onReply={addReply}
            toast={toast}
          />
        ) : page === 'vault' ? (
          <VaultPage
            clients={clients}
            sectorId="socialmedia"
            onUpdateBrandbook={handleUpdateBrandbook}
            onAddMaterial={(clientId, data) => addBrandMaterial(clientId, data, user?.name, 'socialmedia')}
            onRemoveMaterial={removeBrandMaterial}
          />
        ) : page === 'todo' ? (
          <TodoView accent="#38bdf8" />
        ) : page === 'agenda' ? (
          <AgendaView />
        ) : (
          <TaskKanban
            tasks={tasks}
            clients={myClients}
            allClients={clients.filter(c => c.active !== false)}
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
            onChangeDeadline={changeDeadline}
            onDelete={deleteTask}
          />
        )}
      </main>
    </div>
  );
}
