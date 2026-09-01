import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Kanban, FileText, Calendar, ClipboardList, BookOpen, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AgendaView from '../../components/shared/AgendaView';
import RequestsInbox from '../../components/shared/RequestsInbox';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useTasks } from '../../hooks/useTasks';
import { useRequests } from '../../hooks/useRequests';
import { useDocuments } from '../../hooks/useDocuments';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import SMOverview from '../../components/sectors/socialMedia/SMOverview';
import SMMural from '../../components/sectors/socialMedia/SMMural';
import DocsList from '../../components/sectors/socialMedia/docs/DocsList';
import OnboardingBoard from '../../components/commercial/OnboardingBoard';
import VaultPage from '../../components/sectors/creative/VaultPage';
import TaskKanban from '../../components/kanban/TaskKanban';

// Responsável pode estar salvo como string (legado) ou array (multi).
const asArray = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

const NAV = [
  { key: 'overview',   label: 'Visão Geral',   icon: LayoutDashboard },
  { key: 'mural',      label: 'Mural',          icon: Users },
  { key: 'kanban',     label: 'Tasks',          icon: Kanban },
  { key: 'documentos', label: 'Documentos',     icon: FileText },
  { key: 'requests',   label: 'Reporte da CS',  icon: MessageSquare },
  { key: 'onboarding', label: 'Onboarding de Clientes', icon: ClipboardList },
  { key: 'vault',      label: 'Brand Hub',      icon: BookOpen },
  { key: 'agenda',     label: 'Agenda',         icon: Calendar },
];

export default function SocialMediaDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { clients, loading, updateBrandbook, addBrandMaterial, removeBrandMaterial } = useClients();
  const { collaborators } = useCollaborators();
  const {
    tasks, loading: loadingTasks, createTask, moveToProduction, moveToApproval,
    approveTask, rejectTask, addComment, updateLinks, deleteTask, changeDeadline,
  } = useTasks();
  const { requests, markSeen, addReply } = useRequests();
  const { documents, createDocument, deleteDocument } = useDocuments();
  const [page, setPage] = useState('overview');

  // `c.active !== false` e responsável em array: cliente antigo ou
  // cadastrado pelo admin (que salva array) continua aparecendo.
  const myClients = clients.filter(
    c => c.active !== false && asArray(c.responsibles?.socialmedia).includes(user?.name)
  );

  // Cada social media enxerga os documentos dos clientes em que é
  // responsável. O admin tem a visão completa no painel próprio.
  const myClientIds = myClients.map(c => c.id);
  const myDocs = documents.filter(d => myClientIds.includes(d.clientId));

  const myTasks = tasks.filter(t => t.responsibleName === user?.name || t.requestedBy === user?.name);
  const pendingApproval = myTasks.filter(t => t.status === 'approval' && t.responsibleName === user?.name).length;

  // Solicitação da CS que ainda não foi respondida por esta pessoa.
  const openRequests = requests.filter(r => r.toName === user?.name && r.status === 'open').length;

  // Documento em rascunho ou revisão conta como trabalho em aberto.
  const openDocs = myDocs.filter(d => d.status === 'rascunho' || d.status === 'revisao').length;

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

  const handleCreateDoc = async (dados) => {
    const res = await createDocument({
      ...dados,
      autorName: user?.name,
      autorSector: 'socialmedia',
    });
    if (res.success) navigate(`/documentos/${res.id}`);
    else toast(res.error, 'e');
    return res;
  };

  const handleDeleteDoc = async (id) => {
    const res = await deleteDocument(id);
    if (res.success) toast('Documento apagado.');
    else toast(res.error, 'e');
  };

  // Criar documento a partir do card do cliente, no Mural: o cliente
  // já vem escolhido, então cai direto no editor.
  const handleNovoDocDoCliente = async (cliente) => {
    await handleCreateDoc({
      tipo: 'pre-estrategia',
      clientId: cliente.id,
      clientName: cliente.name,
    });
  };

  const navItems = NAV.map(n => ({
    ...n,
    badge: n.key === 'kanban' ? pendingApproval
      : n.key === 'requests' ? openRequests
      : n.key === 'documentos' ? openDocs
      : 0,
    badgeDanger: (n.key === 'kanban' && pendingApproval > 0)
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
          <SMOverview
            myClients={myClients}
            myDocs={myDocs}
            myTasks={myTasks}
            onNavigate={setPage}
          />
        ) : page === 'mural' ? (
          <SMMural
            clients={myClients}
            documents={myDocs}
            tasks={tasks}
            onAbrirDocumento={(id) => navigate(`/documentos/${id}`)}
            onNovoDocumento={handleNovoDocDoCliente}
          />
        ) : page === 'documentos' ? (
          <DocsList
            documents={myDocs}
            clients={myClients}
            currentUser={user?.name}
            isAdmin={!!user?.isAdmin}
            onOpen={(id) => navigate(`/documentos/${id}`)}
            onCreate={handleCreateDoc}
            onDelete={handleDeleteDoc}
          />
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
