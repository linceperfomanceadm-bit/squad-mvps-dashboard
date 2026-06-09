import React, { useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import { SLA_DAYS, SM_COLUMNS, TASK_PRIORITIES, SECTORS } from '../../lib/firebase';

const DATE_FILTERS = [
  { key: 'today',     label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '7days',     label: 'Últimos 7 dias' },
  { key: 'month',     label: 'Este mês' },
];

function inRange(dateStr, filter) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  if (filter === 'today')     return differenceInDays(now, d) === 0;
  if (filter === 'yesterday') return differenceInDays(now, d) === 1;
  if (filter === '7days')     return differenceInDays(now, d) <= 7;
  if (filter === 'month')     return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  return true;
}

function SLABadge({ days }) {
  const ok = days <= SLA_DAYS;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, fontFamily: 'var(--fm)' }}>
      <span style={{ fontSize: 14 }}>{ok ? '🟢' : '🔴'}</span>{days}d
    </span>
  );
}

export default function AdminFeed({ clients, collaborators, tasks = [] }) {
  const [dateFilter, setDateFilter] = useState('today');
  const [collabFilter, setCollabFilter] = useState('');
  const [sectorTab, setSectorTab] = useState('tasks');

  // Filter tasks by date and collaborator
  // For collab filter: match deliveredBy (for done tasks) or responsibleName, or requestedBy
  const filteredTasks = tasks.filter(t => {
    const date = t.completedAt || t.createdAt;
    if (!inRange(date, dateFilter)) return false;
    if (collabFilter) {
      const delivered = t.deliveredBy || t.responsibleName;
      if (delivered !== collabFilter && t.requestedBy !== collabFilter) return false;
    }
    return true;
  });

  // SM posts
  const allPosts = [];
  clients.forEach(c => {
    (c.sm?.posts || []).forEach(p => {
      const date = p.updatedAt || p.createdAt;
      if (!inRange(date, dateFilter)) return;
      if (collabFilter && p.responsible !== collabFilter) return;
      allPosts.push({ ...p, clientName: c.name });
    });
  });

  const sectorTabs = [
    { key: 'tasks', label: '📋 Tasks',        count: filteredTasks.length },
    { key: 'sm',    label: '📱 Social Media',  count: allPosts.length },
  ];

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Extrato de Produção</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Atividades do time</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: 4 }}>
          {DATE_FILTERS.map(f => (
            <button key={f.key} onClick={() => setDateFilter(f.key)}
              style={{ background: dateFilter === f.key ? 'var(--neon-dim)' : 'transparent', border: 'none', borderRadius: 7, padding: '6px 14px', color: dateFilter === f.key ? 'var(--neon)' : 'var(--muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={collabFilter} onChange={e => setCollabFilter(e.target.value)}
          style={{ background: '#12121f', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: collabFilter ? 'var(--text)' : 'var(--muted)', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
          <option value="">Todos os colaboradores</option>
          {collaborators.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
        {sectorTabs.map(t => (
          <button key={t.key} onClick={() => setSectorTab(t.key)}
            style={{ background: sectorTab === t.key ? 'var(--neon-dim)' : 'transparent', border: 'none', borderRadius: 7, padding: '7px 16px', color: sectorTab === t.key ? 'var(--neon)' : 'var(--muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t.label}
            <span style={{ background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: '0 6px', fontSize: 10, fontFamily: 'var(--fm)' }}>{t.count}</span>
          </button>
        ))}
      </div>

      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {sectorTab === 'tasks' && (
          filteredTasks.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Nenhuma task no período.</p>
            : <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Entregou', 'Solicitante', 'Cliente', 'Task', 'Setor', 'Prioridade', 'Status', 'Tempo', 'Ajustes', 'Links'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, letterSpacing: '.1em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(t => {
                      const priority = TASK_PRIORITIES.find(p => p.id === t.priority);
                      const sector   = SECTORS[t.responsibleSector];
                      // SLA: from startedAt to completedAt
                      const slaDays  = t.startedAt && t.completedAt
                        ? differenceInDays(new Date(t.completedAt), new Date(t.startedAt))
                        : null;
                      const statusColors = { todo: 'var(--muted)', doing: 'var(--blue)', approval: 'var(--amber)', done: 'var(--green)' };
                      const statusLabels = { todo: 'Não Iniciada', doing: 'Em Produção', approval: 'Em Aprovação', done: 'Concluída' };
                      // Who delivered — use deliveredBy for done tasks, responsibleName otherwise
                      const deliveredBy = t.status === 'done'
                        ? (t.deliveredBy || t.responsibleName)
                        : t.responsibleName;

                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', background: t.isRework ? 'rgba(245,158,11,.03)' : 'transparent' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {t.isRework && <span style={{ fontSize: 9, color: 'var(--amber)', fontFamily: 'var(--fm)', marginRight: 4 }}>🔄</span>}
                            {deliveredBy || '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>{t.requestedBy || '—'}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{t.clientName}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</td>
                          <td style={{ padding: '10px 12px' }}>
                            {sector && <span style={{ fontSize: 11, color: sector.color }}>{sector.emoji} {sector.label}</span>}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {priority && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: `${priority.color}15`, color: priority.color }}>{priority.label}</span>}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: `${statusColors[t.status]}15`, color: statusColors[t.status] }}>
                              {statusLabels[t.status]}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {slaDays !== null ? <SLABadge days={slaDays} /> : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: t.reworkCount > 0 ? 'var(--amber)' : 'var(--muted)', fontWeight: t.reworkCount > 0 ? 700 : 400 }}>
                            {t.reworkCount || 0}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {t.links?.length > 0
                              ? <a href={t.links[0]} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12 }}>
                                  <ExternalLink size={12} /> Ver
                                </a>
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
        )}

        {sectorTab === 'sm' && (
          allPosts.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Nenhuma atividade no período.</p>
            : <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Colaborador', 'Cliente', 'Post', 'Data', 'Status'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, letterSpacing: '.1em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allPosts.map(p => {
                      const col = SM_COLUMNS.find(c => c.id === p.status);
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 500 }}>{p.responsible || '—'}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{p.clientName}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{p.name}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--fm)' }}>
                            {p.date ? format(new Date(p.date), 'dd/MM/yy', { locale: ptBR }) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {col && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${col.color}15`, color: col.color }}>{col.label}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
        )}
      </div>
    </div>
  );
}
