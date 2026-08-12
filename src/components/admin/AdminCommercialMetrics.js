import React, { useState, useMemo } from 'react';
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { CARD, LBL, Tag, Empty, money, fmtDateTime } from '../commercial/ui';

/*
 * Métricas comerciais (admin) — reconstruídas sobre o funil novo.
 *
 * SDR:    calls agendadas · bem qualificadas · MQ · no-show
 * Closer: calls realizadas · vendas ganhas · valor · MQ · follow ups
 *
 * Fonte única: coleção `deals`.
 *   callAt      → quando a call foi agendada para acontecer
 *   callDoneAt  → o closer confirmou que a call aconteceu
 *   wonAt       → venda ganha
 *   closedAt    → desfecho (MQ)
 *   noShowAt    → cliente não compareceu
 */
const isWon = (d) => d?.outcome === 'venda_ganha' || d?.outcome === 'venda_fechada';

export default function AdminCommercialMetrics({ deals = [], onDeleteCall, user }) {
  const [period, setPeriod] = useState('month');

  const since = useMemo(() => {
    const now = new Date();
    if (period === 'day') return startOfDay(now).getTime();
    if (period === 'week') return startOfWeek(now, { weekStartsOn: 1 }).getTime();
    return startOfMonth(now).getTime();
  }, [period]);

  const inPeriod = (iso) => iso && new Date(iso).getTime() >= since;

  // ── SDR ──────────────────────────────────────────────────────
  const sdrStats = useMemo(() => {
    const map = {};
    const ensure = (name) => {
      if (!name) return null;
      map[name] = map[name] || { name, scheduled: 0, qualified: 0, mq: 0, noshow: 0, won: 0 };
      return map[name];
    };
    deals.forEach(d => {
      if (!d.sdrName) return;
      const s = ensure(d.sdrName);
      if (!s) return;
      if (inPeriod(d.callAt)) {
        s.scheduled++;
        if (d.callDoneAt && d.outcome !== 'mq' && d.outcome !== 'noshow') s.qualified++;
      }
      if (d.outcome === 'mq' && inPeriod(d.closedAt)) s.mq++;
      if (inPeriod(d.noShowAt)) s.noshow++;
      if (isWon(d) && inPeriod(d.wonAt)) s.won++;
    });
    return Object.values(map).sort((a, b) => b.scheduled - a.scheduled);
  }, [deals, since]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Closer ───────────────────────────────────────────────────
  const closerStats = useMemo(() => {
    const map = {};
    const ensure = (name) => {
      if (!name) return null;
      map[name] = map[name] || { name, calls: 0, won: 0, mq: 0, revenue: 0, followups: 0 };
      return map[name];
    };
    deals.forEach(d => {
      const names = [d.closerName, d.secondCloser].filter(Boolean);
      names.forEach(n => {
        const c = ensure(n);
        if (!c) return;
        if (inPeriod(d.callDoneAt)) c.calls++;
        if (d.status === 'followup') c.followups++;
        if (d.outcome === 'mq' && inPeriod(d.closedAt)) c.mq++;
        if (isWon(d) && inPeriod(d.wonAt)) {
          c.won++;
          const full = Number(d.saleTotal) || 0;
          c.revenue += d.saleValuePerCloser != null ? Number(d.saleValuePerCloser) : full;
        }
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [deals, since]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    const wonDeals = deals.filter(d => isWon(d) && inPeriod(d.wonAt));
    return {
      scheduled: deals.filter(d => inPeriod(d.callAt)).length,
      calls: deals.filter(d => inPeriod(d.callDoneAt)).length,
      won: wonDeals.length,
      revenue: wonDeals.reduce((s, d) => s + (Number(d.saleTotal) || 0), 0),
      mq: deals.filter(d => d.outcome === 'mq' && inPeriod(d.closedAt)).length,
      noshow: deals.filter(d => inPeriod(d.noShowAt)).length,
    };
  }, [deals, since]); // eslint-disable-line react-hooks/exhaustive-deps

  const convRate = totals.calls > 0 ? Math.round((totals.won / totals.calls) * 100) : 0;
  const showRate = totals.scheduled > 0 ? Math.round((totals.calls / totals.scheduled) * 100) : 0;

  // Calls agendadas do período (para o admin conferir/excluir)
  const upcoming = useMemo(() => deals
    .filter(d => d.status === 'scheduled')
    .sort((a, b) => new Date(a.callAt) - new Date(b.callAt)),
    [deals]);

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Métricas Comercial</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Produtividade de SDRs e Closers no período</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'day', label: 'Hoje' }, { id: 'week', label: 'Semana' }, { id: 'month', label: 'Mês' }].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              style={{ padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: period === p.id ? 'var(--neon-dim)' : 'var(--surface)', color: period === p.id ? 'var(--neon)' : 'var(--muted)', border: `1px solid ${period === p.id ? 'var(--neon-border)' : 'var(--border)'}` }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Totais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 22 }}>
        <Box label="Calls agendadas" value={totals.scheduled} color="var(--blue)" />
        <Box label="Calls realizadas" value={totals.calls} color="var(--blue)" sub={`${showRate}% de comparecimento`} />
        <Box label="Vendas ganhas" value={totals.won} color="var(--green)" sub={`${convRate}% de conversão`} />
        <Box label="Faturamento" value={money(totals.revenue)} color="var(--green)" small />
        <Box label="MQ" value={totals.mq} color="var(--neon)" />
        <Box label="No-shows" value={totals.noshow} color="var(--amber)" />
      </div>

      {/* SDRs */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>🎯 SDRs</h2>
      {sdrStats.length === 0 ? <Empty msg="Nenhuma atividade de SDR no período." /> : (
        <Table
          head={['SDR', 'Agendadas', 'Bem qualif.', 'MQ', 'No-show', 'Viraram venda']}
          rows={sdrStats.map(s => [
            s.name,
            s.scheduled,
            <span style={{ color: 'var(--green)' }}>{s.qualified}</span>,
            <span style={{ color: s.mq > 0 ? 'var(--neon)' : 'var(--muted)' }}>{s.mq}</span>,
            <span style={{ color: s.noshow > 0 ? 'var(--amber)' : 'var(--muted)' }}>{s.noshow}</span>,
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>{s.won}</span>,
          ])}
        />
      )}

      {/* Closers */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '26px 0 10px' }}>💼 Closers</h2>
      {closerStats.length === 0 ? <Empty msg="Nenhuma atividade de closer no período." /> : (
        <Table
          head={['Closer', 'Calls', 'Vendas', 'Valor', 'MQ', 'Follow ups']}
          rows={closerStats.map(c => [
            c.name,
            c.calls,
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>{c.won}</span>,
            <span style={{ color: 'var(--green)', fontFamily: 'var(--fm)' }}>{money(c.revenue)}</span>,
            <span style={{ color: c.mq > 0 ? 'var(--neon)' : 'var(--muted)' }}>{c.mq}</span>,
            <span style={{ color: c.followups > 0 ? 'var(--amber)' : 'var(--muted)' }}>{c.followups}</span>,
          ])}
        />
      )}

      {/* Agenda geral */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '26px 0 10px' }}>
        📅 Calls agendadas ({upcoming.length})
      </h2>
      {upcoming.length === 0 ? <Empty msg="Nenhuma call agendada no momento." /> : (
        <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
          {upcoming.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{d.leadName}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)' }}>{d.company || '—'}</p>
              </div>
              {d.sdrName && <Tag text={d.sdrName} color="var(--blue)" />}
              <span style={{ fontSize: 12, color: 'var(--neon)', fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>{fmtDateTime(d.callAt)}</span>
              {onDeleteCall && (
                <button
                  onClick={() => onDeleteCall(d.id)}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 7px', display: 'flex', cursor: 'pointer' }}
                  title="Excluir call"
                >
                  <Trash2 size={13} color="rgba(238,51,99,.7)" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Box({ label, value, color, sub, small }) {
  return (
    <div style={{ ...CARD, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: small ? 20 : 30, fontWeight: 800, color }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: '#666', marginTop: 6, fontFamily: 'var(--fm)' }}>{sub}</p>}
    </div>
  );
}

function Table({ head, rows }) {
  return (
    <div style={{ ...CARD, padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {head.map(h => (
              <th key={h} style={{ ...LBL, textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} style={{ padding: '11px 16px', fontSize: 13, color: j === 0 ? '#fff' : '#ddd', fontWeight: j === 0 ? 600 : 500, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
