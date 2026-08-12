import React, { useState, useMemo } from 'react';
import { Download, Search } from 'lucide-react';
import { CARD, GRID, INP, LBL, Tag, Empty, fmtDate } from '../commercial/ui';

/*
 * Base de MQ (mal qualificados) — análise do Líder Comercial.
 *
 * Todo lead que o closer marca como MQ cai aqui com o motivo
 * obrigatório, o SDR que agendou e o closer que desqualificou.
 * Serve para achar padrão de erro na prospecção.
 */
export default function AdminMQBase({ deals = [], collaborators = [] }) {
  const [q, setQ] = useState('');
  const [sdrFilter, setSdrFilter] = useState('');
  const [period, setPeriod] = useState('month');

  const sdrs = useMemo(
    () => collaborators.filter(c => c.sector === 'comercial' && c.commercialRole === 'sdr'),
    [collaborators]
  );

  const since = useMemo(() => {
    const now = new Date();
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    if (period === 'quarter') return now.getTime() - 90 * 86400000;
    return 0;
  }, [period]);

  const mqs = useMemo(() => deals
    .filter(d => d.outcome === 'mq')
    .filter(d => !since || (d.closedAt && new Date(d.closedAt).getTime() >= since))
    .filter(d => !sdrFilter || d.sdrName === sdrFilter)
    .filter(d => {
      if (!q.trim()) return true;
      const hay = `${d.leadName} ${d.company} ${d.niche} ${d.mqReason} ${d.sdrName} ${d.closerName}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    })
    .sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0)),
    [deals, since, sdrFilter, q]);

  // Ranking de MQ por SDR (onde está o gargalo da qualificação).
  const bySdr = useMemo(() => {
    const map = {};
    mqs.forEach(d => {
      const k = d.sdrName || 'Sem SDR (call própria)';
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [mqs]);

  const exportCsv = () => {
    const head = ['Lead', 'Empresa', 'Nicho', 'Contato', 'SDR', 'Closer', 'Data da call', 'Data do MQ', 'Motivo'];
    const rows = mqs.map(d => [
      d.leadName || '', d.company || '', d.niche || '', d.contact || '',
      d.sdrName || '', d.closerName || '',
      d.callAt ? fmtDate(d.callAt) : '', d.closedAt ? fmtDate(d.closedAt) : '',
      (d.mqReason || '').replace(/\s+/g, ' '),
    ]);
    const csv = [head, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `base-mq-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Base de MQ</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Leads desqualificados pelos closers · {mqs.length} no período
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={mqs.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 16px', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: mqs.length ? 'pointer' : 'not-allowed', opacity: mqs.length ? 1 : .5 }}
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={14} color="var(--muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por lead, motivo, nicho..."
            style={{ ...INP, paddingLeft: 34 }}
          />
        </div>
        <select value={sdrFilter} onChange={e => setSdrFilter(e.target.value)} style={{ ...INP, width: 'auto', minWidth: 180, cursor: 'pointer' }}>
          <option value="">Todos os SDRs</option>
          {sdrs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={{ ...INP, width: 'auto', minWidth: 150, cursor: 'pointer' }}>
          <option value="month">Este mês</option>
          <option value="quarter">Últimos 90 dias</option>
          <option value="all">Tudo</option>
        </select>
      </div>

      {/* Ranking por SDR */}
      {bySdr.length > 0 && (
        <div style={{ ...CARD, marginBottom: 18 }}>
          <p style={{ ...LBL, marginBottom: 12 }}>MQ POR SDR NO PERÍODO</p>
          {bySdr.map(([name, count]) => {
            const pct = Math.round((count / mqs.length) * 100);
            return (
              <div key={name} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{name}</span>
                  <span style={{ fontSize: 12, color: 'var(--neon)', fontFamily: 'var(--fm)', fontWeight: 700 }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,var(--neon),#c41f4a)', borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mqs.length === 0 ? (
        <Empty msg="Nenhum lead marcado como MQ no período." />
      ) : (
        <div style={GRID}>
          {mqs.map(d => (
            <div key={d.id} style={{ ...CARD, border: '1px solid var(--neon-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{d.leadName}</p>
                  {d.company && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{d.company}</p>}
                </div>
                <Tag text="MQ" color="var(--neon)" />
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {d.niche && <Tag text={d.niche} color="var(--muted)" />}
                {d.sdrName && <Tag text={`SDR: ${d.sdrName}`} color="var(--blue)" />}
                {d.closerName && <Tag text={`Closer: ${d.closerName}`} color="var(--amber)" />}
              </div>

              <p style={{ fontSize: 12, color: '#ddd', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', marginTop: 10, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {d.mqReason || '—'}
              </p>

              {d.bant && Object.values(d.bant).some(Boolean) && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)', marginBottom: 5 }}>BANT REGISTRADO PELO SDR</p>
                  {['budget', 'authority', 'need', 'timing'].filter(k => d.bant[k]).map(k => (
                    <p key={k} style={{ fontSize: 11, color: '#aaa', lineHeight: 1.5, marginBottom: 3 }}>
                      <strong style={{ color: 'var(--neon)', fontFamily: 'var(--fm)' }}>{k.charAt(0).toUpperCase()}</strong> — {d.bant[k]}
                    </p>
                  ))}
                </div>
              )}

              <p style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)', marginTop: 10 }}>
                Call em {fmtDate(d.callAt)} · MQ em {fmtDate(d.closedAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
