import React, { useMemo, useState } from 'react';
import { Plus, Check, Trash2, Clock, StickyNote, ListTodo, Bell, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDayTasks, DAY_TYPES, todayKey } from '../../hooks/useDayTasks';

// ─── Tarefas do Dia ───────────────────────────────────────────
// Lista pessoal, visível só para quem está logado. Um único botão
// cria os três tipos (anotação, tarefa, lembrete) — o tipo é escolhido
// no próprio formulário, como era no "Meu Dia".

const ICON = { nota: StickyNote, card: ListTodo, lembrete: Bell };

const fmtDia = (key) => {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
};

export default function DayTasks({ toast }) {
  const { user } = useAuth();
  const ownerId = user?.loginId || user?.id || null;
  const { items, loading, addItem, toggleItem, removeItem, pullOverdue } = useDayTasks(ownerId);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState('card');
  const [text, setText] = useState('');
  const [time, setTime] = useState('');
  const [verTudo, setVerTudo] = useState(false);

  const hoje = todayKey();
  const doHoje = useMemo(() => items.filter(i => i.at === hoje), [items, hoje]);
  const atrasados = useMemo(() => items.filter(i => !i.done && i.at && i.at < hoje), [items, hoje]);
  const futuros = useMemo(() => items.filter(i => i.at && i.at > hoje), [items, hoje]);
  const abertos = doHoje.filter(i => !i.done && i.type !== 'nota');
  const feitos = doHoje.filter(i => i.done);

  const salvar = async () => {
    const r = await addItem({ type, text, at: hoje, time: type === 'lembrete' ? time : '' });
    if (!r.success) { toast?.(r.error, 'e'); return; }
    setText(''); setTime(''); setOpen(false);
  };

  const puxar = async () => {
    const n = await pullOverdue();
    toast?.(n ? `${n} item${n > 1 ? 's' : ''} trazido${n > 1 ? 's' : ''} para hoje.` : 'Nada atrasado por aqui.');
  };

  const lista = verTudo ? [...doHoje, ...futuros] : doHoje;

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em' }}>Tarefas do Dia</h1>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
            Sua lista pessoal — ninguém mais vê o que está aqui.
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {atrasados.length > 0 && (
            <button className="ui-btn" onClick={puxar}>
              <Clock size={14} /> Trazer {atrasados.length} atrasado{atrasados.length > 1 ? 's' : ''}
            </button>
          )}
          <button className="ui-btn primary" onClick={() => setOpen(o => !o)}>
            <Plus size={14} /> Nova atividade
          </button>
        </div>
      </div>

      {open && (
        <div className="ui-card fade-up" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {Object.values(DAY_TYPES).map(t => {
              const Icone = ICON[t.id];
              const on = type === t.id;
              return (
                <button key={t.id} onClick={() => setType(t.id)} className={`ui-btn small${on ? ' on' : ''}`}
                  style={on ? { color: t.color, borderColor: t.color } : undefined}>
                  <Icone size={13} /> {t.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setOpen(false); }}
              placeholder={type === 'nota' ? 'O que você quer anotar?' : type === 'lembrete' ? 'Do que precisa lembrar?' : 'O que precisa ser feito?'}
              style={{ flex: 1, minWidth: 220, height: 38, borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border-h)', padding: '0 12px', color: 'var(--text)', outline: 'none', fontSize: 13.5 }}
            />
            {type === 'lembrete' && (
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                style={{ height: 38, borderRadius: 10, background: 'var(--bg3)', border: '1px solid var(--border-h)', padding: '0 12px', color: 'var(--text)', outline: 'none', fontSize: 13.5, fontFamily: 'var(--fm)' }} />
            )}
            <button className="ui-btn primary" onClick={salvar}>Adicionar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Carregando…</p>
      ) : lista.length === 0 ? (
        <div className="ui-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Dia limpo.</p>
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Use "Nova atividade" para anotar algo, criar uma tarefa ou marcar um lembrete.</p>
        </div>
      ) : (
        <>
          {abertos.length > 0 && (
            <Grupo titulo="Para hoje" itens={abertos} onToggle={toggleItem} onRemove={removeItem} />
          )}
          {doHoje.some(i => i.type === 'nota' && !i.done) && (
            <Grupo titulo="Anotações" itens={doHoje.filter(i => i.type === 'nota' && !i.done)} onToggle={toggleItem} onRemove={removeItem} />
          )}
          {feitos.length > 0 && (
            <Grupo titulo={`Concluídas (${feitos.length})`} itens={feitos} onToggle={toggleItem} onRemove={removeItem} />
          )}
          {verTudo && futuros.length > 0 && (
            <Grupo titulo="Próximos dias" itens={futuros} onToggle={toggleItem} onRemove={removeItem} mostrarData />
          )}
          {futuros.length > 0 && (
            <button className="ui-btn small" onClick={() => setVerTudo(v => !v)} style={{ marginTop: 4 }}>
              <ChevronDown size={13} style={{ transform: verTudo ? 'rotate(180deg)' : 'none' }} />
              {verTudo ? 'Ocultar próximos dias' : `Ver próximos dias (${futuros.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Grupo({ titulo, itens, onToggle, onRemove, mostrarData }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 3, height: 14, background: 'var(--c)', borderRadius: 2 }} />
        <h2 style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>{titulo}</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {itens.map(i => <Item key={i.id} item={i} onToggle={onToggle} onRemove={onRemove} mostrarData={mostrarData} />)}
      </div>
    </div>
  );
}

function Item({ item, onToggle, onRemove, mostrarData }) {
  const t = DAY_TYPES[item.type] || DAY_TYPES.card;
  const Icone = ICON[item.type] || ListTodo;
  const nota = item.type === 'nota';
  return (
    <div className="ui-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
      {nota ? (
        <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color }}>
          <Icone size={15} />
        </span>
      ) : (
        <button
          onClick={() => onToggle(item.id, item.done)}
          aria-label={item.done ? 'Marcar como não feita' : 'Marcar como feita'}
          style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: item.done ? 'var(--c)' : 'transparent',
            border: `1px solid ${item.done ? 'var(--c)' : 'var(--border-s)'}`,
            color: 'var(--on)', cursor: 'pointer',
          }}
        >
          {item.done && <Check size={13} strokeWidth={3} />}
        </button>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, color: item.done ? 'var(--muted)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.45 }}>
          {item.text}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--fm)', letterSpacing: '.08em', color: t.color }}>{t.label.toUpperCase()}</span>
          {item.time && <span style={{ fontSize: 10.5, fontFamily: 'var(--fm)', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {item.time}</span>}
          {mostrarData && <span style={{ fontSize: 10.5, fontFamily: 'var(--fm)', color: 'var(--muted)' }}>{fmtDia(item.at)}</span>}
        </div>
      </div>

      <button onClick={() => onRemove(item.id)} aria-label="Excluir"
        style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex' }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}
