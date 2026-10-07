import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Kanban, FileText, Calendar, CalendarDays, LayoutGrid, ClipboardList, BookOpen, MessageSquare, ListChecks } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AgendaView from '../../components/shared/AgendaView';
import RequestsInbox from '../../components/shared/RequestsInbox';
import { naCarteira } from '../../lib/firebase';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useTasks } from '../../hooks/useTasks';
import { useRequests } from '../../hooks/useRequests';
import { useDocuments } from '../../hooks/useDocuments';
import { usePlanejamentos } from '../../hooks/usePlanejamentos';
import { useMarcacoes } from '../../hooks/useMarcacoes';
import { statusDoPost } from '../../lib/planejamento';
import { useToast } from '../../components/shared/Toast';
import AppShell from '../../components/shared/AppShell';
import SMOverview from '../../components/sectors/socialMedia/SMOverview';
import SMMural from '../../components/sectors/socialMedia/SMMural';
import DocsList from '../../components/sectors/socialMedia/docs/DocsList';
import OnboardingBoard from '../../components/commercial/OnboardingBoard';
import VaultPage from '../../components/sectors/creative/VaultPage';
import TaskKanban from '../../components/kanban/TaskKanban';
import EntregasSetor from '../../components/entregas/EntregasSetor';
import { acoesDeEntregas } from '../../components/entregas/acoes';
import PlanejamentosPage from '../../components/planejamento/PlanejamentosPage';
import CalendarioConteudo from '../../components/planejamento/CalendarioConteudo';
import ConteudoModais from '../../components/planejamento/ConteudoModais';

// Responsável pode estar salvo como string (legado) ou array (multi).
const asArray = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

const NAV = [
  { key: 'overview',   label: 'Visão Geral',   icon: LayoutDashboard },
  { key: 'mural',      label: 'Mural',          icon: Users },
  { key: 'planejamentos', label: 'Planejamentos', icon: LayoutGrid },
  { key: 'calendario', label: 'Calendário',     icon: CalendarDays },
  { key: 'entregas',   label: 'Entregas do Mês', icon: ListChecks },
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
  const { clients, loading, updateBrandbook, addBrandMaterial, removeBrandMaterial, marcarEntrega, marcarMarcoSM } = useClients();
  const { collaborators } = useCollaborators();
  const {
    tasks, loading: loadingTasks, createTask, moveToProduction, moveToApproval,
    approveTask, rejectTask, addComment, updateLinks, deleteTask, changeDeadline,
  } = useTasks();
  const { requests, markSeen, addReply } = useRequests();
  const { documents, createDocument, deleteDocument, saveVersion } = useDocuments();
  const planejamento = usePlanejamentos();
  const { marcacoes } = useMarcacoes();
  const [page, setPage] = useState('overview');
  // Planejamento aberto no editor ({ id, postId? }), modal de conteúdo
  // e o dia em que o calendário abre (vindo do mini calendário).
  const [planoAberto, setPlanoAberto] = useState(null);
  const [modal, setModal] = useState(null);
  const [calInicial, setCalInicial] = useState(null);

  // Quem produz só marca entregas — escopo e cadastro são da CS.
  const acoesEntregas = acoesDeEntregas({ marcarEntrega }, user?.name, toast, { soMarcar: true });

  // `naCarteira` e não `active !== false`: o cliente entra na carteira
  // assim que o líder indica o responsável, ainda em staffing/Kick Off
  // /onboarding. É o que permite começar a pré-estratégia antes da
  // call de onboarding acontecer. Responsável em array porque o admin
  // salva lista — cliente antigo continua aparecendo.
  const myClients = clients.filter(
    c => naCarteira(c) && asArray(c.responsibles?.socialmedia).includes(user?.name)
  );

  // Cada social media enxerga os documentos dos clientes em que é
  // responsável. O admin tem a visão completa no painel próprio.
  const myClientIds = myClients.map(c => c.id);
  const myDocs = documents.filter(d => myClientIds.includes(d.clientId));
  const myPlanos = planejamento.planejamentos.filter(p => myClientIds.includes(p.clientId));

  // Post em que o cliente pediu ajuste e ainda não foi reenviado.
  const ajustesPedidos = myPlanos.reduce((n, pl) => n + (pl.posts || []).filter(p => statusDoPost(p, pl) === 'ajuste').length, 0);

  const abrirPlano = (id, postId) => { setPlanoAberto({ id, postId }); setPage('planejamentos'); };
  const abrirCalendario = (iso) => { setCalInicial(iso); setPage('calendario'); };
  const abrirPost = (planoId, postId) => setModal({ t: 'post', planoId, postId });

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

  // PDF a partir do modo apresentação da lista: grava a versão, como o
  // editor faz, e abre a rota de impressão.
  const handleSalvarPDF = async (documento) => {
    const res = await saveVersion(documento, user?.name);
    if (!res.success) toast(res.error, 'e');
    window.open(`/documentos/${documento.id}/imprimir`, '_blank', 'noopener');
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

  // Checklist mensal do card do cliente no Mural.
  const handleMarcarMarco = async (clientId, mes, marcoId, feito) => {
    const res = await marcarMarcoSM(clientId, mes, marcoId, feito, user?.name);
    if (!res.success) toast(res.error || 'Não foi possível salvar.', 'e');
    return res;
  };

  const navItems = NAV.map(n => ({
    ...n,
    badge: n.key === 'kanban' ? pendingApproval
      : n.key === 'planejamentos' ? ajustesPedidos
      : n.key === 'requests' ? openRequests
      : n.key === 'documentos' ? openDocs
      : 0,
    badgeDanger: (n.key === 'kanban' && pendingApproval > 0)
      || (n.key === 'requests' && openRequests > 0),
  }));

  return (
    <AppShell sectorId="socialmedia" navItems={navItems} activeKey={page} onNav={(k) => { if (k === 'planejamentos') setPlanoAberto(null); if (k === 'calendario') setCalInicial(null); setPage(k); }}>
        {loading || loadingTasks || planejamento.loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : page === 'overview' ? (
          <SMOverview
            me={user?.name}
            myClients={myClients}
            myDocs={myDocs}
            myTasks={myTasks}
            planos={myPlanos}
            onNavigate={setPage}
            onAbrirPost={abrirPost}
            onAbrirPlano={(id) => abrirPlano(id)}
            onAbrirCalendario={abrirCalendario}
          />
        ) : page === 'planejamentos' ? (
          <PlanejamentosPage
            clientes={myClients}
            planos={myPlanos}
            me={user?.name}
            acoes={planejamento}
            toast={toast}
            aberto={planoAberto}
            onAbrir={setPlanoAberto}
          />
        ) : page === 'calendario' ? (
          <CalendarioConteudo
            key={calInicial || 'cal'}
            modo="sm"
            clientes={myClients}
            planos={myPlanos}
            inicial={calInicial}
            onAbrirPost={abrirPost}
            onIrPlanejamentos={() => { setPlanoAberto(null); setPage('planejamentos'); }}
          />
        ) : page === 'mural' ? (
          <SMMural
            clients={myClients}
            documents={myDocs}
            tasks={tasks}
            onAbrirDocumento={(id) => navigate(`/documentos/${id}`)}
            onNovoDocumento={handleNovoDocDoCliente}
            acoesEntregas={acoesEntregas}
            onMarcarMarco={handleMarcarMarco}
          />
        ) : page === 'entregas' ? (
          <EntregasSetor clients={clients} sectorId="socialmedia" me={user?.name} acoes={acoesEntregas} />
        ) : page === 'documentos' ? (
          <DocsList
            documents={myDocs}
            clients={myClients}
            currentUser={user?.name}
            isAdmin={!!user?.isAdmin}
            onOpen={(id) => navigate(`/documentos/${id}`)}
            onSalvarPDF={handleSalvarPDF}
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
            allClients={clients}
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
        <ConteudoModais
          modal={modal}
          onClose={() => setModal(null)}
          modo="sm"
          planos={myPlanos}
          clientes={myClients}
          marcacoes={marcacoes}
          me={user?.name}
          acoes={planejamento}
          toast={toast}
          onAbrirPlanejamento={abrirPlano}
        />
    </AppShell>
  );
}
