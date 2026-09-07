import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { SECTORS } from '../../lib/firebase';
import { entregadoresDe } from '../../hooks/useTasks';

/*
 * RELATÓRIOS — versão "vidro".
 *
 * Referência: painel monocromático com anéis de progresso, barras
 * finas e área suave, tudo sobre cartões translúcidos. Aqui a regra
 * de cor do app continua valendo: a cor do painel (--c) é o único
 * acento; verde/vermelho só onde é semântica (de primeira / com
 * ajuste); a cor de setor só onde o setor É a informação.
 *
 * Os anéis são SVG puro — Recharts fica só para a área do mês.
 */

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const fmtDur = (ms) => {
  if (!ms || ms <= 0) return '—';
  const h = ms / 3600000;
  if (h < 1) return `${Math.round(ms / 60000)} min`;
  if (h < 24) return `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
  return `${Math.floor(h / 24)}d ${Math.round(h % 24)}h`;
};

// ── cartão de vidro ───────────────────────────────────────────
const GLASS = {
  position: 'relative',
  background: 'color-mix(in srgb, var(--bg2) 78%, transparent)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid var(--border-h)',
  borderRadius: 20,
  padding: '18px 20px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), var(--shadow)',
  minWidth: 0,
};
function Glass({ title, sub, right, children, style }) {
  return (
    <div style={{ ...GLASS, ...style }}>
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{title}</h2>
            {sub && <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</p>}
          </div>
          {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ── anel de progresso ─────────────────────────────────────────
function Ring({ value, size = 96, stroke = 7, label, tone }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  const color = tone || 'var(--c)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--soft)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.65,.05,.36,1)' }} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="var(--text)" fontSize={size * 0.22} fontWeight="500" fontFamily="var(--f)" style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
          {v}%
        </text>
      </svg>
      {label && <span style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center' }}>{label}</span>}
    </div>
  );
}

// ── barras finas verticais (dias da semana) ───────────────────
function DayBars({ values }) {
  const max = Math.max(1, ...values);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 92, marginTop: 6 }}>
      {values.map((v, i) => {
        const top = v === max && v > 0;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--fm)', color: top ? 'var(--text)' : 'var(--dim)' }}>{v || ''}</span>
            <div style={{ width: 6, height: `${Math.max(6, (v / max) * 100)}%`, borderRadius: 99, background: top ? 'var(--c)' : 'var(--border-s)' }} />
            <span style={{ fontSize: 10, color: top ? 'var(--text)' : 'var(--muted)' }}>{DIAS[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── barra fina horizontal ─────────────────────────────────────
function Track({ label, value, max, color, right, segments }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '128px 1fr 52px', gap: 12, alignItems: 'center', fontSize: 12.5 }}>
      <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={label}>{label}</span>
      <div style={{ height: 6, borderRadius: 99, background: 'var(--soft)', overflow: 'hidden', display: 'flex' }}>
        {segments
          ? segments.map((s, i) => <div key={i} style={{ width: `${(s.value / max) * 100}%`, height: '100%', background: s.color }} />)
          : <div style={{ width: `${(value / max) * 100}%`, height: '100%', borderRadius: 99, background: color || 'var(--c)' }} />}
      </div>
      <span style={{ fontFamily: 'var(--fm)', fontSize: 11, textAlign: 'right', color: 'var(--text)' }}>{right ?? value}</span>
    </div>
  );
}

const AreaTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border-h)', borderRadius: 10, padding: '8px 12px', boxShadow: 'var(--shadow)' }}>
      <p style={{ fontSize: 11, color: 'var(--muted)' }}>dia {label}</p>
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{payload[0].value} entrega{payload[0].value === 1 ? '' : 's'}</p>
    </div>
  );
};

const PERIODOS = [
  ['mes', 'Este mês'], ['mes-1', 'Mês passado'], ['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['tudo', 'Tudo'], ['custom', 'Período…'],
];

// Início/fim do período escolhido. `custom` usa as duas datas do usuário.
function janelaDe(periodo, de, ate, now) {
  const fimDia = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  if (periodo === 'mes') return [new Date(now.getFullYear(), now.getMonth(), 1), fimDia(now)];
  if (periodo === 'mes-1') return [new Date(now.getFullYear(), now.getMonth() - 1, 1), fimDia(new Date(now.getFullYear(), now.getMonth(), 0))];
  if (periodo === 'custom') return [de ? new Date(`${de}T00:00:00`) : null, ate ? fimDia(new Date(`${ate}T00:00:00`)) : fimDia(now)];
  if (periodo === 'tudo') return [null, null];
  const dias = Number(periodo);
  const ini = new Date(now); ini.setDate(now.getDate() - dias + 1); ini.setHours(0, 0, 0, 0);
  return [ini, fimDia(now)];
}

const SEL = { height: 34, borderRadius: 99, background: 'var(--bg3)', border: '1px solid var(--border-h)', padding: '0 32px 0 12px', fontSize: 12.5, color: 'var(--muted)', minWidth: 0 };
const SEL_ON = { borderColor: 'var(--c)', background: 'var(--c-dim)', color: 'var(--text)', fontWeight: 600 };

export default function AdminCharts({ clients, tasks = [] }) {
  const [periodo, setPeriodo] = useState('mes');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [setor, setSetor] = useState('');
  const [pessoa, setPessoa] = useState('');
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  // Quem já entregou alguma coisa — alimenta o filtro de colaborador.
  const pessoas = useMemo(() => {
    const set = new Set();
    tasks.forEach(t => entregadoresDe(t).forEach(n => set.add(n)));
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tasks]);

  const d = useMemo(() => {
    const [ini, fim] = janelaDe(periodo, de, ate, now);
    const dentro = (dt) => { const c = toDate(dt); return !!c && (!ini || c >= ini) && (!fim || c <= fim); };
    const doSetor = (t) => !setor || (t.deliveredBySector || t.responsibleSector) === setor;
    const daPessoa = (t) => !pessoa || entregadoresDe(t).includes(pessoa);
    const filtro = (t) => doSetor(t) && daPessoa(t);

    const done = tasks.filter(t => t.status === 'done' && filtro(t));
    const noPeriodo = done.filter(t => dentro(t.completedAt));
    const tudoFiltrado = tasks.filter(filtro);

    // anéis
    const dePrimeira = noPeriodo.filter(t => !t.reworkCount).length;
    const comPrazo = noPeriodo.filter(t => t.deadline && t.completedAt);
    const noPrazo = comPrazo.filter(t => {
      const dl = toDate(t.deadline); dl.setHours(23, 59, 59, 999);
      return toDate(t.completedAt) <= dl;
    }).length;

    // tempo médio de produção
    const durs = noPeriodo.map(t => {
      const a = toDate(t.startedAt), b = toDate(t.completedAt);
      return a && b ? b - a : null;
    }).filter(Boolean);
    const media = durs.length ? durs.reduce((x, y) => x + y, 0) / durs.length : 0;

    // dias da semana
    const semana = [0, 0, 0, 0, 0, 0, 0];
    noPeriodo.forEach(t => { const c = toDate(t.completedAt); if (c) semana[c.getDay()]++; });

    // área do mês (sempre o mês corrente)
    const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const porDia = Array.from({ length: diasNoMes }, (_, i) => ({ dia: i + 1, v: 0 }));
    done.forEach(t => { const c = toDate(t.completedAt); if (c && c >= inicioMes) porDia[c.getDate() - 1].v++; }); // `done` já vem filtrado por setor/pessoa
    const ateHoje = porDia.slice(0, now.getDate());

    // tempo de produção por pessoa — o número que faltava: quantas
    // entregas E quanto tempo cada uma leva, lado a lado.
    const tempoPessoa = {};
    noPeriodo.forEach(t => {
      const a = toDate(t.startedAt), b = toDate(t.completedAt);
      const dur = a && b ? b - a : null;
      entregadoresDe(t).forEach(n => {
        if (!tempoPessoa[n]) tempoPessoa[n] = { name: n, entregas: 0, durs: [] };
        tempoPessoa[n].entregas++;
        if (dur) tempoPessoa[n].durs.push(dur);
      });
    });
    const tempoRows = Object.values(tempoPessoa).map(p => {
      const ord = [...p.durs].sort((x, y) => x - y);
      const mediana = ord.length ? ord[Math.floor(ord.length / 2)] : 0;
      const med = ord.length ? ord.reduce((x, y) => x + y, 0) / ord.length : 0;
      return { name: p.name, entregas: p.entregas, media: med, mediana, maior: ord[ord.length - 1] || 0, comTempo: ord.length };
    }).sort((a, b) => b.entregas - a.entregas);

    // demanda por setor (tasks criadas no período)
    const demanda = {};
    tudoFiltrado.filter(t => periodo === 'tudo' || dentro(t.createdAt))
      .forEach(t => { if (t.requestedBySector) demanda[t.requestedBySector] = (demanda[t.requestedBySector] || 0) + 1; });
    const demandaRows = Object.entries(demanda).map(([id, v]) => ({ id, label: SECTORS[id]?.label || id, value: v, color: SECTORS[id]?.color }))
      .sort((a, b) => b.value - a.value);

    // aprovação por colaborador
    const colab = {};
    noPeriodo.forEach(t => {
      const nomes = entregadoresDe(t);
      (nomes.length ? nomes : ['Desconhecido']).forEach(n => {
        if (!colab[n]) colab[n] = { name: n, total: 0, ok: 0 };
        colab[n].total++;
        if (!t.reworkCount) colab[n].ok++;
      });
    });
    const colabRows = Object.values(colab).sort((a, b) => b.total - a.total).slice(0, 8);

    // refações por cliente (entregues no período + as ainda abertas)
    const redo = {};
    noPeriodo.concat(tudoFiltrado.filter(t => t.status !== 'done'))
      .forEach(t => { if (t.reworkCount > 0) redo[t.clientName || '—'] = (redo[t.clientName || '—'] || 0) + t.reworkCount; });
    const redoRows = Object.entries(redo).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);

    return {
      total: noPeriodo.length, dePrimeira, aprov: pct(dePrimeira, noPeriodo.length),
      prazo: pct(noPrazo, comPrazo.length), comPrazo: comPrazo.length,
      media, semana, ateHoje, demandaRows, colabRows, redoRows, tempoRows,
      abertas: tudoFiltrado.filter(t => t.status !== 'done').length,
      refacaoAberta: tudoFiltrado.filter(t => t.isRework && t.status !== 'done').length,
    };
  }, [tasks, periodo, de, ate, setor, pessoa]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxDem = Math.max(1, ...d.demandaRows.map(r => r.value));
  const maxColab = Math.max(1, ...d.colabRows.map(r => r.total));
  const maxRedo = Math.max(1, ...d.redoRows.map(r => r.value));
  const gradId = 'areaGrad';

  return (
    <div className="fade-up" style={{ position: 'relative' }}>
      {/* luz de fundo: dá ao vidro algo para desfocar */}
      <div aria-hidden style={{ position: 'absolute', inset: -40, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(38% 30% at 18% 12%, color-mix(in srgb, var(--c) 18%, transparent), transparent 70%), radial-gradient(34% 28% at 88% 62%, color-mix(in srgb, var(--c2) 12%, transparent), transparent 70%)',
        filter: 'blur(30px)' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em' }}>Relatórios</h1>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Eficiência do time e gargalos</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={setor} onChange={e => setSetor(e.target.value)} style={{ ...SEL, ...(setor ? SEL_ON : null) }}>
              <option value="">Todos os setores</option>
              {Object.values(SECTORS).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={pessoa} onChange={e => setPessoa(e.target.value)} style={{ ...SEL, ...(pessoa ? SEL_ON : null), maxWidth: 200 }}>
              <option value="">Todos os colaboradores</option>
              {pessoas.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ ...SEL, ...(periodo !== 'mes' ? SEL_ON : null) }}>
              {PERIODOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {periodo === 'custom' && (
              <>
                <input type="date" value={de} onChange={e => setDe(e.target.value)} style={{ ...SEL, padding: '0 10px', fontFamily: 'var(--fm)', color: 'var(--text)' }} />
                <span style={{ color: 'var(--dim)', fontSize: 12 }}>até</span>
                <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ ...SEL, padding: '0 10px', fontFamily: 'var(--fm)', color: 'var(--text)' }} />
              </>
            )}
            {(setor || pessoa || periodo !== 'mes') && (
              <button className="ui-btn small" style={{ height: 34 }} onClick={() => { setSetor(''); setPessoa(''); setPeriodo('mes'); setDe(''); setAte(''); }}>Limpar</button>
            )}
          </div>
        </div>

        {/* ── linha 1: anéis, semana, tempo ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14, marginBottom: 14 }}>
          <Glass title="Aprovação de primeira" sub={`${d.dePrimeira} de ${d.total} entregas`}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
              <Ring value={d.aprov} tone={d.aprov >= 90 ? 'var(--green)' : d.aprov >= 75 ? 'var(--c)' : 'var(--red)'} />
            </div>
          </Glass>
          <Glass title="Entregues no prazo" sub={d.comPrazo ? `${d.comPrazo} com data definida` : 'nenhuma com data'}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
              <Ring value={d.prazo} tone={d.prazo >= 85 ? 'var(--green)' : d.prazo >= 60 ? 'var(--c)' : 'var(--red)'} />
            </div>
          </Glass>
          <Glass title="Ritmo da semana" sub="entregas por dia da semana">
            <DayBars values={d.semana} />
          </Glass>
          <Glass title="Tempo de produção" sub="início → conclusão, média">
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-.02em', lineHeight: 1, color: 'var(--text)', marginTop: 8 }}>{fmtDur(d.media)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
              {[['Abertas', d.abertas, 'var(--text)'], ['Em refação', d.refacaoAberta, d.refacaoAberta ? 'var(--red)' : 'var(--text)']].map(([l, v, c]) => (
                <div key={l} style={{ background: 'var(--soft)', borderRadius: 12, padding: '9px 11px' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 500, color: c, marginTop: 1 }}>{v}</div>
                </div>
              ))}
            </div>
          </Glass>
        </div>

        {/* ── linha 2: área do mês + demanda ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, marginBottom: 14 }}>
          <Glass title="Entregas no mês" sub={`${MESES[now.getMonth()]} · dia a dia`}>
            <div style={{ height: 210, marginLeft: -12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.ateHoje} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--c)" stopOpacity={.32} />
                      <stop offset="100%" stopColor="var(--c)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dia" tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'var(--fm)' }} axisLine={false} tickLine={false} interval={Math.ceil(d.ateHoje.length / 10) - 1} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--dim)', fontSize: 10, fontFamily: 'var(--fm)' }} axisLine={false} tickLine={false} width={26} />
                  <Tooltip content={<AreaTip />} cursor={{ stroke: 'var(--border-s)', strokeDasharray: '3 3' }} />
                  <Area type="monotone" dataKey="v" stroke="var(--c)" strokeWidth={2} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4, fill: 'var(--c)', stroke: 'var(--bg2)', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Glass>
          <Glass title="Demanda por setor" sub="quem mais cria tasks">
            {d.demandaRows.length === 0
              ? <p style={{ fontSize: 12.5, color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>Sem tasks no período.</p>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 6 }}>
                  {d.demandaRows.map(r => <Track key={r.id} label={r.label} value={r.value} max={maxDem} color={r.color} />)}
                </div>}
          </Glass>
        </div>

        {/* ── linha 3: tempo de produção por pessoa ── */}
        <Glass title="Tempo de produção por colaborador" sub="quantas entregas e quanto tempo cada uma leva, de início a conclusão" style={{ marginBottom: 14 }}>
          {d.tempoRows.length === 0
            ? <p style={{ fontSize: 12.5, color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>Nenhuma entrega no período.</p>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      {['Colaborador', 'Entregas', 'Tempo médio', 'Mediana', 'Mais longa', ''].map((h, i) => (
                        <th key={i} style={{ textAlign: i === 0 ? 'left' : 'right', fontFamily: 'var(--fm)', fontSize: 10, letterSpacing: '.1em', color: 'var(--muted)', fontWeight: 500, padding: '6px 10px 10px', borderBottom: '1px solid var(--border)' }}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.tempoRows.map(r => {
                      const maxEnt = d.tempoRows[0].entregas || 1;
                      return (
                        <tr key={r.name}>
                          <td style={{ padding: '9px 10px', color: 'var(--text)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{r.name}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--fm)', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{r.entregas}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--fm)', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{fmtDur(r.media)}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--fm)', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{fmtDur(r.mediana)}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--fm)', color: r.maior > 3 * 86400000 ? 'var(--amber)' : 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{fmtDur(r.maior)}</td>
                          <td style={{ padding: '9px 10px', width: 160, borderBottom: '1px solid var(--border)' }}>
                            <div style={{ height: 6, borderRadius: 99, background: 'var(--soft)', overflow: 'hidden' }}>
                              <div style={{ width: `${(r.entregas / maxEnt) * 100}%`, height: '100%', borderRadius: 99, background: 'var(--c)' }} />
                            </div>
                            {r.comTempo < r.entregas && <div style={{ fontSize: 9.5, color: 'var(--dim)', fontFamily: 'var(--fm)', marginTop: 3 }}>{r.entregas - r.comTempo} sem horário de início</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </Glass>

        {/* ── linha 4: colaboradores + refações ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Glass title="Aprovação por colaborador" sub="de primeira vs. com ajuste · por quem entregou"
            right={<span style={{ display: 'flex', gap: 10, fontSize: 10.5, color: 'var(--muted)' }}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--green)', marginRight: 4, verticalAlign: 'middle' }} />de primeira<i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--red)', marginRight: 4, marginLeft: 6, verticalAlign: 'middle' }} />com ajuste</span>}>
            {d.colabRows.length === 0
              ? <p style={{ fontSize: 12.5, color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>Nenhuma entrega no período.</p>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 6 }}>
                  {d.colabRows.map(r => (
                    <Track key={r.name} label={r.name} max={maxColab} right={`${pct(r.ok, r.total)}%`}
                      segments={[{ value: r.ok, color: 'var(--green)' }, { value: r.total - r.ok, color: 'var(--red)' }]} />
                  ))}
                </div>}
          </Glass>
          <Glass title="Refações por cliente" sub="quem mais gera ajustes">
            {d.redoRows.length === 0
              ? <p style={{ fontSize: 12.5, color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>Nenhuma refação registrada. ✨</p>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 6 }}>
                  {d.redoRows.map((r, i) => <Track key={r.label} label={r.label} value={r.value} max={maxRedo} color={i === 0 ? 'var(--red)' : 'var(--border-s)'} />)}
                </div>}
          </Glass>
        </div>
      </div>
    </div>
  );
}
