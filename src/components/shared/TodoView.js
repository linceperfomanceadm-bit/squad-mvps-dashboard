import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePersonalTasks } from '../../hooks/usePersonalTasks';

/*
 * "Meu Dia" — to-do pessoal. Fricção zero: input com Enter cria a task.
 * Três blocos: Atrasadas, Hoje, Sem Data. Ao concluir, a task ganha
 * strike-through + fade e some do DOM com transição suave.
 *
 * accent: cor do setor para harmonizar com o painel onde é embutido.
 */
export default function TodoView({ accent = 'var(--neon)' }) {
  const { user } = useAuth();
  const { tasks, loading, addTask, completeTask, removeTask } = usePersonalTasks(user?.authUid);

  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [exiting, setExiting] = useState({}); // id -> true (animação de saída)

  const submit = async () => {
    if (!title.trim()) return;
    await addTask(title, due ? new Date(due).toISOString() : null);
    setTitle(''); setDue('');
  };

  const onComplete = (id) => {
    setExiting(e => ({ ...e, [id]: true }));
    // espera a transição antes de gravar/remover
    setTimeout(async () => {
      await completeTask(id);
      await removeTask(id); // concluída sai da lista pessoal
    }, 320);
  };

  const groups = useMemo(() => {
    const open = tasks.filter(t => t.status === 'open');
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
    const overdue = [], today = [], noDate = [];
    open.forEach(t => {
      if (!t.dueDate) { noDate.push(t); return; }
      const d = new Date(t.dueDate);
      if (d < now) overdue.push(t);
      else if (d <= endToday) today.push(t);
      else today.push(t); // futuras entram em "Hoje/Próximas" para simplicidade
    });
    const byDate = (a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
    return { overdue: overdue.sort(byDate), today: today.sort(byDate), noDate };
  }, [tasks]);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Meu Dia</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Suas tarefas pessoais — visíveis só para você.</p>
      </div>

      {/* Input fricção zero */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="Adicionar tarefa e pressionar Enter..."
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'var(--f)' }}
        />
        <input type="date" value={due} onChange={e => setDue(e.target.value)} title="Data (opcional)" style={{ background: '#12121f', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)', cursor: 'pointer' }} />
        <button onClick={submit} style={{ display: 'flex', alignItems: 'center', gap: 6, background: `linear-gradient(135deg,${accent},${accent}cc)`, border: 'none', borderRadius: 10, padding: '0 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={16} />
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 30, height: 30 }} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Block title="Atrasadas" items={groups.overdue} accent="var(--neon)" exiting={exiting} onComplete={onComplete} showDate />
          <Block title="Hoje / Próximas" items={groups.today} accent={accent} exiting={exiting} onComplete={onComplete} showDate />
          <Block title="Sem Data" items={groups.noDate} accent="var(--muted)" exiting={exiting} onComplete={onComplete} />
          {groups.overdue.length + groups.today.length + groups.noDate.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>Tudo limpo por aqui. ✨</p>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ title, items, accent, exiting, onComplete, showDate }) {
  if (!items.length) return null;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: '.06em', fontFamily: 'var(--fm)', textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{items.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(t => {
          const isExiting = exiting[t.id];
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px',
              opacity: isExiting ? 0 : 1,
              transform: isExiting ? 'translateX(24px)' : 'translateX(0)',
              transition: 'opacity .3s ease, transform .3s ease',
            }}>
              <button onClick={() => onComplete(t.id)} style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                border: `2px solid ${isExiting ? 'var(--green)' : 'var(--border)'}`,
                background: isExiting ? 'var(--green)' : 'transparent', transition: 'all .2s',
              }} />
              <span style={{
                flex: 1, fontSize: 14, color: 'var(--text)',
                textDecoration: isExiting ? 'line-through' : 'none',
                opacity: isExiting ? 0.5 : 1, transition: 'all .2s',
              }}>{t.title}</span>
              {showDate && t.dueDate && (
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)', flexShrink: 0 }}>
                  {new Date(t.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
