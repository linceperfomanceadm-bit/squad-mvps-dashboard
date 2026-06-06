import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { TASK_COLUMNS } from '../../lib/firebase';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import CreateTaskModal from './CreateTaskModal';

export default function TaskKanban({
  tasks, clients, collaborators,
  currentUser, currentUserSector,
  isAdmin = false,
  adminFilters = null, // { sector, collaborator } — only for admin view
  onCreateTask, onMoveToProduction, onMoveToApproval,
  onApprove, onReject, onAddComment, onUpdateLinks, onDelete,
}) {
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Filter tasks visible to this user (unless admin)
  const visibleTasks = isAdmin
    ? tasks.filter(t => {
        if (adminFilters?.sector && t.responsibleSector !== adminFilters.sector && t.requestedBySector !== adminFilters.sector) return false;
        if (adminFilters?.collaborator && t.responsibleName !== adminFilters.collaborator && t.requestedBy !== adminFilters.collaborator) return false;
        return true;
      })
    : tasks.filter(t => t.responsibleName === currentUser || t.requestedBy === currentUser);

  const tasksByColumn = (colId) => visibleTasks.filter(t => t.status === colId);

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>
            Kanban de Tasks
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''} visíveis
            {visibleTasks.filter(t => t.status !== 'done' && t.isRework).length > 0 && (
              <span style={{ color: 'var(--amber)' }}>
                {' '}· {visibleTasks.filter(t => t.status !== 'done' && t.isRework).length} em ajuste
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg,var(--neon),#c41f4a)',
            border: 'none', borderRadius: 10, padding: '10px 18px',
            color: '#fff', fontSize: 13, fontWeight: 700,
            boxShadow: '0 4px 20px rgba(238,51,99,.35)', cursor: 'pointer',
          }}
        >
          <Plus size={15} /> Nova Task
        </button>
      </div>

      {/* Kanban columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, alignItems: 'start' }}>
        {TASK_COLUMNS.map(col => {
          const colTasks = tasksByColumn(col.id);
          const reworkCount = colTasks.filter(t => t.isRework).length;
          return (
            <div
              key={col.id}
              style={{
                background: 'rgba(12,12,24,.6)',
                border: `1px solid ${col.color}18`,
                borderRadius: 12,
                padding: '12px 10px',
                minHeight: 200,
              }}
            >
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: col.color, fontFamily: 'var(--fm)' }}>
                  {col.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {reworkCount > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid var(--amber-b)', fontFamily: 'var(--fm)' }}>
                      🔄 {reworkCount}
                    </span>
                  )}
                  <span style={{ background: `${col.color}20`, borderRadius: 10, padding: '1px 8px', fontSize: 11, color: col.color, fontFamily: 'var(--fm)' }}>
                    {colTasks.length}
                  </span>
                </div>
              </div>

              {/* Tasks */}
              {colTasks.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '24px 0', opacity: .5 }}>
                  Vazio
                </p>
              ) : (
                colTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => setSelectedTask(task)}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          currentUser={currentUser}
          currentUserSector={currentUserSector}
          collaborators={collaborators}
          onClose={() => setSelectedTask(null)}
          onMoveToProduction={async (...args) => { await onMoveToProduction(...args); setSelectedTask(null); }}
          onMoveToApproval={async (...args) => { await onMoveToApproval(...args); setSelectedTask(null); }}
          onApprove={onApprove}
          onReject={onReject}
          onAddComment={onAddComment}
          onUpdateLinks={onUpdateLinks}
          onDelete={async (...args) => { await onDelete(...args); setSelectedTask(null); }}
        />
      )}

      {/* Create task modal */}
      {showCreate && (
        <CreateTaskModal
          clients={clients}
          collaborators={collaborators}
          currentUser={currentUser}
          currentUserSector={currentUserSector}
          onClose={() => setShowCreate(false)}
          onSave={async (data) => {
            const res = await onCreateTask(data);
            if (res.success) setShowCreate(false);
            return res;
          }}
        />
      )}
    </div>
  );
}
