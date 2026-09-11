import React, { useState } from 'react';
import { LayoutDashboard, UserCheck, AlertCircle, RefreshCw, CheckCircle, Kanban, Calendar, Package, ClipboardList, MessageSquare } from 'lucide-react';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useTasks } from '../../hooks/useTasks';
import { useRequests } from '../../hooks/useRequests';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import AppShell from '../../components/shared/AppShell';
import WDOverview from '../../components/sectors/webdesign/WDOverview';
import WDClientList from '../../components/sectors/webdesign/WDClientList';
import WDAddServiceModal from '../../components/sectors/webdesign/WDAddServiceModal';
import TaskKanban from '../../components/kanban/TaskKanban';
import AgendaView from '../../components/shared/AgendaView';
import AdminPortalClients from '../../components/admin/AdminPortalClients';
import RequestsInbox from '../../components/shared/RequestsInbox';
import OnboardingBoard from '../../components/commercial/OnboardingBoard';
import { wdCardsOf } from '../../lib/wdJobs';
import { WD_SERVICE_CONFIG } from '../../lib/firebase';

const NAV = [
  { key: 'overview',   label: 'Visão Geral',  icon: LayoutDashboard },
  { key: 'onboarding', label: 'Onboarding',   icon: UserCheck },
  { key: 'production', label: 'Produção',      icon: AlertCircle },
  { key: 'inactive',   label: 'Inativos',      icon: AlertCircle },
  { key: 'recurrence', label: 'Recorrência',   icon: RefreshCw },
  { key: 'finished',   label: 'Finalizados',   icon: CheckCircle },
  { key: 'kanban',     label: 'Tasks',          icon: Kanban },
  { key: 'requests',   label: 'Reporte da CS',  icon: MessageSquare },
  { key: 'client_onboarding', label: 'Onboarding de Clientes', icon: ClipboardList },
  { key: 'portal',     label: 'Portal de Produtos', icon: Package },
  { key: 'agenda',     label: 'Agenda',         icon: Calendar },
];

export default function WebDesignDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, loading, wdAddService, wdRemoveService, wdMoveToProduction, wdMoveBackToOnboarding, wdUpdateChecklist, wdUpdateNotes, wdMoveStatus } = useClients();
  const { collaborators } = useCollaborators();
  const { tasks, loading: loadingTasks, createTask, moveToProduction, moveToApproval, approveTask, rejectTask, addComment, updateLinks, deleteTask, changeDeadline } = useTasks();
  const { requests, markSeen, addReply } = useRequests();

  const [page, setPage] = useState('overview');
  const [prodSubTab, setProdSubTab] = useState('ecommerce');
  const [showAddModal, setShowAddModal] = useState(false);

  // Só clientes já liberados (live). Fora de `live` o doc grava
  // `active: false` — sem esse filtro, cliente em kick off/staffing
  // com serviço WD entrava em "Ativos", nos badges e nas listas.
  const liveClients = clients.filter(c => c.active !== false);
  const wdCards = wdCardsOf(liveClients);
  const wdClients = liveClients.filter(c => wdCards.some(k => k.client.id === c.id));

  // Contagens por serviço (um cliente com E-commerce + LP aparece nas duas).
  const counts = {
    onboarding: wdCards.filter(k => k.job.status === 'onboarding').length,
    production: wdCards.filter(k => k.job.status === 'production').length,
    inactive: wdCards.filter(k => k.job.status === 'inactive').length,
    recurrence: wdCards.filter(k => k.job.status === 'recurrence').length,
    finished: wdCards.filter(k => k.job.status === 'finished').length,
  };

  const overdueOnboarding = wdCards.filter(({ job }) => {
    if (job.status !== 'onboarding' || !job.onboardingStartedAt) return false;
    return (Date.now() - new Date(job.onboardingStartedAt)) / 86400000 > 7;
  }).length;

  const myTasks = tasks.filter(t => t.responsibleName === user?.name || t.requestedBy === user?.name);
  const pendingApproval = myTasks.filter(t => t.status === 'approval' && t.responsibleName === user?.name).length;

  // Solicitação da CS ainda não respondida por esta pessoa.
  const openRequests = requests.filter(r => r.toName === user?.name && r.status === 'open').length;

  const navItems = NAV.map(n => ({
    ...n,
    badge: n.key === 'kanban' ? pendingApproval
      : n.key === 'requests' ? openRequests
      : (counts[n.key] || 0),
    badgeDanger: (n.key === 'onboarding' && overdueOnboarding > 0)
      || (n.key === 'kanban' && pendingApproval > 0)
      || (n.key === 'requests' && openRequests > 0),
  }));

  const handleAddService = async (clientId, data, clientName) => {
    const res = await wdAddService(clientId, data, user?.name);
    if (res.success) toast(`${WD_SERVICE_CONFIG[data.service]?.label || 'Serviço'} adicionado a ${clientName}!`);
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
    <AppShell sectorId="webdesign" navItems={navItems} activeKey={page} onNav={setPage} onAddClient={() => setShowAddModal(true)} addClientLabel="Adicionar Serviço">
        {loading || loadingTasks ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : page === 'overview' ? (
          <WDOverview clients={wdClients} collaborators={collaborators.filter(c => c.sector === 'webdesign')} onNavigate={setPage} />
        ) : page === 'kanban' ? (
          <TaskKanban
            tasks={tasks}
            clients={clients.filter(c => c.active !== false)}
            allClients={clients.filter(c => c.active !== false)}
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
            onChangeDeadline={changeDeadline}
            onDelete={deleteTask}
          />
        ) : page === 'requests' ? (
          <RequestsInbox
            requests={requests}
            currentUser={user?.name}
            currentUserSector="webdesign"
            accent="#FD2534"
            onMarkSeen={markSeen}
            onReply={addReply}
            toast={toast}
          />
        ) : page === 'agenda' ? (
          <AgendaView />
        ) : page === 'portal' ? (
          <AdminPortalClients clients={clients} currentUser={user} toast={toast} />
        ) : page === 'client_onboarding' ? (
          <OnboardingBoard sectorId="webdesign" />
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
            onMoveStatus={wrap(wdMoveStatus)}
            onDelete={wrap(wdRemoveService, 'Serviço removido.')}
            onAddClient={() => setShowAddModal(true)}
          />
        )}
      {showAddModal && (
        <WDAddServiceModal onClose={() => setShowAddModal(false)} onAdd={handleAddService} clients={liveClients} collaborators={collaborators.filter(c => c.sector === 'webdesign')} />
      )}
    </AppShell>
  );
}
