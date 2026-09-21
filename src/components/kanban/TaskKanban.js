import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { TASK_COLUMNS, TASK_PRIORITIES } from '../../lib/firebase';
import { saveTaskOrder } from '../../hooks/useTasks';
import { taskCreatedAt } from '../../lib/taskTime';
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

// Ordenação das colunas. "Minha ordem" é a que a pessoa monta
// arrastando o card dentro da coluna; task que ela ainda não
// organizou entra no topo, pelo prazo mais próximo — é o que é novo
// para ela.
const SORT_OPTIONS = [
  { id: 'manual',        label: 'Minha ordem' },
  { id: 'deadline_asc',  label: 'Prazo mais próximo' },
  { id: 'deadline_desc', label: 'Prazo mais distante' },
  { id: 'created_desc',  label: 'Criadas recentemente' },
  { id: 'created_asc',   label: 'Criadas há mais tempo' },
  { id: 'priority',      label: 'Prioridade' },
];

const PRIORITY_RANK = Object.fromEntries(TASK_PRIORITIES.map((p, i) => [p.id, TASK_PRIORITIES.length - i]));
const createdMs = (t) => { const d = taskCreatedAt(t); return d ? d.getTime() : 0; };
// Sem prazo vai para o fim nas duas direções — é o que menos aperta.
const byDeadline = (dir) => (a, b) => {
  if (!a.deadline && !b.deadline) return createdMs(a) - createdMs(b);
  if (!a.deadline) return 1;
  if (!b.deadline) return -1;
  if (a.deadline === b.deadline) return createdMs(a) - createdMs(b);
  return a.deadline < b.deadline ? -dir : dir;
};

const sortKey = (userName) => `kanban-sort:${userName || 'anon'}`;
const readSort = (userName) => {
  try {
    const v = window.localStorage.getItem(sortKey(userName));
    return SORT_OPTIONS.some(o => o.id === v) ? v : 'manual';
  } catch { return 'manual'; }
};

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
  // Onde o card vai cair dentro da coluna: { col, index }.
  const [dropSlot, setDropSlot] = useState(null);
  const [clientFilter, setClientFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [scope, setScope] = useState('mine');
  const [sortMode, setSortMode] = useState(() => readSort(currentUser));
  const dragTask = useRef(null);

  // Preferência de ordenação por pessoa, lembrada neste navegador.
  useEffect(() => {
    try { window.localStorage.setItem(sortKey(currentUser), sortMode); } catch { /* sem storage, segue na memória */ }
  }, [sortMode, currentUser]);

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

  // Concluídas: só as do mês corrente. O histórico inteiro continua no
  // Firestore e nos Relatórios; aqui ele só empurrava a coluna para
  // baixo e engordava o board sem servir para o trabalho do dia.
  const inicioMes = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }, []);
  const doneNoMes = (t) => {
    if (t.status !== 'done') return true;
    const c = t.completedAt?.toDate ? t.completedAt.toDate() : t.completedAt ? new Date(t.completedAt) : null;
    return !!c && c >= inicioMes;
  };
  // Ordena uma lista de tasks conforme o modo escolhido.
  const sortTasks = (list) => {
    const arr = [...list];
    if (sortMode === 'deadline_asc')  return arr.sort(byDeadline(1));
    if (sortMode === 'deadline_desc') return arr.sort(byDeadline(-1));
    if (sortMode === 'created_desc')  return arr.sort((a, b) => createdMs(b) - createdMs(a));
    if (sortMode === 'created_asc')   return arr.sort((a, b) => createdMs(a) - createdMs(b));
    if (sortMode === 'priority') {
      return arr.sort((a, b) => ((PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0)) || byDeadline(1)(a, b));
    }
    // Minha ordem: sem posição definida primeiro (pelo prazo), depois
    // as que a pessoa já organizou.
    const pos = (t) => t.sortOrder?.[currentUser];
    const temPos = (t) => typeof pos(t) === 'number';
    return arr.sort((a, b) => {
      const pa = temPos(a), pb = temPos(b);
      if (pa !== pb) return pa ? 1 : -1;
      if (!pa) return byDeadline(1)(a, b);
      return pos(a) - pos(b);
    });
  };

  const tasksByColumn = (colId) => sortTasks(visibleTasks.filter(t => t.status === colId && doneNoMes(t)));
  const doneOcultas = visibleTasks.filter(t => t.status === 'done' && !doneNoMes(t)).length;

  // ── Drag handlers ─────────────────────────────────────────────
  // Dois gestos no mesmo arraste:
  //  · soltar em OUTRA coluna → muda o status (regras de sempre);
  //  · soltar na MESMA coluna → reordena (ordem pessoal, vale para
  //    qualquer um, inclusive no modo acompanhamento da CS).
  const limparArraste = () => {
    setDraggingId(null);
    setDragOverCol(null);
    setDropSlot(null);
    dragTask.current = null;
  };

  const handleDragStart = (e, task) => {
    dragTask.current = task;
    e.dataTransfer.effectAllowed = 'move';
    // Sem dado no dataTransfer o Firefox nem começa o arraste.
    try { e.dataTransfer.setData('text/plain', task.id); } catch { /* ok */ }
    // Adia o estado para o navegador capturar a "foto" do card antes
    // de ele ficar transparente.
    setTimeout(() => setDraggingId(task.id), 0);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) setDragOverCol(colId);

    // Posição de inserção pela altura do mouse em relação ao meio de
    // cada card da coluna.
    const cards = e.currentTarget.querySelectorAll('[data-kanban-card]');
    let index = cards.length;
    for (let i = 0; i < cards.length; i += 1) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { index = i; break; }
    }
    if (!dropSlot || dropSlot.col !== colId || dropSlot.index !== index) setDropSlot({ col: colId, index });
  };

  // dragleave dispara ao passar por cima de cada filho da coluna. Só
  // limpa quando o mouse sai de verdade — era isso que fazia o destaque
  // piscar e o card "não pegar" na coluna do lado.
  const handleDragLeave = (e, colId) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverCol === colId) setDragOverCol(null);
    if (dropSlot?.col === colId) setDropSlot(null);
  };

  const reorder = async (task, colId, index) => {
    const visiveis = tasksByColumn(colId);
    const de = visiveis.findIndex(t => t.id === task.id);
    if (de < 0) return;
    let para = index;
    if (de < para) para -= 1;
    if (para === de) return;

    const semEle = visiveis.filter(t => t.id !== task.id);
    const vizinho = semEle[para] || null;   // card que vai ficar logo abaixo

    // A ordem é gravada sobre a coluna INTEIRA (sem filtro de tela),
    // para um filtro ativo não embaralhar as tasks escondidas.
    const coluna = sortTasks(baseTasks.filter(t => t.status === colId)).map(t => t.id).filter(id => id !== task.id);
    let alvo;
    if (vizinho) alvo = coluna.indexOf(vizinho.id);
    else {
      const ultimo = semEle[semEle.length - 1];
      alvo = ultimo ? coluna.indexOf(ultimo.id) + 1 : coluna.length;
    }
    if (alvo < 0) alvo = coluna.length;
    coluna.splice(alvo, 0, task.id);

    if (sortMode !== 'manual') setSortMode('manual');
    await saveTaskOrder(currentUser, coluna, tasks);
  };

  const handleDrop = async (e, targetColId) => {
    e.preventDefault();
    const task = dragTask.current;
    const slot = dropSlot;
    limparArraste();

    if (!task) return;

    if (task.status === targetColId) {
      if (slot && slot.col === targetColId) await reorder(task, targetColId, slot.index);
      return;
    }

    if (readOnly) return;

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

  // Linha de inserção: só no reordenar (mesma coluna) e só quando a
  // posição muda de fato.
  const draggingTask = draggingId ? tasks.find(t => t.id === draggingId) : null;
  const mostraLinha = (colId, colTasks, index) => {
    if (!draggingTask || draggingTask.status !== colId) return false;
    if (!dropSlot || dropSlot.col !== colId || dropSlot.index !== index) return false;
    const de = colTasks.findIndex(t => t.id === draggingTask.id);
    return index !== de && index !== de + 1;
  };

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em', marginBottom: 4 }}>
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
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--grad)', border: 'none', borderRadius: 10, padding: '10px 18px', color: 'var(--on)', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(238,51,99,.35)', cursor: 'pointer' }}
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
                background: scope === o.id ? 'var(--grad)' : 'var(--bg3)',
                color: scope === o.id ? 'var(--on)' : 'var(--muted)',
                border: `1px solid ${scope === o.id ? 'transparent' : 'var(--border-h)'}`,
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

        <select
          value={sortMode}
          onChange={e => setSortMode(e.target.value)}
          title="Ordem dos cards em cada coluna. Arraste um card dentro da coluna para montar a sua ordem."
          style={{ ...S.filter, minWidth: 190 }}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.id} value={o.id}>Ordenar: {o.label}</option>
          ))}
        </select>

        {filtroAtivo && (
          <button onClick={limparFiltros} style={S.clearBtn}>
            <X size={13} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Kanban columns */}
      {/* stretch: a coluna inteira vira área de soltar, e não só a
          altura dos cards que ela tem. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, alignItems: 'stretch' }}>
        {TASK_COLUMNS.map(col => {
          const colTasks     = tasksByColumn(col.id);
          const reworkCount  = colTasks.filter(t => t.isRework).length;
          const isDragTarget = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              style={{
                background: isDragTarget ? `color-mix(in srgb, ${col.color} 3%, transparent)` : 'var(--bg2)',
                border: `1px solid ${isDragTarget ? `color-mix(in srgb, ${col.color} 25%, transparent)` : `color-mix(in srgb, ${col.color} 9%, transparent)`}`,
                borderRadius: 12, padding: '12px 10px', minHeight: 200,
                transition: 'all .15s ease',
              }}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={e => handleDragLeave(e, col.id)}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: col.color, fontFamily: 'var(--fm)' }}>
                  {col.label}
                  {col.id === 'done' && <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6, fontSize: 10.5 }}>este mês</span>}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {col.id === 'done' && doneOcultas > 0 && (
                    <span title={`${doneOcultas} concluídas em meses anteriores — veja nos Relatórios ou no Extrato`} style={{ fontSize: 9.5, color: 'var(--dim)', fontFamily: 'var(--fm)' }}>
                      +{doneOcultas} antes
                    </span>
                  )}
                  {reworkCount > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid var(--amber-b)', fontFamily: 'var(--fm)' }}>
                      🔄 {reworkCount}
                    </span>
                  )}
                  <span style={{ background: `color-mix(in srgb, ${col.color} 13%, transparent)`, borderRadius: 10, padding: '1px 8px', fontSize: 11, color: col.color, fontFamily: 'var(--fm)' }}>
                    {colTasks.length}
                  </span>
                </div>
              </div>

              {/* Tasks. O destaque de "soltar aqui" é a borda da coluna —
                  nada é inserido no meio da lista, então os cards não
                  pulam de lugar enquanto se arrasta. */}
              {colTasks.length === 0 ? (
                <p style={{ fontSize: 12, color: isDragTarget ? col.color : 'var(--muted)', textAlign: 'center', padding: '24px 0', opacity: isDragTarget ? .9 : .5, fontFamily: isDragTarget ? 'var(--fm)' : undefined }}>
                  {isDragTarget && draggingId ? 'Soltar aqui' : filtroAtivo ? 'Nada com esse filtro' : 'Vazio'}
                </p>
              ) : (
                <>
                  {colTasks.map((task, i) => (
                    <div
                      key={task.id}
                      data-kanban-card
                      draggable
                      onDragStart={e => handleDragStart(e, task)}
                      onDragEnd={limparArraste}
                      style={{ position: 'relative', opacity: draggingId === task.id ? 0.35 : 1, cursor: 'grab', transition: 'opacity .15s' }}
                    >
                      {mostraLinha(col.id, colTasks, i) && <DropLine color={col.color} />}
                      <TaskCard task={task} onClick={() => setSelectedTaskId(task.id)} />
                    </div>
                  ))}
                  <div style={{ position: 'relative', height: 0 }}>
                    {mostraLinha(col.id, colTasks, colTasks.length) && <DropLine color={col.color} />}
                  </div>
                </>
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

function DropLine({ color }) {
  return (
    <div style={{
      position: 'absolute', left: 2, right: 2, top: -6, height: 3, borderRadius: 3,
      background: color, boxShadow: `0 0 10px ${color}`, pointerEvents: 'none', zIndex: 2,
    }} />
  );
}

const S = {
  filter: {
    background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9,
    padding: '9px 13px', color: 'var(--text)', fontSize: 13, outline: 'none',
    cursor: 'pointer', fontFamily: 'var(--f)', minWidth: 180,
  },
  // Filtro com valor: borda na cor do painel, fundo tingido, texto forte.
  filterActive: {
    borderColor: 'var(--c)', background: 'var(--c-dim)', color: 'var(--text)', fontWeight: 600,
  },
  clearBtn: {
    display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
    border: '1px solid var(--border)', borderRadius: 9, padding: '9px 13px',
    color: 'var(--muted)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'var(--f)',
  },
};
