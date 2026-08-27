import React, { useState, useRef, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { TASK_COLUMNS } from '../../lib/firebase';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import CreateTaskModal from './CreateTaskModal';

// deadline é string 'YYYY-MM-DD'. Comparar como texto evita a armadilha
// do new Date('2026-08-25'), que é interpretado como UTC e "volta" um dia
// no nosso fuso. Datas ISO ordenam alfabeticamente na mesma ordem que
// cronologicamente, então < e > funcionam direto.
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const DATE_FILTERS = [
  { id: '',         label: 'Todos os prazos' },
  { id: 'overdue',  label: 'Atrasadas' },
  { id: 'today',    label: 'Vencem hoje' },
  { id: 'tomorrow', label: 'Até amanhã' },
  { id: 'week',     label: 'Esta semana' },
  { id: 'none',     label: 'Sem prazo' },
];

export default function TaskKanban({
  tasks, clients, collaborators,
  allClients,
  currentUser, currentUserSector,
  isAdmin = false,
  adminFilters = null,
  // Modo acompanhamento (CS): vê tudo, comenta, mas não arrasta card
  // nem cria task. `myClientIds` alimenta o filtro "Meus clientes".
  readOnly = false,
  myClientIds = null,
  title = 'Kanban de Tasks',
  subtitle = null,
  onCreateTask, onMoveToProduction, onMoveToApproval,
  onApprove, onReject, onAddComment, onUpdateLinks, onChangeDeadline, onDelete,
}) {
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [clientFilter, setClientFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [scope, setScope] = useState('mine');
  const dragTask = useRef(null);

  const temEscopo = readOnly && Array.isArray(myClientIds);

  // Always derive selectedTask from live tasks array — this makes chat realtime
  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) || null : null;

  // Tasks que este usuário tem permissão de ver (antes dos filtros da tela).
  const baseTasks = readOnly
    ? tasks.filter(t => {
        if (!temEscopo || scope === 'all') return true;
        return t.clientId && myClientIds.includes(t.clientId);
      })
    : isAdmin
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

  // ── Filtros de tela ───────────────────────────────────────────
  const hoje = ymd(new Date());
  const amanha = ymd(addDays(new Date(), 1));
  // Fim da semana = domingo. getDay(): 0=domingo, então (dia+6)%7 dá
  // 0 para segunda-feira e 6 para domingo.
  const fimSemana = ymd(addDays(new Date(), 6 - ((new Date().getDay() + 6) % 7)));

  const matchDate = (t) => {
    if (!dateFilter) return true;
    if (dateFilter === 'none') return !t.deadline;
    if (!t.deadline) return false;
    if (dateFilter === 'overdue')  return t.deadline < hoje && t.status !== 'done';
    if (dateFilter === 'today')    return t.deadline === hoje;
    if (dateFilter === 'tomorrow') return t.deadline <= amanha;
    if (dateFilter === 'week')     return t.deadline <= fimSemana;
    return true;
  };

  const matchClient = (t) => {
    if (!clientFilter) return true;
    if (clientFilter === '__none__') return !t.clientId;
    return t.clientId === clientFilter;
  };

  const visibleTasks = baseTasks.filter(t => matchClient(t) && matchDate(t));

  // Lista de clientes montada a partir das tasks que o usuário já vê —
  // mostrar a carteira inteira da agência aqui só criaria um dropdown
  // gigante cheio de nome que essa pessoa não atende.
  const clientOptions = useMemo(() => {
    const mapa = new Map();
    let semCliente = 0;
    baseTasks.forEach(t => {
      if (!t.clientId) { semCliente += 1; return; }
      const atual = mapa.get(t.clientId);
      if (atual) atual.count += 1;
      else mapa.set(t.clientId, { id: t.clientId, name: t.clientName || 'Sem nome', count: 1 });
    });
    const lista = Array.from(mapa.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (semCliente) lista.push({ id: '__none__', name: 'Sem cliente', count: semCliente });
    return lista;
  }, [baseTasks]);

  const dateCounts = useMemo(() => {
    const c = {};
    DATE_FILTERS.forEach(f => { c[f.id] = 0; });
    baseTasks.forEach(t => {
      c[''] += 1;
      if (!t.deadline) { c.none += 1; return; }
      if (t.deadline < hoje && t.status !== 'done') c.overdue += 1;
      if (t.deadline === hoje) c.today += 1;
      if (t.deadline <= amanha) c.tomorrow += 1;
      if (t.deadline <= fimSemana) c.week += 1;
    });
    return c;
  }, [baseTasks, hoje, amanha, fimSemana]);

  const filtroAtivo = Boolean(clientFilter || dateFilter);
  const limparFiltros = () => { setClientFilter(''); setDateFilter(''); };

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

    if (readOnly) return;
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>
            {title}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {subtitle ? `${subtitle} · ` : ''}
            {filtroAtivo
              ? `${visibleTasks.length} de ${baseTasks.length} task${baseTasks.length !== 1 ? 's' : ''}`
              : `${visibleTasks.length} task${visibleTasks.length !== 1 ? 's' : ''} visíveis`}
            {visibleTasks.filter(t => t.status !== 'done' && t.isRework).length > 0 && (
              <span style={{ color: 'var(--amber)' }}>
                {' '}· {visibleTasks.filter(t => t.status !== 'done' && t.isRework).length} em ajuste
              </span>
            )}
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(238,51,99,.35)', cursor: 'pointer' }}
          >
            <Plus size={15} /> Nova Task
          </button>
        )}
      </div>

      {/* Escopo (só no modo acompanhamento da CS) */}
      {temEscopo && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { id: 'mine', label: 'Meus clientes' },
            { id: 'all',  label: 'Todos os clientes' },
          ].map(o => (
            <button
              key={o.id}
              onClick={() => { setScope(o.id); setClientFilter(''); }}
              style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: scope === o.id ? 'var(--neon-dim)' : 'var(--surface)',
                color: scope === o.id ? 'var(--neon)' : 'var(--muted)',
                border: `1px solid ${scope === o.id ? 'var(--neon-border)' : 'var(--border)'}`,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          style={{ ...S.filter, ...(clientFilter ? S.filterActive : null) }}
        >
          <option value="">Todos os clientes</option>
          {clientOptions.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.count})</option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          style={{ ...S.filter, ...(dateFilter ? S.filterActive : null) }}
        >
          {DATE_FILTERS.map(f => (
            <option key={f.id} value={f.id}>
              {f.label}{dateCounts[f.id] ? ` (${dateCounts[f.id]})` : ''}
            </option>
          ))}
        </select>

        {filtroAtivo && (
          <button onClick={limparFiltros} style={S.clearBtn}>
            <X size={13} /> Limpar filtros
          </button>
        )}
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
                <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '24px 0', opacity: .5 }}>
                  {filtroAtivo ? 'Nada com esse filtro' : 'Vazio'}
                </p>
              ) : (
                colTasks.map(task => (
                  <div
                    key={task.id}
                    draggable={!readOnly}
                    onDragStart={readOnly ? undefined : (e => handleDragStart(e, task))}
                    onDragEnd={readOnly ? undefined : handleDragEnd}
                    style={{ opacity: draggingId === task.id ? 0.4 : 1, cursor: readOnly ? 'pointer' : 'grab', transition: 'opacity .15s' }}
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
          readOnly={readOnly}
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
      {showCreate && !readOnly && (
        <CreateTaskModal
          clients={allClients || clients}
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

const S = {
  filter: {
    background: '#12121f', border: '1px solid var(--border)', borderRadius: 9,
    padding: '9px 13px', color: 'var(--text)', fontSize: 13, outline: 'none',
    cursor: 'pointer', fontFamily: 'var(--f)', minWidth: 180,
  },
  filterActive: {
    borderColor: 'var(--neon-border)', background: 'rgba(238,51,99,.08)', color: 'var(--neon)',
  },
  clearBtn: {
    display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
    border: '1px solid var(--border)', borderRadius: 9, padding: '9px 13px',
    color: 'var(--muted)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'var(--f)',
  },
};
