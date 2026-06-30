import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Plus, X, Check, Trash2, ListChecks, StickyNote, Calendar as CalIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePersonalTasks } from '../../hooks/usePersonalTasks';

/*
 * "Meu Dia" — to-do pessoal estilo Trello.
 * - Criação rápida (título + Enter) ou card completo.
 * - Cada card abre um detalhe com: nota mental, checklist e data.
 * - Concluir exige confirmação (2 passos) para evitar engano.
 * - Isolado por usuário; não afeta KPIs nem dashboards gerenciais.
 *
 * accent: cor do setor onde o componente é embutido.
 */
export default function TodoView({ accent = 'var(--neon)' }) {
  const { user } = useAuth();
  const { tasks, loading, addTask, updateTask, completeTask, removeTask } = usePersonalTasks(user?.authUid);

  const [openId, setOpenId] = useState(null);
  const [exiting, setExiting] = useState({});
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  // Cria a atividade conforme o tipo escolhido e já abre para detalhar.
  const createActivity = async (type) => {
    setShowTypeMenu(false);
    const defaults = {
      note:     { title: 'Nova anotação', type: 'note' },
      card:     { title: 'Novo card', type: 'card', checklist: [] },
      reminder: { title: 'Novo lembrete', type: 'reminder' },
    };
    const r = await addTask(defaults[type] || defaults.note);
    // abre o recém-criado para edição (se o hook retornar o id)
    if (r?.id) setOpenId(r.id);
  };

  const onComplete = (id) => {
    setExiting(e => ({ ...e, [id]: true }));
    setTimeout(async () => {
      await completeTask(id);
      await removeTask(id);
      setOpenId(null);
    }, 340);
  };

  const groups = useMemo(() => {
    const open = tasks.filter(t => t.status === 'open');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
    const overdue = [], todayList = [], upcoming = [], noDate = [];
    open.forEach(t => {
      if (!t.dueDate) { noDate.push(t); return; }
      const d = new Date(t.dueDate);
      if (d < today) overdue.push(t);
      else if (d <= endToday) todayList.push(t);
      else upcoming.push(t);
    });
    const byDate = (a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
    return {
      overdue: overdue.sort(byDate),
      today: todayList.sort(byDate),
      upcoming: upcoming.sort(byDate),
      noDate,
    };
  }, [tasks]);

  const openTask = tasks.find(t => t.id === openId) || null;
  const total = groups.overdue.length + groups.today.length + groups.upcoming.length + groups.noDate.length;

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Meu Dia</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Suas tarefas pessoais — visíveis só para você.</p>
      </div>

      {/* Criar Atividade — botão único com escolha de tipo */}
      <div style={{ marginBottom: 24, position: 'relative', display: 'inline-block' }}>
        <button onClick={() => setShowTypeMenu(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: `linear-gradient(135deg,${accent},${accent}cc)`, border: 'none', borderRadius: 10, padding: '12px 20px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={17} /> Criar Atividade
        </button>
        {showTypeMenu && (
          <>
            <div onClick={() => setShowTypeMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: 'rgba(20,20,34,.99)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, minWidth: 230, boxShadow: '0 16px 48px rgba(0,0,0,.6)' }}>
              {[
                { type: 'note', icon: StickyNote, label: 'Anotação', desc: 'Um texto rápido' },
                { type: 'card', icon: ListChecks, label: 'Card', desc: 'Com checklist, tipo Trello' },
                { type: 'reminder', icon: CalIcon, label: 'Lembrete', desc: 'Com data/prazo' },
              ].map(opt => {
                const Icon = opt.icon;
                return (
                  <button key={opt.type} onClick={() => createActivity(opt.type)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, background: 'none', border: 'none', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, background: `${accent}1a`, border: `1px solid ${accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={accent} />
                    </span>
                    <span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{opt.label}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{opt.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 30, height: 30 }} /></div>
      ) : total === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '48px 0' }}>Nenhuma tarefa por aqui. Adicione a primeira acima. ✨</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16, alignItems: 'start' }}>
          <Column title="Atrasadas" accent="var(--neon)" items={groups.overdue} exiting={exiting} onOpen={setOpenId} onComplete={onComplete} />
          <Column title="Hoje" accent={accent} items={groups.today} exiting={exiting} onOpen={setOpenId} onComplete={onComplete} />
          <Column title="Próximas" accent="#38bdf8" items={groups.upcoming} exiting={exiting} onOpen={setOpenId} onComplete={onComplete} />
          <Column title="Sem Data" accent="var(--muted)" items={groups.noDate} exiting={exiting} onOpen={setOpenId} onComplete={onComplete} />
        </div>
      )}

      {openTask && ReactDOM.createPortal(
        <TaskDetail
          task={openTask}
          accent={accent}
          onClose={() => setOpenId(null)}
          onUpdate={(patch) => updateTask(openTask.id, patch)}
          onComplete={() => onComplete(openTask.id)}
          onDelete={async () => { await removeTask(openTask.id); setOpenId(null); }}
        />, document.body)}
    </div>
  );
}

function Column({ title, accent, items, exiting, onOpen, onComplete }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: '.06em', fontFamily: 'var(--fm)', textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{items.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 8 }}>
        {items.length === 0 ? (
          <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: '14px', textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>—</div>
        ) : items.map(t => (
          <TaskCard key={t.id} task={t} exiting={exiting[t.id]} onOpen={() => onOpen(t.id)} onComplete={() => onComplete(t.id)} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, exiting, onOpen, onComplete }) {
  const checklist = task.checklist || [];
  const doneCount = checklist.filter(i => i.done).length;
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={{
      background: 'rgba(12,12,24,.92)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px',
      cursor: 'pointer', transition: 'opacity .3s ease, transform .3s ease',
      opacity: exiting ? 0 : 1, transform: exiting ? 'translateX(24px)' : 'translateX(0)',
    }}>
      <div onClick={onOpen}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: (task.note || checklist.length) ? 6 : 0 }}>{task.title}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {task.note && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}><StickyNote size={11} /> nota</span>}
          {checklist.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: doneCount === checklist.length ? 'var(--green)' : 'var(--muted)', fontFamily: 'var(--fm)' }}>
              <ListChecks size={11} /> {doneCount}/{checklist.length}
            </span>
          )}
          {task.dueDate && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>
              <CalIcon size={11} /> {new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
          )}
        </div>
      </div>
      {/* Conclusão com confirmação (2 passos) */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        {confirming ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onComplete} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: 8, padding: '7px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Check size={13} /> Confirmar
            </button>
            <button onClick={() => setConfirming(false)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Check size={13} /> Concluir
          </button>
        )}
      </div>
    </div>
  );
}

// ── Detalhe do card (drawer) ───────────────────────────────────
function TaskDetail({ task, accent, onClose, onUpdate, onComplete, onDelete }) {
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note || '');
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : '');
  const [checklist, setChecklist] = useState(task.checklist || []);
  const [newItem, setNewItem] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Persiste mudanças (debounce simples ao sair de cada campo).
  const persist = (patch) => onUpdate(patch);

  const addItem = () => {
    if (!newItem.trim()) return;
    const next = [...checklist, { id: `c_${Date.now()}`, text: newItem.trim(), done: false }];
    setChecklist(next); setNewItem(''); persist({ checklist: next });
  };
  const toggleItem = (id) => {
    const next = checklist.map(i => i.id === id ? { ...i, done: !i.done } : i);
    setChecklist(next); persist({ checklist: next });
  };
  const removeItem = (id) => {
    const next = checklist.filter(i => i.id !== id);
    setChecklist(next); persist({ checklist: next });
  };

  const doneCount = checklist.filter(i => i.done).length;
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ width: 'min(460px,100%)', height: '100%', background: 'rgba(14,14,28,.99)', borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer', display: 'flex' }}><X size={15} color="var(--muted)" /></button>
        </div>

        {/* Título */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => title.trim() && persist({ title: title.trim() })}
          placeholder="Título da tarefa"
          style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', color: '#fff', fontSize: 18, fontWeight: 700, outline: 'none', padding: '4px 0 8px', marginBottom: 20, fontFamily: 'var(--f)' }}
        />

        {/* Data */}
        <label style={LBL}><CalIcon size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />DATA</label>
        <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); persist({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null }); }} style={{ ...INP, marginTop: 6, marginBottom: 18, cursor: 'pointer', colorScheme: 'dark' }} />

        {/* Nota mental */}
        <label style={LBL}><StickyNote size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />NOTA MENTAL</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={() => persist({ note: note.trim() })}
          rows={4}
          placeholder="Anotações, contexto, lembretes sobre essa tarefa..."
          style={{ ...INP, marginTop: 6, marginBottom: 18, resize: 'vertical', fontFamily: 'var(--f)', lineHeight: 1.5 }}
        />

        {/* Checklist */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={LBL}><ListChecks size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />CHECKLIST</label>
          {checklist.length > 0 && <span style={{ fontSize: 11, color: pct === 100 ? 'var(--green)' : 'var(--muted)', fontFamily: 'var(--fm)' }}>{doneCount}/{checklist.length}</span>}
        </div>
        {checklist.length > 0 && (
          <div style={{ height: 6, borderRadius: 4, background: 'var(--surface)', overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--green)' : accent, transition: 'width .3s' }} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {checklist.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(12,12,24,.6)' }}>
              <button onClick={() => toggleItem(item.id)} style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer', border: `2px solid ${item.done ? 'var(--green)' : 'var(--border)'}`, background: item.done ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.done && <Check size={11} color="#07070e" />}
              </button>
              <span style={{ flex: 1, fontSize: 13, color: item.done ? 'var(--muted)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
              <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2 }}><X size={13} color="var(--muted)" /></button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addItem(); }} placeholder="Adicionar item..." style={{ ...INP, fontSize: 13, padding: '8px 10px' }} />
          <button onClick={addItem} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Plus size={15} /></button>
        </div>

        {/* Ações */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {confirming ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onComplete} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: 10, padding: '11px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Check size={15} /> Confirmar conclusão
              </button>
              <button onClick={() => setConfirming(false)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: `linear-gradient(135deg,${accent},${accent}cc)`, border: 'none', borderRadius: 10, padding: '12px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              <Check size={16} /> Concluir tarefa
            </button>
          )}
          <button onClick={onDelete} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '9px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>
            <Trash2 size={13} /> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

const LBL = { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' };
const INP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' };
