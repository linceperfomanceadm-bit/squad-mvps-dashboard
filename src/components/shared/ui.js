import React from 'react';

// ─── Kit visual do Layout 01 ──────────────────────────────────
// Peças usadas pelas visões gerais. Tudo neutro; a cor do painel
// entra por var(--c) / var(--grad), a semântica por --green/--red.

export function PageHeader({ title, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
      <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: '-.01em', color: 'var(--text)' }}>{title}</h1>
      {sub && <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{sub}</span>}
      {right && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{right}</div>}
    </div>
  );
}

export function Card({ title, sub, right, children, style, className = '' }) {
  return (
    <div className={`ui-card ${className}`} style={style}>
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
          {title}
          {sub && <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12, marginLeft: 4 }}>{sub}</span>}
          {right && <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Grid({ cols = 4, children, style }) {
  return <div style={{ display: 'grid', gridTemplateColumns: typeof cols === 'number' ? `repeat(${cols},minmax(0,1fr))` : cols, gap: 14, marginBottom: 14, ...style }}>{children}</div>;
}

// Número grande + rótulo + (opcional) variação e corpo.
// `tone` colore só o número: 'good' | 'warn' | 'bad' | undefined.
export function Kpi({ value, label, delta, deltaTone, tone, children }) {
  const toneColor = { good: 'var(--green)', warn: 'var(--amber)', bad: 'var(--red)' }[tone] || 'var(--text)';
  const dTone = { up: 'var(--green)', down: 'var(--red)', neutral: 'var(--muted)' }[deltaTone || 'neutral'];
  const dBg = { up: 'var(--green-dim)', down: 'var(--red-dim)', neutral: 'var(--soft)' }[deltaTone || 'neutral'];
  return (
    <div className="ui-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <b style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-.02em', lineHeight: 1, color: toneColor }}>{value}</b>
        {delta != null && <i style={{ fontStyle: 'normal', fontFamily: 'var(--fm)', fontSize: 10.5, padding: '3px 7px', borderRadius: 99, color: dTone, background: dBg }}>{delta}</i>}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 8 }}>{label}</div>
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  );
}

// Lista rótulo → valor (quebra por setor, etc.)
export function Breakdown({ rows }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
          <span>{k}</span><b style={{ fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--fm)', fontSize: 11.5 }}>{v}</b>
        </div>
      ))}
    </div>
  );
}

// Mini-barras verticais (série curta). values em 0..1.
export function MiniBars({ values }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 64, paddingTop: 6 }}>
      {values.map((v, i) => (
        <i key={i} style={{ flex: 1, height: `${Math.max(4, Math.round(v * 100))}%`, borderRadius: '4px 4px 2px 2px', background: 'linear-gradient(180deg,var(--c2),var(--c) 55%,color-mix(in srgb,var(--c) 18%,transparent))' }} />
      ))}
    </div>
  );
}

// Barra de progresso com legenda.
export function Goal({ pct, children }) {
  return (
    <div>
      <div style={{ height: 6, borderRadius: 99, background: 'var(--soft)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', borderRadius: 99, background: 'var(--grad)' }} />
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>{children}</p>
    </div>
  );
}

// Barras horizontais com rótulo (rankings, demanda por setor).
export function HBars({ rows, color }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 44px', gap: 12, alignItems: 'center', fontSize: 12.5 }}>
          <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--soft)', overflow: 'hidden' }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', borderRadius: 99, background: r.color || color || 'var(--c)' }} />
          </div>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, textAlign: 'right', color: 'var(--text)' }}>{r.display ?? r.value}</span>
        </div>
      ))}
    </div>
  );
}

// Colunas arredondadas (entregas por setor). A maior ganha o gradiente.
export function Pills({ rows }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, height: 150, marginTop: 18, padding: '0 4px' }}>
      {rows.map(r => {
        const hi = r.value === max && max > 0;
        return (
          <div key={r.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 500, color: hi ? 'var(--text)' : 'var(--muted)' }}>{r.value}</span>
            <div style={{ width: 26, borderRadius: 99, background: 'var(--bg3)', position: 'relative', height: '100%' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 99, height: `${Math.max(6, (r.value / max) * 100)}%`, background: hi ? 'linear-gradient(180deg,var(--c2),var(--c))' : 'var(--border-s)' }} />
            </div>
            <span style={{ fontSize: 10.5, color: hi ? 'var(--text)' : 'var(--muted)', fontWeight: hi ? 500 : 400, whiteSpace: 'nowrap' }}>{r.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Três indicadores com ícone (Tasks: em produção / aprovadas / refação).
export function Trio({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', marginTop: 18 }}>
      {items.map(({ icon: Icon, label, value, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-h)', color }}>
            {Icon && <Icon size={15} />}
          </div>
          <div>
            <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11.5 }}>{label}</small>
            <b style={{ display: 'block', fontSize: 19, fontWeight: 500, lineHeight: 1.1, marginTop: 1, color }}>{value}</b>
          </div>
        </div>
      ))}
    </div>
  );
}

// Etiqueta de status.
export function Tag({ tone, children, style }) {
  const map = {
    good: ['var(--green-dim)', 'var(--green)'], warn: ['var(--amber-dim)', 'var(--amber)'], bad: ['var(--red-dim)', 'var(--red)'],
    info: ['var(--blue-dim)', 'var(--blue)'], purple: ['var(--purple-dim)', 'var(--purple)'], c: ['var(--c-dim)', 'var(--c)'],
  };
  const [bg, fg] = map[tone] || ['var(--soft)', 'var(--muted)'];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 9px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: bg, color: fg, ...style }}>{children}</span>;
}

// Linha de lista (título + subtítulo + lado direito).
export function Row({ title, sub, right, onClick, left }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--bg3)', cursor: onClick ? 'pointer' : 'default' }}>
      {left}
      <div style={{ minWidth: 0, flex: 1 }}>
        <b style={{ fontWeight: 500, fontSize: 12.5, display: 'block', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</b>
        {sub && <small style={{ color: 'var(--muted)', fontSize: 11 }}>{sub}</small>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ children }) {
  return <p style={{ color: 'var(--muted)', fontSize: 12.5, padding: '14px 0' }}>{children}</p>;
}
