import React, { useState } from 'react';
import { LayoutDashboard, Kanban, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useTasks } from '../../hooks/useTasks';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import TaskKanban from '../../components/kanban/TaskKanban';
import { SECTORS, TASK_PRIORITIES } from '../../lib/firebase';
import { differenceInDays } from 'date-fns';

function GenericOverview({ myTasks, sectorId }) {
  const color = SECTORS[sectorId]?.color || 'var(--neon)';
  const now = new Date();
  const active = myTasks.filter(t => t.status !== 'done');
  const pendingApproval = myTasks.filter(t => t.status === 'approval');
  const done = myTasks.filter(t => t.status === 'done');
  const rework = myTasks.filter(t => t.isRework && t.status !== 'done');

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>
          Visão Geral
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>{SECTORS[sectorId]?.label}</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Tasks Ativas',        value: active.length,          color },
          { label: 'Aguard. Aprovação',    value: pendingApproval.length, color: pendingApproval.length > 0 ? 'var(--amber)' : 'var(--muted)' },
          { label: 'Concluídas',          value: done.length,            color: 'var(--green)' },
          { label: 'Em Ajuste',           value: rework.length,          color: rework.length > 0 ? 'var(--amber)' : 'var(--muted)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${s.color},transparent)` }} />
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{s.label}</p>
            <p style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* My active tasks list */}
      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Minhas Tasks Ativas</h2>
        {active.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>
            Nenhuma task ativa. 🎉
          </p>
        ) : (
          active.slice(0, 10).map(t => {
            const priority = TASK_PRIORITIES.find(p => p.id === t.priority);
            const isOverdue = t.deadline && differenceInDays(now, new Date(t.deadline)) > 0;
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    {t.isRework && <span style={{ fontSize: 9, color: 'var(--amber)', fontFamily: 'var(--fm)', fontWeight: 700 }}>🔄 AJUSTE</span>}
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>{t.clientName}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {priority && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: `${priority.color}15`, color: priority.color, fontFamily: 'var(--fm)' }}>
                      {priority.label}
                    </span>
                  )}
                  {isOverdue && <span style={{ fontSize: 10, color: 'var(--neon)', fontWeight: 700, fontFamily: 'var(--fm)' }}>ATRASADA</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Used for CS, Trafego, Comercial
export default function GenericSectorDashboard({ sectorId }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients } = useClients();
  const { collaborators } = useCollaborators();
  const {
    tasks, loading: loadingTasks,
    createTask, moveToProduction, moveToApproval,
    approveTask, rejectTask, addComment, updateLinks, deleteTask,
  } = useTasks();

  const [page, setPage] = useState('overview');

  const myClients = clients.filter(
    c => c.active && c.responsibles?.[sectorId] === user?.name
  );

  const myTasks = tasks.filter(
    t => t.responsibleName === user?.name || t.requestedBy === user?.name
  );
  const pendingApproval = myTasks.filter(
    t => t.status === 'approval' && t.responsibleName === user?.name
  ).length;

  const handleCreateTask = async (data) => {
    const res = await createTask(data);
    if (res.success) toast('Task criada!');
    else toast(res.error, 'e');
    return res;
  };

  const NAV = [
    { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard, badge: 0 },
    { key: 'kanban',   label: 'Tasks',        icon: Kanban, badge: pendingApproval, badgeDanger: pendingApproval > 0 },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId={sectorId} navItems={NAV} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 32, minHeight: '100vh', overflow: 'auto' }}>
        {loadingTasks ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : page === 'overview' ? (
          <GenericOverview myTasks={myTasks} sectorId={sectorId} />
        ) : (
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
        )}
      </main>
    </div>
  );
}
