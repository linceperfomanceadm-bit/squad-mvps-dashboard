import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { X, RotateCcw } from 'lucide-react';
import { SECTORS } from '../../lib/firebase';
import { resolveHealth, HEALTH_LEVELS, HEALTH_ORDER } from '../../hooks/useClientHealth';

const COLOR = SECTORS.cs.color;

/*
 * Aba "Saúde" do CS. Lista todos os clientes ativos com um farol
 * verde/amarelo/vermelho (misto: automático por tasks + override manual).
 */
export default function CSHealth({ clients, tasks, onUpdateClient, toast }) {
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState('all');

  const activeClients = useMemo(() => clients.filter(c => c.active), [clients]);

  const withHealth = useMemo(() => {
    return activeClients
      .map(c => ({ client: c, health: resolveHealth(c, tasks) }))
      .sort((a, b) => HEALTH_ORDER[a.health.level] - HEALTH_ORDER[b.health.level]);
  }, [activeClients, tasks]);

  const counts = useMemo(() => {
    const c = { red: 0, yellow: 0, green: 0 };
    withHealth.forEach(w => { c[w.health.level]++; });
    return c;
  }, [withHealth]);

  const visible = filter === 'all' ? withHealth : withHealth.filter(w => w.health.level === filter);
  const openClient = activeClients.find(c => c.id === openId) || null;
  const openHealth = openClient ? resolveHealth(openClient, tasks) : null;

  const setRisk = async (clientId, level, note) => {
    const patch = level
      ? { healthOverride: { level, note: note || '', at: new Date().toISOString() } }
      : { healthOverride: null };
    const r = await onUpdateClient(clientId, patch);
    if (r?.success !== false) toast(level ? 'Risco atualizado.' : 'Voltou para o automático.');
    else toast('Falha ao atualizar.', 'e');
  };

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${COLOR}1a`, color: COLOR, border: `1px solid ${COLOR}40`, fontFamily: 'var(--fm)' }}>🎧 CUSTOMER SUCCESS</span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 10, marginBottom: 4 }}>Saúde dos Clientes</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Farol automático por tarefas, ajustável pelo CS · {activeClients.length} clientes ativos</p>
      </div>

      {/* Resumo / filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')} label={`Todos (${withHealth.length})`} />
        <Chip active={filter === 'red'} onClick={() => setFilter('red')} label={`🔴 Risco (${counts.red})`} color={HEALTH_LEVELS.red.color} />
        <Chip active={filter === 'yellow'} onClick={() => setFilter('yellow')} label={`🟡 Atenção (${counts.yellow})`} color={HEALTH_LEVELS.yellow.color} />
        <Chip active={filter === 'green'} onClick={() => setFilter('green')} label={`🟢 Saudável (${counts.green})`} color={HEALTH_LEVELS.green.color} />
      </div>

      {visible.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>Nenhum cliente nesse filtro.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {visible.map(({ client, health }) => (
            <HealthCard key={client.id} client={client} health={health} onClick={() => setOpenId(client.id)} />
          ))}
        </div>
      )}

      {openClient && ReactDOM.createPortal(
        <HealthDrawer
          client={openClient}
          health={openHealth}
          tasks={tasks}
          onClose={() => setOpenId(null)}
          onSetRisk={(level, note) => setRisk(openClient.id, level, note)}
        />, document.body)}
    </div>
  );
}

function HealthCard({ client, health, onClick }) {
  const lvl = HEALTH_LEVELS[health.level];
  return (
    <button onClick={onClick} style={{ textAlign: 'left', cursor: 'pointer', background: 'rgba(12,12,24,.88)', border: `1px solid ${lvl.color}30`, borderRadius: 14, padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: lvl.color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{client.name}</span>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{lvl.emoji}</span>
      </div>
      <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: `${lvl.color}1a`, color: lvl.color, fontFamily: 'var(--fm)', marginTop: 8 }}>
        {lvl.label}{health.overridden ? ' · manual' : ''}
      </span>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>
        <span>{health.stats.active} ativas</span>
        {health.stats.overdue > 0 && <span style={{ color: HEALTH_LEVELS.red.color }}>{health.stats.overdue} atrasadas</span>}
        {health.stats.reworks > 0 && <span style={{ color: HEALTH_LEVELS.yellow.color }}>{health.stats.reworks} refação</span>}
      </div>
    </button>
  );
}

function HealthDrawer({ client, health, tasks, onClose, onSetRisk }) {
  const [note, setNote] = useState(client.healthOverride?.note || '');
  const lvl = HEALTH_LEVELS[health.level];
  const clientTasks = tasks.filter(t => t.clientId === client.id && t.status !== 'done');

  // setores que atendem o cliente
  const sectors = Object.entries(client.responsibles || {}).filter(([, v]) => v);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ width: 'min(480px,100%)', height: '100%', background: 'rgba(14,14,28,.99)', borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{client.name}</h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: `${lvl.color}1a`, color: lvl.color, fontFamily: 'var(--fm)', marginTop: 6 }}>
              {lvl.emoji} {lvl.label}{health.overridden ? ' (manual)' : ' (automático)'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer', display: 'flex' }}><X size={15} color="var(--muted)" /></button>
        </div>

        {/* Por que está nesse nível */}
        <Section title="Diagnóstico automático">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {health.reasons.map((r, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: lvl.color }} /> {r}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <Stat label="Ativas" value={health.stats.active} />
            <Stat label="Atrasadas" value={health.stats.overdue} color={health.stats.overdue ? HEALTH_LEVELS.red.color : undefined} />
            <Stat label="Refações" value={health.stats.reworks} color={health.stats.reworks ? HEALTH_LEVELS.yellow.color : undefined} />
          </div>
        </Section>

        {/* Setores responsáveis */}
        {sectors.length > 0 && (
          <Section title="Equipe">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {sectors.map(([sec, name]) => {
                const s = SECTORS[sec];
                return (
                  <span key={sec} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    {s ? `${s.emoji} ${name}` : name}
                  </span>
                );
              })}
            </div>
          </Section>
        )}

        {/* Tasks ativas */}
        {clientTasks.length > 0 && (
          <Section title={`Tarefas ativas (${clientTasks.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {clientTasks.slice(0, 8).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)' }}>
                  {t.isRework && <span style={{ fontSize: 9, color: HEALTH_LEVELS.yellow.color, fontFamily: 'var(--fm)', fontWeight: 700 }}>🔄</span>}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{t.responsibleName}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Ajuste manual */}
        <Section title="Ajuste manual do CS">
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
            Sobreponha o farol com sua percepção de risco. Isso prevalece sobre o automático.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {Object.entries(HEALTH_LEVELS).map(([key, v]) => (
              <button key={key} onClick={() => onSetRisk(key, note)} style={{
                flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: health.override?.level === key ? `${v.color}1f` : 'var(--surface)',
                color: health.override?.level === key ? v.color : 'var(--text)',
                border: `1px solid ${health.override?.level === key ? `${v.color}60` : 'var(--border)'}`,
              }}>{v.emoji} {v.label}</button>
            ))}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Anotação sobre o risco (opcional)..." style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)', resize: 'vertical', marginBottom: 10 }} />
          {health.overridden && (
            <button onClick={() => onSetRisk(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 14px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>
              <RotateCcw size={13} /> Voltar ao automático
            </button>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: COLOR, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>{title}</h3>
      <div style={{ background: 'rgba(12,12,24,.6)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>{children}</div>
    </div>
  );
}
function Stat({ label, value, color }) {
  return (
    <div>
      <p style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text)' }}>{value}</p>
      <p style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', letterSpacing: '.08em' }}>{label.toUpperCase()}</p>
    </div>
  );
}
function Chip({ active, onClick, label, color }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
      background: active ? (color ? `${color}1a` : 'var(--neon-dim)') : 'var(--surface)',
      color: active ? (color || 'var(--neon)') : 'var(--muted)',
      border: `1px solid ${active ? (color ? `${color}40` : 'var(--neon-border)') : 'var(--border)'}`,
      fontFamily: 'var(--fm)',
    }}>{label}</button>
  );
}
