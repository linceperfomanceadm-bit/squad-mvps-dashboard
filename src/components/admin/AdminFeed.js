import React, { useState } from 'react';
import { differenceInDays, format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import { SLA_DAYS, SM_COLUMNS, APPROVAL_STATUS } from '../../lib/firebase';

const DATE_FILTERS = [
  { key: 'today',  label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '7days', label: 'Últimos 7 dias' },
  { key: 'month', label: 'Este mês' },
];

function inRange(dateStr, filter) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  if (filter === 'today') return differenceInDays(now, d) === 0;
  if (filter === 'yesterday') return differenceInDays(now, d) === 1;
  if (filter === '7days') return differenceInDays(now, d) <= 7;
  if (filter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  return true;
}

function SLABadge({ days }) {
  const ok = days <= SLA_DAYS;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, fontFamily: 'var(--fm)' }}>
      <span style={{ fontSize: 14 }}>{ok ? '🟢' : '🔴'}</span>
      {days}d
    </span>
  );
}

export default function AdminFeed({ clients, collaborators }) {
  const [dateFilter, setDateFilter] = useState('today');
  const [collabFilter, setCollabFilter] = useState('');
  const [sectorTab, setSectorTab] = useState('design');

  // Build deliveries
  const allDeliveries = [];
  clients.forEach(c => {
    const process = (items, sector) => (items || []).forEach(d => {
      if (inRange(d.deliveryDate || d.createdAt, dateFilter)) {
        if (!collabFilter || d.responsible === collabFilter) {
          const days = d.requestDate && d.deliveryDate ? differenceInDays(new Date(d.deliveryDate), new Date(d.requestDate)) : null;
          allDeliveries.push({ ...d, clientName: c.name, sector, slaDays: days });
        }
      }
    });
    process(c.design?.deliveries, 'design');
    process(c.video?.deliveries, 'video');
  });

  // Build SM posts
  const allPosts = [];
  clients.forEach(c => {
    (c.sm?.posts || []).forEach(p => {
      if (inRange(p.updatedAt || p.createdAt, dateFilter)) {
        if (!collabFilter || p.responsible === collabFilter) {
          allPosts.push({ ...p, clientName: c.name });
        }
      }
    });
  });

  const designDeliveries = allDeliveries.filter(d => d.sector === 'design');
  const videoDeliveries = allDeliveries.filter(d => d.sector === 'video');

  const TABLE_COLS_CREATIVE = ['Colaborador', 'Cliente', 'Task', 'Setor Solicitante', 'Status', 'Tempo de Produção', 'Link'];

  const renderCreativeTable = (items) => (
    items.length === 0
      ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Nenhuma entrega no período.</p>
      : <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {TABLE_COLS_CREATIVE.map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, letterSpacing: '.1em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map(d => {
                const status = APPROVAL_STATUS.find(s => s.id === d.approvalStatus);
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 500 }}>{d.responsible || '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{d.clientName}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{d.requestingSector || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {status && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${status.color}15`, color: status.color }}>{status.label}</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {d.slaDays !== null ? <SLABadge days={d.slaDays} /> : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {d.link ? <a href={d.link} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12 }}><ExternalLink size={12} /> Ver</a> : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
  );

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Extrato de Produção</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Atividades do time de criação</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: 4 }}>
          {DATE_FILTERS.map(f => (
            <button key={f.key} onClick={() => setDateFilter(f.key)}
              style={{ background: dateFilter === f.key ? 'var(--neon-dim)' : 'transparent', border: 'none', borderRadius: 7, padding: '6px 14px', color: dateFilter === f.key ? 'var(--neon)' : 'var(--muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .15s' }}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={collabFilter} onChange={e => setCollabFilter(e.target.value)}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: collabFilter ? 'var(--text)' : 'var(--muted)', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
          <option value="">Todos os colaboradores</option>
          {collaborators.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* Sector tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
        {[{ key: 'design', label: '🎨 Design', count: designDeliveries.length }, { key: 'video', label: '🎬 VideoMaker', count: videoDeliveries.length }, { key: 'sm', label: '📱 Social Media', count: allPosts.length }].map(t => (
          <button key={t.key} onClick={() => setSectorTab(t.key)}
            style={{ background: sectorTab === t.key ? 'var(--neon-dim)' : 'transparent', border: 'none', borderRadius: 7, padding: '7px 16px', color: sectorTab === t.key ? 'var(--neon)' : 'var(--muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t.label}
            <span style={{ background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: '0 6px', fontSize: 10, fontFamily: 'var(--fm)' }}>{t.count}</span>
          </button>
        ))}
      </div>

      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '4px 0', overflow: 'hidden' }}>
        {sectorTab === 'design' && renderCreativeTable(designDeliveries)}
        {sectorTab === 'video' && renderCreativeTable(videoDeliveries)}
        {sectorTab === 'sm' && (
          allPosts.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Nenhuma atividade no período.</p>
            : <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Colaborador', 'Cliente', 'Post', 'Status'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, letterSpacing: '.1em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' }}>{h}</th>)}
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
