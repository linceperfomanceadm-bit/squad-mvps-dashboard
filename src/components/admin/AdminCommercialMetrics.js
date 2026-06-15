import React, { useState, useMemo } from 'react';
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { Phone, CalendarCheck, Trophy, TrendingUp, Trash2 } from 'lucide-react';

/*
 * Métricas comerciais (admin): produtividade de SDR e Closer.
 * Período: dia / semana / mês (igual ao espírito das métricas do Kanban).
 * Mostra ranking individual + total do time.
 *
 * Fontes:
 *   - leads[].logs: { type: 'message_sent' | 'call_scheduled', by, at }
 *   - deals: { closerName, outcome, wonAt, closedAt, saleTotal, callAt }
 */
export default function AdminCommercialMetrics({ leads = [], deals = [], onDeleteCall, user }) {
  const [period, setPeriod] = useState('day');

  const since = useMemo(() => {
    const now = new Date();
    if (period === 'day') return startOfDay(now).getTime();
    if (period === 'week') return startOfWeek(now, { weekStartsOn: 1 }).getTime();
    return startOfMonth(now).getTime();
  }, [period]);

  // ── SDR: conta contatos e calls agendadas por pessoa ─────────
  const sdrStats = useMemo(() => {
    const map = {};
    const bump = (name, key) => {
      if (!name) return;
      map[name] = map[name] || { name, contacts: 0, scheduled: 0 };
      map[name][key]++;
    };
    leads.forEach(l => {
      (l.logs || []).forEach(log => {
        const t = log.at ? new Date(log.at).getTime() : 0;
        if (t < since) return;
        if (log.type === 'message_sent') bump(log.by, 'contacts');
        if (log.type === 'call_scheduled') bump(log.by, 'scheduled');
      });
    });
    return Object.values(map).sort((a, b) => (b.contacts + b.scheduled) - (a.contacts + a.scheduled));
  }, [leads, since]);

  // ── Closer: calls realizadas e vendas por pessoa ─────────────
  const closerStats = useMemo(() => {
    const map = {};
    const ensure = (name) => {
      map[name] = map[name] || { name, calls: 0, won: 0, lost: 0, noshow: 0, revenue: 0 };
      return map[name];
    };
    deals.forEach(d => {
      if (!d.closerName) return;
      const t = d.closedAt ? new Date(d.closedAt).getTime() : (d.wonAt ? new Date(d.wonAt).getTime() : 0);
      if (!t || t < since) return;
      const s = ensure(d.closerName);
      if (['won', 'lost', 'noshow'].includes(d.outcome)) s.calls++;
      if (d.outcome === 'won') { s.won++; s.revenue += Number(d.saleTotal || 0); }
      if (d.outcome === 'lost') s.lost++;
      if (d.outcome === 'noshow') s.noshow++;
    });
    return Object.values(map).sort((a, b) => b.won - a.won || b.calls - a.calls);
  }, [deals, since]);

  const sdrTotals = useMemo(() => sdrStats.reduce((a, s) => ({ contacts: a.contacts + s.contacts, scheduled: a.scheduled + s.scheduled }), { contacts: 0, scheduled: 0 }), [sdrStats]);
  const closerTotals = useMemo(() => closerStats.reduce((a, s) => ({ calls: a.calls + s.calls, won: a.won + s.won, revenue: a.revenue + s.revenue }), { calls: 0, won: 0, revenue: 0 }), [closerStats]);

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Métricas Comerciais</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Produtividade de SDRs e Closers · ranking individual e total do time.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês']].map(([k, label]) => (
            <button key={k} onClick={() => setPeriod(k)} style={{
              fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--fm)',
              background: period === k ? 'var(--neon-dim)' : 'var(--surface)',
              color: period === k ? 'var(--neon)' : 'var(--muted)',
              border: `1px solid ${period === k ? 'var(--neon-border)' : 'var(--border)'}`,
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Totais do time */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 12, marginBottom: 26 }}>
        <TotalCard icon={<Phone size={16} />} label="Contatos (SDR)" value={sdrTotals.contacts} color="#38bdf8" />
        <TotalCard icon={<CalendarCheck size={16} />} label="Calls agendadas" value={sdrTotals.scheduled} color="#a78bfa" />
        <TotalCard icon={<TrendingUp size={16} />} label="Calls realizadas" value={closerTotals.calls} color="#f59e0b" />
        <TotalCard icon={<Trophy size={16} />} label="Vendas ganhas" value={closerTotals.won} color="#22c55e" />
        <TotalCard label="Receita fechada" value={`R$ ${closerTotals.revenue.toLocaleString('pt-BR')}`} color="#22c55e" small />
      </div>

      {/* Ranking SDR */}
      <Block title="Ranking SDR" subtitle="Contatos e calls agendadas no período">
        {sdrStats.length === 0 ? <Empty /> : (
          <Table head={['SDR', 'Contatos', 'Calls agendadas', 'Conversão']}>
            {sdrStats.map((s, i) => (
              <Row key={s.name} rank={i + 1} name={s.name} cells={[
                s.contacts, s.scheduled,
                s.contacts > 0 ? `${Math.round((s.scheduled / s.contacts) * 100)}%` : '—',
              ]} />
            ))}
          </Table>
        )}
      </Block>

      {/* Ranking Closer */}
      <Block title="Ranking Closer" subtitle="Calls realizadas, vendas e receita no período">
        {closerStats.length === 0 ? <Empty /> : (
          <Table head={['Closer', 'Calls', 'Ganhas', 'Perdidas', 'No-show', 'Receita']}>
            {closerStats.map((s, i) => (
              <Row key={s.name} rank={i + 1} name={s.name} cells={[
                s.calls, s.won, s.lost, s.noshow,
                `R$ ${s.revenue.toLocaleString('pt-BR')}`,
              ]} highlight={2} />
            ))}
          </Table>
        )}
      </Block>

      {/* Calls manuais — exclusão (admin) */}
      <ManualCallsBlock deals={deals} onDeleteCall={onDeleteCall} user={user} />
    </div>
  );
}

function ManualCallsBlock({ deals, onDeleteCall, user }) {
  const manuals = useMemo(() => deals.filter(d => d.manual), [deals]);
  if (!onDeleteCall) return null;
  return (
    <div style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Calls Manuais</h2>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Calls cadastradas manualmente pelos closers. Exclua para limpar métricas de teste.</p>
      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {manuals.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Nenhuma call manual cadastrada.</p>
        ) : manuals.map(d => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{d.leadName} {d.company && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {d.company}</span>}</p>
              <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>
                {d.closerName || '—'} · {d.callAt ? new Date(d.callAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'sem data'}
                {d.outcome && ` · ${d.outcome}`}
              </p>
            </div>
            <button onClick={() => onDeleteCall(d.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        ))}
      </div>
    </div>
  );

function TotalCard({ icon, label, value, color, small }) {
  return (
    <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color, marginBottom: 8 }}>{icon}<span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span></div>
      <p style={{ fontSize: small ? 20 : 30, fontWeight: 800, color }}>{value}</p>
    </div>
  );
}
function Block({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{title}</h2>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{subtitle}</p>
      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}
function Table({ head, children }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>{head.map((h, i) => <th key={i} style={{ textAlign: i === 0 ? 'left' : 'center', fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', letterSpacing: '.08em', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>{h.toUpperCase()}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
function Row({ rank, name, cells, highlight }) {
  return (
    <tr>
      <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'var(--fm)', color: rank === 1 ? '#fbbf24' : 'var(--muted)', width: 18 }}>{rank}º</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
        </span>
      </td>
      {cells.map((c, i) => (
        <td key={i} style={{ textAlign: 'center', padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: highlight === i + 1 ? 800 : 500, color: highlight === i + 1 ? '#22c55e' : 'var(--text)', fontFamily: 'var(--fm)' }}>{c}</td>
      ))}
    </tr>
  );
}
function Empty() { return <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '28px 0' }}>Sem dados no período.</p>; }
