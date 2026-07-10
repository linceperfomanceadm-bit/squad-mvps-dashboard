import React, { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import { TASK_COLUMNS } from '../../lib/firebase';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import CreateTaskModal from './CreateTaskModal';

export default function TaskKanban({
  tasks, clients, collaborators,
  currentUser, currentUserSector,
  isAdmin = false,
  adminFilters = null,
  onCreateTask, onMoveToProduction, onMoveToApproval,
  onApprove, onReject, onAddComment, onUpdateLinks, onChangeDeadline, onDelete,
}) {
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const dragTask = useRef(null);

  // Always derive selectedTask from live tasks array — this makes chat realtime
  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) || null : null;

  // Filter tasks visible to this user
  const visibleTasks = isAdmin
    ? tasks.filter(t => {
        if (adminFilters?.sector && t.responsibleSector !== adminFilters.sector && t.requestedBySector !== adminFilters.sector) return false;
        if (adminFilters?.collaborator && t.responsibleName !== adminFilters.collaborator && t.requestedBy !== adminFilters.collaborator) return false;
        return true;
      })
    : tasks.filter(t =>
        t.responsibleName === currentUser ||
        (Array.isArray(t.responsibleNames) && t.responsibleNames.includes(currentUser)) ||
        t.requestedBy === currentUser ||
        t.deliveredBy === currentUser
      );

  const tasksByColumn = (colId) => visibleTasks.filter(t => t.status === colId);

  // ── Drag handlers ─────────────────────────────────────────────
  const handleDragStart = (e, task) => {
    dragTask.current = task;
    setDraggingId(task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
    dragTask.current = null;
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colId);
  };

  const handleDrop = async (e, targetColId) => {
    e.preventDefault();
    const task = dragTask.current;
    setDraggingId(null);
    setDragOverCol(null);
    dragTask.current = null;

    if (!task || task.status === targetColId) return;

    const isResponsible = task.responsibleName === currentUser ||
      (Array.isArray(task.responsibleNames) && task.responsibleNames.includes(currentUser));
    const isRequester   = task.requestedBy === currentUser;

    if (!isAdmin && !isResponsible && !isRequester) return;

    if (task.status === 'todo' && targetColId === 'doing' && (isResponsible || isAdmin)) {
      await onMoveToProduction(task.id, task.links);
      return;
    }
    if (task.status === 'doing' && targetColId === 'approval' && (isResponsible || isAdmin)) {
      setSelectedTaskId(task.id);
      return;
    }
    if (task.status === 'approval' && targetColId === 'done' && (isResponsible || isAdmin)) {
      await onApprove(task.id);
      return;
    }
    if (task.status === 'approval' && targetColId === 'doing' && (isResponsible || isAdmin)) {
      setSelectedTaskId(task.id);
      return;
    }
    if (isAdmin) {
      setSelectedTaskId(task.id);
      return;
    }
  };

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
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(238,51,99,.35)', cursor: 'pointer' }}
        >
          <Plus size={15} /> Nova Task
        </button>
      </div>

      {/* Kanban columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, alignItems: 'start' }}>
        {TASK_COLUMNS.map(col => {
          const colTasks     = tasksByColumn(col.id);
          const reworkCount  = colTasks.filter(t => t.isRework).length;
          const isDragTarget = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              style={{
                background: isDragTarget ? `${col.color}08` : 'rgba(12,12,24,.6)',
                border: `1px solid ${isDragTarget ? `${col.color}40` : `${col.color}18`}`,
                borderRadius: 12, padding: '12px 10px', minHeight: 200,
                transition: 'all .15s ease',
              }}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: col.color, fontFamily: 'var(--fm)' }}>{col.label}</span>
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

              {/* Drop hint */}
              {isDragTarget && draggingId && (
                <div style={{ border: `2px dashed ${col.color}50`, borderRadius: 8, padding: '12px', marginBottom: 8, textAlign: 'center' }}>
                  <span style={{ fontSize: 11, color: col.color, fontFamily: 'var(--fm)' }}>Soltar aqui</span>
                </div>
              )}

              {/* Tasks */}
              {colTasks.length === 0 && !isDragTarget ? (
                <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '24px 0', opacity: .5 }}>Vazio</p>
              ) : (
                colTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={e => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    style={{ opacity: draggingId === task.id ? 0.4 : 1, cursor: 'grab', transition: 'opacity .15s' }}
                  >
                    <TaskCard task={task} onClick={() => setSelectedTaskId(task.id)} />
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Task detail modal — uses live task from tasks array */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          currentUser={currentUser}
          currentUserSector={currentUserSector}
          collaborators={collaborators}
          isAdmin={isAdmin}
          onClose={() => setSelectedTaskId(null)}
          onMoveToProduction={async (...args) => { await onMoveToProduction(...args); setSelectedTaskId(null); }}
          onMoveToApproval={async (...args) => { await onMoveToApproval(...args); setSelectedTaskId(null); }}
          onApprove={onApprove}
          onReject={onReject}
          onAddComment={onAddComment}
          onUpdateLinks={onUpdateLinks}
          onChangeDeadline={onChangeDeadline}
          onDelete={async (...args) => { await onDelete(...args); setSelectedTaskId(null); }}
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
