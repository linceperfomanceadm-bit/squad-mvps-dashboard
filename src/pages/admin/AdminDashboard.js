import React, { useState } from 'react';
import { LayoutDashboard, Users, UserCog, BarChart2, Activity, Kanban, BookOpen, Target, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useTasks } from '../../hooks/useTasks';
import { useLeads } from '../../hooks/useLeads';
import { useCommercialGoals } from '../../hooks/useCloserData';
import { useToast } from '../../components/shared/Toast';
import AdminOverview from '../../components/admin/AdminOverview';
import AdminFeed from '../../components/admin/AdminFeed';
import AdminCharts from '../../components/admin/AdminCharts';
import AdminClients from '../../components/admin/AdminClients';
import AdminCollaborators from '../../components/admin/AdminCollaborators';
import AdminLeads from '../../components/admin/AdminLeads';
import AdminGoals from '../../components/admin/AdminGoals';
import TaskKanban from '../../components/kanban/TaskKanban';
import VaultPage from '../../components/sectors/creative/VaultPage';
import { SECTORS } from '../../lib/firebase';

const NAV = [
  { key: 'overview',      label: 'Visão Geral',    icon: LayoutDashboard },
  { key: 'kanban',        label: 'Tasks',           icon: Kanban },
  { key: 'feed',          label: 'Extrato Diário',  icon: Activity },
  { key: 'leads',         label: 'Leads',           icon: Target },
  { key: 'goals',         label: 'Metas',           icon: TrendingUp },
  { key: 'charts',        label: 'Relatórios',      icon: BarChart2 },
  { key: 'vault',         label: 'O Cofre',         icon: BookOpen },
  { key: 'clients',       label: 'Clientes',        icon: Users },
  { key: 'collaborators', label: 'Colaboradores',   icon: UserCog },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const {
    clients, loading: loadingClients,
    addClient, updateClient, deleteClient,
    wdMoveToProduction, wdMoveBackToOnboarding, wdMoveStatus,
    updateBrandbook,
  } = useClients();
  const { collaborators, loading: loadingCollabs, addCollaborator, updateCollaborator, deleteCollaborator } = useCollaborators();
  const { leads, loading: loadingLeads, addLead, addLeadsBulk, deleteLead } = useLeads();
  const { goals, saveGoals } = useCommercialGoals();
  const {
    tasks, loading: loadingTasks,
    createTask, moveToProduction, moveToApproval,
    approveTask, rejectTask, addComment, updateLinks, deleteTask,
  } = useTasks();

  const [page, setPage] = useState('overview');
  const [taskSectorFilter, setTaskSectorFilter] = useState('');
  const [taskCollabFilter, setTaskCollabFilter] = useState('');

  const loading = loadingClients || loadingCollabs || loadingTasks || loadingLeads;

  const handleAddClient = async (data) => {
    const res = await addClient(data);
    if (res.success) toast(`${data.name} cadastrado!`);
    else toast(res.error, 'e');
    return res;
  };
  const handleAddCollab = async (data) => {
    const res = await addCollaborator(data);
    if (res.success) toast(`${data.name} adicionado ao time!`);
    else toast(res.error, 'e');
    return res;
  };
  const handleUpdateCollab = async (id, data) => {
    const res = await updateCollaborator(id, data);
    if (!res.success) toast(res.error, 'e');
    return res;
  };
  const handleDeleteCollab = async (id) => {
    const res = await deleteCollaborator(id);
    if (res.success) toast('Colaborador removido.', 'e');
    else toast(res.error, 'e');
    return res;
  };
  const handleCreateTask = async (data) => {
    const res = await createTask(data);
    if (res.success) toast('Task criada!');
    else toast(res.error, 'e');
    return res;
  };
  const handleUpdateBrandbook = async (clientId, brandbook) => {
    const res = await updateBrandbook(clientId, brandbook);
    if (res.success) toast('Brandbook atualizado!');
    else toast(res.error, 'e');
  };

  const pendingTasks = tasks.filter(t => t.status === 'approval').length;

  const navItems = NAV.map(n => ({
    ...n,
    badge: n.key === 'kanban' ? pendingTasks : 0,
    badgeDanger: n.key === 'kanban' && pendingTasks > 0,
  }));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <div style={S.logoIcon}><span style={{ fontSize: 20 }}>👑</span></div>
          <div>
            <div style={S.logoText}>Admin</div>
            <div style={S.logoBadge}>{user?.name}</div>
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
          {navItems.map(({ key, label, icon: Icon, badge, badgeDanger }) => (
            <button key={key} style={{ ...S.ni, ...(page === key ? S.niActive : {}) }} onClick={() => setPage(key)}>
              <Icon size={15} color={page === key ? 'var(--neon)' : 'var(--muted)'} />
              <span>{label}</span>
              {badge > 0 && (
                <span style={{ ...S.badge, ...(badgeDanger ? S.badgeDanger : {}) }}>{badge}</span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <button style={S.logoutBtn} onClick={logout}>
            <span style={{ fontSize: 14 }}>🚪</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sair</span>
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, marginLeft: 224, padding: 32, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : page === 'overview' ? (
          <AdminOverview clients={clients} collaborators={collaborators} tasks={tasks} onNavigate={setPage} />
        ) : page === 'kanban' ? (
          <div>
            {/* Admin filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <select style={S.filterSelect} value={taskSectorFilter} onChange={e => { setTaskSectorFilter(e.target.value); setTaskCollabFilter(''); }}>
                <option value="">Todos os setores</option>
                {Object.values(SECTORS).map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
              </select>
              <select style={S.filterSelect} value={taskCollabFilter} onChange={e => setTaskCollabFilter(e.target.value)}>
                <option value="">Todos os colaboradores</option>
                {collaborators.filter(c => c.active && (!taskSectorFilter || c.sector === taskSectorFilter)).map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              {(taskSectorFilter || taskCollabFilter) && (
                <button style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }} onClick={() => { setTaskSectorFilter(''); setTaskCollabFilter(''); }}>
                  Limpar filtros
                </button>
              )}
            </div>
            <TaskKanban
              tasks={tasks}
              clients={clients.filter(c => c.active)}
              collaborators={collaborators}
              currentUser={user?.name}
              currentUserSector={user?.sector || 'webdesign'}
              isAdmin={true}
              adminFilters={{ sector: taskSectorFilter, collaborator: taskCollabFilter }}
              onCreateTask={handleCreateTask}
              onMoveToProduction={moveToProduction}
              onMoveToApproval={moveToApproval}
              onApprove={approveTask}
              onReject={rejectTask}
              onAddComment={addComment}
              onUpdateLinks={updateLinks}
              onDelete={deleteTask}
            />
          </div>
        ) : page === 'feed' ? (
          <AdminFeed
            clients={clients}
            collaborators={collaborators}
            tasks={tasks}
            onMoveToProduction={moveToProduction}
            onMoveToApproval={moveToApproval}
            onApprove={approveTask}
            onReject={rejectTask}
            onAddComment={addComment}
            onUpdateLinks={updateLinks}
            onDelete={deleteTask}
          />
        ) : page === 'charts' ? (
          <AdminCharts clients={clients} tasks={tasks} />
        ) : page === 'leads' ? (
          <AdminLeads
            leads={leads}
            onAdd={addLead}
            onAddBulk={addLeadsBulk}
            onDelete={deleteLead}
            toast={toast}
          />
        ) : page === 'goals' ? (
          <AdminGoals goals={goals} collaborators={collaborators} onSave={saveGoals} toast={toast} />
        ) : page === 'vault' ? (
          <VaultPage
            clients={clients}
            sectorId="design"
            onUpdateBrandbook={handleUpdateBrandbook}
            isAdminView={true}
          />
        ) : page === 'clients' ? (
          <AdminClients
            clients={clients}
            collaborators={collaborators}
            onAdd={handleAddClient}
            onUpdate={updateClient}
            onDelete={deleteClient}
            onWdMoveToProduction={wdMoveToProduction}
            onWdMoveBackToOnboarding={wdMoveBackToOnboarding}
            onWdMoveStatus={wdMoveStatus}
          />
        ) : (
          <AdminCollaborators
            collaborators={collaborators}
            onAdd={handleAddCollab}
            onUpdate={handleUpdateCollab}
            onDelete={handleDeleteCollab}
          />
        )}
      </main>
    </div>
  );
}

const S = {
  sidebar: { width: 224, height: '100vh', background: 'rgba(9,9,20,.97)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '20px 14px', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 20, backdropFilter: 'blur(24px)' },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)' },
  logoIcon: { width: 38, height: 38, borderRadius: 10, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(238,51,99,.2)' },
  logoText: { fontSize: 14, fontWeight: 800, color: '#fff' },
  logoBadge: { fontSize: 10, color: 'var(--neon)', letterSpacing: '.08em', marginTop: 1, fontFamily: 'var(--fm)', textTransform: 'uppercase' },
  ni: { display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', borderRadius: 9, padding: '9px 11px', color: 'var(--muted)', fontSize: 13, fontWeight: 500, textAlign: 'left', width: '100%', cursor: 'pointer', transition: 'all .15s' },
  niActive: { background: 'var(--neon-dim)', color: 'var(--neon)', borderLeft: '2px solid var(--neon)', paddingLeft: 9 },
  badge: { marginLeft: 'auto', background: 'rgba(255,255,255,.07)', borderRadius: 10, padding: '1px 7px', fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)' },
  badgeDanger: { background: 'rgba(238,51,99,.2)', color: 'var(--neon)' },
  logoutBtn: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', cursor: 'pointer', width: '100%' },
  filterSelect: { background: '#12121f', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'var(--f)', minWidth: 180 },
};
